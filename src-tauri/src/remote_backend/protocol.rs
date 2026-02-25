use serde::Deserialize;
use serde_json::{json, Value};

pub(crate) const DEFAULT_REMOTE_HOST: &str = "127.0.0.1:4732";
pub(crate) const DISCONNECTED_MESSAGE: &str = "remote backend disconnected";

pub(crate) enum IncomingMessage {
    Response {
        id: u64,
        payload: Result<Value, String>,
    },
    Notification {
        method: String,
        params: Value,
    },
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct IncomingNotification {
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct AppServerEventEnvelope {
    #[serde(alias = "workspaceId")]
    workspace_id: String,
    message: AppServerEventMessage,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct AppServerEventMessage {
    method: String,
    #[serde(default)]
    params: Value,
    #[serde(default)]
    id: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TerminalOutputEnvelope {
    workspace_id: String,
    terminal_id: String,
    data: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TerminalExitEnvelope {
    workspace_id: String,
    terminal_id: String,
}

fn validate_request_id(value: &Value) -> bool {
    match value {
        Value::Number(_) => true,
        Value::String(raw) => !raw.trim().is_empty(),
        _ => false,
    }
}

fn validate_app_server_event(params: &Value) -> bool {
    let Ok(parsed) = serde_json::from_value::<AppServerEventEnvelope>(params.clone()) else {
        return false;
    };

    if parsed.workspace_id.trim().is_empty() || parsed.message.method.trim().is_empty() {
        return false;
    }

    if let Some(id) = parsed.message.id.as_ref() {
        if !validate_request_id(id) {
            return false;
        }
    }

    if let Some(message_params) = parsed.message.params.as_object() {
        let workspace_from_message = message_params
            .get("workspaceId")
            .or_else(|| message_params.get("workspace_id"))
            .and_then(Value::as_str);
        if let Some(workspace_from_message) = workspace_from_message {
            if workspace_from_message != parsed.workspace_id {
                return false;
            }
        }
    }

    true
}

fn validate_terminal_output(params: &Value) -> bool {
    let Ok(parsed) = serde_json::from_value::<TerminalOutputEnvelope>(params.clone()) else {
        return false;
    };
    !parsed.workspace_id.trim().is_empty()
        && !parsed.terminal_id.trim().is_empty()
        && !parsed.data.is_empty()
}

fn validate_terminal_exit(params: &Value) -> bool {
    let Ok(parsed) = serde_json::from_value::<TerminalExitEnvelope>(params.clone()) else {
        return false;
    };
    !parsed.workspace_id.trim().is_empty() && !parsed.terminal_id.trim().is_empty()
}

fn parse_notification(message: Value) -> Option<IncomingMessage> {
    let notification = serde_json::from_value::<IncomingNotification>(message).ok()?;
    if notification.method.trim().is_empty() {
        return None;
    }

    let is_valid = match notification.method.as_str() {
        "app-server-event" => validate_app_server_event(&notification.params),
        "terminal-output" => validate_terminal_output(&notification.params),
        "terminal-exit" => validate_terminal_exit(&notification.params),
        _ => false,
    };

    if !is_valid {
        return None;
    }

    Some(IncomingMessage::Notification {
        method: notification.method,
        params: notification.params,
    })
}

pub(crate) fn build_request_line(id: u64, method: &str, params: Value) -> Result<String, String> {
    let request = json!({
        "id": id,
        "method": method,
        "params": params,
    });
    serde_json::to_string(&request).map_err(|err| err.to_string())
}

pub(crate) fn parse_incoming_line(line: &str) -> Option<IncomingMessage> {
    let message: Value = serde_json::from_str(line).ok()?;

    if let Some(id) = message.get("id").and_then(|value| value.as_u64()) {
        if let Some(error) = message.get("error") {
            let error_message = error
                .get("message")
                .and_then(|value| value.as_str())
                .unwrap_or("remote error")
                .to_string();
            return Some(IncomingMessage::Response {
                id,
                payload: Err(error_message),
            });
        }

        let result = message.get("result").cloned().unwrap_or(Value::Null);
        return Some(IncomingMessage::Response {
            id,
            payload: Ok(result),
        });
    }

    parse_notification(message)
}

#[cfg(test)]
mod tests {
    use super::{parse_incoming_line, IncomingMessage};
    use serde_json::json;

    #[test]
    fn app_server_event_requires_workspace_and_method() {
        let raw = json!({
            "method": "app-server-event",
            "params": {
                "workspace_id": "ws-1",
                "message": {
                    "method": "approval/request",
                    "id": "req-1",
                    "params": { "foo": "bar" }
                }
            }
        })
        .to_string();

        let parsed = parse_incoming_line(&raw);
        assert!(matches!(
            parsed,
            Some(IncomingMessage::Notification { method, .. }) if method == "app-server-event"
        ));
    }

    #[test]
    fn app_server_event_rejects_invalid_request_id_type() {
        let raw = json!({
            "method": "app-server-event",
            "params": {
                "workspace_id": "ws-1",
                "message": {
                    "method": "approval/request",
                    "id": { "bad": true },
                    "params": {}
                }
            }
        })
        .to_string();

        assert!(parse_incoming_line(&raw).is_none());
    }

    #[test]
    fn app_server_event_rejects_unknown_fields() {
        let raw = json!({
            "method": "app-server-event",
            "params": {
                "workspace_id": "ws-1",
                "message": {
                    "method": "approval/request",
                    "params": {}
                },
                "extra": true
            }
        })
        .to_string();

        assert!(parse_incoming_line(&raw).is_none());
    }

    #[test]
    fn app_server_event_rejects_workspace_mismatch() {
        let raw = json!({
            "method": "app-server-event",
            "params": {
                "workspace_id": "ws-1",
                "message": {
                    "method": "approval/request",
                    "params": {
                        "workspaceId": "ws-2"
                    }
                }
            }
        })
        .to_string();
        assert!(parse_incoming_line(&raw).is_none());
    }

    #[test]
    fn terminal_output_rejects_empty_data() {
        let raw = json!({
            "method": "terminal-output",
            "params": {
                "workspaceId": "ws-1",
                "terminalId": "term-1",
                "data": ""
            }
        })
        .to_string();
        assert!(parse_incoming_line(&raw).is_none());
    }
}
