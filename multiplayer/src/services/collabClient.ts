import { Socket } from "engine.io-client";
import { SmartBuffer } from "smart-buffer";
import * as authClient from "./authClient";
import {
    CollabInfo,
    ClientRole,
    Presence,
    SessionOverReason,
    CollabJoinResult,
    HTTP_OK,
    HTTP_SESSION_FULL,
    HTTP_INTERNAL_SERVER_ERROR,
    HTTP_IM_A_TEAPOT,
} from "../types";
import { notifyDisconnected, setPresenceAsync, playerJoinedAsync, playerLeftAsync } from "../epics";
import * as CollabEpics from "../epics/collab";
import { jsonReplacer, jsonReviver } from "../util";

const COLLAB_HOST_PROD = "https://mp.makecode.com";
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

class CollabClient {
    sock: Socket | undefined;
    screen: Buffer | undefined;
    clientRole: ClientRole | undefined;
    clientId: string | undefined;
    sessOverReason: SessionOverReason | undefined;
    receivedJoinMessageInTimeHandler: ((a: any) => void) | undefined;

    constructor() {}

    destroy() {
        try {
            this.sock?.close();
            this.sock = undefined;
        } catch (e) {}
    }

    private sendMessage(msg: Protocol.Message | Buffer) {
        if (msg instanceof Buffer) {
            this.sock?.send(msg, {}, (err: any) => {
                if (err) pxt.log("Error sending message. " + err.toString());
            });
        } else {
            const payload = JSON.stringify(msg, jsonReplacer);
            this.sock?.send(payload, {}, (err: any) => {
                if (err) pxt.log("Error sending message. " + err.toString());
            });
        }
    }

