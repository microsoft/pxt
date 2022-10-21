import { Socket } from "engine.io-client";
import { SmartBuffer } from "smart-buffer";
import * as authClient from "./authClient";
import {
    ButtonState,
    buttonStateToString,
    GameInfo,
    SimMultiplayer,
    ClientRole,
    GameMode,
    Presence,
    stringToButtonState,
} from "../types";
import {
    gameDisconnected,
    setGameModeAsync,
    setPresenceAsync,
    setReactionAsync,
    playerJoinedAsync,
    playerLeftAsync,
    setGameMetadataAsync,
} from "../epics";

const GAME_HOST = "https://multiplayer.staging.pxt.io";
//const GAME_HOST = "http://localhost:8082";

class GameClient {
    sock: Socket | undefined;
    heartbeatTimer: NodeJS.Timeout | undefined;

    constructor() {
        this.recvMessageWithJoinTimeout =
            this.recvMessageWithJoinTimeout.bind(this);
        this.recvMessageAsync = this.recvMessageAsync.bind(this);
    }

    destroy() {
        try {
            this.sock?.close();
            this.sock = undefined;
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            this.heartbeatTimer && clearInterval(this.heartbeatTimer);
        } catch (e) {}
    }

    /*internal*/ sendMessage(msg: Protocol.Message | Buffer) {
        if (msg instanceof Buffer) {
            this.sock?.send(msg, {}, (err: any) => {
                if (err) console.log("Error sending message", err);
            });
        } else {
            const payload = JSON.stringify(msg);
            this.sock?.send(payload, {}, (err: any) => {
                if (err) console.log("Error sending message", err);
            });
        }
    }

    private async recvMessageAsync(payload: string | ArrayBuffer) {
        try {
            if (payload instanceof ArrayBuffer) {
                //-------------------------------------------------
                // Handle binary message
                //--
                const reader = SmartBuffer.fromBuffer(Buffer.from(payload));
                const type = reader.readUInt16LE();
                switch (type) {
                    case Protocol.Binary.MessageType.Screen:
                        return await this.recvScreenMessageAsync(reader);
                    case Protocol.Binary.MessageType.Input:
                        return await this.recvInputMessageAsync(reader);
                }
            } else if (typeof payload === "string") {
                //-------------------------------------------------
                // Handle JSON message
                //--
                const msg = JSON.parse(payload) as Protocol.Message;
                switch (msg.type) {
                    case "joined":
                        return await this.recvJoinedMessageAsync(msg);
                    case "start-game":
                        return await this.recvStartGameMessageAsync(msg);
                    case "presence":
                        return await this.recvPresenceMessageAsync(msg);
                    case "reaction":
                        return await this.recvReactionMessageAsync(msg);
                    case "player-joined":
                        return await this.recvPlayerJoinedMessageAsync(msg);
                    case "player-left":
                        return await this.recvPlayerLeftMessageAsync(msg);
                }
            } else {
                console.error("Unknown payload type", payload);
            }
        } catch (e) {
            console.error("Error processing message", e);
        }
    }

    private async recvMessageWithJoinTimeout(
        payload: string | Buffer,
        timeout: NodeJS.Timeout,
        resolve: () => void
    ) {
        try {
            if (typeof payload === "string") {
                const msg = JSON.parse(payload) as Protocol.Message;
                await this.recvMessageAsync(payload);
                if (msg.type === "joined") {
                    this.sock?.removeAllListeners("message");
                    this.sock?.on(
                        "message",
                        async payload => await this.recvMessageAsync(payload)
                    );
                    clearTimeout(timeout);
                    resolve();
                }
            }
        } catch (e) {
            console.error("Error processing message", e);
        }
        await this.recvMessageAsync(payload);
    }

