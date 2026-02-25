import { beforeEach, describe, expect, it, vi } from "vitest";
import { appendStructuredLog } from "./tauri";
import { logError, logStructured, logWarn } from "./logger";

vi.mock("./tauri", () => ({
  appendStructuredLog: vi.fn(),
}));

const flushPromises = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

describe("logger service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serializes structured contexts before writing logs", async () => {
    const appendMock = vi.mocked(appendStructuredLog);
    appendMock.mockResolvedValue(undefined);

    logStructured("INFO", "unit-test", "hello", {
      nested: { value: 42 },
      list: ["a", "b"],
    });
    await flushPromises();

    expect(appendMock).toHaveBeenCalledWith("INFO", "unit-test", "hello", {
      nested: { value: 42 },
      list: ["a", "b"],
    });
  });

  it("sends null context when context is omitted", async () => {
    const appendMock = vi.mocked(appendStructuredLog);
    appendMock.mockResolvedValue(undefined);

    logStructured("INFO", "unit-test", "without-context");
    await flushPromises();

    expect(appendMock).toHaveBeenCalledWith(
      "INFO",
      "unit-test",
      "without-context",
      null,
    );
  });

  it("falls back to a safe context payload for unserializable values", async () => {
    const appendMock = vi.mocked(appendStructuredLog);
    appendMock.mockResolvedValue(undefined);
    const circular = {} as { self?: unknown };
    circular.self = circular;

    logStructured("WARN", "unit-test", "cycle", circular as never);
    await flushPromises();

    expect(appendMock).toHaveBeenCalledWith("WARN", "unit-test", "cycle", {
      serializationError: "Failed to serialize structured log context",
      originalType: "object",
    });
  });

  it("continues processing queued writes after a failed append", async () => {
    const appendMock = vi.mocked(appendStructuredLog);
    appendMock.mockRejectedValueOnce(new Error("disk full"));
    appendMock.mockResolvedValueOnce(undefined);

    logStructured("ERROR", "first", "will fail", { id: 1 });
    logStructured("INFO", "second", "still writes", { id: 2 });
    await flushPromises();
    await flushPromises();

    expect(appendMock).toHaveBeenNthCalledWith(1, "ERROR", "first", "will fail", { id: 1 });
    expect(appendMock).toHaveBeenNthCalledWith(2, "INFO", "second", "still writes", {
      id: 2,
    });
  });

  it("maps convenience log helpers to expected levels", async () => {
    const appendMock = vi.mocked(appendStructuredLog);
    appendMock.mockResolvedValue(undefined);

    logError("error-source", "boom", { code: "E1" });
    logWarn("warn-source", "careful", { code: "W1" });
    await flushPromises();
    await flushPromises();

    expect(appendMock).toHaveBeenNthCalledWith(1, "ERROR", "error-source", "boom", {
      code: "E1",
    });
    expect(appendMock).toHaveBeenNthCalledWith(2, "WARN", "warn-source", "careful", {
      code: "W1",
    });
  });
});
