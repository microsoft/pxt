import { PageSourceStatus } from "../store/reducer";

const apiRoot = "https://www.makecode.com/api";
export const cloudLocalStoreKey = "-SHOWN-LOGIN-PROMPT";
export type MarkdownSource = "docs" | "github" | "local";

export interface MarkdownFetchResult {
    identifier: string;
    text: string;
    reportId?: string;
    status: PageSourceStatus;
}

export interface ParsedHash {
    cmd: string;
    arg: string;
}

export function parseHash(hash?: string): ParsedHash {
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
            toFetch = getDocsIdentifier(url);
            status = "approved";
            break;
        case "github":
            return await fetchSkillMapFromGithub(url);
        case "local":
            return await fetchSkillMapFromLocal(url);
        default:
            toFetch = url;
            break;
    }

    let markdown: string;

    if (pxt.BrowserUtils.isSafari()) {
        // FIXME: safari adds the "If-None-Match" header which
        // causes an exception, so sometimes we need to retry.
        try {
            markdown = await httpGetAsync(toFetch);
        }
        catch (e) {
            markdown = await httpGetAsync(toFetch);
        }
    }
    else {
        markdown = await httpGetAsync(toFetch);
    }



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

    const baseRepo = pxt.github.parseRepoId(ghid.slug);
    const repoStatus = pxt.github.repoStatus(baseRepo, config);
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
        const { identifier, fileName } = getGithubIdentifier(ghid);
        return {
            text: pxt.tutorial.resolveLocalizedMarkdown(ghid, gh.files, fileName),
            identifier,
            reportId,
            status
        }
    }

    return undefined
}

async function fetchSkillMapFromLocal(path: string): Promise<MarkdownFetchResult | undefined> {
    if (isLocal()) {
        path = path.replace(/^\//, "").replace(/\.md$/, "");
        let res = await fetch("docs/" + path + ".md");
        let text = await res.text();
        return {
            text,
            identifier: path,
            status: "approved"
        }
    }

    return undefined;
}

export function getDocsIdentifier(path: string) {
    path = path.trim().replace(/^[\\/]/i, "").replace(/\.md$/i, "");
    const target = (window as any).pxtTargetBundle?.name || "arcade";
    return `${apiRoot}/md/${target}/${path}`;
}

export function getGithubIdentifier(ghid: pxt.github.ParsedRepo) {
    let fileName = parseGithubFilename(ghid.fileName ||  "skillmap");
    return {
        identifier: ghid.fullName + "#" + fileName,
        fileName: fileName
    }
}

function parseGithubFilename(fileName: string) {
    fileName = fileName.replace(/^\/?blob\/main\//, "");
    fileName = fileName.replace(/^\/?blob\/master\//, "");
    fileName = fileName.replace(/\.md$/, "");
    return fileName;
}

export async function postShareAsync(h?: pxt.workspace.Header, text?: pxt.workspace.ScriptText): Promise<pxt.Cloud.JsonScript | undefined> {
    if (!h || !text) return undefined;

    const script = await httpPostAsync(`${apiRoot}/scripts`, { ...h, text });
    return pxt.Util.jsonTryParse(script) as pxt.Cloud.JsonScript;
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
    if (!pxt.webConfig && (window as any).pxtConfig) pxt.setupWebConfig((window as any).pxtConfig);
    if (pxt.webConfig?.targetUrl && pxt.webConfig?.relprefix) {
        return pxt.webConfig.targetUrl + pxt.webConfig.relprefix.substr(0, pxt.webConfig.relprefix.length - 3);
    }
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

export function hasNavigator(): boolean {
    return typeof navigator !== "undefined";
}

// The browser matching code is the same as pxtlib/browserutils.ts
//Microsoft Edge lies about its user agent and claims to be Chrome, but Microsoft Edge/Version
//is always at the end
export function isEdge(): boolean {
    return hasNavigator() && /Edge/i.test(navigator.userAgent);
}

//IE11 also lies about its user agent, but has Trident appear somewhere in
//the user agent. Detecting the different between IE11 and Microsoft Edge isn't
//super-important because the UI is similar enough
export function isIE(): boolean {
    return hasNavigator() && /Trident/i.test(navigator.userAgent);
}

//Microsoft Edge and IE11 lie about being Chrome. Chromium-based Edge ("Edgeium") will be detected as Chrome, that is ok. If you're looking for Edgeium, use `isChromiumEdge()`.
export function isChrome(): boolean {
    return !isEdge() && !isIE() && !!navigator && (/Chrome/i.test(navigator.userAgent) || /Chromium/i.test(navigator.userAgent));
}

//Chrome and Microsoft Edge lie about being Safari
export function isSafari(): boolean {
    //Could also check isMac but I don't want to risk excluding iOS
    //Checking for iPhone, iPod or iPad as well as Safari in order to detect home screen browsers on iOS
    return !isChrome() && !isEdge() && !!navigator && /(Macintosh|Safari|iPod|iPhone|iPad)/i.test(navigator.userAgent);
}

//Safari and WebKit lie about being Firefox
export function isFirefox(): boolean {
    return !isSafari() && !!navigator && (/Firefox/i.test(navigator.userAgent) || /Seamonkey/i.test(navigator.userAgent));
}
