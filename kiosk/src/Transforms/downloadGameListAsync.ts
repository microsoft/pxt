import { GameData } from "../Types";
import configData from "../config.json";

export async function downloadGameListAsync(): Promise<GameData[]> {
    const url = configData.GameDataUrl;

    let response = await fetch(url);
    if (!response.ok) {
        response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Unable to download game list from "${url}"`);
        }
    }

    try {
        const games = (await response.json()).games;
        return games;
    } catch (error) {
        throw new Error(
            `Unable to process game list downloaded from "${url}": ${error}`
        );
    }
}
