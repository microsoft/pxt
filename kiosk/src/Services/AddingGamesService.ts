import { stateAndDispatch } from "../State";
import * as Actions from "../State/Actions";
import * as Backend from "./BackendRequests";
import { saveNewGamesAsync } from "../Transforms/saveNewGamesAsync";
import { postNotification } from "../Transforms/postNotification";
import { makeNotification } from "../Utils";

function initialize() {
    const pollOnce = async () => {
        const { state, dispatch } = stateAndDispatch();
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
                    postNotification(
                        makeNotification(`${game.name} added!`, 5000)
                    );
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
const kioskCodeGenerationThrottleMs = 1000;

async function generateKioskCodeAsync(durationMs: number) {
    // If we're already generating a code, don't generate another one.
    if (generatingKioskCode) {
        return;
    }

    generatingKioskCode = true;

    // If we're generating codes too quickly, wait a bit.
    if (Date.now() - lastKioskCodeGeneration < kioskCodeGenerationThrottleMs) {
        await new Promise(resolve =>
            setTimeout(resolve, kioskCodeGenerationThrottleMs)
        );
    }

    const { state, dispatch } = stateAndDispatch();

    try {
        const newCode = await Backend.generateKioskCodeAsync(durationMs);
        lastKioskCodeGeneration = Date.now();
        if (newCode) {
            dispatch(Actions.setKioskCode(newCode, Date.now() + durationMs));
        }
    } catch (error) {
        console.error(error);
    } finally {
        generatingKioskCode = false;
    }
}

export { initialize, generateKioskCodeAsync };