    private recvMessageAsync = async (payload: string | ArrayBuffer) => {
        if (payload instanceof ArrayBuffer) {
            //-------------------------------------------------
            // Handle binary message
            //--
            const reader = SmartBuffer.fromBuffer(Buffer.from(payload));
            const type = reader.readUInt16LE();
            switch (type) {
                case Protocol.Binary.MessageType.SetPlayerValue:
                    return await this.recvSetPlayerValueMessageAsync(reader);
                case Protocol.Binary.MessageType.DelPlayerValue:
                    return await this.recvDelPlayerValueMessageAsync(reader);
                case Protocol.Binary.MessageType.SetSessionValue:
                    return await this.recvSetSessionValueMessageAsync(reader);
                case Protocol.Binary.MessageType.DelSessionValue:
                    return await this.recvDelSessionValueMessageAsync(reader);
            }
        } else if (typeof payload === "string") {
            //-------------------------------------------------
            // Handle JSON message
            //--
            const msg = JSON.parse(payload, jsonReviver) as Protocol.Message;
            switch (msg.type) {
                case "joined":
                    return await this.recvJoinedMessageAsync(msg);
                case "presence":
                    return await this.recvPresenceMessageAsync(msg);
                case "player-joined":
                    return await this.recvPlayerJoinedMessageAsync(msg);
                case "player-left":
                    return await this.recvPlayerLeftMessageAsync(msg);
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
                    notifyDisconnected(this.sessOverReason);
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

    private async recvJoinedMessageAsync(msg: Protocol.JoinedMessage) {
        pxt.debug(`Server said we're joined as "${msg.role}" in slot "${msg.slot}"`);
        const { role, clientId, sessKv } = msg;

        this.clientRole = role;
        this.clientId = clientId;

        CollabEpics.connected(clientId);
        CollabEpics.recvSetSessionState(sessKv);
    }

    private async recvPresenceMessageAsync(msg: Protocol.PresenceMessage) {
        pxt.debug("Server sent presence");
        await setPresenceAsync(msg.presence);
        CollabEpics.recvPresence(msg.presence);
    }

    private async recvPlayerJoinedMessageAsync(msg: Protocol.PlayerJoinedMessage) {
        pxt.debug("Server sent player joined");
        if (this.clientRole === "host") {
            //await this.sendCurrentScreenAsync(); // Workaround for server sometimes not sending the current screen to new players. Needs debugging.
        }
        await playerJoinedAsync(msg.clientId);
        CollabEpics.recvPlayerJoined(msg.clientId);
    }

    private async recvPlayerLeftMessageAsync(msg: Protocol.PlayerLeftMessage) {
        pxt.debug("Server sent player joined");
        await playerLeftAsync(msg.clientId);
        CollabEpics.recvPlayerLeft(msg.clientId);
    }

    private async recvSetPlayerValueMessageAsync(reader: SmartBuffer) {
        //pxt.debug(`Recv set player value: ${msg.key} = ${msg.value}`);
        const { key, value, clientId } = Protocol.Binary.unpackSetPlayerValueMessage(reader);
        CollabEpics.recvSetPlayerValue(key, value, clientId);
    }

    private async recvDelPlayerValueMessageAsync(reader: SmartBuffer) {
        //pxt.debug(`Recv del player value: ${msg.key}`);
        const { key, clientId } = Protocol.Binary.unpackDelPlayerValueMessage(reader);
        CollabEpics.recvDelPlayerValue(key, clientId);
    }

    private async recvSetSessionValueMessageAsync(reader: SmartBuffer) {
        //pxt.debug(`Recv set session value: ${msg.key} = ${msg.value}`);
        const { key, value, clientId } = Protocol.Binary.unpackSetSessionValueMessage(reader);
        CollabEpics.recvSetSessionValue(key, value, clientId);
    }

    private async recvDelSessionValueMessageAsync(reader: SmartBuffer) {
        //pxt.debug(`Recv del session value: ${msg.key}`);
        const { key, clientId } = Protocol.Binary.unpackDelSessionValueMessage(reader);
        CollabEpics.recvDelSessionValue(key, clientId);
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

    public setPlayerValue(key: string, value: string) {
        const buff = Protocol.Binary.packSetPlayerValueMessage(key, value);
        this.sendMessage(buff);
    }

    public delPlayerValue(key: string) {
        const buff = Protocol.Binary.packDelPlayerValueMessage(key);
        this.sendMessage(buff);
    }

    public setSessionValue(key: string, value: string) {
        const buff = Protocol.Binary.packSetSessionValueMessage(key, value);
        this.sendMessage(buff);
    }

    public delSessionValue(key: string) {
        const buff = Protocol.Binary.packDelSessionValueMessage(key);
        this.sendMessage(buff);
    }
}

let _collabClient: CollabClient | undefined;

function ensureCollabClient(): CollabClient {
    if (!_collabClient) {
        _collabClient = new CollabClient();
    }
    return _collabClient;
}

function destroyCollabClient() {
    _collabClient?.destroy();
    _collabClient = undefined;
}

export async function hostCollabAsync(): Promise<CollabJoinResult> {
    destroyCollabClient();
    const collabClient = ensureCollabClient();
    const collabInfo = await collabClient.hostCollabAsync();
    return collabInfo;
}

export async function joinCollabAsync(joinCode: string): Promise<CollabJoinResult> {
    destroyCollabClient();
    const collabClient = ensureCollabClient();
    const collabInfo = await collabClient.joinCollabAsync(joinCode);
    return collabInfo;
}

export async function leaveCollabAsync(reason: SessionOverReason) {
    const collabClient = ensureCollabClient();
    await collabClient?.leaveCollabAsync(reason);
    destroyCollabClient();
}

export function kickPlayer(clientId: string) {
    const collabClient = ensureCollabClient();
    collabClient?.kickPlayer(clientId);
}

export function collabOver(reason: SessionOverReason) {
    const collabClient = ensureCollabClient();
    collabClient?.collabOver(reason);
}

export function setPlayerValue(key: string, value: string) {
    const collabClient = ensureCollabClient();
    collabClient?.setPlayerValue(key, value);
}

export function delPlayerValue(key: string) {
    const collabClient = ensureCollabClient();
    collabClient?.delPlayerValue(key);
}

export function setSessionValue(key: string, value: string) {
    const collabClient = ensureCollabClient();
    collabClient?.setSessionValue(key, value);
}

export function delSessionValue(key: string) {
    const collabClient = ensureCollabClient();
    collabClient?.delSessionValue(key);
}

export function getClientId() {
    return _collabClient?.clientId;
}

export function destroy() {
    destroyCollabClient();
}

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

    export type PresenceMessage = MessageBase & {
        type: "presence";
        presence: Presence;
    };

    export type JoinedMessage = MessageBase & {
        type: "joined";
        role: ClientRole;
        slot: number;
        clientId: string;
        sessKv: Map<string, string>;
    };

    export type PlayerJoinedMessage = MessageBase & {
        type: "player-joined";
        clientId: string;
    };

    export type PlayerLeftMessage = MessageBase & {
        type: "player-left";
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

    export type Message =
        | ConnectMessage
        | PresenceMessage
        | JoinedMessage
        | PlayerJoinedMessage
        | PlayerLeftMessage
        | KickPlayerMessage
        | CollabOverMessage;

    export namespace Binary {
        export enum MessageType {
            SetPlayerValue = 16,
            DelPlayerValue = 17,
            SetSessionValue = 18,
            DelSessionValue = 19,
        }

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
    }
}
