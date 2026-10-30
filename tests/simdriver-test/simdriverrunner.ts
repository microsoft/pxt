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

    /** Calls the listeners of `type`, as the browser does when the event fires. */
    fire(type: string) {
        (this.listeners[type] || []).forEach(listener => listener());
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
        reply: (msg: pxsim.SimulatorMessage) => void;
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
            onProjfsMessage: (key, msg, reply) => deliveries.push({ key, msg, reply }),
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

    it("delivers a request from a simulator extension frame with the frame's key", () => {
        receive(request, simxFrame.contentWindow);
        chai.expect(deliveries.map(d => d.key)).deep.equals(["someorg/pxt-ext"]);
        chai.expect(deliveries[0].msg).deep.equals(request);
    });

    it("passes the requesting frame, and posts its replies and notifications to that frame only, at the origin it was created with", () => {
        let reply: (msg: pxsim.SimulatorMessage) => void;
        let requester: HTMLIFrameElement;
        driver.options.onProjfsMessage = (key, msg, r, frame) => {
            reply = r;
            requester = frame;
        };
        receive({ type: "projfs", id: "1", subtype: "subscribe" } as pxsim.SimulatorMessage, simxFrame.contentWindow);
        chai.expect(requester).equals(simxFrame as unknown as HTMLIFrameElement);
        const ack = { type: "projfs", id: "1", subtype: "ack" } as pxsim.SimulatorMessage;
        const changed = { type: "projfs", subtype: "changed", names: ["a.txt"] } as pxsim.SimulatorMessage;
        reply(ack);
        reply(changed);
        const origin = simxFrame.dataset["origin"];
        chai.expect(simxFrame.contentWindow.posts).deep.equals([{ msg: ack, targetOrigin: origin }, { msg: changed, targetOrigin: origin }]);
        chai.expect(relayed()).equals(false);
    });

    it("takes the key from the frame, not the message", () => {
        receive({ ...request, channel: "otherorg/pxt-other" } as pxsim.SimulatorMessage, simxFrame.contentWindow);
        chai.expect(deliveries.map(d => d.key)).deep.equals(["someorg/pxt-ext"]);
    });

    it("posts replies to the requesting frame only, at the origin it was created with", () => {
        receive(request, simxFrame.contentWindow);
        const reply = { type: "projfs", id: "1", subtype: "files", files: [] } as pxsim.SimulatorMessage;
        deliveries[0].reply(reply);
        chai.expect(simxFrame.contentWindow.posts).deep.equals([{ msg: reply, targetOrigin: simxFrame.dataset["origin"] }]);
        chai.expect(relayed()).equals(false);
    });

    it("does not relay requests to other frames", () => {
        receive(request, simxFrame.contentWindow);
        chai.expect(relayed()).equals(false);
    });

    it("answers requests from the main simulator frame with UNREGISTERED, delivering nothing", () => {
        receive(request, mainFrame.contentWindow);
        chai.expect(deliveries).deep.equals([]);
        chai.expect(refusals(mainFrame)).deep.equals([{ type: "projfs", id: "1", subtype: "error", code: "UNREGISTERED" }]);
        chai.expect([simxFrame, otherSimxFrame, unofferedFrame].some(f => f.contentWindow.messages.length > 0)).equals(false);
    });

    it("answers requests from a frame whose extension is not offered with UNREGISTERED, delivering nothing", () => {
        receive(request, unofferedFrame.contentWindow);
        chai.expect(deliveries).deep.equals([]);
        chai.expect(refusals(unofferedFrame)).deep.equals([{ type: "projfs", id: "1", subtype: "error", code: "UNREGISTERED" }]);
        chai.expect([mainFrame, simxFrame, otherSimxFrame].some(f => f.contentWindow.messages.length > 0)).equals(false);
    });

    it("answers requests with UNREGISTERED when no handler serves them", () => {
        (driver as any).options.onProjfsMessage = undefined;
        receive({ type: "projfs", id: 7, subtype: "list" } as pxsim.SimulatorMessage, simxFrame.contentWindow);
        chai.expect(refusals(simxFrame)).deep.equals([{ type: "projfs", id: undefined, subtype: "error", code: "UNREGISTERED" }]);
        chai.expect(relayed()).equals(false);
    });

    it("drops requests from windows outside the simulator", () => {
        receive(request, new FakeWindow());
        chai.expect(deliveries).deep.equals([]);
        chai.expect(relayed()).equals(false);
        chai.expect(simxFrame.contentWindow.messages).deep.equals([]);
    });

    it("answers requests from a registered frame whose extension the open project does not include with UNREGISTERED, delivering nothing", () => {
        const included: string[] = [];
        (driver as any).options.isSimxInProject = (key: string) => {
            included.push(key);
            return key !== "otherorg/pxt-other";
        };
        receive(request, otherSimxFrame.contentWindow);
        receive(request, simxFrame.contentWindow);
        chai.expect(refusals(otherSimxFrame)).deep.equals([{ type: "projfs", id: "1", subtype: "error", code: "UNREGISTERED" }]);
        chai.expect(deliveries.map(d => d.key)).deep.equals(["someorg/pxt-ext"]);
        chai.expect(included).deep.equals(["otherorg/pxt-other", "someorg/pxt-ext"]);
    });

    it("answers requests from the main simulator frame with UNREGISTERED whatever the project includes", () => {
        (driver as any).options.isSimxInProject = () => true;
        receive(request, mainFrame.contentWindow);
        chai.expect(deliveries).deep.equals([]);
        chai.expect(refusals(mainFrame)).deep.equals([{ type: "projfs", id: "1", subtype: "error", code: "UNREGISTERED" }]);
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

    it("answers a request its handler throws on with FAILED", () => {
        (driver as any).options.onProjfsMessage = () => { throw new Error("handler failed"); };
        loggedErrors(() => receive(request, simxFrame.contentWindow));
        chai.expect(refusals(simxFrame)).deep.equals([{ type: "projfs", id: "1", subtype: "error", code: "FAILED" }]);
    });
});

describe("simulator driver projassets messages", () => {
    interface Delivery {
        key: string;
        msg: pxsim.SimulatorMessage;
    }

    const request = { type: "projassets", id: "1", subtype: "list", kind: "image" } as pxsim.SimulatorMessage;
    let mainFrame: FakeFrame;
    let grantedFrame: FakeFrame;
    let ungrantedFrame: FakeFrame;
    let unofferedFrame: FakeFrame;
    let filesOnlyFrame: FakeFrame;
    let bothFrame: FakeFrame;
    let assetDeliveries: Delivery[];
    let projfsDeliveries: Delivery[];
    let driver: pxsim.SimulatorDriver;

    function receive(msg: pxsim.SimulatorMessage, source: FakeWindow, origin = SIM_ORIGIN) {
        dispatchMessage(msg, source, origin);
    }

    beforeEach(() => {
        mainFrame = staticFrame("sim-frame-1");
        grantedFrame = staticFrame("sim-frame-2", "someorg/pxt-assets");
        ungrantedFrame = staticFrame("sim-frame-3", "someorg/pxt-ext");
        unofferedFrame = staticFrame("sim-frame-4", "someorg/pxt-removed");
        filesOnlyFrame = staticFrame("sim-frame-5", "someorg/pxt-files");
        bothFrame = staticFrame("sim-frame-6", "someorg/pxt-both");
        const frames = [mainFrame, grantedFrame, ungrantedFrame, unofferedFrame, filesOnlyFrame, bothFrame];
        const container = { getElementsByTagName: () => frames } as unknown as HTMLElement;
        const simx = () => ({ index: "index.html", aspectRatio: 1, permanent: true });
        assetDeliveries = [];
        projfsDeliveries = [];
        driver = new pxsim.SimulatorDriver(container, {
            simUrl: SIM_URL,
            simulatorExtensions: {
                "someorg/pxt-assets": { ...simx(), allowAssetRead: true },
                "someorg/pxt-ext": simx(),
                "someorg/pxt-files": { ...simx(), allowFileWrite: true },
                "someorg/pxt-both": { ...simx(), allowAssetRead: true, allowFileWrite: true },
            },
            onProjassetsMessage: (key, msg) => assetDeliveries.push({ key, msg }),
            onProjfsMessage: (key, msg) => projfsDeliveries.push({ key, msg }),
        });
        // installs the driver's listener on the editor's window; the frames already exist
        driver.preload(1);
    });

    it("delivers a request from a frame registered with allowAssetRead, with the frame's key", () => {
        receive(request, grantedFrame.contentWindow);
        chai.expect(assetDeliveries).deep.equals([{ key: "someorg/pxt-assets", msg: request }]);
        chai.expect(projfsDeliveries).deep.equals([]);
    });

    it("posts replies and notifications to the requesting frame only, at the origin it was created with", () => {
        let reply: (msg: pxsim.SimulatorMessage) => void;
        (driver as any).options.onProjassetsMessage = (key: string, msg: pxsim.SimulatorMessage, r: typeof reply) => reply = r;
        receive({ type: "projassets", id: "1", subtype: "subscribe" } as pxsim.SimulatorMessage, grantedFrame.contentWindow);
        const ack = { type: "projassets", id: "1", subtype: "ack" } as pxsim.SimulatorMessage;
        const changed = { type: "projassets", subtype: "changed" } as pxsim.SimulatorMessage;
        reply(ack);
        reply(changed);
        const origin = grantedFrame.dataset["origin"];
        chai.expect(grantedFrame.contentWindow.posts).deep.equals([{ msg: ack, targetOrigin: origin }, { msg: changed, targetOrigin: origin }]);
        chai.expect([mainFrame, ungrantedFrame, unofferedFrame].some(f => f.contentWindow.messages.length > 0)).equals(false);
    });

    it("answers requests from a registered frame without allowAssetRead with PERMISSION_DENIED, delivering nothing", () => {
        receive(request, ungrantedFrame.contentWindow);
        chai.expect(assetDeliveries).deep.equals([]);
        chai.expect(refusals(ungrantedFrame)).deep.equals([{ type: "projassets", id: "1", subtype: "error", code: "PERMISSION_DENIED" }]);
        chai.expect([mainFrame, grantedFrame, unofferedFrame].some(f => f.contentWindow.messages.length > 0)).equals(false);
    });

    it("answers requests from the main simulator frame and from unoffered extensions with UNREGISTERED", () => {
        receive(request, mainFrame.contentWindow);
        receive(request, unofferedFrame.contentWindow);
        chai.expect(assetDeliveries).deep.equals([]);
        for (const refused of [mainFrame, unofferedFrame])
            chai.expect(refusals(refused)).deep.equals([{ type: "projassets", id: "1", subtype: "error", code: "UNREGISTERED" }]);
    });

    it("answers requests with UNREGISTERED when no handler serves them", () => {
        (driver as any).options.onProjassetsMessage = undefined;
        receive(request, grantedFrame.contentWindow);
        chai.expect(refusals(grantedFrame)).deep.equals([{ type: "projassets", id: "1", subtype: "error", code: "UNREGISTERED" }]);
    });

    it("drops requests from windows outside the simulator", () => {
        receive(request, new FakeWindow());
        chai.expect(assetDeliveries).deep.equals([]);
        chai.expect([mainFrame, grantedFrame, ungrantedFrame, unofferedFrame].some(f => f.contentWindow.messages.length > 0)).equals(false);
    });

    it("gates projfs by allowFileWrite and projassets by allowAssetRead, each independent of the other", () => {
        const files = { type: "projfs", id: "2", subtype: "list" } as pxsim.SimulatorMessage;
        receive(files, filesOnlyFrame.contentWindow);
        receive(request, filesOnlyFrame.contentWindow);
        receive(files, grantedFrame.contentWindow);
        receive(request, grantedFrame.contentWindow);
        receive(files, bothFrame.contentWindow);
        receive(request, bothFrame.contentWindow);
        chai.expect(projfsDeliveries.map(d => d.key)).deep.equals(["someorg/pxt-files", "someorg/pxt-both"]);
        chai.expect(assetDeliveries.map(d => d.key)).deep.equals(["someorg/pxt-assets", "someorg/pxt-both"]);
        chai.expect(refusals(filesOnlyFrame)).deep.equals([{ type: "projassets", id: "1", subtype: "error", code: "PERMISSION_DENIED" }]);
        chai.expect(refusals(grantedFrame)).deep.equals([{ type: "projfs", id: "2", subtype: "error", code: "PERMISSION_DENIED" }]);
        chai.expect(bothFrame.contentWindow.messages).deep.equals([]);
    });

    it("answers a request its handler throws on with FAILED", () => {
        (driver as any).options.onProjassetsMessage = () => { throw new Error("handler failed"); };
        loggedErrors(() => receive(request, grantedFrame.contentWindow));
        chai.expect(refusals(grantedFrame)).deep.equals([{ type: "projassets", id: "1", subtype: "error", code: "FAILED" }]);
    });
});

describe("simulator driver projprogram messages", () => {
    interface Delivery {
        key: string;
        msg: pxsim.SimulatorMessage;
    }

    const request = { type: "projprogram", id: "1", subtype: "compile" } as pxsim.SimulatorMessage;
    const files = { type: "projfs", id: "2", subtype: "list" } as pxsim.SimulatorMessage;
    const assets = { type: "projassets", id: "3", subtype: "list", kind: "image" } as pxsim.SimulatorMessage;
    let mainFrame: FakeFrame;
    let programFrame: FakeFrame;
    let ungrantedFrame: FakeFrame;
    let othersFrame: FakeFrame;
    let programDeliveries: Delivery[];
    let projfsDeliveries: Delivery[];
    let assetDeliveries: Delivery[];
    let driver: pxsim.SimulatorDriver;

    function receive(msg: pxsim.SimulatorMessage, source: FakeWindow, origin = SIM_ORIGIN) {
        dispatchMessage(msg, source, origin);
    }

    beforeEach(() => {
        mainFrame = staticFrame("sim-frame-1");
        programFrame = staticFrame("sim-frame-2", "someorg/pxt-program");
        ungrantedFrame = staticFrame("sim-frame-3", "someorg/pxt-ext");
        othersFrame = staticFrame("sim-frame-4", "someorg/pxt-others");
        const frames = [mainFrame, programFrame, ungrantedFrame, othersFrame];
        const container = { getElementsByTagName: () => frames } as unknown as HTMLElement;
        const simx = () => ({ index: "index.html", aspectRatio: 1, permanent: true });
        programDeliveries = [];
        projfsDeliveries = [];
        assetDeliveries = [];
        driver = new pxsim.SimulatorDriver(container, {
            simUrl: SIM_URL,
            simulatorExtensions: {
                "someorg/pxt-program": { ...simx(), allowProgramRead: true },
                "someorg/pxt-ext": simx(),
                "someorg/pxt-others": { ...simx(), allowFileWrite: true, allowAssetRead: true },
                "someorg/pxt-tab": { ...simx(), editor: { index: "editor/index.html" }, allowEditorTab: true, allowProgramRead: true },
            },
            onProjprogramMessage: (key, msg) => programDeliveries.push({ key, msg }),
            onProjfsMessage: (key, msg) => projfsDeliveries.push({ key, msg }),
            onProjassetsMessage: (key, msg) => assetDeliveries.push({ key, msg }),
        });
        // installs the driver's listener on the editor's window; the frames already exist
        driver.preload(1);
    });

    it("delivers a request from a frame registered with allowProgramRead, with the frame's key", () => {
        receive(request, programFrame.contentWindow);
        chai.expect(programDeliveries).deep.equals([{ key: "someorg/pxt-program", msg: request }]);
        chai.expect(projfsDeliveries).deep.equals([]);
        chai.expect(assetDeliveries).deep.equals([]);
    });

    it("posts replies to the requesting frame only, at the origin it was created with", () => {
        let reply: (msg: pxsim.SimulatorMessage) => void;
        (driver as any).options.onProjprogramMessage = (key: string, msg: pxsim.SimulatorMessage, r: typeof reply) => reply = r;
        receive(request, programFrame.contentWindow);
        const program = { type: "projprogram", id: "1", subtype: "program", code: "", options: {} } as pxsim.SimulatorMessage;
        reply(program);
        chai.expect(programFrame.contentWindow.posts).deep.equals([{ msg: program, targetOrigin: programFrame.dataset["origin"] }]);
        chai.expect([mainFrame, ungrantedFrame, othersFrame].some(f => f.contentWindow.messages.length > 0)).equals(false);
    });

    it("answers requests from a registered frame without allowProgramRead with PERMISSION_DENIED, delivering nothing", () => {
        receive(request, ungrantedFrame.contentWindow);
        chai.expect(programDeliveries).deep.equals([]);
        chai.expect(refusals(ungrantedFrame)).deep.equals([{ type: "projprogram", id: "1", subtype: "error", code: "PERMISSION_DENIED" }]);
        chai.expect([mainFrame, programFrame, othersFrame].some(f => f.contentWindow.messages.length > 0)).equals(false);
    });

    it("answers requests from the main simulator frame with UNREGISTERED", () => {
        receive(request, mainFrame.contentWindow);
        chai.expect(programDeliveries).deep.equals([]);
        chai.expect(refusals(mainFrame)).deep.equals([{ type: "projprogram", id: "1", subtype: "error", code: "UNREGISTERED" }]);
    });

    it("gates projprogram by allowProgramRead alone, independent of allowFileWrite and allowAssetRead", () => {
        for (const msg of [request, files, assets]) {
            receive(msg, programFrame.contentWindow);
            receive(msg, othersFrame.contentWindow);
        }
        chai.expect(programDeliveries.map(d => d.key)).deep.equals(["someorg/pxt-program"]);
        chai.expect(projfsDeliveries.map(d => d.key)).deep.equals(["someorg/pxt-others"]);
        chai.expect(assetDeliveries.map(d => d.key)).deep.equals(["someorg/pxt-others"]);
        chai.expect(refusals(othersFrame)).deep.equals([{ type: "projprogram", id: "1", subtype: "error", code: "PERMISSION_DENIED" }]);
        chai.expect(refusals(programFrame)).deep.equals([
            { type: "projfs", id: "2", subtype: "error", code: "PERMISSION_DENIED" },
            { type: "projassets", id: "3", subtype: "error", code: "PERMISSION_DENIED" },
        ]);
    });

    it("delivers a request from an editor tab frame under its registration's grant, with the key it was recorded with", () => {
        const tab: FakeFrame = { id: "", dataset: { origin: SIM_ORIGIN }, contentWindow: new FakeWindow() };
        driver.addEditorTabFrame("someorg/pxt-tab", tab as unknown as HTMLIFrameElement);
        receive(request, tab.contentWindow);
        chai.expect(programDeliveries).deep.equals([{ key: "someorg/pxt-tab", msg: request }]);
        chai.expect(tab.contentWindow.messages).deep.equals([]);
    });

    it("answers a request its handler throws on with FAILED", () => {
        (driver as any).options.onProjprogramMessage = () => { throw new Error("handler failed"); };
        loggedErrors(() => receive(request, programFrame.contentWindow));
        chai.expect(refusals(programFrame)).deep.equals([{ type: "projprogram", id: "1", subtype: "error", code: "FAILED" }]);
    });
});

describe("simulator extension frame URLs", () => {
    /** Returns the names of the parameters `url` carries, sorted. */
    function parameterNames(url: URL): string[] {
        const names: string[] = [];
        url.searchParams.forEach((value, name) => names.push(name));
        return names.sort();
    }

    it("sets exactly the parameters every frame carries, the optional ones only when given, keeping the page's own", () => {
        const page = SIM_ORIGIN + "/ext/index.html?own=1";
        const url = pxsim.simxFrameUrl({ url: page, key: "someorg/pxt-ext", parentOrigin: EDITOR_ORIGIN, language: "fr", target: "arcade", project: "p1" });
        chai.expect(url.origin + url.pathname).equals(SIM_ORIGIN + "/ext/index.html");
        chai.expect(parameterNames(url)).deep.equals(["apiLevel", "channel", "language", "own", "parentOrigin", "project", "target"]);
        chai.expect(url.searchParams.get("own")).equals("1");
        chai.expect(url.searchParams.get("parentOrigin")).equals(EDITOR_ORIGIN);
        chai.expect(url.searchParams.get("channel")).equals("someorg/pxt-ext");
        chai.expect(url.searchParams.get("apiLevel")).equals(pxsim.SIMX_API_LEVEL.toString());
        chai.expect(url.searchParams.get("language")).equals("fr");
        chai.expect(url.searchParams.get("target")).equals("arcade");
        chai.expect(url.searchParams.get("project")).equals("p1");

        const bare = pxsim.simxFrameUrl({ url: page, key: "someorg/pxt-ext", parentOrigin: EDITOR_ORIGIN });
        chai.expect(parameterNames(bare)).deep.equals(["apiLevel", "channel", "own", "parentOrigin"]);
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

    it("passes the frame's key to the frame in its URL, beside the editor's origin as the parent origin", () => {
        const { url, frame } = startSimulatorExtension();

        chai.expect(url.origin).equals(SIM_ORIGIN);
        chai.expect(url.searchParams.get("channel")).equals(KEY);
        chai.expect(url.searchParams.get("parentOrigin")).equals(EDITOR_ORIGIN);
        chai.expect(frame.dataset["messagechannel"]).equals(url.searchParams.get("channel"));
    });

    it("passes the simulator-extension API level the editor serves to the frame in its URL", () => {
        chai.expect(startSimulatorExtension().url.searchParams.get("apiLevel")).equals(pxsim.SIMX_API_LEVEL.toString());
    });

    it("passes the running target's id to the frame in its URL when the driver is given one", () => {
        chai.expect(startSimulatorExtension({ targetId: "microbit" }).url.searchParams.get("target")).equals("microbit");
        chai.expect(startSimulatorExtension().url.searchParams.has("target")).equals(false);
    });

    it("passes the open project's id to the frame in its URL, beside the other parameters", () => {
        const { url } = startSimulatorExtension({ targetId: "microbit", getProjectId: () => "3b1f7c2e-project" });

        chai.expect(url.searchParams.get("project")).equals("3b1f7c2e-project");
        chai.expect(url.searchParams.get("channel")).equals(KEY);
        chai.expect(url.searchParams.get("parentOrigin")).equals(EDITOR_ORIGIN);
        chai.expect(url.searchParams.get("target")).equals("microbit");
    });

    it("reads the project's id each time it creates the frame", () => {
        let projectId = "first-project";
        const { driver } = newDriver({ getProjectId: () => projectId });
        const first = driver.startSimulatorExtension(KEY) as unknown as FakeElement;
        chai.expect(new URL(first.src).searchParams.get("project")).equals("first-project");

        driver.stop(true);
        projectId = "second-project";
        const second = driver.startSimulatorExtension(KEY) as unknown as FakeElement;
        chai.expect(second).not.equals(first);
        chai.expect(new URL(second.src).searchParams.get("project")).equals("second-project");
    });

    it("omits the project's id when no project is open or the driver cannot tell", () => {
        const noProject = startSimulatorExtension({ targetId: "microbit", getProjectId: () => undefined }).url;
        chai.expect(noProject.searchParams.has("project")).equals(false);
        chai.expect(noProject.searchParams.get("channel")).equals(KEY);
        chai.expect(noProject.searchParams.get("target")).equals("microbit");
        chai.expect(startSimulatorExtension().url.searchParams.has("project")).equals(false);
    });

    it("starts an extension frame spawned during a run with that run, posted to the frame's origin", () => {
        const container = new FakeElement("div");
        const driver = new pxsim.SimulatorDriver(container as unknown as HTMLElement, {
            simUrl: SIM_URL,
            simulatorExtensions: { [KEY]: { index: "index.html", aspectRatio: 1, permanent: true } },
        });
        driver.run("", {});
        try {
            const [mainFrame] = container.getElementsByTagName("iframe");
            dispatchMessage(packet(), mainFrame.contentWindow);
            const frame = container.getElementsByTagName("iframe").find(f => f.dataset["messagechannel"] === KEY);
            const runs = (f: FakeElement) => f.contentWindow.posts.filter(p => p.msg.type === "run");
            chai.expect(runs(frame).map(p => p.targetOrigin)).deep.equals([frame.dataset["origin"]]);
            chai.expect(runs(mainFrame).length).equals(1);
        } finally {
            driver.stop(true);
        }
    });

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

    it("lets a simulator extension frame registered with allowPopups open popups that escape its sandbox", () => {
        const { frame } = startSimulatorExtension({}, { allowPopups: true });

        chai.expect(sandboxOf(frame)).to.have.members(["allow-same-origin", "allow-scripts", "allow-popups", "allow-popups-to-escape-sandbox"]);
        chai.expect(frame.getAttribute("allow")).equals(SIM_ALLOW);
    });

    it("lets a simulator extension frame registered with allowClipboard read and write the clipboard", () => {
        const { frame } = startSimulatorExtension({}, { allowClipboard: true });

        chai.expect(allowOf(frame)).to.have.members(["autoplay", "microphone", "clipboard-read", "clipboard-write"]);
        chai.expect(frame.getAttribute("sandbox")).equals(SIM_SANDBOX);
    });

    it("delegates the camera to a simulator extension frame registered with allowCamera", () => {
        const { frame } = startSimulatorExtension({}, { allowCamera: true });

        chai.expect(allowOf(frame)).to.have.members(["autoplay", "microphone", "camera"]);
        chai.expect(frame.getAttribute("sandbox")).equals(SIM_SANDBOX);
    });

    it("delegates MIDI to a simulator extension frame registered with allowMidi", () => {
        const { frame } = startSimulatorExtension({}, { allowMidi: true });

        chai.expect(allowOf(frame)).to.have.members(["autoplay", "microphone", "midi"]);
        chai.expect(frame.getAttribute("sandbox")).equals(SIM_SANDBOX);
    });

    it("delegates USB devices to a simulator extension frame registered with allowUsb", () => {
        const { frame } = startSimulatorExtension({}, { allowUsb: true });

        chai.expect(allowOf(frame)).to.have.members(["autoplay", "microphone", "usb"]);
        chai.expect(frame.getAttribute("sandbox")).equals(SIM_SANDBOX);
    });

    it("delegates serial ports to a simulator extension frame registered with allowSerial", () => {
        const { frame } = startSimulatorExtension({}, { allowSerial: true });

        chai.expect(allowOf(frame)).to.have.members(["autoplay", "microphone", "serial"]);
        chai.expect(frame.getAttribute("sandbox")).equals(SIM_SANDBOX);
    });

    it("delegates Bluetooth devices to a simulator extension frame registered with allowBluetooth", () => {
        const { frame } = startSimulatorExtension({}, { allowBluetooth: true });

        chai.expect(allowOf(frame)).to.have.members(["autoplay", "microphone", "bluetooth"]);
        chai.expect(frame.getAttribute("sandbox")).equals(SIM_SANDBOX);
    });

    it("delegates HID devices to a simulator extension frame registered with allowHid", () => {
        const { frame } = startSimulatorExtension({}, { allowHid: true });

        chai.expect(allowOf(frame)).to.have.members(["autoplay", "microphone", "hid"]);
        chai.expect(frame.getAttribute("sandbox")).equals(SIM_SANDBOX);
    });

    it("delegates the motion sensors to a simulator extension frame registered with allowMotionSensors", () => {
        const { frame } = startSimulatorExtension({}, { allowMotionSensors: true });

        chai.expect(allowOf(frame)).to.have.members(["autoplay", "microphone", "accelerometer", "gyroscope", "magnetometer"]);
        chai.expect(frame.getAttribute("sandbox")).equals(SIM_SANDBOX);
    });

    it("lets a simulator extension frame registered with allowDisplayCapture capture the screen", () => {
        const { frame } = startSimulatorExtension({}, { allowDisplayCapture: true });

        chai.expect(allowOf(frame)).to.have.members(["autoplay", "microphone", "display-capture"]);
        chai.expect(frame.getAttribute("sandbox")).equals(SIM_SANDBOX);
    });

    it("delegates gamepads to a simulator extension frame registered with allowGamepad", () => {
        const { frame } = startSimulatorExtension({}, { allowGamepad: true });

        chai.expect(allowOf(frame)).to.have.members(["autoplay", "microphone", "gamepad"]);
        chai.expect(frame.getAttribute("sandbox")).equals(SIM_SANDBOX);
    });

    it("lets a simulator extension frame registered with allowDownloads start downloads", () => {
        const { frame } = startSimulatorExtension({}, { allowDownloads: true });

        chai.expect(sandboxOf(frame)).to.have.members(["allow-same-origin", "allow-scripts", "allow-downloads"]);
        chai.expect(frame.getAttribute("allow")).equals(SIM_ALLOW);
    });

    it("lets a simulator extension frame registered with allowPointerLock lock the pointer", () => {
        const { frame } = startSimulatorExtension({}, { allowPointerLock: true });

        chai.expect(sandboxOf(frame)).to.have.members(["allow-same-origin", "allow-scripts", "allow-pointer-lock"]);
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
        it("resolves the tab's page, and an icon that is a path, as it resolves the extension's index", () => {
            const h = harness({
                [KEY]: registration({ index: "simx/index.html", editor: { index: "index.html", label: "Ext", icon: "brand/icon.svg" }, allowEditorTab: true }),
                "otherorg/pxt-other": registration({ editor: { index: "index.html", label: "Other", icon: "icon.svg" }, allowEditorTab: true }),
            });
            const simx = h.registrations[KEY];
            chai.expect(simx.url).equals(`${SIM_ORIGIN}/simx/${KEY}/-/simx/index.html`);
            chai.expect(simx.editorUrl).equals(`${SIM_ORIGIN}/simx/${KEY}/-/index.html`);
            chai.expect(simx.iconUrl).equals(`${SIM_ORIGIN}/simx/${KEY}/-/brand/icon.svg`);
            chai.expect(h.registrations["otherorg/pxt-other"].iconUrl).equals(`${SIM_ORIGIN}/simx/otherorg/pxt-other/-/icon.svg`);
        });

        it("resolves an icon that is a path against the dev URL under simxdev, as it resolves the tab's page", () => {
            const location = (global as any).window.location;
            const href = location.href;
            location.href = "http://localhost:3232/index.html?simxdev";
            try {
                const h = harness({ [KEY]: registration({ devUrl: "http://localhost:8080/ext/", editor: { index: "index.html", label: "Ext", icon: "brand/icon.svg" }, allowEditorTab: true }) });
                chai.expect(h.registrations[KEY].editorUrl).equals("http://localhost:8080/ext/index.html");
                chai.expect(h.registrations[KEY].iconUrl).equals("http://localhost:8080/ext/brand/icon.svg");
            } finally {
                location.href = href;
            }
        });

        it("leaves an icon of class names unresolved", () => {
            const h = harness({ [KEY]: registration({ editor: { index: "index.html", label: "Ext", icon: "xicon js" }, allowEditorTab: true }) });
            chai.expect(h.registrations[KEY].editor.icon).equals("xicon js");
            chai.expect(h.registrations[KEY].iconUrl).equals(undefined);
        });

        it("serves a tab whatever its label is, and with none", () => {
            const labels: (string | pxt.Map<string>)[] = ["Ext", { "en": "en", "fr": "fr" }, { "en": "" }, {}, "", undefined];
            const registrations: pxt.Map<Registration> = {};
            const urls: string[] = [];
            labels.forEach((label, i) => {
                const key = `org${i}/pxt-ext`;
                registrations[key] = registration({ editor: { index: "index.html", label }, allowEditorTab: true });
                urls.push(`${SIM_ORIGIN}/simx/${key}/-/index.html`);
            });
            let h: Harness;
            chai.expect(loggedErrors(() => h = harness(registrations))).deep.equals([]);
            chai.expect(Object.keys(registrations).map(key => h.registrations[key].editorUrl)).deep.equals(urls);
        });

        it("carries the types the tab creates beside its page, and none for a registration it serves no tab for", () => {
            const creates = ["ext.Thing", "ext.Other"];
            let h: Harness;
            loggedErrors(() => h = harness({
                [KEY]: registration({ editor: { ...TAB.editor, creates }, allowEditorTab: true }),
                "otherorg/pxt-other": registration({ editor: { ...TAB.editor, creates } }),
                "thirdorg/pxt-third": registration({ editor: { ...TAB.editor, creates }, allowEditorTab: true, permanent: false }),
                "fourthorg/pxt-fourth": registration(TAB),
            }));
            chai.expect(h.registrations[KEY].creates).deep.equals(creates);
            chai.expect(["otherorg/pxt-other", "thirdorg/pxt-third", "fourthorg/pxt-fourth"].map(key => h.registrations[key].creates))
                .deep.equals([undefined, undefined, undefined]);
        });

        it("adds editor=1 to the simulator frame's URL when the registration declares and enables a tab", () => {
            chai.expect(simulatorFrameUrl(harness({ [KEY]: registration(TAB) })).searchParams.get("editor")).equals("1");
        });

        it("offers no tab, and adds no editor=1, when the registration lacks the descriptor or the grant", () => {
            for (const extra of [{ editor: TAB.editor }, { allowEditorTab: true }, {}]) {
                let h: Harness;
                loggedErrors(() => h = harness({ [KEY]: registration(extra) }));
                chai.expect(h.registrations[KEY].editorUrl).equals(undefined);
                chai.expect(simulatorFrameUrl(h).searchParams.has("editor")).equals(false);
            }
        });

        it("adds no editor=1 when the open project does not include the extension", () => {
            const h = harness({ [KEY]: registration(TAB) }, { isSimxInProject: () => false });
            chai.expect(h.registrations[KEY].editorUrl).not.equals(undefined);
            chai.expect(simulatorFrameUrl(h).searchParams.has("editor")).equals(false);
        });

        it("logs a registration that enables a tab without an editor with an index, and nothing when it only declares one", () => {
            for (const editor of [undefined, { index: "", label: "Ext" }, { index: "" }]) {
                let h: Harness;
                chai.expect(loggedErrors(() => h = harness({ [KEY]: registration({ editor, allowEditorTab: true }) })).length).equals(1);
                chai.expect(h.registrations[KEY].editorUrl).equals(undefined);
            }
            chai.expect(loggedErrors(() => harness({ [KEY]: registration({ editor: TAB.editor }) }))).deep.equals([]);
        });

        it("keeps no computed URL a registration arrives with, resolving only what it validates", () => {
            const carried = { url: "https://elsewhere.example/sim.html", editorUrl: "https://elsewhere.example/tab.html", iconUrl: "https://elsewhere.example/icon.svg", creates: ["ext.Thing"] };
            let h: Harness;
            loggedErrors(() => h = harness({
                [KEY]: { ...registration(TAB), aspectRatio: undefined, ...carried },
                "otherorg/pxt-other": registration({ ...carried, editor: TAB.editor }),
            }));
            const computed = (key: string) => {
                const { url, editorUrl, iconUrl, creates } = h.registrations[key];
                return { url, editorUrl, iconUrl, creates };
            };
            chai.expect(computed(KEY)).deep.equals({ url: undefined, editorUrl: undefined, iconUrl: undefined, creates: undefined });
            chai.expect(h.driver.startSimulatorExtension(KEY)).equals(undefined);
            chai.expect(computed("otherorg/pxt-other")).deep.equals({
                url: `${SIM_ORIGIN}/simx/otherorg/pxt-other/-/index.html`, editorUrl: undefined, iconUrl: undefined, creates: undefined,
            });
        });

        it("refuses, and logs, a tab on a registration that is not permanent", () => {
            let h: Harness;
            const errors = loggedErrors(() => h = harness({ [KEY]: registration({ ...TAB, permanent: false }) }));
            chai.expect(errors.length).equals(1);
            chai.expect(h.registrations[KEY].editorUrl).equals(undefined);
            chai.expect(simulatorFrameUrl(h).searchParams.has("editor")).equals(false);
        });
    });

    describe("starting the simulator frame", () => {
        it("creates the simulator frame of a key when none exists, with the frame's usual URL", () => {
            const h = harness({ [KEY]: registration(TAB) }, { targetId: "arcade", getProjectId: () => "p1" });
            const frame = h.driver.startSimulatorExtension(KEY) as unknown as FakeElement;
            chai.expect(h.frames).deep.equals([h.mainFrame, frame]);
            chai.expect(frame.dataset["messagechannel"]).equals(KEY);
            const url = new URL(frame.src);
            chai.expect(url.searchParams.get("channel")).equals(KEY);
            chai.expect(url.searchParams.get("parentOrigin")).equals(EDITOR_ORIGIN);
            chai.expect(url.searchParams.get("target")).equals("arcade");
            chai.expect(url.searchParams.get("project")).equals("p1");
            chai.expect(url.searchParams.get("editor")).equals("1");
            chai.expect(url.searchParams.get("apiLevel")).equals(pxsim.SIMX_API_LEVEL.toString());
        });

        it("never duplicates an existing simulator frame, whichever path finds it", () => {
            const h = harness({ [KEY]: registration(TAB) });
            const started = h.driver.startSimulatorExtension(KEY);
            chai.expect(h.driver.startSimulatorExtension(KEY)).equals(started);
            packet(h);
            chai.expect(h.frames.length).equals(2);

            const other = harness({ [KEY]: registration(TAB) });
            packet(other);
            chai.expect(other.driver.startSimulatorExtension(KEY)).equals(other.frames[1]);
            chai.expect(other.frames.length).equals(2);
        });

        it("starts nothing for a key no extension is registered under", () => {
            const h = harness({ [KEY]: registration(TAB) });
            chai.expect(h.driver.startSimulatorExtension("otherorg/pxt-other")).equals(undefined);
            chai.expect(h.frames.length).equals(1);
        });

        it("reports each page load of a simulator extension frame with its key", () => {
            const loads: [string, unknown][] = [];
            const h = harness({ [KEY]: registration(TAB) }, { onSimxFrameLoad: (key, frame) => loads.push([key, frame]) });
            packet(h);
            const frame = h.frames[1] as FakeElement;
            chai.expect(loads).deep.equals([]);
            frame.fire("load");
            frame.fire("load");
            chai.expect(loads.length).equals(2);
            chai.expect(loads.every(([key, f]) => key === KEY && f === frame)).equals(true);
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

        it("is refused as unregistered when tagged with a key no extension is registered under", () => {
            const h = harness({ [KEY]: registration({ ...TAB, allowFileWrite: true }) }, { onProjfsMessage: () => chai.assert.fail("delivered") });
            const tab = tabFrame(h, "otherorg/pxt-other");
            receive(h, files, tab.contentWindow);
            chai.expect(refusals(tab)).deep.equals([{ type: "projfs", id: "1", subtype: "error", code: "UNREGISTERED" }]);
        });

        it("replies to each frame of a key through one function per frame", () => {
            const replies: [string, unknown][] = [];
            const h = harness({ [KEY]: registration({ ...TAB, allowFileWrite: true }) }, { onProjfsMessage: (key, msg, reply) => replies.push([(msg as any).id, reply]) });
            packet(h);
            const simulatorFrame = h.frames[1];
            const tab = tabFrame(h, KEY);
            receive(h, { ...files, id: "a" }, tab.contentWindow);
            receive(h, { ...files, id: "b" }, simulatorFrame.contentWindow);
            receive(h, { ...files, id: "c" }, tab.contentWindow);
            chai.expect(replies[0][1]).equals(replies[2][1]);
            chai.expect(replies[0][1]).not.equals(replies[1][1]);
            const ack = { type: "projfs", id: "a", subtype: "ack" } as pxsim.SimulatorMessage;
            (replies[0][1] as (msg: pxsim.SimulatorMessage) => void)(ack);
            chai.expect(tab.contentWindow.messages).deep.equals([ack]);
            chai.expect(simulatorFrame.contentWindow.messages.filter(m => m === ack)).deep.equals([]);
        });

        it("receives no simulator broadcasts", () => {
            const h = harness({ [KEY]: registration(TAB) });
            const tab = tabFrame(h, KEY);
            packet(h);
            h.driver.postMessage({ type: "stop", source: "pxtdriver" } as pxsim.SimulatorMessage);
            chai.expect(h.frames[1].contentWindow.messages.length).equals(2);
            chai.expect(tab.contentWindow.messages).deep.equals([]);
        });

        it("posts nothing to the simulators", () => {
            const opened: string[] = [];
            const h = harness({ [KEY]: registration(TAB) }, { onSimxEditorMessage: key => opened.push(key) });
            packet(h);
            const simulatorFrame = h.frames[1];
            const before = simulatorFrame.contentWindow.messages.length;
            const tab = tabFrame(h, KEY);
            receive(h, { type: "messagepacket", channel: KEY, broadcast: true, data: new Uint8Array(0) }, tab.contentWindow);
            receive(h, { type: "radiopacket", broadcast: true }, tab.contentWindow);
            receive(h, { type: "simxeditor", subtype: "open", id: "1" }, tab.contentWindow);
            receive(h, { type: "simxeditor", event: "ready" }, tab.contentWindow);
            chai.expect(h.frames.length).equals(2);
            chai.expect(simulatorFrame.contentWindow.messages.length).equals(before);
            chai.expect(h.mainFrame.contentWindow.messages).deep.equals([]);
            chai.expect(opened).deep.equals([]);
        });

        it("has its open request answered with UNREGISTERED, and its own events left unanswered", () => {
            const h = harness({ [KEY]: registration(TAB) }, { onSimxEditorMessage: () => chai.assert.fail("delivered") });
            const tab = tabFrame(h, KEY);
            receive(h, { type: "simxeditor", subtype: "open", id: "1" }, tab.contentWindow);
            receive(h, { type: "simxeditor", event: "ready" }, tab.contentWindow);
            chai.expect(refusals(tab)).deep.equals([{ type: "simxeditor", id: "1", subtype: "error", code: "UNREGISTERED" }]);
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

        it("is served under the key it was recorded with, and is a window outside the simulator once forgotten", () => {
            const delivered: string[] = [];
            const h = harness({ [KEY]: registration({ ...TAB, allowFileWrite: true }) }, { onProjfsMessage: key => delivered.push(key) });
            const tab = tabFrame(h, KEY);
            tab.dataset["simxkey"] = "otherorg/pxt-other";
            receive(h, files, tab.contentWindow);
            h.driver.removeEditorTabFrame(tab as unknown as HTMLIFrameElement);
            receive(h, files, tab.contentWindow);
            chai.expect(delivered).deep.equals([KEY]);
            chai.expect(tab.contentWindow.messages).deep.equals([]);
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

        it("is refused with UNREGISTERED from the simulator frame of an extension the open project does not include", () => {
            const h = harness({ [KEY]: registration(TAB) }, {
                isSimxInProject: () => false,
                onSimxEditorMessage: () => chai.assert.fail("delivered"),
            });
            packet(h);
            const simulatorFrame = h.frames[1];
            simulatorFrame.contentWindow.posts = [];
            receive(h, open, simulatorFrame.contentWindow);
            chai.expect(refusals(simulatorFrame)).deep.equals([{ type: "simxeditor", id: "7", subtype: "error", code: "UNREGISTERED" }]);
        });

        it("is answered with INVALID_REQUEST when its handler throws", () => {
            const h = harness({ [KEY]: registration(TAB) }, { onSimxEditorMessage: () => { throw new Error("handler failed"); } });
            packet(h);
            const simulatorFrame = h.frames[1];
            simulatorFrame.contentWindow.posts = [];
            loggedErrors(() => receive(h, open, simulatorFrame.contentWindow));
            chai.expect(refusals(simulatorFrame)).deep.equals([{ type: "simxeditor", id: "7", subtype: "error", code: "INVALID_REQUEST" }]);
        });

        it("is refused with UNREGISTERED from the main simulator frame and from an unregistered frame", () => {
            const h = harness({ [KEY]: registration(TAB) }, { onSimxEditorMessage: () => chai.assert.fail("delivered") });
            receive(h, open, h.mainFrame.contentWindow);
            chai.expect(refusals(h.mainFrame)).deep.equals([{ type: "simxeditor", id: "7", subtype: "error", code: "UNREGISTERED" }]);

            const unregistered = staticFrame("sim-frame-9", "someorg/pxt-removed");
            h.frames.push(unregistered);
            receive(h, open, unregistered.contentWindow);
            chai.expect(refusals(unregistered)).deep.equals([{ type: "simxeditor", id: "7", subtype: "error", code: "UNREGISTERED" }]);
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

describe("simulator driver unload", () => {
    const CHANNEL = "someorg/pxt-ext";

    let container: FakeElement;
    let driver: pxsim.SimulatorDriver;
    // the number of frames in the container each time the driver reported unloading
    let unloads: number[];

    beforeEach(() => {
        container = new FakeElement("div");
        unloads = [];
        driver = new pxsim.SimulatorDriver(container as unknown as HTMLElement, {
            simUrl: SIM_URL,
            simulatorExtensions: {
                [CHANNEL]: { index: "index.html", aspectRatio: 1, permanent: true, allowFileWrite: true },
            },
            onFramesUnloaded: () => unloads.push(container.getElementsByTagName("iframe").length),
        });
    });

    it("reports each unload once every frame is removed", () => {
        driver.startSimulatorExtension(CHANNEL);
        driver.stop(true);
        driver.stop(true);
        chai.expect(unloads).deep.equals([0, 0]);
        driver.stop();
        chai.expect(unloads).deep.equals([0, 0]);
    });

    it("lets a frame be started again from the report", () => {
        (driver as any).options.onFramesUnloaded = () => driver.startSimulatorExtension(CHANNEL);
        driver.startSimulatorExtension(CHANNEL);
        driver.stop(true);
        chai.expect(container.getElementsByTagName("iframe").map(f => f.dataset["messagechannel"])).deep.equals([CHANNEL]);
    });

    it("tells whether it holds frames, whatever its state", () => {
        chai.expect(driver.hasFrames()).equals(false);
        driver.startSimulatorExtension(CHANNEL);
        chai.expect(driver.state).equals(pxsim.SimulatorState.Unloaded);
        chai.expect(driver.hasFrames()).equals(true);
        driver.stop(true);
        chai.expect(driver.hasFrames()).equals(false);
    });

    it("posts nothing for a reply to a request whose frame it removed before the reply", () => {
        let reply: (msg: pxsim.SimulatorMessage) => void;
        driver.options.onProjfsMessage = (key, msg, r) => reply = r;
        const frame = driver.startSimulatorExtension(CHANNEL) as unknown as FakeElement;
        dispatchMessage({ type: "projfs", id: "1", subtype: "list" }, frame.contentWindow);
        driver.stop(true);
        chai.expect(frame.contentWindow).equals(null);
        reply({ type: "projfs", id: "1", subtype: "files", files: [] } as pxsim.SimulatorMessage);
        chai.expect(frame.window.posts).deep.equals([]);
    });
});

describe("simulator driver hide-in-fullscreen classes", () => {
    const FRAME_CLASS = "simx-hide-fullscreen";
    const CONTAINER_CLASS = "has-simx-hide-fullscreen";
    const HIDDEN_CHANNEL = "someorg/pxt-strip";
    const OTHER_HIDDEN_CHANNEL = "someorg/pxt-overlay";
    const SHOWN_CHANNEL = "someorg/pxt-ext";
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
                [SHOWN_CHANNEL]: simx(),
                [TRANSIENT_SHOWN_CHANNEL]: simx(false, false),
            },
            removeElement: el => removals.push(() => pxsim.U.remove(el)),
            hideElement: () => { },
        });
        // installs the driver's listener on the editor's window; the main frame already exists
        driver.preload(1);
    });

    it("marks a hide-in-fullscreen extension frame and the container on spawn", () => {
        const wrapper = spawn(HIDDEN_CHANNEL);
        chai.expect(hasClass(wrapper, FRAME_CLASS)).equals(true);
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(true);
    });

    it("leaves an extension frame without the hint and the container unmarked", () => {
        const wrapper = spawn(SHOWN_CHANNEL);
        chai.expect(hasClass(wrapper, FRAME_CLASS)).equals(false);
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(false);
    });

    it("unmarks the container when a shown extension frame spawns beside a hidden one", () => {
        spawn(HIDDEN_CHANNEL);
        spawn(SHOWN_CHANNEL);
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(false);
    });

    it("leaves the container unmarked when a hidden extension frame spawns beside a shown one", () => {
        spawn(SHOWN_CHANNEL);
        const wrapper = spawn(HIDDEN_CHANNEL);
        chai.expect(hasClass(wrapper, FRAME_CLASS)).equals(true);
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(false);
    });

    it("marks the container while every extension frame is hidden in fullscreen", () => {
        spawn(HIDDEN_CHANNEL);
        spawn(OTHER_HIDDEN_CHANNEL);
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(true);
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

    it("marks the container when hiding the simulator removes the shown extension frame beside a hidden one", () => {
        spawn(HIDDEN_CHANNEL);
        spawn(TRANSIENT_SHOWN_CHANNEL);
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(false);
        driver.hide();
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(true);
    });

    it("clears the container class on unload", () => {
        spawn(HIDDEN_CHANNEL);
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(true);
        driver.stop(true);
        chai.expect(container.children.length).equals(0);
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(false);
    });
});

describe("simulator driver fullscreen mode", () => {
    const CHANNEL = "someorg/pxt-ext";

    let container: FakeElement;
    let mainFrame: FakeElement;
    let driver: pxsim.SimulatorDriver;

    /** Sends a channel packet from the main frame, which spawns the channel's extension frame. */
    function spawn(): FakeElement {
        const packet = { type: "messagepacket", channel: CHANNEL, broadcast: true } as pxsim.SimulatorMessage;
        dispatchMessage(packet, mainFrame.contentWindow);
        return container.getElementsByTagName("iframe")
            .find(frame => frame.dataset["messagechannel"] === CHANNEL);
    }

    /** Returns the fullscreen messages posted to `frame`, and checks that each was posted to the origin the frame was created with. */
    function fullscreenMessages(frame: FakeElement) {
        const posts = frame.contentWindow.posts.filter(p => p.msg.type === "fullscreen");
        chai.expect(posts.map(p => p.targetOrigin)).deep.equals(posts.map(() => frame.dataset["origin"]));
        return posts.map(p => p.msg);
    }

    beforeEach(() => {
        container = new FakeElement("div");
        const wrapper = container.appendChild(new FakeElement("div"));
        mainFrame = wrapper.appendChild(new FakeElement("iframe"));
        mainFrame.id = "sim-frame-1";
        mainFrame.dataset = { origin: SIM_ORIGIN, runid: "" };
        driver = new pxsim.SimulatorDriver(container as unknown as HTMLElement, {
            simUrl: SIM_URL,
            simulatorExtensions: {
                [CHANNEL]: { index: "index.html", aspectRatio: 1, permanent: true },
            },
        });
        // installs the driver's listener on the editor's window; the main frame already exists
        driver.preload(1);
    });

    it("posts fullscreen with enabled to every simulator frame on each change of the mode", () => {
        const extensionFrame = spawn();
        driver.setFullscreen(true);
        driver.setFullscreen(true);
        driver.setFullscreen(false);
        driver.setFullscreen(false);
        const expected = [
            { type: "fullscreen", source: "pxtdriver", enabled: true },
            { type: "fullscreen", source: "pxtdriver", enabled: false },
        ];
        chai.expect(fullscreenMessages(mainFrame)).deep.equals(expected);
        chai.expect(fullscreenMessages(extensionFrame)).deep.equals(expected);
    });

    it("posts the mode to an extension frame spawned while it is on, each time the frame's page loads", () => {
        driver.setFullscreen(true);
        const extensionFrame = spawn();
        extensionFrame.fire("load");
        extensionFrame.fire("load");
        chai.expect(fullscreenMessages(extensionFrame)).deep.equals([
            { type: "fullscreen", source: "pxtdriver", enabled: true },
            { type: "fullscreen", source: "pxtdriver", enabled: true },
        ]);
    });

    it("posts nothing to an extension frame whose page loads while the mode is off", () => {
        driver.setFullscreen(true);
        driver.setFullscreen(false);
        const extensionFrame = spawn();
        extensionFrame.fire("load");
        chai.expect(fullscreenMessages(extensionFrame)).deep.equals([]);
    });
});
