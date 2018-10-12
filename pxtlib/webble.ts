namespace pxt.webBluetooth {
    export function isAvailable() {
        return hasConsole() || hasPartialFlash();
    }

    export function hasConsole() {
        return !!navigator && !!navigator.bluetooth
            && ('TextDecoder' in window) // needed for reading data
            && pxt.appTarget.appTheme.bluetoothUartConsole
            && pxt.appTarget.appTheme.bluetoothUartFilters
            && pxt.appTarget.appTheme.bluetoothUartFilters.length > 0;
    }

    export function hasPartialFlash() {
        return !!navigator && !!navigator.bluetooth
            && !!pxt.appTarget.appTheme.bluetoothPartialFlashing;
    }

    function wrapPromise<T>(p: Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            p.then(r => resolve(r), e => reject(e));
        })
    }

    export class BLERemote {
        private connectPromise: Promise<void> = undefined;

        protected cancelConnectAsync() {
            if (this.connectPromise && this.connectPromise.isCancellable() && !this.connectPromise.isFulfilled()) {
                this.connectPromise.cancel();
            }
            this.connectPromise = undefined;
        }

        protected createConnectPromise(): Promise<void> {
            return Promise.resolve();
        }

        connectAsync(): Promise<void> {
            if (!this.connectPromise)
                this.connectPromise = wrapPromise(this.createConnectPromise());
            return this.connectPromise;
        }

        disconnect(): void {
            this.cancelConnectAsync();
        }
    }

    export class BLEService extends BLERemote {
        constructor(protected device: BLEDevice, protected autoReconnect: boolean) {
            super();
            this.handleDisconnected = this.handleDisconnected.bind(this);
            this.device.device.addEventListener('gattserverdisconnected', this.handleDisconnected);
        }

        private reconnectPromise: Promise<void> = undefined;
        handleDisconnected(event: Event) {
            this.cancelConnectAsync();
            // give a 1sec for device to reboot
            if (this.autoReconnect) {
                if (!this.reconnectPromise)
                    this.reconnectPromise =
                        Promise.delay(1000)
                            .then(() => this.exponentialBackoffConnectAsync(10, 500));
            }
        }

        /* Utils */
        // This function keeps calling "toTry" until promise resolves or has
        // retried "max" number of times. First retry has a delay of "delay" seconds.
        // "success" is called upon success.
        private exponentialBackoffConnectAsync(max: number, delay: number): Promise<void> {
            pxt.debug(`uart: retry connect`)
            return this.connectAsync()
                .then(() => {
                    pxt.debug(`uart: reconnect success`)
                    this.reconnectPromise = undefined;
                })
                .catch(_ => {
                    if (!this.device.isPaired) {
                        pxt.debug(`uart: give up, device unpaired`)
                        this.reconnectPromise = undefined;
                        return undefined;
                    }
                    if (max == 0) {
                        pxt.debug(`uart: give up, max tries`)
                        this.reconnectPromise = undefined;
                        return undefined; // give up
                    }
                    pxt.debug(`uart: retry connect ${delay}ms... (${max} tries left)`);
                    return Promise.delay(delay)
                        .then(() => this.exponentialBackoffConnectAsync(--max, delay * 1.5));
                });
        }
    }

    export class UARTService extends BLEService {
        // Nordic UART BLE service
        static SERVICE_UUID: BluetoothServiceUUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'; // must be lower case!
        static CHARACTERISTIC_RX_UUID: BluetoothCharacteristicUUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
        static CHARACTERISTIC_TX_UUID: BluetoothCharacteristicUUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

        uartService: BluetoothRemoteGATTService;
        txCharacteristic: BluetoothRemoteGATTCharacteristic;

        constructor(protected device: BLEDevice) {
            super(device, true);
            this.handleUARTNotifications = this.handleUARTNotifications.bind(this);
        }

        protected createConnectPromise(): Promise<void> {
            if (this.txCharacteristic)
                return Promise.resolve();
            pxt.debug(`ble: connecting uart`);
            return this.device.connectAsync()
                .then(() => this.device.gatt.getPrimaryService(UARTService.SERVICE_UUID))
                .catch(e => {
                    // crashes when the service is missing
                    pxt.debug(`uart: failed to find service, disable reconnect`)
                    this.autoReconnect = false;
                    throw e; // bubble up
                })
                .then(service => {
                    pxt.debug(`ble: uart service connected`)
                    this.uartService = service;
                    return this.uartService.getCharacteristic(UARTService.CHARACTERISTIC_TX_UUID);
                }).then(txCharacteristic => {
                    pxt.debug(`ble: uart tx characteristic connected`)
                    this.txCharacteristic = txCharacteristic;
                    return this.txCharacteristic.startNotifications()
                }).then(() => {
                    this.txCharacteristic.addEventListener('characteristicvaluechanged', this.handleUARTNotifications);
                });
        }

        handleUARTNotifications(event: Event) {
            const dataView: DataView = (<any>event.target).value;
            const decoder = new (<any>window).TextDecoder();
            const text = decoder.decode(dataView);
            if (text) {
                window.postMessage({
                    type: "serial",
                    id: this.device.name || "ble",
                    data: text
                }, "*")
            }
        }

        disconnect() {
            super.disconnect();
            if (this.txCharacteristic && this.device.connected) {
                try {
                    this.txCharacteristic.stopNotifications();
                    this.txCharacteristic.removeEventListener('characteristicvaluechanged', this.handleUARTNotifications);
                } catch (e) {
                    pxt.log(`uart: error ${e.message}`)
                }
            }
            this.uartService = undefined;
            this.txCharacteristic = undefined;
        }
    }

    enum PartialFlashingState {
        Idle = 1 << 0,
        StatusRequested = 1 << 1,
        PairingModeRequested = 1 << 2,
        RegionDALRequested = 1 << 3,
        RegionMakeCodeRequested = 1 << 4,
        Flash = 1 << 5,
        EndOfTransmision = 1 << 6,
        USBFlashRequired = 1 << 7
    }

    // https://github.com/microbit-sam/microbit-docs/blob/master/docs/ble/partial-flashing-service.md
    export class PartialFlashingService extends BLEService {
        static SERVICE_UUID = 'e97dd91d-251d-470a-a062-fa1922dfa9a8';
        static CHARACTERISTIC_UUID = 'e97d3b10-251d-470a-a062-fa1922dfa9a8';
        static REGION_INFO = 0x00;
        static FLASH_DATA = 0x01;
        static WRITE_NOTIFICATION = 0x01;
        static PACKET_OUT_OF_ORDER = 0xAA;
        static PACKET_WRITTEN = 0xFF;
        static END_OF_TRANSMISSION = 0x02;
        static STATUS = 0xEE;
        static RESET = 0xFF;
        static MODE_PAIRING = 0;
        static MODE_APPLICATION = 0x01;
        static REGION_SOFTDEVICE = 0x00;
        static REGION_DAL = 0x01;
        static REGION_MAKECODE = 0x02;
        static MAGIC_MARKER = Util.fromHex('708E3B92C615A841C49866C975EE5197');
        static SOURCE_MARKER = Util.fromHex('41140E2FB82FA2BB');

        private pfCharacteristic: BluetoothRemoteGATTCharacteristic;
        private state = PartialFlashingState.Idle;
        private version: number;
        private mode: number;
        private regions: { start: number; end: number; hash: string; }[];

        private hex: string;
        private bin: Uint8Array;
        private dalHash: string;
        private makeCodeHash: string;
        private flashOffset: number;

        private flashResolve: (theResult?: void | PromiseLike<void>) => void;
        private flashReject: (e: any) => void;

        constructor(protected device: BLEDevice) {
            super(device, false);
            this.handleCharacteristic = this.handleCharacteristic.bind(this);
        }

        protected createConnectPromise(): Promise<void> {
            pxt.debug(`pf: connecting to partial flash service`);
            return this.device.connectAsync()
                .then(() => this.device.gatt.getPrimaryService(PartialFlashingService.SERVICE_UUID))
                .then(service => {
                    pxt.debug(`pf: connecting to characteristic`)
                    return service.getCharacteristic(PartialFlashingService.CHARACTERISTIC_UUID);
                }).then(characteristic => {
                    pxt.debug(`pf: starting notifications`)
                    this.pfCharacteristic = characteristic;
                    this.pfCharacteristic.startNotifications();
                    this.pfCharacteristic.addEventListener('characteristicvaluechanged', this.handleCharacteristic);
                });
        }

        disconnect() {
            super.disconnect();
            if (this.pfCharacteristic && this.device.connected) {
                try {
                    this.pfCharacteristic.stopNotifications();
                    this.pfCharacteristic.removeEventListener('characteristicvaluechanged', this.handleCharacteristic);
                }
                catch (e) {
                    pxt.log(`ble: partial flash disconnect error ${e.message}`);
                }
            }
        }

        private clearFlashData() {
            this.version = 0;
            this.mode = 0;
            this.regions = [];
            this.hex = undefined;
            this.bin = undefined;
            this.dalHash = undefined;
            this.makeCodeHash = undefined;
            this.flashReject = undefined;
            this.flashResolve = undefined;
            this.flashOffset = undefined;
        }

        // finds block starting with MAGIC_BLOCK
        private findMagicBlock(): number {
            if (!this.bin) return undefined;
            const magic = PartialFlashingService.MAGIC_MARKER;

            for (let offset = 0; offset + magic.length < this.bin.length; offset += 16) {
                let match = true;
                for (let j = 0; j < magic.length; ++j) {
                    if (magic[j] != this.bin[offset + j]) {
                        match = false;
                        break;
                    }
                }
                if (match)
                    return offset;
            }
            return -1;
        }

        private isCursorAtMarker(marker: Uint8Array): boolean {
            if (this.flashOffset + marker.length > this.bin.length)
                return false;
            for (let i = 0; i < marker.length; ++i)
                if (this.bin[this.flashOffset + i] != marker[i])
                    return false;
            return true;
        }

        flashAsync(hex: string): Promise<void> {
            if (this.hex) {
                pxt.debug(`pf: flashing already in progress`)
                return Promise.resolve();
            }
            this.clearFlashData();
            this.hex = hex;
            const uf2 = ts.pxtc.UF2.newBlockFile();
            ts.pxtc.UF2.writeHex(uf2, this.hex.split(/\r?\n/));
            this.bin = ts.pxtc.UF2.toBin(U.stringToUint8Array(ts.pxtc.UF2.serializeFile(uf2))).buf;
            pxt.debug(`pf: bin bytes ${this.bin.length}`)
            const offset = this.findMagicBlock();
            if (offset < 0) {
                pxt.debug(`pf: magic block not found, not a valid HEX file`);
                U.userError(lf("Invalid file"));
            }

            pxt.debug(`pf: magic block at ${offset.toString(16)}`);
            // magic + 16bytes = hash
            const hashOffset = offset + PartialFlashingService.MAGIC_MARKER.length;
            pxt.debug(`pf: hash offset ${hashOffset.toString(16)}`);
            this.dalHash = Util.toHex(this.bin.slice(hashOffset, hashOffset + 8));
            this.makeCodeHash = Util.toHex(this.bin.slice(hashOffset + 8, hashOffset + 16));
            pxt.debug(`pf: DAL hash ${this.dalHash}`)
            pxt.debug(`pf: MakeCode hash ${this.makeCodeHash}`)

            return this.connectAsync()
                .then(() => new Promise<void>((resolve, reject) => {
                    this.flashResolve = resolve;
                    this.flashReject = reject;
                    pxt.debug(`pf: check service version`)
                    this.state = PartialFlashingState.StatusRequested;
                    this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.STATUS]));
                })).then(() => { },
                    e => {
                        pxt.log(`pf: error ${e.message}`)
                        this.clearFlashData();
                    });
        }

        private checkStateTransition(cmd: number, acceptedStates: PartialFlashingState) {
            if (!(this.state & acceptedStates)) {
                pxt.debug(`pf: flash cmd ${cmd} in state ${this.state.toString(16)} `);
                this.disconnect();
                return false;
            }
            return true;
        }

        private handleCharacteristic(ev: Event) {
            const dataView: DataView = (<any>event.target).value;
            const packet = new Uint8Array(dataView.buffer);
            const cmd = packet[0];
            pxt.debug(`pf: flash state ${this.state} - cmd ${cmd}`);
            if (this.state == PartialFlashingState.Idle) // rogue response
                return;
            switch (cmd) {
                case PartialFlashingService.STATUS:
                    if (!this.checkStateTransition(cmd, PartialFlashingState.StatusRequested | PartialFlashingState.PairingModeRequested))
                        return;
                    this.version = packet[1];
                    this.mode = packet[2];
                    pxt.debug(`ble: flash service version ${this.version} mode ${this.mode}`)
                    // what happens when there is no pairing mode?
                    if (this.mode != PartialFlashingService.MODE_PAIRING) {
                        pxt.debug(`ble: reset into pairing mode`)
                        this.state = PartialFlashingState.PairingModeRequested;
                        this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.RESET, PartialFlashingService.MODE_PAIRING]));

                        this.device.disconnect(); // disconnect WebBLE services
                        Promise.delay(2000)
                            .then(() => {
                                pxt.debug(`pf: reconnect to pairing mode`)
                                return this.connectAsync()
                            }).then(() => {
                                pxt.debug(`pf: request DAL region (in pairing mode)`)
                                this.state = PartialFlashingState.RegionDALRequested;
                                this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.REGION_INFO, PartialFlashingService.REGION_DAL]));
                            })
                        return;
                    }

                    pxt.debug(`pf: reading DAL region`)
                    this.state = PartialFlashingState.RegionDALRequested;
                    this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.REGION_INFO, PartialFlashingService.REGION_DAL]));
                    break;
                case PartialFlashingService.REGION_INFO:
                    if (!this.checkStateTransition(cmd, PartialFlashingState.RegionDALRequested | PartialFlashingState.RegionMakeCodeRequested))
                        return;
                    const region = this.regions[packet[1]] = {
                        start: (packet[2] << 24) | (packet[3] << 16) | (packet[4] << 8) | packet[5],
                        end: (packet[6] << 24) | (packet[7] << 16) | (packet[8] << 8) | packet[9],
                        hash: pxt.Util.toHex(packet.slice(10))
                    };
                    pxt.debug(`pf: read region ${packet[1]} start ${region.start.toString(16)} end ${region.end.toString(16)} hash ${region.hash}`)
                    if (packet[1] == PartialFlashingService.REGION_DAL) {
                        if (region.hash != this.dalHash) {
                            pxt.debug(`pf: DAL hash does not match, partial flashing not possible`)
                            this.state = PartialFlashingState.USBFlashRequired;
                            this.flashReject(new Error("USB flashing required"));
                            this.clearFlashData();
                            return;
                        }

                        pxt.debug(`pf: DAL hash match, reading makecode region`)
                        this.state = PartialFlashingState.RegionMakeCodeRequested;
                        this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.REGION_INFO, PartialFlashingService.REGION_MAKECODE]));
                    } else if (packet[1] == PartialFlashingService.REGION_MAKECODE) {
                        if (region.hash == this.makeCodeHash) {
                            pxt.debug(`pf: MakeCode hash matches, nothing to do`)
                            this.state = PartialFlashingState.Idle;
                            this.flashResolve();
                            this.clearFlashData();
                        } else {
                            // ready to flash the data in 4 chunks
                            this.flashOffset = region.start;
                            pxt.debug(`pf: starting to flash from address ${this.flashOffset.toString(16)}`);
                            setTimeout(() => this.flashNextPacket(), 1);
                        }
                    }
                    break;
                case PartialFlashingService.WRITE_NOTIFICATION:
                    if (!this.checkStateTransition(cmd, PartialFlashingState.Flash))
                        return;
                    switch (packet[1]) {
                        case PartialFlashingService.PACKET_OUT_OF_ORDER:
                            pxt.debug(`pf: packet out of order`);
                            U.assert(false, 'packet out of order')
                            break;
                        case PartialFlashingService.PACKET_WRITTEN:
                            // move cursor
                            this.flashOffset += 64;
                            if (this.isCursorAtMarker(PartialFlashingService.SOURCE_MARKER)
                                || this.flashOffset >= this.bin.length) {
                                pxt.debug('pf: end transmission')
                                this.state = PartialFlashingState.EndOfTransmision;
                                this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.END_OF_TRANSMISSION]));
                                // we are done!
                                this.flashResolve();
                                this.clearFlashData();
                            } else { // keep flashing
                                setTimeout(() => this.flashNextPacket(), 1);
                            }
                            break;
                    }
                default:
                    pxt.debug(`pf: unknown message ${pxt.Util.toHex(packet)}`);
                    this.disconnect();
                    break;
            }
        }

        // send 64bytes in 4 BLE packets
        private flashNextPacket() {
            this.state = PartialFlashingState.Flash;

            const hex = this.bin.slice(this.flashOffset, this.flashOffset + 64);
            pxt.debug(`pf: flashing offset ${this.flashOffset.toString(16)}`);

            let chunk = new Uint8Array(20);
            chunk[0] = PartialFlashingService.FLASH_DATA;
            chunk[1] = this.flashOffset >> 8; // 2 bytes of offset
            chunk[2] = this.flashOffset;
            chunk[3] = 0; // packet number
            for (let i = 0; i < 16; i++)
                chunk[4 + i] = hex[i];
            this.pfCharacteristic.writeValue(chunk);

            chunk[0] = PartialFlashingService.FLASH_DATA;
            chunk[1] = this.flashOffset >> 24; // other 2 bytes of offset
            chunk[2] = this.flashOffset >> 16;
            chunk[3] = 1; // packet number
            for (let i = 0; i < 16; i++)
                chunk[4 + i] = hex[16 + i] || 0;
            this.pfCharacteristic.writeValue(chunk);

            chunk[0] = PartialFlashingService.FLASH_DATA;
            chunk[1] = 0;
            chunk[2] = 0;
            chunk[3] = 2; // packet number
            for (let i = 0; i < 16; i++)
                chunk[4 + i] = hex[32 + i] || 0;
            this.pfCharacteristic.writeValue(chunk);

            chunk[0] = PartialFlashingService.FLASH_DATA;
            chunk[1] = 0;
            chunk[2] = 0;
            chunk[3] = 3; // packet number
            for (let i = 0; i < 16; i++)
                chunk[4 + i] = hex[48 + i] || 0;
            this.pfCharacteristic.writeValue(chunk);

            // now we wait for a write notification
            pxt.debug(`pf: flash packets sent, waiting for write confirmation`)
        }
    }

    export class BLEDevice extends BLERemote {
        device: BluetoothDevice = undefined;
        private services: BLEService[] = [];
        uartService: UARTService; // may be undefined
        partialFlashingService: PartialFlashingService; // may be undefined

        constructor(device: BluetoothDevice) {
            super();
            this.device = device;
            this.handleDisconnected = this.handleDisconnected.bind(this);
            this.device.addEventListener('gattserverdisconnected', this.handleDisconnected);

            if (hasConsole())
                this.services.push(this.uartService = new UARTService(this));
            if (hasPartialFlash())
                this.services.push(this.partialFlashingService = new PartialFlashingService(this));
        }

        get isPaired() {
            return this === bleDevice;
        }

        get name(): string {
            return this.device.name || "?";
        }

        get connected(): boolean {
            return this.device && this.device.gatt && this.device.gatt.connected;
        }

        get gatt(): BluetoothRemoteGATTServer {
            return this.device.gatt;
        }

        protected createConnectPromise(): Promise<void> {
            return wrapPromise<void>(this.device.gatt.connect()
                .then(() => {
                    pxt.debug(`ble: gatt connected`);
                }));
        }

        handleDisconnected(event: Event) {
            pxt.debug(`ble: disconnected`)
            this.disconnect();
        }

        disconnect() {
            super.disconnect();
            this.services.forEach(service => service.disconnect());
            if (!this.connected) return;
            pxt.debug(`ble: disconnect`)
            try {
                try {
                    this.device.gatt.disconnect();
                } catch (e) {
                    pxt.debug(`ble: gatt disconnect error ${e.message}`);
                }
            } catch (e) {
                pxt.log(`ble: error ${e.message}`)
            }
        }
    }

    export let bleDevice: BLEDevice = undefined;
    function connectAsync(): Promise<void> {
        if (bleDevice) return Promise.resolve();

        pxt.log(`ble: requesting device`)
        const optionalServices = [];
        if (pxt.appTarget.appTheme.bluetoothUartFilters)
            optionalServices.push(UARTService.SERVICE_UUID);
        if (pxt.appTarget.appTheme.bluetoothPartialFlashing)
            optionalServices.push(PartialFlashingService.SERVICE_UUID)
        return navigator.bluetooth.requestDevice({
            filters: pxt.appTarget.appTheme.bluetoothUartFilters,
            optionalServices
        }).then(device => {
            pxt.log(`ble: received device ${device.name}`)
            bleDevice = new BLEDevice(device);
        });
    }

    export function isPaired(): boolean {
        return !!bleDevice;
    }

    export function pairAsync(): Promise<void> {
        if (bleDevice)
            bleDevice.disconnect();
        bleDevice = undefined;
        return connectAsync()
            .then(() => bleDevice.uartService.connectAsync())
            .then(() => pxt.log(`ble: uart connected`)
                , e => {
                    pxt.log(`ble: error ${e.message}`)
                })
    }

    export function flashAsync(resp: pxtc.CompileResult, d: pxt.commands.DeployOptions = {}): Promise<void> {
        const hex = resp.outfiles[ts.pxtc.BINARY_HEX];
        return connectAsync()
            .then(() => bleDevice.partialFlashingService.flashAsync(hex));
    }
}