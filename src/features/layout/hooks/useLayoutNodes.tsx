import { useRef } from "react";
import { buildGitNodes } from "./layoutNodes/buildGitNodes";
import { buildPrimaryNodes } from "./layoutNodes/buildPrimaryNodes";
import { buildSecondaryNodes } from "./layoutNodes/buildSecondaryNodes";
import type { LayoutNodesOptions, LayoutNodesResult } from "./layoutNodes/types";

type LayoutNodesCache = {
  options: LayoutNodesOptions;
  result: LayoutNodesResult;
};

function shallowEqualLayoutOptions(
  previous: LayoutNodesOptions,
  next: LayoutNodesOptions,
) {
  if (previous === next) {
    return true;
  }

  const previousKeys = Object.keys(previous) as Array<keyof LayoutNodesOptions>;
  const nextKeys = Object.keys(next) as Array<keyof LayoutNodesOptions>;
  if (previousKeys.length !== nextKeys.length) {
    return false;
  }

  for (const key of previousKeys) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) {
      return false;
    }
    if (!Object.is(previous[key], next[key])) {
      return false;
    }
  }

  return true;
}

export function useLayoutNodes(options: LayoutNodesOptions): LayoutNodesResult {
  const cacheRef = useRef<LayoutNodesCache | null>(null);
  const cached = cacheRef.current;

  if (cached && shallowEqualLayoutOptions(cached.options, options)) {
    return cached.result;
  }

  const result: LayoutNodesResult = {
    ...buildPrimaryNodes(options),
    ...buildGitNodes(options),
    ...buildSecondaryNodes(options),
  };

  cacheRef.current = {
    options,
    result,
  };

  return result;
}
