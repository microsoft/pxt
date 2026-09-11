// Declare the subset of usb interface we depend on; definitely typed has full but
// better to list it as optional / use our existing types where possible.
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/w3c-web-usb/index.d.ts
interface Navigator {
    readonly usb?: {
        getDevices(): Promise<pxt.usb.USBDevice[]>;
        requestDevice(options?: pxt.usb.USBDeviceRequestOptions): Promise<pxt.usb.USBDevice>;
        addEventListener(
            type: "connect" | "disconnect",
            listener: (ev: pxt.usb.USBConnectionEvent) => any,
            useCapture?: boolean,
        ): void;
        removeEventListener(
            type: "connect" | "disconnect",
            callback: (ev: pxt.usb.USBConnectionEvent) => any,
            useCapture?: boolean,
        ): void;
    }
}

namespace pxt.usb {

    /**
     * For local testing of WebUSB, be sure to (temporarily)
     * enable the browser command line flag `--disable-webusb-security`
     * to allow localhost (non-https) access to the APIs.
     * If possible it might be easiest to download a separate canary build
     * for chrome / edge to run.
     * https://chromium.googlesource.com/playground/chromium-org-site/+/refs/heads/main/for-testers/command-line-flags.md
     */

    export class USBError extends Error {
        constructor(msg: string) {
            super(msg)
            this.message = msg
        }
    }

    // http://www.linux-usb.org/usb.ids
    export const enum VID {
        ATMEL = 0x03EB,
        ARDUINO = 0x2341,
        ADAFRUIT = 0x239A,
        NXP = 0x0d28, // aka Freescale, KL26 etc
    }

    const controlTransferGetReport = 0x01;
    const controlTransferSetReport = 0x09;
    const controlTransferOutReport = 0x200;
    const controlTransferInReport = 0x100;


    export interface USBDeviceFilter {
        vendorId?: number;
        productId?: number;
        classCode?: number;
        subclassCode?: number;
        protocolCode?: number;
        serialNumber?: string;
    }

    export interface USBDeviceRequestOptions {
        filters: USBDeviceFilter[];
        exclusionFilters?: USBDeviceFilter[] | undefined;
    }

    export interface USBConnectionEvent extends Event {
        device: USBDevice;
    }

    // this is for HF2
    export let filters: USBDeviceFilter[] = [{
        classCode: 255,
        subclassCode: 42,
    }
    ]

    let isHF2 = true

    export function setFilters(f: USBDeviceFilter[]) {
        isHF2 = false
        filters = f
    }

    export type USBEndpointType = "bulk" | "interrupt" | "isochronous";
    export type USBRequestType = "standard" | "class" | "vendor"
    export type USBRecipient = "device" | "interface" | "endpoint" | "other"
    export type USBTransferStatus = "ok" | "stall" | "babble";
    export type USBDirection = "in" | "out";

    export type BufferSource = Uint8Array;

    export interface USBConfiguration {
        configurationValue: number;
        configurationName: string;
        interfaces: USBInterface[];
    };

    export interface USBInterface {
        interfaceNumber: number;
        alternate: USBAlternateInterface;
        alternates: USBAlternateInterface[];
        claimed: boolean;
    };

    export interface USBAlternateInterface {
        alternateSetting: number;
        interfaceClass: number;
        interfaceSubclass: number;
        interfaceProtocol: number;
        interfaceName: string;
        endpoints: USBEndpoint[];
    };


    export interface USBEndpoint {
        endpointNumber: number;
        direction: USBDirection;
        type: USBEndpointType;
        packetSize: number;
    }

    export interface USBControlTransferParameters {
        requestType: USBRequestType;
        recipient: USBRecipient;
        request: number;
        value: number;
        index: number;
    }

    export interface USBInTransferResult {
        data: { buffer: ArrayBuffer; byteOffset?: number; byteLength?: number; };
        status: USBTransferStatus;
    }

    export interface USBOutTransferResult {
        bytesWritten: number;
        status: USBTransferStatus;
    }

    export interface USBIsochronousInTransferPacket {
        data: DataView;
        status: USBTransferStatus;
    }

    export interface USBIsochronousInTransferResult {
        data: DataView;
        packets: USBIsochronousInTransferPacket[];
    }

    export interface USBIsochronousOutTransferPacket {
        bytesWritten: number;
        status: USBTransferStatus;
    }

