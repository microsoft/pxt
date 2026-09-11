import * as assert from "assert";
import { block, createHarness, Deferred, FakeDevice, FakeHF2, flushAsync, rejectsAsync, typedError } from "./testUtils";

describe("Arcade HF2 protocol", () => {
    it("publishes reconnect ownership before HF2 state-change callbacks", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io); let nested: Promise<void>;
        io.onConnectionChanged = () => { if (!nested && !wrapper.isConnected()) nested = wrapper.reconnectAsync(); };
        const reconnect = wrapper.reconnectAsync(); await reconnect; await nested;
        assert.equal(io.reconnects, 1); assert.equal(wrapper.isConnected(), true);
    });

    it("retires queued traffic before releasing a timed-out OUT transfer", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io); const send = new Deferred<void>(); let sends = 0;
        io.sendPacketAsync = () => { ++sends; return send.promise; };
        const command = rejectsAsync(wrapper.talkAsync(0x100), /Timeout/);
        const serial = rejectsAsync(wrapper.sendSerialAsync(new Uint8Array([1])), /Disconnected/);
        await h.clock.tickAsync(5000); await Promise.all([command, serial]);
        assert.equal(sends, 1);
        send.resolve(); await flushAsync(); assert.equal(sends, 1);
    });

    for (const status of [1, 2, -1]) {
        it(`does not fail a valid application connection on optional Jacdac probe status ${status}`, async () => {
            const h = createHarness(); const io = new FakeHF2(h);
            const wrapper = new h.pxt.HF2.Wrapper(io);
            io.handleCommand = (cmd, _data, seq) => {
                if (cmd !== 0x20) return false;
                if (status >= 0) io.respond(seq, undefined, status);
                return true;
            };
            const reconnect = wrapper.reconnectAsync();
            await h.clock.tickAsync(1000); await reconnect;
            assert.equal(wrapper.isConnected(), true); assert.equal(wrapper.jacdacAvailable, false);
            assert.equal(io.reconnects, 1);
        });
    }

    it("serializes entire command/response exchanges", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        let firstSeq: number;
        io.handleCommand = (cmd, _data, seq) => {
            if (cmd !== 0x100) return false;
            firstSeq = seq; return true;
        };
        const first = wrapper.talkAsync(0x100);
        const second = wrapper.talkAsync(0x101);
        await flushAsync(); assert.deepEqual(io.commands, [0x100]);
        io.respond(firstSeq, new Uint8Array([42]));
        assert.deepEqual(Array.from(await first), [42]); await second;
        assert.deepEqual(io.commands, [0x100, 0x101]);
    });

    it("discards incomplete frames and queued commands when disconnected", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        io.handleCommand = cmd => cmd === 0x100;
        const first = rejectsAsync(wrapper.talkAsync(0x100), /Reset|Disconnected/);
        const second = rejectsAsync(wrapper.talkAsync(0x101), /Disconnected/);
        await flushAsync(); io.onData(new Uint8Array([3, 1, 2, 3]));
        await wrapper.disconnectAsync(); await Promise.all([first, second]);
        await wrapper.reconnectAsync();
        assert.equal(wrapper.isConnected(), true); assert.equal(io.commands.includes(0x101), false);
    });

    it("rejects malformed HF2 frames immediately", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        io.handleCommand = cmd => cmd === 0x100;
        const command = rejectsAsync(wrapper.talkAsync(0x100), /Reset|Disconnected/);
        await flushAsync(); io.onData(new Uint8Array([0x4a, 1])); await command;
    });

    it("skips stale sequence replies within a bounded response deadline", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        io.handleCommand = (_cmd, _data, seq) => {
            for (let i = 1; i <= 5; ++i) io.respond(seq - i);
            io.respond(seq, new Uint8Array([9])); return true;
        };
        assert.deepEqual(Array.from(await wrapper.talkAsync(0x100)), [9]);
    });

    it("supports serialized HID-bridge commands and legacy unsupported-command errors", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const pending = new Deferred<Uint8Array[]>(); let calls = 0;
        const bridge = Object.assign(io, {
            talksAsync: async (commands: pxt.packetio.TalkArgs[]): Promise<Uint8Array[]> => {
                ++calls;
                switch (commands[0].cmd) {
                    case 1: return [io.binfo()];
                    case 2: return [new Uint8Array(Buffer.from("UF2 v1.0"))];
                    case 0x20: throw new Error("HID error on test: invalid command");
                    case 0x100: return pending.promise;
                    default: return [new Uint8Array(0)];
                }
            }
        });
        const wrapper = new h.pxt.HF2.Wrapper(bridge);
        await wrapper.reconnectAsync(); assert.equal(wrapper.isConnected(), true);
        calls = 0;
        const a = wrapper.talkAsync(0x100); const b = wrapper.talkAsync(0x101);
        await flushAsync(); assert.equal(calls, 1);
        pending.resolve([new Uint8Array([1])]); await Promise.all([a, b]); assert.equal(calls, 2);
    });

    it("rejects short memory-read responses", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        await rejectsAsync(wrapper.readWordsAsync(0x4000, 1), /memory read length/);
    });
});

