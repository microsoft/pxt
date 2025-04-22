import { Socket } from "engine.io-client";
import { SmartBuffer } from "smart-buffer";
import * as authClient from "./authClient";
import { xorInPlace, gzipAsync, gunzipAsync } from "../util";
import {
    audioInstructionToString,
    ButtonState,
    buttonStateToString,
    GameInfo,
    SimMultiplayer,
    ClientRole,
    GameMode,
    Presence,
    stringToAudioInstruction,
    stringToButtonState,
    GameOverReason,
    GameJoinResult,
    HTTP_OK,
    HTTP_SESSION_FULL,
    HTTP_INTERNAL_SERVER_ERROR,
    HTTP_IM_A_TEAPOT,
    SimKey,
    IconMessage,
    IconType,
} from "../types";
import {
    notifyDisconnected,
    setGameModeAsync,
    setPresenceAsync,
    setReactionAsync,
    playerJoinedAsync,
    playerLeftAsync,
    setGameMetadataAsync,
    gameOverAsync,
    pauseGameAsync as epic_pauseGameAsync,
    resumeGameAsync as epic_resumeGameAsync,
    setCustomIconAsync,
} from "../epics";
import { simDriver } from "./simHost";

const GAME_HOST_PROD = "https://mp.makecode.com";
const GAME_HOST_STAGING = "https://multiplayer.staging.pxt.io";
const GAME_HOST_LOCALHOST = "http://localhost:8082";
const GAME_HOST_DEV = GAME_HOST_STAGING;
const GAME_HOST = (() => {
    if (pxt.BrowserUtils.isLocalHostDev()) {
        return GAME_HOST_DEV;
    } else if (window.location.hostname === "arcade.makecode.com") {
        return GAME_HOST_PROD;
    } else {
        return GAME_HOST_STAGING;
    }
})();

const SCREEN_BUFFER_SIZE = 9608;
const PALETTE_BUFFER_SIZE = 48;

