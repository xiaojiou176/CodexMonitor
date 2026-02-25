use std::path::{Path, PathBuf};

use std::sync::Arc;

use serde_json::json;
use tauri::{AppHandle, Manager, State};

use super::files::{list_workspace_files_inner, read_workspace_file_inner, WorkspaceFileResponse};
use super::git::{
    git_branch_exists, git_find_remote_for_branch, git_remote_branch_exists, git_remote_exists,
    is_missing_worktree_error, run_git_command_owned, unique_branch_name,
};
#[cfg(target_os = "macos")]
use super::macos::get_open_app_icon_inner;
use super::settings::apply_workspace_settings_update;
use super::worktree::{
    sanitize_worktree_name, unique_worktree_path, unique_worktree_path_for_rename,
};

use crate::backend::app_server::WorkspaceSession;
use crate::codex::spawn_workspace_session;
use crate::git_utils::resolve_git_root;
use crate::remote_backend;
use crate::shared::workspaces_core;
use crate::state::AppState;
use crate::types::{WorkspaceEntry, WorkspaceInfo, WorkspaceSettings, WorktreeSetupStatus};

fn canonicalize_existing_file(path: &Path) -> Result<PathBuf, String> {
    if !path.exists() {
        return Err(format!("Binary path does not exist: {}", path.display()));
    }
    if !path.is_file() {
        return Err(format!(
            "Binary path must point to a file: {}",
            path.display()
        ));
    }
    std::fs::canonicalize(path).map_err(|err| {
        format!(
            "Failed to canonicalize binary path {}: {err}",
            path.display()
        )
    })
}

fn is_allowed_codex_file_name(file_name: &str) -> bool {
    let lower = file_name.to_ascii_lowercase();
    matches!(
        lower.as_str(),
        "codex" | "codex.exe" | "codex.cmd" | "codex.bat"
    )
}

fn trusted_codex_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    #[cfg(not(target_os = "windows"))]
    {
        roots.push(PathBuf::from("/usr/local/bin"));
        roots.push(PathBuf::from("/opt/homebrew/bin"));
        roots.push(PathBuf::from("/usr/bin"));
        roots.push(PathBuf::from("/bin"));
        if let Ok(home) = std::env::var("HOME") {
            let home = PathBuf::from(home);
            roots.push(home.join(".local").join("bin"));
            roots.push(home.join("bin"));
            roots.push(home.join(".nvm"));
            roots.push(home.join(".volta").join("bin"));
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(program_files) = std::env::var("ProgramFiles") {
            roots.push(PathBuf::from(program_files));
        }
        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            roots.push(PathBuf::from(program_files_x86));
        }
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            roots.push(PathBuf::from(local_app_data));
        }
        if let Ok(app_data) = std::env::var("APPDATA") {
            roots.push(PathBuf::from(app_data));
        }
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            roots.push(PathBuf::from(user_profile).join("scoop").join("apps"));
        }
    }

    roots
}

fn validate_codex_bin_input(codex_bin: Option<String>) -> Result<Option<String>, String> {
    let Some(raw_value) = codex_bin else {
        return Ok(None);
    };

    let trimmed = raw_value.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let has_separator = trimmed.contains('/') || trimmed.contains('\\');
    if !has_separator {
        let lower = trimmed.to_ascii_lowercase();
        if lower == "codex" || lower == "codex.exe" {
            return Ok(Some(trimmed.to_string()));
        }
        return Err(format!("Untrusted codex command name: {trimmed}"));
    }

    let canonical = canonicalize_existing_file(Path::new(trimmed))?;
    let file_name = canonical
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("Invalid codex binary file name: {}", canonical.display()))?;
    if !is_allowed_codex_file_name(file_name) {
        return Err(format!(
            "Codex binary file name not allowed: {}",
            canonical.display()
        ));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = std::fs::metadata(&canonical).map_err(|err| {
            format!(
                "Failed to read codex binary metadata {}: {err}",
                canonical.display()
            )
        })?;
        if metadata.permissions().mode() & 0o111 == 0 {
            return Err(format!(
                "Codex binary is not executable: {}",
                canonical.display()
            ));
        }
    }

    let trusted_roots = trusted_codex_roots();
    if !trusted_roots
        .iter()
        .any(|root| canonical.starts_with(root))
    {
        return Err(format!(
            "Codex binary path is outside trusted directories: {}",
            canonical.display()
        ));
    }

    Ok(Some(canonical.to_string_lossy().to_string()))
}

