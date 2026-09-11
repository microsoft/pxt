import * as assert from "assert";
import { createHarness, Deferred, FakeHF2, flushAsync, Harness, loadModule, rejectsAsync, typedError } from "./testUtils";

function deployHarness() {
    const h = createHarness();
    const io = new FakeHF2(h);
    const wrapper = new h.pxt.HF2.Wrapper(io);
    let flashes = 0; let reconnects = 0; let fallbacks = 0; let pairs = 0; let hidden = 0;
    h.context.window = { location: { href: "https://localhost/" } };
    wrapper.reflashAsync = async () => { ++flashes; };
    wrapper.reconnectAsync = async () => { ++reconnects; };
    h.pxt.packetio.mkPacketIOAsync = async () => io;
    h.pxt.packetio.mkPacketIOWrapper = () => wrapper;
    h.pxt.commands.webUsbPairDialogAsync = async () => { ++pairs; return h.pxt.commands.WebUSBPairResult.Success; };
    const cmds = loadModule(h, "webapp/src/cmds.ts", {
        "./core": {
            showLoading: () => { }, updateLoadingCompletion: () => { }, hideLoading: () => { ++hidden; },
            infoNotification: () => { }, confirmAsync: async () => 0
        },
        "./data": { mountVirtualApi: () => { } }
    });
    const fallback = async () => { ++fallbacks; };
    const result = { success: true, outfiles: {} } as pxtc.CompileResult;
    return { h, io, wrapper, cmds, fallback, result,
        counts: () => ({ flashes, reconnects, fallbacks, pairs, hidden }) };
}

