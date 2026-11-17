/// <reference path="../../built/pxtsim.d.ts"/>

/* eslint-disable import/no-unassigned-import mocha-no-side-effect-code */
import "mocha";
import * as chai from "chai";

// The editor's page, the main simulator and the simulator extensions are served
// from two origins, as in production: the editor's, and the simulator host's.
const EDITOR_ORIGIN = "https://editor.example";
const SIM_ORIGIN = "https://sim.example";
const SIM_URL = SIM_ORIGIN + "/sim/simulator.html";

/** A message posted to a window, with the origin it was posted to. */
interface Post {
    msg: pxsim.SimulatorMessage;
    targetOrigin: string;
}

class FakeWindow {
    posts: Post[] = [];

    postMessage(msg: pxsim.SimulatorMessage, targetOrigin: string) {
        this.posts.push({ msg, targetOrigin });
    }

    /** The messages posted to the window, in order. */
    get messages(): pxsim.SimulatorMessage[] {
        return this.posts.map(p => p.msg);
    }
}

interface FakeFrame {
    id: string;
    dataset: pxt.Map<string>;
    contentWindow: FakeWindow;
}

/**
 * The part of a DOM element the driver touches when it creates, starts, hides
 * and removes simulator frames. An iframe removed from its parent, directly or
 * with an ancestor, loses its content window, as in the browser.
 */
class FakeElement implements FakeFrame {
    id = "";
    className = "";
    src = "";
    title = "";
    frameBorder = "";
    allowFullscreen = false;
    onclick: (ev: unknown) => boolean;
    dataset: pxt.Map<string> = {};
    style: pxt.Map<string> = {};
    // the window of the frame's page, which outlives the frame's removal
    readonly window = new FakeWindow();
    contentWindow = this.window;
    parentElement: FakeElement;
    children: FakeElement[] = [];
    classList = {
        add: (cls: string) => {
            if (!this.classList.contains(cls)) this.className = this.classNames().concat(cls).join(" ");
        },
        remove: (cls: string) => {
            this.className = this.classNames().filter(c => c !== cls).join(" ");
        },
        contains: (cls: string) => this.classNames().indexOf(cls) >= 0,
    };
    private attributes: pxt.Map<string> = {};
    private listeners: pxt.Map<(() => void)[]> = {};

    constructor(public tagName: string) { }

    get firstChild(): FakeElement {
        return this.children[0];
    }

    get firstElementChild(): FakeElement {
        return this.children[0];
    }

    get nextElementSibling(): FakeElement {
        const siblings = this.parentElement?.children || [];
        return siblings[siblings.indexOf(this) + 1];
    }

    setAttribute(name: string, value: string) {
        this.attributes[name] = value;
    }

    getAttribute(name: string): string {
        return this.attributes[name];
    }

    appendChild(child: FakeElement): FakeElement {
        return this.insertBefore(child, undefined);
    }

    /** Inserts `child` before `ref`, or last when `ref` is not a child. */
    insertBefore(child: FakeElement, ref: FakeElement): FakeElement {
        if (child.parentElement) child.parentElement.unlink(child);
        const index = ref ? this.children.indexOf(ref) : -1;
        if (index < 0) this.children.push(child);
        else this.children.splice(index, 0, child);
        child.parentElement = this;
        return child;
    }

    /**
     * Removes `child`. Each iframe in the removed subtree loses its
     * `contentWindow`, as an iframe detached from the document does.
     */
    removeChild(child: FakeElement): FakeElement {
        this.unlink(child);
        child.detach();
        return child;
    }

    /** Returns the descendants with tag `tagName`, in document order. */
    getElementsByTagName(tagName: string): FakeElement[] {
        return this.children.reduce((found, child) => found.concat(
            child.tagName === tagName ? [child] : [],
            child.getElementsByTagName(tagName)), [] as FakeElement[]);
    }

    /** Matches no element, whatever the selector. */
    querySelectorAll(): FakeElement[] {
        return [];
    }

    focus() { }

    addEventListener(type: string, listener: () => void) {
        (this.listeners[type] = this.listeners[type] || []).push(listener);
    }

    // drops the content window of every iframe in this subtree, which has left the document
    private detach() {
        if (this.tagName === "iframe") this.contentWindow = null;
        this.children.forEach(child => child.detach());
    }

    private classNames(): string[] {
        return this.className.split(/\s+/).filter(c => !!c);
    }

    // takes `child` out of this element's children without detaching its subtree
    private unlink(child: FakeElement) {
        this.children.splice(this.children.indexOf(child), 1);
        child.parentElement = undefined;
    }
}

type MessageListener = (ev: { data: unknown, source: unknown, origin: string }) => void;

// the message listeners on the editor's window
let windowListeners: MessageListener[] = [];

