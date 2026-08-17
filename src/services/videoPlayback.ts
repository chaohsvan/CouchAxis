import {
  command as mpvCommand,
  destroy as destroyMpv,
  getProperty as getMpvProperty,
  init as initMpv,
  listenEvents as listenMpvEvents,
  observeProperties as observeMpvProperties,
  setProperty as setMpvProperty,
  setVideoMarginRatio,
  type MpvConfig,
  type MpvEvent,
  type MpvObservableProperty,
  type VideoMarginRatio,
} from "tauri-plugin-libmpv-api";

export const NATIVE_VIDEO_OBSERVED_PROPERTIES = [
  ["pause", "flag"],
  ["time-pos", "double", "none"],
  ["duration", "double", "none"],
  ["volume", "double"],
  ["mute", "flag"],
  ["speed", "double"],
  ["dwidth", "int64", "none"],
  ["dheight", "int64", "none"],
  ["eof-reached", "flag"],
] as const satisfies readonly MpvObservableProperty[];

export const NATIVE_VIDEO_INITIAL_OPTIONS = {
  vo: "gpu-next",
  hwdec: "auto-safe",
  "keep-open": "yes",
  "force-window": "yes",
  pause: true,
  osc: false,
  "input-default-bindings": false,
  "input-vo-keyboard": false,
  "sub-auto": "no",
  volume: 80,
} as const satisfies NonNullable<MpvConfig["initialOptions"]>;

const MIN_RESUME_SECONDS = 5;
const COMPLETION_REMAINING_SECONDS = 15;

export type NativeVideoStatus =
  | "initializing"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "ended"
  | "error"
  | "disposed";

export interface NativeVideoError {
  kind: "initialization" | "playback";
  message: string;
  code?: number;
}

export interface NativeVideoState {
  sessionId: number;
  status: NativeVideoStatus;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  videoWidth: number;
  videoHeight: number;
  paused: boolean;
  error: NativeVideoError | null;
}

export type NativeVideoStateEvent =
  | { sessionId: number; kind: "loading" }
  | { sessionId: number; kind: "file-loaded" }
  | { sessionId: number; kind: "property"; name: string; data: unknown }
  | { sessionId: number; kind: "end-file"; reason: string; error?: number }
  | { sessionId: number; kind: "failure"; error: NativeVideoError }
  | { sessionId: number; kind: "disposed" };

