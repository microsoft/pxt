import * as assert from "assert";
import { createHarness, Deferred, FakeDevice, flushAsync, microbitDevice, microbitFilters, rejectsAsync } from "./testUtils";

describe("WebUSB connection lifecycle", () => {
    it("publishes reconnect ownership before reentrant connection notifications", async () => {
        const h = createHarness(); const dev = new FakeDevice(); h.usb.devices = [dev];
        const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync();
        let nested: Promise<void>;
        io.onConnectionChanged = () => { if (!nested && io.isConnecting()) nested = io.reconnectAsync(); };
        const reconnect = io.reconnectAsync();
        await reconnect; await nested;
        assert.equal(dev.opens, 1); assert.equal(io.isConnected(), true);
        io.onConnectionChanged = () => { }; await io.disposeAsync();
    });

    it("cancels enumeration fallback when the picker selects a device being opened", async () => {
        const h = createHarness(); const a = new FakeDevice(); const b = new FakeDevice(); b.serialNumber = "b";
        h.usb.devices = [a, b]; h.usb.selected = a;
        const claim = new Deferred<void>(); a.onClaim = () => claim.promise;
        const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync();
        const connecting = rejectsAsync(io.reconnectAsync(), /Disconnected/);
        await flushAsync(); await h.pxt.usb.pairAsync(); await connecting;
        claim.reject(new Error("claim failed")); await flushAsync();
        assert.equal(b.opens, 0);
        await io.disposeAsync();
    });

    it("honors the browser picker instead of the first previously paired board", async () => {
        const h = createHarness();
        const a = new FakeDevice();
        const b = new FakeDevice(); b.serialNumber = "board-b";
        h.usb.devices = [a, b]; h.usb.selected = b;
        await h.pxt.usb.pairAsync();
        const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync();
        await io.reconnectAsync();
        assert.equal(a.opens, 0); assert.equal(b.opens, 1);
        await io.disposeAsync();
    });

    it("never falls back to another board while the selected board re-enumerates", async () => {
        const h = createHarness();
        const a = new FakeDevice();
        const b = new FakeDevice(); b.serialNumber = "board-b";
        h.usb.devices = [a];
        const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync();
        await io.reconnectAsync();
        h.usb.devices = [b];
        await rejectsAsync(io.reconnectAsync(), /Device not found/);
        assert.equal(b.opens, 0);
        const boot = new FakeDevice(); boot.productId++;
        h.usb.devices = [b, boot];
        await io.reconnectAsync();
        assert.equal(boot.opens, 1);
        await io.disposeAsync();
    });

    it("closes a failed claim before trying the next device", async () => {
        const h = createHarness();
        const a = new FakeDevice(); a.onClaim = async () => { throw new Error("claim failed"); };
        const b = new FakeDevice(); b.serialNumber = "board-b";
        h.usb.devices = [a, b];
        const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync();
        await io.reconnectAsync();
        assert.equal(a.closes, 1); assert.equal(a.opened, false); assert.equal(b.opened, true);
        await io.disposeAsync();
    });

    it("coalesces concurrent reconnects", async () => {
        const h = createHarness(); const dev = new FakeDevice(); h.usb.devices = [dev];
        const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync();
        await Promise.all([io.reconnectAsync(), io.reconnectAsync()]);
        assert.equal(dev.opens, 1);
        await io.disposeAsync();
    });

    it("selects the matching configuration and alternate", async () => {
        const h = createHarness(); const dev = new FakeDevice(); h.usb.devices = [dev];
        dev.configurations[0].configurationValue = 3;
        const iface = dev.configurations[0].interfaces[0];
        iface.alternate = Object.assign({}, iface.alternate, { alternateSetting: 0, interfaceSubclass: 99 });
        iface.alternates[0].alternateSetting = 2;
        const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync();
        await io.reconnectAsync();
        assert.deepEqual(dev.selectedConfigurations, [3]); assert.deepEqual(dev.selectedAlternates, [2]);
        await io.disposeAsync();
    });

    it("retires old pending reads even if native close does not settle them", async () => {
        const h = createHarness(); const dev = new FakeDevice(); h.usb.devices = [dev];
        dev.rejectReadsOnClose = false;
        const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync();
        const received: number[][] = []; io.onData = data => received.push(Array.from(data));
        await io.reconnectAsync(); await flushAsync();
        const oldRead = dev.reads[0].result;
        await io.reconnectAsync(); await flushAsync();
        oldRead.resolve({ status: "ok", data: new DataView(new Uint8Array([0x41, 99]).buffer) });
        await flushAsync();
        dev.receive([0x41, 42], 7); await flushAsync();
        assert.deepEqual(received, [[0x41, 42]]);
        assert.equal(io.isConnected(), true);
        await io.disposeAsync();
    });

    it("ignores failures from an old connection's read", async () => {
        const h = createHarness(); const dev = new FakeDevice(); h.usb.devices = [dev];
        dev.rejectReadsOnClose = false;
        const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync();
        let errors = 0; io.onError = () => ++errors;
        await io.reconnectAsync(); await flushAsync();
        const oldRead = dev.reads[0].result;
        await io.reconnectAsync(); oldRead.reject(new Error("old transfer")); await flushAsync();
        assert.equal(errors, 0); assert.equal(io.isConnected(), true);
        await io.disposeAsync();
    });

    it("cancels a pending open without blocking disposal and closes its late completion", async () => {
        const h = createHarness(); const dev = new FakeDevice(); h.usb.devices = [dev];
        const open = new Deferred<void>(); dev.onOpen = () => open.promise;
        const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync();
        const connecting = rejectsAsync(io.reconnectAsync(), /Disconnected/);
        await flushAsync(); await io.disposeAsync(); await connecting;
        open.resolve(); await flushAsync();
        assert.equal(dev.opened, false); assert.equal(io.isConnected(), false);
        assert.equal(h.usb.listeners.connect.length, 0);
    });

    it("bounds a stuck native open and permits a new device object", async () => {
        const h = createHarness(); const dev = new FakeDevice(); h.usb.devices = [dev];
        const open = new Deferred<void>(); dev.onOpen = () => open.promise;
        const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync();
        const failed = rejectsAsync(io.reconnectAsync(), /Device in use/);
        await h.clock.tickAsync(5000); await failed;
        const replacement = new FakeDevice(); h.usb.devices = [replacement];
        await io.reconnectAsync();
        open.resolve(); await flushAsync();
        assert.equal(dev.opened, false); assert.equal(replacement.opened, true);
        await io.disposeAsync();
    });

    it("clears endpoints when switching from bulk to control mode", async () => {
        const h = createHarness(); const dev = new FakeDevice(); h.usb.devices = [dev];
        const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync(); await io.reconnectAsync();
        const boot = new FakeDevice(42, false); h.usb.devices = [boot];
        await io.reconnectAsync(); await io.sendPacketAsync(new Uint8Array([1]));
        assert.equal(boot.writes[0].kind, "control"); assert.equal(boot.reads[0].kind, "control");
        await io.disposeAsync();
    });
});

