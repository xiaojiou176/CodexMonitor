import { getIconUrlForFilePath } from "vscode-material-icons";
import { BoundedCache } from "./boundedCache";

const MATERIAL_ICONS_BASE_URL = "/assets/material-icons";
const iconUrlCache = new BoundedCache<string, string>(512);

export function getFileTypeIconUrl(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/");
  const cached = iconUrlCache.get(normalizedPath);
  if (cached) {
    return cached;
  }
  const iconUrl = getIconUrlForFilePath(normalizedPath, MATERIAL_ICONS_BASE_URL);
  iconUrlCache.set(normalizedPath, iconUrl);
  return iconUrl;
}
