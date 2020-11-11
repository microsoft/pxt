const apiRoot = "https://www.makecode.com/api/md";
export type MarkdownSource = "docs" | "github";

export function parseHash() {
    let hash = { cmd: '', arg: '' };
    // TODO shakao remove testing url later
    let match = /^#(\w+)(:([:./\-+=\w]+))?/.exec(window.location.hash || "#github:shakao-test/skill-map-test/main/test")
    if (match) {
        hash = { cmd: match[1], arg: match[3] || '' };
    }
    return hash;
}

export async function getMarkdownAsync(source: MarkdownSource, url: string) {
    if (!source || !url) return "";
    switch (source) {
        case "docs":
            url = url.trim().replace(/^[\\/]/i, "").replace(/\.md$/i, "");
            const target = (window as any).pxtTargetBundle.name;
            return await httpGetAsync(`${apiRoot}/${target}/${url}`);
        case "github":
            /**
             * FORMATS:
             * /user-name/repo-name/branch-name/file-name
             * https://github.com/user-name/repo-name/blob/branch-name/file-name.md
             * https://raw.githubusercontent.com/user-name/repo-name/branch-name/file-name.md
             *
             * Leading slash and '.md' are optional but allowed
             */
            let rawUrl = url.trim();
            let match = /^(?:(?:https?:\/\/)?[^/]*?github\.com)?(?:\/)?([^/.]+)\/([^/]+)\/(?:blob\/)?([^/]+)\/([^/.]+?)(?:\.md)?$/gi.exec(rawUrl);
            if (match) {
                rawUrl = `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}/${match[4]}.md`
            }

            return await httpGetAsync(rawUrl);
        default:
            return await httpGetAsync(url);
    }
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

export function isLocal() {
    return window.location.hostname === "localhost";
}

export function resolvePath(path: string) {
    return `${isLocal() ? "" : "/static/skillmap"}/${path.replace(/^\//, "")}`
}