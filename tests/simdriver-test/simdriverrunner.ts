/// <reference path="../../built/pxtsim.d.ts"/>

/* eslint-disable import/no-unassigned-import mocha-no-side-effect-code */
import "mocha";
import * as chai from "chai";

const EDITOR_ORIGIN = "http://localhost:3232";

class FakeWindow {
    messages: pxsim.SimulatorMessage[] = [];

    postMessage(msg: pxsim.SimulatorMessage) {
        this.messages.push(msg);
    }
}

interface FakeFrame {
    id: string;
    dataset: pxt.Map<string>;
    contentWindow: FakeWindow;
}

/**
 * The part of a DOM element the driver touches when it creates, starts and
 * removes simulator frames.
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
    contentWindow = new FakeWindow();
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

    setAttribute(name: string, value: string) {
        this.attributes[name] = value;
    }

    getAttribute(name: string): string {
        return this.attributes[name];
    }

    appendChild(child: FakeElement): FakeElement {
        this.children.push(child);
        child.parentElement = this;
        return child;
    }

    removeChild(child: FakeElement): FakeElement {
        this.children.splice(this.children.indexOf(child), 1);
        child.parentElement = undefined;
        return child;
    }

    /** Returns the descendants with tag `tagName`, in document order. */
    getElementsByTagName(tagName: string): FakeElement[] {
        return this.children.reduce((found, child) => found.concat(
            child.tagName === tagName ? [child] : [],
            child.getElementsByTagName(tagName)), [] as FakeElement[]);
    }

    focus() { }

    addEventListener(type: string, listener: () => void) {
        (this.listeners[type] = this.listeners[type] || []).push(listener);
    }

    /** Calls the listeners of `type`, as the browser does when the event fires. */
    fire(type: string) {
        (this.listeners[type] || []).forEach(listener => listener());
    }

    private classNames(): string[] {
        return this.className.split(/\s+/).filter(c => !!c);
    }
}

// the frames of the page outside the simulator container, which the driver finds by selector
let pageFrames: FakeFrame[] = [];

function initGlobals() {
    const g = global as any;
    g.window = {
        location: { origin: EDITOR_ORIGIN, href: EDITOR_ORIGIN + "/index.html" },
        addEventListener: () => { },
        removeEventListener: () => { },
    };
    g.location = g.window.location;
    g.document = {
        createElement: (tagName: string) => new FakeElement(tagName),
        querySelectorAll: (selector: string) => {
            const m = /^iframe\[data-simxrole="([^"]+)"\]$/.exec(selector);
            chai.expect(m, `unexpected selector ${selector}`).to.not.equal(null);
            return pageFrames.filter(f => f.dataset["simxrole"] === m[1]);
        },
    };
}

