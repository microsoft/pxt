import { PageSourceStatus } from "../store/reducer";

const apiRoot = "https://www.makecode.com/api/md";
export type MarkdownSource = "docs" | "github";

export interface MarkdownFetchResult {
    identifier: string;
    text: string;
    reportId?: string;
    status: PageSourceStatus;
}

export function parseHash(hash?: string) {
    let parsed = { cmd: '', arg: '' };
    let match = /^(\w+)(:([:./\-+=\w]+))?/.exec((hash || window.location.hash).replace(/^#/, ""))
    if (match) {
        parsed = { cmd: match[1], arg: match[3] || '' };
    }
    return parsed;
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

export async function getMarkdownAsync(source: MarkdownSource, url: string): Promise<MarkdownFetchResult | undefined> {
    if (!source || !url) return undefined;

    let toFetch: string;
    let status: PageSourceStatus = "unknown";

    switch (source) {
        case "docs":
            url = url.trim().replace(/^[\\/]/i, "").replace(/\.md$/i, "");
            const target = (window as any).pxtTargetBundle?.name || "arcade";
            toFetch = `${apiRoot}/${target}/${url}`;
            status = "approved";
            break;
        case "github":
            return await fetchSkillMapFromGithub(url);
        default:
            toFetch = url;
            break;
    }

    const markdown = await httpGetAsync(toFetch);

    return {
        text: markdown,
        identifier: toFetch,
        status
    };
}


/**
 * Fetches the result and returns an identifier to key the content on. For docs, it
 * will just be the path. For github, it will be githubUser/reponame#path/to/skillmap.md
 */
async function fetchSkillMapFromGithub(path: string): Promise<MarkdownFetchResult | undefined> {
    const ghid = pxt.github.parseRepoId(path)
    const config = await pxt.packagesConfigAsync();
    const repoStatus = pxt.github.repoStatus(ghid, config);
    let status: PageSourceStatus = "unknown";

    let reportId: string | undefined;
    switch (repoStatus) {
        case pxt.github.GitRepoStatus.Banned:
            status = "banned";
            reportId = "https://github.com/" + ghid.fullName;
            break;
        case pxt.github.GitRepoStatus.Approved:
            status = "approved";
            reportId = undefined;
            break;
        default:
            reportId = "https://github.com/" + ghid.fullName;
            break;
    }

    const tag = ghid.tag || await pxt.github.latestVersionAsync(ghid.slug, config, true);

    if (!tag) {
        pxt.log(`skillmap github tag not found at ${ghid.fullName}`);
        return undefined;
    }
    ghid.tag = tag;

    const gh = await pxt.github.downloadPackageAsync(`${ghid.slug}#${ghid.tag}`, config);

    if (gh) {
        let fileName = ghid.fileName ||  "skillmap";
        fileName = fileName.replace(/^\/?blob\/main\//, "")
        fileName = fileName.replace(/^\/?blob\/master\//, "")
        fileName = fileName.replace(/\.md$/, "")

        return {
            text: pxt.tutorial.resolveLocalizedMarkdown(ghid, gh.files, fileName),
            identifier: ghid.fullName + "#" + fileName,
            reportId,
            status
        }
    }

    return undefined
}

export async function postAbuseReportAsync(id: string, data: { text: string }): Promise<void> {
    if (!!id) await httpPostAsync(`/api/${encodeURIComponent(id)}/abusereports`, data);
    return;
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

export function httpPostAsync(url: string, data: any): Promise<string> {
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
        request.open("POST", url, true);
        request.setRequestHeader('Content-type', 'application/json');
        request.send(JSON.stringify(data));
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

export function getEditorUrl(embedUrl: string) {
    const path = /\/([\da-zA-Z\.]+)(?:--)?/i.exec(window.location.pathname);
    return `${embedUrl.replace(/\/$/, "")}/${path?.[1] || ""}`;
}

let pageTitle: string;
let pageSourceUrl: string;

export function setPageTitle(title: string) {
    pageTitle = title;
}

export function setPageSourceUrl(url: string) {
    pageSourceUrl = url;
}

export function tickEvent(id: string, data?: { [key: string]: string | number }) {
    data = data || {};
    data["page"] = pageSourceUrl;
    data["pageTitle"] = pageTitle;

    (window as any).pxtTickEvent?.(id, data);
}