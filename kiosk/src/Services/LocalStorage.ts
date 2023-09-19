import * as Constants from "../Constants";
import { GameList, HighScores } from "../Types";

function getJsonValue<T>(key: string, defaultValue?: T): T | undefined {
    var value = localStorage.getItem(key);
    if (value) {
        return JSON.parse(value);
    }
    return defaultValue;
}

function setJsonValue(key: string, val: any) {
    localStorage.setItem(key, JSON.stringify(val));
}

function delValue(key: string) {
    localStorage.removeItem(key);
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

export {
    getJsonValue,
    setJsonValue,
    delValue,
    getAddedGames,
    setAddedGames,
    getHighScores,
    setHighScores,
    resetHighScores,
};
