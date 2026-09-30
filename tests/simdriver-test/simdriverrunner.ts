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
        const frames = [mainFrame, simxFrame, otherSimxFrame, unofferedFrame];
        const container = { getElementsByTagName: () => frames } as unknown as HTMLElement;
        const simx = () => ({ index: "index.html", aspectRatio: 1, permanent: true });
        deliveries = [];
        driver = new pxsim.SimulatorDriver(container, {
            simUrl: EDITOR_ORIGIN + "/sim/simulator.html",
            simulatorExtensions: {
                "someorg/pxt-ext": simx(),
                "otherorg/pxt-other": simx(),
            },
            onProjfsMessage: (key, msg, reply) => deliveries.push({ key, msg, reply }),
        });
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

    it("drops requests from the main simulator frame", () => {
        receive(request, mainFrame.contentWindow);
        chai.expect(deliveries).deep.equals([]);
        chai.expect(relayed()).equals(false);
        chai.expect(simxFrame.contentWindow.messages).deep.equals([]);
    });

    it("drops requests from a frame whose extension is not offered", () => {
        receive(request, unofferedFrame.contentWindow);
        chai.expect(deliveries).deep.equals([]);
        chai.expect(relayed()).equals(false);
        chai.expect(simxFrame.contentWindow.messages).deep.equals([]);
    });

    it("drops requests from windows outside the simulator", () => {
        receive(request, new FakeWindow());
        chai.expect(deliveries).deep.equals([]);
        chai.expect(relayed()).equals(false);
        chai.expect(simxFrame.contentWindow.messages).deep.equals([]);
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
