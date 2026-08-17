import { describe, expect, it, vi } from "vitest";
import type { MpvConfig, MpvEvent, MpvObservableProperty, VideoMarginRatio } from "tauri-plugin-libmpv-api";
import {
  NATIVE_VIDEO_INITIAL_OPTIONS,
  createInitialNativeVideoState,
  createNativeVideoSessionFactory,
  normalizeVideoMargins,
  reduceNativeVideoState,
  validResumePosition,
  type NativeMpvApi,
  type NativeVideoState,
} from "./videoPlayback";

interface FakeMpvApi extends NativeMpvApi {
  propertyCallback?: (event: { name: string; data: unknown }) => void;
  eventCallback?: (event: MpvEvent) => void;
  calls: string[];
}

function createFakeApi(): FakeMpvApi {
  const api: FakeMpvApi = {
    calls: [],
    async init(config: MpvConfig) {
      api.calls.push(`init:${String(config.initialOptions?.vo)}`);
      return "main";
    },
    async destroy() {
      api.calls.push("destroy");
    },
    async observeProperties(
      _properties: readonly MpvObservableProperty[],
      callback: (event: { name: string; data: unknown }) => void,
    ) {
      api.calls.push("observe");
      api.propertyCallback = callback;
      return () => { api.calls.push("unlisten-properties"); };
    },
    async listenEvents(callback: (event: MpvEvent) => void) {
      api.calls.push("listen");
      api.eventCallback = callback;
      return () => { api.calls.push("unlisten-events"); };
    },
    async command(name, args = []) {
      api.calls.push(`command:${name}:${args.join(",")}`);
    },
    async setProperty(name, value) {
      api.calls.push(`set:${name}:${String(value)}`);
    },
    async getProperty() {
      api.calls.push("get:duration");
      return 120;
    },
    async setVideoMarginRatio(ratio: VideoMarginRatio) {
      api.calls.push(`margins:${ratio.top ?? 0}:${ratio.bottom ?? 0}`);
    },
  };
  return api;
}

function reduce(state: NativeVideoState, kind: Parameters<typeof reduceNativeVideoState>[1]): NativeVideoState {
  return reduceNativeVideoState(state, kind);
}

describe("native video state", () => {
  it("ignores events from stale sessions", () => {
    const state = createInitialNativeVideoState(4);
    const next = reduce(state, { sessionId: 3, kind: "property", name: "time-pos", data: 42 });

    expect(next).toBe(state);
  });

  it("maps observed mpv properties into the UI state", () => {
    let state = createInitialNativeVideoState(1);
    state = reduce(state, { sessionId: 1, kind: "loading" });
    state = reduce(state, { sessionId: 1, kind: "file-loaded" });
    state = reduce(state, { sessionId: 1, kind: "property", name: "duration", data: 125.5 });
    state = reduce(state, { sessionId: 1, kind: "property", name: "time-pos", data: 32 });
    state = reduce(state, { sessionId: 1, kind: "property", name: "volume", data: 135 });
    state = reduce(state, { sessionId: 1, kind: "property", name: "mute", data: true });
    state = reduce(state, { sessionId: 1, kind: "property", name: "speed", data: 1.5 });
    state = reduce(state, { sessionId: 1, kind: "property", name: "dwidth", data: 1920.8 });
    state = reduce(state, { sessionId: 1, kind: "property", name: "dheight", data: 1080 });
    state = reduce(state, { sessionId: 1, kind: "property", name: "pause", data: false });

    expect(state).toMatchObject({
      status: "playing",
      currentTime: 32,
      duration: 125.5,
      volume: 1,
      muted: true,
      playbackRate: 1.5,
      videoWidth: 1920,
      videoHeight: 1080,
      paused: false,
    });
  });

  it("maps eof and playback errors to terminal states", () => {
    let state: NativeVideoState = {
      ...createInitialNativeVideoState(2),
      status: "playing",
      duration: 90,
      paused: false,
    };
    state = reduce(state, { sessionId: 2, kind: "property", name: "eof-reached", data: true });
    expect(state).toMatchObject({ status: "ended", currentTime: 90, paused: true });

    state = reduce(state, { sessionId: 2, kind: "end-file", reason: "error", error: -13 });
    expect(state.status).toBe("error");
    expect(state.error).toMatchObject({ kind: "playback", code: -13 });
  });
});

describe("native video normalization", () => {
  it("accepts only resumable positions away from the opening and tail", () => {
    expect(validResumePosition(4.99, 100)).toBe(0);
    expect(validResumePosition(5, 100)).toBe(5);
    expect(validResumePosition(85, 100)).toBe(0);
    expect(validResumePosition(Number.NaN, 100)).toBe(0);
  });

  it("clamps video margins", () => {
    expect(normalizeVideoMargins({ left: -1, right: 2, top: 0.1, bottom: Number.NaN })).toEqual({
      left: 0,
      right: 1,
      top: 0.1,
      bottom: 0,
    });
  });

  it("uses embedded playback without mpv input UI", () => {
    expect(NATIVE_VIDEO_INITIAL_OPTIONS).toMatchObject({
      vo: "gpu-next",
      hwdec: "auto-safe",
      "keep-open": "yes",
      "force-window": "yes",
      pause: true,
      osc: false,
      "input-default-bindings": false,
      "input-vo-keyboard": false,
      "sub-auto": "no",
    });
  });
});

