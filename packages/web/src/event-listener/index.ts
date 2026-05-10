import { createEffect, createRenderEffect } from "solid-js";
import {
  access,
  isFunction,
  MaybeAccessor,
  toArray,
  tryOnCleanup,
  type MaybeArray,
} from "@s-primitives/shared";

interface InferEventTarget<Events> {
  addEventListener: (event: Events, fn?: any, options?: any) => any;
  removeEventListener: (event: Events, fn?: any, options?: any) => any;
}

export type EventListenerOptions = boolean | AddEventListenerOptions;

export type TargetWithEventMap =
  | Window
  | Document
  | XMLDocument
  | HTMLBodyElement
  | HTMLFrameSetElement
  | HTMLMediaElement
  | HTMLVideoElement
  | HTMLElement
  | SVGSVGElement
  | SVGElement
  | MathMLElement
  | Element
  | AbortSignal
  | AbstractWorker
  | Animation
  | BroadcastChannel
  | CSSAnimation
  | CSSTransition
  | FileReader
  | IDBDatabase
  | IDBOpenDBRequest
  | IDBRequest
  | IDBTransaction
  | MediaDevices
  | MediaKeySession
  | MediaQueryList
  | MediaRecorder
  | MediaSource
  | MediaStream
  | MediaStreamTrack
  | MessagePort
  | Notification
  | PaymentRequest
  | Performance
  | PermissionStatus
  | PictureInPictureWindow
  | RemotePlayback
  | ScreenOrientation
  | ServiceWorker
  | ServiceWorkerContainer
  | ServiceWorkerRegistration
  | ShadowRoot
  | SharedWorker
  | SourceBuffer
  | SourceBufferList
  | SpeechSynthesis
  | SpeechSynthesisUtterance
  | VisualViewport
  | WebSocket
  | Worker
  | XMLHttpRequest
  | XMLHttpRequestEventTarget
  | XMLHttpRequestUpload
  | EventSource;

export type EventMapOf<Target> =
  // 1. 顶级对象
  Target extends Window
    ? WindowEventMap
    : Target extends Document | XMLDocument
      ? DocumentEventMap
      : // 2. HTML 元素 (注意顺序：子类必须在父类之前)7
        Target extends HTMLVideoElement
        ? HTMLVideoElementEventMap
        : Target extends HTMLMediaElement
          ? HTMLMediaElementEventMap
          : Target extends HTMLBodyElement
            ? HTMLBodyElementEventMap
            : Target extends HTMLFrameSetElement
              ? HTMLFrameSetElementEventMap
              : Target extends HTMLElement
                ? HTMLElementEventMap
                : // 3. SVG / MathML
                  Target extends SVGSVGElement
                  ? SVGSVGElementEventMap
                  : Target extends SVGElement
                    ? SVGElementEventMap
                    : Target extends MathMLElement
                      ? MathMLElementEventMap
                      : Target extends Element
                        ? ElementEventMap
                        : // 4. 动画与信号
                          Target extends CSSAnimation | CSSTransition
                          ? AnimationEventMap // 合并同结果类型
                          : Target extends Animation
                            ? AnimationEventMap
                            : Target extends AbortSignal
                              ? AbortSignalEventMap
                              : // 5. Workers (注意顺序：具体 Worker 在前)
                                Target extends ServiceWorker
                                ? ServiceWorkerEventMap
                                : Target extends SharedWorker
                                  ? AbstractWorkerEventMap
                                  : Target extends AbstractWorker
                                    ? AbstractWorkerEventMap
                                    : // 6. 网络与通信
                                      Target extends WebSocket
                                      ? WebSocketEventMap
                                      : Target extends EventSource
                                        ? EventSourceEventMap
                                        : Target extends MessagePort
                                          ? MessagePortEventMap
                                          : Target extends BroadcastChannel
                                            ? BroadcastChannelEventMap
                                            : // 7. 请求与响应
                                              Target extends XMLHttpRequest
                                              ? XMLHttpRequestEventMap
                                              : Target extends XMLHttpRequestUpload
                                                ? XMLHttpRequestEventTargetEventMap
                                                : Target extends XMLHttpRequestEventTarget
                                                  ? XMLHttpRequestEventTargetEventMap
                                                  : Target extends FileReader
                                                    ? FileReaderEventMap
                                                    : // 8. 媒体与图形
                                                      Target extends MediaStreamTrack
                                                      ? MediaStreamTrackEventMap
                                                      : Target extends MediaStream
                                                        ? MediaStreamEventMap
                                                        : Target extends MediaRecorder
                                                          ? MediaRecorderEventMap
                                                          : Target extends MediaSource
                                                            ? MediaSourceEventMap
                                                            : Target extends MediaDevices
                                                              ? MediaDevicesEventMap
                                                              : Target extends MediaKeySession
                                                                ? MediaKeySessionEventMap
                                                                : Target extends SourceBufferList
                                                                  ? SourceBufferListEventMap
                                                                  : Target extends SourceBuffer
                                                                    ? SourceBufferEventMap
                                                                    : // 9. 数据库 (IDB)
                                                                      Target extends IDBOpenDBRequest
                                                                      ? IDBOpenDBRequestEventMap
                                                                      : Target extends IDBRequest
                                                                        ? IDBRequestEventMap
                                                                        : Target extends IDBTransaction
                                                                          ? IDBTransactionEventMap
                                                                          : Target extends IDBDatabase
                                                                            ? IDBDatabaseEventMap
                                                                            : // 10. 其他 API
                                                                              Target extends Notification
                                                                              ? NotificationEventMap
                                                                              : Target extends PaymentRequest
                                                                                ? PaymentRequestEventMap
                                                                                : Target extends Performance
                                                                                  ? PerformanceEventMap
                                                                                  : Target extends PermissionStatus
                                                                                    ? PermissionStatusEventMap
                                                                                    : Target extends PictureInPictureWindow
                                                                                      ? PictureInPictureWindowEventMap
                                                                                      : Target extends RemotePlayback
                                                                                        ? RemotePlaybackEventMap
                                                                                        : Target extends ScreenOrientation
                                                                                          ? ScreenOrientationEventMap
                                                                                          : Target extends ServiceWorkerContainer
                                                                                            ? ServiceWorkerContainerEventMap
                                                                                            : Target extends ServiceWorkerRegistration
                                                                                              ? ServiceWorkerRegistrationEventMap
                                                                                              : Target extends ShadowRoot
                                                                                                ? ShadowRootEventMap
                                                                                                : Target extends SpeechSynthesisUtterance
                                                                                                  ? SpeechSynthesisUtteranceEventMap
                                                                                                  : Target extends SpeechSynthesis
                                                                                                    ? SpeechSynthesisEventMap
                                                                                                    : Target extends VisualViewport
                                                                                                      ? VisualViewportEventMap
                                                                                                      : Target extends MediaQueryList
                                                                                                        ? MediaQueryListEventMap
                                                                                                        : // 默认
                                                                                                          never;

