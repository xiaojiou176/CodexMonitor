use serde::Serialize;
use serde_json::Value;
use std::cmp::Reverse;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const LOG_FILE_BASENAME: &str = "codexmonitor.log";
const LOG_FILE_EXTENSION: &str = "jsonl";
const MAX_LOG_FILE_BYTES: u64 = 10 * 1024 * 1024;
const MAX_LOG_FILES_TOTAL: usize = 5;
const LOG_RETENTION_DAYS: u64 = 14;
const RUNTIME_CACHE_RETENTION_DAYS: u64 = 14;

#[derive(Serialize)]
struct StructuredLogRecord<'a> {
    timestamp_ms: u128,
    level: &'a str,
    source: &'a str,
    message: &'a str,
    context: Option<&'a Value>,
}

pub(crate) fn append_structured_log(
    logs_dir: &Path,
    level: &str,
    source: &str,
    message: &str,
    context: Option<Value>,
) -> Result<(), String> {
    fs::create_dir_all(logs_dir).map_err(|err| format!("failed to create logs dir: {err}"))?;
    rotate_log_file_if_needed(logs_dir)?;

    let normalized_level = normalize_level(level);
    let sanitized_source = source.trim();
    let sanitized_message = message.trim();
    let record = StructuredLogRecord {
        timestamp_ms: now_millis(),
        level: normalized_level.as_str(),
        source: if sanitized_source.is_empty() {
            "unknown"
        } else {
            sanitized_source
        },
        message: if sanitized_message.is_empty() {
            "(empty message)"
        } else {
            sanitized_message
        },
        context: context.as_ref(),
    };

    let line = serde_json::to_string(&record)
        .map_err(|err| format!("failed to serialize structured log record: {err}"))?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(current_log_file_path(logs_dir))
        .map_err(|err| format!("failed to open structured log file: {err}"))?;
    file.write_all(line.as_bytes())
        .map_err(|err| format!("failed to write structured log record: {err}"))?;
    file.write_all(b"\n")
        .map_err(|err| format!("failed to terminate structured log line: {err}"))?;
    Ok(())
}

pub(crate) fn run_startup_maintenance(
    logs_dir: &Path,
    runtime_cache_dir: Option<&Path>,
) -> Result<(), String> {
    fs::create_dir_all(logs_dir).map_err(|err| format!("failed to create logs dir: {err}"))?;
    prune_log_files(logs_dir)?;
    if let Some(cache_dir) = runtime_cache_dir {
        prune_runtime_cache(cache_dir)?;
    }
    Ok(())
}

fn normalize_level(level: &str) -> String {
    let normalized = level.trim().to_ascii_uppercase();
    match normalized.as_str() {
        "DEBUG" | "INFO" | "WARN" | "ERROR" => normalized,
        _ => "INFO".to_string(),
    }
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn current_log_file_path(logs_dir: &Path) -> PathBuf {
    logs_dir.join(format!("{LOG_FILE_BASENAME}.{LOG_FILE_EXTENSION}"))
}

fn rotated_log_file_path(logs_dir: &Path, index: usize) -> PathBuf {
    logs_dir.join(format!("{LOG_FILE_BASENAME}.{index}.{LOG_FILE_EXTENSION}"))
}

fn rotate_log_file_if_needed(logs_dir: &Path) -> Result<(), String> {
    let current_path = current_log_file_path(logs_dir);
    let current_size = match fs::metadata(&current_path) {
        Ok(metadata) => metadata.len(),
        Err(_) => return Ok(()),
    };
    if current_size < MAX_LOG_FILE_BYTES {
        return Ok(());
    }

    let max_rotated_files = MAX_LOG_FILES_TOTAL.saturating_sub(1);
    for index in (1..=max_rotated_files).rev() {
        let source_path = rotated_log_file_path(logs_dir, index);
        if !source_path.exists() {
            continue;
        }
        if index == max_rotated_files {
            fs::remove_file(&source_path)
                .map_err(|err| format!("failed to remove old rotated log file: {err}"))?;
            continue;
        }
        let destination_path = rotated_log_file_path(logs_dir, index + 1);
        fs::rename(&source_path, &destination_path)
            .map_err(|err| format!("failed to rotate structured log file: {err}"))?;
    }

    fs::rename(&current_path, rotated_log_file_path(logs_dir, 1))
        .map_err(|err| format!("failed to rotate current structured log file: {err}"))?;
    Ok(())
}

fn prune_log_files(logs_dir: &Path) -> Result<(), String> {
    let retention_cutoff =
        SystemTime::now() - Duration::from_secs(LOG_RETENTION_DAYS.saturating_mul(24 * 60 * 60));
    let mut candidates: Vec<(PathBuf, SystemTime)> = Vec::new();

    for entry in fs::read_dir(logs_dir).map_err(|err| format!("failed to read logs dir: {err}"))? {
        let entry = entry.map_err(|err| format!("failed to read logs dir entry: {err}"))?;
        let path = entry.path();
        if !is_structured_log_file(&path) {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|err| format!("failed to read log metadata: {err}"))?;
        let modified_at = metadata.modified().unwrap_or(UNIX_EPOCH);
        if modified_at < retention_cutoff {
            fs::remove_file(&path).map_err(|err| format!("failed to prune old log file: {err}"))?;
            continue;
        }
        candidates.push((path, modified_at));
    }

    candidates.sort_by_key(|(_, modified_at)| Reverse(*modified_at));
    for (path, _) in candidates.into_iter().skip(MAX_LOG_FILES_TOTAL) {
        fs::remove_file(path).map_err(|err| format!("failed to trim extra log file: {err}"))?;
    }
    Ok(())
}

fn is_structured_log_file(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };
    name.starts_with(LOG_FILE_BASENAME) && name.ends_with(LOG_FILE_EXTENSION)
}

fn prune_runtime_cache(runtime_cache_dir: &Path) -> Result<(), String> {
    if !runtime_cache_dir.exists() {
        return Ok(());
    }
    let retention_cutoff = SystemTime::now()
        - Duration::from_secs(RUNTIME_CACHE_RETENTION_DAYS.saturating_mul(24 * 60 * 60));
    let _ = prune_runtime_cache_entries(runtime_cache_dir, retention_cutoff)?;
    Ok(())
}

fn prune_runtime_cache_entries(path: &Path, retention_cutoff: SystemTime) -> Result<bool, String> {
    let mut is_empty = true;
    let entries = fs::read_dir(path).map_err(|err| format!("failed to read cache dir: {err}"))?;
    for entry in entries {
        let entry = entry.map_err(|err| format!("failed to read cache dir entry: {err}"))?;
        let child_path = entry.path();
        let metadata = entry
            .metadata()
            .map_err(|err| format!("failed to read cache entry metadata: {err}"))?;
        if metadata.is_dir() {
            let child_empty = prune_runtime_cache_entries(&child_path, retention_cutoff)?;
            if child_empty {
                let _ = fs::remove_dir(&child_path);
            } else {
                is_empty = false;
            }
            continue;
        }
        if metadata.is_file() {
            let modified = metadata.modified().unwrap_or(UNIX_EPOCH);
            if modified < retention_cutoff {
                let _ = fs::remove_file(&child_path);
            } else {
                is_empty = false;
            }
            continue;
        }
        is_empty = false;
    }
    Ok(is_empty)
}
