import { Socket } from "engine.io-client";
import { GameInfo, Cli2Srv, Srv2Cli } from "../types";
import {
    gameDisconnected,
    setGameModeAsync,
    setPresenceAsync,
    setReactionAsync,
    playerJoinedAsync,
    playerLeftAsync,
} from "../epics";

const GAME_HOST = "https://makecode-multiplayer.ngrok.io";
const AUTH_CONTAINER = "auth"; // local storage "namespace".
const CSRF_TOKEN_KEY = "csrf-token"; // stored in local storage.

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
        this.sock?.send(JSON.stringify(msg), {});
    }

    startHeartbeat() {
        this.heartbeatTimer = setInterval(
            () =>
                this.sendMessage({
                    type: "heartbeat",
                } as Cli2Srv.HeartbeatMessage),
            5000
        );
    }

    async authTokenAsync() {
        return await pxt.storage.shared.getAsync<string>(
            AUTH_CONTAINER,
            CSRF_TOKEN_KEY
        );
    }

    public async connectAsync(ticket: string) {
        return new Promise<void>(resolve => {
            this.sock = new Socket(GAME_HOST, {
                transports: ["websocket"], // polling is unsupported
                path: "/mp",
            });
            this.sock.on("open", () => {
                console.log("connected");

                this.sock?.on("message", async payload => {
                    try {
                        console.log(`Server sent: ${payload}`);
                        const msg = JSON.parse(payload) as Srv2Cli.Message;
                        switch (msg.type) {
                            case "hello":
                                return await this.recvHelloMessageAsync(msg);
                            case "connected":
                                return await this.recvConnectedMessageAsync(
                                    msg
                                );
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
                    } catch (e) {}
                });

                this.sock?.on("close", () => {
                    console.log("disconnected");
                    clearTimeout(this.heartbeatTimer);
                    gameDisconnected();
                });

                this.sock?.on("error", err => {
                    console.log("error", err);
                });

                this.sendMessage(<Cli2Srv.ConnectMessage>{
                    type: "connect",
                    ticket,
                });

                resolve();
            });
        });
    }

    public async hostGameAsync(shareCode: string): Promise<GameInfo> {
        shareCode = shareCode.toUpperCase();
        shareCode = encodeURIComponent(shareCode);

        const authToken = await this.authTokenAsync();

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

        const authToken = await this.authTokenAsync();

        // TODO: Send real credentials
        const lookupRes = await fetch(
            `${GAME_HOST}/api/game/lookup/${joinCode}`,
            {
                credentials: "include",
                headers: {
                    Authorization: "mkcd " + authToken,
                },
            }
        );

        const lookup = (await lookupRes.json()) as GameInfo;

        if (!lookup?.affinityCookie)
            throw new Error("Game server did not return an affinity cookie");

        const joinRes = await fetch(`${GAME_HOST}/api/game/join/${joinCode}`, {
            credentials: "include",
            headers: {
                Authorization: "mkcd " + authToken,
                //Cookie: lookup.affinityCookie,
            },
        });

        const gameInfo = (await joinRes.json()) as GameInfo;

        if (!gameInfo?.joinTicket)
            throw new Error("Game server did not return a join ticket");

        await this.connectAsync(gameInfo.joinTicket!);

        return gameInfo;
    }

    public async startGameAsync() {
        this.sendMessage(<Cli2Srv.StartGameMessage>{
            type: "start-game",
        });
    }

    public async leaveGameAsync() {
        this.sock?.close();
    }

    public async sendReactionAsync(index: number) {
        this.sendMessage(<Cli2Srv.ReactionMessage>{
            type: "reaction",
            index,
        });
    }

    private async recvHelloMessageAsync(msg: Srv2Cli.HelloMessage) {
        console.log("Server said hello");
    }

    private async recvConnectedMessageAsync(msg: Srv2Cli.ConnectedMessage) {
        console.log(
            `Server said we're connected as "${msg.role}" in slot "${msg.slot}"`
        );
        const gameMode = msg.gameMode;

        if (msg.role === "host") {
            // The host pings the server occasionally to keep the game session alive
            this.startHeartbeat();
        }

        setGameModeAsync(gameMode);
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
