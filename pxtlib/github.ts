namespace pxt.github {
    export interface GHRef {
        ref: string;
        url: string;
        object: {
            sha: string;
            type: string;
            url: string;
        }
    }

    /**
     * Commit user info
     */
    export interface UserInfo {
        date: string; // "2014-11-07T22:01:45Z",
        name: string; // "Scott Chacon",
        email: string; // "schacon@gmail.com"
    }

    export interface SHAObject {
        url: string;
        sha: string;
    }

    export interface TreeEntry extends SHAObject {
        path: string; // ".clang-format",
        mode: string; // "100644",
        type: "blob" | "tree";
        size?: number; // 126,
        blobContent?: string; // this is added for caching
    }

    export interface Tree extends SHAObject {
        tree: TreeEntry[];
        truncated: boolean;
    }

    export interface CommitInfo extends SHAObject {
        author: UserInfo;
        committer: UserInfo;
        message: string; // "added readme, because im a good github citizen",
        tree: SHAObject;
    }

    export interface Commit extends SHAObject {
        author: UserInfo;
        committer: UserInfo;
        message: string; // "added readme, because im a good github citizen",
        tag?: string;
        parents: SHAObject[]; // commit[]
        tree: Tree; // tree
    }

    export let token: string = null;

    export interface RefsResult {
        refs: pxt.Map<string>;
        head?: string;
    }

    export interface FileContent {
        encoding: string;
        content: string;
        size: number;
        sha: string;
        download_url: string;
    }

    interface CommitComment {
        id: number;
        body: string;
        path?: string;
        position?: number;
        user: User;
    }

    export let forceProxy = false;

    function hasProxy() {
        if (forceProxy)
            return true;
        if (U.isNodeJS)
            return false // bypass proxy for CLI
        if (pxt?.appTarget?.cloud?.noGithubProxy)
            return false // target requests no proxy
        return true
    }

    function shouldUseProxy(force?: boolean) {
        if (forceProxy)
            return true;
        if (token && !force)
            return false
        return hasProxy();
    }

    export let handleGithubNetworkError: (e: any) => boolean;

    let isPrivateRepoCache: pxt.Map<boolean> = {};

    export interface CachedPackage {
        files: Map<string>;
    }

    // caching
    export interface IGithubDb {
        loadConfigAsync(repopath: string, tag: string): Promise<pxt.PackageConfig>;
        loadPackageAsync(repopath: string, tag: string): Promise<CachedPackage>;
    }

    function ghRequestAsync(options: U.HttpRequestOptions) {
        // call github request with existing token
        // if the request fails and the token is clear, try again with the token
        return workAsync(!!token)

        function workAsync(canRetry: boolean): Promise<U.HttpResponse> {
            const opts = U.clone(options) as U.HttpRequestOptions;
            if (token) {
                if (!opts.headers) opts.headers = {}
                if (opts.url == GRAPHQL_URL)
                    opts.headers['Authorization'] = `bearer ${token}`
                else {
                    if (opts.url.indexOf('?') > 0)
                        opts.url += "&"
                    else
                        opts.url += "?"
                    opts.url += "anti_cache=" + Math.random()
                    opts.headers['Authorization'] = `token ${token}`
                }
            }
            opts.allowHttpErrors = false;
            return U.requestAsync(opts)
                .catch(e => {
                    pxt.tickEvent("github.error", { statusCode: e.statusCode });
                    if (handleGithubNetworkError) {
                        const retry = handleGithubNetworkError(e)
                        // retry if it may fix the issue
                        if (retry) return workAsync(false);
                    }
                    throw e;
                });
        }
    }

    export function isOrgAsync(owner: string): Promise<boolean> {
        return ghRequestAsync({ url: `https://api.github.com/orgs/${owner}`, allowHttpErrors: true, method: "GET" })
            .then(resp => resp.statusCode == 200);
    }

    function ghGetJsonAsync(url: string) {
        return ghRequestAsync({ url }).then(resp => resp.json)
    }

    function ghProxyJsonAsync(path: string) {
        return Cloud.apiRequestWithCdnAsync({ url: "gh/" + path }).then(r => r.json)
    }

    function ghProxyHandleException(e: any) {
        pxt.log(`github proxy error: ${e.message}`)
        pxt.debug(e);
    }

    export class MemoryGithubDb implements IGithubDb {
        private configs: pxt.Map<pxt.PackageConfig> = {};
        private packages: pxt.Map<CachedPackage> = {};

        private proxyLoadPackageAsync(repopath: string, tag: string): Promise<CachedPackage> {
            // cache lookup
            const key = `${repopath}/${tag}`;
            let res = this.packages[key];
            if (res) {
                pxt.debug(`github cache ${repopath}/${tag}/text`);
                return Promise.resolve(res);
            }

            // load and cache
            return ghProxyJsonAsync(`${repopath}/${tag}/text`)
                .then(v => this.packages[key] = { files: v });
        }

        private cacheConfig(key: string, v: string) {
            const cfg = pxt.Package.parseAndValidConfig(v);
            this.configs[key] = cfg;
            return U.clone(cfg);
        }

        async loadConfigAsync(repopath: string, tag: string): Promise<pxt.PackageConfig> {
            if (!tag) tag = "master";

            // cache lookup
            const key = `${repopath}/${tag}`;
            let res = this.configs[key];
            if (res) {
                pxt.debug(`github cache ${repopath}/${tag}/config`);
                return U.clone(res);
            }

            // download and cache
            // try proxy if available
            if (hasProxy()) {
                try {
                    const gpkg = await this.proxyLoadPackageAsync(repopath, tag)
                    return this.cacheConfig(key, gpkg.files[pxt.CONFIG_NAME]);
                } catch (e) {
                    ghProxyHandleException(e);
                }
            }
            // if failed, try github apis
            const cfg = await downloadTextAsync(repopath, tag, pxt.CONFIG_NAME);
            return this.cacheConfig(key, cfg);
        }

        async loadPackageAsync(repopath: string, tag: string): Promise<CachedPackage> {
            if (!tag) tag = "master";

            // try using github proxy first
            if (hasProxy()) {
                try {
                    return await this.proxyLoadPackageAsync(repopath, tag).then(v => U.clone(v));
                } catch (e) {
                    ghProxyHandleException(e);
                }
            }

            // try using github apis
            return await this.githubLoadPackageAsync(repopath, tag);
        }

        private githubLoadPackageAsync(repopath: string, tag: string): Promise<CachedPackage> {
            return tagToShaAsync(repopath, tag)
                .then(sha => {
                    // cache lookup
                    const key = `${repopath}/${sha}`;
                    let res = this.packages[key];
                    if (res) {
                        pxt.debug(`github cache ${repopath}/${tag}/text`);
                        return Promise.resolve(U.clone(res));
                    }

                    // load and cache
                    pxt.log(`Downloading ${repopath}/${tag} -> ${sha}`)
                    return downloadTextAsync(repopath, sha, pxt.CONFIG_NAME)
                        .then(pkg => {
                            const current: CachedPackage = {
                                files: {}
                            }
                            current.files[pxt.CONFIG_NAME] = pkg
                            const cfg: pxt.PackageConfig = JSON.parse(pkg)
                            return Promise.map(pxt.allPkgFiles(cfg).slice(1),
                                fn => downloadTextAsync(repopath, sha, fn)
                                    .then(text => {
                                        current.files[fn] = text
                                    }))
                                .then(() => {
                                    // cache!
                                    this.packages[key] = current;
                                    return U.clone(current);
                                })
                        })
                })
        }
    }

    function fallbackDownloadTextAsync(repopath: string, commitid: string, filepath: string) {
        return ghRequestAsync({
            url: "https://api.github.com/repos/" + repopath + "/contents/" + filepath + "?ref=" + commitid
        }).then(resp => {
            const f = resp.json as FileContent
            isPrivateRepoCache[repopath] = true
            // if they give us content, just return it
            if (f && f.encoding == "base64" && f.content != null)
                return atob(f.content)
            // otherwise, go to download URL
            return U.httpGetTextAsync(f.download_url)
        })
    }

    export function downloadTextAsync(repopath: string, commitid: string, filepath: string) {
        // raw.githubusercontent.com doesn't accept ?access_token=... and has wrong CORS settings
        // for Authorization: header; so try anonymous access first, and otherwise fetch using API

        if (isPrivateRepoCache[repopath])
            return fallbackDownloadTextAsync(repopath, commitid, filepath)

        return U.requestAsync({
            url: "https://raw.githubusercontent.com/" + repopath + "/" + commitid + "/" + filepath,
            allowHttpErrors: true
        }).then(resp => {
            if (resp.statusCode == 200)
                return resp.text
            return fallbackDownloadTextAsync(repopath, commitid, filepath)
        })
    }

    // overriden by client
    export let db: IGithubDb = new MemoryGithubDb();

    export function authenticatedUserAsync(): Promise<User> {
        if (!token) return Promise.resolve(undefined); // no token, bail out
        return ghGetJsonAsync("https://api.github.com/user");
    }

    export function getCommitsAsync(repopath: string, sha: string): Promise<CommitInfo[]> {
        return ghGetJsonAsync("https://api.github.com/repos/" + repopath + "/commits?sha=" + sha)
            .then(objs => objs.map((obj: any) => {
                const c = obj.commit;
                c.url = obj.url;
                c.sha = obj.sha;
                return c;
            }));
    }

    export function getCommitAsync(repopath: string, sha: string) {
        return ghGetJsonAsync("https://api.github.com/repos/" + repopath + "/git/commits/" + sha)
            .then((commit: Commit) => ghGetJsonAsync(commit.tree.url + "?recursive=1")
                .then((tree: Tree) => {
                    commit.tree = tree
                    return commit
                }))
    }

    // type=blob
    export interface CreateBlobReq {
        content: string;
        encoding: "utf-8" | "base64";
    }

    // type=tree
    export interface CreateTreeReq {
        base_tree: string; // sha
        tree: TreeEntry[];
    }

    // type=commit
    export interface CreateCommitReq {
        message: string;
        parents: string[]; // shas
        tree: string; // sha
    }

    function ghPostAsync(path: string, data: any, headers?: any, method?: string) {
        return ghRequestAsync({
            url: /^https:/.test(path) ? path : "https://api.github.com/repos/" + path,
            headers,
            method: method || "POST",
            allowHttpErrors: true,
            data: data
        }).then(resp => {
            if (resp.statusCode == 200 || resp.statusCode == 202 || resp.statusCode == 201 || resp.statusCode == 204)
                return resp.json

            let e = new Error(lf("Cannot create object at github.com/{0}; code: {1}",
                path, resp.statusCode));
            (<any>e).statusCode = resp.statusCode;
            (<any>e).isUserError = true;
            if (resp.statusCode == 404)
                (<any>e).needsWritePermission = true;
            throw e
        })
    }

    export function createObjectAsync(repopath: string, type: string, data: any) {
        return ghPostAsync(repopath + "/git/" + type + "s", data)
            .then((resp: SHAObject) => resp.sha)
    }

    export function postCommitComment(repopath: string, commitSha: string, body: string, path?: string, position?: number) {
        return ghPostAsync(`${repopath}/commits/${commitSha}/comments`, {
            body, path, position
        })
            .then((resp: CommitComment) => resp.id);
    }

    export async function fastForwardAsync(repopath: string, branch: string, commitid: string) {
        let resp = await ghRequestAsync({
            url: "https://api.github.com/repos/" + repopath + "/git/refs/heads/" + branch,
            method: "PATCH",
            allowHttpErrors: true,
            data: {
                sha: commitid,
                force: false
            }
        })
        return (resp.statusCode == 200)
    }

    export async function putFileAsync(repopath: string, path: string, content: string) {
        let resp = await ghRequestAsync({
            url: "https://api.github.com/repos/" + repopath + "/contents/" + path,
            method: "PUT",
            allowHttpErrors: true,
            data: {
                message: lf("Initialize empty repo"),
                content: btoa(U.toUTF8(content)),
                branch: "master"
            }
        })
        if (resp.statusCode != 201)
            U.userError("PUT file failed")
    }

    export async function createTagAsync(repopath: string, tag: string, commitid: string) {
        await ghPostAsync(repopath + "/git/refs", {
            ref: "refs/tags/" + tag,
            sha: commitid
        })
    }

    export async function createReleaseAsync(repopath: string, tag: string, commitid: string) {
        await ghPostAsync(repopath + "/releases", {
            tag_name: tag,
            target_commitish: commitid,
            name: tag,
            draft: false,
            prerelease: false
        })
    }

    export async function createPRFromBranchAsync(repopath: string, baseBranch: string,
        headBranch: string, title: string, msg?: string) {
        const res = await ghPostAsync(repopath + "/pulls", {
            title: title,
            body: msg || lf("Automatically created from MakeCode."),
            head: headBranch,
            base: baseBranch,
            maintainer_can_modify: true
        })
        return res.html_url as string
    }

    export function mergeAsync(repopath: string, base: string, head: string, message?: string) {
        return ghRequestAsync({
            url: "https://api.github.com/repos/" + repopath + "/merges",
            method: "POST",
            allowHttpErrors: true,
            data: {
                base,
                head,
                commit_message: message
            }
        }).then(resp => {
            if (resp.statusCode == 201 || resp.statusCode == 204)
                return (resp.json as SHAObject).sha
            if (resp.statusCode == 409) {
                // conflict
                return null
            }
            throw U.userError(lf("Cannot merge in github.com/{1}; code: {2}", repopath, resp.statusCode))
        })
    }

    export function getRefAsync(repopath: string, branch: string) {
        branch = branch || "master";
        return ghGetJsonAsync("https://api.github.com/repos/" + repopath + "/git/refs/heads/" + branch)
            .then(resolveRefAsync)
            .catch(err => {
                if (err.statusCode == 404) return undefined;
                else Promise.reject(err);
            })
    }

    function generateNextRefName(res: RefsResult, pref: string): string {
        let n = 1
        while (res.refs[pref + n])
            n++
        return pref + n
    }

    export async function getNewBranchNameAsync(repopath: string, pref = "patch-") {
        const res = await listRefsExtAsync(repopath, "heads")
        return generateNextRefName(res, pref);
    }

    export async function createNewBranchAsync(repopath: string, branchName: string, commitid: string) {
        await ghPostAsync(repopath + "/git/refs", {
            ref: "refs/heads/" + branchName,
            sha: commitid
        })
        return branchName
    }

    export async function forkRepoAsync(repopath: string, commitid: string, pref = "pr-") {
        const res = await ghPostAsync(repopath + "/forks", {})
        const repoInfo = mkRepo(res, null)
        const endTm = Date.now() + 5 * 60 * 1000
        let refs: RefsResult = null
        while (!refs && Date.now() < endTm) {
            await Promise.delay(1000)
            try {
                refs = await listRefsExtAsync(repoInfo.fullName, "heads");
            } catch (err) {
                // not created
            }
        }
        if (!refs)
            throw new Error(lf("Timeout waiting for fork"))

        const branchName = generateNextRefName(refs, pref);
        await createNewBranchAsync(repoInfo.fullName, branchName, commitid)
        return repoInfo.fullName + "#" + branchName
    }

    export function listRefsAsync(repopath: string, namespace = "tags", useProxy?: boolean): Promise<string[]> {
        return listRefsExtAsync(repopath, namespace, useProxy)
            .then(res => Object.keys(res.refs))
    }

    export function listRefsExtAsync(repopath: string, namespace = "tags", useProxy?: boolean): Promise<RefsResult> {
        const proxy = shouldUseProxy(useProxy);
        let head: string = null
        const fetch = !proxy ?
            ghGetJsonAsync("https://api.github.com/repos/" + repopath + "/git/refs/" + namespace + "/?per_page=100") :
            // no CDN caching here
            U.httpGetJsonAsync(`${pxt.Cloud.apiRoot}gh/${repopath}/refs`)
                .then(r => {
                    let res = Object.keys(r.refs)
                        .filter(k => U.startsWith(k, "refs/" + namespace + "/"))
                        .map(k => ({ ref: k, object: { sha: r.refs[k] } }))
                    head = r.refs["HEAD"]
                    return res
                })

        let clean = (x: string) => x.replace(/^refs\/[^\/]+\//, "")

        return fetch.then<RefsResult>((resp: GHRef[]) => {
            resp.sort((a, b) => semver.strcmp(clean(a.ref), clean(b.ref)))
            let r: pxt.Map<string> = {}
            for (let obj of resp) {
                r[clean(obj.ref)] = obj.object.sha
            }
            return { refs: r, head }
        }, err => {
            if (err.statusCode == 404) return { refs: {} }
            else return Promise.reject(err)
        })
    }

    function resolveRefAsync(r: GHRef): Promise<string> {
        if (r.object.type == "commit")
            return Promise.resolve(r.object.sha)
        else if (r.object.type == "tag")
            return ghGetJsonAsync(r.object.url)
                .then((r: GHRef) =>
                    r.object.type == "commit" ? r.object.sha :
                        Promise.reject(new Error("Bad type (2nd order) " + r.object.type)))
        else
            return Promise.reject(new Error("Bad type " + r.object.type))
    }

    function tagToShaAsync(repopath: string, tag: string) {
        // TODO  support fetching a tag
        if (/^[a-f0-9]{40}$/.test(tag))
            return Promise.resolve(tag)
        return ghGetJsonAsync("https://api.github.com/repos/" + repopath + "/git/refs/tags/" + tag)
            .then(resolveRefAsync, e =>
                ghGetJsonAsync("https://api.github.com/repos/" + repopath + "/git/refs/heads/" + tag)
                    .then(resolveRefAsync))
    }

    export function pkgConfigAsync(repopath: string, tag = "master") {
        return db.loadConfigAsync(repopath, tag)
    }

    export function downloadPackageAsync(repoWithTag: string, config: pxt.PackagesConfig): Promise<CachedPackage> {
        let p = parseRepoId(repoWithTag)
        if (!p) {
            pxt.log('Unknown GitHub syntax');
            return Promise.resolve<CachedPackage>(undefined);
        }

        if (isRepoBanned(p, config)) {
            pxt.tickEvent("github.download.banned");
            pxt.log('Github repo is banned');
            return Promise.resolve<CachedPackage>(undefined);
        }

        return db.loadPackageAsync(p.fullName, p.tag)
            .then(cached => {
                const dv = upgradedDisablesVariants(config, repoWithTag)
                if (dv) {
                    const cfg = Package.parseAndValidConfig(cached.files[pxt.CONFIG_NAME])
                    if (cfg) {
                        pxt.log(`auto-disable ${dv.join(",")} due to targetconfig entry for ${repoWithTag}`)
                        cfg.disablesVariants = dv
                        cached.files[pxt.CONFIG_NAME] = Package.stringifyConfig(cfg)
                    }
                }
                return cached
            })
    }

    export interface User {
        login: string; // "Microsoft",
        id: number; // 6154722,
        avatar_url: string; // "https://avatars.githubusercontent.com/u/6154722?v=3",
        gravatar_id: string; // "",
        html_url: string; // "https://github.com/microsoft",
        type: string; // "Organization"
        name: string;
        company: string;
    }

    interface Repo {
        id: number;
        name: string; // "pxt-microbit-cppsample",
        full_name: string; // "Microsoft/pxt-microbit-cppsample",
        owner: User;
        private: boolean;
        html_url: string; // "https://github.com/microsoft/pxt-microbit-cppsample",
        description: string; // "Sample C++ extension for PXT/microbit",
        fork: boolean;
        created_at: string; // "2016-05-05T11:18:12Z",
        updated_at: string; // "2016-06-20T02:25:03Z",
        pushed_at: string; // "2016-05-05T11:59:42Z",
        homepage: string; // null,
        size: number; // 4
        stargazers_count: number;
        watchers_count: number;
        forks_count: number;
        open_issues_count: number;
        forks: number;
        open_issues: number;
        watchers: number;
        default_branch: string; // "master",
        score: number; // 6.7371006

        // non-github, added to track search request
        tag?: string;
    }

    interface SearchResults {
        total_count: number;
        incomplete_results: boolean;
        items: Repo[];
    }

    export interface ParsedRepo {
        owner?: string;
        project?: string;
        // owner/name
        fullName: string;
        tag?: string;
        fileName?: string;
    }

    export enum GitRepoStatus {
        Unknown,
        Approved,
        Banned
    }

    export interface GitRepo extends ParsedRepo {
        name: string;
        description: string;
        defaultBranch: string;
        status?: GitRepoStatus;
        updatedAt?: number;
        private?: boolean;
        fork?: boolean;
    }

    export function listUserReposAsync(): Promise<GitRepo[]> {
        const q = `{
  viewer {
    repositories(first: 100, affiliations: [OWNER, COLLABORATOR], orderBy: {field: PUSHED_AT, direction: DESC}) {
      nodes {
        name
        description
        full_name: nameWithOwner
        private: isPrivate
        fork: isFork
        updated_at: updatedAt
        owner {
          login
        }
        defaultBranchRef {
          name
        }
        pxtjson: object(expression: "master:pxt.json") {
          ... on Blob {
            text
          }
        }
        readme: object(expression: "master:README.md") {
          ... on Blob {
            text
          }
        }
      }
    }
  }
}`
        return ghGraphQLQueryAsync(q)
            .then(res => (<any[]>res.data.viewer.repositories.nodes)
                .filter((node: any) => node.pxtjson) // needs a pxt.json file
                .filter((node: any) => {
                    node.default_branch = node.defaultBranchRef.name;
                    const pxtJson = pxt.Package.parseAndValidConfig(node.pxtjson && node.pxtjson.text);
                    const readme = node.readme && node.readme.text;
                    // needs to have a valid pxt.json file
                    if (!pxtJson) return false;
                    // new style of supported annontation
                    if (pxtJson.supportedTargets)
                        return pxtJson.supportedTargets.indexOf(pxt.appTarget.id) > -1;
                    // legacy readme.md annotations
                    return readme && readme.indexOf("PXT/" + pxt.appTarget.id) > -1;
                })
                .map((node: any) => mkRepo(node, null))
            );
    }

    export function createRepoAsync(name: string, description: string, priv?: boolean) {
        return ghPostAsync("https://api.github.com/user/repos", {
            name,
            description,
            private: !!priv,
            has_issues: true, // default
            has_projects: false,
            has_wiki: false,
            allow_rebase_merge: false,
            allow_merge_commit: true,
            delete_branch_on_merge: false // keep branches for naming purposes
        }).then(v => mkRepo(v, null))
    }

    export async function enablePagesAsync(repo: string) {
        // https://developer.github.com/v3/repos/pages/#enable-a-pages-site
        // try read status
        let url: string = undefined;
        try {
            const status = await ghGetJsonAsync(`https://api.github.com/repos/${repo}/pages`) // try to get the pages
            if (status)
                url = status.html_url;
        } catch (e) { }

        // status failed, try enabling pages
        if (!url) {
            // enable pages
            const r = await ghPostAsync(`https://api.github.com/repos/${repo}/pages`, {
                source: {
                    branch: "master",
                    path: ""
                }
            }, {
                "Accept": "application/vnd.github.switcheroo-preview+json"
            });
            url = r.html_url;
        }

        // we have a URL, update project
        if (url) {
            // check if the repo already has a web site
            const rep = await ghGetJsonAsync(`https://api.github.com/repos/${repo}`);
            if (rep && !rep.homepage) {
                try {
                    await ghPostAsync(`https://api.github.com/repos/${repo}`, { "homepage": url }, undefined, "PATCH");
                } catch (e) {
                    // just ignore if fail to update the homepage
                    pxt.tickEvent("github.homepage.error");
                }
            }
        }
    }

    export function repoIconUrl(repo: GitRepo): string {
        if (repo.status != GitRepoStatus.Approved) return undefined;

        return mkRepoIconUrl(repo)
    }

    export function mkRepoIconUrl(repo: ParsedRepo): string {
        return Cloud.cdnApiUrl(`gh/${repo.fullName}/icon`)
    }

    function mkRepo(r: Repo, config: pxt.PackagesConfig, tag?: string): GitRepo {
        if (!r) return undefined;
        const rr: GitRepo = {
            owner: r.owner.login.toLowerCase(),
            fullName: r.full_name.toLowerCase(),
            name: r.name,
            description: r.description,
            defaultBranch: r.default_branch,
            tag: tag,
            updatedAt: Math.round(new Date(r.updated_at).getTime() / 1000),
            fork: r.fork,
            private: r.private,
        }
        rr.status = repoStatus(rr, config);
        return rr;
    }

    export function repoStatus(rr: ParsedRepo, config: pxt.PackagesConfig): GitRepoStatus {
        return isRepoBanned(rr, config) ? GitRepoStatus.Banned
            : isRepoApproved(rr, config) ? GitRepoStatus.Approved
                : GitRepoStatus.Unknown;
    }

    function isOrgBanned(repo: ParsedRepo, config: pxt.PackagesConfig): boolean {
        if (!config) return false; // don't know
        if (!repo || !repo.owner) return true;
        if (config.bannedOrgs
            && config.bannedOrgs.some(org => org.toLowerCase() == repo.owner.toLowerCase()))
            return true;
        return false;
    }

    function isRepoBanned(repo: ParsedRepo, config: pxt.PackagesConfig): boolean {
        if (isOrgBanned(repo, config))
            return true;
        if (!config) return false; // don't know
        if (!repo || !repo.fullName) return true;
        if (config.bannedRepos
            && config.bannedRepos.some(fn => fn.toLowerCase() == repo.fullName.toLowerCase()))
            return true;
        return false;
    }

    function isOrgApproved(repo: ParsedRepo, config: pxt.PackagesConfig): boolean {
        if (!repo || !config) return false;
        if (repo.owner
            && config.approvedOrgs
            && config.approvedOrgs.some(org => org.toLowerCase() == repo.owner.toLowerCase()))
            return true;
        return false;
    }

    function isRepoApproved(repo: ParsedRepo, config: pxt.PackagesConfig): boolean {
        if (isOrgApproved(repo, config))
            return true;

        if (!repo || !config) return false;
        if (repo.fullName
            && config.approvedRepos
            && config.approvedRepos.some(fn => fn.toLowerCase() == repo.fullName.toLowerCase()))
            return true;
        return false;
    }

    export async function repoAsync(id: string, config: pxt.PackagesConfig): Promise<GitRepo> {
        const rid = parseRepoId(id);
        if (!rid)
            return undefined;
        const status = repoStatus(rid, config);
        if (status == GitRepoStatus.Banned)
            return undefined;

        // always try proxy first
        if (hasProxy()) {
            try {
                return await proxyRepoAsync(rid, status);
            } catch (e) {
                ghProxyHandleException(e);
            }
        }
        // try github apis
        const r = await ghGetJsonAsync("https://api.github.com/repos/" + rid.fullName)
        return mkRepo(r, config, rid.tag);
    }

    function proxyRepoAsync(rid: ParsedRepo, status: GitRepoStatus): Promise<GitRepo> {
        // always use proxy
        return ghProxyJsonAsync(`${rid.fullName}`)
            .then(meta => {
                if (!meta) return undefined;
                return {
                    github: true,
                    owner: rid.owner,
                    fullName: rid.fullName,
                    name: meta.name,
                    description: meta.description,
                    defaultBranch: "master",
                    tag: rid.tag,
                    status
                };
            }).catch(err => {
                pxt.reportException(err);
                return undefined;
            });
    }

    export function searchAsync(query: string, config: pxt.PackagesConfig): Promise<GitRepo[]> {
        if (!config) return Promise.resolve([]);

        let repos = query.split('|').map(parseRepoUrl).filter(repo => !!repo);
        if (repos.length > 0)
            return Promise.all(repos.map(id => repoAsync(id.path, config)))
                .then(rs => rs.filter(r => r && r.status != GitRepoStatus.Banned)); // allow deep links to github repos

        let fetch = () => U.httpGetJsonAsync(`${pxt.Cloud.apiRoot}ghsearch/${appTarget.id}/${appTarget.platformid || appTarget.id}?q=`
            + encodeURIComponent(query))

        return fetch()
            .then((rs: SearchResults) =>
                rs.items.map(item => mkRepo(item, config))
                    .filter(r => r.status == GitRepoStatus.Approved || (config.allowUnapproved && r.status == GitRepoStatus.Unknown))
                    // don't return the target itself!
                    .filter(r => !pxt.appTarget.appTheme.githubUrl || `https://github.com/${r.fullName}` != pxt.appTarget.appTheme.githubUrl.toLowerCase())
            )
            .catch(err => []); // offline
    }

    function parseRepoUrl(url: string): { repo: string; tag?: string; path?: string; } {
        if (!url) return undefined;
        url = url.trim()
        // match github.com urls
        let m = /^((https:\/\/)?github.com\/)?([^/]+\/[^/#]+)\/?(#(\w+))?$/i.exec(url);
        if (m) {
            const r: { repo: string; tag?: string; path?: string; } = {
                repo: m ? m[3].toLowerCase() : null,
                tag: m ? m[5] : null
            }
            r.path = r.repo + (r.tag ? '#' + r.tag : '');
            return r;
        }
        return undefined;
    }

    // parse https://github.com/[company]/[project](/filepath)(#tag)
    export function parseRepoId(repo: string): ParsedRepo {
        if (!repo) return undefined;
        repo = repo.trim();

        // convert github pages into github repo
        const mgh = /^https:\/\/([^./#]+)\.github\.io\/([^/#]+)\/?$/i.exec(repo);
        if (mgh)
            repo = `github:${mgh[1]}/${mgh[2]}`;

        repo = repo.replace(/^github:/i, "")
        repo = repo.replace(/^https:\/\/github\.com\//i, "")
        repo = repo.replace(/\.git\b/i, "")

        const m = /^([^#\/:]+)\/([^#\/:]+)(\/([^#]+))?(#([^\/:]*))?$/.exec(repo);
        if (!m)
            return undefined;
        const owner = m[1];
        const project = m[2];
        const fileName = m[4];
        const tag = m[6];
        return {
            owner,
            project,
            fullName: `${owner}/${project}`,
            tag,
            fileName
        }
    }

    export function toGithubDependencyPath(id: ParsedRepo): string {
        let r = "github:" + id.fullName;
        if (id.tag) r += "#" + id.tag;
        return r;
    }

    export function isGithubId(id: string) {
        if (!id)
            return false
        return id.slice(0, 7) == "github:"
    }

    export function stringifyRepo(p: ParsedRepo) {
        return p ? "github:" + p.fullName.toLowerCase() + "#" + (p.tag || "master") : undefined;
    }

    export function normalizeRepoId(id: string) {
        const gid = parseRepoId(id);
        if (!gid) return undefined;
        gid.tag = gid.tag || "master";
        return stringifyRepo(gid);
    }

    function upgradeRule(cfg: PackagesConfig, id: string) {
        if (!cfg || !cfg.upgrades)
            return null
        const parsed = parseRepoId(id)
        if (!parsed) return null
        return U.lookup(cfg.upgrades, parsed.fullName.toLowerCase())
    }

    function upgradedDisablesVariants(cfg: PackagesConfig, id: string) {
        const upgr = upgradeRule(cfg, id)
        const m = /^dv:(.*)/.exec(upgr)
        if (m) {
            const disabled = m[1].split(/,/)
            if (disabled.some(d => !/^\w+$/.test(d)))
                return null
            return disabled
        }
        return null
    }

    export function upgradedPackageReference(cfg: PackagesConfig, id: string) {
        const upgr = upgradeRule(cfg, id)
        if (!upgr)
            return null

        const m = /^min:(.*)/.exec(upgr)
        if (m && pxt.semver.parse(m[1])) {
            const parsed = parseRepoId(id)
            const minV = pxt.semver.parse(m[1])
            const currV = pxt.semver.parse(parsed.tag)
            if (currV && pxt.semver.cmp(currV, minV) < 0) {
                parsed.tag = m[1]
                pxt.debug(`upgrading ${id} to ${m[1]}`)
                return stringifyRepo(parsed)
            } else {
                if (!currV)
                    pxt.log(`not upgrading ${id} - cannot parse version`)
                return null
            }
        } else {
            // check if the rule looks valid at all
            if (!upgradedDisablesVariants(cfg, id))
                pxt.log(`invalid upgrade rule: ${id} -> ${upgr}`)
        }

        return id
    }

    export function upgradedPackageId(cfg: PackagesConfig, id: string) {
        const dv = upgradedDisablesVariants(cfg, id)
        if (dv)
            return id + "?dv=" + dv.join(",")
        return id
    }

    export function latestVersionAsync(path: string, config: PackagesConfig, useProxy?: boolean): Promise<string> {
        let parsed = parseRepoId(path)

        if (!parsed) return Promise.resolve<string>(null);

        return repoAsync(parsed.fullName, config)
            .then(scr => {
                if (!scr) return undefined;
                return listRefsExtAsync(scr.fullName, "tags", useProxy)
                    .then(refsRes => {
                        let tags = Object.keys(refsRes.refs)
                        // only look for semver tags
                        tags = pxt.semver.sortLatestTags(tags);

                        // check if the version has been frozen for this release
                        const targetVersion = pxt.appTarget.versions && pxt.semver.tryParse(pxt.appTarget.versions.target);
                        if (targetVersion && config.releases && config.releases["v" + targetVersion.major]) {
                            const release = config.releases["v" + targetVersion.major]
                                .map(repo => pxt.github.parseRepoId(repo))
                                .filter(repo => repo && repo.fullName.toLowerCase() == parsed.fullName.toLowerCase())
                            [0];
                            if (release) {
                                // this repo is frozen to a particular tag for this target
                                if (tags.some(t => t == release.tag)) { // tag still exists!!!
                                    pxt.debug(`approved release ${release.fullName}#${release.tag} for v${targetVersion.major}`)
                                    return Promise.resolve(release.tag);
                                } else {
                                    // so the package was snapped to a particular tag but the tag does not exist anymore
                                    pxt.reportError(`packages`, `approved release ${release.fullName}#${release.tag} for v${targetVersion.major} not found anymore`, { repo: scr.fullName })
                                    // in this case, we keep going, we might be lucky and the current version of the package might still load
                                }
                            }
                        }

                        if (tags[0])
                            return Promise.resolve(tags[0])
                        else
                            return refsRes.head || tagToShaAsync(scr.fullName, scr.defaultBranch)
                    })
            });
    }

    export interface GitJson {
        repo: string;
        commit: pxt.github.Commit;
        isFork?: boolean;
        mergeSha?: string;
    }

    export const GIT_JSON = ".git.json"
    const GRAPHQL_URL = "https://api.github.com/graphql";

    export function lookupFile(commit: pxt.github.Commit, path: string) {
        if (!commit)
            return null
        return commit.tree.tree.find(e => e.path == path)
    }

    /**
     * Executes a GraphQL query against GitHub v4 api
     * @param query
     */
    export function ghGraphQLQueryAsync(query: string): Promise<any> {
        const payload = JSON.stringify({
            query
        })
        return ghPostAsync(GRAPHQL_URL, payload);
    }

    export interface PullRequest {
        number: number;
        url?: string;
        title?: string;
        base?: string;
        isDraft?: boolean;
        state?: "OPEN" | "CLOSED" | "MERGED";
        mergeable?: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
    }

    /**
     * Finds the first PR associated with a branch
     * @param reponame
     * @param headName
     */
    export function findPRNumberforBranchAsync(reponame: string, headName: string): Promise<PullRequest> {
        const repoId = parseRepoId(reponame);
        const query =
            `
{
    repository(owner: ${JSON.stringify(repoId.owner)}, name: ${JSON.stringify(repoId.project)}) {
        pullRequests(last: 1, states: [OPEN, MERGED], headRefName: ${JSON.stringify(headName)}) {
            edges {
                node {
                    number
                    state
                    mergeable
                    baseRefName
                    url
                    isDraft
                }
            }
        }
    }
}
`

        /*
        {
          "data": {
            "repository": {
              "pullRequests": {
                "edges": [
                  {
                    "node": {
                      "title": "use close icon instead of cancel",
                      "number": 6324
                    }
                  }
                ]
              }
            }
          }
        }*/

        return ghGraphQLQueryAsync(query)
            .then<pxt.github.PullRequest>(resp => {
                const edge = resp.data.repository.pullRequests.edges[0]
                if (edge && edge.node) {
                    const node = edge.node;
                    return {
                        number: node.number,
                        mergeable: node.mergeable,
                        state: node.state,
                        title: node.title,
                        url: node.url,
                        base: node.baseRefName
                    }
                }
                return {
                    number: -1
                }
            })
    }

    export interface GitHubPagesStatus {
        status: null | "queued" | "building" | "built" | "errored"
        html_url?: string;
        source?: {
            branch: string;
            directory: string;
        }
    }

    export function getPagesStatusAsync(repoPath: string): Promise<GitHubPagesStatus> {
        return ghGetJsonAsync(`https://api.github.com/repos/${repoPath}/pages`)
            .catch(e => ({
                status: null
            }))
    }
}