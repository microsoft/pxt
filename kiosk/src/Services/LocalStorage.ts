import * as Constants from "../Constants";
import { GameList, HighScores } from "../Types";

function getValue(key: string, defaultValue?: string): string | undefined {
    return localStorage.getItem(key) || defaultValue;
}

function setValue(key: string, val: string) {
    localStorage.setItem(key, val);
}

function delValue(key: string) {
    localStorage.removeItem(key);
}

function getJsonValue<T>(key: string, defaultValue?: T): T | undefined {
    var value = getValue(key);
    if (value) {
        return JSON.parse(value);
    }
    return defaultValue;
}

function setJsonValue(key: string, val: any) {
    setValue(key, JSON.stringify(val));
}

function getAddedGames(): GameList {
    return getJsonValue(Constants.addedGamesLocalStorageKey, <GameList>{})!;
}

function setAddedGames(games: GameList) {
    setJsonValue(Constants.addedGamesLocalStorageKey, games);
}

function getHighScores(): HighScores {
    return getJsonValue(Constants.highScoresLocalStorageKey, <HighScores>{})!;
}

function setHighScores(scores: HighScores) {
    setJsonValue(Constants.highScoresLocalStorageKey, scores);
}

function resetHighScores() {
    delValue(Constants.highScoresLocalStorageKey);
}

function setKioskCode(code: string, expiration: number) {
    setValue(Constants.kioskCodeStorageKey, code);
    setValue(Constants.kioskCodeExpirationStorageKey, expiration.toString());
}

function getKioskCode(): { code: string; expiration: number } | undefined {
    const code = getValue(Constants.kioskCodeStorageKey);
    const expiration = getValue(Constants.kioskCodeExpirationStorageKey);
    if (code && expiration) {
        return {
            code,
            expiration: parseInt(expiration),
        };
    }
    return undefined;
}

function clearKioskCode() {
    delValue(Constants.kioskCodeStorageKey);
    delValue(Constants.kioskCodeExpirationStorageKey);
}

export {
    getValue,
    setValue,
    delValue,
    getJsonValue,
    setJsonValue,
    getAddedGames,
    setAddedGames,
    getHighScores,
    setHighScores,
    resetHighScores,
    setKioskCode,
    getKioskCode,
    clearKioskCode,
};
