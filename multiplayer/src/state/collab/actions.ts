import { ActionBase } from "../../types";

type Init = ActionBase & {
    type: "INIT";
};

type PlayerJoined = ActionBase & {
    type: "PLAYER_JOINED";
    playerId: string;
};

type PlayerLeft = ActionBase & {
    type: "PLAYER_LEFT";
    playerId: string;
};

export type CollabAction = Init | PlayerJoined | PlayerLeft;

export function init(): Init {
    return {
        type: "INIT",
    };
}

export function playerJoined(playerId: string): PlayerJoined {
    return {
        type: "PLAYER_JOINED",
        playerId,
    };
}

export function playerLeft(playerId: string): PlayerLeft {
    return {
        type: "PLAYER_LEFT",
        playerId,
    };
}
