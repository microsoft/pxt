import { secondsToMs, minutesToMs } from "../Utils";
import { stateAndDispatch } from "../State";
import * as Storage from "./LocalStorage";
import { getGameDetailsAsync } from "./BackendRequests";
import * as Actions from "../State/Actions";
import { safeGameName, safeGameDescription, isPersistentGameId } from "../Utils";

const REFRESH_TIMER_INTERVAL_MS = secondsToMs(15);
const GAME_NEEDS_REFRESH_MS = minutesToMs(1);

let refreshTimer: NodeJS.Timeout | undefined;

// Periodically refreshes the metadata for "persistent share" games, i.e. games
// that can be updated without their share ID changing.
async function refreshOneAsync() {
    const { state, dispatch } = stateAndDispatch();

    const nowMs = Date.now();

    const userAddedGames = Object.values(Storage.getUserAddedGames());

    for (const game of userAddedGames) {
        // Only refresh persistent share games
        if (!isPersistentGameId(game.id)) continue;
        // Don't refresh deleted games
        if (game.deleted) continue;

        const lastRefreshMs = game.lastRefreshMs ?? 0;

        if (lastRefreshMs + GAME_NEEDS_REFRESH_MS < nowMs) {
            //console.log(`Refreshing game ${game.id}`);
            const details = await getGameDetailsAsync(game.id);
            if (details) {
                if (details.id !== game.tempGameId) {
                    // The temporary gameId changed, update local copy of game metadata
                    dispatch(
                        Actions.updateGame(game.id, {
                            name: safeGameName(details.name),
                            description: safeGameDescription(
                                details.description
                            ),
                            tempGameId: details.id,
                        })
                    );
                    //console.log(`Refreshed game ${game.id} ${details.name}`);
                    // Update a maximum of one game per refresh cycle
                    break;
                } else {
                    //console.log(`Did not refresh game ${game.id}`);
                    // Poke the game to refresh the lastRefreshMs timestamp
                    dispatch(Actions.updateGame(game.id, {}));
                }
            }
        }
    }

    // Schedule the next refresh
    refreshTimer = setTimeout(
        refreshOneAsync,
        // Slightly randomize the interval to avoid multiple timers in the app
        // on the same interval to perfectly align
        REFRESH_TIMER_INTERVAL_MS + (Math.random() * 1000) | 0
    );
}

let initializeOnce = () => {
    initializeOnce = () => {
        throw new Error("GamepadManager.initialize() called more than once.");
    };
    refreshTimer = setTimeout(refreshOneAsync, REFRESH_TIMER_INTERVAL_MS);
};

export function initialize() {
    initializeOnce();
}
