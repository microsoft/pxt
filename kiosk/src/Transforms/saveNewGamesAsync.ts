import { stateAndDispatch } from "../State";
import { getGameDetailsAsync } from "../Services/BackendRequests";
import { safeGameName, safeGameDescription } from "../Utils";
import * as Constants from "../Constants";
import * as Storage from "../Services/LocalStorage";
import * as Actions from "../State/Actions";
import { GameData, ShareIds } from "../Types";
import { selectGame } from "./selectGame";

export async function saveNewGamesAsync(games: ShareIds): Promise<GameData[]> {
    const { state, dispatch } = stateAndDispatch();
    const allAddedGames = Storage.getUserAddedGames();
    let gamesToAdd: GameData[] = [];
    const shareIds = Object.keys(games);
    for (const shareId of shareIds) {
        if (!allAddedGames[shareId]) {
            let gameName;
            let gameDescription;

            const gameDetails = await getGameDetailsAsync(shareId);
            gameName = safeGameName(gameDetails?.name);
            gameDescription = safeGameDescription(gameDetails?.description);

            const gameUploadDate = new Date().toLocaleString(undefined, {
                year: "numeric",
                month: "numeric",
                day: "numeric",
                minute: "numeric",
                hour: "numeric",
            });
            const newGame: GameData = {
                id: shareId,
                name: gameName,
                description: gameDescription,
                highScoreMode: "None",
                uniqueIdentifier: games[shareId].id,
                date: gameUploadDate,
                userAdded: true,
            };

            dispatch(Actions.addGame(newGame));
            gamesToAdd.push(newGame);
            allAddedGames[shareId] = newGame;
        } else if (allAddedGames[shareId]?.deleted) {
            if (games[shareId].id !== allAddedGames[shareId].uniqueIdentifier) {
                allAddedGames[shareId].uniqueIdentifier = games[shareId].id;
                allAddedGames[shareId].deleted = false;
                gamesToAdd.push(allAddedGames[shareId]);
                dispatch(Actions.addGame(allAddedGames[shareId]));
            }
        } else {
            // we need to keep the backend and frontend unique identifiers the same
            allAddedGames[shareId].uniqueIdentifier = games[shareId].id;
        }
    }
    if (gamesToAdd.length) {
        selectGame(gamesToAdd[0].id);
    }
    Storage.setUserAddedGames(allAddedGames);
    return gamesToAdd;
}
