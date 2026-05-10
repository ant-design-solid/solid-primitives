import {
  createSignal,
  DEV,
  getListener,
  onCleanup,
  SignalOptions,
} from "solid-js";
import { isServer } from "solid-js/web";
import { noop } from "@s-primitives/shared";

interface TriggerLike<TArgs extends any[] = []> {
  track: (...args: TArgs) => void;
  dirty: (...args: TArgs) => void;
  dirtyAll: () => void;
}

export type Trigger = Omit<TriggerLike<[]>, "dirtyAll">;
export type TriggerCache<T> = TriggerLike<[key: T]>;

const triggerOptions: SignalOptions<undefined> = DEV
  ? { equals: false, name: "trigger" }
  : { equals: false };

interface InternalNode {
  $: () => void; // track
  $$: () => void; // dirty
  n: number; // listener count
}

// 重载 1：默认 Map，T 可以是任意类型
export function createTriggerCache<T = any>(): TriggerCache<T>;

// 重载 2：显式传入 WeakMap 构造函数，强制约束 T 必须是 object
export function createTriggerCache<T extends object>(
  mapConstructor: WeakMapConstructor,
): TriggerCache<T>;

// 重载 3：显式传入 Map 构造函数
export function createTriggerCache<T>(
  mapConstructor: MapConstructor,
): TriggerCache<T>;

// 统一实现签名
export function createTriggerCache<T extends object>(
  mapConstructor: WeakMapConstructor | MapConstructor = Map,
): TriggerCache<T> {
  const cache: Map<T, InternalNode> = new (mapConstructor as any)();

  const track = (key: T) => {
    if (isServer || !getListener()) return;

    let node = cache.get(key);

    if (!node) {
      const [$, $$] = createSignal(undefined, triggerOptions);
      cache.set(key, (node = { $, $$, n: 1 }));
    } else {
      node.n++;
    }

    onCleanup(() => {
      if (--node.n === 0) {
        queueMicrotask(() => node.n === 0 && cache.delete(key));
      }
    });

    node.$();
  };

  const dirty = (key: T) => {
    if (isServer) return;
    cache.get(key)?.$$();
  };

  const dirtyAll = () => {
    if (isServer) return;

    cache.forEach?.((node) => node.$$());
  };

  return {
    track,
    dirty,
    dirtyAll,
  };
}

export function createTrigger(): Trigger {
  if (isServer) {
    return {
      track: noop,
      dirty: noop,
    };
  }
  const [$, $$] = createSignal(undefined, triggerOptions);

  return {
    track: $,
    dirty: $$,
  };
}
