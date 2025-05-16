import { GameMetadata } from "@/types";


export async function getGameMetadataAsync(shareCode: string): Promise<GameMetadata | undefined> {
    try {
        const metaUri = `https://makecode.com/api/${shareCode}`;
        //Fetch the game metadata
        const res = await fetch(metaUri);

        // Extract game metadata
        const metadata = await res.json();


        return {
            title: metadata.name || lf("Untitled"),
            description: metadata.description || "",
            thumbnailUrl: `${metaUri}/thumb`,
        }
    } catch {
        pxt.error(`Failed to fetch game metadata for ${shareCode}`);
    }
}
