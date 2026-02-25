use std::path::PathBuf;

use tokio::sync::Mutex;

use crate::codex::config as codex_config;
use crate::storage::write_settings;
use crate::types::AppSettings;

fn normalize_personality(value: &str) -> Option<&'static str> {
    match value.trim() {
        "friendly" => Some("friendly"),
        "pragmatic" => Some("pragmatic"),
        _ => None,
    }
}

fn sync_codex_config_from_settings(settings: &AppSettings) -> Result<(), String> {
    codex_config::write_collab_enabled(settings.experimental_collab_enabled)
        .map_err(|error| format!("failed to sync codex experimental_collab_enabled: {error}"))?;
    codex_config::write_collaboration_modes_enabled(settings.collaboration_modes_enabled)
        .map_err(|error| format!("failed to sync codex collaboration_modes_enabled: {error}"))?;
    codex_config::write_steer_enabled(settings.steer_enabled)
        .map_err(|error| format!("failed to sync codex steer_enabled: {error}"))?;
    codex_config::write_unified_exec_enabled(settings.unified_exec_enabled)
        .map_err(|error| format!("failed to sync codex unified_exec_enabled: {error}"))?;
    codex_config::write_apps_enabled(settings.experimental_apps_enabled)
        .map_err(|error| format!("failed to sync codex experimental_apps_enabled: {error}"))?;
    codex_config::write_personality(settings.personality.as_str())
        .map_err(|error| format!("failed to sync codex personality: {error}"))?;
    Ok(())
}

pub(crate) async fn get_app_settings_core(app_settings: &Mutex<AppSettings>) -> AppSettings {
    let mut settings = app_settings.lock().await.clone();
    if let Ok(Some(collab_enabled)) = codex_config::read_collab_enabled() {
        settings.experimental_collab_enabled = collab_enabled;
    }
    if let Ok(Some(collaboration_modes_enabled)) = codex_config::read_collaboration_modes_enabled()
    {
        settings.collaboration_modes_enabled = collaboration_modes_enabled;
    }
    if let Ok(Some(steer_enabled)) = codex_config::read_steer_enabled() {
        settings.steer_enabled = steer_enabled;
    }
    if let Ok(Some(unified_exec_enabled)) = codex_config::read_unified_exec_enabled() {
        settings.unified_exec_enabled = unified_exec_enabled;
    }
    if let Ok(Some(apps_enabled)) = codex_config::read_apps_enabled() {
        settings.experimental_apps_enabled = apps_enabled;
    }
    if let Ok(personality) = codex_config::read_personality() {
        settings.personality = personality
            .as_deref()
            .and_then(normalize_personality)
            .unwrap_or("friendly")
            .to_string();
    }
    settings
}

pub(crate) async fn update_app_settings_core(
    settings: AppSettings,
    app_settings: &Mutex<AppSettings>,
    settings_path: &PathBuf,
) -> Result<AppSettings, String> {
    let mut current = app_settings.lock().await;
    write_settings(settings_path, &settings)?;
    // Sync to Codex config is best-effort; mobile platforms may not have CODEX_HOME.
    let _ = sync_codex_config_from_settings(&settings);
    *current = settings.clone();
    Ok(settings)
}

pub(crate) async fn update_remote_backend_token_core(
    app_settings: &Mutex<AppSettings>,
    settings_path: &PathBuf,
    token: Option<&str>,
) -> Result<AppSettings, String> {
    let normalized_token = token
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let mut current = app_settings.lock().await;
    if current.remote_backend_token == normalized_token {
        return Ok(current.clone());
    }
    current.remote_backend_token = normalized_token;
    let next_settings = current.clone();
    write_settings(settings_path, &next_settings)?;
    Ok(next_settings)
}

pub(crate) fn get_codex_config_path_core() -> Result<String, String> {
    codex_config::config_toml_path()
        .ok_or_else(|| "Unable to resolve CODEX_HOME".to_string())
        .and_then(|path| {
            path.to_str()
                .map(|value| value.to_string())
                .ok_or_else(|| "Unable to resolve CODEX_HOME".to_string())
        })
}

#[cfg(test)]
mod tests {
    use super::{update_app_settings_core, update_remote_backend_token_core};
    use crate::storage::read_settings;
    use crate::types::AppSettings;
    use std::sync::Arc;
    use tokio::sync::Mutex;
    use uuid::Uuid;

    #[test]
    fn update_remote_backend_token_does_not_clobber_concurrent_fields() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("build runtime");
        runtime.block_on(async {
            let temp_dir =
                std::env::temp_dir().join(format!("codex-monitor-test-{}", Uuid::new_v4()));
            std::fs::create_dir_all(&temp_dir).expect("create temp dir");
            let settings_path = temp_dir.join("settings.json");
            let app_settings = Arc::new(Mutex::new(AppSettings::default()));

            let mut baseline = AppSettings::default();
            baseline.theme = "dark".to_string();
            update_app_settings_core(baseline, app_settings.as_ref(), &settings_path)
                .await
                .expect("write baseline settings");

            update_remote_backend_token_core(
                app_settings.as_ref(),
                &settings_path,
                Some("token-1"),
            )
            .await
            .expect("update token");

            let current = app_settings.lock().await.clone();
            assert_eq!(current.theme, "dark");
            assert_eq!(current.remote_backend_token.as_deref(), Some("token-1"));
        });
    }

    #[test]
    fn concurrent_updates_keep_memory_and_disk_consistent() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("build runtime");
        runtime.block_on(async {
            let temp_dir =
                std::env::temp_dir().join(format!("codex-monitor-test-{}", Uuid::new_v4()));
            std::fs::create_dir_all(&temp_dir).expect("create temp dir");
            let settings_path = temp_dir.join("settings.json");
            let app_settings = Arc::new(Mutex::new(AppSettings::default()));

            let mut handles = Vec::new();
            for index in 0..32 {
                let app_settings_ref = Arc::clone(&app_settings);
                let settings_path_ref = settings_path.clone();
                handles.push(tokio::spawn(async move {
                    if index % 2 == 0 {
                        let mut next = app_settings_ref.lock().await.clone();
                        next.theme = if index % 4 == 0 {
                            "dark".to_string()
                        } else {
                            "light".to_string()
                        };
                        update_app_settings_core(
                            next,
                            app_settings_ref.as_ref(),
                            &settings_path_ref,
                        )
                        .await
                        .expect("update app settings");
                    } else {
                        let token = format!("token-{index}");
                        update_remote_backend_token_core(
                            app_settings_ref.as_ref(),
                            &settings_path_ref,
                            Some(token.as_str()),
                        )
                        .await
                        .expect("update token");
                    }
                }));
            }
            for handle in handles {
                handle.await.expect("task join");
            }

            let in_memory = app_settings.lock().await.clone();
            let on_disk = read_settings(&settings_path).expect("read settings from disk");
            assert_eq!(in_memory.theme, on_disk.theme);
            assert_eq!(in_memory.remote_backend_token, on_disk.remote_backend_token);
        });
    }
}