    export interface USBIsochronousOutTransferResult {
        packets: USBIsochronousOutTransferPacket[];
    }

    export interface USBDevice {
        vendorId: number; // VID.*
        productId: number; // 589

        manufacturerName: string; // "Arduino"
        productName: string; // "Arduino Zero"
        serialNumber: string; // ""

        deviceClass: number; // 0xEF - misc
        deviceSubclass: number; // 2
        deviceProtocol: number; // 1

        deviceVersionMajor: number; // 0x42
        deviceVersionMinor: number; // 0x00
        deviceVersionSubminor: number; // 0x01
        usbVersionMajor: number; // 2
        usbVersionMinor: number; // 1
        usbVersionSubminor: number; // 0

        configurations: USBConfiguration[];

        opened: boolean;

        open(): Promise<void>;
        close(): Promise<void>;
        selectConfiguration(configurationValue: number): Promise<void>;
        claimInterface(interfaceNumber: number): Promise<void>;
        releaseInterface(interfaceNumber: number): Promise<void>;
        selectAlternateInterface(interfaceNumber: number, alternateSetting: number): Promise<void>;
        controlTransferIn(setup: USBControlTransferParameters, length: number): Promise<USBInTransferResult>;
        controlTransferOut(setup: USBControlTransferParameters, data?: BufferSource): Promise<USBOutTransferResult>;
        clearHalt(direction: USBDirection, endpointNumber: number): Promise<void>;
        transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
        transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
        isochronousTransferIn(endpointNumber: number, packetLengths: number[]): Promise<USBIsochronousInTransferResult>;
        isochronousTransferOut(endpointNumber: number, data: BufferSource, packetLengths: number[]): Promise<USBIsochronousOutTransferResult>;
        reset(): Promise<void>;
        // chromium 101+
        forget?(): Promise<void>;
    }

    class WebUSBHID implements pxt.packetio.PacketIO {
        lastKnownDeviceSerialNumber: string;
        private lastKnownDevice: USBDevice;
        private connectionId = 0;
        private operationId = 0;
        private connectionLock = new U.PromiseQueue();
        private reconnectPromise: Promise<void>;
        private pendingRead: Promise<Uint8Array>;
        private readQueue = new U.PromiseQueue();
        private cancelConnection: () => void;
        private quarantinedDevices = new Set<USBDevice>();
        private pendingTransfers = new Set<(error: Error) => void>();
        dev: USBDevice;
        ready = false;
        connecting = false;
        iface: USBInterface;
        altIface: USBAlternateInterface;
        epIn: USBEndpoint;
        epOut: USBEndpoint;
        onDeviceConnectionChanged = (connect: boolean) => { };
        onConnectionChanged = () => { };
        onData = (v: Uint8Array) => { };
        onError = (e: Error) => { };
        onEvent = (v: Uint8Array) => { };
        enabled = false;

        constructor() {
            this.handleUSBConnected = this.handleUSBConnected.bind(this);
            this.handleUSBDisconnected = this.handleUSBDisconnected.bind(this);
        }

        enable(): void {
            if (this.enabled) return;

            this.enabled = true;
            this.log("registering webusb events");
            navigator.usb?.addEventListener('disconnect', this.handleUSBDisconnected, false);
            navigator.usb?.addEventListener('connect', this.handleUSBConnected, false);
        }

        disable() {
            if (!this.enabled) return;

            this.enabled = false;
            this.log(`unregistering webusb events`);
            navigator.usb?.removeEventListener('disconnect', this.handleUSBDisconnected);
            navigator.usb?.removeEventListener('connect', this.handleUSBConnected);
        }

        async disposeAsync(): Promise<void> {
            this.disable();
            await this.disconnectAsync();
        }

        private handleUSBDisconnected(event: USBConnectionEvent) {
            this.log("device disconnected")
            if (event.device == this.dev) {
                this.log("clear device")
                this.clearDev();
                this.onDeviceConnectionChanged?.(false);
            }
        }

        private handleUSBConnected(event: USBConnectionEvent) {
            const newdev = event.device;
            this.log(`device connected ${newdev.serialNumber}`)
            if (!this.dev && !this.connecting && this.matchesDevice(newdev) && this.isPreferredDevice(newdev)) {
                this.log("attach device")
                this.onDeviceConnectionChanged?.(true);
            }
        }