export interface NativeVideoMargins {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

export interface NativeVideoSessionController {
  readonly sessionId: number;
  readonly ready: Promise<void>;
  getState(): NativeVideoState;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekAbsolute(positionSeconds: number): Promise<void>;
  seekRelative(amountSeconds: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setRate(rate: number): Promise<void>;
  setSubtitleScale(scale: number): Promise<void>;
  setVideoMargins(margins: NativeVideoMargins): Promise<void>;
  setSubtitlesEnabled(enabled: boolean): Promise<void>;
  loadSubtitle(path: string): Promise<void>;
  clearSubtitle(): Promise<void>;
  captureScreenshot(targetPath: string): Promise<void>;
  dispose(): Promise<void>;
}

type Unlisten = () => void;

export interface NativeMpvApi {
  init(config: MpvConfig): Promise<string>;
  destroy(windowLabel?: string): Promise<void>;
  observeProperties(
    properties: readonly MpvObservableProperty[],
    callback: (event: { name: string; data: unknown }) => void,
    windowLabel?: string,
  ): Promise<Unlisten>;
  listenEvents(callback: (event: MpvEvent) => void, windowLabel?: string): Promise<Unlisten>;
  command(name: string, args?: (string | boolean | number)[], windowLabel?: string): Promise<void>;
  setProperty(name: string, value: string | boolean | number, windowLabel?: string): Promise<void>;
  getProperty(name: string, format: "double", windowLabel?: string): Promise<number | null>;
  setVideoMarginRatio(ratio: VideoMarginRatio, windowLabel?: string): Promise<void>;
}

interface SessionRecord {
  id: number;
  resumePosition: number;
  onState: (state: NativeVideoState) => void;
  state: NativeVideoState;
  windowLabel?: string;
  commandTail: Promise<void>;
  unlisten: Unlisten[];
  disposeRequested: boolean;
  destroyed: boolean;
  fileLoadedHandled: boolean;
  disposePromise?: Promise<void>;
  ready: Promise<void>;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegative(value: unknown): number {
  const number = finiteNumber(value);
  return number === null ? 0 : Math.max(0, number);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function createInitialNativeVideoState(sessionId: number): NativeVideoState {
  return {
    sessionId,
    status: "initializing",
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    muted: false,
    playbackRate: 1,
    videoWidth: 0,
    videoHeight: 0,
    paused: true,
    error: null,
  };
}

export function validResumePosition(positionSeconds: number, durationSeconds: number): number {
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) return 0;
  if (positionSeconds < MIN_RESUME_SECONDS || durationSeconds <= 0) return 0;
  if (durationSeconds - positionSeconds <= COMPLETION_REMAINING_SECONDS) return 0;
  return Math.max(0, positionSeconds);
}

export function normalizeVideoMargins(margins: NativeVideoMargins): Required<NativeVideoMargins> {
  const normalize = (value: number | undefined) => Number.isFinite(value) ? clamp(value ?? 0, 0, 1) : 0;
  return {
    left: normalize(margins.left),
    right: normalize(margins.right),
    top: normalize(margins.top),
    bottom: normalize(margins.bottom),
  };
}

export function reduceNativeVideoState(
  state: NativeVideoState,
  event: NativeVideoStateEvent,
): NativeVideoState {
  if (event.sessionId !== state.sessionId) return state;
  if (state.status === "disposed" && event.kind !== "disposed") return state;

  if (event.kind === "loading") {
    return { ...state, status: "loading", currentTime: 0, duration: 0, error: null };
  }
  if (event.kind === "file-loaded") {
    return { ...state, status: "ready", error: null };
  }
  if (event.kind === "failure") {
    return { ...state, status: "error", paused: true, error: event.error };
  }
  if (event.kind === "disposed") {
    return { ...state, status: "disposed", paused: true };
  }
  if (event.kind === "end-file") {
    if (event.reason === "redirect") return { ...state, status: "loading", paused: true };
    if (event.reason === "error" || (event.error ?? 0) < 0) {
      return {
        ...state,
        status: "error",
        paused: true,
        error: {
          kind: "playback",
          message: `mpv ended playback with reason ${event.reason}`,
          code: event.error,
        },
      };
    }
    return {
      ...state,
      status: "ended",
      currentTime: state.duration > 0 ? state.duration : state.currentTime,
      paused: true,
    };
  }

  const { name, data } = event;
  if (name === "pause" && typeof data === "boolean") {
    const status = state.status === "ended" || state.status === "error"
      ? state.status
      : state.status === "initializing" || state.status === "loading"
        ? state.status
        : data ? "paused" : "playing";
    return { ...state, paused: data, status };
  }
  if (name === "time-pos") return { ...state, currentTime: nonNegative(data) };
  if (name === "duration") return { ...state, duration: nonNegative(data) };
  if (name === "volume") {
    const volume = finiteNumber(data);
    return volume === null ? state : { ...state, volume: clamp(volume / 100, 0, 1) };
  }
  if (name === "mute" && typeof data === "boolean") return { ...state, muted: data };
  if (name === "speed") {
    const playbackRate = finiteNumber(data);
    return playbackRate === null || playbackRate <= 0 ? state : { ...state, playbackRate };
  }
  if (name === "dwidth") return { ...state, videoWidth: Math.floor(nonNegative(data)) };
  if (name === "dheight") return { ...state, videoHeight: Math.floor(nonNegative(data)) };
  if (name === "eof-reached" && data === true) {
    return {
      ...state,
      status: "ended",
      currentTime: state.duration > 0 ? state.duration : state.currentTime,
      paused: true,
    };
  }
  if (name === "eof-reached" && data === false && state.status === "ended") {
    return { ...state, status: state.paused ? "paused" : "playing" };
  }
  return state;
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

const defaultMpvApi: NativeMpvApi = {
  init: initMpv,
  destroy: destroyMpv,
  observeProperties: (properties, callback, windowLabel) => (
    observeMpvProperties(properties, callback, windowLabel)
  ),
  listenEvents: listenMpvEvents,
  command: mpvCommand,
  setProperty: setMpvProperty,
  getProperty: (name, format, windowLabel) => getMpvProperty(name, format, windowLabel),
  setVideoMarginRatio,
};

export function createNativeVideoSessionFactory(api: NativeMpvApi) {
  let nextSessionId = 0;
  let desiredSessionId = 0;
  let activeSession: SessionRecord | null = null;
  let lifecycleTail = Promise.resolve();

  const enqueueLifecycle = (operation: () => Promise<void>): Promise<void> => {
    const result = lifecycleTail.then(operation, operation);
    lifecycleTail = result.catch(() => undefined);
    return result;
  };

  const isCurrent = (record: SessionRecord): boolean => (
    activeSession === record
    && desiredSessionId === record.id
    && !record.disposeRequested
    && !record.destroyed
  );

  const dispatch = (record: SessionRecord, event: NativeVideoStateEvent): void => {
    if (event.kind !== "disposed" && !isCurrent(record)) return;
    const next = reduceNativeVideoState(record.state, event);
    if (next === record.state) return;
    record.state = next;
    try {
      record.onState(next);
    } catch {
      // A UI callback must not interrupt the native playback event loop.
    }
  };

  const enqueueCommand = (record: SessionRecord, operation: () => Promise<void>): Promise<void> => {
    const result = record.commandTail.then(async () => {
      if (!isCurrent(record)) return;
      await operation();
    });
    record.commandTail = result.catch(() => undefined);
    return result;
  };

  const teardown = async (record: SessionRecord, markDisposed = true): Promise<void> => {
    if (record.destroyed) return;
    record.destroyed = true;
    await record.commandTail.catch(() => undefined);
    record.unlisten.splice(0).forEach((unlisten) => {
      try {
        unlisten();
      } catch {
        // Listener cleanup is best effort; destroy still has to run.
      }
    });
    try {
      await api.destroy(record.windowLabel);
    } catch {
      // A partially initialized or already destroyed plugin can reject here.
    }
    if (activeSession === record) activeSession = null;
    if (markDisposed) dispatch(record, { sessionId: record.id, kind: "disposed" });
  };

  const failPlayback = (record: SessionRecord, kind: NativeVideoError["kind"], reason: unknown): void => {
    dispatch(record, {
      sessionId: record.id,
      kind: "failure",
      error: { kind, message: errorMessage(reason) },
    });
  };

  const handleFileLoaded = (record: SessionRecord): void => {
    if (!isCurrent(record) || record.fileLoadedHandled) return;
    record.fileLoadedHandled = true;
    dispatch(record, { sessionId: record.id, kind: "file-loaded" });
    void enqueueCommand(record, async () => {
      const duration = await api.getProperty("duration", "double", record.windowLabel);
      dispatch(record, {
        sessionId: record.id,
        kind: "property",
        name: "duration",
        data: duration,
      });
      const resumePosition = validResumePosition(record.resumePosition, duration ?? 0);
      if (resumePosition > 0) {
        await api.command("seek", [resumePosition, "absolute"], record.windowLabel);
      }
      await api.setProperty("pause", false, record.windowLabel);
    }).catch((reason) => failPlayback(record, "playback", reason));
  };

  const handleMpvEvent = (record: SessionRecord, event: MpvEvent): void => {
    if (!isCurrent(record)) return;
    if (event.event === "file-loaded") {
      handleFileLoaded(record);
    } else if (event.event === "end-file") {
      dispatch(record, {
        sessionId: record.id,
        kind: "end-file",
        reason: event.reason,
        error: event.error,
      });
    } else if (event.event === "shutdown" && !record.disposeRequested) {
      failPlayback(record, "playback", "mpv shut down unexpectedly");
    }
  };

  return function createNativeVideoSession(
    path: string,
    resumePosition: number,
    onState: (state: NativeVideoState) => void,
  ): NativeVideoSessionController {
    const id = ++nextSessionId;
    desiredSessionId = id;
    const record: SessionRecord = {
      id,
      resumePosition,
      onState,
      state: createInitialNativeVideoState(id),
      commandTail: Promise.resolve(),
      unlisten: [],
      disposeRequested: false,
      destroyed: false,
      fileLoadedHandled: false,
      ready: Promise.resolve(),
    };
    try {
      onState(record.state);
    } catch {
      // Initialization is independent from React callback failures.
    }

    const setup = enqueueLifecycle(async () => {
      if (activeSession) await teardown(activeSession);
      if (record.disposeRequested || desiredSessionId !== id) {
        dispatch(record, { sessionId: id, kind: "disposed" });
        return;
      }
      activeSession = record;
      try {
        record.windowLabel = await api.init({
          initialOptions: NATIVE_VIDEO_INITIAL_OPTIONS,
          observedProperties: NATIVE_VIDEO_OBSERVED_PROPERTIES,
        });
        if (!isCurrent(record)) {
          await teardown(record);
          return;
        }

        const propertyUnlisten = await api.observeProperties(
          NATIVE_VIDEO_OBSERVED_PROPERTIES,
          ({ name, data }) => dispatch(record, {
            sessionId: id,
            kind: "property",
            name,
            data,
          }),
          record.windowLabel,
        );
        record.unlisten.push(propertyUnlisten);
        const eventUnlisten = await api.listenEvents(
          (event) => handleMpvEvent(record, event),
          record.windowLabel,
        );
        if (!isCurrent(record)) {
          eventUnlisten();
          await teardown(record);
          return;
        }
        record.unlisten.push(eventUnlisten);
        dispatch(record, { sessionId: id, kind: "loading" });
        await enqueueCommand(record, () => api.command("loadfile", [path], record.windowLabel));
      } catch (reason) {
        failPlayback(record, "initialization", reason);
        await teardown(record, false);
      }
    });
    record.ready = setup.catch(() => undefined);

    const runWhenReady = (operation: () => Promise<void>): Promise<void> => (
      record.ready.then(() => enqueueCommand(record, operation))
    );
    const requireFinite = (value: number, name: string): number => {
      if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
      return value;
    };
    const controller: NativeVideoSessionController = {
      sessionId: id,
      ready: record.ready,
      getState: () => record.state,
      play: () => runWhenReady(() => api.setProperty("pause", false, record.windowLabel)),
      pause: () => runWhenReady(() => api.setProperty("pause", true, record.windowLabel)),
      seekAbsolute: (positionSeconds) => {
        const position = Math.max(0, requireFinite(positionSeconds, "positionSeconds"));
        return runWhenReady(() => api.command("seek", [position, "absolute"], record.windowLabel));
      },
      seekRelative: (amountSeconds) => {
        const amount = requireFinite(amountSeconds, "amountSeconds");
        return runWhenReady(() => api.command("seek", [amount, "relative"], record.windowLabel));
      },
      setVolume: (volume) => {
        const normalized = clamp(requireFinite(volume, "volume"), 0, 1);
        return runWhenReady(() => api.setProperty("volume", normalized * 100, record.windowLabel));
      },
      setMuted: (muted) => runWhenReady(() => api.setProperty("mute", muted, record.windowLabel)),
      setRate: (rate) => {
        const normalized = clamp(requireFinite(rate, "rate"), 0.01, 100);
        return runWhenReady(() => api.setProperty("speed", normalized, record.windowLabel));
      },
      setSubtitleScale: (scale) => {
        const normalized = clamp(requireFinite(scale, "scale"), 0.1, 10);
        return runWhenReady(() => api.setProperty("sub-scale", normalized, record.windowLabel));
      },
      setVideoMargins: (margins) => runWhenReady(() => (
        api.setVideoMarginRatio(normalizeVideoMargins(margins), record.windowLabel)
      )),
      setSubtitlesEnabled: (enabled) => runWhenReady(() => (
        api.setProperty("sub-visibility", enabled, record.windowLabel)
      )),
      loadSubtitle: (subtitlePath) => {
        if (!subtitlePath.trim()) return Promise.reject(new TypeError("subtitle path is required"));
        return runWhenReady(() => (
          api.command("sub-add", [subtitlePath, "select"], record.windowLabel)
        ));
      },
      clearSubtitle: () => runWhenReady(() => api.setProperty("sid", "no", record.windowLabel)),
      captureScreenshot: (targetPath) => {
        if (!targetPath.trim()) return Promise.reject(new TypeError("screenshot path is required"));
        return runWhenReady(() => (
          api.command("screenshot-to-file", [targetPath, "subtitles"], record.windowLabel)
        ));
      },
      dispose: () => {
        if (record.disposePromise) return record.disposePromise;
        record.disposeRequested = true;
        if (desiredSessionId === id) desiredSessionId = 0;
        dispatch(record, { sessionId: id, kind: "disposed" });
        record.disposePromise = enqueueLifecycle(async () => {
          if (activeSession === record) await teardown(record);
        });
        return record.disposePromise;
      },
    };
    return controller;
  };
}

export const createNativeVideoSession = createNativeVideoSessionFactory(defaultMpvApi);
