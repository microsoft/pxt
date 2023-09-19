import * as Constants from "../Constants";

export function safeGameName(name: string): string {
    if (name.toLowerCase() === "untitled") {
        return Constants.defaultGameName;
    }
    return name;
}

export function safeGameDescription(description: string): string {
    if (description === "") {
        return Constants.defaultGameDescription;
    }
    return description;
}
