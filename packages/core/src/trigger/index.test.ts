import { createEffect, createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { createTrigger, createTriggerCache } from "./index";

function withRoot(run: () => void | Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    createRoot((dispose) => {
      Promise.resolve(run()).then(
        () => {
          dispose();
          resolve();
        },
        (error) => {
          dispose();
          reject(error);
        },
      );
    });
  });
}

const flush = () => Promise.resolve();

describe("createTrigger", () => {
  it("dirty 应重新触发已 track 的依赖", async () => {
    await withRoot(async () => {
      const trigger = createTrigger();
      const effect = vi.fn(() => trigger.track());

      createEffect(effect);
      await flush();

      trigger.dirty();
      await flush();

      expect(effect).toHaveBeenCalledTimes(2);
    });
  });
});

describe("createTriggerCache", () => {
  it("dirty 应按 key 触发，dirtyAll 应触发全部已 track 的 key", async () => {
    await withRoot(async () => {
      const trigger = createTriggerCache<string>();
      const readA = vi.fn(() => trigger.track("a"));
      const readB = vi.fn(() => trigger.track("b"));

      createEffect(readA);
      createEffect(readB);
      await flush();

      trigger.dirty("a");
      await flush();

      expect(readA).toHaveBeenCalledTimes(2);
      expect(readB).toHaveBeenCalledTimes(1);

      trigger.dirtyAll();
      await flush();

      expect(readA).toHaveBeenCalledTimes(3);
      expect(readB).toHaveBeenCalledTimes(2);
    });
  });
});