describe("USB deployment orchestration", () => {
    it("allows retry from fallback instructions without joining the failed attempt", async () => {
        const t = deployHarness(); let attempts = 0;
        t.wrapper.reflashAsync = async () => { if (++attempts === 1) throw typedError("devicenotfound"); };
        const first = t.cmds.hidDeployCoreAsync(t.result, undefined, async () => {
            await t.cmds.hidDeployCoreAsync(t.result, undefined, t.fallback);
        });
        await t.h.clock.tickAsync(1000); await first;
        assert.equal(attempts, 2); assert.equal(t.counts().reconnects, 1); assert.equal(t.counts().fallbacks, 0);
    });

    it("defers same-tab DAP reconnect until the active download finishes", async () => {
        const t = deployHarness(); const flash = new Deferred<void>();
        t.wrapper.reflashAsync = () => flash.promise;
        const deploy = t.cmds.hidDeployCoreAsync(t.result, undefined, t.fallback);
        await t.h.clock.tickAsync(1000);
        const reconnect = t.cmds.maybeReconnectAsync(); await flushAsync();
        assert.equal(t.counts().reconnects, 0);
        flash.resolve(); await deploy; await reconnect;
        assert.equal(t.counts().reconnects, 1);
    });

    it("cancels a pending tab-lock request and permits a new reconnect", async () => {
        const t = deployHarness(); let requests = 0;
        t.h.context.navigator.serviceWorker = { controller: { postMessage: (message: pxt.ServiceWorkerClientMessage) => {
            if (message.action === "packet-io-supported")
                t.cmds.handleServiceWorkerMessageAsync({ action: "packet-io-supported" });
            else if (message.action === "request-packet-io-lock" && ++requests > 1)
                t.cmds.handleServiceWorkerMessageAsync({ action: "packet-io-lock-granted", granted: true, lock: message.lock });
        } } };
        const cancelled = rejectsAsync(t.cmds.maybeReconnectAsync(), /cancelled/);
        await flushAsync(); await t.cmds.disconnectAsync(); await cancelled;
        assert.equal(await t.cmds.maybeReconnectAsync(), true); assert.equal(requests, 2);
    });

    it("coalesces overlapping deploy requests and reconnects exactly once", async () => {
        const t = deployHarness();
        const first = t.cmds.hidDeployCoreAsync(t.result, undefined, t.fallback);
        const second = t.cmds.hidDeployCoreAsync(t.result, undefined, t.fallback);
        assert.equal(first, second);
        await t.h.clock.tickAsync(1000); await first;
        assert.equal(t.counts().flashes, 1); assert.equal(t.counts().reconnects, 1);
    });

    it("stops after cancelled bootloader pairing instead of recursively retrying", async () => {
        const t = deployHarness(); let attempts = 0;
        t.wrapper.reflashAsync = async () => { ++attempts; throw typedError("repairbootloader"); };
        t.h.pxt.commands.webUsbPairDialogAsync = async () => t.h.pxt.commands.WebUSBPairResult.UserRejected;
        const deploy = t.cmds.hidDeployCoreAsync(t.result, undefined, t.fallback);
        await t.h.clock.tickAsync(1000); await deploy;
        assert.equal(attempts, 1); assert.equal(t.counts().fallbacks, 1);
    });

    it("allows one accepted bootloader permission repair", async () => {
        const t = deployHarness(); let attempts = 0;
        t.wrapper.reflashAsync = async () => { if (++attempts === 1) throw typedError("repairbootloader"); };
        const deploy = t.cmds.hidDeployCoreAsync(t.result, undefined, t.fallback);
        await t.h.clock.tickAsync(1000); await deploy;
        assert.equal(attempts, 2); assert.equal(t.counts().pairs, 1); assert.equal(t.counts().fallbacks, 0);
    });

    it("bounds repeated bootloader permission failures", async () => {
        const t = deployHarness(); let attempts = 0;
        t.wrapper.reflashAsync = async () => { ++attempts; throw typedError("repairbootloader"); };
        const deploy = t.cmds.hidDeployCoreAsync(t.result, undefined, t.fallback);
        await t.h.clock.tickAsync(1000); await deploy;
        assert.equal(attempts, 2); assert.equal(t.counts().pairs, 1); assert.equal(t.counts().fallbacks, 1);
    });

    it("falls back and disposes when the second pairing dialog throws", async () => {
        const t = deployHarness();
        t.wrapper.reflashAsync = async () => { throw typedError("repairbootloader"); };
        t.h.pxt.commands.webUsbPairDialogAsync = async () => { throw new Error("Pairing failed"); };
        const deploy = t.cmds.hidDeployCoreAsync(t.result, undefined, t.fallback);
        await t.h.clock.tickAsync(1000); await deploy;
        assert.equal(t.counts().fallbacks, 1); assert.equal(t.h.pxt.packetio.isActive(), false);
    });

    it("cancels the old flash and hides loading before timeout fallback", async () => {
        const t = deployHarness(); const flash = new Deferred<void>(); const order: string[] = [];
        t.wrapper.reflashAsync = () => flash.promise;
        t.wrapper.disconnectAsync = async () => { order.push("disconnect"); flash.reject(new Error("cancelled")); };
        const deploy = t.cmds.hidDeployCoreAsync(t.result, undefined, async () => { order.push("fallback"); });
        await t.h.clock.tickAsync(120000); await deploy;
        assert.deepEqual(order, ["disconnect", "fallback"]);
        assert.equal(t.counts().reconnects, 0); assert.ok(t.counts().hidden > 0);
    });

    it("can pair from failed reconnect without waiting on its own promise", async () => {
        const t = deployHarness(); let attempts = 0;
        t.wrapper.reconnectAsync = async () => { if (++attempts === 1) throw typedError("devicenotfound"); };
        const reconnect = t.cmds.maybeReconnectAsync(true);
        await t.h.clock.tickAsync(1000); assert.equal(await reconnect, true);
        assert.equal(attempts, 2); assert.equal(t.counts().pairs, 1);
    });

    it("acquires the tab lock before flashing and retains it through bootloader repair", async () => {
        const t = deployHarness(); const messages: pxt.ServiceWorkerClientMessage[] = []; let attempts = 0;
        t.h.context.navigator.serviceWorker = { controller: { postMessage: (message: pxt.ServiceWorkerClientMessage) => {
            messages.push(message);
            if (message.action === "packet-io-supported")
                t.cmds.handleServiceWorkerMessageAsync({ action: "packet-io-supported" });
            else if (message.action === "request-packet-io-lock")
                t.cmds.handleServiceWorkerMessageAsync({ action: "packet-io-lock-granted", granted: true, lock: message.lock });
        } } };
        t.wrapper.reflashAsync = async () => {
            assert.ok(messages.some(message => message.action === "request-packet-io-lock"));
            assert.equal(messages.some(message => message.action === "release-packet-io-lock"), false);
            if (++attempts === 1) throw typedError("repairbootloader");
        };
        await t.cmds.hidDeployCoreAsync(t.result, undefined, t.fallback);
        assert.equal(attempts, 2);
        assert.equal(messages.filter(message => message.action === "request-packet-io-lock").length, 1);
    });

    it("handles a denied tab lock as a device error, not an undefined rejection", async () => {
        const t = deployHarness();
        t.h.context.navigator.serviceWorker = { controller: { postMessage: (message: pxt.ServiceWorkerClientMessage) => {
            if (message.action === "packet-io-supported")
                t.cmds.handleServiceWorkerMessageAsync({ action: "packet-io-supported" });
            else if (message.action === "request-packet-io-lock")
                t.cmds.handleServiceWorkerMessageAsync({ action: "packet-io-lock-granted", granted: false, lock: message.lock });
        } } };
        await t.cmds.hidDeployCoreAsync(t.result, undefined, t.fallback);
        assert.equal(t.counts().flashes, 0); assert.equal(t.counts().fallbacks, 1); assert.equal(t.h.errors.length, 0);
    });
});

