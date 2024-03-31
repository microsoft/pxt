import { ActionBase, Presence } from "../../types";

type Init = ActionBase & {
    type: "INIT";
    kv: Map<string, string>;
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

type DelPlayerValue = ActionBase & {
    type: "DEL_PLAYER_VALUE";
    playerId: string;
    key: string;
};

type SetSessionValue = ActionBase & {
    type: "SET_SESSION_VALUE";
    key: string;
    value: string;
};

type DelSessionValue = ActionBase & {
    type: "DEL_SESSION_VALUE";
    key: string;
};

type SetSessionState = ActionBase & {
    type: "SET_SESSION_STATE";
    sessKv: Map<string, string>;
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
    | DelPlayerValue
    | SetSessionValue
    | DelSessionValue
    | SetSessionState
    | UpdatePresence;

export function init(kv: Map<string, string>): Init {
    return {
        type: "INIT",
        kv,
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

export function delPlayerValue(playerId: string, key: string): DelPlayerValue {
    return {
        type: "DEL_PLAYER_VALUE",
        playerId,
        key,
    };
}

export function setSessionValue(key: string, value: string): SetSessionValue {
    return {
        type: "SET_SESSION_VALUE",
        key,
        value,
    };
}

export function delSessionValue(key: string): DelSessionValue {
    return {
        type: "DEL_SESSION_VALUE",
        key,
    };
}

export function setSessionState(sessKv: Map<string, string>): SetSessionState {
    return {
        type: "SET_SESSION_STATE",
        sessKv,
    };
}

export function updatePresence(presence: Presence): UpdatePresence {
    return {
        type: "UPDATE_PRESENCE",
        presence,
    };
}
