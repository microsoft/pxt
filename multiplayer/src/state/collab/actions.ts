import { ActionBase, Presence } from "../../types";

type Init = ActionBase & {
    type: "INIT";
};

type PlayerJoined = ActionBase & {
    type: "PLAYER_JOINED";
    playerId: string;
    kv?: Map<string, string>;
};

type PlayerLeft = ActionBase & {
    type: "PLAYER_LEFT";
    playerId: string;
};

type SetPlayerValue = ActionBase & {
    type: "SET_PLAYER_VALUE";
    playerId: string;
    key: string;
    value: string;
};

type UpdatePresence = ActionBase & {
    type: "UPDATE_PRESENCE";
    presence: Presence;
};

export type CollabAction =
    | Init
    | PlayerJoined
    | PlayerLeft
    | SetPlayerValue
    | UpdatePresence;

export function init(): Init {
    return {
        type: "INIT",
    };
}

export function playerJoined(
    playerId: string,
    kv?: Map<string, string>
): PlayerJoined {
    return {
        type: "PLAYER_JOINED",
        playerId,
        kv,
    };
}

export function playerLeft(playerId: string): PlayerLeft {
    return {
        type: "PLAYER_LEFT",
        playerId,
    };
}

export function setPlayerValue(
    playerId: string,
    key: string,
    value: string
): SetPlayerValue {
    return {
        type: "SET_PLAYER_VALUE",
        playerId,
        key,
        value,
    };
}

export function updatePresence(presence: Presence): UpdatePresence {
    return {
        type: "UPDATE_PRESENCE",
        presence,
    };
}
