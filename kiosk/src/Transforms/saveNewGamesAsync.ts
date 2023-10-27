import { stateAndDispatch } from "../State";
import { getGameDetailsAsync } from "../Services/BackendRequests";
import {
    safeGameName,
    safeGameDescription,
    isPersistentGameId,
} from "../Utils";
import * as Storage from "../Services/LocalStorage";
import * as Actions from "../State/Actions";
import { GameData, ShareIds } from "../Types";
import { selectGame } from "./selectGame";

export async function saveNewGamesAsync(
    incoming: ShareIds
): Promise<GameData[]> {
    const dateStr = () =>
        new Date().toLocaleString(undefined, {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            minute: "numeric",
            hour: "numeric",
        });

    const { dispatch } = stateAndDispatch();
    const userAddedGames = Storage.getUserAddedGames();
    let result: GameData[] = [];
    const shareIds = Object.keys(incoming);

    for (const shareId of shareIds) {
        if (!userAddedGames[shareId]) {
            // Game not found locally, add it.

            // Fetch the metadata
            const gameDetails = await getGameDetailsAsync(shareId);
            const gameName = safeGameName(gameDetails?.name);
            const gameDescription = safeGameDescription(
                gameDetails?.description
            );

            const newGame: GameData = {
                id: shareId,
                name: gameName,
                description: gameDescription,
                highScoreMode: "None",
                uniqueIdentifier: incoming[shareId].id,
                date: dateStr(),
                userAdded: true,
                tempGameId: gameDetails?.id
            };

            dispatch(Actions.addGame(newGame));
            result.push(newGame);
        } else if (userAddedGames[shareId]?.deleted) {
            // Game found locally in deleted form. Restore it.
            const existing = userAddedGames[shareId];
            if (incoming[shareId].id !== existing.uniqueIdentifier) {
                // If it's a persistent share game, grab the latest metadata
                if (isPersistentGameId(shareId)) {
                    const gameDetails = await getGameDetailsAsync(shareId);
                    existing.name = safeGameName(gameDetails?.name);
                    existing.description = safeGameDescription(
                        gameDetails?.description
                    );
                    existing.tempGameId = gameDetails?.id;
                }
                existing.date = dateStr();
                existing.uniqueIdentifier = incoming[shareId].id;
                dispatch(Actions.addGame(existing));
                result.push(existing);
            }
        } else {
            if (
                incoming[shareId].id !==
                userAddedGames[shareId].uniqueIdentifier
            ) {
                // we need to keep the backend and frontend unique identifiers the same
                dispatch(
                    Actions.updateGame(shareId, {
                        uniqueIdentifier: incoming[shareId].id,
                        lastRefreshMs: userAddedGames[shareId].lastRefreshMs, // Preserve current refresh timestamp
                    })
                );
                // Game exists locally, but we still want to add it to
                // the result list so we can show a notification that it was
                // received.
                result.push(userAddedGames[shareId]);
            }
        }
    }
    if (result.length) {
        selectGame(result[0].id);
    }
    return result;
}
