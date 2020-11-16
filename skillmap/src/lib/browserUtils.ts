const apiRoot = "https://www.makecode.com/api/md";
export type MarkdownSource = "docs" | "github";

export interface MarkdownFetchResult {
    text: string;
    url: string;
}

export function parseHash() {
    let hash = { cmd: '', arg: '' };
    // TODO shakao remove testing url later
    let match = /^#(\w+)(:([:./\-+=\w]+))?/.exec(window.location.hash || "#github:shakao-test/skill-map-test/main/test")
    if (match) {
        hash = { cmd: match[1], arg: match[3] || '' };
    }
    return hash;
}

export function parseQuery() {
    const out: {[index: string]: string} = {};
    const query = window.location.search;

    if (query) {
        const params = new URLSearchParams(query);

        params.forEach((value, key) => {
            if (value.toLowerCase() === "true" || value === "1") {
                value = "true";
            }
            out[key] = value;
        });
    }

    return out;
}

export async function getMarkdownAsync(source: MarkdownSource, url: string): Promise<MarkdownFetchResult> {
    if (!source || !url) return {
        text: "",
        url: ""
    };

    let toFetch: string;

    switch (source) {
        case "docs":
            url = url.trim().replace(/^[\\/]/i, "").replace(/\.md$/i, "");
            const target = (window as any).pxtTargetBundle?.name || "arcade";
            toFetch = `${apiRoot}/${target}/${url}`;
            break;
        case "github":
            /**
             * FORMATS:
             * /user-name/repo-name/branch-name/file-name
             * https://github.com/user-name/repo-name/blob/branch-name/file-name.md
             * https://raw.githubusercontent.com/user-name/repo-name/branch-name/file-name.md
             *
             * Leading slash and '.md' are optional but allowed
             */
            toFetch = url.trim();
            let match = /^(?:(?:https?:\/\/)?[^/]*?github\.com)?(?:\/)?([^/.]+)\/([^/]+)\/(?:blob\/)?([^/]+)\/([^/.]+?)(?:\.md)?$/gi.exec(toFetch);
            if (match) {
                toFetch = `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}/${match[4]}.md`
            }

            break;
        default:
            toFetch = url;
            break;
    }

    const markdown = await httpGetAsync(toFetch);

    return {
        text: markdown,
        url: toFetch
    };
}

export function httpGetAsync(url: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.addEventListener("error", err => {
            reject(err);
        });

        request.addEventListener("load", () => {
            try {
                resolve(request.responseText);
            }
            catch (e) {
                reject(e);
            }
        });
        request.open("GET", url);
        request.send();
    })
}

function getRandomBuf(buf: Uint8Array) {
    if (window.crypto)
        window.crypto.getRandomValues(buf);
    else {
        for (let i = 0; i < buf.length; ++i)
            buf[i] = Math.floor(Math.random() * 255);
    }
}

function randomUint32() {
    let buf = new Uint8Array(4)
    getRandomBuf(buf)
    return new Uint32Array(buf.buffer)[0]
}

export function guidGen() {
    function f() { return (randomUint32() | 0x10000).toString(16).slice(-4); }
    return f() + f() + "-" + f() + "-4" + f().slice(-3) + "-" + f() + "-" + f() + f() + f();
}

export function isLocal() {
    return window.location.hostname === "localhost";
}

export function resolvePath(path: string) {
    return `${isLocal() ? "" : "/static/skillmap"}/${path.replace(/^\//, "")}`
}