for (const bulk of [false, true]) {
    describe(`micro:bit DAP ${bulk ? "bulk" : "control"} transport`, () => {
        it("does not start an HF2 reader and preserves short DAP packets and DataView slices", async () => {
            const h = createHarness(); h.pxt.usb.setFilters(microbitFilters);
            const dev = microbitDevice(bulk); h.usb.devices = [dev];
            const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync(); await io.reconnectAsync();
            assert.equal(dev.reads.length, 0);
            await io.sendPacketAsync(new Uint8Array([0, 4]));
            const read = io.recvPacketAsync(); dev.receive([0, 3, 48, 50, 53], 8);
            assert.deepEqual(Array.from(await read), [0, 3, 48, 50, 53]);
            assert.equal(dev.writes[0].data.length, 2);
            await io.disposeAsync();
        });

        it("retains the native read across the 50ms DAP recovery timeout", async () => {
            const h = createHarness(); h.pxt.usb.setFilters(microbitFilters);
            const dev = microbitDevice(bulk); h.usb.devices = [dev];
            const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync(); await io.reconnectAsync();
            const timeout = rejectsAsync(io.recvPacketAsync(50), /Timeout/);
            await h.clock.tickAsync(50); await timeout;
            assert.equal(io.isConnected(), true); assert.equal(dev.closes, 0);
            dev.receive([0x83, 0]); await flushAsync();
            assert.deepEqual(Array.from(await io.recvPacketAsync()), [0x83, 0]);
            assert.equal(dev.reads.length, 1);
            await io.disposeAsync();
        });

        it("keeps zero/default timeouts unbounded and serializes concurrent reads", async () => {
            const h = createHarness(); h.pxt.usb.setFilters(microbitFilters);
            const dev = microbitDevice(bulk); h.usb.devices = [dev];
            const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync(); await io.reconnectAsync();
            const first = io.recvPacketAsync(0); const second = io.recvPacketAsync();
            await h.clock.tickAsync(6000); assert.equal(dev.reads.length, 1);
            dev.receive([1]); assert.deepEqual(Array.from(await first), [1]);
            await flushAsync(); dev.receive([2]); assert.deepEqual(Array.from(await second), [2]);
            await io.disposeAsync();
        });

        it("rejects short writes rather than treating them as successful", async () => {
            const h = createHarness(); h.pxt.usb.setFilters(microbitFilters);
            const dev = microbitDevice(bulk); dev.bytesWritten = 1; h.usb.devices = [dev];
            const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync(); await io.reconnectAsync();
            await rejectsAsync(io.sendPacketAsync(new Uint8Array([0, 4])), /transfer failed/);
            await io.disposeAsync();
        });

        it("cancels manual DAP reads promptly on disconnect", async () => {
            const h = createHarness(); h.pxt.usb.setFilters(microbitFilters);
            const dev = microbitDevice(bulk); dev.rejectReadsOnClose = false; h.usb.devices = [dev];
            const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync(); await io.reconnectAsync();
            const read = rejectsAsync(io.recvPacketAsync(), /Disconnected/);
            await flushAsync(); await io.disconnectAsync(); await read;
            await io.disposeAsync();
        });

        it("does not collect an already resolved retained read after disconnect", async () => {
            const h = createHarness(); h.pxt.usb.setFilters(microbitFilters);
            const dev = microbitDevice(bulk); h.usb.devices = [dev];
            const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync(); await io.reconnectAsync();
            const timeout = rejectsAsync(io.recvPacketAsync(50), /Timeout/);
            await h.clock.tickAsync(50); await timeout;
            dev.receive([0x83, 0]); await flushAsync();
            const read = rejectsAsync(io.recvPacketAsync(), /Disconnected/);
            await io.disconnectAsync(); await read; await io.disposeAsync();
        });
    });
}