        private clearDev() {
            const hadDevice = !!this.dev;
            ++this.connectionId;
            for (const reject of this.pendingTransfers) reject(new Error("Disconnected"));
            this.pendingTransfers.clear();
            this.ready = false;
            this.dev = null;
            this.iface = null;
            this.altIface = null;
            this.epIn = null;
            this.epOut = null;
            this.pendingRead = undefined;
            if (hadDevice) {
                this.onConnectionChanged?.();
            }
        }

        error(msg: string): never {
            throw new USBError(U.lf("USB error on device {0} ({1})", this.dev?.productName || this.lastKnownDevice?.productName || "USB", msg))
        }

        log(msg: string) {
            pxt.debug("webusb: " + msg)
        }

        disconnectAsync(): Promise<void> {
            ++this.operationId;
            this.cancelConnection?.();
            const dev = this.dev;
            // Invalidate pending transfers immediately, before waiting for open/close operations.
            this.clearDev();
            return this.connectionLock.enqueue("connection", () => this.closeDeviceAsync(dev));
        }

        private async closeDeviceAsync(dev: USBDevice): Promise<void> {
            if (!dev || this.quarantinedDevices.has(dev)) return;
            this.log("close device");
            const close = dev.close();
            try {
                await U.promiseTimeout(5000, close, "USB close timed out");
            } catch (e) {
                if (e === "USB close timed out") {
                    this.quarantinedDevices.add(dev);
                    close.catch(() => { }).finally(() => this.quarantinedDevices.delete(dev));
                }
                // Otherwise the device most likely just disconnected.
            }
        }

        private async connectionOperationAsync<T>(dev: USBDevice, operation: Promise<T>, operationId: number): Promise<T> {
            const cancelled = new Error("Disconnected");
            const timedOut = new Error("USB connection timed out");
            let timer: number;
            const cancel = U.defer<T>();
            const cancelConnection = () => cancel.reject(cancelled);
            this.cancelConnection = cancelConnection;
            try {
                timer = setTimeout(() => cancel.reject(timedOut), 5000);
                const result = await Promise.race([operation, cancel.promise]);
                this.checkOperation(operationId);
                return result;
            } catch (e) {
                if (dev && (e === cancelled || e === timedOut || operationId !== this.operationId)) {
                    // Native open/claim cannot be cancelled. Do not reuse this handle
                    // until its late completion has been closed; a newly enumerated
                    // USBDevice can still be used while this one is quarantined.
                    this.quarantinedDevices.add(dev);
                    operation.catch(() => { })
                        .then(() => dev.close())
                        .catch(() => { })
                        .finally(() => this.quarantinedDevices.delete(dev));
                }
                throw e;
            } finally {
                clearTimeout(timer);
                if (this.cancelConnection === cancelConnection) this.cancelConnection = undefined;
            }
        }

        private async transferAsync<T>(operation: Promise<T>, connectionId: number): Promise<T> {
            const pending = U.defer<T>();
            this.pendingTransfers.add(pending.reject);
            operation.then(pending.resolve, pending.reject);
            try {
                const result = await pending.promise;
                this.checkConnection(connectionId);
                return result;
            } finally {
                this.pendingTransfers.delete(pending.reject);
            }
        }

        async forgetAsync(): Promise<boolean> {
            if (!this.dev?.forget)
                return false;
            try {
                const dev = this.dev;
                await this.disconnectAsync();
                await dev.forget();
                this.lastKnownDevice = undefined;
                this.lastKnownDeviceSerialNumber = undefined;
                return true;
                // connection changed listener will handle disconnecting when access is revoked.
            } catch (e) {
                return false;
            }
        }

        reconnectAsync(): Promise<void> {
            if (this.reconnectPromise) return this.reconnectPromise;
            this.log("reconnect")
            const operationId = ++this.operationId;
            this.reconnectPromise = Promise.resolve().then(() => this.connectionLock.enqueue("connection", async () => {
                this.checkOperation(operationId);
                const dev = this.dev;
                this.clearDev();
                await this.closeDeviceAsync(dev);
                this.checkOperation(operationId);
                const devs = await this.connectionOperationAsync(undefined, tryGetDevicesAsync(), operationId);
                this.checkOperation(operationId);
                await this.connectAsync(devs, operationId);
            })).finally(() => {
                this.reconnectPromise = undefined;
                this.setConnecting(false);
            });
            // Publish the promise before notifying UI callbacks, which may reconnect.
            this.setConnecting(true);
            return this.reconnectPromise;
        }

