/// <reference path="../../built/pxtlib.d.ts"/>

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";
import * as compiler from "typescript";

export class Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    done = false;

    constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = value => { this.done = true; resolve(value); };
            this.reject = error => { this.done = true; reject(error); };
        });
    }
}

export async function flushAsync(): Promise<void> {
    // Drain chained transport/queue continuations without real wall-clock sleeps.
    for (let i = 0; i < 1000; ++i) await Promise.resolve();
}

export class Clock {
    now = 0;
    private nextId = 0;
    private timers = new Map<number, { time: number; callback: () => void }>();
    setTimeout = (callback: () => void, delay = 0): number => {
        const id = ++this.nextId;
        this.timers.set(id, { time: this.now + delay, callback });
        return id;
    };
    clearTimeout = (id: number): void => { this.timers.delete(id); };

    async tickAsync(ms: number): Promise<void> {
        const end = this.now + ms;
        await flushAsync();
        for (let i = 0; i < 10000; ++i) {
            const next = Array.from(this.timers.entries())
                .filter(([, timer]) => timer.time <= end)
                .sort((a, b) => a[1].time - b[1].time)[0];
            if (!next) {
                this.now = end;
                await flushAsync();
                return;
            }
            this.now = next[1].time;
            this.timers.delete(next[0]);
            next[1].callback();
            await flushAsync();
        }
        throw new Error("Fake clock did not become idle");
    }
}

export interface Harness {
    pxt: typeof pxt;
    pxtc: typeof pxtc;
    context: vm.Context;
    clock: Clock;
    usb: FakeUSB;
    errors: Error[];
}

const library = fs.readFileSync(path.resolve("built/pxtlib.js"), "utf8");

export function createHarness(): Harness {
    const clock = new Clock();
    const usb = new FakeUSB();
    class TestDate extends Date { static now() { return clock.now; } }
    const context = vm.createContext({
        console, Uint8Array, Uint16Array, Uint32Array, ArrayBuffer, DataView, Error, TextDecoder, TextEncoder,
        Date: TestDate,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        navigator: { usb },
        atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
        btoa: (value: string) => Buffer.from(value, "binary").toString("base64")
    });
    vm.runInContext(library, context);
    context.pxtc = context.ts.pxtc;
    const runtime: typeof pxt = context.pxt;
    runtime.appTarget = { compile: { useUF2: true, webUSB: true }, appTheme: {} } as pxt.TargetBundle;
    const errors: Error[] = [];
    runtime.debug = runtime.log = () => { };
    runtime.U.getRandomBuf = buffer => { buffer.fill(7); };
    runtime.tickEvent = () => { };
    runtime.reportException = error => { errors.push(error); };
    context.lf = runtime.U.lf;
    return { pxt: runtime, pxtc: context.pxtc, context, clock, usb, errors };
}

export function loadModule(h: Harness, filename: string, imports: { [key: string]: unknown } = {}): any {
    const text = fs.readFileSync(path.resolve(filename), "utf8");
    const js = compiler.transpileModule(text, {
        compilerOptions: { target: compiler.ScriptTarget.ES2017, module: compiler.ModuleKind.CommonJS }
    }).outputText;
    const module = { exports: {} };
    const run = vm.runInContext(`(function(require, module, exports) { ${js}\n})`, h.context);
    run((id: string) => imports[id] || {}, module, module.exports);
    return module.exports;
}

export function typedError(type: string): Error {
    return Object.assign(new Error(type), { type });
}

export async function rejectsAsync(promise: Promise<unknown>, match: RegExp): Promise<void> {
    let error: Error;
    try { await promise; } catch (e) { error = e; }
    assert.ok(error, "expected rejection");
    assert.ok(match.test(String(error)), String(error));
}

export class FakeUSB {
    devices: FakeDevice[] = [];
    selected: FakeDevice;
    enumerations = 0;
    listeners: { [key: string]: ((event: { device: pxt.usb.USBDevice }) => void)[] } = {};
    getDevices = async (): Promise<pxt.usb.USBDevice[]> => {
        ++this.enumerations;
        return this.devices.map(device => device.asUSB());
    };
    requestDevice = async (): Promise<pxt.usb.USBDevice> => this.selected?.asUSB();
    addEventListener = (type: string, callback: (event: { device: pxt.usb.USBDevice }) => void): void => {
        (this.listeners[type] || (this.listeners[type] = [])).push(callback);
    };
    removeEventListener = (type: string, callback: (event: { device: pxt.usb.USBDevice }) => void): void => {
        this.listeners[type] = (this.listeners[type] || []).filter(listener => listener !== callback);
    };
    emit(type: string, device: FakeDevice): void {
        for (const listener of this.listeners[type] || []) listener({ device: device.asUSB() });
    }
}

