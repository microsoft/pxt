import * as assert from "assert";
import { createHarness, Deferred, FakeHF2, flushAsync } from "./testUtils";

describe("packetio ownership", () => {
    it("disposes a wrapper whose async creation overlaps disconnect", async () => {
        const h = createHarness(); const pending = new Deferred<pxt.packetio.PacketIO>();
        const io = new FakeHF2(h); let disposed = 0;
        io.disposeAsync = async () => { ++disposed; };
        h.pxt.packetio.mkPacketIOAsync = () => pending.promise;
        h.pxt.packetio.mkPacketIOWrapper = h.pxt.HF2.mkHF2PacketIOWrapper;
        const init = h.pxt.packetio.initAsync(); const disconnect = h.pxt.packetio.disconnectAsync();
        pending.resolve(io); await Promise.all([init, disconnect]);
        assert.equal(disposed, 1); assert.equal(h.pxt.packetio.isActive(), false);
    });

    it("does not erase a new wrapper when old disposal finishes", async () => {
        const h = createHarness(); const pending = new Deferred<void>(); let created = 0;
        h.pxt.packetio.mkPacketIOAsync = async () => {
            ++created;
            const io = new FakeHF2(h);
            if (created === 1) io.disposeAsync = () => pending.promise;
            return io;
        };
        h.pxt.packetio.mkPacketIOWrapper = h.pxt.HF2.mkHF2PacketIOWrapper;
        const old = await h.pxt.packetio.initAsync();
        const disconnect = h.pxt.packetio.disconnectAsync(); const next = h.pxt.packetio.initAsync();
        await flushAsync(); assert.equal(created, 1);
        pending.resolve(); await disconnect;
        assert.notEqual(await next, old); assert.equal(h.pxt.packetio.isActive(), true);
        await h.pxt.packetio.disconnectAsync();
    });

    it("always disposes resources even if wrapper disconnect fails", async () => {
        const h = createHarness(); const io = new FakeHF2(h); let disposed = false;
        io.disconnectAsync = async () => { throw new Error("disconnect failure"); };
        io.disposeAsync = async () => { disposed = true; };
        h.pxt.packetio.mkPacketIOAsync = async () => io;
        h.pxt.packetio.mkPacketIOWrapper = h.pxt.HF2.mkHF2PacketIOWrapper;
        await h.pxt.packetio.initAsync(); await h.pxt.packetio.disconnectAsync();
        assert.equal(disposed, true); assert.equal(h.pxt.packetio.isActive(), false); assert.equal(h.errors.length, 1);
    });

    it("serializes forced initialization without duplicate live wrappers", async () => {
        const h = createHarness(); let created = 0; let disposed = 0;
        h.pxt.packetio.mkPacketIOAsync = async () => {
            ++created; const io = new FakeHF2(h); io.disposeAsync = async () => { ++disposed; }; return io;
        };
        h.pxt.packetio.mkPacketIOWrapper = h.pxt.HF2.mkHF2PacketIOWrapper;
        await Promise.all([h.pxt.packetio.initAsync(), h.pxt.packetio.initAsync(true), h.pxt.packetio.initAsync()]);
        assert.equal(created, 2); assert.equal(disposed, 1); await h.pxt.packetio.disconnectAsync();
    });
});