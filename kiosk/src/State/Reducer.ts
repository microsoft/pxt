import { AppState } from "./State";
import { Action } from "./Actions";
import * as Storage from "../Services/LocalStorage";
import { setSoundEffectVolume } from "../Services/SoundEffectService";
import configData from "../config.json";
import { GameData } from "../Types";

// The reducer's job is to apply state changes by creating a copy of the existing state with the change applied.
// The reducer must not create side effects. E.g. do not dispatch a state change from within the reducer.
export default function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case "SET_GAME_LIST": {
            return {
                ...state,
                allGames: action.games,
            };
        }
        case "SET_SELECTED_GAME_ID": {
            return {
                ...state,
                selectedGameId: action.gameId,
            };
        }
        case "SET_KIOSK_STATE": {
            return {
                ...state,
                kioskState: action.state,
            };
        }
        case "ADD_BUILT_GAME": {
            return {
                ...state,
                builtGamesCache: {
                    ...state.builtGamesCache,
                    [action.gameId]: action.info,
                },
            };
        }
        case "SET_LAUNCHED_GAME": {
            return {
                ...state,
                launchedGameId: action.gameId,
            };
        }
        case "SET_LOCKED_GAME": {
            return {
                ...state,
                lockedGameId: action.gameId,
            };
        }
        case "SET_ALL_HIGH_SCORES": {
            Storage.setHighScores(action.allHighScores);
            return {
                ...state,
                allHighScores: action.allHighScores,
            };
        }
        case "SET_VOLUME": {
            setSoundEffectVolume(action.volume);
            return {
                ...state,
                volume: action.volume,
            };
        }
        case "ADD_GAME": {
            const allGames = [...state.allGames, action.game];
            return {
                ...state,
                allGames,
            };
        }
        case "REMOVE_GAME": {
            const allGames = state.allGames.filter(g => g.id !== action.gameId);
            return {
                ...state,
                allGames,
            };
        }
        case "SAVE_HIGH_SCORE": {
            const { gameId, score } = action;
            const allHighScores = { ...state.allHighScores };
            const highScores = allHighScores[gameId] || [];
            highScores.push({
                initials: action.initials,
                score,
            });
            highScores.sort((first, second) => second.score - first.score);
            highScores.splice(configData.HighScoresToKeep);
            allHighScores[gameId] = highScores;
            Storage.setHighScores(allHighScores);
            return {
                ...state,
                allHighScores,
            };
        }
        case "LOAD_HIGH_SCORES": {
            const allHighScores = Storage.getHighScores();
            return {
                ...state,
                allHighScores,
            };
        }
        case "SET_MOST_RECENT_SCORES": {
            return {
                ...state,
                mostRecentScores: action.scores,
            };
        }
        case "LOAD_USER_ADDED_GAMES": {
            const addedGamesArr = Storage.getAddedGames();
            const addedGamesObjs = Object.values(addedGamesArr);
            const newGames: GameData[] = [];
            for (const game of addedGamesObjs) {
                if (game) {
                    game.userAdded = true;
                    if (!game.deleted) {
                        newGames.push(game);
                    }
                }
            }
            const allGames = [...state.allGames, ...newGames];
            return {
                ...state,
                allGames,
            };
        }
        case "RESET_HIGH_SCORES": {
            Storage.resetHighScores();
            return {
                ...state,
                allHighScores: {},
            };
        }
    }
}
