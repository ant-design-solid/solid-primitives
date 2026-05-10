import { isMap } from "@s-primitives/shared";
import { createShallowCollection } from "../collection";

export type CacheKey = any;

export type CreateMemoizeCache<Key, Value> = Key extends object
  ? Map<Key, Value> | WeakMap<Key, Value>
  : Map<Key, Value>;

export interface CreateMemoizeReturn<Result, Args extends unknown[]> {
  (...args: Args): Result;

  load: (...args: Args) => Result;

  delete: (...args: Args) => void;

  clear: () => void;

  getKey: (...args: Args) => CacheKey;

  cache: CreateMemoizeCache<CacheKey, Result>;
}

export interface CreateMemoizeOptions<Result, Args extends unknown[]> {
  getKey?: (...args: Args) => CacheKey;

  cache?: CreateMemoizeCache<CacheKey, Result>;
}

export function createMemoize<Result, Args extends unknown[]>(
  resolver: (...args: Args) => Result,
  options: CreateMemoizeOptions<Result, Args> = {},
): CreateMemoizeReturn<Result, Args> {
  const cache: CreateMemoizeCache<CacheKey, Result> = createShallowCollection(
    (options.cache as any) ?? new Map(),
  );

  const getKey = (...args: Args): CacheKey =>
    options.getKey ? options.getKey(...args) : JSON.stringify(args);

  const _load = (key: string | number, ...args: Args) => {
    const value = resolver(...args);
    cache.set(key, value);
    return value;
  };

  const load = (...args: Args): Result => _load(getKey(...args), ...args);

  const deleteByArgs = (...args: Args): void => {
    cache.delete(getKey(...args));
  };

  const clear = (): void => {
    isMap(cache) && cache.clear();
  };

  const memoized = Object.assign(
    (...args: Args): Result => {
      const key = getKey(...args);
      return cache.has(key) ? (cache.get(key) as Result) : _load(key, ...args);
    },
    {
      load,
      delete: deleteByArgs,
      clear,
      getKey,
      cache,
    },
  );

  return memoized;
}
