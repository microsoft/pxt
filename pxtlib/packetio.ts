namespace pxt.packetio {
    export interface TalkArgs {
        cmd: number;
        data?: Uint8Array;
    }

    export interface PacketIOWrapper {
        readonly io: PacketIO;

        icon: string;
        familyID: number;

        onSerial: (buf: Uint8Array, isStderr: boolean) => void;

        reconnectAsync(): Promise<void>;
        disconnectAsync(): Promise<void>;
        // flash the device, does **not** reconnect
        reflashAsync(resp: pxtc.CompileResult): Promise<void>;
    }

    export interface PacketIO {
        sendPacketAsync(pkt: Uint8Array): Promise<void>;
        onDeviceConnectionChanged: (connect: boolean) => void;
        onConnectionChanged: () => void;
        onData: (v: Uint8Array) => void;
        onError: (e: Error) => void;
        onEvent: (v: Uint8Array) => void;
        error(msg: string): any;
        reconnectAsync(): Promise<void>;
        disconnectAsync(): Promise<void>;
        isConnecting(): boolean;
        isConnected(): boolean;
        isSwitchingToBootloader?: () => void;
        // release any native resource before being released
        disposeAsync(): Promise<void>;

        // these are implemneted by HID-bridge
        talksAsync?(cmds: TalkArgs[]): Promise<Uint8Array[]>;
        sendSerialAsync?(buf: Uint8Array, useStdErr: boolean): Promise<void>;

        onSerial?: (v: Uint8Array, isErr: boolean) => void;
    }

    export let mkPacketIOAsync: () => Promise<PacketIO>;
    export let mkPacketIOWrapper: (io: PacketIO) => PacketIOWrapper;

    let wrapper: PacketIOWrapper;
    let initPromise: Promise<PacketIOWrapper>;
    let onConnectionChangedHandler: () => void = () => { };
    let onSerialHandler: (buf: Uint8Array, isStderr: boolean) => void;

    /**
     * A DAP wrapper is active
     */
    export function isActive() {
        return !!wrapper;
    }

    /**
     * The DAP wrapper is active and the device is connected
     */
    export function isConnected() {
        return !!wrapper && wrapper.io.isConnected();
    }

    export function isConnecting() {
        return !!wrapper && wrapper.io.isConnecting();
    }

    export function icon() {
        return !!wrapper && (wrapper.icon || "usb");
    }

    let disconnectPromise: Promise<void>
    export function disconnectAsync(): Promise<void> {
        if (disconnectPromise)
            return disconnectPromise;
        let p = Promise.resolve();
        if (wrapper) {
            log('disconnect')
            const w = wrapper;
            p = p.then(() => w.disconnectAsync())
                .then(() => w.io.disposeAsync())
                .catch(e => {
                    // swallow execeptions
                    pxt.reportException(e);
                })
                .finally(() => {
                    initPromise = undefined; // dubious
                    wrapper = undefined;
                    disconnectPromise = undefined;
                });
            if (onConnectionChangedHandler)
                p = p.then(() => onConnectionChangedHandler());
            disconnectPromise = p;
        }
        return p;
    }

    export function configureEvents(
        onConnectionChanged: () => void,
        onSerial: (buf: Uint8Array, isStderr: boolean) => void
    ): void {
        onConnectionChangedHandler = onConnectionChanged;
        onSerialHandler = onSerial;
        if (wrapper) {
            wrapper.io.onConnectionChanged = onConnectionChangedHandler;
            wrapper.onSerial = onSerialHandler;
        }
    }

    function wrapperAsync(): Promise<PacketIOWrapper> {
        if (wrapper)
            return Promise.resolve(wrapper);

        if (!mkPacketIOAsync) {
            pxt.log(`packetio: not defined, skipping`)
            return Promise.resolve(undefined);
        }

        pxt.log(`packetio: new wrapper`)
        return mkPacketIOAsync()
            .then(io => {
                io.onConnectionChanged = onConnectionChangedHandler;
                wrapper = mkPacketIOWrapper(io);
                if (onSerialHandler)
                    wrapper.onSerial = onSerialHandler;
                return wrapper;
            })
    }

    export function initAsync(force = false): Promise<PacketIOWrapper> {
        pxt.log(`packetio: init ${force ? "(force)" : ""}`)
        if (!initPromise) {
            let p = Promise.resolve();
            if (force)
                p = p.then(() => disconnectAsync());
            initPromise = p.then(() => wrapperAsync())
                .finally(() => { initPromise = undefined })
        }
        return initPromise;
    }
}