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

/**
 * The part of a DOM element the driver touches when it creates, starts, hides
 * and removes simulator frames. An iframe carries a `contentWindow` until it is
 * removed.
 */
class FakeElement {
    id = "";
    className = "";
    src = "";
    title = "";
    frameBorder = "";
    allowFullscreen = false;
    onclick: (ev: unknown) => boolean;
    dataset: pxt.Map<string> = {};
    style: pxt.Map<string> = {};
    contentWindow: FakeWindow;
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

    constructor(public tagName: string) {
        if (tagName === "iframe") this.contentWindow = new FakeWindow();
    }

    get firstChild(): FakeElement {
        return this.children[0];
    }

    get firstElementChild(): FakeElement {
        return this.children[0];
    }

    get nextElementSibling(): FakeElement {
        const siblings = this.parentElement ? this.parentElement.children : [];
        return siblings[siblings.indexOf(this) + 1];
    }

    setAttribute(name: string, value: string) {
        this.attributes[name] = value;
    }

    appendChild(child: FakeElement): FakeElement {
        return this.insertBefore(child, undefined);
    }

    /** Inserts `child` before `ref`, or last when `ref` is not a child. */
    insertBefore(child: FakeElement, ref: FakeElement): FakeElement {
        if (child.parentElement) child.parentElement.detach(child);
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
        this.detach(child);
        [child].concat(child.getElementsByTagName("iframe"))
            .filter(el => el.tagName === "iframe")
            .forEach(frame => frame.contentWindow = null);
        return child;
    }

    /** Returns the descendants with tag `tagName`, in document order. */
    getElementsByTagName(tagName: string): FakeElement[] {
        return this.children.reduce((found, child) => found.concat(
            child.tagName === tagName ? [child] : [],
            child.getElementsByTagName(tagName)), [] as FakeElement[]);
    }

    /** The driver queries only for pause overlays, which these tests never add. */
    querySelectorAll(selector: string): FakeElement[] {
        return [];
    }

    focus() { }

    private classNames(): string[] {
        return this.className.split(/\s+/).filter(c => !!c);
    }

    private detach(child: FakeElement) {
        this.children.splice(this.children.indexOf(child), 1);
        child.parentElement = undefined;
    }
}

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
    };
}

initGlobals();

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
        iframe(permanentWrapper).contentWindow.messages = [];
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

