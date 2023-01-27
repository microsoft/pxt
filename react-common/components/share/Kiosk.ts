export const addGameToKioskAsync = async (kioskId: string, gameId: string) => {
    const updateKioskUrl = "https://makecode.com/api/kiosk/updatecode";
    const response: Response = await fetch(updateKioskUrl, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "kioskCode": kioskId,
            "shareId": gameId
        }),
    });
    if (!response.ok) {
        throw new Error(lf(response.statusText));
    }
}