export class FakeDevice {
    vendorId = 0x239a;
    productId = 0x0015;
    manufacturerName = "Test";
    productName = "Arcade";
    serialNumber = "board-a";
    opened = false;
    opens = 0;
    closes = 0;
    configurations: pxt.usb.USBConfiguration[];
    selectedConfigurations: number[] = [];
    selectedAlternates: number[] = [];
    writes: { kind: string; endpoint: number; data: Uint8Array }[] = [];
    reads: { kind: string; endpoint: number; result: Deferred<pxt.usb.USBInTransferResult> }[] = [];
    incoming: pxt.usb.USBInTransferResult[] = [];
    rejectReadsOnClose = true;
    onWrite: (data: Uint8Array) => void = () => { };
    onOpen: () => Promise<void> = async () => { };
    onClaim: () => Promise<void> = async () => { };
    bytesWritten: number;

    constructor(subclass = 42, endpoints = true) {
        const alternate: pxt.usb.USBAlternateInterface = {
            interfaceClass: 255, interfaceSubclass: subclass, interfaceProtocol: 0,
            alternateSetting: 0, interfaceName: "USB",
            endpoints: endpoints ? [
                { direction: "in", endpointNumber: 1, packetSize: 64, type: "bulk" },
                { direction: "out", endpointNumber: 2, packetSize: 64, type: "bulk" }
            ] : []
        };
        this.configurations = [{
            configurationValue: 1, configurationName: "USB",
            interfaces: [{ interfaceNumber: 4, alternate, alternates: [alternate], claimed: false }]
        }];
    }

    asUSB(): pxt.usb.USBDevice { return this as unknown as pxt.usb.USBDevice; }
    async open(): Promise<void> { ++this.opens; await this.onOpen(); this.opened = true; }
    async close(): Promise<void> {
        ++this.closes;
        this.opened = false;
        this.incoming = [];
        if (this.rejectReadsOnClose)
            for (const read of this.reads) if (!read.result.done) read.result.reject(new Error("Disconnected"));
    }
    async forget(): Promise<void> { }
    async selectConfiguration(value: number): Promise<void> { this.selectedConfigurations.push(value); }
    async claimInterface(_value: number): Promise<void> { await this.onClaim(); }
    async selectAlternateInterface(_iface: number, setting: number): Promise<void> { this.selectedAlternates.push(setting); }
    private async write(kind: string, endpoint: number, data: Uint8Array): Promise<pxt.usb.USBOutTransferResult> {
        this.writes.push({ kind, endpoint, data: data.slice() });
        this.onWrite(data);
        return { status: "ok", bytesWritten: this.bytesWritten === undefined ? data.length : this.bytesWritten };
    }
    transferOut(endpoint: number, data: Uint8Array): Promise<pxt.usb.USBOutTransferResult> { return this.write("bulk", endpoint, data); }
    controlTransferOut(setup: pxt.usb.USBControlTransferParameters, data: Uint8Array): Promise<pxt.usb.USBOutTransferResult> {
        return this.write("control", setup.index, data);
    }
    private read(kind: string, endpoint: number): Promise<pxt.usb.USBInTransferResult> {
        const result = new Deferred<pxt.usb.USBInTransferResult>();
        this.reads.push({ kind, endpoint, result });
        if (this.incoming.length) result.resolve(this.incoming.shift());
        return result.promise;
    }
    transferIn(endpoint: number): Promise<pxt.usb.USBInTransferResult> { return this.read("bulk", endpoint); }
    controlTransferIn(setup: pxt.usb.USBControlTransferParameters): Promise<pxt.usb.USBInTransferResult> { return this.read("control", setup.index); }
    receive(data: number[] | Uint8Array, offset = 0): void {
        const buffer = new Uint8Array(data.length + offset + 3);
        buffer.set(data, offset);
        const result: pxt.usb.USBInTransferResult = { status: "ok", data: new DataView(buffer.buffer, offset, data.length) };
        const waiting = this.reads.find(read => !read.result.done);
        if (waiting) waiting.result.resolve(result);
        else this.incoming.push(result);
    }
}

