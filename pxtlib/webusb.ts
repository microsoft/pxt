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
        iface: USBInterface;
        altIface: USBAlternateInterface;
        epIn: USBEndpoint;
        epOut: USBEndpoint;
        readLoopStarted = false;
        onData = (v: Uint8Array) => { };
        onError = (e: Error) => { };
        onEvent = (v: Uint8Array) => { };

        constructor(public dev: USBDevice) {
            (navigator as any).usb.addEventListener('disconnect', (event: any) => {
                if (event.device == this.dev) {
                    this.log("Device disconnected")
                    this.clearDev()
                }
            });
        }

        private clearDev() {
            this.dev = null
            this.epIn = null
            this.epOut = null
        }

        error(msg: string) {
            throw new USBError(U.lf("USB error on device {0} ({1})", this.dev.productName, msg))
        }

        log(msg: string) {
            msg = "WebUSB: " + msg
            pxt.log(msg)
            //pxt.debug(msg)
        }

        disconnectAsync() {
            if (!this.dev) return Promise.resolve()
            this.ready = false
            this.log("close device")
            return this.dev.close()
                .catch(e => {
                    // just ignore errors closing, most likely device just disconnected
                })
                .then(() => {
                    this.clearDev()
                    return Promise.delay(500)
                })
        }

        reconnectAsync() {
            this.log("reconnect")
            return this.disconnectAsync()
                .then(getDeviceAsync)
                .then(dev => {
                    this.log("got device: " + dev.manufacturerName + " " + dev.productName)
                    this.dev = dev
                    return this.initAsync()
                })
        }

        sendPacketAsync(pkt: Uint8Array) {
            if (!this.dev)
                return Promise.reject(new Error("Disconnected"))
            Util.assert(pkt.length <= 64)
            if (!this.epOut) {
                return this.dev.controlTransferOut({
                    requestType: "class",
                    recipient: "interface",
                    request: controlTransferSetReport,
                    value: controlTransferOutReport,
                    index: this.iface.interfaceNumber
                }, pkt).then(res => {
                    if (res.status != "ok")
                        this.error("USB CTRL OUT transfer failed")
                    else if (!isHF2)
                        this.recvOne()
                })
            }
            return this.dev.transferOut(this.epOut.endpointNumber, pkt)
                .then(res => {
                    if (res.status != "ok")
                        this.error("USB OUT transfer failed")
                })
        }

        private recvOne() {
            this.recvPacketAsync()
                .then(buf => {
                    this.onData(buf)
                }, err => {
                    this.onError(err)
                })
        }

        private readLoop() {
            if (this.readLoopStarted)
                return
            this.readLoopStarted = true
            this.log("start read loop")
            let loop = (): void => {
                if (!this.ready)
                    Promise.delay(300).then(loop)
                else
                    this.recvPacketAsync()
                        .then(buf => {
                            if (buf[0]) {
                                // we've got data; retry reading immedietly after processing it
                                this.onData(buf)
                                loop()
                            } else {
                                // throttle down if no data coming
                                Promise.delay(500).then(loop)
                            }
                        }, err => {
                            if (this.dev)
                                this.onError(err)
                            Promise.delay(300).then(loop)
                        })
            }
            loop()
        }

        private recvPacketAsync(): Promise<Uint8Array> {
            let final = (res: USBInTransferResult) => {
                if (res.status != "ok")
                    this.error("USB IN transfer failed")
                let arr = new Uint8Array(res.data.buffer)
                if (arr.length == 0)
                    return this.recvPacketAsync()
                return arr
            }

            if (!this.dev)
                return Promise.reject(new Error("Disconnected"))

            if (!this.epIn) {
                return this.dev.controlTransferIn({
                    requestType: "class",
                    recipient: "interface",
                    request: controlTransferGetReport,
                    value: controlTransferInReport,
                    index: this.iface.interfaceNumber
                }, 64).then(final)
            }

            return this.dev.transferIn(this.epIn.endpointNumber, 64)
                .then(final)
        }

        initAsync() {
            if (!this.dev)
                return Promise.reject(new Error("Disconnected"))
            let dev = this.dev
            this.log("open device")
            return dev.open()
                // assume one configuration; no one really does more
                .then(() => {
                    this.log("select configuration")
                    return dev.selectConfiguration(1)
                })
                .then(() => {
                    let matchesFilters = (iface: USBInterface) => {
                        let a0 = iface.alternates[0]
                        for (let f of filters) {
                            if (f.classCode == null || a0.interfaceClass === f.classCode) {
                                if (f.subclassCode == null || a0.interfaceSubclass === f.subclassCode) {
                                    if (f.protocolCode == null || a0.interfaceProtocol === f.protocolCode) {
                                        if (a0.endpoints.length == 0)
                                            return true
                                        if (a0.endpoints.length == 2 &&
                                            a0.endpoints.every(e => e.packetSize == 64))
                                            return true
                                    }
                                }
                            }
                        }
                        return false
                    }
                    this.log("got " + dev.configurations[0].interfaces.length + " interfaces")
                    let iface = dev.configurations[0].interfaces.filter(matchesFilters)[0]
                    if (!iface)
                        this.error("cannot find supported USB interface")
                    this.altIface = iface.alternates[0]
                    this.iface = iface
                    if (this.altIface.endpoints.length) {
                        this.epIn = this.altIface.endpoints.filter(e => e.direction == "in")[0]
                        this.epOut = this.altIface.endpoints.filter(e => e.direction == "out")[0]
                        Util.assert(this.epIn.packetSize == 64);
                        Util.assert(this.epOut.packetSize == 64);
                    }
                    this.log("claim interface")
                    return dev.claimInterface(iface.interfaceNumber)
                })
                .then(() => {
                    this.log("device ready")
                    this.ready = true
                    if (this.epIn || isHF2)
                        this.readLoop()
                })
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

    export function pairAsync(): Promise<void> {
        return ((navigator as any).usb.requestDevice({
            filters: filters
        }) as Promise<USBDevice>).then(dev => {
            // try connecting to it
            return mkPacketIOAsync()
        }).then(io => io.reconnectAsync())
    }

    export function isPairedAsync(): Promise<boolean> {
        if (!isEnabled) return Promise.resolve(false);

        return getDeviceAsync()
            .then((dev) => {
                return true;
            })
            .catch(() => {
                return false;
            });
    }

    function getDeviceAsync(): Promise<USBDevice> {
        return ((navigator as any).usb.getDevices() as Promise<USBDevice[]>)
            .then<USBDevice>((devs: USBDevice[]) => {
                if (!devs || !devs.length) {
                    let err: any = new Error(U.lf("No USB device selected or connected; try pairing!"))
                    err.isUserError = true
                    err.type = "devicenotfound"
                    throw err;
                }
                return devs[0]
            })
    }

    let getDevPromise: Promise<HF2.PacketIO>
    export function mkPacketIOAsync() {
        if (!getDevPromise)
            getDevPromise = getDeviceAsync()
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
        if (!!(navigator as any).usb) {
            // Windows versions:
            // 5.1 - XP, 6.0 - Vista, 6.1 - Win7, 6.2 - Win8, 6.3 - Win8.1, 10.0 - Win10
            // If on Windows, and Windows is older 8.1, don't enable WebUSB,
            // as it requires signed INF files.
            let m = /Windows NT (\d+\.\d+)/.exec(navigator.userAgent)
            if (m && parseFloat(m[1]) < 6.3)
                return false
            return true
        }
        return false
    }
}
