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
import {
    notifyDisconnected,
    setPresenceAsync,
    playerJoinedAsync,
    playerLeftAsync,
} from "../epics";
import * as CollabEpics from "../epics/collab";

const COLLAB_HOST_PROD = "https://mp.makecode.com";
const COLLAB_HOST_STAGING = "https://multiplayer.staging.pxt.io";
const COLLAB_HOST_LOCALHOST = "http://localhost:8082";
const COLLAB_HOST_DEV = COLLAB_HOST_LOCALHOST;
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
    xp: number;
    yp: number;
    name: string;
};

class CollabClient {
    sock: Socket | undefined;
    screen: Buffer | undefined;
    clientRole: ClientRole | undefined;
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
            const payload = JSON.stringify(msg);
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
            }
        } else if (typeof payload === "string") {
            //-------------------------------------------------
            // Handle JSON message
            //--
            const msg = JSON.parse(payload) as Protocol.Message;
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

    private recvMessageWithJoinTimeout = async (
        payload: string | Buffer,
        resolve: () => void
    ) => {
        try {
            if (typeof payload === "string") {
                const msg = JSON.parse(payload) as Protocol.Message;
                if (msg.type === "joined") {
                    // We've joined the collab. Replace this handler with a direct call to recvMessageAsync
                    if (this.sock) {
                        this.sock.removeListener(
                            "message",
                            this.receivedJoinMessageInTimeHandler
                        );
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

            if (!collabInfo?.joinTicket)
                throw new Error("Collab server did not return a join ticket");

            CollabEpics.initState();

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

            const joinRes = await fetch(
                `${COLLAB_HOST}/api/collab/join/${joinCode}`,
                {
                    credentials: "include",
                    headers: {
                        Authorization: "mkcd " + authToken,
                    },
                }
            );

            if (joinRes.status !== HTTP_OK) {
                return {
                    success: false,
                    statusCode: joinRes.status,
                };
            }

            const collabInfo = (await joinRes.json()) as CollabInfo;

            if (!collabInfo?.joinTicket)
                throw new Error("Collab server did not return a join ticket");

            CollabEpics.initState();

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
        pxt.debug(
            `Server said we're joined as "${msg.role}" in slot "${msg.slot}"`
        );
        const { role } = msg;

        this.clientRole = role;

        // TODO: Set initial state
    }

    private async recvPresenceMessageAsync(msg: Protocol.PresenceMessage) {
        pxt.debug("Server sent presence");
        await setPresenceAsync(msg.presence);
    }

    private async recvPlayerJoinedMessageAsync(
        msg: Protocol.PlayerJoinedMessage
    ) {
        pxt.debug("Server sent player joined");
        if (this.clientRole === "host") {
            //await this.sendCurrentScreenAsync(); // Workaround for server sometimes not sending the current screen to new players. Needs debugging.
        }
        await playerJoinedAsync(msg.clientId);
    }

    private async recvPlayerLeftMessageAsync(msg: Protocol.PlayerLeftMessage) {
        pxt.debug("Server sent player joined");
        await playerLeftAsync(msg.clientId);
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
}

let collabClient: CollabClient | undefined;

function destroyCollabClient() {
    collabClient?.destroy();
    collabClient = undefined;
}

export async function hostCollabAsync(): Promise<CollabJoinResult> {
    destroyCollabClient();
    collabClient = new CollabClient();
    const collabInfo = await collabClient.hostCollabAsync();
    return collabInfo;
}

export async function joinCollabAsync(
    joinCode: string
): Promise<CollabJoinResult> {
    destroyCollabClient();
    collabClient = new CollabClient();
    const collabInfo = await collabClient.joinCollabAsync(joinCode);
    return collabInfo;
}

export async function leaveCollabAsync(reason: SessionOverReason) {
    await collabClient?.leaveCollabAsync(reason);
    destroyCollabClient();
}

export function kickPlayer(clientId: string) {
    collabClient?.kickPlayer(clientId);
}

export function collabOver(reason: SessionOverReason) {
    collabClient?.collabOver(reason);
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
}