function initGlobals() {
    const g = global as any;
    g.window = {
        location: { origin: EDITOR_ORIGIN, href: EDITOR_ORIGIN + "/index.html" },
        addEventListener: (type: string, listener: MessageListener) => {
            if (type === "message") windowListeners.push(listener);
        },
        removeEventListener: (type: string, listener: MessageListener) => {
            if (type === "message") windowListeners = windowListeners.filter(l => l !== listener);
        },
    };
    g.location = g.window.location;
    g.document = {
        createElement: (tagName: string) => new FakeElement(tagName),
    };
}

initGlobals();

// each test starts with no driver listening on the editor's window
beforeEach(() => {
    windowListeners = [];
});

/**
 * Delivers `msg` to the message listeners on the editor's window, as the
 * browser does when the window `source`, whose page is at `origin`, posts it
 * to the editor.
 */
function dispatchMessage(msg: unknown, source: FakeWindow, origin = SIM_ORIGIN) {
    chai.expect(windowListeners.length, "listeners on the editor's window").greaterThan(0);
    windowListeners.slice().forEach(listener => listener({ data: msg, source, origin }));
}

/**
 * Returns a simulator frame the driver holds, at the simulator host's origin:
 * the frame of the simulator extension listening on `channel`, or a main
 * simulator frame when `channel` is omitted.
 */
function staticFrame(id: string, channel?: string): FakeFrame {
    const dataset: pxt.Map<string> = { origin: SIM_ORIGIN, runid: "" };
    if (channel) dataset["messagechannel"] = channel;
    return { id, dataset, contentWindow: new FakeWindow() };
}

/**
 * Returns the refusals posted to `frame`, without their messages, and checks
 * that each was posted to the origin the frame was created with.
 */
function refusals(frame: FakeFrame) {
    chai.expect(frame.contentWindow.posts.map(p => p.targetOrigin)).deep.equals(frame.contentWindow.posts.map(() => frame.dataset["origin"]));
    return frame.contentWindow.messages.map(m => {
        const { type, id, subtype, code } = m as pxsim.SimulatorMessage & { id: string, subtype: string, code: string };
        return { type, id, subtype, code };
    });
}

// records the errors the driver logs while `fn` runs, instead of printing them
function loggedErrors(fn: () => void): unknown[][] {
    const errors: unknown[][] = [];
    class RecordingLogger extends pxsim.ConsoleLogger {
        error(...args: unknown[]) { errors.push(args); }
    }
    pxsim.setLogger(new RecordingLogger());
    try {
        fn();
    } finally {
        pxsim.setLogger(new pxsim.ConsoleLogger());
    }
    return errors;
}

