import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { createHarness, flushAsync, loadModule, microbitDevice, microbitFilters } from "./testUtils";

// Optional cross-repository integration coverage: load the real target wrapper,
// while mocking Cortex hardware access and USB responses. Core-only CI does not
// require a checkout of pxt-microbit to run the transport/contract tests.
const microbitRoot = process.env.PXT_MICROBIT_PATH || path.resolve("../pxt-microbit");
const flashFile = path.join(microbitRoot, "editor/flash.ts");
const describeMicrobit = fs.existsSync(flashFile) ? describe : describe.skip;

describeMicrobit("sibling pxt-microbit DAP wrapper integration", () => {
    for (const bulk of [false, true]) {
        for (const codal of [false, true]) {
            it(`flashes ${codal ? "v2/CODAL" : "v1/DAL"} through ${bulk ? "bulk" : "control"} without HF2 traffic`, async () => {
                const h = createHarness(); h.pxt.usb.setFilters(microbitFilters);
                h.context.window = { location: { href: "https://localhost/" } };
                class FakeDAP { }
                class FakeCortex {
                    async init(): Promise<void> { }
                    async reset(): Promise<void> { }
                }
                h.context.DapJS = { DAP: FakeDAP, CortexM: FakeCortex };
                const dev = microbitDevice(bulk); h.usb.devices = [dev];
                dev.onWrite = data => {
                    if (data[0] === 0) dev.receive([0, 3, 48, 50, 53]);
                    else dev.receive([data[0], 0]);
                };
                const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync(); await io.reconnectAsync();
                const target = loadModule(h, flashFile);
                const wrapper = target.mkDAPLinkPacketIOWrapper(io);
                wrapper.usesCODAL = codal;
                // Force the target's real vendor-command flash branch. Cortex debug
                // reads are hardware-specific and are not simulated by this test.
                wrapper.readUICR = async () => 1;
                wrapper.checkStateAsync = async () => { };
                const variant = codal ? "mbcodal" : "mbdal";
                const hex = ":1000000000000000000000000000000000000000F0\n".repeat(20) + ":00000001FF\n";
                const progress: number[] = [];
                const flash = wrapper.reflashAsync({ outfiles: { [`${variant}-${h.pxtc.BINARY_HEX}`]: hex } },
                    (value: number) => progress.push(value));
                await h.clock.tickAsync(200); await flash;
                const commands = dev.writes.map(write => write.data[0]);
                assert.deepEqual(commands.slice(0, 6), [0, 0, 0, 0, 0, 0x8a]);
                assert.deepEqual(commands.slice(-2), [0x8b, 0x89]);
                const written = dev.writes.filter(write => write.data[0] === 0x8c)
                    .map(write => Buffer.from(write.data.slice(2, 2 + write.data[1])));
                assert.equal(Buffer.concat(written).toString(), hex);
                assert.ok(progress.every(value => value >= 0 && value <= 1));
                assert.equal(io.isConnected(), true);
                const disconnect = wrapper.disconnectAsync(); await h.clock.tickAsync(200); await disconnect;
                await io.disposeAsync();
            });
        }

        it(`recovers stale DAP command responses over ${bulk ? "bulk" : "control"}`, async () => {
            const h = createHarness(); h.pxt.usb.setFilters(microbitFilters);
            h.context.window = { location: { href: "https://localhost/" } };
            h.context.DapJS = { DAP: class { }, CortexM: class { } };
            const dev = microbitDevice(bulk); h.usb.devices = [dev];
            const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync(); await io.reconnectAsync();
            const wrapper = loadModule(h, flashFile).mkDAPLinkPacketIOWrapper(io);
            dev.onWrite = data => {
                dev.receive([0x81, 0]);
                dev.receive([data[0], 0]);
            };
            const response = await wrapper.dapCmd(new Uint8Array([0x83]));
            assert.equal(response[0], 0x83); assert.equal(io.isConnected(), true);
            await flushAsync(); await io.disposeAsync();
        });
    }
});