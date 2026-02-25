use super::*;
use serde::de::DeserializeOwned;

const MAX_PAGINATION_LIMIT: u32 = 500;
const MAX_GIT_ROOT_DEPTH: u32 = 64;
const MAX_LOCAL_USAGE_DAYS: u32 = 366;
const MAX_GITHUB_PR_NUMBER: u64 = 10_000_000;

fn is_valid_event_request_id(value: &Value) -> bool {
    match value {
        Value::Number(_) => true,
        Value::String(raw) => !raw.trim().is_empty(),
        _ => false,
    }
}

fn sanitize_app_server_event(payload: &AppServerEvent) -> Option<Value> {
    if payload.workspace_id.trim().is_empty() {
        return None;
    }

    let message = payload.message.as_object()?;
    let method = message.get("method").and_then(Value::as_str)?;
    if method.trim().is_empty() {
        return None;
    }
    if let Some(id) = message.get("id") {
        if !is_valid_event_request_id(id) {
            return None;
        }
    }

    Some(json!({
        "workspace_id": payload.workspace_id,
        "message": payload.message,
    }))
}

pub(super) fn build_error_response(id: Option<u64>, code: &str, message: &str) -> Option<String> {
    let id = id?;
    Some(
        serde_json::to_string(&json!({
            "id": id,
            "error": {
                "code": code,
                "message": message
            }
        }))
        .unwrap_or_else(|_| {
            "{\"id\":0,\"error\":{\"code\":\"INTERNAL_ERROR\",\"message\":\"serialization failed\"}}".to_string()
        }),
    )
}

pub(super) fn build_result_response(id: Option<u64>, result: Value) -> Option<String> {
    let id = id?;
    Some(
        serde_json::to_string(&json!({ "id": id, "result": result })).unwrap_or_else(|_| {
            "{\"id\":0,\"error\":{\"code\":\"INTERNAL_ERROR\",\"message\":\"serialization failed\"}}".to_string()
        }),
    )
}

fn build_event_notification(event: DaemonEvent) -> Option<String> {
    let payload = match event {
        DaemonEvent::AppServer(payload) => json!({
            "method": "app-server-event",
            "params": sanitize_app_server_event(&payload)?,
        }),
        DaemonEvent::TerminalOutput(payload) => json!({
            "method": "terminal-output",
            "params": payload,
        }),
        DaemonEvent::TerminalExit(payload) => json!({
            "method": "terminal-exit",
            "params": payload,
        }),
    };
    serde_json::to_string(&payload).ok()
}

fn build_event_stream_lagged_notification(dropped_count: u64) -> Option<String> {
    serde_json::to_string(&json!({
        "method": "app-server-event",
        "params": {
            "workspace_id": "__daemon__",
            "message": {
                "method": "codex/eventStreamLagged",
                "params": {
                    "droppedCount": dropped_count,
                }
            }
        }
    }))
    .ok()
}

pub(super) fn parse_auth_token(params: &Value) -> Option<String> {
    match params {
        Value::String(value) => Some(value.clone()),
        Value::Object(map) => map
            .get("token")
            .and_then(|value| value.as_str())
            .map(|v| v.to_string()),
        _ => None,
    }
}

fn parse_string(value: &Value, key: &str) -> Result<String, String> {
    match value {
        Value::Object(map) => map
            .get(key)
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
            .ok_or_else(|| format!("missing or invalid `{key}`")),
        _ => Err(format!("missing `{key}`")),
    }
}

fn parse_optional_string(value: &Value, key: &str) -> Option<String> {
    match value {
        Value::Object(map) => map
            .get(key)
            .and_then(|value| value.as_str())
            .map(|v| v.to_string()),
        _ => None,
    }
}

fn parse_optional_bounded_u32(value: &Value, key: &str, max: u32) -> Result<Option<u32>, String> {
    let Value::Object(map) = value else {
        return Ok(None);
    };

    let Some(raw) = map.get(key) else {
        return Ok(None);
    };

    let number = raw
        .as_u64()
        .ok_or_else(|| format!("invalid `{key}`: expected unsigned integer"))?;
    if number > u32::MAX as u64 {
        return Err(format!("invalid `{key}`: value is too large"));
    }
    let number = number as u32;
    if number > max {
        return Err(format!("invalid `{key}`: must be <= {max}"));
    }

    Ok(Some(number))
}

fn parse_required_bounded_u64(value: &Value, key: &str, max: u64) -> Result<u64, String> {
    let number =
        parse_optional_u64(value, key).ok_or_else(|| format!("missing or invalid `{key}`"))?;
    if number > max {
        return Err(format!("invalid `{key}`: must be <= {max}"));
    }
    Ok(number)
}