describe("simulator driver projfs messages", () => {
    interface Delivery {
        key: string;
        msg: pxsim.SimulatorMessage;
    }

    const request = { type: "projfs", id: "1", subtype: "list" } as pxsim.SimulatorMessage;
    let mainFrame: FakeFrame;
    let simxFrame: FakeFrame;
    let otherSimxFrame: FakeFrame;
    let unofferedFrame: FakeFrame;
    let ungrantedFrame: FakeFrame;
    let deliveries: Delivery[];
    let driver: pxsim.SimulatorDriver;

    function receive(msg: pxsim.SimulatorMessage, source: FakeWindow, origin = SIM_ORIGIN) {
        dispatchMessage(msg, source, origin);
    }

    function relayed() {
        return [mainFrame, otherSimxFrame, unofferedFrame].some(f => f.contentWindow.messages.length > 0);
    }

    beforeEach(() => {
        mainFrame = staticFrame("sim-frame-1");
        simxFrame = staticFrame("sim-frame-2", "someorg/pxt-ext");
        otherSimxFrame = staticFrame("sim-frame-3", "otherorg/pxt-other");
        unofferedFrame = staticFrame("sim-frame-4", "someorg/pxt-removed");
        ungrantedFrame = staticFrame("sim-frame-5", "someorg/pxt-nofiles");
        const frames = [mainFrame, simxFrame, otherSimxFrame, unofferedFrame, ungrantedFrame];
        const container = { getElementsByTagName: () => frames } as unknown as HTMLElement;
        const simx = () => ({ index: "index.html", aspectRatio: 1, permanent: true });
        deliveries = [];
        driver = new pxsim.SimulatorDriver(container, {
            simUrl: SIM_URL,
            simulatorExtensions: {
                "someorg/pxt-ext": { ...simx(), allowFileWrite: true },
                "otherorg/pxt-other": { ...simx(), allowFileWrite: true },
                "someorg/pxt-nofiles": simx(),
            },
            onProjfsMessage: (key, msg) => deliveries.push({ key, msg }),
        });
        // installs the driver's listener on the editor's window; the frames already exist
        driver.preload(1);
    });

    it("answers requests from a registered frame without allowFileWrite with PERMISSION_DENIED, delivering nothing", () => {
        for (const msg of [request, { type: "projfs", id: "2", subtype: "write", name: "a.txt", content: "x" } as pxsim.SimulatorMessage])
            receive(msg, ungrantedFrame.contentWindow);
        chai.expect(deliveries).deep.equals([]);
        chai.expect(refusals(ungrantedFrame)).deep.equals([
            { type: "projfs", id: "1", subtype: "error", code: "PERMISSION_DENIED" },
            { type: "projfs", id: "2", subtype: "error", code: "PERMISSION_DENIED" },
        ]);
        chai.expect(relayed()).equals(false);
        chai.expect(simxFrame.contentWindow.messages).deep.equals([]);
    });

    it("takes the key from the frame, not the message", () => {
        receive({ ...request, channel: "otherorg/pxt-other" } as pxsim.SimulatorMessage, simxFrame.contentWindow);
        chai.expect(deliveries.map(d => d.key)).deep.equals(["someorg/pxt-ext"]);
    });

    it("answers requests from the main simulator frame with UNREGISTERED, delivering nothing", () => {
        receive(request, mainFrame.contentWindow);
        chai.expect(deliveries).deep.equals([]);
        chai.expect(refusals(mainFrame)).deep.equals([{ type: "projfs", id: "1", subtype: "error", code: "UNREGISTERED" }]);
        chai.expect([simxFrame, otherSimxFrame, unofferedFrame].some(f => f.contentWindow.messages.length > 0)).equals(false);
    });

    it("drops requests from windows outside the simulator", () => {
        receive(request, new FakeWindow());
        chai.expect(deliveries).deep.equals([]);
        chai.expect(relayed()).equals(false);
        chai.expect(simxFrame.contentWindow.messages).deep.equals([]);
    });

    it("drops a request from a frame's window posted from an origin the editor does not allow, refuses one from another allowed origin with UNREGISTERED, and delivers one from the frame's own origin", () => {
        receive(request, simxFrame.contentWindow, "https://elsewhere.example");
        chai.expect(deliveries).deep.equals([]);
        chai.expect(simxFrame.contentWindow.posts).deep.equals([]);

        receive(request, simxFrame.contentWindow, EDITOR_ORIGIN);
        chai.expect(deliveries).deep.equals([]);
        chai.expect(refusals(simxFrame)).deep.equals([{ type: "projfs", id: "1", subtype: "error", code: "UNREGISTERED" }]);

        receive(request, simxFrame.contentWindow, simxFrame.dataset["origin"]);
        chai.expect(deliveries.map(d => d.key)).deep.equals(["someorg/pxt-ext"]);
    });
});

