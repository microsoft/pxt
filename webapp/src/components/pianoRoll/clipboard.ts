import { CopyData } from "./types";

export function setCopiedData(data: CopyData) {
    const json = JSON.stringify(data);
    if (data.isDrumTrack) {
        localStorage.setItem("piano-roll-drum-copy", json);
    }
    else {
        localStorage.setItem("piano-roll-copy", json);
    }
}

export function getCopiedData(isDrumTrack: boolean): CopyData | undefined {
    const json = isDrumTrack ? localStorage.getItem("piano-roll-drum-copy") : localStorage.getItem("piano-roll-copy");
    if (!json) return undefined;

    try {
        const data = JSON.parse(json);
        return data;
    }
    catch (e) {
        console.error("Failed to parse copied data", e);
        return undefined;
    }
}