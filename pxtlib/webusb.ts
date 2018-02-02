namespace pxt.usb {

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

    export interface USBDeviceFilter {
        vendorId?: number;
        productId?: number;
        classCode?: number;
        subclassCode?: number;
        protocolCode?: number;
        serialNumber?: string;
    }

    // this is for HF2
    export let filters: USBDeviceFilter[] = [{
        classCode: 255,
        subclassCode: 42,
    }]

    export function setFilters(f: USBDeviceFilter[]) {
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
    }

    class HID implements HF2.PacketIO {
        ready = false;
        altIface: USBAlternateInterface;
        epIn: USBEndpoint;
        epOut: USBEndpoint;
        onData = (v: Uint8Array) => { };
        onError = (e: Error) => { };
        onEvent = (v: Uint8Array) => { };

        constructor(public dev: USBDevice) {
            this.readLoop()
        }

        error(msg: string) {
            throw new USBError(U.lf("USB error on device {0} ({1})", this.dev.productName, msg))
        }

        disconnectAsync() {
            if (!this.dev) return Promise.resolve()
            this.ready = false
            return this.dev.close()
                .then(() => {
                    this.dev = null
                    return Promise.delay(500)
                })
        }

        reconnectAsync() {
            return this.disconnectAsync()
                .then(requestDeviceAsync)
                .then(dev => {
                    this.dev = dev
                    return this.initAsync()
                })
        }

        sendPacketAsync(pkt: Uint8Array) {
            Util.assert(pkt.length <= 64)
            return this.dev.transferOut(this.epOut.endpointNumber, pkt)
                .then(res => {
                    if (res.status != "ok")
                        this.error("USB OUT transfer failed")
                })
        }

        private readLoop() {
            let loop = (): void => {
                if (!this.ready)
                    Promise.delay(300).then(loop)
                else
                    this.recvPacketAsync()
                        .then(buf => {
                            this.onData(buf)
                            loop()
                        }, err => {
                            this.onError(err)
                            Promise.delay(300).then(loop)
                        })
            }
            loop()
        }

        private recvPacketAsync(): Promise<Uint8Array> {
            return this.dev.transferIn(this.epIn.endpointNumber, 64)
                .then(res => {
                    if (res.status != "ok")
                        this.error("USB IN transfer failed")
                    let arr = new Uint8Array(res.data.buffer)
                    if (arr.length == 0)
                        return this.recvPacketAsync()
                    return arr
                })
        }

        initAsync() {
            let dev = this.dev
            return dev.open()
                // assume one configuration; no one really does more
                .then(() => dev.selectConfiguration(1))
                .then(() => {
                    let matchesFilters = (iface: USBInterface) => {
                        let a0 = iface.alternates[0]
                        for (let f of filters) {
                            if (f.classCode == null || a0.interfaceClass === f.classCode) {
                                if (f.subclassCode == null || a0.interfaceSubclass === f.subclassCode) {
                                    if (f.protocolCode == null || a0.interfaceProtocol === f.protocolCode) {
                                        if (a0.endpoints.length == 2 &&
                                            a0.endpoints.every(e => e.packetSize == 64))
                                            return true
                                    }
                                }
                            }
                        }
                        return false
                    }
                    let hid = dev.configurations[0].interfaces.filter(matchesFilters)[0]
                    if (!hid)
                        this.error("cannot find USB HID interface")
                    this.altIface = hid.alternates[0]
                    this.epIn = this.altIface.endpoints.filter(e => e.direction == "in")[0]
                    this.epOut = this.altIface.endpoints.filter(e => e.direction == "out")[0]
                    Util.assert(this.epIn.packetSize == 64);
                    Util.assert(this.epOut.packetSize == 64);
                    return dev.claimInterface(hid.interfaceNumber)
                })
                .then(() => { this.ready = true })
        }
    }

    export interface USBControlTransferParameters {
        requestType: USBRequestType;
        recipient: USBRecipient;
        request: number;
        value: number;
        index: number;
    }

    export interface USBInTransferResult {
        data: { buffer: ArrayBuffer; };
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

    function requestDeviceAsync(): Promise<USBDevice> {
        return (navigator as any).usb.requestDevice({
            filters: filters
        })
    }

    let getDevPromise: Promise<HF2.PacketIO>
    export function mkPacketIOAsync() {
        if (!getDevPromise)
            getDevPromise = requestDeviceAsync()
                .then(dev => {
                    let h = new HID(dev)
                    return h.initAsync()
                        .then(() => h)
                })
                .catch(e => {
                    getDevPromise = null
                    return Promise.reject(e)
                })

        return getDevPromise
    }

    export let isEnabled = false

    export function setEnabled(v: boolean) {
        if (!isAvailable()) v = false
        isEnabled = v
    }

    export function isAvailable() {
        // TODO check what Chrome on Win7 and Win8 does
        return !!(navigator as any).usb
    }

    export function uiHook() {
        if (isEnabled) {
            // this needs to be called from within UI handler, not after some async stuff
            mkPacketIOAsync().catch(e => { })
        }
    }
}
