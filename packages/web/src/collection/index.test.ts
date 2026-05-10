import { createEffect, createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { createShallowCollection } from "./index";

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

describe("createShallowCollection", () => {
  it("Map 应只触发被读取 key 的依赖", async () => {
    await withRoot(async () => {
      const map = createShallowCollection(new Map<string, number>([["a", 1]]));
      const readA = vi.fn(() => map.get("a"));
      const readB = vi.fn(() => map.get("b"));

      createEffect(readA);
      createEffect(readB);
      await flush();

      map.set("a", 2);
      await flush();

      expect(readA).toHaveBeenCalledTimes(2);
      expect(readB).toHaveBeenCalledTimes(1);
    });
  });

  it("Map 新增 undefined 值应触发 values 迭代", async () => {
    await withRoot(async () => {
      const map = createShallowCollection(new Map<string, number | undefined>());
      const readValues = vi.fn(() => [...map.values()]);

      createEffect(readValues);
      await flush();

      map.set("a", undefined);
      await flush();

      expect(readValues).toHaveBeenCalledTimes(2);
    });
  });

  it("Set 重复 add 不应触发依赖，新增值应触发迭代依赖", async () => {
    await withRoot(async () => {
      const set = createShallowCollection(new Set(["a"]));
      const readValues = vi.fn(() => [...set]);

      createEffect(readValues);
      await flush();

      set.add("a");
      await flush();
      expect(readValues).toHaveBeenCalledTimes(1);

      set.add("b");
      await flush();
      expect(readValues).toHaveBeenCalledTimes(2);
    });
  });

  it("WeakMap 应追踪指定对象 key 的 has 与 get", async () => {
    await withRoot(async () => {
      const key = {};
      const otherKey = {};
      const weakMap = createShallowCollection(new WeakMap<object, number>());
      const readKey = vi.fn(() => [weakMap.has(key), weakMap.get(key)]);

      createEffect(readKey);
      await flush();

      weakMap.set(otherKey, 1);
      await flush();
      expect(readKey).toHaveBeenCalledTimes(1);

      weakMap.set(key, 2);
      await flush();
      expect(readKey).toHaveBeenCalledTimes(2);
    });
  });
});
