import { Socket } from "engine.io-client";
import { SmartBuffer } from "smart-buffer";
import EventEmitter from "eventemitter3";
import * as leoFilter from "leo-profanity";
import { Filter as BadWordsFilter } from "bad-words";
import * as authClient from "./authClient";
import {
    CollabInfo,
    ClientRole,
    SessionOverReason,
    CollabJoinResult,
    HTTP_OK,
    HTTP_SESSION_FULL,
    HTTP_INTERNAL_SERVER_ERROR,
    HTTP_IM_A_TEAPOT,
    ViewPlayer,
    KvMutationOp,
    ValueType,
    ChatMessage,
    ChatMessagePayload
} from "@/types";
import { jsonReplacer, jsonReviver } from "@/utils";

const badWordsFilter = new BadWordsFilter();

const COLLAB_HOST_PROD = "https://plato.makecode.com";
const COLLAB_HOST_STAGING = "https://dev.multiplayer.staging.pxt.io";
const COLLAB_HOST_LOCALHOST = "http://localhost:8082";
const COLLAB_HOST_DEV = COLLAB_HOST_STAGING;
const COLLAB_HOST = (() => {
    if (pxt.BrowserUtils.isLocalHostDev()) {
        return COLLAB_HOST_DEV;
    } else if (window.location.hostname === "arcade.makecode.com") {
        return COLLAB_HOST_PROD;
    } else {
        return COLLAB_HOST_STAGING;
    }
})();

export type CollabPlayer = {
    clientId: string;
    kv: Map<string, string>;
};

type EmitterEvents = {
    "service-created": () => void;
    "service-destroyed": () => void;
    joined: (role: ClientRole, clientId: string) => void;
    kv: (op: KvMutationOp, path: string[], val?: ValueType) => void;
    signal: (signal: string, fromClientId: string, payload?: ValueType) => void;
    disconnected: (reason?: SessionOverReason) => void;
};

const emitter = new EventEmitter<EmitterEvents>();

class CollabClient {
    sock: Socket | undefined;
    screen: Buffer | undefined;
    clientRole: ClientRole | undefined;
    clientId: string | undefined;
    sessOverReason: SessionOverReason | undefined;
    receivedJoinMessageInTimeHandler: ((a: any) => void) | undefined;

    constructor() { }

    destroy() {
        try {
            this.sock?.close();
            this.sock = undefined;
        } catch (e) { }
    }

    private sendMessage(msg: Protocol.Message | Buffer) {
        try {
            if (msg instanceof Buffer) {
                this.sock?.send(msg);
            } else {
                const payload = JSON.stringify(msg, jsonReplacer);
                this.sock?.send(payload);
            }
        } catch (e) {
            pxt.error("Error sending message", e);
        }
    }

    private recvMessageAsync = async (payload: string | ArrayBuffer) => {
        if (payload instanceof ArrayBuffer) {
            //-------------------------------------------------
            // Handle binary message
            //--
            const reader = SmartBuffer.fromBuffer(Buffer.from(payload));
            const type = reader.readUInt16LE();
            switch (
            type
            /*
            case Protocol.Binary.MessageType.SetPlayerValue:
                return await this.recvSetPlayerValueMessageAsync(reader);
            case Protocol.Binary.MessageType.DelPlayerValue:
                return await this.recvDelPlayerValueMessageAsync(reader);
            case Protocol.Binary.MessageType.SetSessionValue:
                return await this.recvSetSessionValueMessageAsync(reader);
            case Protocol.Binary.MessageType.DelSessionValue:
                return await this.recvDelSessionValueMessageAsync(reader);
            */
            ) {
            }
        } else if (typeof payload === "string") {
            //-------------------------------------------------
            // Handle JSON message
            //--
            const msg = JSON.parse(payload, jsonReviver) as Protocol.Message;
            switch (msg.type) {
                case "joined":
                    return await this.recvJoinedMessageAsync(msg);
                case "kv":
                    return await this.recvKVStoreMessageAsync(msg);
                case "signal":
                    return await this.recvSignalMessageAsync(msg);
            }
        } else {
            throw new Error(`Unknown payload: ${payload}`);
        }
    };

    private recvMessageWithJoinTimeout = async (payload: string | Buffer, resolve: () => void) => {
        try {
            if (typeof payload === "string") {
                const msg = JSON.parse(payload) as Protocol.Message;
                if (msg.type === "joined") {
                    // We've joined the collab. Replace this handler with a direct call to recvMessageAsync
                    if (this.sock) {
                        this.sock.removeListener("message", this.receivedJoinMessageInTimeHandler);
                        this.receivedJoinMessageInTimeHandler = undefined;
                    }
                    resolve();
                }
            }
        } catch (e) {
            console.error("Error processing message", e);
            destroyCollabClient();
            resolve();
        }
    };