fn is_allowed_open_workspace_command(command: &str) -> bool {
    matches!(
        command,
        "code"
            | "code-insiders"
            | "cursor"
            | "windsurf"
            | "zed"
            | "subl"
            | "idea"
            | "webstorm"
            | "pycharm"
    )
}

fn is_allowed_open_workspace_arg(arg: &str) -> bool {
    matches!(
        arg,
        "-n" | "-r" | "--new-window" | "--reuse-window" | "--wait" | "--add" | "--goto"
    )
}

fn validate_open_workspace_command_and_args(
    command: Option<String>,
    args: Vec<String>,
) -> Result<(Option<String>, Vec<String>), String> {
    if args.len() > 8 {
        return Err("Too many open_workspace_in arguments.".to_string());
    }

    let mut normalized_args = Vec::with_capacity(args.len());
    for arg in args {
        let trimmed = arg.trim().to_string();
        if trimmed.is_empty() {
            return Err("open_workspace_in argument cannot be empty.".to_string());
        }
        if !is_allowed_open_workspace_arg(&trimmed) {
            return Err(format!("open_workspace_in argument not allowed: {trimmed}"));
        }
        normalized_args.push(trimmed);
    }

    let normalized_command = match command {
        Some(value) => {
            let trimmed = value.trim().to_string();
            if trimmed.is_empty() {
                return Err("open_workspace_in command cannot be empty.".to_string());
            }
            if !trimmed
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || ch == '.' || ch == '_' || ch == '-')
            {
                return Err("open_workspace_in command contains unsupported characters.".to_string());
            }
            if !is_allowed_open_workspace_command(&trimmed) {
                return Err(format!("open_workspace_in command not allowed: {trimmed}"));
            }
            Some(trimmed)
        }
        None => None,
    };

    Ok((normalized_command, normalized_args))
}

fn spawn_with_app(
    app: &AppHandle,
    entry: WorkspaceEntry,
    default_bin: Option<String>,
    codex_args: Option<String>,
    codex_home: Option<PathBuf>,
) -> impl std::future::Future<Output = Result<Arc<WorkspaceSession>, String>> {
    spawn_workspace_session(entry, default_bin, codex_args, app.clone(), codex_home)
}

#[tauri::command]
pub(crate) async fn read_workspace_file(
    workspace_id: String,
    path: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorkspaceFileResponse, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let response = remote_backend::call_remote(
            &*state,
            app,
            "read_workspace_file",
            json!({ "workspaceId": workspace_id, "path": path }),
        )
        .await?;
        return serde_json::from_value(response).map_err(|err| err.to_string());
    }

    workspaces_core::read_workspace_file_core(
        &state.workspaces,
        &workspace_id,
        &path,
        |root, rel_path| read_workspace_file_inner(root, rel_path),
    )
    .await
}

#[tauri::command]
pub(crate) async fn list_workspaces(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Vec<WorkspaceInfo>, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let response =
            remote_backend::call_remote(&*state, app, "list_workspaces", json!({})).await?;
        return serde_json::from_value(response).map_err(|err| err.to_string());
    }

    Ok(workspaces_core::list_workspaces_core(&state.workspaces, &state.sessions).await)
}

#[tauri::command]
pub(crate) async fn is_workspace_path_dir(
    path: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<bool, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let response = remote_backend::call_remote(
            &*state,
            app,
            "is_workspace_path_dir",
            json!({ "path": path }),
        )
        .await?;
        return serde_json::from_value(response).map_err(|err| err.to_string());
    }
    Ok(workspaces_core::is_workspace_path_dir_core(&path))
}