fn parse_optional_bool(value: &Value, key: &str) -> Option<bool> {
    match value {
        Value::Object(map) => map.get(key).and_then(|value| value.as_bool()),
        _ => None,
    }
}

fn parse_optional_string_array(value: &Value, key: &str) -> Result<Option<Vec<String>>, String> {
    let Value::Object(map) = value else {
        return Ok(None);
    };

    let Some(raw) = map.get(key) else {
        return Ok(None);
    };

    let items = raw
        .as_array()
        .ok_or_else(|| format!("invalid `{key}`: expected array of strings"))?;

    let mut values = Vec::with_capacity(items.len());
    for (index, item) in items.iter().enumerate() {
        let Some(item) = item.as_str() else {
            return Err(format!(
                "invalid `{key}`: element at index {index} must be a string"
            ));
        };
        values.push(item.to_string());
    }

    Ok(Some(values))
}

fn parse_string_array(value: &Value, key: &str) -> Result<Vec<String>, String> {
    parse_optional_string_array(value, key)?.ok_or_else(|| format!("missing `{key}`"))
}

fn classify_rpc_error_code(message: &str) -> &'static str {
    if message.starts_with("unknown method:") {
        "METHOD_NOT_FOUND"
    } else if message.starts_with("missing ")
        || message.starts_with("invalid ")
        || message.contains("missing or invalid")
    {
        "INVALID_PARAMS"
    } else {
        "INTERNAL_ERROR"
    }
}

fn parse_optional_value(value: &Value, key: &str) -> Option<Value> {
    match value {
        Value::Object(map) => map.get(key).cloned(),
        _ => None,
    }
}

fn normalize_request_id(value: &Value) -> Result<Value, String> {
    match value {
        Value::Number(number) => Ok(Value::Number(number.clone())),
        Value::String(raw) => {
            if raw.trim().is_empty() {
                Err("invalid `requestId`: must not be empty".to_string())
            } else {
                Ok(Value::String(raw.clone()))
            }
        }
        _ => Err("invalid `requestId`: expected number or non-empty string".to_string()),
    }
}

