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
