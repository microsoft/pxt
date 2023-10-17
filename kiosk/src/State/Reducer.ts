import { nanoid } from "nanoid";
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
            const selectedGameIndex = state.allGames.findIndex(
                g => g.id === action.gameId
            );
            if (selectedGameIndex !== -1) {
                // Try to select the next game in the list, or the previous game if there is no next game.
                let selectedGameId = undefined;
                if (selectedGameIndex < allGames.length - 1) {
                    selectedGameId = allGames[selectedGameIndex].id;
                } else if (allGames.length > 0) {
                    selectedGameId = allGames[allGames.length - 1].id;
                }
                return {
                    ...state,
                    selectedGameId,
                    allGames,
                };
            } else {
                return state;
            }
        }
        case "SAVE_HIGH_SCORE": {
            const { gameId, highScore } = action;
            const allHighScores = { ...state.allHighScores };
            const highScores = allHighScores[gameId] || [];
            // Before saving this high score, ensure we don't already have it recorded.
            // React is mean and will sometimes dispatch the action the reducer multiple times to flush out non-idempotent logic (development mode only).
            if (!highScores.find(hs => hs.id === highScore.id)) {
                highScores.push(highScore);
                highScores.sort((first, second) => second.score - first.score);
                highScores.splice(configData.HighScoresToKeep);
                allHighScores[gameId] = highScores;
                Storage.setHighScores(allHighScores);
                return {
                    ...state,
                    allHighScores,
                };
            } else {
                return state;
            }
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
            // TODO: is this idempotent?
            const addedGamesMap = Storage.getUserAddedGames();
            const addedGamesArr = Object.values(addedGamesMap);
            const newGames: GameData[] = [];
            for (const game of addedGamesArr) {
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
        case "SET_KIOSK_CODE": {
            Storage.setKioskCode(action.kioskCode, action.kioskCodeExpiration);
            return {
                ...state,
                kioskCode: action.kioskCode,
                kioskCodeExpiration: action.kioskCodeExpiration,
            };
        }
        case "CLEAR_KIOSK_CODE": {
            Storage.clearKioskCode();
            return {
                ...state,
                kioskCode: undefined,
                kioskCodeExpiration: undefined,
            };
        }
        case "POST_NOTIFICATION": {
            // Before posting the notification, ensure is doesn't already exist in the list.
            // React is mean and will sometimes dispatch the action the reducer multiple times to flush out non-idempotent logic (development mode only).
            if (
                !state.notifications.find(n => n.id === action.notification.id)
            ) {
                return {
                    ...state,
                    notifications: [
                        ...state.notifications,
                        action.notification,
                    ],
                };
            } else {
                return state;
            }
        }
        case "REMOVE_NOTIFICATION": {
            const notifications = state.notifications.filter(
                n => n.id !== action.notificationId
            );
            return {
                ...state,
                notifications,
            };
        }
        case "LOAD_KIOSK_CODE": {
            const kioskCode = Storage.getKioskCode();
            if (kioskCode) {
                return {
                    ...state,
                    kioskCode: kioskCode.code,
                    kioskCodeExpiration: kioskCode.expiration,
                };
            } else {
                return state;
            }
        }
        case "SHOW_MODAL": {
            return {
                ...state,
                modal: action.modal,
            };
        }
        case "HIDE_MODAL": {
            return {
                ...state,
                modal: undefined,
            };
        }
        case "SET_TARGET_CONFIG": {
            return {
                ...state,
                targetConfig: action.targetConfig,
            };
        }
    }
}
