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
 * and removes simulator frames. An iframe carries a `contentWindow`.
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
        if (child.parentElement) child.parentElement.removeChild(child);
        const index = ref ? this.children.indexOf(ref) : -1;
        if (index < 0) this.children.push(child);
        else this.children.splice(index, 0, child);
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

    /** The driver queries only for pause overlays, which these tests never add. */
    querySelectorAll(selector: string): FakeElement[] {
        return [];
    }

    focus() { }

    private classNames(): string[] {
        return this.className.split(/\s+/).filter(c => !!c);
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

    function createDriver(withHideElement: boolean) {
        const simx = (permanent: boolean) => ({ index: "index.html", aspectRatio: 1, permanent });
        driver = new pxsim.SimulatorDriver(container as unknown as HTMLElement, {
            simUrl: EDITOR_ORIGIN + "/sim/simulator.html",
            simulatorExtensions: {
                [PERMANENT_CHANNEL]: simx(true),
                [TRANSIENT_CHANNEL]: simx(false),
            },
            removeElement: (el, onComplete) => {
                el.parentElement.removeChild(el);
                if (onComplete) onComplete();
            },
            hideElement: withHideElement
                ? (el, onComplete) => {
                    pxsim.U.addClass(el, HIDDEN);
                    if (onComplete) onComplete();
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
        createDriver(true);
    });

    afterEach(() => {
        // cancels the frame cleanup timer that hide() and run() schedule
        (driver as any).unload();
    });

    it("hides a permanent simulator extension frame in place", () => {
        driver.hide(complete);
        chai.expect(frameIds()).deep.equals(["sim-frame-2"]);
        chai.expect(container.children[0]).equals(permanentWrapper);
        chai.expect(pxsim.U.containsClass(permanentWrapper as unknown as HTMLElement, HIDDEN)).equals(true);
        chai.expect(iframe(permanentWrapper).id).equals("sim-frame-2");
        chai.expect(iframe(permanentWrapper).dataset["messagechannel"]).equals(PERMANENT_CHANNEL);
    });

    it("removes the main frame and non-permanent frames on hide", () => {
        driver.hide(complete);
        chai.expect(mainWrapper.parentElement).equals(undefined);
        chai.expect(transientWrapper.parentElement).equals(undefined);
    });

    it("completes the hide for hidden and removed frames", () => {
        driver.hide(complete);
        chai.expect(completions).equals(3);
        driver.hide(complete);
        chai.expect(completions).equals(4);
    });

    it("reveals the same permanent frame on unhide", () => {
        const frame = iframe(permanentWrapper);
        driver.hide();
        driver.unhide();
        chai.expect(container.children.length).equals(1);
        chai.expect(container.children[0]).equals(permanentWrapper);
        chai.expect(pxsim.U.containsClass(permanentWrapper as unknown as HTMLElement, HIDDEN)).equals(false);
        chai.expect(iframe(permanentWrapper)).equals(frame);
        chai.expect(frame.id).equals("sim-frame-2");
    });

    it("starts a run after hide with a new main frame ahead of the hidden permanent frame", () => {
        driver.hide();
        driver.run("");
        chai.expect(container.children.length).equals(2);
        chai.expect(container.children[0]).not.equals(mainWrapper);
        chai.expect(iframe(container.children[0]).dataset["messagechannel"]).equals(undefined);
        chai.expect(container.children[1]).equals(permanentWrapper);
    });

    it("posts a run's channel packets to the hidden permanent frame instead of spawning another", () => {
        driver.hide();
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
        chai.expect(container.children.length).equals(0);
        chai.expect(completions).equals(3);
    });

    it("removes every frame on unload", () => {
        driver.stop(true);
        chai.expect(container.children.length).equals(0);
    });

    it("removes a hidden permanent frame on unload", () => {
        driver.hide();
        driver.stop(true);
        chai.expect(container.children.length).equals(0);
    });

    it("preloads a main frame after hide ahead of the hidden permanent frame", () => {
        driver.hide();
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
});
