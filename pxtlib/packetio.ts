namespace pxt.packetio {
    export interface TalkArgs {
        cmd: number;
        data?: Uint8Array;
    }

    export interface PacketIOWrapper {
        readonly io: PacketIO;

        familyID: number;

        onSerial: (buf: Uint8Array, isStderr: boolean) => void;

        reconnectAsync(): Promise<void>;
        disconnectAsync(): Promise<void>;
        reflashAsync(resp: pxtc.CompileResult): Promise<void>;
    }

    export interface PacketIO {
        sendPacketAsync(pkt: Uint8Array): Promise<void>;
        onConnectionChanged: () => void;
        onData: (v: Uint8Array) => void;
        onError: (e: Error) => void;
        onEvent: (v: Uint8Array) => void;
        error(msg: string): any;
        reconnectAsync(): Promise<void>;
        disconnectAsync(): Promise<void>;
        isConnected(): boolean;
        isSwitchingToBootloader?: () => void;

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

    export function isConnected() {
        return wrapper && wrapper.io.isConnected();
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

    export function disconnectWrapperAsync(): Promise<void> {
        pxt.log(`packetio: disconnect`)
        if (wrapper)
            return wrapper.disconnectAsync();
        return Promise.resolve();
    }

    function wrapperAsync() {
        if (wrapper)
            return Promise.resolve(wrapper);

        pxt.log(`packetio: new wrapper`)
        return mkPacketIOAsync()
            .then(io => {
                io.onConnectionChanged = onConnectionChangedHandler;
                wrapper = mkPacketIOWrapper(io);
                if (onSerialHandler)
                    wrapper.onSerial = onSerialHandler;
                return wrapper.reconnectAsync()
                    .then(() => wrapper)
                    .catch(e => {
                        pxt.reportException(e);
                        wrapper = undefined
                    })
            })
    }

    export function initAsync(force = false) {
        pxt.log(`packetio: init ${force ? "(force)" : ""}`)
        if (!initPromise) {
            let p = Promise.resolve();
            if (force)
                p = p.then(() => disconnectWrapperAsync());
            initPromise = p.then(() => {
                wrapper = undefined;
                return wrapperAsync();
            }).finally(() => { initPromise = undefined })
        }
        return initPromise;
    }
}