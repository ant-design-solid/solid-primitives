import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { useEventListener } from "./index";

const tick = () => Promise.resolve();

describe("useEventListener", () => {
  it("root dispose 后应移除监听器", async () => {
    const target = new EventTarget();
    const handler = vi.fn();

    const dispose = createRoot((dispose) => {
      useEventListener(target, "test", handler);
      return dispose;
    });
    await tick();

    target.dispatchEvent(new Event("test"));
    expect(handler).toHaveBeenCalledTimes(1);

    dispose();
    target.dispatchEvent(new Event("test"));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