initGlobals();

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

    function frame(id: string, channel?: string): FakeFrame {
        const dataset: pxt.Map<string> = { origin: EDITOR_ORIGIN, runid: "" };
        if (channel) dataset["messagechannel"] = channel;
        return { id, dataset, contentWindow: new FakeWindow() };
    }

    function receive(msg: pxsim.SimulatorMessage, source: FakeWindow) {
        (driver as any).handleMessage(msg, source);
    }

    function relayed() {
        return [mainFrame, otherSimxFrame, unofferedFrame].some(f => f.contentWindow.messages.length > 0);
    }

    beforeEach(() => {
        mainFrame = frame("sim-frame-1");
        simxFrame = frame("sim-frame-2", "someorg/pxt-ext");
        otherSimxFrame = frame("sim-frame-3", "otherorg/pxt-other");
        unofferedFrame = frame("sim-frame-4", "someorg/pxt-removed");
        ungrantedFrame = frame("sim-frame-5", "someorg/pxt-nofiles");
        const frames = [mainFrame, simxFrame, otherSimxFrame, unofferedFrame, ungrantedFrame];
        const container = { getElementsByTagName: () => frames } as unknown as HTMLElement;
        const simx = () => ({ index: "index.html", aspectRatio: 1, permanent: true });
        deliveries = [];
        driver = new pxsim.SimulatorDriver(container, {
            simUrl: EDITOR_ORIGIN + "/sim/simulator.html",
            simulatorExtensions: {
                "someorg/pxt-ext": { ...simx(), allowFileWrite: true },
                "otherorg/pxt-other": { ...simx(), allowFileWrite: true },
                "someorg/pxt-nofiles": simx(),
            },
            onProjfsMessage: (key, msg, reply) => deliveries.push({ key, msg, reply }),
        });
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

    it("takes the key from the frame, not the message", () => {
        receive({ ...request, channel: "otherorg/pxt-other" } as pxsim.SimulatorMessage, simxFrame.contentWindow);
        chai.expect(deliveries.map(d => d.key)).deep.equals(["someorg/pxt-ext"]);
    });

    it("posts replies to the requesting frame only", () => {
        receive(request, simxFrame.contentWindow);
        const reply = { type: "projfs", id: "1", subtype: "files", files: [] } as pxsim.SimulatorMessage;
        deliveries[0].reply(reply);
        chai.expect(simxFrame.contentWindow.messages).deep.equals([reply]);
        chai.expect(relayed()).equals(false);
    });

    it("does not relay requests to other frames", () => {
        receive(request, simxFrame.contentWindow);
        chai.expect(relayed()).equals(false);
    });

    // the refusals a frame received, without their messages
    function refusals(frame: FakeFrame) {
        return frame.contentWindow.messages.map(m => {
            const { type, id, subtype, code } = m as pxsim.SimulatorMessage & { id: string, subtype: string, code: string };
            return { type, id, subtype, code };
        });
    }

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

    function frame(id: string, channel?: string): FakeFrame {
        const dataset: pxt.Map<string> = { origin: EDITOR_ORIGIN, runid: "" };
        if (channel) dataset["messagechannel"] = channel;
        return { id, dataset, contentWindow: new FakeWindow() };
    }

    function receive(msg: pxsim.SimulatorMessage, source: FakeWindow) {
        (driver as any).handleMessage(msg, source);
    }

    // the refusals a frame received, without their messages
    function refusals(frame: FakeFrame) {
        return frame.contentWindow.messages.map(m => {
            const { type, id, subtype, code } = m as pxsim.SimulatorMessage & { id: string, subtype: string, code: string };
            return { type, id, subtype, code };
        });
    }

    beforeEach(() => {
        mainFrame = frame("sim-frame-1");
        grantedFrame = frame("sim-frame-2", "someorg/pxt-assets");
        ungrantedFrame = frame("sim-frame-3", "someorg/pxt-ext");
        unofferedFrame = frame("sim-frame-4", "someorg/pxt-removed");
        filesOnlyFrame = frame("sim-frame-5", "someorg/pxt-files");
        bothFrame = frame("sim-frame-6", "someorg/pxt-both");
        const frames = [mainFrame, grantedFrame, ungrantedFrame, unofferedFrame, filesOnlyFrame, bothFrame];
        const container = { getElementsByTagName: () => frames } as unknown as HTMLElement;
        const simx = () => ({ index: "index.html", aspectRatio: 1, permanent: true });
        assetDeliveries = [];
        projfsDeliveries = [];
        driver = new pxsim.SimulatorDriver(container, {
            simUrl: EDITOR_ORIGIN + "/sim/simulator.html",
            simulatorExtensions: {
                "someorg/pxt-assets": { ...simx(), allowAssetRead: true },
                "someorg/pxt-ext": simx(),
                "someorg/pxt-files": { ...simx(), allowFileWrite: true },
                "someorg/pxt-both": { ...simx(), allowAssetRead: true, allowFileWrite: true },
            },
            onProjassetsMessage: (key, msg) => assetDeliveries.push({ key, msg }),
            onProjfsMessage: (key, msg) => projfsDeliveries.push({ key, msg }),
        });
    });

    it("delivers a request from a frame registered with allowAssetRead, with the frame's key", () => {
        receive(request, grantedFrame.contentWindow);
        chai.expect(assetDeliveries).deep.equals([{ key: "someorg/pxt-assets", msg: request }]);
        chai.expect(projfsDeliveries).deep.equals([]);
    });

    it("posts replies and notifications to the requesting frame only", () => {
        let reply: (msg: pxsim.SimulatorMessage) => void;
        (driver as any).options.onProjassetsMessage = (key: string, msg: pxsim.SimulatorMessage, r: typeof reply) => reply = r;
        receive({ type: "projassets", id: "1", subtype: "subscribe" } as pxsim.SimulatorMessage, grantedFrame.contentWindow);
        const ack = { type: "projassets", id: "1", subtype: "ack" } as pxsim.SimulatorMessage;
        const changed = { type: "projassets", subtype: "changed" } as pxsim.SimulatorMessage;
        reply(ack);
        reply(changed);
        chai.expect(grantedFrame.contentWindow.messages).deep.equals([ack, changed]);
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
});

describe("simulator driver simulator extension frames", () => {
    const SIM_SANDBOX = "allow-same-origin allow-scripts";
    const SIM_ALLOW = "autoplay;microphone";

    interface FrameGrants {
        allowPopups?: boolean;
        allowClipboardWrite?: boolean;
    }

    function newDriver(frames: FakeFrame[], options: pxsim.SimulatorDriverOptions = {}, grants: FrameGrants = {}): pxsim.SimulatorDriver {
        const container = {
            getElementsByTagName: () => frames,
            appendChild: (wrapper: FakeElement) => frames.push(wrapper.firstElementChild),
        } as unknown as HTMLElement;
        return new pxsim.SimulatorDriver(container, {
            simUrl: EDITOR_ORIGIN + "/sim/simulator.html",
            simulatorExtensions: {
                "someorg/pxt-ext": { index: "index.html", aspectRatio: 1, permanent: true, ...grants },
            },
            ...options,
        });
    }

    /**
     * Starts the simulator extension offered under "someorg/pxt-ext", registered with
     * `grants`, by posting a message on its channel from the main simulator frame, and
     * returns the frame created for it, the URL that frame loads, and every frame the
     * driver holds.
     */
    function startSimulatorExtension(options: pxsim.SimulatorDriverOptions = {}, grants: FrameGrants = {}): { url: URL, frame: FakeElement, frames: FakeFrame[] } {
        const mainFrame: FakeFrame = { id: "sim-frame-1", dataset: { origin: EDITOR_ORIGIN, runid: "" }, contentWindow: new FakeWindow() };
        const frames: FakeFrame[] = [mainFrame];
        const driver = newDriver(frames, options, grants);
        // starting the frame needs a loaded page; the created frame is all these tests inspect
        (driver as any).startFrame = () => { };

        const packet = { type: "messagepacket", channel: "someorg/pxt-ext", broadcast: true, data: new Uint8Array(0) };
        driver.postMessage(packet as pxsim.SimulatorMessage, mainFrame.contentWindow as unknown as Window);

        chai.expect(frames.length).equals(2);
        const frame = frames[1] as FakeElement;
        return { url: new URL(frame.src), frame, frames };
    }

    /**
     * Creates a frame the way every main simulator frame is created.
     */
    function createSimulatorFrame(): FakeElement {
        const wrapper = (newDriver([]) as any).createFrame() as FakeElement;
        return wrapper.firstElementChild;
    }

    it("passes the frame's key to the frame in its URL, beside the parent origin", () => {
        const { url, frames } = startSimulatorExtension();

        chai.expect(url.searchParams.get("channel")).equals("someorg/pxt-ext");
        chai.expect(url.searchParams.get("parentOrigin")).equals(EDITOR_ORIGIN);
        chai.expect(frames[1].dataset["messagechannel"]).equals(url.searchParams.get("channel"));
    });

    it("passes the running target's id to the frame in its URL when the driver is given one", () => {
        chai.expect(startSimulatorExtension({ targetId: "microbit" }).url.searchParams.get("target")).equals("microbit");
        chai.expect(startSimulatorExtension().url.searchParams.has("target")).equals(false);
    });

    it("passes the open project's id to the frame in its URL, beside the other parameters", () => {
        const { url } = startSimulatorExtension({ targetId: "microbit", getProjectId: () => "3b1f7c2e-project" });

        chai.expect(url.searchParams.get("project")).equals("3b1f7c2e-project");
        chai.expect(url.searchParams.get("channel")).equals("someorg/pxt-ext");
        chai.expect(url.searchParams.get("parentOrigin")).equals(EDITOR_ORIGIN);
        chai.expect(url.searchParams.get("target")).equals("microbit");
    });

    it("reads the project's id when it creates the frame", () => {
        let projectId = "first-project";
        const getProjectId = () => projectId;
        chai.expect(startSimulatorExtension({ getProjectId }).url.searchParams.get("project")).equals("first-project");
        projectId = "second-project";
        chai.expect(startSimulatorExtension({ getProjectId }).url.searchParams.get("project")).equals("second-project");
    });

    it("omits the project's id when no project is open or the driver cannot tell", () => {
        const noProject = startSimulatorExtension({ targetId: "microbit", getProjectId: () => undefined }).url;
        chai.expect(noProject.searchParams.has("project")).equals(false);
        chai.expect(noProject.searchParams.get("channel")).equals("someorg/pxt-ext");
        chai.expect(noProject.searchParams.get("target")).equals("microbit");
        chai.expect(startSimulatorExtension().url.searchParams.has("project")).equals(false);
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

    it("lets a simulator extension frame registered with allowClipboardWrite write to the clipboard", () => {
        const { frame } = startSimulatorExtension({}, { allowClipboardWrite: true });

        chai.expect(allowOf(frame)).to.have.members(["autoplay", "microphone", "clipboard-write"]);
        chai.expect(frame.getAttribute("sandbox")).equals(SIM_SANDBOX);
    });

    it("gives a simulator extension frame registered with both grants both", () => {
        const { frame } = startSimulatorExtension({}, { allowPopups: true, allowClipboardWrite: true });

        chai.expect(sandboxOf(frame)).to.have.members(["allow-same-origin", "allow-scripts", "allow-popups", "allow-popups-to-escape-sandbox"]);
        chai.expect(allowOf(frame)).to.have.members(["autoplay", "microphone", "clipboard-write"]);
    });

    it("keeps the main simulator frame's sandbox and permissions", () => {
        const frame = createSimulatorFrame();

        chai.expect(frame.getAttribute("sandbox")).equals(SIM_SANDBOX);
        chai.expect(frame.getAttribute("allow")).equals(SIM_ALLOW);
    });
});

describe("simulator driver simulator extension editor tabs", () => {
    const KEY = "someorg/pxt-ext";
    const TAB = { editor: { index: "editor/index.html", label: "Ext" }, allowEditorTab: true };

    type Registration = pxsim.SimulatorDriverOptions["simulatorExtensions"][string];

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

    interface Harness {
        driver: pxsim.SimulatorDriver;
        // the frames in the simulator container, the main simulator frame first
        frames: FakeFrame[];
        mainFrame: FakeFrame;
        registrations: pxt.Map<Registration>;
    }

    afterEach(() => {
        pageFrames = [];
    });

    function harness(registrations: pxt.Map<Registration>, options: pxsim.SimulatorDriverOptions = {}): Harness {
        const mainFrame: FakeFrame = { id: "sim-frame-1", dataset: { origin: EDITOR_ORIGIN, runid: "" }, contentWindow: new FakeWindow() };
        const frames: FakeFrame[] = [mainFrame];
        const container = {
            getElementsByTagName: () => frames,
            appendChild: (wrapper: FakeElement) => frames.push(wrapper.firstElementChild),
        } as unknown as HTMLElement;
        const driver = new pxsim.SimulatorDriver(container, {
            simUrl: EDITOR_ORIGIN + "/sim/simulator.html",
            simulatorExtensions: registrations,
            ...options,
        });
        // starting a frame needs a loaded page; these tests inspect the frames and their messages
        (driver as any).startFrame = () => { };
        return { driver, frames, mainFrame, registrations };
    }

    function registration(extra: Registration = {}): Registration {
        return { index: "index.html", aspectRatio: 1, permanent: true, ...extra };
    }

    // a tab frame of `key` in the page, as the editor creates one
    function tabFrame(key: string): FakeFrame {
        const frame: FakeFrame = { id: "", dataset: { simxkey: key, simxrole: "editor", origin: EDITOR_ORIGIN }, contentWindow: new FakeWindow() };
        pageFrames.push(frame);
        return frame;
    }

    function receive(h: Harness, msg: any, source: FakeWindow) {
        (h.driver as any).handleMessage(msg as pxsim.SimulatorMessage, source);
    }

    function packet(h: Harness) {
        h.driver.postMessage({ type: "messagepacket", channel: KEY, broadcast: true, data: new Uint8Array(0) } as pxsim.SimulatorMessage, h.mainFrame.contentWindow as unknown as Window);
    }

    function simulatorFrameUrl(h: Harness): URL {
        packet(h);
        chai.expect(h.frames.length).equals(2);
        return new URL((h.frames[1] as FakeElement).src);
    }

    function refusals(frame: FakeFrame) {
        return frame.contentWindow.messages.map(m => {
            const { type, id, subtype, code } = m as pxsim.SimulatorMessage & { id: string, subtype: string, code: string };
            return { type, id, subtype, code };
        });
    }

    describe("registration", () => {
        it("resolves the tab's page, and an icon that is a path, as it resolves the extension's index", () => {
            const h = harness({
                [KEY]: registration({ index: "simx/index.html", editor: { index: "index.html", label: "Ext", icon: "brand/icon.svg" }, allowEditorTab: true }),
                "otherorg/pxt-other": registration({ editor: { index: "index.html", label: "Other", icon: "icon.svg" }, allowEditorTab: true }),
            });
            const simx = h.registrations[KEY];
            chai.expect(simx.url).equals(`${EDITOR_ORIGIN}/simx/${KEY}/-/simx/index.html`);
            chai.expect(simx.editorUrl).equals(`${EDITOR_ORIGIN}/simx/${KEY}/-/index.html`);
            chai.expect(simx.iconUrl).equals(`${EDITOR_ORIGIN}/simx/${KEY}/-/brand/icon.svg`);
            chai.expect(h.registrations["otherorg/pxt-other"].iconUrl).equals(`${EDITOR_ORIGIN}/simx/otherorg/pxt-other/-/icon.svg`);
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

        it("adds editor=1 to the simulator frame's URL when the registration declares and enables a tab", () => {
            chai.expect(simulatorFrameUrl(harness({ [KEY]: registration(TAB) })).searchParams.get("editor")).equals("1");
        });

        it("offers no tab, and adds no editor=1, when the registration lacks the descriptor or the grant", () => {
            for (const extra of [{ editor: TAB.editor }, { allowEditorTab: true }, {}]) {
                const h = harness({ [KEY]: registration(extra) });
                chai.expect(h.registrations[KEY].editorUrl).equals(undefined);
                chai.expect(simulatorFrameUrl(h).searchParams.has("editor")).equals(false);
            }
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
            const h = harness({ [KEY]: registration(TAB) }, { onSimulatorExtensionFrameLoad: (key, frame) => loads.push([key, frame]) });
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
            const tab = tabFrame(KEY);
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
            const tab = tabFrame(KEY);
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
            const tab = tabFrame("otherorg/pxt-other");
            receive(h, files, tab.contentWindow);
            chai.expect(refusals(tab)).deep.equals([{ type: "projfs", id: "1", subtype: "error", code: "UNREGISTERED" }]);
        });

        it("replies to each frame of a key through one function per frame", () => {
            const replies: [string, unknown][] = [];
            const h = harness({ [KEY]: registration({ ...TAB, allowFileWrite: true }) }, { onProjfsMessage: (key, msg, reply) => replies.push([(msg as any).id, reply]) });
            packet(h);
            const simulatorFrame = h.frames[1];
            const tab = tabFrame(KEY);
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
            const tab = tabFrame(KEY);
            packet(h);
            h.driver.postMessage({ type: "stop", source: "pxtdriver" } as pxsim.SimulatorMessage);
            chai.expect(h.frames[1].contentWindow.messages.length).equals(2);
            chai.expect(tab.contentWindow.messages).deep.equals([]);
        });

        it("posts nothing to the simulators", () => {
            const opened: string[] = [];
            const h = harness({ [KEY]: registration(TAB) }, { onSimulatorExtensionEditorMessage: key => opened.push(key) });
            packet(h);
            const simulatorFrame = h.frames[1];
            const before = simulatorFrame.contentWindow.messages.length;
            const tab = tabFrame(KEY);
            receive(h, { type: "messagepacket", channel: KEY, broadcast: true, data: new Uint8Array(0) }, tab.contentWindow);
            receive(h, { type: "radiopacket", broadcast: true }, tab.contentWindow);
            receive(h, { type: "simxeditor", subtype: "open", id: "1" }, tab.contentWindow);
            receive(h, { type: "simxeditor", event: "ready" }, tab.contentWindow);
            chai.expect(h.frames.length).equals(2);
            chai.expect(simulatorFrame.contentWindow.messages.length).equals(before);
            chai.expect(h.mainFrame.contentWindow.messages).deep.equals([]);
            chai.expect(tab.contentWindow.messages).deep.equals([]);
            chai.expect(opened).deep.equals([]);
        });
    });

    describe("the open request", () => {
        const open = { type: "simxeditor", subtype: "open", id: "7" };

        it("reaches the handler, with the key, from the simulator frame of a registration that declares and enables a tab", () => {
            const opened: string[] = [];
            const h = harness({ [KEY]: registration(TAB) }, {
                onSimulatorExtensionEditorMessage: (key, msg, reply) => {
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
            for (const extra of [{ allowEditorTab: true }, { editor: TAB.editor }, { ...TAB, permanent: false }]) {
                let h: Harness;
                loggedErrors(() => h = harness({ [KEY]: registration(extra) }, { onSimulatorExtensionEditorMessage: () => chai.assert.fail("delivered") }));
                packet(h);
                const simulatorFrame = h.frames[1];
                simulatorFrame.contentWindow.messages = [];
                receive(h, open, simulatorFrame.contentWindow);
                chai.expect(refusals(simulatorFrame)).deep.equals([{ type: "simxeditor", id: "7", subtype: "error", code: "PERMISSION_DENIED" }]);
            }
        });

        it("is refused with UNREGISTERED from the main simulator frame and from an unregistered frame", () => {
            const h = harness({ [KEY]: registration(TAB) }, { onSimulatorExtensionEditorMessage: () => chai.assert.fail("delivered") });
            receive(h, open, h.mainFrame.contentWindow);
            chai.expect(refusals(h.mainFrame)).deep.equals([{ type: "simxeditor", id: "7", subtype: "error", code: "UNREGISTERED" }]);

            const unregistered: FakeFrame = { id: "sim-frame-9", dataset: { origin: EDITOR_ORIGIN, runid: "", messagechannel: "someorg/pxt-removed" }, contentWindow: new FakeWindow() };
            h.frames.push(unregistered);
            receive(h, open, unregistered.contentWindow);
            chai.expect(refusals(unregistered)).deep.equals([{ type: "simxeditor", id: "7", subtype: "error", code: "UNREGISTERED" }]);
        });
    });
});

describe("simulator driver hide-in-fullscreen classes", () => {
    const FRAME_CLASS = "simx-hide-fullscreen";
    const CONTAINER_CLASS = "has-simx-hide-fullscreen";
    const HIDDEN_CHANNEL = "someorg/pxt-strip";
    const SHOWN_CHANNEL = "someorg/pxt-ext";

    let container: FakeElement;
    let mainFrame: FakeElement;
    let driver: pxsim.SimulatorDriver;

    function hasClass(el: FakeElement, cls: string): boolean {
        return pxsim.U.containsClass(el as unknown as HTMLElement, cls);
    }

    /** Sends a channel packet from the main frame, which spawns the channel's extension frame. */
    function spawn(channel: string): FakeElement {
        const packet = { type: "messagepacket", channel, broadcast: true } as pxsim.SimulatorMessage;
        (driver as any).handleMessage(packet, mainFrame.contentWindow);
        return container.getElementsByTagName("iframe")
            .find(frame => frame.dataset["messagechannel"] === channel)
            .parentElement;
    }

    beforeEach(() => {
        container = new FakeElement("div");
        const wrapper = container.appendChild(new FakeElement("div"));
        mainFrame = wrapper.appendChild(new FakeElement("iframe"));
        mainFrame.id = "sim-frame-1";
        mainFrame.dataset = { origin: EDITOR_ORIGIN, runid: "" };
        const simx = (hideInFullscreen?: boolean) => ({ index: "index.html", aspectRatio: 1, permanent: true, hideInFullscreen });
        driver = new pxsim.SimulatorDriver(container as unknown as HTMLElement, {
            simUrl: EDITOR_ORIGIN + "/sim/simulator.html",
            simulatorExtensions: {
                [HIDDEN_CHANNEL]: simx(true),
                [SHOWN_CHANNEL]: simx(),
            },
        });
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

    it("clears the container class on unload", () => {
        spawn(HIDDEN_CHANNEL);
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(true);
        driver.stop(true);
        chai.expect(container.children.length).equals(0);
        chai.expect(hasClass(container, CONTAINER_CLASS)).equals(false);
    });
});
