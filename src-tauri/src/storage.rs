use std::collections::HashMap;
use std::path::PathBuf;

use crate::types::{AppSettings, WorkspaceEntry};
use serde_json::Value;

const REMOTE_BACKEND_TOKEN_FILE: &str = "remote_backend_token";

pub(crate) fn read_workspaces(path: &PathBuf) -> Result<HashMap<String, WorkspaceEntry>, String> {
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let data = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let list: Vec<WorkspaceEntry> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(list
        .into_iter()
        .map(|entry| (entry.id.clone(), entry))
        .collect())
}

pub(crate) fn write_workspaces(path: &PathBuf, entries: &[WorkspaceEntry]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
    std::fs::write(path, data).map_err(|e| e.to_string())
}

pub(crate) fn read_settings(path: &PathBuf) -> Result<AppSettings, String> {
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let data = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut settings: AppSettings = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    let legacy_token = settings.remote_backend_token.clone();
    let token_from_file = read_external_remote_backend_token(path)?;
    let mut should_rewrite_settings = false;
    if token_from_file.is_some() {
        settings.remote_backend_token = token_from_file;
        if legacy_token.is_some() {
            should_rewrite_settings = true;
        }
    } else if settings.remote_backend_token.is_some() {
        // Migrate legacy plain-text token from settings.json into external file.
        write_external_remote_backend_token(path, settings.remote_backend_token.as_deref())?;
        should_rewrite_settings = true;
    }
    settings.remote_backend_token = normalize_optional_token(settings.remote_backend_token);
    if should_rewrite_settings {
        write_settings(path, &settings)?;
    }
    Ok(settings)
}

pub(crate) fn write_settings(path: &PathBuf, settings: &AppSettings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    write_external_remote_backend_token(path, settings.remote_backend_token.as_deref())?;

    let mut value = serde_json::to_value(settings).map_err(|e| e.to_string())?;
    if let Value::Object(ref mut map) = value {
        map.remove("remoteBackendToken");
    }
    let data = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    atomic_write(path, &data)
}

fn normalize_optional_token(value: Option<String>) -> Option<String> {
    value
        .map(|candidate| candidate.trim().to_string())
        .filter(|candidate| !candidate.is_empty())
}

fn remote_backend_token_path(settings_path: &PathBuf) -> Result<PathBuf, String> {
    let parent = settings_path
        .parent()
        .ok_or_else(|| "Settings path has no parent directory".to_string())?;
    Ok(parent.join(REMOTE_BACKEND_TOKEN_FILE))
}

fn read_external_remote_backend_token(settings_path: &PathBuf) -> Result<Option<String>, String> {
    let token_path = remote_backend_token_path(settings_path)?;
    if !token_path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(token_path).map_err(|e| e.to_string())?;
    Ok(normalize_optional_token(Some(raw)))
}

fn write_external_remote_backend_token(
    settings_path: &PathBuf,
    token: Option<&str>,
) -> Result<(), String> {
    let token_path = remote_backend_token_path(settings_path)?;
    let normalized = token
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    if let Some(value) = normalized {
        atomic_write(&token_path, &value)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&token_path, std::fs::Permissions::from_mode(0o600))
                .map_err(|e| e.to_string())?;
        }
    } else if token_path.exists() {
        std::fs::remove_file(token_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn atomic_write(path: &PathBuf, data: &str) -> Result<(), String> {
    let temp_path = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4().simple()));
    std::fs::write(&temp_path, data).map_err(|e| e.to_string())?;
    std::fs::rename(&temp_path, path).map_err(|e| {
        let _ = std::fs::remove_file(&temp_path);
        e.to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::{read_settings, read_workspaces, write_settings, write_workspaces};
    use crate::types::{AppSettings, WorkspaceEntry, WorkspaceKind, WorkspaceSettings};
    use serde_json::{json, Value};
    use uuid::Uuid;

    #[test]
    fn write_read_workspaces_persists_sort_and_group() {
        let temp_dir = std::env::temp_dir().join(format!("codex-monitor-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).expect("create temp dir");
        let path = temp_dir.join("workspaces.json");

        let mut settings = WorkspaceSettings::default();
        settings.sort_order = Some(5);
        settings.group_id = Some("group-42".to_string());
        settings.sidebar_collapsed = true;
        settings.git_root = Some("/tmp".to_string());
        settings.codex_args = Some("--profile personal".to_string());

        let entry = WorkspaceEntry {
            id: "w1".to_string(),
            name: "Workspace".to_string(),
            path: "/tmp".to_string(),
            codex_bin: None,
            kind: WorkspaceKind::Main,
            parent_id: None,
            worktree: None,
            settings: settings.clone(),
        };

        write_workspaces(&path, &[entry]).expect("write workspaces");
        let read = read_workspaces(&path).expect("read workspaces");
        let stored = read.get("w1").expect("stored workspace");
        assert_eq!(stored.settings.sort_order, Some(5));
        assert_eq!(stored.settings.group_id.as_deref(), Some("group-42"));
        assert!(stored.settings.sidebar_collapsed);
        assert_eq!(stored.settings.git_root.as_deref(), Some("/tmp"));
        assert_eq!(
            stored.settings.codex_args.as_deref(),
            Some("--profile personal")
        );
    }

    #[test]
    fn write_settings_externalizes_remote_backend_token() {
        let temp_dir = std::env::temp_dir().join(format!("codex-monitor-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).expect("create temp dir");
        let settings_path = temp_dir.join("settings.json");
        let token_path = temp_dir.join("remote_backend_token");

        let mut settings = AppSettings::default();
        settings.remote_backend_token = Some("token-123".to_string());
        write_settings(&settings_path, &settings).expect("write settings");

        let persisted: Value = serde_json::from_str(
            &std::fs::read_to_string(&settings_path).expect("read persisted settings"),
        )
        .expect("parse persisted settings");
        assert!(persisted.get("remoteBackendToken").is_none());
        assert_eq!(
            std::fs::read_to_string(&token_path).expect("read external token"),
            "token-123"
        );
    }

    #[test]
    fn read_settings_migrates_legacy_plaintext_token() {
        let temp_dir = std::env::temp_dir().join(format!("codex-monitor-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).expect("create temp dir");
        let settings_path = temp_dir.join("settings.json");
        let token_path = temp_dir.join("remote_backend_token");

        let legacy_settings = json!({
            "theme": "dark",
            "remoteBackendToken": "legacy-token"
        });
        std::fs::write(
            &settings_path,
            serde_json::to_string_pretty(&legacy_settings).expect("serialize legacy settings"),
        )
        .expect("write legacy settings");

        let loaded = read_settings(&settings_path).expect("read settings");
        assert_eq!(loaded.remote_backend_token.as_deref(), Some("legacy-token"));
        assert_eq!(
            std::fs::read_to_string(token_path).expect("read migrated token"),
            "legacy-token"
        );
    }
}