        async selectDeviceAsync(dev: USBDevice): Promise<void> {
            if (this.dev !== dev || this.connecting) await this.disconnectAsync();
            this.lastKnownDevice = dev;
            this.lastKnownDeviceSerialNumber = dev.serialNumber;
        }

        private checkOperation(operationId: number): void {
            if (operationId !== this.operationId) throw new Error("Disconnected");
        }

        private isCurrentConnection(connectionId: number): boolean {
            return this.ready && !!this.dev && connectionId === this.connectionId;
        }

        private checkConnection(connectionId: number): void {
            if (!this.isCurrentConnection(connectionId)) throw new Error("Disconnected");
        }

        private setConnecting(v: boolean) {
            if (v != this.connecting) {
                this.connecting = v;
                this.onConnectionChanged?.();
            }
        }

        isConnecting(): boolean {
            return this.connecting;
        }

        isConnected(): boolean {
            return !!this.dev && this.ready;
        }

        private isPreferredDevice(dev: USBDevice): boolean {
            // Never silently switch to a different board during re-enumeration. Devices
            // whose identity changes between modes must be explicitly selected again.
            return !this.lastKnownDevice || dev === this.lastKnownDevice ||
                (!!this.lastKnownDeviceSerialNumber && dev.serialNumber === this.lastKnownDeviceSerialNumber);
        }

        private matchesFilter(dev: USBDevice, alt: USBAlternateInterface, filter: USBDeviceFilter): boolean {
            return (filter.vendorId == null || filter.vendorId === dev.vendorId) &&
                (filter.productId == null || filter.productId === dev.productId) &&
                (filter.serialNumber == null || filter.serialNumber === dev.serialNumber) &&
                (filter.classCode == null || filter.classCode === alt.interfaceClass) &&
                (filter.subclassCode == null || filter.subclassCode === alt.interfaceSubclass) &&
                (filter.protocolCode == null || filter.protocolCode === alt.interfaceProtocol);
        }

        private matchesDevice(dev: USBDevice): boolean {
            return dev.configurations.some(config => config.interfaces.some(iface =>
                iface.alternates.some(alt => filters.some(filter => this.matchesFilter(dev, alt, filter)))));
        }

        private async connectAsync(devs: USBDevice[], operationId: number): Promise<void> {
            devs = devs.filter(dev => !this.quarantinedDevices.has(dev) && this.matchesDevice(dev) && this.isPreferredDevice(dev));
            this.log(`trying to connect (${devs.length} devices)`)
            // no devices...
            if (devs.length == 0) {
                const e = new Error("Device not found.");
                (e as any).type = "devicenotfound";
                throw e;
            }

            for (const dev of devs) {
                this.checkOperation(operationId);
                this.dev = dev;
                this.log(`connect device: ${dev.manufacturerName} ${dev.productName}`);
                try {
                    await this.initAsync(operationId);
                    return;
                } catch (e) {
                    this.clearDev();
                    // A failed claim/alternate selection must not leave an open handle
                    // behind for the next attempt (or the next browser tab).
                    await this.closeDeviceAsync(dev);
                    this.checkOperation(operationId);
                    this.log(`connection failed, ${e.message}`);
                }
            }
            const e = new Error(U.lf("Device in use or not found."));
            (e as any).type = "devicelocked";
            throw e;
        }

        async sendPacketAsync(pkt: Uint8Array) {
            const connectionId = this.connectionId;
            this.checkConnection(connectionId);
            const dev = this.dev;
            Util.assert(pkt.length <= 64);

            if (!this.epOut) {
                const res = await this.transferAsync(dev.controlTransferOut({
                    requestType: "class",
                    recipient: "interface",
                    request: controlTransferSetReport,
                    value: controlTransferOutReport,
                    index: this.iface.interfaceNumber
                }, pkt), connectionId);
                this.checkConnection(connectionId);
                if (res.status != "ok" || res.bytesWritten !== pkt.length)
                    this.error("USB CTRL OUT transfer failed");
            } else {
                const res = await this.transferAsync(dev.transferOut(this.epOut.endpointNumber, pkt), connectionId);
                this.checkConnection(connectionId);
                if (res.status != "ok" || res.bytesWritten !== pkt.length)
                    this.error("USB OUT transfer failed");
            }
        }