#[tauri::command]
pub(crate) async fn add_workspace(
    path: String,
    codex_bin: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorkspaceInfo, String> {
    let codex_bin = validate_codex_bin_input(codex_bin)?;

    if remote_backend::is_remote_mode(&*state).await {
        let path = remote_backend::normalize_path_for_remote(path);
        let codex_bin = codex_bin.map(remote_backend::normalize_path_for_remote);
        let response = remote_backend::call_remote(
            &*state,
            app,
            "add_workspace",
            json!({ "path": path, "codex_bin": codex_bin }),
        )
        .await?;
        return serde_json::from_value(response).map_err(|err| err.to_string());
    }

    workspaces_core::add_workspace_core(
        path,
        codex_bin,
        &state.workspaces,
        &state.sessions,
        &state.app_settings,
        &state.storage_path,
        |entry, default_bin, codex_args, codex_home| {
            spawn_with_app(&app, entry, default_bin, codex_args, codex_home)
        },
    )
    .await
}

#[tauri::command]
pub(crate) async fn add_workspace_from_git_url(
    url: String,
    destination_path: String,
    target_folder_name: Option<String>,
    codex_bin: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorkspaceInfo, String> {
    let codex_bin = validate_codex_bin_input(codex_bin)?;

    if remote_backend::is_remote_mode(&*state).await {
        let destination_path = remote_backend::normalize_path_for_remote(destination_path);
        let codex_bin = codex_bin.map(remote_backend::normalize_path_for_remote);
        let response = remote_backend::call_remote(
            &*state,
            app,
            "add_workspace_from_git_url",
            json!({
                "url": url,
                "destinationPath": destination_path,
                "targetFolderName": target_folder_name,
                "codex_bin": codex_bin
            }),
        )
        .await?;
        return serde_json::from_value(response).map_err(|err| err.to_string());
    }

    workspaces_core::add_workspace_from_git_url_core(
        url,
        destination_path,
        target_folder_name,
        codex_bin,
        &state.workspaces,
        &state.sessions,
        &state.app_settings,
        &state.storage_path,
        |entry, default_bin, codex_args, codex_home| {
            spawn_with_app(&app, entry, default_bin, codex_args, codex_home)
        },
    )
    .await
}

#[tauri::command]
pub(crate) async fn add_clone(
    source_workspace_id: String,
    copy_name: String,
    copies_folder: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorkspaceInfo, String> {
    workspaces_core::add_clone_core(
        source_workspace_id,
        copy_name,
        copies_folder,
        &state.workspaces,
        &state.sessions,
        &state.app_settings,
        &state.storage_path,
        |entry, default_bin, codex_args, codex_home| {
            spawn_with_app(&app, entry, default_bin, codex_args, codex_home)
        },
    )
    .await
}

#[tauri::command]
pub(crate) async fn add_worktree(
    parent_id: String,
    branch: String,
    name: Option<String>,
    copy_agents_md: Option<bool>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorkspaceInfo, String> {
    let copy_agents_md = copy_agents_md.unwrap_or(true);
    if remote_backend::is_remote_mode(&*state).await {
        let response = remote_backend::call_remote(
            &*state,
            app,
            "add_worktree",
            json!({
                "parentId": parent_id,
                "branch": branch,
                "name": name,
                "copyAgentsMd": copy_agents_md
            }),
        )
        .await?;
        return serde_json::from_value(response).map_err(|err| err.to_string());
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Failed to resolve app data dir: {err}"))?;

    workspaces_core::add_worktree_core(
        parent_id,
        branch,
        name,
        copy_agents_md,
        &data_dir,
        &state.workspaces,
        &state.sessions,
        &state.app_settings,
        &state.storage_path,
        |value| sanitize_worktree_name(value),
        |root, name| Ok(unique_worktree_path(root, name)),
        |root, branch| {
            let root = root.clone();
            let branch = branch.to_string();
            async move { git_branch_exists(&root, &branch).await }
        },
        None::<fn(&PathBuf, &str) -> std::future::Ready<Result<Option<String>, String>>>,
        |root, args| {
            workspaces_core::run_git_command_unit(root, args, |repo, args_owned| {
                run_git_command_owned(repo, args_owned)
            })
        },
        |entry, default_bin, codex_args, codex_home| {
            spawn_with_app(&app, entry, default_bin, codex_args, codex_home)
        },
    )
    .await
}

#[tauri::command]
pub(crate) async fn worktree_setup_status(
    workspace_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorktreeSetupStatus, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let response = remote_backend::call_remote(
            &*state,
            app,
            "worktree_setup_status",
            json!({ "workspaceId": workspace_id }),
        )
        .await?;
        return serde_json::from_value(response).map_err(|err| err.to_string());
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Failed to resolve app data dir: {err}"))?;
    workspaces_core::worktree_setup_status_core(&state.workspaces, &workspace_id, &data_dir).await
}

#[tauri::command]
pub(crate) async fn worktree_setup_mark_ran(
    workspace_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    if remote_backend::is_remote_mode(&*state).await {
        remote_backend::call_remote(
            &*state,
            app,
            "worktree_setup_mark_ran",
            json!({ "workspaceId": workspace_id }),
        )
        .await?;
        return Ok(());
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Failed to resolve app data dir: {err}"))?;
    workspaces_core::worktree_setup_mark_ran_core(&state.workspaces, &workspace_id, &data_dir).await
}

#[tauri::command]
pub(crate) async fn remove_workspace(
    id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    if remote_backend::is_remote_mode(&*state).await {
        remote_backend::call_remote(&*state, app, "remove_workspace", json!({ "id": id })).await?;
        return Ok(());
    }

    workspaces_core::remove_workspace_core(
        id,
        &state.workspaces,
        &state.sessions,
        &state.storage_path,
        |root, args| {
            workspaces_core::run_git_command_unit(root, args, |repo, args_owned| {
                run_git_command_owned(repo, args_owned)
            })
        },
        |error| is_missing_worktree_error(error),
        |path| {
            std::fs::remove_dir_all(path)
                .map_err(|err| format!("Failed to remove worktree folder: {err}"))
        },
        true,
        true,
    )
    .await
}

#[tauri::command]
pub(crate) async fn remove_worktree(
    id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    if remote_backend::is_remote_mode(&*state).await {
        remote_backend::call_remote(&*state, app, "remove_worktree", json!({ "id": id })).await?;
        return Ok(());
    }

    workspaces_core::remove_worktree_core(
        id,
        &state.workspaces,
        &state.sessions,
        &state.storage_path,
        |root, args| {
            workspaces_core::run_git_command_unit(root, args, |repo, args_owned| {
                run_git_command_owned(repo, args_owned)
            })
        },
        |error| is_missing_worktree_error(error),
        |path| {
            std::fs::remove_dir_all(path)
                .map_err(|err| format!("Failed to remove worktree folder: {err}"))
        },
    )
    .await
}

#[tauri::command]
pub(crate) async fn rename_worktree(
    id: String,
    branch: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorkspaceInfo, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let response = remote_backend::call_remote(
            &*state,
            app,
            "rename_worktree",
            json!({ "id": id, "branch": branch }),
        )
        .await?;
        return serde_json::from_value(response).map_err(|err| err.to_string());
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Failed to resolve app data dir: {err}"))?;

    workspaces_core::rename_worktree_core(
        id,
        branch,
        &data_dir,
        &state.workspaces,
        &state.sessions,
        &state.app_settings,
        &state.storage_path,
        |entry| resolve_git_root(entry),
        |root, name| {
            let root = root.clone();
            let name = name.to_string();
            async move {
                unique_branch_name(&root, &name, None)
                    .await
                    .map(|(branch, _was_suffixed)| branch)
            }
        },
        |value| sanitize_worktree_name(value),
        |root, name, current| unique_worktree_path_for_rename(root, name, current),
        |root, args| {
            workspaces_core::run_git_command_unit(root, args, |repo, args_owned| {
                run_git_command_owned(repo, args_owned)
            })
        },
        |entry, default_bin, codex_args, codex_home| {
            spawn_with_app(&app, entry, default_bin, codex_args, codex_home)
        },
    )
    .await
}

#[tauri::command]
pub(crate) async fn rename_worktree_upstream(
    id: String,
    old_branch: String,
    new_branch: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    if remote_backend::is_remote_mode(&*state).await {
        remote_backend::call_remote(
            &*state,
            app,
            "rename_worktree_upstream",
            json!({ "id": id, "oldBranch": old_branch, "newBranch": new_branch }),
        )
        .await?;
        return Ok(());
    }

    workspaces_core::rename_worktree_upstream_core(
        id,
        old_branch,
        new_branch,
        &state.workspaces,
        |entry| resolve_git_root(entry),
        |root, branch| {
            let root = root.clone();
            let branch = branch.to_string();
            async move { git_branch_exists(&root, &branch).await }
        },
        |root, branch| {
            let root = root.clone();
            let branch = branch.to_string();
            async move { git_find_remote_for_branch(&root, &branch).await }
        },
        |root, remote| {
            let root = root.clone();
            let remote = remote.to_string();
            async move { git_remote_exists(&root, &remote).await }
        },
        |root, remote, branch| {
            let root = root.clone();
            let remote = remote.to_string();
            let branch = branch.to_string();
            async move { git_remote_branch_exists(&root, &remote, &branch).await }
        },
        |root, args| {
            workspaces_core::run_git_command_unit(root, args, |repo, args_owned| {
                run_git_command_owned(repo, args_owned)
            })
        },
    )
    .await
}

#[tauri::command]
pub(crate) async fn apply_worktree_changes(
    workspace_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    workspaces_core::apply_worktree_changes_core(&state.workspaces, workspace_id).await
}

#[tauri::command]
pub(crate) async fn update_workspace_settings(
    id: String,
    settings: WorkspaceSettings,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorkspaceInfo, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let response = remote_backend::call_remote(
            &*state,
            app,
            "update_workspace_settings",
            json!({ "id": id, "settings": settings }),
        )
        .await?;
        return serde_json::from_value(response).map_err(|err| err.to_string());
    }

    workspaces_core::update_workspace_settings_core(
        id,
        settings,
        &state.workspaces,
        &state.sessions,
        &state.app_settings,
        &state.storage_path,
        |workspaces, workspace_id, next_settings| {
            apply_workspace_settings_update(workspaces, workspace_id, next_settings)
        },
        |entry, default_bin, codex_args, codex_home| {
            spawn_with_app(&app, entry, default_bin, codex_args, codex_home)
        },
    )
    .await
}

#[tauri::command]
pub(crate) async fn update_workspace_codex_bin(
    id: String,
    codex_bin: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorkspaceInfo, String> {
    let codex_bin = validate_codex_bin_input(codex_bin)?;

    if remote_backend::is_remote_mode(&*state).await {
        let codex_bin = codex_bin.map(remote_backend::normalize_path_for_remote);
        let response = remote_backend::call_remote(
            &*state,
            app,
            "update_workspace_codex_bin",
            json!({ "id": id, "codex_bin": codex_bin }),
        )
        .await?;
        return serde_json::from_value(response).map_err(|err| err.to_string());
    }

    workspaces_core::update_workspace_codex_bin_core(
        id,
        codex_bin,
        &state.workspaces,
        &state.sessions,
        &state.storage_path,
    )
    .await
}

#[tauri::command]
pub(crate) async fn connect_workspace(
    id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    if remote_backend::is_remote_mode(&*state).await {
        remote_backend::call_remote(&*state, app, "connect_workspace", json!({ "id": id })).await?;
        return Ok(());
    }

    workspaces_core::connect_workspace_core(
        id,
        &state.workspaces,
        &state.sessions,
        &state.app_settings,
        |entry, default_bin, codex_args, codex_home| {
            spawn_with_app(&app, entry, default_bin, codex_args, codex_home)
        },
    )
    .await
}

#[tauri::command]
pub(crate) async fn list_workspace_files(
    workspace_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Vec<String>, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let response = remote_backend::call_remote(
            &*state,
            app,
            "list_workspace_files",
            json!({ "workspaceId": workspace_id }),
        )
        .await?;
        return serde_json::from_value(response).map_err(|err| err.to_string());
    }

    workspaces_core::list_workspace_files_core(&state.workspaces, &workspace_id, |root| {
        list_workspace_files_inner(root, usize::MAX)
    })
    .await
}

#[tauri::command]
pub(crate) async fn open_workspace_in(
    path: String,
    app: Option<String>,
    args: Vec<String>,
    command: Option<String>,
) -> Result<(), String> {
    let (command, args) = validate_open_workspace_command_and_args(command, args)?;
    workspaces_core::open_workspace_in_core(path, app, args, command).await
}

#[tauri::command]
pub(crate) async fn get_open_app_icon(app_name: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        return workspaces_core::get_open_app_icon_core(app_name, |name| {
            get_open_app_icon_inner(name)
        })
        .await;
    }

    #[cfg(not(target_os = "macos"))]
    {
        workspaces_core::get_open_app_icon_core(app_name, |_name| None).await
    }
}
