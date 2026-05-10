import { batch } from 'solid-js'
import { hasOwn, toRawType } from '@s-primitives/shared'
import { createTriggerCache } from '../trigger'

type IterableCollections = (Map<any, any> | Set<any>) & Target
type WeakCollections = (WeakMap<any, any> | WeakSet<any>) & Target
type CollectionTypes = IterableCollections | WeakCollections
type MapTypes = (Map<any, any> | WeakMap<any, any>) & Target
type SetTypes = (Set<any> | WeakSet<any>) & Target

interface Target {
  [$RAW]?: any
}

const $RAW = Symbol('$__raw')
const $OBJECT = Symbol('$__object')

export function createShallowCollection<T extends CollectionTypes>(target: T): T {
  if (target[$RAW] || !Object.isExtensible(target)) {
    return target
  }

  const rawType = toRawType(target)

  if (!['Map', 'Set', 'WeakMap', 'WeakSet'].includes(rawType)) {
    return target
  }

  const canIterate = rawType === 'Map' || rawType === 'Set'
  const isSet = rawType === 'Set' || rawType === 'WeakSet'

  const keyTrigger = createTriggerCache()
  const valueTrigger = isSet ? keyTrigger : createTriggerCache()

  const instrumentations: Record<string | symbol, any> = {
    get(this: MapTypes, key: unknown) {
      valueTrigger.track(key)
      return (target as MapTypes).get(key)
    },
    has(this: CollectionTypes, key: unknown): boolean {
      keyTrigger.track(key)
      return (target as MapTypes).has(key)
    },
    get size() {
      canIterate && keyTrigger.track($OBJECT)

      return (target as Set<any>).size
    },

    set(this: MapTypes, key: unknown, value: any) {
      const rawTarget = target as MapTypes
      const hadKey = rawTarget.has(key)
      const hasChanged = rawTarget.get(key) !== value

      rawTarget.set(key, value)

      if (!hadKey || hasChanged) {
        batch(() => {
          if (!hadKey) {
            canIterate && keyTrigger.dirty($OBJECT)
            keyTrigger.dirty(key)
          }
          if (!hadKey || hasChanged) {
            canIterate && valueTrigger.dirty($OBJECT)
            valueTrigger.dirty(key)
          }
        })
      }
      return this
    },
    add(this: SetTypes, value: any) {
      const rawTarget = target as SetTypes
      const hadValue = rawTarget.has(value)
      rawTarget.add(value)
      if (!hadValue) {
        batch(() => {
          canIterate && keyTrigger.dirty($OBJECT)
          keyTrigger.dirty(value)
        })
      }
      return this
    },
    delete(this: CollectionTypes, key: any): boolean {
      const result = target.delete(key)
      if (!result) return false

      batch(() => {
        if (canIterate) {
          keyTrigger.dirty($OBJECT)
          !isSet && valueTrigger.dirty($OBJECT)
        }
        keyTrigger.dirty(key)
        !isSet && valueTrigger.dirty(key)
      })

      return true
    },
    clear(this: IterableCollections) {
      const rawTarget = target as IterableCollections
      if (rawTarget.size === 0) return
      rawTarget.clear()

      batch(() => {
        keyTrigger.dirtyAll()
        !isSet && valueTrigger.dirtyAll()
      })
    },
    forEach(this: IterableCollections, callback: Function, thisArg?: unknown) {
      const observed = this
      const rawTarget = target as IterableCollections
      if (canIterate) {
        batch(() => {
          keyTrigger.track($OBJECT)
          !isSet && valueTrigger.track($OBJECT)
        })
      }

      return rawTarget.forEach((value: unknown, key: unknown) => {
        return callback.call(thisArg, value, key, observed)
      })
    },
    *keys(): MapIterator<any> {
      keyTrigger.track($OBJECT)

      for (const key of (target as IterableCollections).keys()) {
        yield key
      }
    },
    *values(): MapIterator<any> {
      valueTrigger.track($OBJECT)

      for (const value of (target as IterableCollections).values()) {
        yield value
      }
    },
    *entries(): MapIterator<any> {
      keyTrigger.track($OBJECT)
      valueTrigger.track($OBJECT)

      for (const entry of (target as IterableCollections).entries()) {
        yield entry
      }
    },
    *[Symbol.iterator](): IterableIterator<any> {
      batch(() => {
        keyTrigger.track($OBJECT)
        !isSet && valueTrigger.track($OBJECT)
      })

      for (const entry of (target as IterableCollections)[Symbol.iterator]()) {
        yield entry
      }
    },
  }

  const collectionHandler: ProxyHandler<CollectionTypes> = {
    get: (target: CollectionTypes, key: string | symbol, receiver: CollectionTypes) => {
      if (key === $RAW) {
        return target
      }

      return Reflect.get(
        hasOwn(instrumentations, key as any) && key in target ? instrumentations : target,
        key,
        receiver,
      )
    },
  }

  const proxy = new Proxy<T>(target, collectionHandler)

  return proxy
}