        private async readLoop(connectionId: number): Promise<void> {
            this.log("start read loop");
            while (this.enabled && this.isCurrentConnection(connectionId)) {
                try {
                    const buf = await this.recvPacketAsync();
                    if (!this.isCurrentConnection(connectionId)) return;
                    if (buf[0]) {
                        // We've got data; read again immediately after processing it.
                        this.onData(buf);
                    } else {
                        // throttle down if no data coming
                        await U.delay(500);
                    }
                } catch (e) {
                    if (this.isCurrentConnection(connectionId)) {
                        const disconnect = this.disconnectAsync();
                        this.onError(e);
                        await disconnect;
                    }
                    return;
                }
            }
        }

        recvPacketAsync(timeoutMs?: number): Promise<Uint8Array> {
            const connectionId = this.connectionId;
            return this.readQueue.enqueue("read", async () => {
                this.checkConnection(connectionId);
                return this.recvPacketCoreAsync(timeoutMs);
            });
        }

        private async recvPacketCoreAsync(timeoutMs?: number): Promise<Uint8Array> {
            const connectionId = this.connectionId;
            this.checkConnection(connectionId);
            const dev = this.dev;
            const epIn = this.epIn;
            const iface = this.iface;
            const receiveAsync = async (): Promise<Uint8Array> => {
                while (this.isCurrentConnection(connectionId)) {
                    const res = await this.transferAsync(epIn ? dev.transferIn(epIn.endpointNumber, 64) : dev.controlTransferIn({
                        requestType: "class",
                        recipient: "interface",
                        request: controlTransferGetReport,
                        value: controlTransferInReport,
                        index: iface.interfaceNumber
                    }, 64), connectionId);
                    this.checkConnection(connectionId);
                    if (res.status != "ok" || !res.data)
                        this.error("USB IN transfer failed");
                    const arr = new Uint8Array(res.data.buffer, res.data.byteOffset || 0, res.data.byteLength);
                    if (arr.length) return arr;
                    await U.delay(1);
                }
                throw new Error("Disconnected");
            };
            // DAP/micro:bit uses short read deadlines to recover stale responses. A
            // timeout must neither disconnect it nor leave a second transfer consuming
            // the next reply. Retain the pending read for the next caller to collect.
            const pending = this.pendingRead || (this.pendingRead = receiveAsync());
            try {
                const result = await (timeoutMs > 0 ? U.promiseTimeout(timeoutMs, pending, "USB read timed out") : pending);
                this.checkConnection(connectionId);
                if (this.pendingRead === pending) this.pendingRead = undefined;
                return result;
            } catch (e) {
                if (e === "USB read timed out") throw new Error("Timeout");
                if (this.pendingRead === pending) this.pendingRead = undefined;
                throw e;
            }
        }

        private async initAsync(operationId: number): Promise<void> {
            if (!this.dev)
                throw new Error("Disconnected");
            const dev = this.dev;
            this.log("open device");
            await this.connectionOperationAsync(dev, dev.open(), operationId);
            this.checkOperation(operationId);

            const matches = (alt: USBAlternateInterface) =>
                filters.some(filter => this.matchesFilter(dev, alt, filter)) &&
                (alt.endpoints.length === 0 || (alt.endpoints.length === 2 &&
                    alt.endpoints.every(ep => ep.packetSize === 64 && (ep.type === "bulk" || ep.type === "interrupt")) &&
                    alt.endpoints.some(ep => ep.direction === "in") && alt.endpoints.some(ep => ep.direction === "out")));
            const config = dev.configurations.find(c => c.interfaces.some(i => i.alternates.some(matches)));
            if (!config)
                this.error("cannot find supported USB interface");
            this.log("select configuration");
            await this.connectionOperationAsync(dev, dev.selectConfiguration(config.configurationValue), operationId);
            this.checkOperation(operationId);
            const matching = config.interfaces.filter(i => i.alternates.some(matches));
            const iface = matching[matching.length - 1];
            this.altIface = iface.alternates.find(matches);
            this.iface = iface;
            this.epIn = this.epOut = null;
            if (this.altIface.endpoints.length) {
                this.log("using dedicated endpoints");
                this.epIn = this.altIface.endpoints.filter(e => e.direction == "in")[0];
                this.epOut = this.altIface.endpoints.filter(e => e.direction == "out")[0];
                Util.assert(this.epIn.packetSize == 64);
                Util.assert(this.epOut.packetSize == 64);
            } else {
                this.log("using ctrl pipe");
            }
            this.log("claim interface");
            await this.connectionOperationAsync(dev, dev.claimInterface(iface.interfaceNumber), operationId);
            this.checkOperation(operationId);
            if (iface.alternate.alternateSetting !== this.altIface.alternateSetting) {
                await this.connectionOperationAsync(dev, dev.selectAlternateInterface(iface.interfaceNumber, this.altIface.alternateSetting), operationId);
                this.checkOperation(operationId);
            }
            if (this.dev !== dev) throw new Error("Disconnected");
            this.log("device ready");
            this.lastKnownDevice = dev;
            this.lastKnownDeviceSerialNumber = dev.serialNumber;
            this.ready = true;
            if (isHF2) {
                // just starting, not waiting on it.
                this.readLoop(this.connectionId).catch(e => pxt.reportException(e));
            }
            this.onConnectionChanged?.();
        }
    }

