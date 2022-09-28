import { Socket } from "engine.io-client"
import { GameInfo } from "../types"


const GAME_HOST = "https://localhost:8082"

class GameClient {
    sock: Socket | undefined

    constructor() {}

    destroy() {
        try {
            this.sock?.close()
            this.sock = undefined
        }
        catch (e) {
        }
    }

    private async connectAsync() {
        // TODO: First handshake over https to get a token
        return new Promise<void>(resolve => {
            this.sock = new Socket(GAME_HOST, {
                transports: ["websocket"], // polling is disabled
                path: "/game"
            })
            this.sock.on("open", () => {
                console.log("connected")
                this.sock?.on("message", data => {
                    console.log("message", data)
                })
                this.sock?.on("close", () => {
                    console.log("closed")
                })
                this.sock?.on("error", err => {
                    console.log("error", err)
                })
                resolve()
            })
        })
    }

    async hostGameAsync(shareCode: string): Promise<GameInfo> {
        shareCode = shareCode.toUpperCase()
        shareCode = encodeURIComponent(shareCode)
        // TODO: Send credentials
        const res = await fetch(`${GAME_HOST}/api/game/host?sharecode=${shareCode}`)
        const hostInfo = await res.json() as HostInfo
    }
}

type HostInfo = {
    joinCode: string
    hostToken: string
    affinityCookie: string
}

let gameClient: GameClient | undefined

export async function hostGameAsync(shareCode: string): Promise<GameInfo> {
    gameClient && gameClient.destroy()
    gameClient = new GameClient()
    const gameInfo = await gameClient.hostGameAsync(shareCode)
}
