import { nanoid } from "nanoid";
import * as Constants from "../Constants";
import { GamesById, AllHighScores } from "../Types";

function getValue(key: string, defaultValue?: string): string | undefined {
    return localStorage.getItem(key) || defaultValue;
}

function setValue(key: string, val: string) {
    localStorage.setItem(key, val);
}

function delValue(key: string) {
    localStorage.removeItem(key);
}

function matchingKeys(pattern: RegExp): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && pattern.test(key)) {
            keys.push(key);
        }
    }
    return keys;
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

function getUserAddedGames(): GamesById {
    let games = getJsonValue<GamesById>(Constants.addedGamesLocalStorageKey);
    if (!games) {
        games = getJsonValue(Constants.legacy_addedGamesLocalStorageKey);
        delValue(Constants.legacy_addedGamesLocalStorageKey);
    }
    if (!games) {
        games = {};
    }
    return games;
}

function setUserAddedGames(games: GamesById) {
    setJsonValue(Constants.addedGamesLocalStorageKey, games);
}

function getHighScores(): AllHighScores {
    let scores = getJsonValue<AllHighScores>(
        Constants.highScoresLocalStorageKey
    );
    if (!scores) {
        scores = getJsonValue(Constants.legacy_highScoresLocalStorageKey);
        delValue(Constants.legacy_highScoresLocalStorageKey);
    }
    if (!scores) {
        scores = {};
    }
    // Fixup old scores with no ids.
    let hasLegacyScores = false;
    for (const gameId of Object.keys(scores)) {
        const gameScores = scores[gameId];
        for (const score of gameScores) {
            if (!score.id) {
                score.id = nanoid();
                hasLegacyScores = true;
            }
        }
    }
    if (hasLegacyScores) {
        setHighScores(scores);
    }
    return scores;
}

function setHighScores(scores: AllHighScores) {
    setJsonValue(Constants.highScoresLocalStorageKey, scores);
}

function resetHighScores() {
    delValue(Constants.highScoresLocalStorageKey);
    delValue(Constants.legacy_highScoresLocalStorageKey);
}

function setKioskCode(code: string, expiration: number) {
    setValue(Constants.kioskCodeStorageKey, code);
    setValue(Constants.kioskCodeExpirationStorageKey, expiration.toString());
}

function getKioskCode(): { code: string; expiration: number } | undefined {
    let code = getValue(Constants.kioskCodeStorageKey);
    let expiration = getValue(Constants.kioskCodeExpirationStorageKey);
    if (!code) {
        code = getValue(Constants.legacy_kioskCodeStorageKey);
        expiration = getValue(Constants.legacy_kioskCodeExpirationStorageKey);
        delValue(Constants.legacy_kioskCodeStorageKey);
        delValue(Constants.legacy_kioskCodeExpirationStorageKey);
    }
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
    delValue(Constants.legacy_kioskCodeStorageKey);
    delValue(Constants.legacy_kioskCodeExpirationStorageKey);
}

function getBuiltJsInfo(gameId: string): ts.pxtc.BuiltSimJsInfo | undefined {
    const ver = pxt.appTarget?.versions?.target;
    if (!ver) return undefined;
    const key = `builtjs:${ver}:${gameId}`;
    const rec = getJsonValue<ts.pxtc.BuiltSimJsInfo>(key);
    return rec;
}

function setBuiltJsInfo(gameId: string, builtJs: ts.pxtc.BuiltSimJsInfo) {
    const ver = pxt.appTarget?.versions?.target;
    if (!ver) return;
    const key = `builtjs:${ver}:${gameId}`;
    setJsonValue(key, builtJs);
}

function clearBuiltJsInfo() {
    const keys = matchingKeys(/^builtjs:/);
    for (const key of keys) {
        delValue(key);
    }
}

export {
    getJsonValue,
    setJsonValue,
    getUserAddedGames,
    setUserAddedGames,
    getHighScores,
    setHighScores,
    resetHighScores,
    setKioskCode,
    getKioskCode,
    clearKioskCode,
    getBuiltJsInfo,
    setBuiltJsInfo,
    clearBuiltJsInfo,
};
