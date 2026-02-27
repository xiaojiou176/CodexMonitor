use serde_json::{json, Value};

pub(crate) const DAEMON_NAME: &str = "codex-monitor-daemon";

pub(crate) fn daemon_info(mode: &str, binary_path: Option<&str>) -> Value {
    json!({
        "name": DAEMON_NAME,
        "version": env!("CARGO_PKG_VERSION"),
        "pid": std::process::id(),
        "mode": mode,
        "binaryPath": binary_path,
    })
}