fn validate_response_workspace_binding(
    params: &serde_json::Map<String, Value>,
    workspace_id: &str,
    request_id: &Value,
) -> Result<(), String> {
    let request_workspace_id = params
        .get("requestWorkspaceId")
        .and_then(Value::as_str)
        .ok_or("missing or invalid `requestWorkspaceId`")?;

    if request_workspace_id != workspace_id {
        return Err("workspace/request binding mismatch".to_string());
    }

    let request_id_echo = params
        .get("requestIdEcho")
        .ok_or_else(|| "missing `requestIdEcho`".to_string())
        .and_then(normalize_request_id)?;

    if request_id_echo != *request_id {
        return Err("request id binding mismatch".to_string());
    }

    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileReadRequest {
    scope: file_policy::FileScope,
    kind: file_policy::FileKind,
    workspace_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileWriteRequest {
    scope: file_policy::FileScope,
    kind: file_policy::FileKind,
    workspace_id: Option<String>,
    content: String,
}

fn parse_file_read_request(params: &Value) -> Result<FileReadRequest, String> {
    serde_json::from_value(params.clone()).map_err(|err| err.to_string())
}

fn parse_file_write_request(params: &Value) -> Result<FileWriteRequest, String> {
    serde_json::from_value(params.clone()).map_err(|err| err.to_string())
}

fn parse_input<T: DeserializeOwned>(params: &Value) -> Result<T, String> {
    let input_value = params
        .as_object()
        .and_then(|map| map.get("input"))
        .cloned()
        .ok_or_else(|| "missing `input`".to_string())?;
    serde_json::from_value(input_value).map_err(|err| err.to_string())
}

pub(super) async fn handle_rpc_request(
    state: &DaemonState,
    method: &str,
    params: Value,
    client_version: String,
) -> Result<Value, String> {
    match method {
        "ping" => Ok(json!({ "ok": true })),
        "daemon_info" => Ok(state.daemon_info()),
        "daemon_shutdown" => {
            tokio::spawn(async {
                sleep(Duration::from_millis(100)).await;
                std::process::exit(0);
            });
            Ok(json!({ "ok": true }))
        }
        "list_workspaces" => {
            let workspaces = state.list_workspaces().await;
            serde_json::to_value(workspaces).map_err(|err| err.to_string())
        }
        "is_workspace_path_dir" => {
            let path = parse_string(&params, "path")?;
            let is_dir = state.is_workspace_path_dir(path).await;
            serde_json::to_value(is_dir).map_err(|err| err.to_string())
        }
        "add_workspace" => {
            let path = parse_string(&params, "path")?;
            let codex_bin = parse_optional_string(&params, "codex_bin");
            let workspace = state.add_workspace(path, codex_bin, client_version).await?;
            serde_json::to_value(workspace).map_err(|err| err.to_string())
        }
        "add_workspace_from_git_url" => {
            let url = parse_string(&params, "url")?;
            let destination_path = parse_string(&params, "destinationPath")?;
            let target_folder_name = parse_optional_string(&params, "targetFolderName");
            let codex_bin = parse_optional_string(&params, "codex_bin");
            let workspace = state
                .add_workspace_from_git_url(
                    url,
                    destination_path,
                    target_folder_name,
                    codex_bin,
                    client_version,
                )
                .await?;
            serde_json::to_value(workspace).map_err(|err| err.to_string())
        }
        "add_worktree" => {
            let parent_id = parse_string(&params, "parentId")?;
            let branch = parse_string(&params, "branch")?;
            let name = parse_optional_string(&params, "name");
            let copy_agents_md = parse_optional_bool(&params, "copyAgentsMd").unwrap_or(true);
            let workspace = state
                .add_worktree(parent_id, branch, name, copy_agents_md, client_version)
                .await?;
            serde_json::to_value(workspace).map_err(|err| err.to_string())
        }
        "worktree_setup_status" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let status = state.worktree_setup_status(workspace_id).await?;
            serde_json::to_value(status).map_err(|err| err.to_string())
        }
        "worktree_setup_mark_ran" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.worktree_setup_mark_ran(workspace_id).await?;
            Ok(json!({ "ok": true }))
        }
        "connect_workspace" => {
            let id = parse_string(&params, "id")?;
            state.connect_workspace(id, client_version).await?;
            Ok(json!({ "ok": true }))
        }
        "remove_workspace" => {
            let id = parse_string(&params, "id")?;
            state.remove_workspace(id).await?;
            Ok(json!({ "ok": true }))
        }
        "remove_worktree" => {
            let id = parse_string(&params, "id")?;
            state.remove_worktree(id).await?;
            Ok(json!({ "ok": true }))
        }
        "rename_worktree" => {
            let id = parse_string(&params, "id")?;
            let branch = parse_string(&params, "branch")?;
            let workspace = state.rename_worktree(id, branch, client_version).await?;
            serde_json::to_value(workspace).map_err(|err| err.to_string())
        }
        "rename_worktree_upstream" => {
            let id = parse_string(&params, "id")?;
            let old_branch = parse_string(&params, "oldBranch")?;
            let new_branch = parse_string(&params, "newBranch")?;
            state
                .rename_worktree_upstream(id, old_branch, new_branch)
                .await?;
            Ok(json!({ "ok": true }))
        }
        "update_workspace_settings" => {
            let id = parse_string(&params, "id")?;
            let settings_value = match params {
                Value::Object(map) => map.get("settings").cloned().unwrap_or(Value::Null),
                _ => Value::Null,
            };
            let settings: WorkspaceSettings =
                serde_json::from_value(settings_value).map_err(|err| err.to_string())?;
            let workspace = state
                .update_workspace_settings(id, settings, client_version)
                .await?;
            serde_json::to_value(workspace).map_err(|err| err.to_string())
        }
        "update_workspace_codex_bin" => {
            let id = parse_string(&params, "id")?;
            let codex_bin = parse_optional_string(&params, "codex_bin");
            let workspace = state.update_workspace_codex_bin(id, codex_bin).await?;
            serde_json::to_value(workspace).map_err(|err| err.to_string())
        }
        "list_workspace_files" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let files = state.list_workspace_files(workspace_id).await?;
            serde_json::to_value(files).map_err(|err| err.to_string())
        }
        "read_workspace_file" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let path = parse_string(&params, "path")?;
            let response = state.read_workspace_file(workspace_id, path).await?;
            serde_json::to_value(response).map_err(|err| err.to_string())
        }
        "file_read" => {
            let request = parse_file_read_request(&params)?;
            let response = state
                .file_read(request.scope, request.kind, request.workspace_id)
                .await?;
            serde_json::to_value(response).map_err(|err| err.to_string())
        }
        "file_write" => {
            let request = parse_file_write_request(&params)?;
            state
                .file_write(
                    request.scope,
                    request.kind,
                    request.workspace_id,
                    request.content,
                )
                .await?;
            serde_json::to_value(json!({ "ok": true })).map_err(|err| err.to_string())
        }
        "get_app_settings" => {
            let settings = state.get_app_settings().await;
            serde_json::to_value(settings).map_err(|err| err.to_string())
        }
        "update_app_settings" => {
            let settings_value = match params {
                Value::Object(map) => map.get("settings").cloned().unwrap_or(Value::Null),
                _ => Value::Null,
            };
            let settings: AppSettings =
                serde_json::from_value(settings_value).map_err(|err| err.to_string())?;
            let updated = state.update_app_settings(settings).await?;
            serde_json::to_value(updated).map_err(|err| err.to_string())
        }
        "orbit_connect_test" => {
            let result = state.orbit_connect_test().await?;
            serde_json::to_value(result).map_err(|err| err.to_string())
        }
        "orbit_sign_in_start" => {
            let result = state.orbit_sign_in_start().await?;
            serde_json::to_value(result).map_err(|err| err.to_string())
        }
        "orbit_sign_in_poll" => {
            let device_code = parse_string(&params, "deviceCode")?;
            let result = state.orbit_sign_in_poll(device_code).await?;
            serde_json::to_value(result).map_err(|err| err.to_string())
        }
        "orbit_sign_out" => {
            let result = state.orbit_sign_out().await?;
            serde_json::to_value(result).map_err(|err| err.to_string())
        }
        "get_codex_config_path" => {
            let path = settings_core::get_codex_config_path_core()?;
            Ok(Value::String(path))
        }
        "get_config_model" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.get_config_model(workspace_id).await
        }
        "start_thread" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.start_thread(workspace_id).await
        }
        "resume_thread" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let thread_id = parse_string(&params, "threadId")?;
            state.resume_thread(workspace_id, thread_id).await
        }
        "fork_thread" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let thread_id = parse_string(&params, "threadId")?;
            state.fork_thread(workspace_id, thread_id).await
        }
        "list_threads" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let cursor = parse_optional_string(&params, "cursor");
            let limit = parse_optional_bounded_u32(&params, "limit", MAX_PAGINATION_LIMIT)?;
            let sort_key = parse_optional_string(&params, "sortKey");
            let cwd = parse_optional_string(&params, "cwd");
            state
                .list_threads(workspace_id, cursor, limit, sort_key, cwd)
                .await
        }
        "list_mcp_server_status" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let cursor = parse_optional_string(&params, "cursor");
            let limit = parse_optional_bounded_u32(&params, "limit", MAX_PAGINATION_LIMIT)?;
            state
                .list_mcp_server_status(workspace_id, cursor, limit)
                .await
        }
        "archive_thread" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let thread_id = parse_string(&params, "threadId")?;
            state.archive_thread(workspace_id, thread_id).await
        }
        "archive_threads" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let thread_ids = parse_string_array(&params, "threadIds")?;
            state.archive_threads(workspace_id, thread_ids).await
        }
        "compact_thread" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let thread_id = parse_string(&params, "threadId")?;
            state.compact_thread(workspace_id, thread_id).await
        }
        "thread_live_subscribe" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let thread_id = parse_string(&params, "threadId")?;
            state.thread_live_subscribe(workspace_id, thread_id).await
        }
        "thread_live_unsubscribe" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let thread_id = parse_string(&params, "threadId")?;
            state.thread_live_unsubscribe(workspace_id, thread_id).await
        }
        "set_thread_name" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let thread_id = parse_string(&params, "threadId")?;
            let name = parse_string(&params, "name")?;
            state.set_thread_name(workspace_id, thread_id, name).await
        }
        "send_user_message" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let thread_id = parse_string(&params, "threadId")?;
            let text = parse_string(&params, "text")?;
            let model = parse_optional_string(&params, "model");
            let effort = parse_optional_string(&params, "effort");
            let access_mode = parse_optional_string(&params, "accessMode");
            let images = parse_optional_string_array(&params, "images")?;
            let app_mentions = parse_optional_value(&params, "appMentions")
                .and_then(|value| value.as_array().cloned());
            let skill_mentions = parse_optional_value(&params, "skillMentions")
                .and_then(|value| value.as_array().cloned());
            let collaboration_mode = parse_optional_value(&params, "collaborationMode");
            state
                .send_user_message(
                    workspace_id,
                    thread_id,
                    text,
                    model,
                    effort,
                    access_mode,
                    images,
                    app_mentions,
                    skill_mentions,
                    collaboration_mode,
                )
                .await
        }
        "turn_interrupt" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let thread_id = parse_string(&params, "threadId")?;
            let turn_id = parse_string(&params, "turnId")?;
            state.turn_interrupt(workspace_id, thread_id, turn_id).await
        }
        "turn_steer" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let thread_id = parse_string(&params, "threadId")?;
            let turn_id = parse_string(&params, "turnId")?;
            let text = parse_string(&params, "text")?;
            let images = parse_optional_string_array(&params, "images")?;
            let app_mentions = parse_optional_value(&params, "appMentions")
                .and_then(|value| value.as_array().cloned());
            let skill_mentions = parse_optional_value(&params, "skillMentions")
                .and_then(|value| value.as_array().cloned());
            state
                .turn_steer(
                    workspace_id,
                    thread_id,
                    turn_id,
                    text,
                    images,
                    app_mentions,
                    skill_mentions,
                )
                .await
        }
        "start_review" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let thread_id = parse_string(&params, "threadId")?;
            let target = params
                .as_object()
                .and_then(|map| map.get("target"))
                .cloned()
                .ok_or("missing `target`")?;
            let delivery = parse_optional_string(&params, "delivery");
            state
                .start_review(workspace_id, thread_id, target, delivery)
                .await
        }
        "model_list" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.model_list(workspace_id).await
        }
        "experimental_feature_list" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let cursor = parse_optional_string(&params, "cursor");
            let limit = parse_optional_bounded_u32(&params, "limit", MAX_PAGINATION_LIMIT)?;
            state
                .experimental_feature_list(workspace_id, cursor, limit)
                .await
        }
        "set_codex_feature_flag" => {
            let feature_key = parse_string(&params, "featureKey")?;
            let enabled =
                parse_optional_bool(&params, "enabled").ok_or("missing or invalid `enabled`")?;
            state
                .set_codex_feature_flag(feature_key, enabled)
                .await
                .map(|_| json!({ "ok": true }))
        }
        "collaboration_mode_list" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.collaboration_mode_list(workspace_id).await
        }
        "get_agents_settings" => state
            .get_agents_settings()
            .await
            .and_then(|value| serde_json::to_value(value).map_err(|err| err.to_string())),
        "set_agents_core_settings" => {
            let input = parse_input::<agents_config_core::SetAgentsCoreInput>(&params)?;
            state
                .set_agents_core_settings(input)
                .await
                .and_then(|value| serde_json::to_value(value).map_err(|err| err.to_string()))
        }
        "create_agent" => {
            let input = parse_input::<agents_config_core::CreateAgentInput>(&params)?;
            state
                .create_agent(input)
                .await
                .and_then(|value| serde_json::to_value(value).map_err(|err| err.to_string()))
        }
        "update_agent" => {
            let input = parse_input::<agents_config_core::UpdateAgentInput>(&params)?;
            state
                .update_agent(input)
                .await
                .and_then(|value| serde_json::to_value(value).map_err(|err| err.to_string()))
        }
        "delete_agent" => {
            let input = parse_input::<agents_config_core::DeleteAgentInput>(&params)?;
            state
                .delete_agent(input)
                .await
                .and_then(|value| serde_json::to_value(value).map_err(|err| err.to_string()))
        }
        "read_agent_config_toml" => {
            let agent_name = parse_string(&params, "agentName")?;
            state
                .read_agent_config_toml(agent_name)
                .await
                .and_then(|value| serde_json::to_value(value).map_err(|err| err.to_string()))
        }
        "write_agent_config_toml" => {
            let agent_name = parse_string(&params, "agentName")?;
            let content = parse_string(&params, "content")?;
            state
                .write_agent_config_toml(agent_name, content)
                .await
                .map(|_| json!({ "ok": true }))
        }
        "account_rate_limits" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.account_rate_limits(workspace_id).await
        }
        "account_read" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.account_read(workspace_id).await
        }
        "codex_login" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.codex_login(workspace_id).await
        }
        "codex_login_cancel" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.codex_login_cancel(workspace_id).await
        }
        "skills_list" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.skills_list(workspace_id).await
        }
        "apps_list" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let cursor = parse_optional_string(&params, "cursor");
            let limit = parse_optional_bounded_u32(&params, "limit", MAX_PAGINATION_LIMIT)?;
            let thread_id = parse_optional_string(&params, "threadId");
            state
                .apps_list(workspace_id, cursor, limit, thread_id)
                .await
        }
        "respond_to_server_request" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let map = params.as_object().ok_or("missing requestId")?;
            let request_id = map
                .get("requestId")
                .ok_or_else(|| "missing requestId".to_string())
                .and_then(normalize_request_id)?;
            validate_response_workspace_binding(map, &workspace_id, &request_id)?;
            let result = map.get("result").cloned().ok_or("missing `result`")?;
            state
                .respond_to_server_request(workspace_id, request_id, result)
                .await
        }
        "remember_approval_rule" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let command = parse_string_array(&params, "command")?;
            state.remember_approval_rule(workspace_id, command).await
        }
        "add_clone" => {
            let source_workspace_id = parse_string(&params, "sourceWorkspaceId")?;
            let copies_folder = parse_string(&params, "copiesFolder")?;
            let copy_name = parse_string(&params, "copyName")?;
            let workspace = state
                .add_clone(
                    source_workspace_id,
                    copies_folder,
                    copy_name,
                    client_version,
                )
                .await?;
            serde_json::to_value(workspace).map_err(|err| err.to_string())
        }
        "apply_worktree_changes" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.apply_worktree_changes(workspace_id).await?;
            Ok(json!({ "ok": true }))
        }
        "open_workspace_in" => {
            let path = parse_string(&params, "path")?;
            let app = parse_optional_string(&params, "app");
            let command = parse_optional_string(&params, "command");
            let args = parse_optional_string_array(&params, "args")?.unwrap_or_default();
            state.open_workspace_in(path, app, args, command).await?;
            Ok(json!({ "ok": true }))
        }
        "get_open_app_icon" => {
            let app_name = parse_string(&params, "appName")?;
            let icon = state.get_open_app_icon(app_name).await?;
            serde_json::to_value(icon).map_err(|err| err.to_string())
        }
        "get_git_status" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.get_git_status(workspace_id).await
        }
        "list_git_roots" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let depth = parse_optional_bounded_u32(&params, "depth", MAX_GIT_ROOT_DEPTH)?
                .map(|value| value as usize);
            let roots = state.list_git_roots(workspace_id, depth).await?;
            serde_json::to_value(roots).map_err(|err| err.to_string())
        }
        "get_git_diffs" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let diffs = state.get_git_diffs(workspace_id).await?;
            serde_json::to_value(diffs).map_err(|err| err.to_string())
        }
        "get_git_log" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let limit = parse_optional_bounded_u32(&params, "limit", MAX_PAGINATION_LIMIT)?
                .map(|value| value as usize);
            let log = state.get_git_log(workspace_id, limit).await?;
            serde_json::to_value(log).map_err(|err| err.to_string())
        }
        "get_git_commit_diff" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let sha = parse_string(&params, "sha")?;
            let diff = state.get_git_commit_diff(workspace_id, sha).await?;
            serde_json::to_value(diff).map_err(|err| err.to_string())
        }
        "get_git_remote" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let remote = state.get_git_remote(workspace_id).await?;
            serde_json::to_value(remote).map_err(|err| err.to_string())
        }
        "stage_git_file" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let path = parse_string(&params, "path")?;
            state.stage_git_file(workspace_id, path).await?;
            Ok(json!({ "ok": true }))
        }
        "stage_git_all" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.stage_git_all(workspace_id).await?;
            Ok(json!({ "ok": true }))
        }
        "unstage_git_file" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let path = parse_string(&params, "path")?;
            state.unstage_git_file(workspace_id, path).await?;
            Ok(json!({ "ok": true }))
        }
        "revert_git_file" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let path = parse_string(&params, "path")?;
            state.revert_git_file(workspace_id, path).await?;
            Ok(json!({ "ok": true }))
        }
        "revert_git_all" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.revert_git_all(workspace_id).await?;
            Ok(json!({ "ok": true }))
        }
        "commit_git" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let message = parse_string(&params, "message")?;
            state.commit_git(workspace_id, message).await?;
            Ok(json!({ "ok": true }))
        }
        "push_git" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.push_git(workspace_id).await?;
            Ok(json!({ "ok": true }))
        }
        "pull_git" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.pull_git(workspace_id).await?;
            Ok(json!({ "ok": true }))
        }
        "fetch_git" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.fetch_git(workspace_id).await?;
            Ok(json!({ "ok": true }))
        }
        "sync_git" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.sync_git(workspace_id).await?;
            Ok(json!({ "ok": true }))
        }
        "get_github_issues" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let issues = state.get_github_issues(workspace_id).await?;
            serde_json::to_value(issues).map_err(|err| err.to_string())
        }
        "get_github_pull_requests" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let prs = state.get_github_pull_requests(workspace_id).await?;
            serde_json::to_value(prs).map_err(|err| err.to_string())
        }
        "get_github_pull_request_diff" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let pr_number = parse_required_bounded_u64(&params, "prNumber", MAX_GITHUB_PR_NUMBER)?;
            let diff = state
                .get_github_pull_request_diff(workspace_id, pr_number)
                .await?;
            serde_json::to_value(diff).map_err(|err| err.to_string())
        }
        "get_github_pull_request_comments" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let pr_number = parse_required_bounded_u64(&params, "prNumber", MAX_GITHUB_PR_NUMBER)?;
            let comments = state
                .get_github_pull_request_comments(workspace_id, pr_number)
                .await?;
            serde_json::to_value(comments).map_err(|err| err.to_string())
        }
        "list_git_branches" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            state.list_git_branches(workspace_id).await
        }
        "checkout_git_branch" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let name = parse_string(&params, "name")?;
            state.checkout_git_branch(workspace_id, name).await?;
            Ok(json!({ "ok": true }))
        }
        "create_git_branch" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let name = parse_string(&params, "name")?;
            state.create_git_branch(workspace_id, name).await?;
            Ok(json!({ "ok": true }))
        }
        "prompts_list" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let prompts = state.prompts_list(workspace_id).await?;
            serde_json::to_value(prompts).map_err(|err| err.to_string())
        }
        "prompts_workspace_dir" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let dir = state.prompts_workspace_dir(workspace_id).await?;
            Ok(Value::String(dir))
        }
        "prompts_global_dir" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let dir = state.prompts_global_dir(workspace_id).await?;
            Ok(Value::String(dir))
        }
        "prompts_create" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let scope = parse_string(&params, "scope")?;
            let name = parse_string(&params, "name")?;
            let description = parse_optional_string(&params, "description");
            let argument_hint = parse_optional_string(&params, "argumentHint");
            let content = parse_string(&params, "content")?;
            let prompt = state
                .prompts_create(
                    workspace_id,
                    scope,
                    name,
                    description,
                    argument_hint,
                    content,
                )
                .await?;
            serde_json::to_value(prompt).map_err(|err| err.to_string())
        }
        "prompts_update" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let path = parse_string(&params, "path")?;
            let name = parse_string(&params, "name")?;
            let description = parse_optional_string(&params, "description");
            let argument_hint = parse_optional_string(&params, "argumentHint");
            let content = parse_string(&params, "content")?;
            let prompt = state
                .prompts_update(
                    workspace_id,
                    path,
                    name,
                    description,
                    argument_hint,
                    content,
                )
                .await?;
            serde_json::to_value(prompt).map_err(|err| err.to_string())
        }
        "prompts_delete" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let path = parse_string(&params, "path")?;
            state.prompts_delete(workspace_id, path).await?;
            Ok(json!({ "ok": true }))
        }
        "prompts_move" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let path = parse_string(&params, "path")?;
            let scope = parse_string(&params, "scope")?;
            let prompt = state.prompts_move(workspace_id, path, scope).await?;
            serde_json::to_value(prompt).map_err(|err| err.to_string())
        }
        "codex_doctor" => {
            let codex_bin = parse_optional_string(&params, "codexBin");
            let codex_args = parse_optional_string(&params, "codexArgs");
            state.codex_doctor(codex_bin, codex_args).await
        }
        "codex_update" => {
            let codex_bin = parse_optional_string(&params, "codexBin");
            let codex_args = parse_optional_string(&params, "codexArgs");
            state.codex_update(codex_bin, codex_args).await
        }
        "generate_commit_message" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let message = state.generate_commit_message(workspace_id).await?;
            Ok(Value::String(message))
        }
        "generate_run_metadata" => {
            let workspace_id = parse_string(&params, "workspaceId")?;
            let prompt = parse_string(&params, "prompt")?;
            state.generate_run_metadata(workspace_id, prompt).await
        }
        "local_usage_snapshot" => {
            let days = parse_optional_bounded_u32(&params, "days", MAX_LOCAL_USAGE_DAYS)?;
            let workspace_path = parse_optional_string(&params, "workspacePath");
            let snapshot = state.local_usage_snapshot(days, workspace_path).await?;
            serde_json::to_value(snapshot).map_err(|err| err.to_string())
        }
        "menu_set_accelerators" => {
            let updates: Vec<Value> = match &params {
                Value::Object(map) => map
                    .get("updates")
                    .cloned()
                    .map(serde_json::from_value)
                    .transpose()
                    .map_err(|err| err.to_string())?
                    .unwrap_or_default(),
                _ => Vec::new(),
            };
            state.menu_set_accelerators(updates).await?;
            Ok(json!({ "ok": true }))
        }
        "is_macos_debug_build" => {
            let is_debug = state.is_macos_debug_build().await;
            Ok(Value::Bool(is_debug))
        }
        "send_notification_fallback" => {
            let title = parse_string(&params, "title")?;
            let body = parse_string(&params, "body")?;
            state.send_notification_fallback(title, body).await?;
            Ok(json!({ "ok": true }))
        }
        _ => Err(format!("unknown method: {method}")),
    }
}

