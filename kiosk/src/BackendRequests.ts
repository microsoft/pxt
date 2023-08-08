const stagingEndpoint = "https://staging.pxt.io/api/kiosk"
const kioskBackendEndpoint = "https://makecode.com/api/kiosk";
const apiBackendEndpoint = "https://makecode.com/api";

export const getGameCodesAsync = async (kioskCode: string) => {
    const getGameCodeUrl = `${kioskBackendEndpoint}/code/${kioskCode}`;
    let response = await fetch(getGameCodeUrl);
    if (!response.ok) {
        const e =  new Error(response.statusText);
        e.name = "PollError";
        throw e;
    } else {
        const gameCodeEntries = JSON.parse((await response.json())?.shareIds);
        return gameCodeEntries;
    }
}

export const generateKioskCodeAsync = async (time?: number) => {
    const codeGenerationUrl = `${kioskBackendEndpoint}/newcode${time ? `?time=${time}` : ""}`;
    const response = await fetch(codeGenerationUrl);
    if (!response.ok) {
        const e =  new Error(response.statusText);
        e.name = "KioskCodeGenError";
        throw e;
    } else {
        try {
            const newKioskCode = (await response.json()).code;
            return newKioskCode;
        }
        catch (error) {
            throw new Error("No code returned from the request.");
        }
    }
}

export const addGameToKioskAsync = async (kioskId: string | undefined, gameShareId: string | undefined) => {
    const updateKioskUrl = `${kioskBackendEndpoint}/updatecode`;
    const response: Response = await fetch(updateKioskUrl, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "kioskCode": kioskId,
            "shareId": gameShareId
        }),
    });

    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
    } else {
        return await response.json();
    }


}

export const getGameDetailsAsync = async (gameId: string) => {
    const gameDetailsUrl = `${apiBackendEndpoint}/${gameId}`;
    const response  = await fetch(gameDetailsUrl);
    if (!response.ok) {
        throw new Error("Unable to fetch the game details");
    } else {
        return await response.json();
    }
}