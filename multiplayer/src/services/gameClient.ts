import { Socket } from "engine.io-client";
import * as authClient from "./authClient";
import { GameInfo, Cli2Srv, Srv2Cli } from "../types";
import {
    gameDisconnected,
    setGameModeAsync,
    setPresenceAsync,
    setReactionAsync,
    playerJoinedAsync,
    playerLeftAsync,
} from "../epics";

const GAME_HOST =
    "https://makecode-ppe-app-multiplayer-eastus-dev.azurewebsites.net";
//const GAME_HOST = "http://localhost:8082"
//const GAME_HOST = "https://makecode-multiplayer.ngrok.io";

class GameClient {
    sock: Socket | undefined;
    heartbeatTimer: NodeJS.Timeout | undefined;

    constructor() {}

    destroy() {
        try {
            this.sock?.close();
            this.sock = undefined;
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            this.heartbeatTimer && clearInterval(this.heartbeatTimer);
        } catch (e) {}
    }

    sendMessage(msg: Cli2Srv.Message) {
        const payload = JSON.stringify(msg);
        console.log(`Sending: ${payload}`);
        this.sock?.send(payload, {}, (err: any) => {
            console.log("message sent");
            if (err) console.log("Error sending message", err);
        });
    }

    public async connectAsync(ticket: string) {
        return new Promise<void>((resolve, reject) => {
            const rejectTimeout = setTimeout(() => {
                reject("Timed out connecting to game server");
            }, 20 * 1000); // 20 seconds to join the game server

            this.sock = new Socket(GAME_HOST, {
                transports: ["websocket"], // polling is unsupported
                path: "/mp",
            });
            this.sock.on("open", () => {
                console.log("socket opened");

                this.sock?.on("message", async payload => {
                    try {
                        console.log(`Server sent: ${payload}`);
                        const msg = JSON.parse(payload) as Srv2Cli.Message;
                        switch (msg.type) {
                            case "hello":
                                return await this.recvHelloMessageAsync(msg);
                            case "joined": {
                                clearTimeout(rejectTimeout);
                                return await this.recvJoinedMessageAsync(
                                    msg,
                                    resolve
                                );
                            }
                            case "start-game":
                                return await this.recvStartGameMessageAsync(
                                    msg
                                );
                            case "presence":
                                return await this.recvPresenceMessageAsync(msg);
                            case "reaction":
                                return await this.recvReactionMessageAsync(msg);
                            case "player-joined":
                                return await this.recvPlayerJoinedMessageAsync(
                                    msg
                                );
                            case "player-left":
                                return await this.recvPlayerLeftMessageAsync(
                                    msg
                                );
                        }
                    } catch (e) {
                        console.error("Error processing message", e);
                    }
                });

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
                    } as Cli2Srv.ConnectMessage);
                }, 500); // TODO: Why is this necessary? The socket doesn't seem ready to send messages immediately. This isn't a shippable solution.
            });
        });
    }

    public async hostGameAsync(shareCode: string): Promise<GameInfo> {
        shareCode = shareCode.toUpperCase();
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
        } as Cli2Srv.StartGameMessage);
    }

    public async leaveGameAsync() {
        this.sock?.close();
    }

    public async sendReactionAsync(index: number) {
        this.sendMessage({
            type: "reaction",
            index,
        } as Cli2Srv.ReactionMessage);
    }

    private async recvHelloMessageAsync(msg: Srv2Cli.HelloMessage) {
        console.log("Server said hello");
    }

    private async recvJoinedMessageAsync(
        msg: Srv2Cli.JoinedMessage,
        resolve: () => void
    ) {
        console.log(
            `Server said we're joined as "${msg.role}" in slot "${msg.slot}"`
        );
        const gameMode = msg.gameMode;

        setGameModeAsync(gameMode);

        resolve(); // Finally! We're fully joined to the game server.
    }

    private async recvStartGameMessageAsync(msg: Srv2Cli.StartGameMessage) {
        console.log("Server said start game");
        setGameModeAsync("playing");
    }

    private async recvPresenceMessageAsync(msg: Srv2Cli.PresenceMessage) {
        console.log("Server sent presence");
        await setPresenceAsync(msg.presence);
    }

    private async recvReactionMessageAsync(msg: Srv2Cli.ReactionMessage) {
        console.log("Server sent reaction");
        await setReactionAsync(msg.userId, msg.index);
    }

    private async recvPlayerJoinedMessageAsync(
        msg: Srv2Cli.PlayerJoinedMessage
    ) {
        console.log("Server sent player joined");
        await playerJoinedAsync(msg.userId);
    }

    private async recvPlayerLeftMessageAsync(msg: Srv2Cli.PlayerLeftMessage) {
        console.log("Server sent player joined");
        await playerLeftAsync(msg.userId);
    }
}

let gameClient: GameClient | undefined;

export async function hostGameAsync(shareCode: string): Promise<GameInfo> {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    gameClient && gameClient.destroy();
    gameClient = new GameClient();
    const gameInfo = await gameClient.hostGameAsync(shareCode);
    return gameInfo;
}

export async function joinGameAsync(joinCode: string): Promise<GameInfo> {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    gameClient && gameClient.destroy();
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

export function destroy() {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    gameClient && gameClient.destroy();
    gameClient = undefined;
}
