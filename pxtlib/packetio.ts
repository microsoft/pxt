namespace pxt.packetio {
    export interface TalkArgs {
        cmd: number;
        data?: Uint8Array;
    }

    export interface PacketIOWrapper {
        readonly io: PacketIO;

        familyID: number;

        onConnectionChanged: () => void;
        onSerial: (buf: Uint8Array, isStderr: boolean) => void;

        reconnectAsync(first?: boolean): Promise<void>;
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

    let hf2Wrapper: PacketIOWrapper;
    let initPromise: Promise<PacketIOWrapper>;
    let onConnectionChangedHandler: () => void = () => { };
    let onSerialHandler: (buf: Uint8Array, isStderr: boolean) => void;

    export function isConnected() {
        return hf2Wrapper && hf2Wrapper.io.isConnected();
    }

    export function configureEvents(
        onConnectionChanged: () => void,
        onSerial: (buf: Uint8Array, isStderr: boolean) => void
    ): void {
        onConnectionChangedHandler = onConnectionChanged;
        onSerialHandler = onSerial;
        if (hf2Wrapper) {
            hf2Wrapper.onConnectionChanged = onConnectionChangedHandler;
            hf2Wrapper.onSerial = onSerialHandler;
        }
    }

    export function disconnectWrapperAsync(): Promise<void> {
        if (hf2Wrapper)
            return hf2Wrapper.disconnectAsync();
        return Promise.resolve();
    }

    export function initAsync(force = false) {
        if (!initPromise) {
            initPromise = hf2Async()
                .catch(err => {
                    initPromise = null
                    return Promise.reject(err)
                })
        }

        let wrapper: PacketIOWrapper;
        return initPromise
            .then((w) => {
                wrapper = w;
                if (force) {
                    return wrapper.reconnectAsync();
                }
                return Promise.resolve();
            })
            .then(() => wrapper);


        function hf2Async() {
            return mkPacketIOAsync()
                .then(io => {
                    hf2Wrapper = mkPacketIOWrapper(io);
                    if (onConnectionChangedHandler)
                        hf2Wrapper.onConnectionChanged = onConnectionChangedHandler;
                    if (onSerialHandler)
                        hf2Wrapper.onSerial = onSerialHandler;
                    return hf2Wrapper.reconnectAsync(true)
                        .then(() => hf2Wrapper)
                })
        }
    }
}