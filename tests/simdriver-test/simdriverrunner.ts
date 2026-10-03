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
 * The part of a DOM element the driver touches when it creates a frame.
 */
class FakeElement implements FakeFrame {
    id = "";
    className = "";
    src = "";
    dataset: pxt.Map<string> = {};
    style: pxt.Map<string> = {};
    contentWindow = new FakeWindow();
    parentElement: FakeElement;
    classList = { add: (cls: string) => { this.className += " " + cls; } };
    private attributes: pxt.Map<string> = {};
    private children: FakeElement[] = [];

    constructor(public tagName: string) { }

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

    focus() { }
}

function initGlobals() {
    const g = global as any;
    g.window = {
        location: { origin: EDITOR_ORIGIN, href: EDITOR_ORIGIN + "/index.html" },
        addEventListener: () => { },
        removeEventListener: () => { },
    };
    g.location = g.window.location;
    g.document = { createElement: (tagName: string) => new FakeElement(tagName) };
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
