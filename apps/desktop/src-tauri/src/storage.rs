use sha2::{Digest, Sha256};
use std::{fs, io::{Read, Write}, path::Path};
pub const MAX_PROJECT_BYTES: usize = 16 * 1024 * 1024;

pub fn revision(bytes: &[u8]) -> String { format!("{:x}", Sha256::digest(bytes)) }

pub fn validate(content: &str) -> Result<(), String> {
    if content.len() > MAX_PROJECT_BYTES { return Err("Project exceeds 16 MiB".into()); }
    let value: serde_json::Value = serde_json::from_str(content).map_err(|e| e.to_string())?;
    if !value.is_object() { return Err("Project must be a JSON object".into()); }
    Ok(())
}
pub fn read(path: &Path) -> Result<String, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    if !file.metadata().map_err(|e| e.to_string())?.is_file() { return Err("Choose a regular project file".into()); }
    let mut bytes = Vec::new();
    file.take(MAX_PROJECT_BYTES as u64 + 1).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_PROJECT_BYTES { return Err("Project exceeds 16 MiB".into()); }
    let content = String::from_utf8(bytes).map_err(|e| e.to_string())?;
    validate(&content)?;
    Ok(content)
}
fn replace(path: &Path, content: &[u8], overwrite: bool) -> Result<(), String> {
    let parent = path.parent().ok_or("Project has no parent directory")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temp.write_all(content).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    if overwrite {
        temp.persist(path).map_err(|e| e.to_string())?;
    } else {
        temp.persist_noclobber(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
// Optimistic conflict detection: another process can still race the check/rename.
// This application's writes are serialized by the project registry mutex.
pub fn save(path: &Path, content: &str, expected: Option<&str>) -> Result<String, String> {
    validate(content)?;
    if path.exists() {
        let old = read(path)?;
        let actual = revision(old.as_bytes());
        if expected != Some(actual.as_str()) { return Err("CONFLICT: project changed outside BreadBit; reopen or Save As".into()); }
        let mut backup = path.as_os_str().to_os_string();
        backup.push(".bak");
        replace(Path::new(&backup), old.as_bytes(), true)?;
    } else if expected.is_some() {
        return Err("CONFLICT: project was moved or deleted; use Save As".into());
    }
    replace(path, content.as_bytes(), expected.is_some())?;
    Ok(revision(content.as_bytes()))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn backup_and_external_change_conflict() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("project.breadbit");
        let first = save(&path, r#"{"version":1}"#, None).unwrap();
        let second = save(&path, r#"{"version":2}"#, Some(&first)).unwrap();
        assert_eq!(fs::read_to_string(dir.path().join("project.breadbit.bak")).unwrap(), r#"{"version":1}"#);
        fs::write(&path, r#"{"version":3}"#).unwrap();
        assert!(save(&path, r#"{"version":4}"#, Some(&second)).unwrap_err().starts_with("CONFLICT:"));
        assert_eq!(read(&path).unwrap(), r#"{"version":3}"#);
    }
    #[test]
    fn invalid_document_preserves_original() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("project.json");
        let rev = save(&path, "{}", None).unwrap();
        assert!(save(&path, "[]", Some(&rev)).is_err());
        assert_eq!(read(&path).unwrap(), "{}");
        assert!(validate(&" ".repeat(MAX_PROJECT_BYTES + 1)).is_err());
    }
    #[test]
    fn unacknowledged_overwrite_and_missing_file_are_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("project.json");
        let rev = save(&path, "{}", None).unwrap();
        assert!(save(&path, "{}", None).is_err());
        fs::remove_file(&path).unwrap();
        assert!(save(&path, "{}", Some(&rev)).is_err());
    }
}
