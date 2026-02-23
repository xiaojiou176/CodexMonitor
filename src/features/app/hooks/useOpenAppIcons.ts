import { useEffect, useMemo, useRef, useState } from "react";
import { getOpenAppIcon } from "../../../services/tauri";
import type { OpenAppTarget } from "../../../types";
import { getKnownOpenAppIcon } from "../utils/openAppIcons";
import { isMacPlatform } from "../../../utils/platformPaths";
import { BoundedCache } from "../../../utils/boundedCache";

type OpenAppIconMap = Record<string, string>;

type ResolvedAppTarget = {
  id: string;
  appName: string;
};

const OPEN_APP_ICON_CACHE_MAX_ENTRIES = 256;
const OPEN_APP_ICON_CACHE_TTL_MS = 60 * 60 * 1000;

export function useOpenAppIcons(openTargets: OpenAppTarget[]): OpenAppIconMap {
  const isMacOS = isMacPlatform();
  const iconCacheRef = useRef(
    new BoundedCache<string, string>(
      OPEN_APP_ICON_CACHE_MAX_ENTRIES,
      OPEN_APP_ICON_CACHE_TTL_MS,
    ),
  );
  const inFlightRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const [iconById, setIconById] = useState<OpenAppIconMap>({});

  const appTargets = useMemo<ResolvedAppTarget[]>(
    () =>
      openTargets
        .filter((target) => target.kind === "app" && !getKnownOpenAppIcon(target.id))
        .map((target) => ({
          id: target.id,
          appName: (target.appName || target.label || "").trim(),
        }))
        .filter((target) => target.appName.length > 0),
    [openTargets],
  );

  useEffect(() => {
    if (!isMacOS || appTargets.length === 0) {
      setIconById({});
      return;
    }

    let cancelled = false;

    const resolveIcons = async () => {
      const nextIcons: OpenAppIconMap = {};

      await Promise.all(
        appTargets.map(async ({ id, appName }) => {
          const cached = iconCacheRef.current.get(appName);
          if (cached) {
            nextIcons[id] = cached;
            return;
          }

          let request = inFlightRef.current.get(appName);
          if (!request) {
            request = getOpenAppIcon(appName)
              .catch(() => null)
              .finally(() => {
                inFlightRef.current.delete(appName);
              });
            inFlightRef.current.set(appName, request);
          }

          const icon = await request;
          if (icon) {
            iconCacheRef.current.set(appName, icon);
            nextIcons[id] = icon;
          }
        }),
      );

      if (!cancelled) {
        setIconById(nextIcons);
      }
    };

    void resolveIcons();

    return () => {
      cancelled = true;
    };
  }, [appTargets, isMacOS]);

  return iconById;
}
