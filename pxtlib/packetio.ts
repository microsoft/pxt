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
        isConnected(): boolean
        isConnecting(): boolean
        // flash the device, does **not** reconnect
        reflashAsync(resp: pxtc.CompileResult, progressCallback?: (percentageComplete: number) => void): Promise<void>;

        onCustomEvent: (type: string, payload: Uint8Array) => void;
        sendCustomEventAsync(type: string, payload: Uint8Array): Promise<void>;
        // returns a list of part ids that are not supported by the connected hardware. currently
        // only used by pxt-microbit to warn users about v2 blocks on v1 hardware
        unsupportedParts?(): string[];
        // the variant id for the currently connected device
        devVariant?: string;
    }

    export interface PacketIO {
        sendPacketAsync(pkt: Uint8Array): Promise<void>;
        recvPacketAsync?: (timeout?: number) => Promise<Uint8Array>;
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
    let onCustomEventHandler: (type: string, buf: Uint8Array) => void;

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
        return !!wrapper?.isConnected();
    }

    export function isConnecting() {
        return !!wrapper?.isConnecting();
    }

    export function icon() {
        return !!wrapper && (wrapper.icon || pxt.appTarget.appTheme.downloadDialogTheme?.deviceIcon || "usb");
    }

    export function unsupportedParts() {
        return wrapper?.unsupportedParts ? wrapper.unsupportedParts() : [];
    }

    export function deviceVariant() {
        return wrapper?.devVariant;
    }

    let disconnectPromise: Promise<void>
    export function disconnectAsync(): Promise<void> {
        if (disconnectPromise)
            return disconnectPromise;
        let p = Promise.resolve();
        if (wrapper) {
            debug('packetio: disconnect')
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
        onSerial: (buf: Uint8Array, isStderr: boolean) => void,
        onCustomEvent: (type: string, buf: Uint8Array) => void
    ): void {
        onConnectionChangedHandler = onConnectionChanged;
        onSerialHandler = onSerial;
        onCustomEventHandler = onCustomEvent;
        if (wrapper) {
            wrapper.io.onConnectionChanged = onConnectionChangedHandler;
            wrapper.onSerial = onSerialHandler;
            wrapper.onCustomEvent = onCustomEvent;
        }
    }

    export function sendCustomEventAsync(type: string, payload: Uint8Array) {
        if (wrapper)
            return wrapper.sendCustomEventAsync(type, payload)
        else
            return Promise.resolve()
    }

    function wrapperAsync(): Promise<PacketIOWrapper> {
        if (wrapper)
            return Promise.resolve(wrapper);

        if (!mkPacketIOAsync) {
            pxt.debug(`packetio: not defined, skipping`)
            return Promise.resolve(undefined);
        }

        pxt.debug(`packetio: new wrapper`)
        return mkPacketIOAsync()
            .then(io => {
                io.onConnectionChanged = onConnectionChangedHandler;
                wrapper = mkPacketIOWrapper(io);
                if (onSerialHandler)
                    wrapper.onSerial = onSerialHandler;
                if (onCustomEventHandler)
                    wrapper.onCustomEvent = onCustomEventHandler;
                // trigger ui update
                if (onConnectionChangedHandler)
                    onConnectionChangedHandler();
                return wrapper;
            })
    }

    export function initAsync(force = false): Promise<PacketIOWrapper> {
        pxt.debug(`packetio: init ${force ? "(force)" : ""}`)
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