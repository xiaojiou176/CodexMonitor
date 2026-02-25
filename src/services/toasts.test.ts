import { describe, expect, it, vi } from "vitest";
import { pushErrorToast, subscribeErrorToasts } from "./toasts";

describe("error toasts", () => {
  it("publishes error toasts to subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeErrorToasts(listener);

    const id = pushErrorToast({
      title: "Test error",
      message: "Something went wrong",
      durationMs: 1234,
    });

    expect(id).toMatch(/^error-toast-/);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        id,
        title: "Test error",
        message: "Something went wrong",
        durationMs: 1234,
      }),
    );

    unsubscribe();
  });

  it("keeps custom ids and isolates unsubscribed listeners", () => {
    const active = vi.fn();
    const stale = vi.fn();
    const unsubscribeStale = subscribeErrorToasts(stale);
    const unsubscribeActive = subscribeErrorToasts(active);
    unsubscribeStale();

    const id = pushErrorToast({
      id: "custom-toast-id",
      title: "Known error",
      message: "Readable details",
    });

    expect(id).toBe("custom-toast-id");
    expect(stale).not.toHaveBeenCalled();
    expect(active).toHaveBeenCalledWith({
      id: "custom-toast-id",
      title: "Known error",
      message: "Readable details",
      durationMs: undefined,
    });
    unsubscribeActive();
  });

  it("continues notifying remaining listeners when one listener throws", () => {
    const broken = vi.fn(() => {
      throw new Error("listener broke");
    });
    const healthy = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const unsubscribeBroken = subscribeErrorToasts(broken);
    const unsubscribeHealthy = subscribeErrorToasts(healthy);

    pushErrorToast({
      title: "Recoverable error",
      message: "Continue delivery",
      durationMs: 1200,
    });

    expect(healthy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "[toasts] error toast listener failed",
      expect.any(Error),
    );
    unsubscribeBroken();
    unsubscribeHealthy();
    errorSpy.mockRestore();
  });
});
