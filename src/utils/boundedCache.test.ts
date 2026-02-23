import { describe, expect, it, vi } from "vitest";
import { BoundedCache } from "./boundedCache";

describe("BoundedCache", () => {
  it("evicts least recently used entries when max size is exceeded", () => {
    const cache = new BoundedCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });

  it("expires entries when ttl is reached", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000);
    const cache = new BoundedCache<string, string>(2, 100);
    cache.set("k", "v");
    nowSpy.mockReturnValue(1_099);
    expect(cache.get("k")).toBe("v");
    nowSpy.mockReturnValue(1_101);
    expect(cache.get("k")).toBeUndefined();
    nowSpy.mockRestore();
  });
});