export const microbitFilters: pxt.usb.USBDeviceFilter[] = [
    { vendorId: 0x0d28, productId: 0x0204, classCode: 255, subclassCode: 3 },
    { vendorId: 0x0d28, productId: 0x0204, classCode: 255, subclassCode: 0 }
];

export function microbitDevice(bulk: boolean): FakeDevice {
    const device = new FakeDevice(bulk ? 0 : 3, bulk);
    device.vendorId = 0x0d28;
    device.productId = 0x0204;
    device.productName = "BBC micro:bit";
    return device;
}

export class FakeHF2 implements pxt.packetio.PacketIO {
    connected = true;
    reconnects = 0;
    disconnects = 0;
    mode = 2;
    family = 0x55114460;
    commands: number[] = [];
    packets: Uint8Array[] = [];
    writes: Uint8Array[] = [];
    private frames: number[] = [];
    onDeviceConnectionChanged = (_connected: boolean) => { };
    onConnectionChanged = () => { };
    onData = (_data: Uint8Array) => { };
    onError = (_error: Error) => { };
    onEvent = (_data: Uint8Array) => { };
    onReconnect: () => Promise<void> = async () => { };
    handleCommand: (cmd: number, data: Uint8Array, seq: number) => boolean = () => false;

    constructor(private h: Harness) { }
    isConnected(): boolean { return this.connected; }
    isConnecting(): boolean { return false; }
    error(message: string): never { throw new Error(message); }
    async reconnectAsync(): Promise<void> { ++this.reconnects; await this.onReconnect(); this.connected = true; }
    async disconnectAsync(): Promise<void> { ++this.disconnects; this.connected = false; this.frames = []; }
    async disposeAsync(): Promise<void> { }
    binfo(): Uint8Array { return this.h.pxt.HF2.encodeU32LE([this.mode, 256, 2048, 1024, this.family]); }
    respond(seq: number, payload = new Uint8Array(0), status = 0): void {
        const response = new Uint8Array(payload.length + 4);
        this.h.pxt.HF2.write16(response, 0, seq);
        response[2] = status;
        response.set(payload, 4);
        for (let i = 0; i < response.length; i += 63) {
            const length = Math.min(63, response.length - i);
            const packet = new Uint8Array(length + 1);
            packet[0] = length | (i + length === response.length ? 0x40 : 0);
            packet.set(response.slice(i, i + length), 1);
            this.onData(packet);
        }
    }
    async sendPacketAsync(packet: Uint8Array): Promise<void> {
        if (!this.connected) throw new Error("Disconnected");
        this.packets.push(packet.slice());
        if (packet[0] & 0x80) return;
        this.frames.push(...Array.from(packet.slice(1, 1 + (packet[0] & 63))));
        if (!(packet[0] & 0x40)) return;
        const message = new Uint8Array(this.frames);
        this.frames = [];
        const hf2 = this.h.pxt.HF2;
        const cmd = hf2.read32(message, 0);
        const seq = hf2.read16(message, 4);
        const data = message.slice(8);
        this.commands.push(cmd);
        if (this.handleCommand(cmd, data, seq)) return;
        switch (cmd) {
            case 1: this.respond(seq, this.binfo()); break;
            case 2: this.respond(seq, new Uint8Array(Buffer.from("UF2 Bootloader v1.0\nModel: Test\nBoard-ID: TEST\n"))); break;
            case 3:
                this.mode = 2;
                this.connected = false;
                this.onDeviceConnectionChanged(false);
                break;
            case 4:
                this.mode = 1;
                this.connected = false;
                this.onDeviceConnectionChanged(false);
                break;
            case 5: this.mode = 1; this.respond(seq); break;
            case 6: this.writes.push(data); this.respond(seq); break;
            case 0x20: this.respond(seq, undefined, 1); break;
            default: this.respond(seq); break;
        }
    }
}

export function block(h: Harness, address = 0x4000): pxtc.UF2.Block {
    return {
        flags: h.pxtc.UF2.UF2_FLAG_FAMILY_ID_PRESENT, targetAddr: address,
        payloadSize: 256, data: new Uint8Array(256).fill(0xa5), familyId: 0x55114460,
        blockNo: 0, numBlocks: 1, fileSize: 0
    };
}