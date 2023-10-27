import { ShareIds } from "../Types";

export const getGameCodesAsync = async (
    kioskCode: string
): Promise<ShareIds | undefined> => {
    try {
        const getGameCodeUrl = `${pxt.Cloud.apiRoot}/kiosk/code/${kioskCode}`;
        let response = await fetch(getGameCodeUrl);
        if (!response.ok) {
            const e = new Error(response.statusText);
            e.name = "PollError";
            throw e;
        } else {
            const gameCodeEntries = JSON.parse(
                (await response.json())?.shareIds
            ) as ShareIds;
            return gameCodeEntries;
        }
    } catch (error) {
        console.error(error);
    }
};

export const generateKioskCodeAsync = async (
    time?: number
): Promise<string | undefined> => {
    try {
        const codeGenerationUrl = `${pxt.Cloud.apiRoot}/kiosk/newcode${
            time ? `?time=${time}` : ""
        }`;
        const response = await fetch(codeGenerationUrl);
        if (!response.ok) {
            const e = new Error(response.statusText);
            e.name = "KioskCodeGenError";
            throw e;
        } else {
            try {
                const newKioskCode = (await response.json()).code;
                return newKioskCode;
            } catch (error) {
                throw new Error("No code returned from the request.");
            }
        }
    } catch (error) {
        console.error(error);
    }
};

export const canthrow_addGameToKioskAsync = async (
    kioskId: string | undefined,
    gameShareId: string | undefined
): Promise<any | undefined> => {
    const updateKioskUrl = `${pxt.Cloud.apiRoot}/kiosk/updatecode`;
    const response: Response = await fetch(updateKioskUrl, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            kioskCode: kioskId,
            shareId: gameShareId,
        }),
    });

    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
    } else {
        return await response.json();
    }
};

export const getGameDetailsAsync = async (
    gameId: string
): Promise<pxt.Cloud.JsonScript | undefined> => {
    try {
        const gameDetailsUrl = `${pxt.Cloud.apiRoot}/${gameId}`;
        const response = await fetch(gameDetailsUrl);
        if (!response.ok) {
            throw new Error("Unable to fetch the game details");
        } else {
            const gameDetails = await response.json();
            return gameDetails;
        }
    } catch (error) {
        console.error(error);
    }
};