export function makeEventListener<
  Target extends TargetWithEventMap,
  EventMap extends EventMapOf<Target>,
  EventType extends keyof EventMap,
>(
  target: MaybeArray<Target>,
  type: MaybeArray<EventType>,
  handler: (event: EventMap[EventType]) => void,
  options?: EventListenerOptions,
): VoidFunction;

// Custom Events
export function makeEventListener<
  EventMap extends Record<string, Event>,
  EventType extends keyof EventMap = keyof EventMap,
>(
  target: MaybeArray<EventTarget | InferEventTarget<EventType>>,
  type: MaybeArray<EventType>,
  handler: (event: EventMap[EventType]) => void,
  options?: EventListenerOptions,
): VoidFunction;

export function makeEventListener(
  target: MaybeArray<EventTarget | InferEventTarget<string>>,
  type: MaybeArray<string>,
  handler: (event: Event) => void,
  options?: EventListenerOptions,
): VoidFunction {
  const types = toArray(type);
  const targets = toArray(target);
  types.forEach((type) => {
    targets.forEach((target) => {
      target.addEventListener(type, handler, options);
    });
  });

  const off = () =>
    types.forEach((type) => {
      targets.forEach((target) => {
        target.removeEventListener(type, handler, options);
      });
    });

  tryOnCleanup(off);

  return off;
}

export function useEventListener<
  Target extends TargetWithEventMap,
  EventMap extends EventMapOf<Target>,
  EventType extends keyof EventMap,
>(
  target: MaybeAccessor<MaybeArray<Target | null | undefined>>,
  type: MaybeAccessor<MaybeArray<EventType>>,
  handler: (event: EventMap[EventType]) => void,
  options?: EventListenerOptions,
): void;

// Custom Events
export function useEventListener<
  EventMap extends Record<string, Event>,
  EventType extends keyof EventMap = keyof EventMap,
>(
  target: MaybeAccessor<
    MaybeArray<EventTarget | InferEventTarget<EventType> | null | undefined>
  >,
  type: MaybeAccessor<MaybeArray<EventType>>,
  handler: (event: EventMap[EventType]) => void,
  options?: EventListenerOptions,
): void;

export function useEventListener(
  target: MaybeAccessor<
    MaybeArray<EventTarget | InferEventTarget<string> | undefined | null>
  >,
  type: MaybeAccessor<MaybeArray<string>>,
  handler: (event: Event) => void,
  options?: EventListenerOptions,
): void {
  const attach = () => {
    const types = toArray(access(type));
    const targets = toArray(access(target)).filter(Boolean) as (
      | EventTarget
      | InferEventTarget<string>
    )[];
    if (!types.length || !targets.length) return;
    makeEventListener(targets, types, handler, options);
  };

  if (isFunction(target) || isFunction(type)) {
    createEffect(attach);
  } else {
    createRenderEffect(attach);
  }
}