    public async connectAsync(ticket: string) {
        return new Promise<void>((resolve, reject) => {
            const joinTimeout = setTimeout(() => {
                reject("Timed out connecting to collab server");
                destroyCollabClient();
            }, 20 * 1000);
            this.sock = new Socket(COLLAB_HOST, {
                transports: ["websocket"], // polling is unsupported
                path: "/mp",
            });
            this.sock.binaryType = "arraybuffer";
            this.sock.on("open", () => {
                pxt.debug("socket opened");
                this.receivedJoinMessageInTimeHandler = async payload => {
                    await this.recvMessageWithJoinTimeout(payload, () => {
                        clearTimeout(joinTimeout);
                        resolve();
                    });
                };
                this.sock?.on("message", this.receivedJoinMessageInTimeHandler);
                this.sock?.on("message", async payload => {
                    try {
                        await this.recvMessageAsync(payload);
                    } catch (e) {
                        console.error("Error processing message", e);
                        destroyCollabClient();
                    }
                });
                this.sock?.on("close", () => {
                    pxt.debug("socket disconnected");
                    emitter.emit("disconnected", this.sessOverReason);
                    clearTimeout(joinTimeout);
                    resolve();
                });

                this.sendMessage({
                    type: "connect",
                    ticket,
                    version: Protocol.VERSION,
                } as Protocol.ConnectMessage);
            });
        });
    }

    public async hostCollabAsync(): Promise<CollabJoinResult> {
        try {
            const authToken = await authClient.authTokenAsync();

            const hostRes = await fetch(`${COLLAB_HOST}/api/collab/host`, {
                credentials: "include",
                headers: {
                    Authorization: "mkcd " + authToken,
                },
                method: "POST",
            });

            if (hostRes.status !== HTTP_OK) {
                return {
                    success: false,
                    statusCode: hostRes.status,
                };
            }

            const collabInfo = (await hostRes.json()) as CollabInfo;

            if (!collabInfo?.joinTicket) throw new Error("Collab server did not return a join ticket");

            await this.connectAsync(collabInfo.joinTicket!);

            return {
                ...collabInfo,
                success: true,
                statusCode: hostRes.status,
            };
        } catch (e) {
            return {
                success: false,
                statusCode: HTTP_INTERNAL_SERVER_ERROR,
            };
        }
    }

    public async joinCollabAsync(joinCode: string): Promise<CollabJoinResult> {
        try {
            joinCode = encodeURIComponent(joinCode);

            const authToken = await authClient.authTokenAsync();

            const joinRes = await fetch(`${COLLAB_HOST}/api/collab/join/${joinCode}`, {
                credentials: "include",
                headers: {
                    Authorization: "mkcd " + authToken,
                },
                method: "POST",
            });

            if (joinRes.status !== HTTP_OK) {
                return {
                    success: false,
                    statusCode: joinRes.status,
                };
            }

            const collabInfo = (await joinRes.json()) as CollabInfo;

            if (!collabInfo?.joinTicket) throw new Error("Collab server did not return a join ticket");

            await this.connectAsync(collabInfo.joinTicket!);

            return {
                ...collabInfo,
                success: !this.sessOverReason,
                statusCode: this.sessOverReason
                    ? this.sessOverReason === "full"
                        ? HTTP_SESSION_FULL
                        : HTTP_IM_A_TEAPOT
                    : joinRes.status,
            };
        } catch (e) {
            return {
                success: false,
                statusCode: HTTP_INTERNAL_SERVER_ERROR,
            };
        }
    }

    public async leaveCollabAsync(reason: SessionOverReason) {
        this.sessOverReason = reason;
        this.sock?.close();
    }

    public kickPlayer(clientId: string) {
        const msg: Protocol.KickPlayerMessage = {
            type: "kick-player",
            clientId,
        };
        this.sendMessage(msg);
    }

    public collabOver(reason: SessionOverReason) {
        this.sessOverReason = reason;
        destroyCollabClient();
    }

    public setKey(key: string, val: ValueType) {
        const msg: Protocol.KVStoreMessage = {
            type: "kv",
            op: "set",
            key,
            val,
        };
        this.sendMessage(msg);
    }