    export async function pairAsync(): Promise<boolean> {
        try {
            const dev = await navigator.usb?.requestDevice({
                filters: filters
            });
            if (dev) {
                if (!_hid) _hid = new WebUSBHID();
                await _hid.selectDeviceAsync(dev);
            }
            return !!dev;
        } catch (e) {
            // user cancelled
            if (e.name == "NotFoundError")
                return undefined;
            throw e;
        }
    }

    export async function tryGetDevicesAsync(): Promise<USBDevice[]> {
        log(`webusb: get devices`)
        try {
            const devs = await navigator.usb?.getDevices();
            return devs || [];
        }
        catch (e) {
            reportException(e);
            return [];
        }
    }

    let _hid: WebUSBHID;
    export function mkWebUSBHIDPacketIOAsync(): Promise<pxt.packetio.PacketIO> {
        pxt.debug(`packetio: mk webusb io`);
        if (!_hid)
            _hid = new WebUSBHID();
        _hid.enable();
        return Promise.resolve(_hid);
    }

    // returns true if device has been successfully forgotten, false otherwise.
    export async function forgetDeviceAsync(): Promise<boolean> {
        pxt.debug(`packetio: forget webusb io`);
        if (!_hid) {
            // No device to forget
            return false;
        }
        return _hid.forgetAsync();
    }

    export let isEnabled = false

    export function setEnabled(v: boolean) {
        if (!isAvailable()) v = false
        isEnabled = v
    }

    let _available: boolean = undefined;
    export async function checkAvailableAsync() {
        if (_available !== undefined) return;

        pxt.debug(`webusb: checking availability`);
        // not supported by editor, cut short
        if (!pxt.appTarget?.compile?.webUSB) {
            _available = false;
            return;
        }

        const failureReason = await getReasonUnavailable();
        if (!failureReason) {
            _available = true;
            return;
        }

        _available = false;
        pxt.tickEvent("webusb.off", { 'reason': failureReason });
        switch (failureReason) {
            case "electron":
                pxt.debug(`webusb: off, electron`);
                break;
            case "notimpl":
                pxt.debug(`webusb: off, not implemented by browser`);
                break;
            case "oldwindows":
                pxt.debug(`webusb: off, older windows version`);
                break;
            case "security":
                pxt.debug(`webusb: off, security exception`);
                break;
        }
    }

    export async function getReasonUnavailable(): Promise<"electron" | "notimpl" | "oldwindows" | "security" | undefined> {
        if (pxt.BrowserUtils.isElectron() && !pxt.BrowserUtils.isPxtElectronWebUSBDeployEnabled()) {
            return "electron";
        }

        const _usb = navigator.usb;
        if (!_usb) {
            return "notimpl";
        }

        // Windows versions:
        // 5.1 - XP, 6.0 - Vista, 6.1 - Win7, 6.2 - Win8, 6.3 - Win8.1, 10.0 - Win10
        // If on Windows, and Windows is older 8.1, don't enable WebUSB,
        // as it requires signed INF files.
        let m = /Windows NT (\d+\.\d+)/.exec(navigator.userAgent)
        if (m && parseFloat(m[1]) < 6.3) {
            return "oldwindows";
        }

        // check security
        try {
            // iframes must specify allow="usb" in order to support WebUSB
            await _usb.getDevices();
        } catch (e) {
            return "security";
        }

        return undefined;
    }

    export function isAvailable() {
        if (_available === undefined) {
            pxt.error(`checkAvailableAsync not called`)
            checkAvailableAsync()
        }
        return !!_available;
    }
}