describe("Arcade flash lifecycle", () => {
    for (const reenumerates of [false, true]) {
        it(`flashes end-to-end through WebUSB with ${reenumerates ? "re-enumeration" : "direct handover"}`, async () => {
            const h = createHarness(); const firmware = new FakeHF2(h);
            let current: FakeDevice;
            const attach = () => {
                const device = new FakeDevice();
                device.onOpen = async () => { firmware.connected = true; current = device; };
                device.onWrite = data => { firmware.sendPacketAsync(data).catch(error => h.errors.push(error)); };
                h.usb.devices = [device];
                return device;
            };
            current = attach();
            firmware.onData = data => current.receive(data);
            firmware.onDeviceConnectionChanged = connected => {
                if (!connected) {
                    h.usb.emit("disconnect", current);
                    const next = attach(); h.usb.emit("connect", next);
                }
            };
            if (reenumerates) firmware.handleCommand = (cmd, _data, seq) => {
                if (cmd !== 5) return false;
                firmware.respond(seq); firmware.mode = 1; firmware.connected = false;
                firmware.onDeviceConnectionChanged(false); return true;
            };
            const io = await h.pxt.usb.mkWebUSBHIDPacketIOAsync();
            const wrapper = new h.pxt.HF2.Wrapper(io);
            await wrapper.flashAsync([block(h), block(h, 0x4100)]);
            await wrapper.reconnectAsync();
            assert.equal(wrapper.isConnected(), true); assert.equal(wrapper.bootloaderMode, false);
            assert.equal(firmware.writes.length, 2); assert.equal(h.errors.length, 0);
            assert.equal(h.usb.enumerations, reenumerates ? 3 : 2);
            await wrapper.disconnectAsync(); await io.disposeAsync();
        });
    }

    it("uses constant post-write overhead and throttles progress for a large image", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io); const progress: number[] = [];
        const blocks = Array.from({ length: 2048 }, (_value, index) => block(h, 0x4000 + index * 256));
        await wrapper.flashAsync(blocks, value => progress.push(value));
        assert.equal(io.writes.length, 2048); assert.equal(io.commands.includes(8), false);
        assert.deepEqual(io.commands.slice(-2), [1, 3]);
        assert.ok(progress.length <= 101); assert.equal(h.clock.now, 0);
    });

    it("uses direct handover without reconnects or image read-back", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        await wrapper.reconnectAsync();
        const progress: number[] = [];
        await wrapper.flashAsync([block(h), block(h, 0x4100)], value => progress.push(value));
        assert.equal(io.reconnects, 1); assert.equal(io.writes.length, 2);
        assert.equal(io.commands.includes(8), false);
        assert.deepEqual(io.commands.slice(-2), [1, 3]);
        assert.equal(progress[0], 0); assert.equal(progress[progress.length - 1], 1);
        assert.ok(progress.every(value => value >= 0 && value <= 1));
        assert.equal(wrapper.isFlashing(), false); assert.equal(io.connected, false);
        await wrapper.reconnectAsync(); assert.equal(io.reconnects, 2); assert.equal(wrapper.bootloaderMode, false);
    });

    it("waits for the final completion barrier before resetting", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        let barrierSeq: number;
        io.handleCommand = (cmd, _data, seq) => {
            if (cmd === 1 && io.writes.length) { barrierSeq = seq; return true; }
            return false;
        };
        const flash = wrapper.flashAsync([block(h)]);
        await flushAsync();
        await h.clock.tickAsync(4000);
        assert.equal(io.commands.includes(3), false); assert.equal(wrapper.isFlashing(), true);
        io.respond(barrierSeq, io.binfo()); await flash;
        assert.equal(io.commands.includes(3), true);
    });

    it("handles an acknowledged START_FLASH that then re-enumerates", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        io.handleCommand = (cmd, _data, seq) => {
            if (cmd !== 5) return false;
            io.respond(seq);
            io.connected = false; io.mode = 1;
            io.onDeviceConnectionChanged(false); io.onDeviceConnectionChanged(true);
            return true;
        };
        io.onReconnect = async () => {
            if (io.reconnects > 1 && h.clock.now < 2000) throw typedError("devicenotfound");
        };
        const flash = wrapper.flashAsync([block(h)]);
        await h.clock.tickAsync(2000); await flash;
        assert.equal(io.writes.length, 1); assert.equal(io.commands.filter(cmd => cmd === 5).length, 1);
        assert.equal(io.reconnects, 6);
    });

    it("falls back to reset when direct handover is unsupported", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        io.handleCommand = (cmd, _data, seq) => {
            if (cmd !== 5) return false;
            io.respond(seq, undefined, 1); return true;
        };
        await wrapper.flashAsync([block(h)]);
        assert.equal(io.commands.includes(4), true); assert.equal(io.writes.length, 1);
    });

    it("reports missing bootloader permission without touching another board", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        io.handleCommand = (cmd, _data, seq) => {
            if (cmd !== 5) return false;
            io.respond(seq); io.mode = 1; io.connected = false; io.onDeviceConnectionChanged(false); return true;
        };
        io.onReconnect = async () => { if (io.mode === 1) throw typedError("devicenotfound"); };
        let type: string;
        const failed = wrapper.flashAsync([block(h)]).catch(error => { type = error.type; });
        await h.clock.tickAsync(10000); await failed;
        assert.equal(type, "repairbootloader"); assert.equal(io.writes.length, 0);
        assert.equal(wrapper.isFlashing(), false);
    });

    it("cancels a reconnect retry without later reconnecting in the background", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        io.onReconnect = async () => { throw typedError("devicenotfound"); };
        const connecting = rejectsAsync(wrapper.reconnectAsync(), /cancelled/);
        await flushAsync(); const disconnect = wrapper.disconnectAsync();
        await h.clock.tickAsync(500); await disconnect; await connecting;
        const attempts = io.reconnects; await h.clock.tickAsync(20000); assert.equal(io.reconnects, attempts);
        io.onReconnect = async () => { };
        await wrapper.reconnectAsync(); assert.equal(wrapper.isConnected(), true);
    });

    it("rejects overlapping flash and external reconnect calls", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        let seq: number;
        io.handleCommand = (cmd, _data, tag) => {
            if (cmd !== 6) return false;
            seq = tag; return true;
        };
        const flash = wrapper.flashAsync([block(h)]); await flushAsync();
        await rejectsAsync(wrapper.flashAsync([block(h)]), /already in progress/);
        await rejectsAsync(wrapper.reconnectAsync(), /already in progress/);
        io.respond(seq); await flash;
    });

    it("does not write another block or reset after a cancelled flash", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        let disconnect: Promise<void>;
        const failed = rejectsAsync(wrapper.flashAsync([block(h), block(h, 0x4100)], progress => {
            if (progress > 0 && !disconnect) disconnect = wrapper.disconnectAsync();
        }), /cancelled|Disconnected/);
        await failed; await disconnect;
        assert.equal(io.writes.length, 1); assert.equal(io.commands.includes(3), false);
    });

    it("does not report reset protocol rejection as successful flashing", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        io.handleCommand = (cmd, _data, seq) => {
            if (cmd !== 3) return false;
            io.respond(seq, undefined, 2); return true;
        };
        await rejectsAsync(wrapper.flashAsync([block(h)]), /execution error/);
        assert.equal(wrapper.isFlashing(), false); assert.equal(io.connected, false);
    });

    it("requires app mode on the one post-flash reconnect", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        await wrapper.flashAsync([block(h)]); io.mode = 1;
        const failed = rejectsAsync(wrapper.reconnectAsync(), /still in bootloader/);
        await h.clock.tickAsync(10000); await failed;
        assert.equal(wrapper.isConnected(), false);
    });

    it("preserves partial flashing and falls back only for unsupported checksum reads", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        h.pxt.appTarget.compile.flashChecksumAddr = 0x5000;
        h.pxt.appTarget.compile.flashCodeAlign = 256;
        const checksum = block(h, 0x5000);
        checksum.data.fill(0);
        checksum.data.set(h.pxt.HF2.encodeU32LE([0x07eeb07c, 0x6000, 8, 0x00010040, 0x12345678]));
        const blocks = [block(h), block(h, 0x4100), checksum];
        io.handleCommand = (cmd, data, seq) => {
            if (cmd !== 8) return false;
            io.respond(seq, h.pxt.HF2.read32(data, 0) === 0x5000 ? checksum.data.slice(0, 48) : h.pxt.HF2.encodeU32LE([8]));
            return true;
        };
        await wrapper.flashAsync(blocks); assert.equal(io.writes.length, 2);
        io.handleCommand = (cmd, _data, seq) => {
            if (cmd !== 8) return false;
            io.respond(seq, undefined, 1); return true;
        };
        await wrapper.flashAsync(blocks); assert.equal(io.writes.length, 5);
        io.handleCommand = cmd => { if (cmd === 8) throw new Error("Disconnected"); return false; };
        await rejectsAsync(wrapper.flashAsync(blocks), /Disconnected/); assert.equal(io.writes.length, 5);
    });

    it("rejects a different UF2 family before writing", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io); const wrong = block(h); wrong.familyId++;
        await rejectsAsync(wrapper.flashAsync([wrong]), /does not match/);
        assert.equal(io.writes.length, 0);
    });

    it("does not send UF2 metadata blocks to flash", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        const metadata = block(h, 0); metadata.flags = h.pxtc.UF2.UF2_FLAG_NOFLASH;
        await wrapper.flashAsync([metadata, block(h)]); assert.equal(io.writes.length, 1);
        assert.equal(h.pxt.HF2.read32(io.writes[0], 0), 0x4000);
    });

    it("rejects missing or truncated UF2 output instead of flashing a subset", async () => {
        const h = createHarness(); const io = new FakeHF2(h);
        const wrapper = new h.pxt.HF2.Wrapper(io);
        const result = { outfiles: {} } as pxtc.CompileResult;
        await rejectsAsync(wrapper.reflashAsync(result), /Missing UF2/);
        result.outfiles[h.pxtc.BINARY_UF2] = Buffer.from(new Uint8Array(513)).toString("base64");
        await rejectsAsync(wrapper.reflashAsync(result), /Invalid UF2/);
        assert.equal(io.commands.length, 0);
    });
});