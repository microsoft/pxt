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

function initGlobals() {
    const g = global as any;
    g.window = {
        location: { origin: EDITOR_ORIGIN, href: EDITOR_ORIGIN + "/index.html" },
        addEventListener: () => { },
        removeEventListener: () => { },
    };
    g.location = g.window.location;
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
    /**
     * Starts the simulator extension offered under "someorg/pxt-ext" by posting a
     * message on its channel from the main simulator frame, and returns the URL the
     * extension's frame is created with and every frame the driver holds.
     */
    function startSimulatorExtension(options: pxsim.SimulatorDriverOptions = {}): { url: URL, frames: FakeFrame[] } {
        const mainFrame: FakeFrame = { id: "sim-frame-1", dataset: { origin: EDITOR_ORIGIN, runid: "" }, contentWindow: new FakeWindow() };
        const frames: FakeFrame[] = [mainFrame];
        const container = {
            getElementsByTagName: () => frames,
            appendChild: (wrapper: { firstElementChild: FakeFrame }) => frames.push(wrapper.firstElementChild),
        } as unknown as HTMLElement;
        const driver = new pxsim.SimulatorDriver(container, {
            simUrl: EDITOR_ORIGIN + "/sim/simulator.html",
            simulatorExtensions: {
                "someorg/pxt-ext": { index: "index.html", aspectRatio: 1, permanent: true },
            },
            ...options,
        });
        // creating and starting the frame need a DOM; record the URL it is created with instead
        const urls: string[] = [];
        const fakeDriver = driver as any;
        fakeDriver.createFrame = (url: string) => {
            urls.push(url);
            return {
                classList: { add: () => { } },
                firstElementChild: { id: "sim-frame-2", dataset: { origin: EDITOR_ORIGIN }, contentWindow: new FakeWindow() },
            };
        };
        fakeDriver.startFrame = () => { };

        const packet = { type: "messagepacket", channel: "someorg/pxt-ext", broadcast: true, data: new Uint8Array(0) };
        driver.postMessage(packet as pxsim.SimulatorMessage, mainFrame.contentWindow as unknown as Window);

        chai.expect(urls.length).equals(1);
        return { url: new URL(urls[0]), frames };
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
});