    public delKey(key: string) {
        const msg: Protocol.KVStoreMessage = {
            type: "kv",
            op: "del",
            key,
        };
        this.sendMessage(msg);
    }

    public kvOp(op: KvMutationOp, key: string, val?: string) {
        const msg: Protocol.KVStoreMessage = {
            type: "kv",
            op,
            key,
            val,
        };
        this.sendMessage(msg);
    }

    public sendSignal(signal: string, hostOnly: boolean, payload?: ValueType) {
        const msg: Protocol.SignalMessage = {
            type: "signal",
            signal,
            hostOnly,
            payload,
        };
        this.sendMessage(msg);
    }

    //==========================================================
    // Message Handlers

    private async recvJoinedMessageAsync(msg: Protocol.JoinedMessage) {
        pxt.debug(`Server said we're joined as "${msg.role}"`);
        const { role, clientId } = msg;

        this.clientRole = role;
        this.clientId = clientId;

        emitter.emit("joined", role, clientId);
    }

    private async recvKVStoreMessageAsync(msg: Protocol.KVStoreMessage) {
        pxt.debug(`Server sent KV store message: ${msg.op} (${msg.key})`);
        const { op, key, val } = msg;

        pxt.log(`KV ${op}: ${key} = ${JSON.stringify(val ?? "", jsonReplacer)}`);

        if (!key.startsWith("/")) return;

        const path = key.split("/");
        path.shift();

        emitter.emit("kv", op, path, val);
    }

    private async recvSignalMessageAsync(msg: Protocol.SignalMessage) {
        pxt.debug(`Server sent signal message: ${msg.signal}`);
        const { signal, fromClientId, payload } = msg;

        emitter.emit("signal", signal, fromClientId!, payload);
    }
}

let _collabClient: CollabClient | undefined;

function getCollabClient(alloc: boolean = true): CollabClient | undefined {
    if (!_collabClient && alloc) {
        _collabClient = new CollabClient();
        emitter.emit("service-created");
    }
    return _collabClient;
}

function destroyCollabClient() {
    _collabClient?.destroy();
    _collabClient = undefined;
    emitter.emit("service-destroyed");
}

export async function hostCollabAsync(): Promise<CollabJoinResult> {
    destroyCollabClient();
    const collabClient = getCollabClient()!;
    const collabInfo = await collabClient.hostCollabAsync();
    return collabInfo;
}

export async function joinCollabAsync(joinCode: string): Promise<CollabJoinResult> {
    destroyCollabClient();
    const collabClient = getCollabClient()!;
    const collabInfo = await collabClient.joinCollabAsync(joinCode);
    return collabInfo;
}

export async function leaveCollabAsync(reason: SessionOverReason) {
    const collabClient = getCollabClient(false);
    await collabClient?.leaveCollabAsync(reason);
    destroyCollabClient();
}

export function kickPlayer(clientId: string) {
    const collabClient = getCollabClient(false);
    collabClient?.kickPlayer(clientId);
}

export function collabOver(reason: SessionOverReason) {
    const collabClient = getCollabClient(false);
    collabClient?.collabOver(reason);
}

export function getClientId() {
    const collabClient = getCollabClient(false);
    return collabClient?.clientId;
}

export function destroy() {
    destroyCollabClient();
}

export function setClientValue(clientId: string, key: string, val: ValueType) {
    const collabClient = getCollabClient(false);
    collabClient?.setKey(`/clients/${clientId}/${key}`, val);
}

export function delClientValue(clientId: string, key: string) {
    const collabClient = getCollabClient(false);
    collabClient?.delKey(`/clients/${clientId}/${key}`);
}

export function loadGame(shareCode: string) {
    const collabClient = getCollabClient(false);
    collabClient?.setKey("/sess/shareCode", shareCode);
}

export function setSessionValue(key: string, val: ValueType) {
    const collabClient = getCollabClient(false);
    collabClient?.setKey(`/sess/${key}`, val);
}

export function sendChatMessage(payload: ChatMessagePayload) {
    const collabClient = getCollabClient(false);
    if (payload.type === "text") {
        payload.text = badWordsFilter.clean(leoFilter.clean(payload.text));
    }
    collabClient?.sendSignal("chat", true, JSON.stringify(payload));
}

export function sendRestartGameSignal() {
    const collabClient = getCollabClient(false);
    collabClient?.sendSignal("restart-game", false);
}

