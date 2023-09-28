import { HighScore, BuiltSimJSInfo } from "../Types";
import { stateAndDispatch } from "./AppStateContext";

function getHighScores(gameId: string | undefined): HighScore[] {
    const { state } = stateAndDispatch();
    if (!gameId || !state.allHighScores[gameId]) {
        return [];
    }
    return state.allHighScores[gameId];
}

function getSelectedGameIndex(): number | undefined {
    const { state } = stateAndDispatch();
    if (!state.selectedGameId) {
        return undefined;
    }
    return state.allGames.findIndex(game => game.id === state.selectedGameId);
}

function getSelectedGameId(): string | undefined {
    const { state } = stateAndDispatch();
    return state.selectedGameId;
}

function getBuiltGame(gameId: string | undefined): BuiltSimJSInfo | undefined {
    const { state } = stateAndDispatch();
    if (!gameId) {
        return undefined;
    }
    return state.builtGamesCache[gameId];
}

export {
    stateAndDispatch,
    getHighScores,
    getSelectedGameIndex,
    getSelectedGameId,
    getBuiltGame,
};
