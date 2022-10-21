import { dispatch } from "../state";
import { setGameMetadata, setNetMode, showToast } from "../state/actions";

export async function setGameMetadataAsync(shareCode: string): Promise<boolean> {
    try {
        // Download the game
        const res = await fetch(`https://arcade.makecode.com/${shareCode}`);

        // Extract game metadata
        const text = await res.text();
        const mtitle =
            /<meta\s+name="twitter:title"\s+content="(.*)"\s*\/>/gi.exec(text);
        const mdesc =
            /<meta\s+name="twitter:description"\s+content="(.*)"\s*\/>/gi.exec(
                text
            );
        const mthumb =
            /<meta\s+name="twitter:image"\s+content="(.*)"\s*\/>/gi.exec(text);

        const title = mtitle && mtitle.length > 1 ? mtitle[1] : lf("Untitled");
        const description = mdesc && mdesc.length > 1 ? mdesc[1] : "";
        const thumbnail = mthumb && mthumb.length > 1 ? mthumb[1] : "";

        dispatch(setGameMetadata({ title, description, thumbnail }));
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