pub(super) async fn forward_events(
    mut rx: broadcast::Receiver<DaemonEvent>,
    out_tx_events: mpsc::UnboundedSender<String>,
) {
    loop {
        let event = match rx.recv().await {
            Ok(event) => event,
            Err(broadcast::error::RecvError::Lagged(dropped_count)) => {
                if let Some(payload) = build_event_stream_lagged_notification(dropped_count) {
                    if out_tx_events.send(payload).is_err() {
                        break;
                    }
                }
                continue;
            }
            Err(broadcast::error::RecvError::Closed) => break,
        };

        let Some(payload) = build_event_notification(event) else {
            continue;
        };

        if out_tx_events.send(payload).is_err() {
            break;
        }
    }
}

pub(super) fn spawn_rpc_response_task(
    state: Arc<DaemonState>,
    out_tx: mpsc::UnboundedSender<String>,
    id: Option<u64>,
    method: String,
    params: Value,
    client_version: String,
    request_limiter: Arc<Semaphore>,
) {
    tokio::spawn(async move {
        let Ok(_permit) = request_limiter.acquire_owned().await else {
            return;
        };
        let result = handle_rpc_request(&state, &method, params, client_version).await;
        let response = match result {
            Ok(result) => build_result_response(id, result),
            Err(message) => build_error_response(id, classify_rpc_error_code(&message), &message),
        };
        if let Some(response) = response {
            if out_tx.send(response).is_err() {
                eprintln!("[daemon] failed to send rpc response for method={method}");
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{
        build_error_response, build_event_notification, build_event_stream_lagged_notification,
        normalize_request_id,
        parse_optional_bounded_u32, parse_optional_string_array, parse_string_array,
        validate_response_workspace_binding, DaemonEvent, MAX_LOCAL_USAGE_DAYS,
    };
    use crate::backend::events::AppServerEvent;
    use serde_json::json;

    #[test]
    fn parse_string_array_success() {
        let params = json!({
            "threadIds": ["thread-1", "thread-2"]
        });

        let parsed = parse_string_array(&params, "threadIds").expect("threadIds should parse");
        assert_eq!(parsed, vec!["thread-1".to_string(), "thread-2".to_string()]);
    }

    #[test]
    fn parse_string_array_missing_key() {
        let params = json!({
            "workspaceId": "ws-1"
        });

        let err = parse_string_array(&params, "threadIds").expect_err("missing key should fail");
        assert_eq!(err, "missing `threadIds`");
    }

    #[test]
    fn parse_string_array_rejects_non_string_items() {
        let params = json!({
            "threadIds": ["thread-1", 2]
        });

        let err = parse_string_array(&params, "threadIds")
            .expect_err("non-string array element should fail");
        assert_eq!(
            err,
            "invalid `threadIds`: element at index 1 must be a string"
        );
    }

    #[test]
    fn parse_optional_string_array_rejects_non_array() {
        let params = json!({
            "images": "not-an-array"
        });

        let err =
            parse_optional_string_array(&params, "images").expect_err("non-array should fail");
        assert_eq!(err, "invalid `images`: expected array of strings");
    }

    #[test]
    fn parse_optional_bounded_u32_enforces_upper_bound() {
        let params = json!({
            "days": MAX_LOCAL_USAGE_DAYS + 1
        });

        let err = parse_optional_bounded_u32(&params, "days", MAX_LOCAL_USAGE_DAYS)
            .expect_err("out-of-range value should fail");
        assert_eq!(
            err,
            format!("invalid `days`: must be <= {MAX_LOCAL_USAGE_DAYS}")
        );
    }

    #[test]
    fn build_error_response_includes_error_code() {
        let payload = build_error_response(Some(7), "INVALID_PARAMS", "missing `workspaceId`")
            .expect("response should be present");
        let value: serde_json::Value =
            serde_json::from_str(&payload).expect("payload should parse");
        assert_eq!(
            value.pointer("/error/code").and_then(|node| node.as_str()),
            Some("INVALID_PARAMS")
        );
        assert_eq!(
            value
                .pointer("/error/message")
                .and_then(|node| node.as_str()),
            Some("missing `workspaceId`")
        );
    }

    #[test]
    fn build_event_stream_lagged_notification_reports_dropped_count() {
        let payload = build_event_stream_lagged_notification(42).expect("payload should serialize");
        let value: serde_json::Value =
            serde_json::from_str(&payload).expect("payload should parse");
        assert_eq!(
            value.pointer("/method").and_then(|node| node.as_str()),
            Some("app-server-event")
        );
        assert_eq!(
            value
                .pointer("/params/message/method")
                .and_then(|node| node.as_str()),
            Some("codex/eventStreamLagged")
        );
        assert_eq!(
            value
                .pointer("/params/message/params/droppedCount")
                .and_then(|node| node.as_u64()),
            Some(42)
        );
    }

    #[test]
    fn normalize_request_id_rejects_empty_string() {
        let err = normalize_request_id(&json!("   ")).expect_err("empty requestId should fail");
        assert_eq!(err, "invalid `requestId`: must not be empty");
    }

    #[test]
    fn validate_response_workspace_binding_rejects_mismatch() {
        let params = json!({
            "requestWorkspaceId": "ws-2",
            "requestIdEcho": "req-1"
        });
        let map = params.as_object().expect("params should be map");
        let err = validate_response_workspace_binding(map, "ws-1", &json!("req-1"))
            .expect_err("workspace mismatch should fail");
        assert_eq!(err, "workspace/request binding mismatch");
    }

    #[test]
    fn build_event_notification_drops_invalid_app_server_event_schema() {
        let event = DaemonEvent::AppServer(AppServerEvent {
            workspace_id: "ws-1".to_string(),
            message: json!({
                "id": {"bad": true},
                "method": "approval/request",
                "params": {}
            }),
        });
        assert!(build_event_notification(event).is_none());
    }
}