export function on(ev: "service-created" | "service-destroyed", callback: () => void): () => void;
export function on(ev: "joined", callback: (role: ClientRole, clientId: string) => void): () => void;
export function on(ev: "kv", callback: (op: KvMutationOp, path: string[], val?: ValueType) => void): () => void;
export function on(ev: "signal", callback: (signal: string, fromClientId: string, payload?: ValueType) => void): () => void;
export function on(ev: "disconnected", callback: (reason?: SessionOverReason) => void): () => void;
export function on(ev: keyof EmitterEvents, callback: (...args: any[]) => void): () => void {
    emitter.on(ev, callback);
    return () => {
        emitter.off(ev, callback);
    };
}

export function off(ev: keyof EmitterEvents, callback: (...args: any[]) => void): void {
    emitter.off(ev, callback);
}

//=============================================================================
// SessionStore

type SessionEvents = {
    notify: () => void;
    "player-joined-session": (clientId: string) => void;
    "player-left-session": (clientId: string) => void;
};

type SessionState = {
    sessionId: string;
    joinCode: string;
    hostId: string;
    seed: number;
    clientIds: Set<string>;
    realNames: boolean;
    chatEnabled: boolean;
    shareCode?: string;
    chatMessages: Map<number, ChatMessage>;
};

const initialSessionState = (): SessionState => ({
    sessionId: "",
    joinCode: "",
    hostId: "",
    seed: 0,
    clientIds: new Set(),
    realNames: false,
    chatEnabled: false,
    chatMessages: new Map(),
});

class SessionStore {
    private listeners: EventEmitter<SessionEvents> = new EventEmitter();
    private state: SessionState = initialSessionState();
    private _snapshot = this.snapshot();

    private _init() {
        this.state = initialSessionState();
        this.snapshot();
    }

    constructor() {
        emitter.on("service-created", () => {
            this._init();
            this.listeners.emit("notify");
        });
        emitter.on("service-destroyed", () => {
            this._init();
            this.listeners.emit("notify");
        });
        emitter.on("kv", (op, path, val) => {
            if (path[0] !== "sess") return;
            switch (op) {
                case "set":
                    this.setKey(path, val!);
                    break;
                case "del":
                    this.delKey(path);
                    break;
            }
        });
    }

    private setKey(path: string[], val: ValueType) {
        if (path.length < 2) return;
        let changed = false;
        path.shift(); // remove "sess"
        const key = path.shift();
        if (!key) return;
        switch (key) {
            case "sessionId": {
                this.state.sessionId = val as string;
                changed = true;
                break;
            }
            case "joinCode": {
                this.state.joinCode = val as string;
                changed = true;
                break;
            }
            case "hostId": {
                this.state.hostId = val as string;
                changed = true;
                break;
            }
            case "seed": {
                this.state.seed = val as number;
                changed = true;
                break;
            }
            case "clientIds": {
                // compute added and removed clientIds
                const clientIds = new Set<string>(val as string[]);
                const added = new Set<string>();
                const removed = new Set<string>();
                for (const id of clientIds) {
                    if (!this.state.clientIds.has(id)) {
                        added.add(id);
                    }
                }
                for (const id of this.state.clientIds) {
                    if (!clientIds.has(id)) {
                        removed.add(id);
                    }
                }
                // update clientIds
                this.state.clientIds = clientIds;
                this.snapshot();
                // emit events for added and removed clientIds
                for (const id of added) {
                    this.listeners.emit("player-joined-session", id);
                }
                for (const id of removed) {
                    this.listeners.emit("player-left-session", id);
                }
                changed = true;
                break;
            }
            case "realNames": {
                this.state.realNames = val as boolean;
                changed = true;
                break;
            }
            case "chatEnabled": {
                this.state.chatEnabled = val as boolean;
                changed = true;
                break;
            }
            case "shareCode": {
                this.state.shareCode = val as string;
                changed = true;
                break;
            }
            case "chat": {
                const chatId_s = path.shift();
                if (!chatId_s) return;
                const chatId = Number(chatId_s);
                const chatMessage = JSON.parse(val as string) as ChatMessage;
                if (chatId !== chatMessage?.id) return;
                this.state.chatMessages.set(chatId, chatMessage);
                this.state.chatMessages = new Map(this.state.chatMessages);
                changed = true;
                break;
            }
        }
        if (changed) {
            this.notify();
        }
    }

    private delKey(path: string[]) {
        if (path.length < 2) return;
        let changed = false;
        path.shift(); // remove "sess"
        const key = path.shift();
        switch (key) {
            case "shareCode":
                this.state.shareCode = undefined;
                changed = true;
                break;
            default:
                pxt.warn(`[del] Unknown session key: ${key}`);
        }
        if (changed) {
            this.notify();
        }
    }

