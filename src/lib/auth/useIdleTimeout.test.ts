import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIdleTimeout } from "./useIdleTimeout";

describe("useIdleTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("signs out after the idle period", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(30, onIdle));
    vi.advanceTimersByTime(30 * 60_000 - 1);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledOnce();
  });

  it("restarts the countdown when the user is active", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(30, onIdle));
    vi.advanceTimersByTime(20 * 60_000);
    window.dispatchEvent(new KeyboardEvent("keydown"));
    vi.advanceTimersByTime(20 * 60_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10 * 60_000);
    expect(onIdle).toHaveBeenCalledOnce();
  });

  it("does nothing without a timeout and cleans up on unmount", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(undefined, onIdle));
    const { unmount } = renderHook(() => useIdleTimeout(1, onIdle));
    unmount();
    vi.advanceTimersByTime(10 * 60_000);
    expect(onIdle).not.toHaveBeenCalled();
  });
});