describe("native video sessions", () => {
  it("resumes after file-loaded and only then starts playback", async () => {
    const api = createFakeApi();
    const states: NativeVideoState[] = [];
    const createSession = createNativeVideoSessionFactory(api);
    const session = createSession("D:\\movie.mkv", 30, (state) => states.push(state));
    await session.ready;

    api.eventCallback?.({ event: "file-loaded" });
    await vi.waitFor(() => {
      expect(api.calls).toContain("set:pause:false");
    });

    const seekIndex = api.calls.indexOf("command:seek:30,absolute");
    const playIndex = api.calls.indexOf("set:pause:false");
    expect(seekIndex).toBeGreaterThan(-1);
    expect(playIndex).toBeGreaterThan(seekIndex);
    expect(states.some((state) => state.status === "ready")).toBe(true);
    await session.dispose();
  });

  it("serializes replacement and prevents stale disposal from destroying the new session", async () => {
    const api = createFakeApi();
    const createSession = createNativeVideoSessionFactory(api);
    const first = createSession("D:\\first.mkv", 0, () => undefined);
    await first.ready;
    const second = createSession("D:\\second.mkv", 0, () => undefined);
    await second.ready;

    const firstLoad = api.calls.indexOf("command:loadfile:D:\\first.mkv");
    const destroy = api.calls.indexOf("destroy");
    const secondLoad = api.calls.indexOf("command:loadfile:D:\\second.mkv");
    expect(firstLoad).toBeGreaterThan(-1);
    expect(destroy).toBeGreaterThan(firstLoad);
    expect(secondLoad).toBeGreaterThan(destroy);

    const destroysBeforeStaleDispose = api.calls.filter((call) => call === "destroy").length;
    await first.dispose();
    expect(api.calls.filter((call) => call === "destroy")).toHaveLength(destroysBeforeStaleDispose);
    await second.dispose();
  });

  it("cancels a StrictMode-style stale session before initialization", async () => {
    const api = createFakeApi();
    const createSession = createNativeVideoSessionFactory(api);
    const first = createSession("D:\\first.mkv", 0, () => undefined);
    const second = createSession("D:\\second.mkv", 0, () => undefined);

    await Promise.all([first.ready, second.ready]);
    expect(api.calls.filter((call) => call.startsWith("init:"))).toHaveLength(1);
    expect(api.calls).not.toContain("command:loadfile:D:\\first.mkv");
    expect(api.calls).toContain("command:loadfile:D:\\second.mkv");
    await second.dispose();
  });

  it("makes disposal idempotent and ignores late native events", async () => {
    const api = createFakeApi();
    const states: NativeVideoState[] = [];
    const createSession = createNativeVideoSessionFactory(api);
    const session = createSession("D:\\movie.mkv", 0, (state) => states.push(state));
    await session.ready;
    const stalePropertyCallback = api.propertyCallback;

    await Promise.all([session.dispose(), session.dispose()]);
    const stateCount = states.length;
    stalePropertyCallback?.({ name: "time-pos", data: 88 });

    expect(api.calls.filter((call) => call === "destroy")).toHaveLength(1);
    expect(states).toHaveLength(stateCount);
    expect(session.getState().status).toBe("disposed");
  });

  it("preserves initialization errors until the session is explicitly disposed", async () => {
    const api = createFakeApi();
    api.init = async () => {
      api.calls.push("init:failed");
      throw new Error("libmpv unavailable");
    };
    const states: NativeVideoState[] = [];
    const createSession = createNativeVideoSessionFactory(api);
    const session = createSession("D:\\movie.mkv", 0, (state) => states.push(state));

    await session.ready;
    expect(session.getState()).toMatchObject({
      status: "error",
      error: { kind: "initialization", message: "libmpv unavailable" },
    });
    expect(states.at(-1)?.status).toBe("error");

    await session.dispose();
    expect(session.getState().status).toBe("disposed");
  });

  it("cleans up the first listener when the second listener fails", async () => {
    const api = createFakeApi();
    api.listenEvents = async () => {
      api.calls.push("listen:failed");
      throw new Error("event listener unavailable");
    };
    const createSession = createNativeVideoSessionFactory(api);
    const session = createSession("D:\\movie.mkv", 0, () => undefined);

    await session.ready;

    expect(api.calls).toContain("unlisten-properties");
    expect(api.calls).toContain("destroy");
    expect(session.getState()).toMatchObject({
      status: "error",
      error: { kind: "initialization", message: "event listener unavailable" },
    });
    await session.dispose();
  });

  it("serializes commands and maps controller units to mpv", async () => {
    const api = createFakeApi();
    const createSession = createNativeVideoSessionFactory(api);
    const session = createSession("D:\\movie.mkv", 0, () => undefined);
    await session.ready;

    await Promise.all([
      session.setVolume(0.65),
      session.seekRelative(-10),
      session.setRate(1.5),
      session.setSubtitleScale(1.25),
      session.setSubtitlesEnabled(false),
      session.loadSubtitle("D:\\movie.ass"),
      session.setVideoMargins({ top: 0.1, bottom: 0.2 }),
      session.captureScreenshot("D:\\shot.png"),
    ]);

    expect(api.calls).toEqual(expect.arrayContaining([
      "set:volume:65",
      "command:seek:-10,relative",
      "set:speed:1.5",
      "set:sub-scale:1.25",
      "set:sub-visibility:false",
      "command:sub-add:D:\\movie.ass,select",
      "margins:0.1:0.2",
      "command:screenshot-to-file:D:\\shot.png,subtitles",
    ]));
    expect(api.calls).not.toContain("set:sub-visibility:true");
    await session.dispose();
  });
});