    private snapshot(): SessionState {
        this._snapshot = { ...this.state };
        return this._snapshot;
    }

    private notify() {
        this.snapshot();
        this.listeners.emit("notify");
    }

    public on(ev: "player-joined-session", callback: (clientId: string) => void): () => void;
    public on(ev: "player-left-session", callback: (clientId: string) => void): () => void;
    public on(ev: keyof SessionEvents, callback: (...args: any[]) => void): () => void {
        this.listeners.on(ev, callback);
        return () => {
            this.listeners.off(ev, callback);
        };
    }

    // React's useSyncExternalStore
    public subscribe = (callback: () => void): (() => void) => {
        this.listeners.on("notify", callback);
        return () => this.listeners.off("notify", callback);
    };
    public getSnapshot = (): SessionState => {
        return this._snapshot;
    };
}

export const sessionStore = new SessionStore();

//=============================================================================
// PlayerPresenceStore

type PlayerPresenceEvents = {
    notify: () => void;
    "recv-player-joined-game": (clientId: string, currentGame: string) => void;
    "recv-player-left-game": (clientId: string) => void;
};

class PlayerPresenceStore {
    private listeners: EventEmitter<PlayerPresenceEvents> = new EventEmitter();
    private _players: Map<string, ViewPlayer> = new Map();
    private _cachedSnapshot: ViewPlayer[] = [];
    private _clientId?: string;
    constructor() {
        emitter.on("service-created", () => {
            this._players = new Map();
            this._clientId = undefined;
            this.snapshot();

            this.listeners.emit("notify");
        });
        emitter.on("service-destroyed", () => {
            this._players = new Map();
            this._clientId = undefined;
            this.snapshot();

            this.listeners.emit("notify");
        });
        emitter.on("joined", async (role: ClientRole, clientId: string) => {
            let changed = false;
            this._clientId = clientId;
            const me = this._players.get(clientId);
            if (me) {
                me.isMe = true;
                changed = true;
            }
            if (changed) {
                this.notify();
            }
        });
        emitter.on("kv", (op, path, val) => {
            if (path[0] !== "clients") return;
            switch (op) {
                case "set":
                    this.setKey(path, val!);
                    break;
                case "del":
                    this.delKey(path);
                    break;
            }
        });
    }

    private setKey(path: string[], val: ValueType) {
        let changed = false;
        const clientId = path[1];
        const player =
            this._players.get(clientId) ??
            ({
                id: clientId,
                isMe: clientId === this._clientId,
            } satisfies ViewPlayer);
        this._players.set(clientId, player);
        const key = path[2];
        if (key) {
            switch (key) {
                case "role":
                    player.role = val as ClientRole;
                    changed = true;
                    break;
                case "name":
                    player.name = val as string;
                    changed = true;
                    break;
                case "realName":
                    player.realName = val as string;
                    changed = true;
                    break;
                case "currentGame":
                    player.currentGame = val as string;
                    changed = true;
                    this.snapshot();
                    this.listeners.emit("recv-player-joined-game", player.id, player.currentGame);
                    break;
                default:
                    pxt.warn(`[set] Unknown player key: ${key}`);
            }
        }

        if (changed) {
            this.notify();
        }
    }

    private delKey(path: string[]) {
        const clientId = path[1];
        if (path.length < 3) {
            this._players.delete(clientId);
            this.snapshot();
            this.listeners.emit("recv-player-left-game", clientId);
            this.notify();
        } else {
            const player = this._players.get(clientId);
            if (player) {
                let changed = false;
                const key = path[2];
                switch (key) {
                    case "currentGame":
                        player.currentGame = undefined;
                        changed = true;
                        this.snapshot();
                        this.listeners.emit("recv-player-left-game", player.id);
                        break;
                    default:
                        pxt.warn(`[del] Unknown player key: ${key}`);
                }
                if (changed) {
                    this.notify();
                }
            }
        }
    }

    private snapshot(): ViewPlayer[] {
        this._cachedSnapshot = Array.from(this._players.values());
        return this._cachedSnapshot;
    }

    private notify() {
        this.snapshot();
        this.listeners.emit("notify");
    }

