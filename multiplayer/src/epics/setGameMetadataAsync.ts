import { dispatch } from "../state";
import { setGameId, setGameMetadata, setNetMode, showToast } from "../state/actions";

export async function setGameMetadataAsync(
    shareCode: string
): Promise<boolean> {
    try {
        const metaUri = `https://makecode.com/api/${shareCode}`;
        //Fetch the game metadata
        const res = await fetch(metaUri);

        // Extract game metadata
        const metadata = await res.json();

        const title = metadata.name || lf("Untitled");
        const description = metadata.description || "";
        const thumbnail = `${metaUri}/thumb`;
        const gameId = metadata.id;

        dispatch(setGameMetadata({ title, description, thumbnail }));
        dispatch(setGameId(gameId));
        return true;
    } catch (e) {
        console.log("error", e);
        dispatch(setNetMode("init"));
        dispatch(
            showToast({
                type: "error",
                text: lf("Something went wrong. Please try again."),
                timeoutMs: 5000,
            })
        );
        return false;
    } finally {
    }
}