describe("simulator driver simulator extension frames", () => {
    const KEY = "someorg/pxt-ext";
    const SIM_SANDBOX = "allow-same-origin allow-scripts";
    const SIM_ALLOW = "autoplay;microphone";

    interface FrameGrants {
        allowPopups?: boolean;
        allowClipboard?: boolean;
        allowCamera?: boolean;
        allowMidi?: boolean;
        allowUsb?: boolean;
        allowSerial?: boolean;
        allowBluetooth?: boolean;
        allowHid?: boolean;
        allowMotionSensors?: boolean;
        allowDisplayCapture?: boolean;
        allowGamepad?: boolean;
        allowDownloads?: boolean;
        allowPointerLock?: boolean;
    }

    interface Harness {
        driver: pxsim.SimulatorDriver;
        container: FakeElement;
        // the main simulator frame, already in the container
        mainFrame: FakeElement;
    }

    /** Creates a driver whose container holds a main simulator frame, offering the extension "someorg/pxt-ext" registered with `grants`. */
    function newDriver(options: pxsim.SimulatorDriverOptions = {}, grants: FrameGrants = {}): Harness {
        const container = new FakeElement("div");
        const mainFrame = container.appendChild(new FakeElement("div")).appendChild(new FakeElement("iframe"));
        mainFrame.id = "sim-frame-1";
        mainFrame.dataset = { origin: SIM_ORIGIN, runid: "" };
        const driver = new pxsim.SimulatorDriver(container as unknown as HTMLElement, {
            simUrl: SIM_URL,
            simulatorExtensions: {
                [KEY]: { index: "index.html", aspectRatio: 1, permanent: true, ...grants },
            },
            ...options,
        });
        return { driver, container, mainFrame };
    }

    function packet(): pxsim.SimulatorMessage {
        return { type: "messagepacket", channel: KEY, broadcast: true, data: new Uint8Array(0) } as pxsim.SimulatorMessage;
    }

    /**
     * Starts the simulator extension offered under "someorg/pxt-ext", registered with
     * `grants`, by posting a message on its channel from the main simulator frame, and
     * returns the frame created for it and the URL that frame loads.
     */
    function startSimulatorExtension(options: pxsim.SimulatorDriverOptions = {}, grants: FrameGrants = {}): { url: URL, frame: FakeElement } {
        const { driver, container, mainFrame } = newDriver(options, grants);
        driver.postMessage(packet(), mainFrame.contentWindow as unknown as Window);

        const frames = container.getElementsByTagName("iframe");
        chai.expect(frames.length).equals(2);
        return { url: new URL(frames[1].src), frame: frames[1] };
    }

    function sandboxOf(frame: FakeElement): string[] {
        return frame.getAttribute("sandbox").split(/\s+/);
    }

    function allowOf(frame: FakeElement): string[] {
        return frame.getAttribute("allow").split(";").map(f => f.trim());
    }

    it("gives a simulator extension frame the main frame's sandbox and permissions when its registration grants nothing", () => {
        const { frame } = startSimulatorExtension();

        chai.expect(frame.getAttribute("sandbox")).equals(SIM_SANDBOX);
        chai.expect(frame.getAttribute("allow")).equals(SIM_ALLOW);
    });

    it("gives a simulator extension frame registered with every grant all of them", () => {
        const { frame } = startSimulatorExtension({}, {
            allowPopups: true, allowClipboard: true, allowCamera: true, allowMidi: true, allowUsb: true,
            allowSerial: true, allowBluetooth: true, allowHid: true, allowMotionSensors: true, allowDisplayCapture: true, allowGamepad: true,
            allowDownloads: true, allowPointerLock: true,
        });

        chai.expect(sandboxOf(frame)).to.have.members(["allow-same-origin", "allow-scripts", "allow-popups", "allow-popups-to-escape-sandbox", "allow-downloads", "allow-pointer-lock"]);
        chai.expect(allowOf(frame)).to.have.members([
            "autoplay", "microphone", "clipboard-read", "clipboard-write", "camera", "midi", "usb", "serial", "bluetooth", "hid",
            "accelerometer", "gyroscope", "magnetometer", "display-capture", "gamepad",
        ]);
    });

    it("keeps the main simulator frame's sandbox and permissions, whatever the extensions' grants", () => {
        const container = new FakeElement("div");
        const driver = new pxsim.SimulatorDriver(container as unknown as HTMLElement, {
            simUrl: SIM_URL,
            simulatorExtensions: {
                [KEY]: { index: "index.html", aspectRatio: 1, permanent: true, allowPopups: true, allowClipboard: true, allowCamera: true, allowDownloads: true },
            },
        });
        driver.preload(1);

        const frames = container.getElementsByTagName("iframe");
        chai.expect(frames.length).equals(1);
        chai.expect(frames[0].dataset["messagechannel"]).equals(undefined);
        chai.expect(frames[0].getAttribute("sandbox")).equals(SIM_SANDBOX);
        chai.expect(frames[0].getAttribute("allow")).equals(SIM_ALLOW);
    });
});