    public on(ev: "recv-player-joined-game", callback: (clientId: string, currentGame: string) => void): () => void;
    public on(ev: "recv-player-left-game", callback: (clientId: string) => void): () => void;
    public on(ev: keyof PlayerPresenceEvents, callback: (...args: any[]) => void): () => void {
        this.listeners.on(ev, callback);
        return () => {
            this.listeners.off(ev, callback);
        };
    }

    // React's useSyncExternalStore
    public subscribe = (callback: () => void): (() => void) => {
        this.listeners.on("notify", callback);
        return () => this.listeners.off("notify", callback);
    };
    public getSnapshot = (): ViewPlayer[] => {
        return this._cachedSnapshot;
    };
}

export const playerPresenceStore = new PlayerPresenceStore();

//=============================================================================
// Network Messages
// Hiding these here for now to ensure they're not used outside of this module.
namespace Protocol {
    // Procotol version. Updating this should be a rare occurance. We commit to
    // backward compatibility, but in the case where we must make a breaking
    // change, we can bump this version and let the server know which version
    // we're compabible with.
    export const VERSION = 2;

    type MessageBase = {
        type: string;
    };

    export type ConnectMessage = MessageBase & {
        type: "connect";
        ticket: string;
        version: number;
    };

    export type JoinedMessage = MessageBase & {
        type: "joined";
        role: ClientRole;
        clientId: string;
    };

    export type KickPlayerMessage = MessageBase & {
        type: "kick-player";
        clientId: string;
    };

    export type CollabOverMessage = MessageBase & {
        type: "collab-over";
        reason: SessionOverReason;
    };

    export type KVStoreMessage = {
        type: "kv";
        op: KvMutationOp;
        key: string;
        val?: ValueType;
    };

    export type SignalMessage = MessageBase & {
        type: "signal";
        signal: string;
        fromClientId?: string; // set when receiving
        hostOnly?: boolean; // set when sending
        payload?: ValueType;
    };

    export type Message =
        | ConnectMessage
        | JoinedMessage
        | KickPlayerMessage
        | CollabOverMessage
        | KVStoreMessage
        | SignalMessage;

    export namespace Binary {
        export enum MessageType { }

        /*
        // Collab:SetPlayerValue
        export function packSetPlayerValueMessage(key: string, value: string): Buffer {
            const writer = new SmartBuffer();
            writer.writeUInt16LE(MessageType.SetPlayerValue);
            writer.writeStringNT(key);
            writer.writeStringNT(value);
            return writer.toBuffer();
        }
        export function unpackSetPlayerValueMessage(reader: SmartBuffer): {
            key: string;
            value: string;
            clientId: string;
        } {
            // `type` field has already been read
            const key = reader.readStringNT();
            const value = reader.readStringNT();
            const clientId = reader.readStringNT();
            return {
                key,
                value,
                clientId,
            };
        }

        // Collab:DelPlayerValue
        export function packDelPlayerValueMessage(key: string): Buffer {
            const writer = new SmartBuffer();
            writer.writeUInt16LE(MessageType.DelPlayerValue);
            writer.writeStringNT(key);
            return writer.toBuffer();
        }
        export function unpackDelPlayerValueMessage(reader: SmartBuffer): {
            key: string;
            clientId: string;
        } {
            // `type` field has already been read
            const key = reader.readStringNT();
            const clientId = reader.readStringNT();
            return {
                key,
                clientId,
            };
        }

        // Collab:SetSessionValue
        export function packSetSessionValueMessage(key: string, value: string): Buffer {
            const writer = new SmartBuffer();
            writer.writeUInt16LE(MessageType.SetSessionValue);
            writer.writeStringNT(key);
            writer.writeStringNT(value);
            return writer.toBuffer();
        }
        export function unpackSetSessionValueMessage(reader: SmartBuffer): {
            key: string;
            value: string;
            clientId: string;
        } {
            // `type` field has already been read
            const key = reader.readStringNT();
            const value = reader.readStringNT();
            const clientId = reader.readStringNT();
            return {
                key,
                value,
                clientId,
            };
        }

        // Collab:DelSessionValue
        export function packDelSessionValueMessage(key: string): Buffer {
            const writer = new SmartBuffer();
            writer.writeUInt16LE(MessageType.DelSessionValue);
            writer.writeStringNT(key);
            return writer.toBuffer();
        }
        export function unpackDelSessionValueMessage(reader: SmartBuffer): {
            key: string;
            clientId: string;
        } {
            // `type` field has already been read
            const key = reader.readStringNT();
            const clientId = reader.readStringNT();
            return {
                key,
                clientId,
            };
        }
        */
    }
}
