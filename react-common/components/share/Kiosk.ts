export const addGameToKioskAsync = async (kioskId: string, gameId: string) => {
    const updateKioskUrl = "https://makecode.com/api/kiosk/updatecode";
    try {
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
        await response.json();
    }
    catch (error) {
        throw new Error("Failed to post game to the kiosk");
    }
}