describe("simulator driver simulator extension editor tabs", () => {
    const KEY = "someorg/pxt-ext";
    const TAB = { editor: { index: "editor/index.html", label: "Ext" }, allowEditorTab: true };

    type Registration = pxsim.SimulatorDriverOptions["simulatorExtensions"][string];

    interface Harness {
        driver: pxsim.SimulatorDriver;
        // the frames in the simulator container, the main simulator frame first
        frames: FakeFrame[];
        mainFrame: FakeFrame;
        registrations: pxt.Map<Registration>;
    }

    function harness(registrations: pxt.Map<Registration>, options: pxsim.SimulatorDriverOptions = {}): Harness {
        const mainFrame = staticFrame("sim-frame-1");
        const frames: FakeFrame[] = [mainFrame];
        const container = {
            getElementsByTagName: () => frames,
            appendChild: (wrapper: FakeElement) => frames.push(wrapper.firstElementChild),
            classList: new FakeElement("div").classList,
        } as unknown as HTMLElement;
        const driver = new pxsim.SimulatorDriver(container, {
            simUrl: SIM_URL,
            simulatorExtensions: registrations,
            ...options,
        });
        // installs the driver's listener on the editor's window; the main frame already exists
        driver.preload(1);
        return { driver, frames, mainFrame, registrations };
    }

    function registration(extra: Registration = {}): Registration {
        return { index: "index.html", aspectRatio: 1, permanent: true, ...extra };
    }

    // a tab frame of `key`, as the editor creates and records one
    function tabFrame(h: Harness, key: string): FakeFrame {
        const frame: FakeFrame = { id: "", dataset: { simxkey: key, simxrole: "editor", origin: SIM_ORIGIN }, contentWindow: new FakeWindow() };
        h.driver.addEditorTabFrame(key, frame as unknown as HTMLIFrameElement);
        return frame;
    }

    function receive(h: Harness, msg: any, source: FakeWindow, origin = SIM_ORIGIN) {
        dispatchMessage(msg, source, origin);
    }

    function packet(h: Harness) {
        h.driver.postMessage({ type: "messagepacket", channel: KEY, broadcast: true, data: new Uint8Array(0) } as pxsim.SimulatorMessage, h.mainFrame.contentWindow as unknown as Window);
    }

    function simulatorFrameUrl(h: Harness): URL {
        packet(h);
        chai.expect(h.frames.length).equals(2);
        return new URL((h.frames[1] as FakeElement).src);
    }

    describe("registration", () => {
        it("offers no tab, and adds no editor=1, when the registration lacks the descriptor or the grant", () => {
            for (const extra of [{ editor: TAB.editor }, { allowEditorTab: true }, {}]) {
                let h: Harness;
                loggedErrors(() => h = harness({ [KEY]: registration(extra) }));
                chai.expect(h.registrations[KEY].editorUrl).equals(undefined);
                chai.expect(simulatorFrameUrl(h).searchParams.has("editor")).equals(false);
            }
        });
    });

    describe("the tab frame", () => {
        const files = { type: "projfs", id: "1", subtype: "list" };
        const assets = { type: "projassets", id: "2", subtype: "list", kind: "image" };

        it("passes the projfs and projassets gates under its registration's grants, with the key it is tagged with", () => {
            const delivered: [string, string][] = [];
            const h = harness({ [KEY]: registration({ ...TAB, allowFileWrite: true, allowAssetRead: true }) }, {
                onProjfsMessage: key => delivered.push(["projfs", key]),
                onProjassetsMessage: key => delivered.push(["projassets", key]),
            });
            const tab = tabFrame(h, KEY);
            receive(h, files, tab.contentWindow);
            receive(h, assets, tab.contentWindow);
            chai.expect(delivered).deep.equals([["projfs", KEY], ["projassets", KEY]]);
        });

        it("is refused by a gate whose grant its registration lacks", () => {
            let delivered = 0;
            const h = harness({ [KEY]: registration(TAB) }, {
                onProjfsMessage: () => delivered++,
                onProjassetsMessage: () => delivered++,
            });
            const tab = tabFrame(h, KEY);
            receive(h, files, tab.contentWindow);
            receive(h, assets, tab.contentWindow);
            chai.expect(delivered).equals(0);
            chai.expect(refusals(tab)).deep.equals([
                { type: "projfs", id: "1", subtype: "error", code: "PERMISSION_DENIED" },
                { type: "projassets", id: "2", subtype: "error", code: "PERMISSION_DENIED" },
            ]);
        });

        it("receives no simulator broadcasts", () => {
            const h = harness({ [KEY]: registration(TAB) });
            const tab = tabFrame(h, KEY);
            packet(h);
            h.driver.postMessage({ type: "stop", source: "pxtdriver" } as pxsim.SimulatorMessage);
            chai.expect(h.frames[1].contentWindow.messages.length).equals(2);
            chai.expect(tab.contentWindow.messages).deep.equals([]);
        });

        it("is dropped when it posts from an origin the editor does not allow, refused as unregistered from another allowed origin, and served from its own", () => {
            const delivered: string[] = [];
            const h = harness({ [KEY]: registration({ ...TAB, allowFileWrite: true }) }, { onProjfsMessage: key => delivered.push(key) });
            const tab = tabFrame(h, KEY);
            receive(h, files, tab.contentWindow, "https://elsewhere.example");
            chai.expect(tab.contentWindow.posts).deep.equals([]);
            receive(h, files, tab.contentWindow, EDITOR_ORIGIN);
            chai.expect(refusals(tab)).deep.equals([{ type: "projfs", id: "1", subtype: "error", code: "UNREGISTERED" }]);
            chai.expect(delivered).deep.equals([]);
            receive(h, files, tab.contentWindow, tab.dataset["origin"]);
            chai.expect(delivered).deep.equals([KEY]);
        });
    });

    describe("the open request", () => {
        const open = { type: "simxeditor", subtype: "open", id: "7" };

        it("reaches the handler, with the key, from the simulator frame of a registration that declares and enables a tab", () => {
            const opened: string[] = [];
            const h = harness({ [KEY]: registration(TAB) }, {
                onSimxEditorMessage: (key, msg, reply) => {
                    opened.push(key);
                    reply({ type: "simxeditor", id: (msg as any).id, subtype: "ack" } as pxsim.SimulatorMessage);
                },
            });
            packet(h);
            const simulatorFrame = h.frames[1];
            receive(h, open, simulatorFrame.contentWindow);
            chai.expect(opened).deep.equals([KEY]);
            chai.expect(simulatorFrame.contentWindow.messages.slice(-1)).deep.equals([{ type: "simxeditor", id: "7", subtype: "ack" }]);
            chai.expect(h.mainFrame.contentWindow.messages).deep.equals([]);
        });

        it("is refused with PERMISSION_DENIED when the registration does not declare and enable a tab", () => {
            for (const extra of [{ allowEditorTab: true }, { editor: TAB.editor }, { ...TAB, permanent: false }, { editor: { index: "", label: "Ext" }, allowEditorTab: true }]) {
                let h: Harness;
                loggedErrors(() => h = harness({ [KEY]: registration(extra) }, { onSimxEditorMessage: () => chai.assert.fail("delivered") }));
                packet(h);
                const simulatorFrame = h.frames[1];
                simulatorFrame.contentWindow.posts = [];
                receive(h, open, simulatorFrame.contentWindow);
                chai.expect(refusals(simulatorFrame)).deep.equals([{ type: "simxeditor", id: "7", subtype: "error", code: "PERMISSION_DENIED" }]);
            }
        });
    });
});

