import { stateAndDispatch } from "../State";
import { KioskState } from "../Types";
import * as Actions from "../State/Actions";
import * as Backend from "./BackendRequests";
import { saveNewGamesAsync } from "../Transforms/saveNewGamesAsync";
import { postNotification } from "../Transforms/postNotification";

function initialize() {
    const pollOnce = async () => {
        const { state, dispatch } = stateAndDispatch();
        if (state.kioskState === KioskState.PlayingGame) {
            // Don't poll while playing a game.
            return;
        }
        if (!state.kioskCode || !state.kioskCodeExpiration) {
            // No kiosk code, don't poll.
            return;
        }
        if (state.kioskCodeExpiration - Date.now() < 0) {
            // Kiosk code expired, clear it.
            dispatch(Actions.clearKioskCode());
        } else {
            // Kiosk code is still valid, poll for games.
            const gameCodes = await Backend.getGameCodesAsync(state.kioskCode);
            if (gameCodes) {
                const justAddedGames = await saveNewGamesAsync(gameCodes);
                justAddedGames.forEach(game => {
                    postNotification({
                        message: `${game.name} added!`,
                        duration: 5000,
                    });
                });
            }
        }
    };

    const pollForGames = async () => {
        try {
            await pollOnce();
        } catch (error) {
            console.error(error);
        }
        setTimeout(pollForGames, 5000);
    };

    setTimeout(pollForGames, 1000);
}

let generatingKioskCode = false;
let lastKioskCodeGeneration = 0;
const kioskCodeGenerationDelay = 1000;

async function generateKioskCodeAsync(durationMs: number) {
    // If we're already generating a code, don't generate another one.
    if (generatingKioskCode) {
        return;
    }

    generatingKioskCode = true;

    // If we're generating codes too quickly, wait a bit.
    if (Date.now() - lastKioskCodeGeneration < kioskCodeGenerationDelay) {
        await new Promise(resolve =>
            setTimeout(resolve, kioskCodeGenerationDelay)
        );
    }

    try {
        const newCode = await Backend.generateKioskCodeAsync(durationMs);
        lastKioskCodeGeneration = Date.now();
        const { state, dispatch } = stateAndDispatch();
        dispatch(Actions.setKioskCode(newCode, Date.now() + durationMs));
    } catch (error) {
        console.error(error);
    } finally {
        generatingKioskCode = false;
    }
}

export { initialize, generateKioskCodeAsync };
