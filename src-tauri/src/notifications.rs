#[cfg(all(target_os = "macos", debug_assertions))]
use std::process::Command;
#[cfg(desktop)]
use tauri::Manager;

fn normalized_badge_count(count: i64) -> Option<i64> {
    if count <= 0 {
        None
    } else {
        Some(count)
    }
}

fn is_unsupported_badge_error_message(message: &str) -> bool {
    let normalized = message.to_ascii_lowercase();
    normalized.contains("unsupported") || normalized.contains("not implemented")
}

#[cfg(desktop)]
fn preferred_badge_window(app: &tauri::AppHandle) -> Option<tauri::WebviewWindow> {
    app.get_webview_window("main")
        .or_else(|| app.webview_windows().into_values().next())
}

#[tauri::command]
pub(crate) fn set_app_badge_count(app: tauri::AppHandle, count: i64) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let badge_count = normalized_badge_count(count);
        let window = preferred_badge_window(&app).ok_or_else(|| {
            "Failed to set app badge: no webview window is available.".to_string()
        })?;

        match window.set_badge_count(badge_count) {
            Ok(()) => Ok(()),
            Err(error) if is_unsupported_badge_error_message(&error.to_string()) => Ok(()),
            Err(error) => Err(format!("Failed to set app badge count to {count}: {error}")),
        }
    }

    #[cfg(not(desktop))]
    {
        let _ = (app, count);
        Ok(())
    }
}

#[tauri::command]
pub(crate) fn clear_app_badge(app: tauri::AppHandle) -> Result<(), String> {
    set_app_badge_count(app, 0)
}

#[tauri::command]
pub(crate) async fn is_macos_debug_build() -> bool {
    cfg!(all(target_os = "macos", debug_assertions))
}

/// macOS dev-mode fallback for system notifications.
///
/// In `tauri dev` (debug assertions enabled), the app is typically run as a
/// bare binary instead of a bundled `.app`. macOS notifications can silently
/// fail in that mode because the process does not have a stable bundle
/// identifier registered with the system notification center.
///
/// This fallback uses AppleScript via `osascript` so the developer still gets
/// a visible notification during local development.
#[tauri::command]
pub(crate) async fn send_notification_fallback(title: String, body: String) -> Result<(), String> {
    #[cfg(all(target_os = "macos", debug_assertions))]
    {
        let escape = |value: &str| value.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!(
            "display notification \"{}\" with title \"{}\"",
            escape(&body),
            escape(&title)
        );

        let status = Command::new("/usr/bin/osascript")
            .arg("-e")
            .arg(script)
            .status()
            .map_err(|error| format!("Failed to run osascript: {error}"))?;

        if status.success() {
            Ok(())
        } else {
            Err(format!("osascript exited with status: {status}"))
        }
    }

    #[cfg(not(all(target_os = "macos", debug_assertions)))]
    {
        let _ = (title, body);
        Err("Notification fallback is only available on macOS debug builds.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::{is_unsupported_badge_error_message, normalized_badge_count};

    #[test]
    fn normalized_badge_count_clears_non_positive_values() {
        assert_eq!(normalized_badge_count(-3), None);
        assert_eq!(normalized_badge_count(0), None);
    }

    #[test]
    fn normalized_badge_count_keeps_positive_values() {
        assert_eq!(normalized_badge_count(1), Some(1));
        assert_eq!(normalized_badge_count(42), Some(42));
    }

    #[test]
    fn unsupported_badge_error_detection_is_case_insensitive() {
        assert!(is_unsupported_badge_error_message(
            "Operation is unsupported on this platform"
        ));
        assert!(is_unsupported_badge_error_message(
            "Feature NOT IMPLEMENTED by runtime"
        ));
        assert!(!is_unsupported_badge_error_message("permission denied"));
    }
}