describe("simulator driver broadcast routing", () => {
    const EXT_CHANNEL = "someorg/pxt-ext";
    const LEGACY_CHANNEL = "legacy-sim";
    const LEGACY_URL = "https://legacy.example.com/sim.html?parent=$PARENT_ORIGIN$&lang=$LANGUAGE$";

    let container: FakeElement;
    let driver: pxsim.SimulatorDriver;
    let nextFrameNumber: number;

    function addBoardFrame(runid = ""): FakeElement {
        const wrapper = new FakeElement("div");
        const frame = new FakeElement("iframe");
        frame.id = "sim-frame-" + (nextFrameNumber++);
        frame.dataset = { origin: EDITOR_ORIGIN, runid };
        wrapper.appendChild(frame);
        wrapper.appendChild(new FakeElement("i"));
        wrapper.appendChild(new FakeElement("div"));
        container.appendChild(wrapper);
        return frame;
    }

    function addChannelFrame(channel: string, runid = ""): FakeElement {
        const frame = addBoardFrame(runid);
        frame.dataset["messagechannel"] = channel;
        return frame;
    }

    function frames(): FakeElement[] {
        return container.getElementsByTagName("iframe");
    }

    function types(frame: FakeElement): string[] {
        return frame.contentWindow.messages.map(m => m.type);
    }

    function createDriver(options: Partial<pxsim.SimulatorDriverOptions> = {}) {
        // cancels the frame cleanup timer of a driver this one replaces
        if (driver) (driver as any).cancelFrameCleanup();
        driver = new pxsim.SimulatorDriver(container as unknown as HTMLElement, {
            simUrl: EDITOR_ORIGIN + "/sim/simulator.html",
            parentOrigin: "https://embedder.example.com",
            userLanguage: "fr",
            simulatorExtensions: {
                [EXT_CHANNEL]: { index: "index.html", aspectRatio: 2, permanent: true }
            },
            messageSimulators: {
                [LEGACY_CHANNEL]: { url: LEGACY_URL, aspectRatio: 1.5, permanent: false }
            },
            ...options
        });
    }

    function send(msg: Partial<pxsim.SimulatorBroadcastMessage> & { type: string, channel?: string }, source: FakeElement) {
        (driver as any).handleMessage({ broadcast: true, ...msg }, source.contentWindow);
    }

    const radio = { type: "radiopacket" };
    const packet = (channel: string) => ({ type: "messagepacket", channel });

    let main: FakeElement;

    beforeEach(() => {
        container = new FakeElement("div");
        nextFrameNumber = 1;
        main = addBoardFrame();
        createDriver();
        driver.run("");
        main.contentWindow.messages = [];
    });

    afterEach(() => {
        (driver as any).unload();
        const w = (global as any).window;
        delete w.parent;
        delete w.opener;
    });

    describe("secondary board frames", () => {
        it("spins up a second board frame for the first non-channel broadcast and defers the message to it", () => {
            send(radio, main);
            chai.expect(frames().length).equals(2);
            const second = frames()[1];
            chai.expect(second.dataset["loading"]).equals("true");
            chai.expect(types(second)).deep.equals([]);
            chai.expect((driver as any).deferredMessages.map((d: any) => [d[0].element, d[1].type])).deep.equals([[second, "radiopacket"]]);
            chai.expect(types(main)).deep.equals([]);
        });

        it("does not spin up a frame when single simulator mode is set", () => {
            driver.setSingleSimulator();
            send(radio, main);
            chai.expect(frames().length).equals(1);
        });

        it("does not spin up a frame when the run is single", () => {
            driver.run("", { single: true });
            main.contentWindow.messages = [];
            send(radio, main);
            chai.expect(frames().length).equals(1);
        });

        it("starts a board frame when there is none", () => {
            const ext = addChannelFrame(EXT_CHANNEL, (driver as any).runId);
            container.removeChild(main.parentElement);
            send(radio, ext);
            chai.expect(frames().length).equals(2);
            chai.expect(frames()[1].dataset["messagechannel"]).equals(undefined);
        });

        it("never starts a third board frame", () => {
            const second = addBoardFrame((driver as any).runId);
            send(radio, main);
            chai.expect(frames().length).equals(2);
            chai.expect(types(second)).deep.equals(["radiopacket"]);
        });

        it("restarts a stale second board frame", () => {
            const second = addBoardFrame("stale");
            send(radio, main);
            chai.expect(frames().length).equals(2);
            chai.expect(types(second)).deep.equals(["run", "radiopacket"]);
            chai.expect(second.dataset["runid"]).equals((driver as any).runId);
        });

        it("does not restart a second board frame that has the current run", () => {
            const second = addBoardFrame((driver as any).runId);
            send(radio, main);
            chai.expect(types(second)).deep.equals(["radiopacket"]);
        });

        it("does not spin up a frame for a channel without a simulator", () => {
            send(packet("unknown-channel"), main);
            chai.expect(frames().length).equals(1);
        });

        it("delivers an unmatched channel packet to existing frames without deferral", () => {
            const second = addBoardFrame((driver as any).runId);
            send(packet("unknown-channel"), main);
            chai.expect(types(second)).deep.equals(["messagepacket"]);
        });

        it("does not echo a message to its source frame", () => {
            const second = addBoardFrame((driver as any).runId);
            send(radio, main);
            chai.expect(types(main)).deep.equals([]);
            chai.expect(types(second)).deep.equals(["radiopacket"]);
        });

        it("tags a broadcast with the index of its source frame", () => {
            const second = addBoardFrame((driver as any).runId);
            send(radio, second);
            const msg = main.contentWindow.messages[0] as pxsim.SimulatorBroadcastMessage;
            chai.expect(msg.srcFrameIndex).equals(1);
        });

        it("defers a message to a board frame that is still loading and posts it once the frame is ready", () => {
            send(radio, main);
            const second = frames()[1];
            (driver as any).handleDeferredMessages((driver as any).frameHost.wrap(second));
            chai.expect(second.dataset["loading"]).equals(undefined);
            chai.expect(types(second)).deep.equals(["radiopacket"]);
            chai.expect((driver as any).deferredMessages).deep.equals([]);
        });
    });

    describe("simulator extensions", () => {
        it("spins up an extension frame on first use", () => {
            send(packet(EXT_CHANNEL), main);
            chai.expect(frames().length).equals(2);
            const ext = frames()[1];
            const wrapper = ext.parentElement;
            chai.expect(ext.dataset["messagechannel"]).equals(EXT_CHANNEL);
            chai.expect(ext.dataset["permanent"]).equals("true");
            chai.expect(ext.dataset["aspectratio"]).equals("2");
            chai.expect(wrapper.classList.contains("simmsg")).equals(true);
            chai.expect(ext.src.indexOf("/simx/" + EXT_CHANNEL + "/-/index.html")).to.be.greaterThan(0);
        });

        it("tells the extension to trust the editor's own origin and language", () => {
            send(packet(EXT_CHANNEL), main);
            const url = new URL(frames()[1].src);
            chai.expect(url.searchParams.get("parentOrigin")).equals(EDITOR_ORIGIN);
            chai.expect(url.searchParams.get("language")).equals("fr");
        });

        it("starts the new extension frame with the run, then sends it the message", () => {
            send(packet(EXT_CHANNEL), main);
            chai.expect(types(frames()[1])).deep.equals(["run", "messagepacket"]);
            chai.expect(types(main)).deep.equals([]);
        });

        it("restarts a stale extension frame instead of spawning another", () => {
            const ext = addChannelFrame(EXT_CHANNEL, "stale");
            send(packet(EXT_CHANNEL), main);
            chai.expect(frames().length).equals(2);
            chai.expect(types(ext)).deep.equals(["run", "messagepacket"]);
        });

        it("just delivers to an extension frame that has the current run", () => {
            const ext = addChannelFrame(EXT_CHANNEL, (driver as any).runId);
            send(packet(EXT_CHANNEL), main);
            chai.expect(frames().length).equals(2);
            chai.expect(types(ext)).deep.equals(["messagepacket"]);
        });

        it("does not spin up an extension frame when the run is single", () => {
            driver.run("", { single: true });
            send(packet(EXT_CHANNEL), main);
            chai.expect(frames().length).equals(1);
        });

        it("prefers the extension over a legacy message simulator for the same channel", () => {
            createDriver({
                messageSimulators: { [EXT_CHANNEL]: { url: LEGACY_URL, aspectRatio: 1, permanent: false } }
            });
            driver.run("");
            send(packet(EXT_CHANNEL), main);
            chai.expect(frames()[1].src.indexOf("legacy.example.com")).equals(-1);
        });
    });

    describe("legacy message simulators", () => {
        it("spins up a legacy frame with the parent origin and language substituted", () => {
            send(packet(LEGACY_CHANNEL), main);
            chai.expect(frames().length).equals(2);
            const legacy = frames()[1];
            chai.expect(legacy.dataset["messagechannel"]).equals(LEGACY_CHANNEL);
            chai.expect(legacy.dataset["permanent"]).equals(undefined);
            chai.expect(legacy.src.indexOf("https://legacy.example.com/sim.html")).equals(0);
            chai.expect(legacy.src.indexOf("parent=" + encodeURIComponent("https://embedder.example.com"))).to.be.greaterThan(0);
            chai.expect(legacy.src.indexOf("lang=fr")).to.be.greaterThan(0);
        });

        it("restarts a stale legacy frame and delivers to a current one", () => {
            const stale = addChannelFrame(LEGACY_CHANNEL, "stale");
            send(packet(LEGACY_CHANNEL), main);
            chai.expect(types(stale)).deep.equals(["run", "messagepacket"]);
            stale.contentWindow.messages = [];
            send(packet(LEGACY_CHANNEL), main);
            chai.expect(frames().length).equals(2);
            chai.expect(types(stale)).deep.equals(["messagepacket"]);
        });
    });

    describe("suppression and forwarding", () => {
        it("does not spin up frames with nestedEditorSim", () => {
            createDriver({ nestedEditorSim: true });
            driver.run("");
            send(radio, main);
            send(packet(EXT_CHANNEL), main);
            chai.expect(frames().length).equals(1);
        });

        it("does not spin up frames for toParentIFrameOnly messages", () => {
            send({ ...radio, toParentIFrameOnly: true }, main);
            chai.expect(frames().length).equals(1);
        });

        it("forwards to dependent editors with the editor origin instead of spinning up frames", () => {
            const posted: [any, string][] = [];
            // the driver drops dependent editors whose window has no parent (closed windows)
            const editor = { parent: {}, postMessage: (m: any, o: string) => posted.push([m, o]) };
            const sourceEditor = { parent: {}, postMessage: (m: any, o: string) => posted.push([m, "source"]) };
            driver.registerDependentEditor(editor as any);
            driver.registerDependentEditor(sourceEditor as any);
            driver.postMessage({ ...radio, broadcast: true } as any, sourceEditor as any);
            chai.expect(frames().length).equals(1);
            chai.expect(posted.map(p => p[1])).deep.equals([EDITOR_ORIGIN]);
        });

        it("posts to the parent window without restriction, but not back to the parent", () => {
            const posted: [any, string][] = [];
            const parent = { postMessage: (m: any, o: string) => posted.push([m, o]) };
            (global as any).window.parent = parent;
            driver.postMessage({ ...radio, broadcast: true } as any, main.contentWindow as any);
            chai.expect(posted.map(p => p[1])).deep.equals(["*"]);
            posted.length = 0;
            driver.postMessage({ ...radio, broadcast: true } as any, parent as any);
            chai.expect(posted).deep.equals([]);
        });

        it("posts only to the hardware debugger when one is attached", () => {
            const posted: string[] = [];
            (driver as any).hwdbg = { postMessage: (m: pxsim.SimulatorMessage) => posted.push(m.type) };
            driver.postMessage({ type: "custom" } as any);
            chai.expect(posted).deep.equals(["custom"]);
            chai.expect(types(main)).deep.equals([]);
        });

        it("posts a message without a source to every frame and spins up nothing", () => {
            const second = addBoardFrame((driver as any).runId);
            driver.postMessage({ ...radio, broadcast: true } as any);
            chai.expect(frames().length).equals(2);
            chai.expect(types(main)).deep.equals(["radiopacket"]);
            chai.expect(types(second)).deep.equals(["radiopacket"]);
        });

        it("posts only to the requested frame id", () => {
            const second = addBoardFrame((driver as any).runId);
            driver.postMessage({ type: "custom" } as any, undefined, second.id);
            chai.expect(types(main)).deep.equals([]);
            chai.expect(types(second)).deep.equals(["custom"]);
        });

        it("starts only one recorder", () => {
            const second = addBoardFrame((driver as any).runId);
            driver.postMessage({ type: "recorder", action: "start" } as any);
            chai.expect(types(main)).deep.equals(["recorder"]);
            chai.expect(types(second)).deep.equals([]);
        });
    });
});
