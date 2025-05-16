// Copied from eanders-ms/arcade-plato/protocol.ts
// Keep them in sync
// Keep host changes backward compatible
export namespace PlayTogether {
    export const CHANNEL_ID = "arcade-plato-ext";

    export namespace _Protocol {
        /**
         * Client --> Host
         */
        export namespace CliToHost {
            /**
             * Notify host that the client is a PlayTogether client.
             */
            export interface InitMessage {
                type: "init";
                payload: {
                    version: number;
                };
            }

            export type Message = InitMessage;
        }

        /**
         * Host --> Client
         */
        export namespace HostToCli {
            /**
             * Notify client that the host is a PlayTogether host.
             */
            export interface InitMessage {
                type: "init";
                payload: {
                    playerId: string; // ID of the local player
                    isHost: boolean; // true if the local player is the session host
                };
            }

            /**
             * Notify client that a player is joining the game.
             */
            export interface PlayerJoinMessage {
                type: "player-join";
                payload: {
                    playerId: string;
                    playerName: string;
                    //playerIcon: Buffer;
                };
            }

            /**
             * Notify client that a player is leaving the game.
             */
            export interface PlayerLeaveMessage {
                type: "player-leave";
                payload: {
                    playerId: string;
                };
            }

            export type Message = InitMessage | PlayerJoinMessage | PlayerLeaveMessage;
        }
    }
}
