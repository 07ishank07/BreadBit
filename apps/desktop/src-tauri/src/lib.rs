mod storage;
use serde::Serialize;
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tauri::State;
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct ProjectHandles(Mutex<HashMap<String, PathBuf>>);
#[derive(Serialize)]
struct NativeProject { handle: String, path: String, content: String, revision: String }

fn register(state: &ProjectHandles, path: PathBuf, content: String) -> Result<NativeProject, String> {
    let handle = uuid::Uuid::new_v4().to_string();
    let revision = storage::revision(content.as_bytes());
    state.0.lock().map_err(|_| "Project registry unavailable")?.insert(handle.clone(), path.clone());
    Ok(NativeProject { handle, path: path.to_string_lossy().into_owned(), content, revision })
}
#[tauri::command]
async fn open_project(app: tauri::AppHandle, state: State<'_, ProjectHandles>) -> Result<Option<NativeProject>, String> {
    let selected = app.dialog().file().add_filter("BreadBit / Velxio project", &["breadbit", "json", "vlx"]).blocking_pick_file();
    let Some(selected) = selected else { return Ok(None) };
    let path = selected.into_path().map_err(|e| e.to_string())?.canonicalize().map_err(|e| e.to_string())?;
    let content = storage::read(&path)?;
    register(&state, path, content).map(Some)
}
#[tauri::command]
async fn save_project(handle: String, content: String, expected_revision: String, state: State<'_, ProjectHandles>) -> Result<NativeProject, String> {
    let handles = state.0.lock().map_err(|_| "Project registry unavailable")?;
    let path = handles.get(&handle).ok_or("Unknown project handle; open the project first")?;
    let revision = storage::save(path, &content, Some(&expected_revision))?;
    Ok(NativeProject { handle, path: path.to_string_lossy().into_owned(), content, revision })
}
#[tauri::command]
async fn save_project_as(app: tauri::AppHandle, content: String, state: State<'_, ProjectHandles>) -> Result<Option<NativeProject>, String> {
    storage::validate(&content)?;
    let selected = app.dialog().file().add_filter("BreadBit project", &["breadbit"]).set_file_name("Untitled.breadbit").blocking_save_file();
    let Some(selected) = selected else { return Ok(None) };
    let path = selected.into_path().map_err(|e| e.to_string())?;
    // Save As requires a new destination to avoid replacing unrelated files.
    if path.exists() { return Err("Choose a new filename; use Save to update an opened project".into()); }
    {
        let _guard = state.0.lock().map_err(|_| "Project registry unavailable")?;
        storage::save(&path, &content, None)?;
    }
    register(&state, path, content).map(Some)
}
#[tauri::command]
fn close_project(handle: String, state: State<'_, ProjectHandles>) -> Result<(), String> {
    state.0.lock().map_err(|_| "Project registry unavailable")?.remove(&handle);
    Ok(())
}
#[tauri::command]
fn runtime_status() -> serde_json::Value {
    serde_json::json!({
        "platform": std::env::consts::OS,
        "version": env!("CARGO_PKG_VERSION"),
        "projectStorage": "native-dialog",
        "backend": {
            "state": "not-configured",
            "message": "No qualified native backend pack is bundled. See docs/desktop.md for the packaging gate. Editing and project storage are available."
        },
        "capabilities": { "localCompilation": false, "qemu": false }
    })
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ProjectHandles::default())
        .invoke_handler(tauri::generate_handler![open_project, save_project, save_project_as, close_project, runtime_status])
        .run(tauri::generate_context!())
        .expect("BreadBit could not start");
}
