// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  categorizeModels,
  fetchCLIProxyAPIModels,
  getCLIProxyAPIConfig,
  getModelDisplayName,
  saveCLIProxyAPIConfig,
  testCLIProxyAPIConnection,
} from "./cliproxyapi";

describe("cliproxyapi service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("returns default config when local storage is empty or invalid", () => {
    expect(getCLIProxyAPIConfig()).toEqual({
      baseUrl: "http://all.local:18317",
      apiKey: "",
    });

    localStorage.setItem("cliproxyapi_config", "{invalid");
    expect(getCLIProxyAPIConfig()).toEqual({
      baseUrl: "http://all.local:18317",
      apiKey: "",
    });
  });

  it("loads and saves CLIProxy config while only persisting baseUrl", () => {
    saveCLIProxyAPIConfig({
      baseUrl: "http://proxy.local:18317",
      apiKey: "token-abc",
    });

    expect(getCLIProxyAPIConfig()).toEqual({
      baseUrl: "http://proxy.local:18317",
      apiKey: "token-abc",
    });
    expect(localStorage.getItem("cliproxyapi_base_url")).toBe(
      "http://proxy.local:18317",
    );
    expect(localStorage.getItem("cliproxyapi_config")).toBeNull();
  });

  it("prefers the new baseUrl storage key over legacy config", () => {
    saveCLIProxyAPIConfig({
      baseUrl: "http://seed.local:18317",
      apiKey: "session-key",
    });
    localStorage.setItem("cliproxyapi_base_url", "http://next.local:18317");
    localStorage.setItem(
      "cliproxyapi_config",
      JSON.stringify({
        baseUrl: "http://legacy.local:18317",
      }),
    );

    expect(getCLIProxyAPIConfig()).toEqual({
      baseUrl: "http://next.local:18317",
      apiKey: "session-key",
    });
  });

  it("falls back to default baseUrl when saved value is blank", () => {
    saveCLIProxyAPIConfig({
      baseUrl: "   ",
      apiKey: "token-abc",
    });

    expect(getCLIProxyAPIConfig()).toEqual({
      baseUrl: "http://all.local:18317",
      apiKey: "token-abc",
    });
    expect(localStorage.getItem("cliproxyapi_base_url")).toBe("http://all.local:18317");
  });

  it("reads legacy persisted baseUrl when next storage key is absent", () => {
    saveCLIProxyAPIConfig({
      baseUrl: "http://temp.local:18317",
      apiKey: "token-legacy",
    });
    localStorage.removeItem("cliproxyapi_base_url");
    localStorage.setItem(
      "cliproxyapi_config",
      JSON.stringify({
        baseUrl: "  http://legacy.local:18317  ",
      }),
    );

    expect(getCLIProxyAPIConfig()).toEqual({
      baseUrl: "http://legacy.local:18317",
      apiKey: "token-legacy",
    });
  });

  it("does not persist api key across module reloads", async () => {
    saveCLIProxyAPIConfig({
      baseUrl: "http://proxy.local:18317",
      apiKey: "token-abc",
    });
    expect(localStorage.getItem("cliproxyapi_base_url")).toBe(
      "http://proxy.local:18317",
    );

    vi.resetModules();
    const reloaded = await import("./cliproxyapi");
    expect(reloaded.getCLIProxyAPIConfig()).toEqual({
      baseUrl: "http://proxy.local:18317",
      apiKey: "",
    });
  });

  it("fetches model list with configured auth headers", async () => {
    saveCLIProxyAPIConfig({
      baseUrl: "http://proxy.local:18317",
      apiKey: "token-abc",
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            object: "list",
            data: [{ id: "gpt-5-codex", object: "model", created: 1, owned_by: "codex" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const models = await fetchCLIProxyAPIModels();
    expect(models).toHaveLength(1);
    expect(models[0]?.id).toBe("gpt-5-codex");
    expect(fetchMock).toHaveBeenCalledWith("http://proxy.local:18317/v1/models", {
      method: "GET",
      headers: {
        Authorization: "Bearer token-abc",
        "Content-Type": "application/json",
      },
    });
  });

  it("throws when model fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network down"));
    await expect(fetchCLIProxyAPIModels()).rejects.toThrow("network down");
  });

  it("throws detailed HTTP errors when model fetch returns non-ok status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("forbidden", { status: 403, statusText: "Forbidden" }),
    );

    await expect(fetchCLIProxyAPIModels()).rejects.toThrow("HTTP 403: Forbidden");
  });

  it("returns an empty list when response data shape is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ object: "list", data: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchCLIProxyAPIModels()).resolves.toEqual([]);
  });

  it("uses explicit config argument instead of persisted runtime config", async () => {
    saveCLIProxyAPIConfig({
      baseUrl: "http://persisted.local:18317",
      apiKey: "persisted-token",
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ object: "list", data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      fetchCLIProxyAPIModels({
        baseUrl: "http://explicit.local:18317",
        apiKey: "explicit-token",
      }),
    ).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledWith("http://explicit.local:18317/v1/models", {
      method: "GET",
      headers: {
        Authorization: "Bearer explicit-token",
        "Content-Type": "application/json",
      },
    });
  });

  it("returns success and model count when connection test passes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          object: "list",
          data: [
            { id: "gpt-5-codex", object: "model", created: 1, owned_by: "codex" },
            { id: "gemini-2.5-pro", object: "model", created: 1, owned_by: "gemini" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      testCLIProxyAPIConnection({
        baseUrl: "http://all.local:18317",
        apiKey: "token-123",
      }),
    ).resolves.toEqual({
      success: true,
      modelCount: 2,
    });
  });

  it("returns an error payload when connection test receives non-ok status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("unauthorized", { status: 401, statusText: "Unauthorized" }),
    );

    const result = await testCLIProxyAPIConnection({
      baseUrl: "http://all.local:18317",
      apiKey: "bad-token",
    });

    expect(result.success).toBe(false);
    expect(result.modelCount).toBe(0);
    expect(String(result.error ?? "")).toContain("HTTP 401");
  });

  it("returns a stringified error payload for non-Error rejections", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce("raw failure");

    const result = await testCLIProxyAPIConnection({
      baseUrl: "http://all.local:18317",
      apiKey: "bad-token",
    });

    expect(result).toEqual({
      success: false,
      modelCount: 0,
      error: "raw failure",
    });
  });

  it("uses persisted config in connection test and handles missing data arrays", async () => {
    saveCLIProxyAPIConfig({
      baseUrl: "http://persisted.local:18317",
      apiKey: "persisted-token",
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ object: "list" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(testCLIProxyAPIConnection()).resolves.toEqual({
      success: true,
      modelCount: 0,
    });
  });

  it("categorizes models by provider and returns display names", () => {
    const categories = categorizeModels([
      { id: "gpt-5-codex", object: "model", created: 1, owned_by: "codex" },
      { id: "gemini-claude-opus-4-6-thinking", object: "model", created: 1, owned_by: "claude" },
      { id: "gemini-2.5-pro", object: "model", created: 1, owned_by: "gemini" },
      { id: "custom-model-x", object: "model", created: 1, owned_by: "other" },
    ]);

    const categoryIds = categories.map((entry) => entry.id);
    expect(categoryIds).toEqual(["codex", "claude", "gemini", "other"]);
    expect(getModelDisplayName("gpt-5.3-codex")).toBe("GPT-5.3 Codex");
    expect(getModelDisplayName("unknown-model")).toBe("unknown-model");
  });
});
