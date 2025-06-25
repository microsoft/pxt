namespace pxt.hash {
    export type URLHashCommand =
        | "doc"
        | "follow"
        | "newproject"
        | "newjavascript"
        | "newpython"
        | "testproject"
        | "gettingstarted"
        | "tutorial"
        | "example"
        | "recipe"
        | "home"
        | "sandbox"
        | "pub"
        | "edit"
        | "header"
        | "sandboxproject"
        | "project"
        | "reload"
        | "skillmapimport"
        | "embedimport"
        | "github"
        | "editor";

    export type HashChangeListener = (hash: UrlHash) => void;

    let pendingHash: string | undefined;
    let hashListeners: HashChangeListener[];

    export interface UrlHash {
        command: URLHashCommand;
        arg?: string;
    }

    export function parse(hash: string): UrlHash | undefined {
        const match = /^#(\w+)(:([:\.\/\-\+\=\w]+))?/.exec(hash)

        if (!match) {
            return undefined;
        }

        return {
            command: match[1].toLowerCase() as URLHashCommand,
            arg: match[3] || undefined
        };
    }

    export function clear() {
        pxt.BrowserUtils.changeHash("");
    }

    export function changeHash(hash: URLHashCommand, arg?: string, keepHistory?: boolean) {
        const newHash = `#${hash}${arg ? `:${arg}` : ""}`;
        pxt.BrowserUtils.changeHash(newHash, keepHistory);
        pendingHash = newHash;
    }

    export function addChangeListener(callback: (hash: UrlHash) => void) {
        if (!hashListeners) {
            pendingHash = undefined;
            hashListeners = [];
            window.addEventListener("hashchange", () => {
                const hash = window.location.hash;

                if (hash === pendingHash) {
                    pendingHash = undefined;
                    return;
                }

                pendingHash = undefined;

                const parsed = parse(hash);
                for (const listener of hashListeners) {
                    try {
                        listener(parsed);
                    } catch (e) {
                        pxt.log(`Error in hash change listener: ${e}`);
                    }
                }
            });
        }

        if (hashListeners.indexOf(callback) < 0) {
            hashListeners.push(callback);
        }
    }

    export function removeChangeListener(callback: (hash: UrlHash) => void) {
        if (hashListeners) {
            hashListeners = hashListeners.filter(listener => listener !== callback);
        }
    }

    // Determines whether the hash argument affects the starting project
    export function isProjectRelated(hash: UrlHash): boolean {
        if (!hash) {
            return false;
        }
        switch (hash.command) {
            case "follow":
            case "newproject":
            case "newjavascript":
            case "testproject":
            // case "gettingstarted": // This should be true, #gettingstarted hash handling is not yet implemented
            case "tutorial":
            case "example":
            case "recipe":
            case "project":
            case "sandbox":
            case "pub":
            case "edit":
            case "sandboxproject":
            case "project":
            case "header":
                return true;
            case "github":
            default:
                return false;
        }
    }
}