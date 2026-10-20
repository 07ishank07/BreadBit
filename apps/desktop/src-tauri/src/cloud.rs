//! Narrow cloud bridge. Renderer inputs cannot choose a host, local path, shell
//! command, HTTP headers or redirect destination. Credentials stay in memory.
use std::{sync::Mutex, time::Duration};
use serde_json::{json, Value};
use tauri::{State, AppHandle};
use tauri_plugin_opener::OpenerExt;

#[derive(Default)]
pub struct CloudSession(pub Mutex<Option<String>>);

fn origin() -> Result<reqwest::Url, String> {
    let value = option_env!("BREADBIT_CLOUD_URL").ok_or("Cloud service is not configured for this build.")?;
    let url = reqwest::Url::parse(value).map_err(|_| "Invalid configured cloud URL")?;
    let local = cfg!(debug_assertions) && url.scheme() == "http" && matches!(url.host_str(), Some("localhost" | "127.0.0.1"));
    if (url.scheme() != "https" && !local) || url.host_str().is_none() || !url.username().is_empty() || url.password().is_some() || url.query().is_some() || url.fragment().is_some() || url.path() != "/" {
        return Err("Cloud configuration requires an HTTPS origin.".into());
    }
    Ok(url)
}
fn allowed(method: &str, path: &str) -> bool {
    if matches!((method,path), ("GET","/v1/me") | ("DELETE","/v1/session") | ("GET","/v1/projects")) { return true; }
    let Some(suffix) = path.strip_prefix("/v1/projects/") else { return false };
    let (id, share) = suffix.strip_suffix("/share").map(|s| (s,true)).unwrap_or((suffix,false));
    !id.is_empty() && id.len() <= 128 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        && if share { matches!(method,"POST" | "DELETE") } else { matches!(method,"GET" | "PUT") }
}
async fn request(method: &str, path: &str, body: Value, token: Option<String>) -> Result<Value, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(20)).redirect(reqwest::redirect::Policy::none()).build().map_err(|_| "HTTP client unavailable")?;
    let url = origin()?.join(path).map_err(|_| "Invalid cloud route")?;
    let verb = reqwest::Method::from_bytes(method.as_bytes()).map_err(|_| "Invalid method")?;
    let mut outgoing = client.request(verb, url);
    if let Some(secret) = token { outgoing = outgoing.bearer_auth(secret); }
    if !body.is_null() {
        let text = serde_json::to_string(&body).map_err(|_| "Invalid request")?;
        if text.len() > 4 * 1024 * 1024 + 4096 { return Err("Cloud request too large".into()); }
        outgoing = outgoing.header("Content-Type", "application/json").body(text);
    }
    let mut response = outgoing.send().await.map_err(|_| "Cannot reach the cloud. Local edits are retained.")?;
    let status = response.status().as_u16();
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "Cloud response interrupted")? {
        if bytes.len() + chunk.len() > 5 * 1024 * 1024 { return Err("Cloud response too large".into()); }
        bytes.extend_from_slice(&chunk);
    }
    let data: Value = serde_json::from_slice(&bytes).map_err(|_| "Cloud returned an unexpected response")?;
    Ok(json!({"status": status, "body": data}))
}
#[tauri::command]
pub async fn cloud_begin_login(app: AppHandle, session: State<'_, CloudSession>) -> Result<Value, String> {
    let response = request("POST", "/v1/pair", json!({}), None).await?;
    if response["status"].as_u64() != Some(200) { return Err("Could not start sign in. Try again later.".into()); }
    let mut body = response["body"].clone();
    let secret = body["deviceCode"].as_str().filter(|s| s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit())).ok_or("Invalid device credential")?.to_string();
    let verification = body["verificationUrl"].as_str().ok_or("Missing sign in URL")?;
    let url = reqwest::Url::parse(verification).map_err(|_| "Invalid sign in URL")?;
    if url.origin() != origin()?.origin() || url.path() != "/connect" { return Err("Unexpected sign in destination".into()); }
    *session.0.lock().map_err(|_| "Session unavailable")? = Some(secret);
    // Only an exact, validated login URL can open an external browser.
    app.opener().open_url(url.as_str(), None::<&str>).map_err(|_| "Could not open the sign in browser")?;
    body.as_object_mut().ok_or("Invalid sign in response")?.remove("deviceCode");
    Ok(body)
}
#[tauri::command]
pub async fn cloud_request(method: String, path: String, body: Value, session: State<'_, CloudSession>) -> Result<Value, String> {
    if !allowed(&method, &path) { return Err("Cloud operation is not allowed".into()); }
    let secret = session.0.lock().map_err(|_| "Session unavailable")?.clone();
    request(&method, &path, body, secret).await
}
#[tauri::command]
pub fn cloud_forget_session(session: State<'_, CloudSession>) -> Result<(), String> {
    *session.0.lock().map_err(|_| "Session unavailable")? = None; Ok(())
}
#[tauri::command]
pub fn cloud_open_browser(app: AppHandle, page: String, code: String) -> Result<(), String> {
    if code.len() != 64 || !code.bytes().all(|b| b.is_ascii_hexdigit()) { return Err("Invalid viewing code".into()); }
    let route = match page.as_str() { "share" => format!("/share/{code}"), "connect" => format!("/connect?code={code}"), _ => return Err("Page is not allowed".into()) };
    let url = origin()?.join(&route).map_err(|_| "Invalid page")?;
    app.opener().open_url(url.as_str(), None::<&str>).map_err(|_| "Could not open the browser".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn scope_is_narrow() {
        assert!(allowed("PUT", "/v1/projects/example"));
        assert!(allowed("POST", "/v1/projects/example/share"));
        for path in ["https://example.com", "/v1/projects/../session", "/v1/projects/x?url=evil", "/v1/projects/x%2fshare", "/v1/pair"] { assert!(!allowed("PUT", path)); }
    }
}
