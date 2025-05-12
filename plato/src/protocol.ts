export const CHANNEL_ID = "arcade-plato-ext";

// Copied from eanders-ms/arcade-plato/protocol.ts
// Keep them in sync
export namespace PlayTogether {
    export namespace _Protocol {

        /**
         * Client --> Host
         * Notify host that the client is a PlayTogether client.
         */
        export interface ClientInitMessage {
            type: "client-init";
            payload: {
                version: number;
            };
        }

        /**
         * Host --> Client
         * Communicate game config and other information to the client.
         */
        export interface HostInitMessage {
            type: "host-init";
            payload: {
                playerId: string; // ID of the local player
                isHost: boolean; // true if the local player is the session host
            };
        }

        /**
         * Host --> Client
         * Notify client that a player is joining the game.
         */
        export interface PlayerJoinedMessage {
            type: "player-joined";
            payload: {
                playerId: string;
                playerName: string;
                //playerIcon: Buffer;
            };
        }

        /**
         * Host --> Client
         * Notify client that a player is leaving the game.
         */
        export interface PlayerLeftMessage {
            type: "player-left";
            payload: {
                playerId: string;
            };
        }

        export type Message = ClientInitMessage | HostInitMessage | PlayerJoinedMessage | PlayerLeftMessage;
    }
}