describe("simulator driver hide and unhide", () => {
    const HIDDEN = "simHidden";
    const PERMANENT_CHANNEL = "someorg/pxt-ext";
    const TRANSIENT_CHANNEL = "someorg/pxt-transient";

    let container: FakeElement;
    let mainWrapper: FakeElement;
    let permanentWrapper: FakeElement;
    let transientWrapper: FakeElement;
    let completions: number;
    /** The completions of the exit animations the host has started, in start order. */
    let animations: (() => void)[];
    let driver: pxsim.SimulatorDriver;

    /**
     * Adds a frame wrapper to the container shaped as the driver builds one:
     * the iframe, then the play icon and the loader.
     */
    function simframe(id: string, channel?: string, permanent?: boolean): FakeElement {
        const wrapper = new FakeElement("div");
        wrapper.className = "simframe ui embed";
        const frame = new FakeElement("iframe");
        frame.id = id;
        frame.dataset = { origin: EDITOR_ORIGIN, runid: "" };
        if (channel) frame.dataset["messagechannel"] = channel;
        if (permanent) frame.dataset["permanent"] = "true";
        wrapper.appendChild(frame);
        wrapper.appendChild(new FakeElement("i"));
        wrapper.appendChild(new FakeElement("div"));
        container.appendChild(wrapper);
        return wrapper;
    }

    function iframe(wrapper: FakeElement): FakeElement {
        return wrapper.firstElementChild;
    }

    /** The ids of the frames in the container, in order. */
    function frameIds(): string[] {
        return container.children.map(wrapper => iframe(wrapper).id);
    }

    function complete() {
        completions++;
    }

    /** Ends every exit animation the host has started, applying each completion in start order. */
    function finishAnimations() {
        const finishing = animations;
        animations = [];
        finishing.forEach(finish => finish());
    }

    /**
     * Creates the driver under test. Its host plays an exit animation in
     * `removeElement` and `hideElement`: the removal or the hidden class, and
     * the complete handler, apply when `finishAnimations()` ends it.
     */
    function createDriver(withHideElement: boolean) {
        const simx = (permanent: boolean) => ({ index: "index.html", aspectRatio: 1, permanent });
        driver = new pxsim.SimulatorDriver(container as unknown as HTMLElement, {
            simUrl: EDITOR_ORIGIN + "/sim/simulator.html",
            simulatorExtensions: {
                [PERMANENT_CHANNEL]: simx(true),
                [TRANSIENT_CHANNEL]: simx(false),
            },
            removeElement: (el, onComplete) => {
                animations.push(() => {
                    if (onComplete) onComplete();
                    pxsim.U.remove(el);
                });
            },
            hideElement: withHideElement
                ? (el, onComplete) => {
                    animations.push(() => {
                        pxsim.U.addClass(el, HIDDEN);
                        if (onComplete) onComplete();
                    });
                }
                : undefined,
            unhideElement: el => pxsim.U.removeClass(el, HIDDEN),
        });
    }

    beforeEach(() => {
        container = new FakeElement("div");
        mainWrapper = simframe("sim-frame-1");
        permanentWrapper = simframe("sim-frame-2", PERMANENT_CHANNEL, true);
        transientWrapper = simframe("sim-frame-3", TRANSIENT_CHANNEL);
        completions = 0;
        animations = [];
        createDriver(true);
    });

    afterEach(() => {
        // cancels the frame cleanup timer that hide() and run() schedule
        (driver as any).unload();
    });

    it("hides a permanent simulator extension frame in place", () => {
        driver.hide(complete);
        finishAnimations();
        chai.expect(frameIds()).deep.equals(["sim-frame-2"]);
        chai.expect(container.children[0]).equals(permanentWrapper);
        chai.expect(pxsim.U.containsClass(permanentWrapper as unknown as HTMLElement, HIDDEN)).equals(true);
        chai.expect(iframe(permanentWrapper).id).equals("sim-frame-2");
        chai.expect(iframe(permanentWrapper).dataset["messagechannel"]).equals(PERMANENT_CHANNEL);
    });

    it("removes the main frame and non-permanent frames on hide", () => {
        driver.hide(complete);
        finishAnimations();
        chai.expect(mainWrapper.parentElement).equals(undefined);
        chai.expect(transientWrapper.parentElement).equals(undefined);
    });

    it("completes the hide for hidden and removed frames", () => {
        driver.hide(complete);
        finishAnimations();
        chai.expect(completions).equals(3);
        driver.hide(complete);
        finishAnimations();
        chai.expect(completions).equals(4);
    });

    it("reveals the same permanent frame on unhide", () => {
        const frame = iframe(permanentWrapper);
        driver.hide();
        finishAnimations();
        driver.unhide();
        chai.expect(container.children.length).equals(1);
        chai.expect(container.children[0]).equals(permanentWrapper);
        chai.expect(pxsim.U.containsClass(permanentWrapper as unknown as HTMLElement, HIDDEN)).equals(false);
        chai.expect(iframe(permanentWrapper)).equals(frame);
        chai.expect(frame.id).equals("sim-frame-2");
    });

    it("starts a run after hide with a new main frame ahead of the hidden permanent frame", () => {
        driver.hide();
        finishAnimations();
        driver.run("");
        chai.expect(container.children.length).equals(2);
        chai.expect(container.children[0]).not.equals(mainWrapper);
        chai.expect(iframe(container.children[0]).dataset["messagechannel"]).equals(undefined);
        chai.expect(container.children[1]).equals(permanentWrapper);
    });

    it("posts a run's channel packets to the hidden permanent frame instead of spawning another", () => {
        driver.hide();
        finishAnimations();
        driver.run("");
        const main = iframe(container.children[0]);
        iframe(permanentWrapper).contentWindow.posts = [];
        const packet = { type: "messagepacket", channel: PERMANENT_CHANNEL, broadcast: true } as pxsim.SimulatorMessage;
        (driver as any).handleMessage(packet, main.contentWindow);
        chai.expect(container.children.length).equals(2);
        chai.expect(container.children[1]).equals(permanentWrapper);
        const received = iframe(permanentWrapper).contentWindow.messages.map(m => m.type);
        chai.expect(received).deep.equals(["run", "messagepacket"]);
    });

    it("removes permanent frames on hide when the host sets no hideElement", () => {
        createDriver(false);
        driver.hide(complete);
        finishAnimations();
        chai.expect(container.children.length).equals(0);
        chai.expect(completions).equals(3);
    });

    it("removes every frame on unload", () => {
        driver.stop(true);
        chai.expect(container.children.length).equals(0);
    });

    it("removes a hidden permanent frame on unload", () => {
        driver.hide();
        finishAnimations();
        driver.stop(true);
        chai.expect(container.children.length).equals(0);
    });

    it("preloads a main frame after hide ahead of the hidden permanent frame", () => {
        driver.hide();
        finishAnimations();
        driver.preload(1.5);
        chai.expect(container.children.length).equals(2);
        chai.expect(iframe(container.children[0]).dataset["messagechannel"]).equals(undefined);
        chai.expect(container.children[1]).equals(permanentWrapper);
        chai.expect(permanentWrapper.style["paddingBottom"]).equals(undefined);
        const main = container.children[0];
        driver.preload(1.5);
        chai.expect(container.children.length).equals(2);
        chai.expect(container.children[0]).equals(main);
    });

    it("keeps the main frame on frame cleanup when a permanent frame precedes it", () => {
        container.insertBefore(permanentWrapper, mainWrapper);
        driver.run("");
        driver.stop();
        (driver as any).cleanupFrames();
        finishAnimations();
        chai.expect(container.children).deep.equals([permanentWrapper, mainWrapper]);
        chai.expect(transientWrapper.parentElement).equals(undefined);
    });

    it("focuses the main frame when a permanent frame precedes it", () => {
        container.insertBefore(permanentWrapper, mainWrapper);
        const focused: string[] = [];
        [mainWrapper, permanentWrapper].forEach(wrapper => {
            const frame = iframe(wrapper);
            frame.focus = () => focused.push(frame.id);
        });
        driver.focus();
        chai.expect(focused).deep.equals(["sim-frame-1"]);
    });

    it("starts recording in the main frame when a permanent frame precedes it", () => {
        container.insertBefore(permanentWrapper, mainWrapper);
        driver.startRecording(100);
        const received = (wrapper: FakeElement) => iframe(wrapper).contentWindow.messages.map(m => m.type);
        chai.expect(received(mainWrapper)).deep.equals(["recorder"]);
        chai.expect(received(permanentWrapper)).deep.equals([]);
        chai.expect(received(transientWrapper)).deep.equals([]);
    });

    describe("jacdac packets", () => {
        const jacdacPacket = () => ({ type: "messagepacket", channel: "jacdac", broadcast: true }) as pxsim.SimulatorMessage;
        const received = (wrapper: FakeElement) => iframe(wrapper).contentWindow.messages.map(m => m.type);

        beforeEach(() => {
            container.insertBefore(permanentWrapper, mainWrapper);
        });

        it("broadcasts a jacdac packet from the main frame when a permanent frame precedes it", () => {
            (driver as any).handleMessage(jacdacPacket(), iframe(mainWrapper).contentWindow);
            chai.expect(received(permanentWrapper)).deep.equals(["messagepacket"]);
            chai.expect(received(transientWrapper)).deep.equals(["messagepacket"]);
            chai.expect(received(mainWrapper)).deep.equals([]);
            const packet = iframe(permanentWrapper).contentWindow.messages[0] as pxsim.SimulatorBroadcastMessage;
            chai.expect(packet.srcFrameIndex).equals(1);
        });

        it("delivers a jacdac packet to the main frame when a permanent frame precedes it", () => {
            (driver as any).handleMessage(jacdacPacket(), iframe(permanentWrapper).contentWindow);
            chai.expect(received(mainWrapper)).deep.equals(["messagepacket"]);
            chai.expect(received(transientWrapper)).deep.equals(["messagepacket"]);
            chai.expect(received(permanentWrapper)).deep.equals([]);
        });

        it("drops a jacdac packet from a second board frame", () => {
            const secondWrapper = simframe("sim-frame-4");
            (driver as any).handleMessage(jacdacPacket(), iframe(secondWrapper).contentWindow);
            [mainWrapper, permanentWrapper, transientWrapper, secondWrapper].forEach(wrapper =>
                chai.expect(received(wrapper)).deep.equals([]));
        });

        it("does not deliver a jacdac packet to a second board frame", () => {
            const secondWrapper = simframe("sim-frame-4");
            (driver as any).handleMessage(jacdacPacket(), iframe(permanentWrapper).contentWindow);
            chai.expect(received(mainWrapper)).deep.equals(["messagepacket"]);
            chai.expect(received(secondWrapper)).deep.equals([]);
        });
    });
});