    public async connectAsync(ticket: string) {
        return new Promise<void>((resolve, reject) => {
            const connectTimeout = setTimeout(() => {
                reject("Timed out connecting to game server");
                destroyGameClient();
            }, 20 * 1000);
            this.sock = new Socket(GAME_HOST, {
                transports: ["websocket"], // polling is unsupported
                path: "/mp",
            });
            this.sock.binaryType = "arraybuffer";
            this.sock.on("open", () => {
                console.log("socket opened");
                this.sock?.on(
                    "message",
                    async payload =>
                        await this.recvMessageWithJoinTimeout(
                            payload,
                            connectTimeout,
                            resolve
                        )
                );
                this.sock?.on("close", () => {
                    console.log("socket disconnected");
                    clearTimeout(this.heartbeatTimer);
                    gameDisconnected();
                });

                this.sock?.on("error", err => {
                    console.log("socket error", err);
                });

                setTimeout(() => {
                    this.sendMessage({
                        type: "connect",
                        ticket,
                        version: Protocol.VERSION,
                    } as Protocol.ConnectMessage);
                }, 500); // TODO: Why is this necessary? The socket doesn't seem ready to send messages immediately. This isn't a shippable solution.
            });
        });
    }

    public async hostGameAsync(shareCode: string): Promise<GameInfo> {
        shareCode = shareCode.trim();
        shareCode = encodeURIComponent(shareCode);

        const authToken = await authClient.authTokenAsync();

        // TODO: Send real credentials
        const res = await fetch(`${GAME_HOST}/api/game/host/${shareCode}`, {
            credentials: "include",
            headers: {
                Authorization: "mkcd " + authToken,
            },
        });
        const gameInfo = (await res.json()) as GameInfo;

        if (!gameInfo?.joinTicket)
            throw new Error("Game server did not return a join ticket");

        await this.connectAsync(gameInfo.joinTicket!);

        return gameInfo;
    }

    public async joinGameAsync(joinCode: string): Promise<GameInfo> {
        joinCode = joinCode.toUpperCase().trim();
        joinCode = encodeURIComponent(joinCode);

        const authToken = await authClient.authTokenAsync();

        const joinRes = await fetch(`${GAME_HOST}/api/game/join/${joinCode}`, {
            credentials: "include",
            headers: {
                Authorization: "mkcd " + authToken,
            },
        });

        const gameInfo = (await joinRes.json()) as GameInfo;

        if (!gameInfo?.joinTicket)
            throw new Error("Game server did not return a join ticket");

        await this.connectAsync(gameInfo.joinTicket!);

        return gameInfo;
    }

    public async startGameAsync() {
        this.sendMessage({
            type: "start-game",
        } as Protocol.StartGameMessage);
    }

    public async leaveGameAsync() {
        this.sock?.close();
    }

    public async sendReactionAsync(index: number) {
        this.sendMessage({
            type: "reaction",
            index,
        } as Protocol.ReactionMessage);
    }

    private async recvJoinedMessageAsync(msg: Protocol.JoinedMessage) {
        console.log(
            `Server said we're joined as "${msg.role}" in slot "${msg.slot}"`
        );
        const { gameMode, shareCode } = msg;

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (await setGameMetadataAsync(shareCode)) && (await setGameModeAsync(gameMode, msg.slot));
    }

    private async recvStartGameMessageAsync(msg: Protocol.StartGameMessage) {
        console.log("Server said start game");
        await setGameModeAsync("playing");
    }

    private async recvPresenceMessageAsync(msg: Protocol.PresenceMessage) {
        console.log("Server sent presence");
        await setPresenceAsync(msg.presence);
    }

    private async recvReactionMessageAsync(msg: Protocol.ReactionMessage) {
        console.log("Server sent reaction");
        await setReactionAsync(msg.clientId!, msg.index);
    }

    private async recvPlayerJoinedMessageAsync(
        msg: Protocol.PlayerJoinedMessage
    ) {
        console.log("Server sent player joined");
        await playerJoinedAsync(msg.clientId);
    }

    private async recvPlayerLeftMessageAsync(msg: Protocol.PlayerLeftMessage) {
        console.log("Server sent player joined");
        await playerLeftAsync(msg.clientId);
    }

    private async recvScreenMessageAsync(reader: SmartBuffer) {
        const { img } = Protocol.Binary.unpackScreenMessage(reader);

        this.postToSimFrame(<SimMultiplayer.ImageMessage>{
            type: "multiplayer",
            content: "Image",
            image: {
                data: img,
            },
        });
    }

    private async recvInputMessageAsync(reader: SmartBuffer) {
        const { button, state, slot } =
            Protocol.Binary.unpackInputMessage(reader);

        this.postToSimFrame(<SimMultiplayer.InputMessage>{
            type: "multiplayer",
            content: "Button",
            clientNumber: slot - 1,
            button: button,
            state: buttonStateToString(state),
        });
    }