function serviceWorkerHarness(h: Harness, existingOwner = "owner") {
    const messages: pxt.ServiceWorkerMessage[] = [];
    let onMessage: (event: { data: pxt.ServiceWorkerClientMessage }) => Promise<void>;
    const client = { postMessage: (message: pxt.ServiceWorkerMessage) => {
        messages.push(message);
        if (message.action === "packet-io-status" && existingOwner)
            send({ action: "packet-io-status", hasLock: true, lock: existingOwner });
        if (message.action === "packet-io-lock-disconnect")
            send({ action: "packet-io-lock-disconnect", didDisconnect: false, lock: message.lock });
    } };
    const send = (message: Partial<pxt.ServiceWorkerClientMessage>) => onMessage({
        data: Object.assign({ type: "serviceworkerclient" }, message) as pxt.ServiceWorkerClientMessage
    });
    h.context.self = {
        addEventListener: (type: string, handler: typeof onMessage) => { if (type === "message") onMessage = handler; },
        clients: { matchAll: async () => [client] }
    };
    loadModule(h, "webapp/src/serviceworker.ts");
    return { send, messages };
}

describe("USB service-worker ownership", () => {
    it("never overwrites a granted owner with an older concurrent status scan", async () => {
        const h = createHarness(); const worker = serviceWorkerHarness(h, "");
        await h.clock.tickAsync(5000);
        const first = worker.send({ action: "request-packet-io-lock", lock: "a" });
        await h.clock.tickAsync(500);
        const second = worker.send({ action: "request-packet-io-lock", lock: "b" });
        await h.clock.tickAsync(6000); await first;
        const grants = worker.messages.filter(message => message.action === "packet-io-lock-granted" && message.granted);
        assert.equal(grants.length, 1);
        assert.ok(grants[0].action === "packet-io-lock-granted" && grants[0].lock === "a");
        await worker.send({ action: "release-packet-io-lock", lock: "b" });
        await h.clock.tickAsync(6000); await second;
    });

    it("regrants the current owner without asking it to disconnect", async () => {
        const h = createHarness(); const worker = serviceWorkerHarness(h);
        await worker.send({ action: "request-packet-io-lock", lock: "owner" });
        assert.equal(worker.messages.some(message => message.action === "packet-io-lock-disconnect"), false);
        assert.equal(worker.messages.filter(message => message.action === "packet-io-lock-granted").length, 1);
    });

    it("ignores stale releases and withdraws a cancelled waiter without releasing the owner", async () => {
        const h = createHarness(); const worker = serviceWorkerHarness(h);
        await worker.send({ action: "request-packet-io-lock", lock: "owner" });
        await worker.send({ action: "release-packet-io-lock", lock: "unrelated" });
        const waiting = worker.send({ action: "request-packet-io-lock", lock: "waiter" });
        await h.clock.tickAsync(4000);
        await worker.send({ action: "release-packet-io-lock", lock: "waiter" });
        await h.clock.tickAsync(2000); await waiting;
        assert.equal(worker.messages.some(message => message.action === "packet-io-lock-granted" && message.lock === "waiter" && message.granted), false);
        await worker.send({ action: "request-packet-io-lock", lock: "owner" });
        assert.equal(worker.messages.filter(message => message.action === "packet-io-lock-granted" && message.lock === "owner").length, 2);
    });
});