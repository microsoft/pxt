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

    export function isValidUUID(id: string): boolean {
        // https://webbluetoothcg.github.io/web-bluetooth/#uuids
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
    }

    export class BLERemote {
        public id: string;
        public aliveToken: pxt.Util.CancellationToken;
        public connectionTimeout = 20000; // 20 second default timeout
        private connectPromise: Promise<void> = undefined;

        constructor(id: string, aliveToken: pxt.Util.CancellationToken) {
            this.id = id;
            this.aliveToken = aliveToken;
        }

        protected debug(msg: string) {
            pxt.debug(`${this.id}: ${msg}`);
        }

        protected alivePromise<T>(p: Promise<T>): Promise<T> {
            return new Promise((resolve, reject) => {
                if (this.aliveToken.isCancelled())
                    reject(new Error());
                p.then(r => resolve(r), e => reject(e));
            })
        }

        protected cancelConnect(): void {
            this.connectPromise = undefined;
        }

        protected createConnectPromise(): Promise<void> {
            return Promise.resolve();
        }

        connectAsync(): Promise<void> {
            if (!this.connectPromise)
                this.connectPromise = this.alivePromise(this.createConnectPromise())
            return this.connectPromise
                .timeout(this.connectionTimeout, "connection timeout")
                .then(() => this.aliveToken.throwIfCancelled())
                .catch(e => {
                    // connection failed, clear promise to try again
                    this.connectPromise = undefined;
                    throw e;
                });
        }

        disconnect(): void {
            this.cancelConnect();
        }

        kill() {
            this.disconnect();
            this.aliveToken.cancel();
        }
    }

    export class BLEService extends BLERemote {
        public autoReconnectDelay = 1000;
        public disconnectOnAutoReconnect = false;
        private reconnectPromise: Promise<void> = undefined;
        private failedConnectionServicesVersion = -1;

        constructor(id: string, protected device: BLEDevice, public autoReconnect: boolean) {
            super(id, device.aliveToken);
            this.handleDisconnected = this.handleDisconnected.bind(this);
            this.device.device.addEventListener('gattserverdisconnected', this.handleDisconnected);
        }

        handleDisconnected(event: Event) {
            if (this.aliveToken.isCancelled()) return;
            this.disconnect();
            // give a 1sec for device to reboot
            if (this.autoReconnect && !this.reconnectPromise)
                this.reconnectPromise =
                    Promise.delay(this.autoReconnectDelay)
                        .then(() => this.exponentialBackoffConnectAsync(8, 500))
                        .catch(e => pxt.debug(`reconnect failed`))
                        .finally(() => this.reconnectPromise = undefined);
        }

        /* Utils */
        // This function keeps calling "toTry" until promise resolves or has
        // retried "max" number of times. First retry has a delay of "delay" seconds.
        // "success" is called upon success.
        private exponentialBackoffConnectAsync(max: number, delay: number): Promise<void> {
            this.debug(`retry connect`)
            this.aliveToken.throwIfCancelled();
            return this.connectAsync()
                .then(() => {
                    this.aliveToken.throwIfCancelled();
                    this.debug(`reconnect success`)
                    this.reconnectPromise = undefined;
                })
                .catch(e => {
                    this.debug(`reconnect error ${e.message}`);
                    this.aliveToken.throwIfCancelled();
                    if (!this.device.isPaired) {
                        this.debug(`give up, device unpaired`)
                        this.reconnectPromise = undefined;
                        return undefined;
                    }
                    if (!this.autoReconnect) {
                        this.debug(`autoreconnect disabled`)
                        this.reconnectPromise = undefined;
                        return undefined;
                    }
                    if (max == 0) {
                        this.debug(`give up, max tries`)
                        this.reconnectPromise = undefined;
                        return undefined; // give up
                    }
                    // did we already try to reconnect with the current state of services?
                    if (this.failedConnectionServicesVersion == this.device.servicesVersion) {
                        this.debug(`services haven't changed, giving up`);
                        this.reconnectPromise = undefined;
                        return undefined;
                    }
                    this.debug(`retry connect ${delay}ms... (${max} tries left)`);
                    // record service version if connected
                    if (this.device.connected)
                        this.failedConnectionServicesVersion = this.device.servicesVersion;
                    if (this.disconnectOnAutoReconnect)
                        this.device.disconnect();
                    return Promise.delay(delay)
                        .then(() => this.exponentialBackoffConnectAsync(--max, delay * 1.8));
                })
        }
    }

    export class BLETXService extends BLEService {
        service: BluetoothRemoteGATTService;
        txCharacteristic: BluetoothRemoteGATTCharacteristic;

        constructor(id: string, protected device: BLEDevice, private serviceUUID: BluetoothServiceUUID, private txCharacteristicUUID: BluetoothServiceUUID) {
            super(id, device, true);
            this.handleValueChanged = this.handleValueChanged.bind(this);
        }

        protected createConnectPromise(): Promise<void> {
            this.debug(`connecting`);
            return this.device.connectAsync()
                .then(() => this.alivePromise(this.device.gatt.getPrimaryService(this.serviceUUID)))
                .then(service => {
                    this.debug(`service connected`)
                    this.service = service;
                    return this.alivePromise(this.service.getCharacteristic(this.txCharacteristicUUID));
                }).then(txCharacteristic => {
                    this.debug(`tx characteristic connected`)
                    this.txCharacteristic = txCharacteristic;
                    this.txCharacteristic.addEventListener('characteristicvaluechanged', this.handleValueChanged);
                    return this.txCharacteristic.startNotifications()
                }).then(() => {
                    pxt.tickEvent(`webble.${this.id}.connected`);
                });
        }

        handlePacket(data: DataView) {

        }

        private handleValueChanged(event: Event) {
            const dataView: DataView = (<any>event.target).value;
            this.handlePacket(dataView);
        }

        disconnect() {
            super.disconnect();
            if (this.txCharacteristic && this.device && this.device.connected) {
                try {
                    this.txCharacteristic.stopNotifications();
                    this.txCharacteristic.removeEventListener('characteristicvaluechanged', this.handleValueChanged);
                } catch (e) {
                    pxt.log(`${this.id}: error ${e.message}`)
                }
            }
            this.service = undefined;
            this.txCharacteristic = undefined;
        }
    }


    export class HF2Service extends BLETXService {
        static SERVICE_UUID: BluetoothServiceUUID = 'b112f5e6-2679-30da-a26e-0273b6043849';
        static CHARACTERISTIC_TX_UUID: BluetoothCharacteristicUUID = 'b112f5e6-2679-30da-a26e-0273b604384a';
        static BLEHF2_FLAG_SERIAL_OUT = 0x80;
        static BLEHF2_FLAG_SERIAL_ERR = 0xC0;

        constructor(protected device: BLEDevice) {
            super("hf2", device, HF2Service.SERVICE_UUID, HF2Service.CHARACTERISTIC_TX_UUID);
        }

        handlePacket(data: DataView) {
            const cmd = data.getUint8(0);
            switch (cmd & 0xc0) {
                case HF2Service.BLEHF2_FLAG_SERIAL_OUT:
                case HF2Service.BLEHF2_FLAG_SERIAL_ERR:
                    const n = Math.min(data.byteLength - 1, cmd & ~0xc0); // length in bytes
                    let text = "";
                    for (let i = 0; i < n; ++i)
                        text += String.fromCharCode(data.getUint8(i + 1));
                    if (text) {
                        window.postMessage({
                            type: "serial",
                            id: this.device.name || "hf2",
                            data: text
                        }, "*")
                    }
                    break;
            }
        }
    }

    export class UARTService extends BLETXService {
        // Nordic UART BLE service
        static SERVICE_UUID: BluetoothServiceUUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'; // must be lower case!
        static CHARACTERISTIC_TX_UUID: BluetoothCharacteristicUUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

        constructor(protected device: BLEDevice) {
            super("uart", device, UARTService.SERVICE_UUID, UARTService.CHARACTERISTIC_TX_UUID);
        }

        handlePacket(data: DataView) {
            const decoder = new (<any>window).TextDecoder();
            const text = decoder.decode(data);
            if (text) {
                window.postMessage({
                    type: "serial",
                    id: this.device.name || "uart",
                    data: text
                }, "*")
            }
        }
    }

    export class BLEFlashingService extends BLEService {
        protected hex: string;
        protected bin: Uint8Array;
        protected magicOffset: number;
        protected dalHash: string;
        protected makeCodeHash: string;
        static MAGIC_MARKER = Util.fromHex('708E3B92C615A841C49866C975EE5197');

        constructor(id: string, device: BLEDevice, autoReconnect: boolean) {
            super(id, device, autoReconnect);
        }


        flashAsync(hex: string): Promise<void> {
            if (this.hex) {
                this.debug(`flashing already in progress`)
                return Promise.resolve();
            }
            this.device.pauseLog();
            this.clearFlashData();
            this.setFlashData(hex);
            return this.connectAsync()
                .then(() => this.createFlashPromise())
                .finally(() => this.device.resumeLogOnDisconnection());
        }

        protected createFlashPromise(): Promise<void> {
            return Promise.resolve();
        }

        // finds block starting with MAGIC_BLOCK
        private findMarker(offset: number, marker: Uint8Array): number {
            if (!this.bin) return -1;

            for (; offset + marker.length < this.bin.length; offset += 16) {
                let match = true;
                for (let j = 0; j < marker.length; ++j) {
                    if (marker[j] != this.bin[offset + j]) {
                        match = false;
                        break;
                    }
                }
                if (match)
                    return offset;
            }
            return -1;
        }

        private setFlashData(hex: string) {
            this.hex = hex;
            const uf2 = ts.pxtc.UF2.newBlockFile();
            ts.pxtc.UF2.writeHex(uf2, this.hex.split(/\r?\n/));
            const flashUsableEnd = pxt.appTarget.compile.flashUsableEnd;
            this.bin = ts.pxtc.UF2.toBin(U.stringToUint8Array(ts.pxtc.UF2.serializeFile(uf2)), flashUsableEnd).buf;
            this.debug(`bin bytes ${this.bin.length}`);
            this.magicOffset = this.findMarker(0, BLEFlashingService.MAGIC_MARKER);
            this.debug(`magic block ${this.magicOffset.toString(16)}`);
            if (this.magicOffset < 0) {
                this.debug(`magic block not found, not a valid HEX file`);
                U.userError(lf("Invalid file"));
            }
            this.debug(`bytes to flash ${this.bin.length - this.magicOffset}`)

            // magic + 16bytes = hash
            const hashOffset = this.magicOffset + BLEFlashingService.MAGIC_MARKER.length;
            this.dalHash = Util.toHex(this.bin.slice(hashOffset, hashOffset + 8));
            this.makeCodeHash = Util.toHex(this.bin.slice(hashOffset + 8, hashOffset + 16));
            this.debug(`DAL hash ${this.dalHash}`)
            this.debug(`MakeCode hash ${this.makeCodeHash}`)
        }

        protected clearFlashData() {
            this.hex = undefined;
            this.bin = undefined;
            this.magicOffset = undefined;
            this.dalHash = undefined;
            this.makeCodeHash = undefined;
            this.autoReconnect = false;
        }
    }

    export enum DFUServiceState {
        Idle = 1 << 0,
        DFURequested = 1 << 2,
        DFU = 1 << 4
    }

    // see https://github.com/thegecko/web-bluetooth-dfu
    export class DFUService extends BLEFlashingService {
        static UUIDS = {
            CONTROL: {
                NAME: "dfu control",
                SERVICE: 'e95d93b0-251d-470a-a062-fa1922dfa9a8',
                CONTROL: 'e95d93b1-251d-470a-a062-fa1922dfa9a8',
                PACKET: 'e95d93b2-251d-470a-a062-fa1922dfa9a8' // it's "flash really"
            },
            DFU: {
                NAME: "dfu",
                SERVICE: '00001530-1212-efde-1523-785feabcd123',
                CONTROL: '00001531-1212-efde-1523-785feabcd123',
                PACKET: '00001532-1212-efde-1523-785feabcd123',
                /*version: '00001534-1212-efde-1523-785feabcd123'*/
            }
        };
        static DFU_LITTLE_ENDIAN = true;
        static DFU_PACKET_SIZE = 20;
        static DFU_OPERATIONS = {
            BUTTON_COMMAND: [0x01],
            CREATE_COMMAND: [0x01, 0x01],
            CREATE_DATA: [0x01, 0x02],
            RECEIPT_NOTIFICATIONS: [0x02],
            CACULATE_CHECKSUM: [0x03],
            EXECUTE: [0x04],
            SELECT_COMMAND: [0x06, 0x01],
            SELECT_DATA: [0x06, 0x02],
            RESPONSE: [0x60, 0x20]
        };
        static DFU_RESPONSE: pxt.Map<string> = {
            // Invalid code
            0x00: "Invalid opcode",
            // Success
            0x01: "Operation successful",
            // Opcode not supported
            0x02: "Opcode not supported",
            // Invalid parameter
            0x03: "Missing or invalid parameter value",
            // Insufficient resources
            0x04: "Not enough memory for the data object",
            // Invalid object
            0x05: "Data object does not match the firmware and hardware requirements, the signature is wrong, or parsing the command failed",
            // Unsupported type
            0x07: "Not a valid object type for a Create request",
            // Operation not permitted
            0x08: "The state of the DFU process does not allow this operation",
            // Operation failed
            0x0A: "Operation failed",
            // Extended error
            0x0B: "Extended error"
        };
        static DFU_EXTENDED_ERROR: pxt.Map<string> = {
            // No error
            0x00: "No extended error code has been set. This error indicates an implementation problem",
            // Invalid error code
            0x01: "Invalid error code. This error code should never be used outside of development",
            // Wrong command format
            0x02: "The format of the command was incorrect",
            // Unknown command
            0x03: "The command was successfully parsed, but it is not supported or unknown",
            // Init command invalid
            0x04: "The init command is invalid. The init packet either has an invalid update type or it is missing required fields for the update type",
            // Firmware version failure
            0x05: "The firmware version is too low. For an application, the version must be greater than the current application. For a bootloader, it must be greater than or equal to the current version",
            // Hardware version failure
            0x06: "The hardware version of the device does not match the required hardware version for the update",
            // Softdevice version failure
            0x07: "The array of supported SoftDevices for the update does not contain the FWID of the current SoftDevice",
            // Signature missing
            0x08: "The init packet does not contain a signature",
            // Wrong hash type
            0x09: "The hash type that is specified by the init packet is not supported by the DFU bootloader",
            // Hash failed
            0x0A: "The hash of the firmware image cannot be calculated",
            // Wrong signature type
            0x0B: "The type of the signature is unknown or not supported by the DFU bootloader",
            // Verification failed
            0x0C: "The hash of the received firmware image does not match the hash in the init packet",
            // Insufficient space
            0x0D: "The available space on the device is insufficient to hold the firmware"
        };

        state = DFUServiceState.Idle;
        private service: BluetoothRemoteGATTService;
        private chunkDelay: number;
        private controlCharacteristic: BluetoothRemoteGATTCharacteristic;
        private packetCharacteristic: BluetoothRemoteGATTCharacteristic;
        private notifyFns: pxt.Map<{
            resolve: (data: DataView) => void,
            reject: (e: Error) => void
        }> = {};

        constructor(protected device: BLEDevice) {
            super("dfu ", device, false);
            this.autoReconnect = false;
            this.disconnectOnAutoReconnect = true;
            this.handleCharacteristic = this.handleCharacteristic.bind(this);
            this.chunkDelay = 1;
        }

        protected createConnectPromise(): Promise<void> {
            const uuids = this.state == DFUServiceState.DFURequested
                ? DFUService.UUIDS.CONTROL : DFUService.UUIDS.DFU;
            this.debug(`connecting to ${uuids.NAME}`);
            return this.device.connectAsync()
                .then(() => this.alivePromise(this.device.gatt.getPrimaryService(uuids.SERVICE)))
                .then(service => {
                    this.service = service;
                    this.debug(`connecting to control characteristic`)
                    return this.alivePromise(this.service.getCharacteristic(uuids.CONTROL));
                }).then(controlCharacteristic => {
                    this.controlCharacteristic = controlCharacteristic;
                    this.debug(`connecting to packet characteristic`)
                    return this.alivePromise(this.service.getCharacteristic(uuids.PACKET));
                }).then(packetCharacteristic => {
                    this.packetCharacteristic = packetCharacteristic;
                    this.debug(`starting notifications`)
                    return this.controlCharacteristic.startNotifications()
                }).then(() => {
                    this.controlCharacteristic.addEventListener('characteristicvaluechanged', this.handleCharacteristic);

                    // so we requested the DFU and we got it
                    if (this.state == DFUServiceState.DFURequested) {
                        this.debug(`dfu mode`)
                        this.state = DFUServiceState.DFU;
                        this.autoReconnect = false;
                        return this.dfuTransferBinAsync();
                    }
                    return Promise.resolve();
                });
        }

        disconnect() {
            super.disconnect();
            if (this.controlCharacteristic && this.device.connected) {
                try {
                    this.controlCharacteristic.stopNotifications();
                    this.controlCharacteristic.removeEventListener('characteristicvaluechanged', this.handleCharacteristic);
                }
                catch (e) {
                    pxt.log(`ble: dfu disconnect error control ${e.message}`);
                }
            }
            this.controlCharacteristic = undefined;
            if (this.packetCharacteristic && this.device.connected) {
                try {
                    this.packetCharacteristic.stopNotifications();
                    this.packetCharacteristic.removeEventListener('characteristicvaluechanged', this.handleCharacteristic);
                }
                catch (e) {
                    pxt.log(`ble: dfu disconnect error packet ${e.message}`);
                }
            }
        }

        private handleCharacteristic(ev: Event) {
            // check service is still alive
            if (this.aliveToken.isCancelled()) {
                // done
                return;
            }
            switch (this.state) {
                case DFUServiceState.Idle:
                    // rogue request
                    break;
                case DFUServiceState.DFURequested:
                    this.debug(`dfu control responded`);
                    break;
                case DFUServiceState.DFU:
                    //case DFUServiceState.DFU:
                    this.handleDFUCharacteristic(ev);
            }
        }

        private handleDFUCharacteristic(ev: Event) {
            const dataView: DataView = (<any>event.target).value;
            const cmd = dataView.getUint8(0);
            const operation = dataView.getUint8(1);
            const result = dataView.getUint8(2);

            this.debug(`${cmd.toString(16)}> ${operation.toString(16)}> ${result.toString(16)}`);

            if (DFUService.DFU_OPERATIONS.RESPONSE.indexOf(cmd) < 0) {
                throw new Error("Unrecognised control characteristic response notification");
            }

            if (this.notifyFns[operation]) {
                let error: string = null;

                if (result === 0x01) {
                    const data = new DataView(dataView.buffer, 3);
                    this.notifyFns[operation].resolve(data);
                } else if (result === 0x0B) {
                    const code = dataView.getUint8(3);
                    error = `Error: ${DFUService.DFU_EXTENDED_ERROR[code]}`;
                } else {
                    error = `Error: ${DFUService.DFU_RESPONSE[result]}`;
                }

                if (error) {
                    this.debug(`notify: ${error}`);
                    this.notifyFns[operation].reject(new Error(error));
                }
                delete this.notifyFns[operation];
            }
        }

        private sendDFUControlAsync(operation: Array<number>, buffer?: ArrayBuffer): Promise<DataView> {
            return new Promise((resolve, reject) => {
                let size = operation.length;
                if (buffer) size += buffer.byteLength;

                const value = new Uint8Array(size);
                value.set(operation);
                if (buffer) {
                    const data = new Uint8Array(buffer);
                    value.set(data, operation.length);
                }

                this.notifyFns[operation[0]] = {
                    resolve: resolve,
                    reject: reject
                };

                this.debug(`send ctrl ${operation[0].toString(16)}`)
                this.controlCharacteristic.writeValue(value).done();
            });
        }

        private dfuTransferBinAsync() {
            // the microbit init packet is ignored by the bootloader
            const init = new ArrayBuffer(0);
            return this.dfuTransferInitAsync(init)
                .then(() => this.dfuTransferFirmwareAsync(this.bin.buffer));
        }

        private dfuTransferInitAsync(buffer: ArrayBuffer): Promise<void> {
            return this.dfuTransferAsync(buffer, "init", DFUService.DFU_OPERATIONS.SELECT_COMMAND, DFUService.DFU_OPERATIONS.CREATE_COMMAND);
        }

        private dfuTransferFirmwareAsync(buffer: ArrayBuffer): Promise<void> {
            this.debug(`dfu transfer ${buffer.byteLength >> 10} kb`);
            return this.dfuTransferAsync(buffer, "firmware", DFUService.DFU_OPERATIONS.SELECT_DATA, DFUService.DFU_OPERATIONS.CREATE_DATA);
        }

        private dfuTransferAsync(buffer: ArrayBuffer, type: string, selectType: Array<number>, createType: Array<number>): Promise<void> {
            this.debug(`transfer ${type} ${buffer.byteLength >> 10}kb`);
            return this.sendDFUControlAsync(selectType)
                .then(response => {
                    const maxSize = response.getUint32(0, DFUService.DFU_LITTLE_ENDIAN);
                    const offset = response.getUint32(4, DFUService.DFU_LITTLE_ENDIAN);
                    const crc = response.getInt32(8, DFUService.DFU_LITTLE_ENDIAN);

                    // TODO crc check
                    if (type === "init" && offset === buffer.byteLength) {
                        this.debug("init packet already available, skipping transfer");
                        return Promise.resolve();
                    }

                    // TODO this.progress(0);
                    return this.dfuTransferObjectAsync(buffer, createType, maxSize, offset);
                });
        }

        private dfuTransferObjectAsync(buffer: ArrayBuffer, createType: Array<number>, maxSize: number, offset: number): Promise<void> {
            const start = offset - offset % maxSize;
            const end = Math.min(start + maxSize, buffer.byteLength);

            const view = new DataView(new ArrayBuffer(4));
            view.setUint32(0, end - start, DFUService.DFU_LITTLE_ENDIAN);

            return this.sendDFUControlAsync(createType, view.buffer)
                .then(() => {
                    const data = buffer.slice(start, end);
                    return this.dfuTransferDataAsync(data, start);
                })
                .then(() => {
                    return this.sendDFUControlAsync(DFUService.DFU_OPERATIONS.CACULATE_CHECKSUM);
                })
                .then(response => {
                    const crc = response.getInt32(4, DFUService.DFU_LITTLE_ENDIAN);
                    const transferred = response.getUint32(0, DFUService.DFU_LITTLE_ENDIAN);
                    const data = buffer.slice(0, transferred);

                    // TODO: CRC
                    this.debug(`written ${transferred} bytes`);
                    offset = transferred;
                    return this.sendDFUControlAsync(DFUService.DFU_OPERATIONS.EXECUTE);
                })
                .then(() => {
                    if (end < buffer.byteLength) {
                        return this.dfuTransferObjectAsync(buffer, createType, maxSize, offset);
                    } else {
                        this.debug("transfer complete");
                        return Promise.resolve();
                    }
                });
        }

        private dfuTransferDataAsync(data: ArrayBuffer, offset: number, start?: number): Promise<void> {
            start = start || 0;
            const end = Math.min(start + DFUService.DFU_PACKET_SIZE, data.byteLength);
            const packet = data.slice(start, end);

            return this.packetCharacteristic.writeValue(packet)
                .then(() => Promise.delay(this.chunkDelay))
                .then(() => {
                    // this.progress(offset + end);
                    if (end < data.byteLength) {
                        return this.dfuTransferDataAsync(data, offset, end);
                    }

                    return Promise.resolve();
                });
        }

        protected createFlashPromise(): Promise<void> {
            // request device to enter bootloader mode
            this.debug(`dfu: request bootloader mode`);
            this.autoReconnect = true;
            this.state = DFUServiceState.DFURequested;
            const msg = new Uint8Array(4);
            msg[0] = 0x01;
            return this.controlCharacteristic.writeValue(msg);
        }
    }

    export enum PartialFlashingState {
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
    export class PartialFlashingService extends BLEFlashingService {
        static SERVICE_UUID = 'e97dd91d-251d-470a-a062-fa1922dfa9a8';
        static CHARACTERISTIC_UUID = 'e97d3b10-251d-470a-a062-fa1922dfa9a8';
        static REGION_INFO = 0x00;
        static FLASH_DATA = 0x01;
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
        static CHUNK_MIN_DELAY = 0;
        static CHUNK_MAX_DELAY = 75;

        private pfCharacteristic: BluetoothRemoteGATTCharacteristic;
        state = PartialFlashingState.Idle;
        private chunkDelay: number;
        private version: number;
        private mode: number;
        private regions: { start: number; end: number; hash: string; }[];

        private flashOffset: number;
        private flashPacketNumber: number;
        private flashPacketToken: pxt.Util.CancellationToken;

        private _flashResolve: (theResult?: void | PromiseLike<void>) => void;
        private _flashReject: (e: any) => void;

        constructor(protected device: BLEDevice) {
            super("partial flashing", device, false);
            this.disconnectOnAutoReconnect = true;
            this.handleCharacteristic = this.handleCharacteristic.bind(this);
        }

        protected clearFlashData() {
            super.clearFlashData();

            this.version = 0;
            this.mode = 0;
            this.regions = [];

            this.chunkDelay = PartialFlashingService.CHUNK_MIN_DELAY;
            this._flashReject = undefined;
            this._flashResolve = undefined;
            this.flashOffset = undefined;
        }

        protected createConnectPromise(): Promise<void> {
            this.debug(`connecting to partial flash service`);
            return this.device.connectAsync()
                .then(() => this.alivePromise(this.device.gatt.getPrimaryService(PartialFlashingService.SERVICE_UUID)))
                .then(service => {
                    this.debug(`connecting to characteristic`)
                    return this.alivePromise(service.getCharacteristic(PartialFlashingService.CHARACTERISTIC_UUID));
                }).then(characteristic => {
                    this.debug(`starting notifications`)
                    this.pfCharacteristic = characteristic;
                    return this.pfCharacteristic.startNotifications();
                }).then(() => {
                    this.pfCharacteristic.addEventListener('characteristicvaluechanged', this.handleCharacteristic);

                    // looks like we asked the device to reconnect in pairing mode, 
                    // let's see if that worked out
                    if (this.state == PartialFlashingState.PairingModeRequested) {
                        this.debug(`checking pairing mode`)
                        this.autoReconnect = false;
                        return this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.STATUS]));
                    }
                    return Promise.resolve();
                });
        }

        disconnect() {
            super.disconnect();
            if (this.flashPacketToken)
                this.flashPacketToken.cancel();
            if (this.pfCharacteristic && this.device.connected) {
                try {
                    this.pfCharacteristic.stopNotifications();
                    this.pfCharacteristic.removeEventListener('characteristicvaluechanged', this.handleCharacteristic);
                }
                catch (e) {
                    pxt.log(`ble: partial flash disconnect error ${e.message}`);
                }
            }
            this.pfCharacteristic = undefined;
        }

        protected createFlashPromise(): Promise<void> {
            return new Promise<void>((resolve, reject) => {
                    this._flashResolve = resolve;
                    this._flashReject = reject;
                    this.debug(`check service version`)
                    this.state = PartialFlashingState.StatusRequested;
                    return this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.STATUS]));
                }).then(() => { })
                .catch(e => {
                        pxt.log(`pf: error ${e.message}`)
                        this.clearFlashData();
                    });
        }

        private checkStateTransition(cmd: number, acceptedStates: PartialFlashingState) {
            if (!(this.state & acceptedStates)) {
                this.debug(`flash cmd ${cmd} in state ${this.state.toString(16)} `);
                this._flashReject(new Error());
                this.clearFlashData();
                return false;
            }
            return true;
        }

        private handleCharacteristic(ev: Event) {
            // check service is still alive
            if (this.aliveToken.isCancelled()) {
                if (this._flashReject)
                    this._flashReject(new Error());
                this.clearFlashData();
                return;
            }

            const dataView: DataView = (<any>event.target).value;
            const packet = new Uint8Array(dataView.buffer);
            const cmd = packet[0];
            //this.debug(`flash state ${this.state} - cmd ${cmd}`);
            if (this.state == PartialFlashingState.Idle) // rogue response
                return;
            switch (cmd) {
                case PartialFlashingService.STATUS:
                    if (!this.checkStateTransition(cmd, PartialFlashingState.StatusRequested | PartialFlashingState.PairingModeRequested))
                        return;
                    this.version = packet[1];
                    this.mode = packet[2];
                    this.debug(`flash service version ${this.version} mode ${this.mode}`)
                    this.debug(`reading DAL region`)
                    this.state = PartialFlashingState.RegionDALRequested;
                    this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.REGION_INFO, PartialFlashingService.REGION_DAL]))
                        .then(() => { })
                    break;
                case PartialFlashingService.REGION_INFO:
                    if (!this.checkStateTransition(cmd, PartialFlashingState.RegionDALRequested | PartialFlashingState.RegionMakeCodeRequested))
                        return;
                    const region = this.regions[packet[1]] = {
                        start: (packet[2] << 24) | (packet[3] << 16) | (packet[4] << 8) | packet[5],
                        end: (packet[6] << 24) | (packet[7] << 16) | (packet[8] << 8) | packet[9],
                        hash: pxt.Util.toHex(packet.slice(10))
                    };
                    this.debug(`read region ${packet[1]} start ${region.start.toString(16)} end ${region.end.toString(16)} hash ${region.hash}`)
                    if (packet[1] == PartialFlashingService.REGION_DAL) {
                        if (region.hash != this.dalHash) {
                            pxt.tickEvent("webble.flash.DALrequired");
                            this.debug(`DAL hash does not match, DFU flashing required`)
                            this.state = PartialFlashingState.USBFlashRequired;
                            // stop here and the DFU service will handle things
                            if (this._flashResolve)
                                this._flashResolve();
                            this.clearFlashData();
                            return;
                        }
                        this.debug(`DAL hash match, reading makecode region`)
                        this.state = PartialFlashingState.RegionMakeCodeRequested;
                        this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.REGION_INFO, PartialFlashingService.REGION_MAKECODE]))
                            .then(() => { });
                    } else if (packet[1] == PartialFlashingService.REGION_MAKECODE) {
                        if (region.start != this.magicOffset) {
                            this.debug(`magic offset and MakeCode region.start not matching`);
                            U.userError(lf("Invalid file"));
                        }
                        if (region.hash == this.makeCodeHash) {
                            pxt.tickEvent("webble.flash.noop");
                            this.debug(`MakeCode hash matches, same code!`)

                            // always restart even to match USB drag and drop behavior
                            this.debug(`restart application mode`)
                            this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.RESET, PartialFlashingService.MODE_APPLICATION]))
                                .then(() => {
                                    this.state = PartialFlashingState.Idle;
                                    if (this._flashResolve)
                                        this._flashResolve();
                                    this.clearFlashData();
                                })
                        } else {
                            // must be in pairing mode
                            if (this.mode != PartialFlashingService.MODE_PAIRING) {
                                this.debug(`application mode, reset into pairing mode`)
                                this.state = PartialFlashingState.PairingModeRequested;
                                this.autoReconnect = true;
                                this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.RESET, PartialFlashingService.MODE_PAIRING]))
                                    .then(() => { });
                                return;
                            }

                            // ready to flash the data in 4 chunks
                            this.flashOffset = region.start;
                            this.flashPacketNumber = 0;
                            this.debug(`starting to flash from address ${this.flashOffset.toString(16)}`);
                            this.flashNextPacket();
                        }
                    }
                    break;
                case PartialFlashingService.FLASH_DATA:
                    if (!this.checkStateTransition(cmd, PartialFlashingState.Flash))
                        return;
                    switch (packet[1]) {
                        case PartialFlashingService.PACKET_OUT_OF_ORDER:
                            this.debug(`packet out of order`);
                            this.flashPacketToken.cancel(); // cancel pending writes
                            this.flashPacketNumber += 4;
                            this.chunkDelay = Math.min(this.chunkDelay + 10,
                                PartialFlashingService.CHUNK_MAX_DELAY);
                            this.flashNextPacket();
                            break;
                        case PartialFlashingService.PACKET_WRITTEN:
                            this.chunkDelay = Math.max(this.chunkDelay - 1,
                                PartialFlashingService.CHUNK_MIN_DELAY);
                            // move cursor
                            this.flashOffset += 64;
                            this.flashPacketNumber += 4;
                            if (this.flashOffset >= this.bin.length) {
                                this.debug('end transmission')
                                this.state = PartialFlashingState.EndOfTransmision;
                                this.pfCharacteristic.writeValue(new Uint8Array([PartialFlashingService.END_OF_TRANSMISSION]))
                                    .finally(() => {
                                        // we are done!
                                        if (this._flashResolve)
                                            this._flashResolve();
                                        this.clearFlashData();
                                    })
                            } else { // keep flashing
                                this.flashNextPacket();
                            }
                            break;
                    }
                    break;
                default:
                    this.debug(`unknown message ${pxt.Util.toHex(packet)}`);
                    this.disconnect();
                    break;
            }
        }

        // send 64bytes in 4 BLE packets
        private flashNextPacket() {
            this.state = PartialFlashingState.Flash;

            this.flashPacketToken = new pxt.Util.CancellationToken()
            this.flashPacketToken.startOperation();

            const hex = this.bin.slice(this.flashOffset, this.flashOffset + 64);
            this.debug(`flashing ${this.flashOffset.toString(16)} / ${this.bin.length.toString(16)} ${((this.flashOffset - this.magicOffset) / (this.bin.length - this.magicOffset) * 100) >> 0}%`);

            // add delays or chrome crashes
            let chunk = new Uint8Array(20);
            Promise.delay(this.chunkDelay)
                .then(() => {
                    this.flashPacketToken.throwIfCancelled();
                    chunk[0] = PartialFlashingService.FLASH_DATA;
                    chunk[1] = (this.flashOffset >> 8) & 0xff;
                    chunk[2] = (this.flashOffset >> 0) & 0xff;
                    chunk[3] = this.flashPacketNumber; // packet number
                    for (let i = 0; i < 16; i++)
                        chunk[4 + i] = hex[i];
                    //this.debug(`chunk 0 ${Util.toHex(chunk)}`)
                    return this.pfCharacteristic.writeValue(chunk);
                }).delay(this.chunkDelay).then(() => {
                    this.flashPacketToken.throwIfCancelled();
                    chunk[0] = PartialFlashingService.FLASH_DATA;
                    chunk[1] = (this.flashOffset >> 24) & 0xff;
                    chunk[2] = (this.flashOffset >> 16) & 0xff;
                    chunk[3] = this.flashPacketNumber + 1; // packet number
                    for (let i = 0; i < 16; i++)
                        chunk[4 + i] = hex[16 + i] || 0;
                    //this.debug(`chunk 1 ${Util.toHex(chunk)}`)
                    return this.pfCharacteristic.writeValue(chunk);
                }).delay(this.chunkDelay).then(() => {
                    this.flashPacketToken.throwIfCancelled();
                    chunk[0] = PartialFlashingService.FLASH_DATA;
                    chunk[1] = 0;
                    chunk[2] = 0;
                    chunk[3] = this.flashPacketNumber + 2; // packet number
                    for (let i = 0; i < 16; i++)
                        chunk[4 + i] = hex[32 + i] || 0;
                    //this.debug(`chunk 2 ${Util.toHex(chunk)}`)
                    return this.pfCharacteristic.writeValue(chunk);
                }).delay(this.chunkDelay).then(() => {
                    this.flashPacketToken.throwIfCancelled();
                    chunk[0] = PartialFlashingService.FLASH_DATA;
                    chunk[1] = 0;
                    chunk[2] = 0;
                    chunk[3] = this.flashPacketNumber + 3; // packet number
                    for (let i = 0; i < 16; i++)
                        chunk[4 + i] = hex[48 + i] || 0;
                    //this.debug(`chunk 3 ${Util.toHex(chunk)}`)
                    return this.pfCharacteristic.writeValue(chunk);
                }).then(() => {
                    // give 500ms (A LOT) to process packet or consider the protocol stuck
                    // and send a bogus package to trigger an out of order situations
                    const currentFlashOffset = this.flashOffset;
                    const transferDaemonAsync: () => Promise<void> = () => {
                        return Promise.delay(500)
                            .then(() => {
                                // are we stuck?
                                if (currentFlashOffset != this.flashOffset // transfer ok
                                    || this.flashPacketToken.isCancelled() // transfer cancelled
                                    || this.aliveToken.isCancelled() // service is closed
                                    || this.state != PartialFlashingState.Flash // flash state changed
                                ) return Promise.resolve();
                                // we are definitely stuck
                                this.debug(`packet transfer deadlock, force restart`)
                                chunk[0] = PartialFlashingService.FLASH_DATA;
                                chunk[1] = 0;
                                chunk[2] = 0;
                                chunk[3] = ~0; // bobus packet number
                                for (let i = 0; i < 16; i++)
                                    chunk[4 + i] = 0;
                                return this.pfCharacteristic.writeValue(chunk)
                                    .then(() => transferDaemonAsync())
                            });
                    };
                    transferDaemonAsync()
                        .catch(e => {
                            // something went clearly wrong
                            if (this._flashReject)
                                this._flashReject(new Error("failed packet transfer"))
                            this.clearFlashData();
                        })
                }).catch(() => {
                    this.flashPacketToken.resolveCancel();
                })
        }
    }

    export class BLEDevice extends BLERemote {
        device: BluetoothDevice = undefined;
        _uartService: UARTService; // may be undefined
        _hf2Service: HF2Service; // may be undefined
        _partialFlashingService: PartialFlashingService; // may be undefined
        _dfuService: DFUService; // may be undefined

        private services: BLEService[] = [];
        private pendingResumeLogOnDisconnection = false;
        public servicesVersion = 0;

        constructor(device: BluetoothDevice) {
            super("ble", new pxt.Util.CancellationToken());
            this.device = device;
            this.handleDisconnected = this.handleDisconnected.bind(this);
            this.handleServiceAdded = this.handleServiceAdded.bind(this);
            this.handleServiceChanged = this.handleServiceChanged.bind(this);
            this.handleServiceRemoved = this.handleServiceRemoved.bind(this);

            this.device.addEventListener('gattserverdisconnected', this.handleDisconnected);
            this.device.addEventListener('serviceadded', this.handleServiceAdded);
            this.device.addEventListener('servicechanged', this.handleServiceChanged);
            this.device.addEventListener('serviceremoved', this.handleServiceRemoved);

            if (hasConsole()) {
                this.services.push(this._uartService = new UARTService(this));
                this.services.push(this._hf2Service = new HF2Service(this));
            }
            if (hasPartialFlash()) {
                this.services.push(this._dfuService = new DFUService(this));
                this.services.push(this._partialFlashingService = new PartialFlashingService(this));
            }
            this.aliveToken.startOperation();
        }

        startServices() {
            this.services.filter(service => service.autoReconnect)
                .forEach(service => service.connectAsync().catch(() => { }));
        }

        pauseLog() {
            if (this._uartService) {
                this._uartService.autoReconnect = false;
                this._uartService.disconnect();
            }
            if (this._hf2Service) {
                this._hf2Service.autoReconnect = false;
                this._hf2Service.disconnect();
            }
        }

        resumeLogOnDisconnection() {
            this.pendingResumeLogOnDisconnection = true;
        }

        private resumeLog() {
            if (this._uartService) {
                this._uartService.autoReconnect = true;
                this._uartService.connectAsync().catch(() => { })
            }
            if (this._hf2Service) {
                this._hf2Service.autoReconnect = true;
                this._hf2Service.connectAsync().catch(() => { })
            }
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
            this.debug(`connecting gatt server`)
            return this.alivePromise<void>(this.device.gatt.connect()
                .then(() => this.debug(`gatt server connected`)));
        }

        handleServiceAdded(event: Event) {
            this.debug(`service added`);
            this.servicesVersion++;
        }

        handleServiceRemoved(event: Event) {
            this.debug(`service removed`);
            this.servicesVersion++;
        }

        handleServiceChanged(event: Event) {
            this.debug(`service changed`);
            this.servicesVersion++;
        }

        handleDisconnected(event: Event) {
            this.debug(`disconnected`)
            this.disconnect();
            if (this.pendingResumeLogOnDisconnection) {
                this.pendingResumeLogOnDisconnection = false;
                Promise.delay(500).then(() => this.resumeLog());
            }
        }

        disconnect() {
            super.disconnect();
            this.services.forEach(service => service.disconnect());
            if (!this.connected) return;
            this.debug(`disconnect`)
            try {
                if (this.device.gatt && this.device.gatt.connected)
                    this.device.gatt.disconnect();
            } catch (e) {
                this.debug(`gatt disconnect error ${e.message}`);
            }
        }
    }

    export let bleDevice: BLEDevice = undefined;
    function connectAsync(): Promise<void> {
        if (bleDevice) return Promise.resolve();

        pxt.log(`ble: requesting device`)
        const optionalServices = [];
        if (hasConsole()) {
            optionalServices.push(UARTService.SERVICE_UUID);
            optionalServices.push(HF2Service.SERVICE_UUID);
        }
        if (hasPartialFlash()) {
            optionalServices.push(DFUService.UUIDS.CONTROL.SERVICE);
            optionalServices.push(DFUService.UUIDS.DFU.SERVICE);
            optionalServices.push(PartialFlashingService.SERVICE_UUID)
        }
        return navigator.bluetooth.requestDevice({
            filters: pxt.appTarget.appTheme.bluetoothUartFilters,
            optionalServices
        }).then(device => {
            pxt.log(`ble: received device ${device.name}`)
            bleDevice = new BLEDevice(device);
            bleDevice.startServices(); // some services have rety logic even if the first GATT connect fails
            return bleDevice.connectAsync();
        });
    }

    export function isPaired(): boolean {
        return !!bleDevice;
    }

    export function pairAsync(): Promise<void> {
        if (bleDevice) {
            bleDevice.kill();
            bleDevice = undefined;
        }
        return connectAsync()
            .catch(e => {
                if (bleDevice && bleDevice.aliveToken)
                    bleDevice.aliveToken.resolveCancel();
                pxt.log(`ble: error ${e.message}`)
            })
    }

    export function flashAsync(resp: pxtc.CompileResult, d: pxt.commands.DeployOptions = {}): Promise<void> {
        pxt.tickEvent("webble.flash");
        const hex = resp.outfiles[ts.pxtc.BINARY_HEX];
        return connectAsync()
            .then(() => bleDevice._partialFlashingService.flashAsync(hex))
            .then(() => {
                if (bleDevice._partialFlashingService.state == PartialFlashingState.USBFlashRequired)
                    return bleDevice._dfuService.flashAsync(hex);
                return Promise.resolve();
            })
            .then(() => {
                pxt.tickEvent("webble.flash.success");
            })
            .catch(e => {
                pxt.tickEvent("webble.fail.fail", { "message": e.message });
                throw e;
            });
    }
}