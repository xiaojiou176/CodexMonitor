use serde_json::Value;
use std::path::PathBuf;
use tauri::State;

use crate::state::AppState;

fn logs_dir_for_state(state: &AppState) -> PathBuf {
    state
        .settings_path
        .parent()
        .map(|path| path.join("logs"))
        .unwrap_or_else(|| PathBuf::from("logs"))
}

fn runtime_cache_dir() -> Option<PathBuf> {
    std::env::current_dir()
        .ok()
        .map(|path| path.join(".runtime-cache"))
}

pub(crate) fn run_startup_maintenance(state: &AppState) -> Result<(), String> {
    let logs_dir = logs_dir_for_state(state);
    let runtime_cache_dir = runtime_cache_dir();
    crate::shared::logging_core::run_startup_maintenance(&logs_dir, runtime_cache_dir.as_deref())
}

#[tauri::command]
pub(crate) async fn append_structured_log(
    level: String,
    source: String,
    message: String,
    context: Option<Value>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let logs_dir = logs_dir_for_state(&state);
    tokio::task::spawn_blocking(move || {
        crate::shared::logging_core::append_structured_log(
            &logs_dir, &level, &source, &message, context,
        )
    })
    .await
    .map_err(|err| format!("failed to join structured log writer task: {err}"))?
}