    private postToSimFrame(msg: SimMultiplayer.Message) {
        pxt.runner.postSimMessage(msg);
    }
}

let gameClient: GameClient | undefined;

function destroyGameClient() {
    gameClient?.destroy();
    gameClient = undefined;
}

export async function hostGameAsync(shareCode: string): Promise<GameInfo> {
    destroyGameClient();
    gameClient = new GameClient();
    const gameInfo = await gameClient.hostGameAsync(shareCode);
    return gameInfo;
}

export async function joinGameAsync(joinCode: string): Promise<GameInfo> {
    destroyGameClient();
    gameClient = new GameClient();
    const gameInfo = await gameClient.joinGameAsync(joinCode);
    return gameInfo;
}

export async function startGameAsync() {
    await gameClient?.startGameAsync();
}

export async function leaveGameAsync() {
    await gameClient?.leaveGameAsync();
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    gameClient && gameClient.destroy();
    gameClient = undefined;
}

export async function sendReactionAsync(index: number) {
    await gameClient?.sendReactionAsync(index);
}

export async function sendInputAsync(
    button: number,
    state: "Pressed" | "Released" | "Held"
) {
    const buffer = Protocol.Binary.packInputMessage(
        button,
        stringToButtonState(state)!
    );
    gameClient?.sendMessage(buffer);
}

export async function sendScreenUpdateAsync(img: Uint8Array) {
    const buffer = Protocol.Binary.packScreenMessage(Buffer.from(img));
    gameClient?.sendMessage(buffer);
}

export function destroy() {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    gameClient && gameClient.destroy();
    gameClient = undefined;
}

//=============================================================================
// Network Messages
// Hiding these here for now to ensure they're not used outside of this module.
namespace Protocol {
    export const VERSION = 2;

    type MessageBase = {
        type: string;
    };

    export type ConnectMessage = MessageBase & {
        type: "connect";
        ticket: string;
        version: number; // Procotol version
    };

    export type StartGameMessage = MessageBase & {
        type: "start-game";
    };

    export type InputMessage = MessageBase & {
        type: "input";
        slot: number;
        data: {
            button: number;
            state: "Pressed" | "Released" | "Held";
        };
    };

    export type ScreenMessage = MessageBase & {
        type: "screen";
        data: {
            img: Uint8Array; // pxsim.RefBuffer
        };
    };

    export type ReactionMessage = MessageBase & {
        type: "reaction";
        index: number;
        clientId?: string;
    };

    export type PresenceMessage = MessageBase & {
        type: "presence";
        presence: Presence;
    };

    export type JoinedMessage = MessageBase & {
        type: "joined";
        role: ClientRole;
        slot: number;
        gameMode: GameMode;
        shareCode: string;
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

    export type Message =
        | ConnectMessage
        | StartGameMessage
        | InputMessage
        | ScreenMessage
        | ReactionMessage
        | PresenceMessage
        | JoinedMessage
        | PlayerJoinedMessage
        | PlayerLeftMessage;

    export type SimMessage = ScreenMessage | InputMessage;

    export namespace Binary {
        export enum MessageType {
            Input = 1,
            Screen = 2,
        }

        // Input
        export function packInputMessage(
            button: number,
            state: ButtonState
        ): Buffer {
            const writer = new SmartBuffer();
            writer.writeUInt16LE(MessageType.Input);
            writer.writeUInt16LE(button);
            writer.writeUInt8(state);
            return writer.toBuffer();
        }
        export function unpackInputMessage(reader: SmartBuffer): {
            button: number;
            state: ButtonState;
            slot: number;
        } {
            // `type` field has already been read
            const button = reader.readUInt16LE();
            const state = reader.readUInt8();
            const slot = reader.readUInt8();
            return {
                button,
                state,
                slot,
            };
        }

        // Screen
        export function packScreenMessage(img: Buffer): Buffer {
            const writer = new SmartBuffer();
            writer.writeUInt16LE(MessageType.Screen);
            writer.writeBuffer(img);
            return writer.toBuffer();
        }
        export function unpackScreenMessage(reader: SmartBuffer): {
            img: Buffer;
        } {
            // `type` field has already been read
            const img = reader.readBuffer();
            return {
                img,
            };
        }
    }
}