describe("simulator driver hide-in-fullscreen classes", () => {
    const CONTAINER_CLASS = "has-simx-hide-fullscreen";
    const HIDDEN_CHANNEL = "someorg/pxt-strip";
    const OTHER_HIDDEN_CHANNEL = "someorg/pxt-overlay";
    const TRANSIENT_SHOWN_CHANNEL = "someorg/pxt-transient";

    let container: FakeElement;
    let mainFrame: FakeElement;
    let driver: pxsim.SimulatorDriver;
    // the removals the host's exit animation holds, each applied when called
    let removals: (() => void)[];

    function hasClass(el: FakeElement, cls: string): boolean {
        return pxsim.U.containsClass(el as unknown as HTMLElement, cls);
    }

    /** Sends a channel packet from the main frame, which spawns the channel's extension frame. */
    function spawn(channel: string): FakeElement {
        const packet = { type: "messagepacket", channel, broadcast: true } as pxsim.SimulatorMessage;
        dispatchMessage(packet, mainFrame.contentWindow);
        return container.getElementsByTagName("iframe")
            .find(frame => frame.dataset["messagechannel"] === channel)
            .parentElement;
    }

    beforeEach(() => {
        container = new FakeElement("div");
        const wrapper = container.appendChild(new FakeElement("div"));
        mainFrame = wrapper.appendChild(new FakeElement("iframe"));
        mainFrame.id = "sim-frame-1";
        mainFrame.dataset = { origin: SIM_ORIGIN, runid: "" };
        // the main frame's state icon and loader, which a change of the driver's state updates
        wrapper.appendChild(new FakeElement("div"));
        wrapper.appendChild(new FakeElement("div"));
        const simx = (hideInFullscreen?: boolean, permanent = true) => ({ index: "index.html", aspectRatio: 1, permanent, hideInFullscreen });
        removals = [];
        driver = new pxsim.SimulatorDriver(container as unknown as HTMLElement, {
            simUrl: SIM_URL,
            simulatorExtensions: {
                [HIDDEN_CHANNEL]: simx(true),
                [OTHER_HIDDEN_CHANNEL]: simx(true),
                [TRANSIENT_SHOWN_CHANNEL]: simx(false, false),
            },
            removeElement: el => removals.push(() => pxsim.U.remove(el)),
            hideElement: () => { },
        });
        // installs the driver's listener on the editor's window; the main frame already exists
        driver.preload(1);
    });

    it("keeps the container marked from the moment frame cleanup starts removing the shown extension frame beside a hidden one", () => {
        driver.run("");
        spawn(HIDDEN_CHANNEL);
        const transient = spawn(TRANSIENT_SHOWN_CHANNEL);
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(false);
        driver.stop();
        (driver as any).cleanupFrames();
        chai.expect(transient.parentElement).equals(container);
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(true);
        spawn(OTHER_HIDDEN_CHANNEL);
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(true);
        removals.forEach(remove => remove());
        chai.expect(transient.parentElement).equals(undefined);
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(true);
    });
});