class GameClient {
    sock: Socket | undefined;
    screen: Buffer | undefined;
    clientRole: ClientRole | undefined;
    gameOverReason: GameOverReason | undefined;
    receivedJoinMessageInTimeHandler: ((a: any) => void) | undefined;
    paused: boolean = false;

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
                const payload = JSON.stringify(msg);
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
            switch (type) {
                case Protocol.Binary.MessageType.CompressedScreen:
                    return await this.recvCompressedScreenMessageAsync(reader);
                case Protocol.Binary.MessageType.Input:
                    return await this.recvInputMessageAsync(reader);
                case Protocol.Binary.MessageType.Audio:
                    return await this.recvAudioMessageAsync(reader);
                case Protocol.Binary.MessageType.Icon:
                    return await this.recvIconMessageAsync(reader);
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
                case "game-over":
                    return await this.recvGameOverMessageAsync(msg);
                case "pause-game":
                    return await this.recvPauseGameMessageAsync(msg);
                case "resume-game":
                    return await this.recvResumeGameMessageAsync(msg);
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
                    // We've joined the game. Replace this handler with a direct call to recvMessageAsync
                    if (this.sock) {
                        this.sock.removeListener("message", this.receivedJoinMessageInTimeHandler);
                        this.receivedJoinMessageInTimeHandler = undefined;
                    }
                    resolve();
                }
            }
        } catch (e) {
            console.error("Error processing message", e);
            destroyGameClient();
            resolve();
        }
    };

    public async connectAsync(ticket: string) {
        return new Promise<void>((resolve, reject) => {
            const joinTimeout = setTimeout(() => {
                reject("Timed out connecting to game server");
                destroyGameClient();
            }, 20 * 1000);
            this.sock = new Socket(GAME_HOST, {
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
                        destroyGameClient();
                    }
                });
                this.sock?.on("close", () => {
                    pxt.debug("socket disconnected");
                    notifyDisconnected(this.gameOverReason);
                    clearTimeout(joinTimeout);
                    resolve();
                });

                this.sock?.on("error", err => {
                    if (err) pxt.log("Error sending message. " + err.toString());
                });

                this.sendMessage({
                    type: "connect",
                    ticket,
                    version: Protocol.VERSION,
                } as Protocol.ConnectMessage);
            });
        });
    }

    public async hostGameAsync(shareCode: string): Promise<GameJoinResult> {
        try {
            shareCode = encodeURIComponent(shareCode);

            const authToken = await authClient.authTokenAsync();

            const hostRes = await fetch(`${GAME_HOST}/api/game/host/${shareCode}`, {
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

            const gameInfo = (await hostRes.json()) as GameInfo;

            if (!gameInfo?.joinTicket) throw new Error("Game server did not return a join ticket");

            await this.connectAsync(gameInfo.joinTicket!);

            return {
                ...gameInfo,
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

    public async joinGameAsync(joinCode: string): Promise<GameJoinResult> {
        try {
            joinCode = encodeURIComponent(joinCode);

            const authToken = await authClient.authTokenAsync();

            const joinRes = await fetch(`${GAME_HOST}/api/game/join/${joinCode}`, {
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

            const gameInfo = (await joinRes.json()) as GameInfo;

            if (!gameInfo?.joinTicket) throw new Error("Game server did not return a join ticket");

            await this.connectAsync(gameInfo.joinTicket!);

            return {
                ...gameInfo,
                success: !this.gameOverReason,
                statusCode: this.gameOverReason
                    ? this.gameOverReason === "full"
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

    public async startGameAsync() {
        this.sendMessage({
            type: "start-game",
        } as Protocol.StartGameMessage);
    }

    public async leaveGameAsync(reason: GameOverReason) {
        this.gameOverReason = reason;
        this.sock?.close();
    }

    public async sendReactionAsync(index: number) {
        this.sendMessage({
            type: "reaction",
            index,
        } as Protocol.ReactionMessage);
    }

    private async recvJoinedMessageAsync(msg: Protocol.JoinedMessage) {
        pxt.debug(`Server said we're joined as "${msg.role}" in slot "${msg.slot}"`);
        const { gameMode, gamePaused, shareCode, role } = msg;

        this.clientRole = role;
        this.paused = gamePaused;

        if (await setGameMetadataAsync(shareCode)) {
            await setGameModeAsync(gameMode, gamePaused, msg.slot);
        }
    }

    private async recvStartGameMessageAsync(msg: Protocol.StartGameMessage) {
        pxt.debug("Server said start game");
        await setGameModeAsync("playing", this.paused);
    }

    private async recvPresenceMessageAsync(msg: Protocol.PresenceMessage) {
        pxt.debug("Server sent presence");
        await setPresenceAsync(msg.presence);
    }

    private async recvReactionMessageAsync(msg: Protocol.ReactionMessage) {
        pxt.debug("Server sent reaction");
        await setReactionAsync(msg.clientId!, msg.index);
    }

    private async recvPlayerJoinedMessageAsync(msg: Protocol.PlayerJoinedMessage) {
        pxt.debug("Server sent player joined");
        if (this.clientRole === "host") {
            await this.sendCurrentScreenAsync(); // Workaround for server sometimes not sending the current screen to new players. Needs debugging.
        }
        await playerJoinedAsync(msg.clientId);
    }

    private async recvPlayerLeftMessageAsync(msg: Protocol.PlayerLeftMessage) {
        pxt.debug("Server sent player joined");
        await playerLeftAsync(msg.clientId);
    }

    private async recvGameOverMessageAsync(msg: Protocol.GameOverMessage) {
        pxt.debug("Server sent game over");
        await gameOverAsync(msg.reason);
    }

    private async recvPauseGameMessageAsync(msg: Protocol.PauseGameMessage) {
        pxt.debug("Server sent pause game");
        this.paused = true;
        await epic_pauseGameAsync();
    }

    private async recvResumeGameMessageAsync(msg: Protocol.ResumeGameMessage) {
        pxt.debug("Server sent resume game");
        this.paused = false;
        await epic_resumeGameAsync();
    }

    private async recvCompressedScreenMessageAsync(reader: SmartBuffer) {
        const { zippedData, isDelta } = Protocol.Binary.unpackCompressedScreenMessage(reader);

        const screen = await gunzipAsync(zippedData);
        if (!isDelta) {
            // We must wait for the first non-delta screen to arrive before we can apply diffs.
            this.screen = screen;
            //pxt.debug("Received non-delta screen");
        } else if (this.screen) {
            // Apply delta to existing screen to get new screen
            xorInPlace(this.screen, screen);
        }

        const { image, palette } = this.getCurrentScreen();

        if (image) {
            this.postToSimFrame(<SimMultiplayer.ImageMessage>{
                type: "multiplayer",
                content: "Image",
                image: {
                    data: image,
                },
                palette,
            });
        }
    }

    private async recvInputMessageAsync(reader: SmartBuffer) {
        const { button, state, slot } = Protocol.Binary.unpackInputMessage(reader);

        const stringifiedState = buttonStateToString(state);
        if (button <= SimKey.None || button >= SimKey.Menu || slot < 2 || !stringifiedState) return;

        this.postToSimFrame(<SimMultiplayer.InputMessage>{
            type: "multiplayer",
            content: "Button",
            clientNumber: slot - 1,
            button: button,
            state: stringifiedState,
        });
    }

    private async recvAudioMessageAsync(reader: SmartBuffer) {
        const { instruction, soundbuf } = Protocol.Binary.unpackAudioMessage(reader);
        this.postToSimFrame(<SimMultiplayer.AudioMessage>{
            type: "multiplayer",
            content: "Audio",
            instruction: audioInstructionToString(instruction),
            soundbuf: soundbuf,
        });
    }

    private async recvIconMessageAsync(reader: SmartBuffer) {
        const { iconType, iconSlot, iconBuffer } = Protocol.Binary.unpackIconMessage(reader);

        if (iconType === IconType.Player && iconSlot >= 1 && iconSlot <= 4) {
        } else if (iconType === IconType.Reaction && iconSlot >= 1 && iconSlot <= 6) {
        } else {
            // unhandled icon type or invalid slot, ignore.
            return;
        }

        if (iconBuffer) {
            const unzipped = await gunzipAsync(iconBuffer);
            const iconPalette = unzipped.slice(0, PALETTE_BUFFER_SIZE);
            const iconImage = unzipped.slice(PALETTE_BUFFER_SIZE);
            const iconPngDataUri = pxt.convertUint8BufferToPngUri(iconPalette, iconImage);

            setCustomIconAsync(iconType, iconSlot, iconPngDataUri);
        } else {
            // clear this value from overrides list if set
            setCustomIconAsync(iconType, iconSlot);
        }
    }

    private postToSimFrame(msg: SimMultiplayer.Message) {
        simDriver()?.postMessage(msg);
    }

    public async sendInputAsync(button: number, state: "Pressed" | "Released" | "Held") {
        if (this.paused) return;
        const buffer = Protocol.Binary.packInputMessage(button, stringToButtonState(state)!);
        this.sendMessage(buffer);
    }

    public async sendAudioAsync(instruction: "playinstructions" | "muteallchannels", soundbuf?: Uint8Array) {
        if (this.paused) return;
        const buffer = Protocol.Binary.packAudioMessage(stringToAudioInstruction(instruction)!, Buffer.from(soundbuf!));
        this.sendMessage(buffer);
    }

    public async sendIconAsync(
        type: IconType,
        slot: number,
        palette: Uint8Array | undefined,
        img: Uint8Array | undefined
    ) {
        let zippedIconBuffer: Buffer | undefined;

        if (palette && img) {
            const iconDataBuf = Buffer.concat([palette, img]);
            zippedIconBuffer = await gzipAsync(iconDataBuf);
        }

        const msgBuffer = Protocol.Binary.packIconMessage(type, slot, zippedIconBuffer);

        this.sendMessage(msgBuffer);
    }

    public async sendScreenUpdateAsync(image: Uint8Array, palette: Uint8Array | undefined) {
        const DELTAS_ENABLED = true;

        const buffers: Buffer[] = [];
        buffers.push(Buffer.from(image));
        if (palette) buffers.push(Buffer.from(palette));

        const screen = Buffer.concat(buffers);
        const firstScreen = !this.screen;

        if (firstScreen) {
            // First screen, remember it as baseline
            this.screen = screen;
        } else {
            // XOR the new screen with the old screen to get the delta
            xorInPlace(screen, this.screen!);
            // Update the old screen to the new screen by applying the delta
            xorInPlace(this.screen!, screen);
        }

        if (DELTAS_ENABLED) {
            let empty = true;
            for (let i = 0; i < screen.length; i++) {
                if (screen[i] !== 0) {
                    empty = false;
                    break;
                }
            }

            if (!empty || firstScreen) {
                // Compress the delta and send it to the server
                const zippedData = await gzipAsync(screen);
                const buffer = Protocol.Binary.packCompressedScreenMessage(
                    zippedData,
                    !firstScreen // If first screen, send as non-delta
                );
                this.sendMessage(buffer);
            }
        } else {
            const zippedData = await gzipAsync(this.screen!);
            const buffer = Protocol.Binary.packCompressedScreenMessage(
                zippedData,
                false // Not a delta
            );
            this.sendMessage(buffer);
        }
    }

    public async sendCurrentScreenAsync() {
        if (this.screen) {
            const zippedData = await gzipAsync(this.screen);
            const buffer = Protocol.Binary.packCompressedScreenMessage(
                zippedData,
                false // not a delta
            );
            this.sendMessage(buffer);
        }
    }

    public kickPlayer(clientId: string) {
        const msg: Protocol.KickPlayerMessage = {
            type: "kick-player",
            clientId,
        };
        this.sendMessage(msg);
    }

    public gameOver(reason: GameOverReason) {
        this.gameOverReason = reason;
        destroyGameClient();
    }

    public getCurrentScreen(): {
        image: Uint8Array | undefined;
        palette: Uint8Array | undefined;
    } {
        if (!this.screen) return { image: undefined, palette: undefined };

        const image = this.screen.slice(0, SCREEN_BUFFER_SIZE);
        const palette =
            this.screen.length >= SCREEN_BUFFER_SIZE + PALETTE_BUFFER_SIZE
                ? this.screen.slice(SCREEN_BUFFER_SIZE, SCREEN_BUFFER_SIZE + PALETTE_BUFFER_SIZE).map(v => v)
                : undefined;

        return {
            image,
            palette,
        };
    }

    public async pauseGameAsync() {
        this.paused = true;
        const msg: Protocol.PauseGameMessage = {
            type: "pause-game",
        };
        this.sendMessage(msg);
    }

    public async resumeGameAsync() {
        this.paused = false;
        const msg: Protocol.ResumeGameMessage = {
            type: "resume-game",
        };
        this.sendMessage(msg);
    }
}

let gameClient: GameClient | undefined;

function destroyGameClient() {
    gameClient?.destroy();
    gameClient = undefined;
}

/** Test code for emulating fake users in a multiplayer session **/
export async function startPostingRandomKeys() {
    const states = ["Pressed", "Released"];
    const currentState = new Array(SimKey.B).fill(0);
    return setInterval(() => {
        const key = Math.floor(Math.random() * SimKey.B);
        gameClient?.sendInputAsync(key + 1, states[currentState[key]++ % 2] as any);
    }, 300);
}

export async function hostGameAsync(shareCode: string): Promise<GameJoinResult> {
    destroyGameClient();
    gameClient = new GameClient();
    const gameInfo = await gameClient.hostGameAsync(shareCode);
    return gameInfo;
}

export async function joinGameAsync(joinCode: string): Promise<GameJoinResult> {
    destroyGameClient();
    gameClient = new GameClient();
    const gameInfo = await gameClient.joinGameAsync(joinCode);
    return gameInfo;
}

export async function startGameAsync() {
    await gameClient?.startGameAsync();
}

export async function leaveGameAsync(reason: GameOverReason) {
    await gameClient?.leaveGameAsync(reason);
    destroyGameClient();
}

export async function sendReactionAsync(index: number) {
    await gameClient?.sendReactionAsync(index);
}

export async function sendInputAsync(button: number, state: "Pressed" | "Released" | "Held") {
    await gameClient?.sendInputAsync(button, state);
}

export async function sendAudioAsync(instruction: "playinstructions" | "muteallchannels", soundbuf?: Uint8Array) {
    await gameClient?.sendAudioAsync(instruction, soundbuf);
}

export async function sendIconAsync(iconType: IconType, slot: number, palette: Uint8Array, icon: Uint8Array) {
    await gameClient?.sendIconAsync(iconType, slot, palette, icon);
}

export async function sendScreenUpdateAsync(img: Uint8Array, palette: Uint8Array) {
    await gameClient?.sendScreenUpdateAsync(img, palette);
}

export async function sendCurrentScreenAsync() {
    await gameClient?.sendCurrentScreenAsync();
}

export function kickPlayer(clientId: string) {
    gameClient?.kickPlayer(clientId);
}

export function gameOver(reason: GameOverReason) {
    gameClient?.gameOver(reason);
}

export function getCurrentScreen(): {
    image: Uint8Array | undefined;
    palette: Uint8Array | undefined;
} {
    return (
        gameClient?.getCurrentScreen() || {
            image: undefined,
            palette: undefined,
        }
    );
}

export async function pauseGameAsync() {
    await gameClient?.pauseGameAsync();
}

export async function resumeGameAsync() {
    await gameClient?.resumeGameAsync();
}

export function destroy() {
    destroyGameClient();
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

    export type SoundMessage = MessageBase & {
        type: "sound";
        data: {
            instruction: "playinstructions" | "muteallchannels";
            soundbuf?: Uint8Array;
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
        gamePaused: boolean;
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

    export type KickPlayerMessage = MessageBase & {
        type: "kick-player";
        clientId: string;
    };

    export type GameOverMessage = MessageBase & {
        type: "game-over";
        reason: GameOverReason;
    };

    export type PauseGameMessage = MessageBase & {
        type: "pause-game";
    };

    export type ResumeGameMessage = MessageBase & {
        type: "resume-game";
    };

    export type Message =
        | ConnectMessage
        | StartGameMessage
        | InputMessage
        | ScreenMessage
        | SoundMessage
        | ReactionMessage
        | PresenceMessage
        | JoinedMessage
        | PlayerJoinedMessage
        | PlayerLeftMessage
        | KickPlayerMessage
        | GameOverMessage
        | PauseGameMessage
        | ResumeGameMessage;

    export type SimMessage = ScreenMessage | SoundMessage | InputMessage;

    export namespace Binary {
        export enum MessageType {
            Input = 1,
            CompressedScreen = 3,
            Audio = 4,
            Icon = 5,
        }

        // Input
        export function packInputMessage(button: number, state: ButtonState): Buffer {
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

        // CompressedScreen
        export function packCompressedScreenMessage(zippedData: Buffer, isDelta: boolean): Buffer {
            const writer = new SmartBuffer();
            writer.writeUInt16LE(MessageType.CompressedScreen);
            writer.writeUInt8(isDelta ? 1 : 0);
            writer.writeBuffer(zippedData);
            return writer.toBuffer();
        }
        export function unpackCompressedScreenMessage(reader: SmartBuffer): {
            zippedData: Buffer;
            isDelta: boolean;
        } {
            // `type` field has already been read
            const isDelta = reader.readUInt8() === 1;
            const zippedData = reader.readBuffer();
            return {
                zippedData,
                isDelta,
            };
        }

        // Audio
        export function packAudioMessage(instruction: number, soundbuf?: Buffer): Buffer {
            const writer = new SmartBuffer();
            writer.writeUInt16LE(MessageType.Audio);
            writer.writeUInt8(instruction);
            if (soundbuf) {
                writer.writeBuffer(soundbuf);
            }
            return writer.toBuffer();
        }
        export function unpackAudioMessage(reader: SmartBuffer): {
            instruction: number;
            soundbuf?: Buffer;
        } {
            // `type` field has already been read
            const instruction = reader.readUInt8();
            const soundbuf = reader.remaining() ? reader.readBuffer() : undefined;
            return {
                instruction,
                soundbuf,
            };
        }

        // Icon
        export function packIconMessage(iconType: IconType, iconSlot: number, iconBuffer?: Buffer): Buffer {
            const writer = new SmartBuffer();
            writer.writeUInt16LE(MessageType.Icon);
            writer.writeUInt8(iconType);
            writer.writeUInt8(iconSlot);
            if (iconBuffer) {
                writer.writeBuffer(iconBuffer);
            }
            return writer.toBuffer();
        }
        export function unpackIconMessage(reader: SmartBuffer): IconMessage {
            // `type` field has already been read
            const iconType = reader.readUInt8();
            const iconSlot = reader.readUInt8();
            let iconBuffer: Buffer | undefined;
            let iconPalette: Buffer | undefined;
            if (reader.remaining()) {
                iconBuffer = reader.readBuffer();
            }

            return {
                iconType,
                iconSlot,
                iconBuffer,
            };
        }
    }
}
