import { HighScore, GameData } from "../Types";
import { stateAndDispatch } from "./AppStateContext";

function getHighScores(gameId: string | undefined): HighScore[] {
    const { state } = stateAndDispatch();
    if (!gameId || !state.allHighScores[gameId]) {
        return [];
    }
    return state.allHighScores[gameId];
}

function getScoringType(gameId: string | undefined): string {
    const { state } = stateAndDispatch();
    if (!gameId || !state.allGames.find(game => game.id === gameId)) {
        return "None";
    }
    return state.allGames.find(game => game.id === gameId)!.highScoreMode;

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

function getSelectedGame(): GameData | undefined {
    const { state } = stateAndDispatch();
    return state.allGames.find(game => game.id === state.selectedGameId);
}

function getLaunchedGame(): GameData | undefined {
    const { state } = stateAndDispatch();
    return state.allGames.find(game => game.id === state.launchedGameId);
}

export {
    stateAndDispatch,
    getHighScores,
    getSelectedGameIndex,
    getSelectedGameId,
    getSelectedGame,
    getLaunchedGame,
    getScoringType,
};
