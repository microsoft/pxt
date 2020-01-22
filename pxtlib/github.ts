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

    export interface Commit extends SHAObject {
        author: UserInfo;
        committer: UserInfo;
        message: string; // "added readme, because im a good github citizen",
        tree: Tree; // tree
        parents: SHAObject[]; // commit[]
        tag?: string;
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

    export function useProxy() {
        if (forceProxy)
            return true;
        if (U.isNodeJS)
            return false // bypass proxy for CLI
        if (token)
            return false
        if (pxt.appTarget && pxt.appTarget.cloud && pxt.appTarget.cloud.noGithubProxy)
            return false // target requests no proxy
        return true
    }

    let isPrivateRepoCache: pxt.Map<boolean> = {};

    export interface CachedPackage {
        files: Map<string>;
    }

    // caching
    export interface IGithubDb {
        loadConfigAsync(repopath: string, tag: string): Promise<pxt.PackageConfig>;
        loadPackageAsync(repopath: string, tag: string): Promise<CachedPackage>;
    }

    function ghRequestAsync(opts: U.HttpRequestOptions) {
        if (token) {
            if (opts.url.indexOf('?') > 0)
                opts.url += "&"
            else
                opts.url += "?"
            opts.url += "access_token=" + token
            opts.url += "&anti_cache=" + Math.random()
            // Token in headers doesn't work with CORS, especially for githubusercontent.com
            //if (!opts.headers) opts.headers = {}
            //opts.headers['Authorization'] = `token ${token}`
        }
        return U.requestAsync(opts)
    }

    function ghGetJsonAsync(url: string) {
        return ghRequestAsync({ url }).then(resp => resp.json)
    }

    function ghGetTextAsync(url: string) {
        return ghRequestAsync({ url }).then(resp => resp.text)
    }

    function ghProxyJsonAsync(path: string) {
        return Cloud.apiRequestWithCdnAsync({ url: "gh/" + path }).then(r => r.json)
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

        loadConfigAsync(repopath: string, tag: string): Promise<pxt.PackageConfig> {
            if (!tag) tag = "master";

            // cache lookup
            const key = `${repopath}/${tag}`;
            let res = this.configs[key];
            if (res) {
                pxt.debug(`github cache ${repopath}/${tag}/config`);
                return Promise.resolve(U.clone(res));
            }

            const cacheConfig = (v: string) => {
                const cfg = JSON.parse(v) as pxt.PackageConfig;
                this.configs[key] = cfg;
                return U.clone(cfg);
            }

            // download and cache
            if (useProxy()) {
                // this is a bit wasteful, we just need pxt.json and download everything
                return this.proxyLoadPackageAsync(repopath, tag)
                    .then(v => cacheConfig(v.files[pxt.CONFIG_NAME]))
            }
            return downloadTextAsync(repopath, tag, pxt.CONFIG_NAME)
                .then(cfg => cacheConfig(cfg));
        }

        loadPackageAsync(repopath: string, tag: string): Promise<CachedPackage> {
            if (!tag) tag = "master";

            if (useProxy())
                return this.proxyLoadPackageAsync(repopath, tag).then(v => U.clone(v));

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
        // raw.githubusercontent.com doesn't accept ?access_toke=... and has wrong CORS settings
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
        return ghGetJsonAsync("https://api.github.com/user");
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

    export function mergeAsync(repopath: string, branch: string, commitid: string) {
        return ghRequestAsync({
            url: "https://api.github.com/repos/" + repopath + "/merges",
            method: "POST",
            allowHttpErrors: true,
            data: {
                base: branch,
                head: commitid
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

    export function listRefsAsync(repopath: string, namespace = "tags"): Promise<string[]> {
        return listRefsExtAsync(repopath, namespace)
            .then(res => Object.keys(res.refs))
    }

    export function listRefsExtAsync(repopath: string, namespace = "tags"): Promise<RefsResult> {
        let head: string = null
        const fetch = !useProxy() ?
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

        return db.loadPackageAsync(p.fullName, p.tag);
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

    export function listUserReposAsync() {
        return ghGetJsonAsync("https://api.github.com/user/repos?per_page=200&sort=updated&affiliation=owner,collaborator")
            .then((res: Repo[]) => res.map(r => mkRepo(r, null)))
    }

    export function createRepoAsync(name: string, description: string, priv?: boolean) {
        return ghPostAsync("https://api.github.com/user/repos", {
            name,
            description,
            private: !!priv,
            has_issues: true, // default
            has_projects: false,
            has_wiki: false,
            allow_rebase_merge: false
        }).then(v => mkRepo(v, null))
    }

    export function enablePagesAsync(repo: string) {
        // https://developer.github.com/v3/repos/pages/#enable-a-pages-site
        return ghPostAsync(`https://api.github.com/repos/${repo}/pages`, {
            source: {
                branch: "master",
                path: ""
          }
        }, {
            "Accept": "application/vnd.github.switcheroo-preview+json"
        }).then(r => {
            const url = r.html_url;
            // update repo home page
            return ghPostAsync(`https://api.github.com/repos/${repo}`,
            {
                "homepage": url
            }, undefined, "PATCH");
        });
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

    export function repoAsync(id: string, config: pxt.PackagesConfig): Promise<GitRepo> {
        const rid = parseRepoId(id);
        const status = repoStatus(rid, config);
        if (status == GitRepoStatus.Banned)
            return Promise.resolve<GitRepo>(undefined);

        if (!useProxy())
            return ghGetJsonAsync("https://api.github.com/repos/" + rid.fullName)
                .then((r: Repo) => mkRepo(r, config, rid.tag));

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

        let fetch = () => useProxy()
            ? U.httpGetJsonAsync(`${pxt.Cloud.apiRoot}ghsearch/${appTarget.id}/${appTarget.platformid || appTarget.id}?q=`
                + encodeURIComponent(query))
            : ghGetJsonAsync("https://api.github.com/search/repositories?q="
                + encodeURIComponent(query + ` in:name,description,readme "for PXT/${appTarget.platformid || appTarget.id}"`))

        return fetch()
            .then((rs: SearchResults) =>
                rs.items.map(item => mkRepo(item, config))
                    .filter(r => r.status == GitRepoStatus.Approved || (config.allowUnapproved && r.status == GitRepoStatus.Unknown))
                    // don't return the target itself!
                    .filter(r => !pxt.appTarget.appTheme.githubUrl || `https://github.com/${r.fullName}` != pxt.appTarget.appTheme.githubUrl.toLowerCase())
            )
            .catch(err => []); // offline
    }

    export function parseRepoUrl(url: string): { repo: string; tag?: string; path?: string; } {
        if (!url) return undefined;

        let m = /^((https:\/\/)?github.com\/)?([^/]+\/[^/#]+)\/?(#(\w+))?$/i.exec(url.trim());
        if (!m) return undefined;

        let r: { repo: string; tag?: string; path?: string; } = {
            repo: m ? m[3].toLowerCase() : null,
            tag: m ? m[5] : null
        }
        r.path = r.repo + (r.tag ? '#' + r.tag : '');
        return r;
    }

    // parse https://github.com/[company]/[project](/filepath)(#tag)
    export function parseRepoId(repo: string): ParsedRepo {
        if (!repo) return undefined;

        repo = repo.replace(/^github:/i, "")
        repo = repo.replace(/^https:\/\/github\.com\//i, "")
        repo = repo.replace(/\.git\b/i, "")

        let m = /([^#]+)(#(.*))?/.exec(repo)
        const nameAndFile = m ? m[1] : null;
        const tag = m ? m[3] : null;
        let owner: string;
        let project: string;
        let fullName: string;
        let fileName: string;
        if (m) {
            const parts = nameAndFile.split('/');
            owner = parts[0];
            project = parts[1];
            fullName = `${owner}/${project}`;
            if (parts.length > 2)
                fileName = parts.slice(2).join('/');
        } else {
            fullName = repo.toLowerCase();
        }
        return {
            owner,
            project,
            fullName,
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
        gid.tag = gid.tag || "master";
        return stringifyRepo(gid);
    }

    export function latestVersionAsync(path: string, config: PackagesConfig): Promise<string> {
        let parsed = parseRepoId(path)

        if (!parsed) return Promise.resolve<string>(null);

        return repoAsync(parsed.fullName, config)
            .then(scr => {
                if (!scr) return undefined;
                return listRefsExtAsync(scr.fullName, "tags")
                    .then(refsRes => {
                        let tags = Object.keys(refsRes.refs)
                        // only look for semver tags
                        tags = pxt.semver.sortLatestTags(tags);

                        // check if the version has been frozen for this release
                        const targetVersion = pxt.appTarget.versions && pxt.semver.tryParse(pxt.appTarget.versions.target);
                        if (targetVersion && config.releases && config.releases["v" + targetVersion.major]) {
                            const release = config.releases["v" + targetVersion.major]
                                .map(repo => pxt.github.parseRepoId(repo))
                                .filter(repo => repo.fullName.toLowerCase() == parsed.fullName.toLowerCase())
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
    }

    export const GIT_JSON = ".git.json"

    /*
    Constant MAX ∈ [0,M+N]
    Var V: Array [− MAX .. MAX] of Integer
    V[1]←0
    For D←0 to MAX Do
        For k ← −D to D in steps of 2 Do 
            If k=−D or k≠D and V[k−1]<V[k+1] Then
                x ← V[k+1] 
            Else
                x ← V[k−1]+1 
            y←x−k
            While x<N and y<M and a[x+1] =b[y+1] Do 
                (x,y)←(x+1,y+1) 
            V[k]←x
            If x≥N and y≥M Then
                Length of an SES is D
                Stop
    */

    type UArray = Uint32Array | Uint16Array

    function toLines(file: string) {
        return file ? file.split(/\r?\n/) : []
    }

    export interface DiffOptions {
        context?: number; // lines of context; defaults to 3
        ignoreWhitespace?: boolean;
        maxDiffSize?: number; // defaults to 1024
    }

    // based on An O(ND) Difference Algorithm and Its Variations by EUGENE W. MYERS
    export function diff(fileA: string, fileB: string, options: DiffOptions = {}) {
        if (options.ignoreWhitespace) {
            fileA = fileA.replace(/[\r\n]+$/, "")
            fileB = fileB.replace(/[\r\n]+$/, "")
        }

        const a = toLines(fileA)
        const b = toLines(fileB)

        const MAX = Math.min(options.maxDiffSize || 1024, a.length + b.length)
        if (MAX == 0) // nothing to diff
            return [];
        const ctor = a.length > 0xfff0 ? Uint32Array : Uint16Array

        const idxmap: pxt.Map<number> = {}
        let curridx = 0
        const aidx = mkidx(a), bidx = mkidx(b)

        function mkidx(strings: string[]) {
            const idxarr = new ctor(strings.length)
            let i = 0
            for (let e of strings) {
                if (options.ignoreWhitespace)
                    e = e.replace(/\s+$/g, "").replace(/^\s+/g, ''); // only ignore start/end of lines
                if (idxmap.hasOwnProperty(e))
                    idxarr[i] = idxmap[e]
                else {
                    ++curridx
                    idxarr[i] = curridx
                    idxmap[e] = curridx
                }
                i++
            }
            return idxarr
        }

        const V = new ctor(2 * MAX + 1)
        let diffLen = -1
        for (let D = 0; D <= MAX; D++) {
            if (computeFor(D, V) != null) {
                diffLen = D
            }
        }

        if (diffLen == -1)
            return null // diffLen > MAX

        const trace: UArray[] = []
        let endpoint: number = null
        for (let D = 0; D <= diffLen; D++) {
            const V = trace.length ? trace[trace.length - 1].slice(0) : new ctor(2 * diffLen + 1)
            trace.push(V)
            endpoint = computeFor(D, V)
            if (endpoint != null)
                break
        }

        const diff: string[] = []
        let k = endpoint
        for (let D = trace.length - 1; D >= 0; D--) {
            const V = trace[D]
            let x = 0
            let nextK = 0
            if (k == -D || (k != D && V[MAX + k - 1] < V[MAX + k + 1])) {
                nextK = k + 1
                x = V[MAX + nextK]
            } else {
                nextK = k - 1
                x = V[MAX + nextK] + 1
            }
            let y = x - k
            const snakeLen = V[MAX + k] - x
            for (let i = snakeLen - 1; i >= 0; --i)
                diff.push("  " + a[x + i])

            if (nextK == k - 1) {
                diff.push("- " + a[x - 1])
            } else {
                if (y > 0)
                    diff.push("+ " + b[y - 1])
            }
            k = nextK
        }
        diff.reverse()

        if (options.context == Infinity)
            return diff

        let aline = 1, bline = 1, idx = 0
        const shortDiff: string[] = []
        const context = options.context || 3
        while (idx < diff.length) {
            let nextIdx = idx
            while (nextIdx < diff.length && diff[nextIdx][0] == " ")
                nextIdx++
            if (nextIdx == diff.length)
                break
            const startIdx = nextIdx - context
            const skip = startIdx - idx
            if (skip > 0) {
                aline += skip
                bline += skip
                idx = startIdx
            }
            const hdPos = shortDiff.length
            const aline0 = aline, bline0 = bline
            shortDiff.push("@@") // patched below

            let endIdx = idx
            let numCtx = 0
            while (endIdx < diff.length) {
                if (diff[endIdx][0] == " ") {
                    numCtx++
                    if (numCtx > context * 2 + 2) {
                        endIdx -= context + 2
                        break
                    }
                } else {
                    numCtx = 0
                }
                endIdx++
            }

            while (idx < endIdx) {
                shortDiff.push(diff[idx])
                const c = diff[idx][0]
                switch (c) {
                    case "-": aline++; break;
                    case "+": bline++; break;
                    case " ": aline++; bline++; break;
                }
                idx++
            }
            shortDiff[hdPos] = `@@ -${aline0},${aline - aline0} +${bline0},${bline - bline0} @@`
        }

        return shortDiff

        function computeFor(D: number, V: UArray) {
            for (let k = -D; k <= D; k += 2) {
                let x = 0
                if (k == -D || (k != D && V[MAX + k - 1] < V[MAX + k + 1]))
                    x = V[MAX + k + 1]
                else
                    x = V[MAX + k - 1] + 1
                let y = x - k
                while (x < aidx.length && y < bidx.length && aidx[x] == bidx[y]) {
                    x++
                    y++
                }
                V[MAX + k] = x
                if (x >= aidx.length && y >= bidx.length) {
                    return k
                }
            }
            return null
        }
    }

    // based on "A Formal Investigation of Diff3" by Sanjeev Khanna, Keshav Kunal, and Benjamin C. Pierce
    export function diff3(fileA: string, fileO: string, fileB: string,
        lblA: string, lblB: string) {
        const ma = computeMatch(fileA)
        const mb = computeMatch(fileB)

        if (!ma || !mb) // diff failed, can't merge
            return undefined;

        const fa = toLines(fileA)
        const fb = toLines(fileB)
        let numConflicts = 0

        let r: string[] = []
        let la = 0, lb = 0
        for (let i = 0; i < ma.length - 1;) {
            if (ma[i] == la && mb[i] == lb) {
                r.push(fa[la])
                la++
                lb++
                i++
            } else {
                let aSame = true
                let bSame = true
                let j = i
                while (j < ma.length) {
                    if (ma[j] != la + j - i)
                        aSame = false
                    if (mb[j] != lb + j - i)
                        bSame = false
                    if (ma[j] != null && mb[j] != null)
                        break
                    j++
                }
                U.assert(j < ma.length)
                if (aSame) {
                    while (lb < mb[j])
                        r.push(fb[lb++])
                } else if (bSame) {
                    while (la < ma[j])
                        r.push(fa[la++])
                } else if (fa.slice(la, ma[j]).join("\n") == fb.slice(lb, mb[j]).join("\n")) {
                    // false conflict - both are the same
                    while (la < ma[j])
                        r.push(fa[la++])
                } else {
                    numConflicts++
                    r.push("<<<<<<< " + lblA)
                    while (la < ma[j])
                        r.push(fa[la++])
                    r.push("=======")
                    while (lb < mb[j])
                        r.push(fb[lb++])
                    r.push(">>>>>>> " + lblB)
                }
                i = j
                la = ma[j]
                lb = mb[j]
            }
        }

        return { merged: r.join("\n"), numConflicts }

        function computeMatch(fileA: string) {
            const da = pxt.github.diff(fileO, fileA, { context: Infinity })
            if (!da)
                return undefined;
            const ma: number[] = []

            let aidx = 0
            let oidx = 0

            // console.log(da)
            for (let l of da) {
                if (l[0] == "+") {
                    aidx++
                } else if (l[0] == "-") {
                    ma[oidx] = null
                    oidx++
                } else if (l[0] == " ") {
                    ma[oidx] = aidx
                    aidx++
                    oidx++
                } else {
                    U.oops()
                }
            }

            ma.push(aidx + 1) // terminator

            return ma
        }
    }

    export function resolveMergeConflictMarker(content: string, startMarkerLine: number, local: boolean, remote: boolean): string {
        let lines = toLines(content);
        let startLine = startMarkerLine;
        while (startLine < lines.length) {
            if (/^<<<<<<<[^<]/.test(lines[startLine])) {
                break;
            }
            startLine++;
        }
        let middleLine = startLine + 1;
        while (middleLine < lines.length) {
            if (/^=======$/.test(lines[middleLine]))
                break;
            middleLine++;
        }
        let endLine = middleLine + 1;
        while (endLine < lines.length) {
            if (/^>>>>>>>[^>]/.test(lines[endLine])) {
                break;
            }
            endLine++;
        }
        if (endLine >= lines.length) {
            // no match?
            pxt.debug(`diff marker mistmatch: ${lines.length} -> ${startLine} ${middleLine} ${endLine}`)
            return content;
        }

        // remove locals
        lines[startLine] = undefined;
        lines[middleLine] = undefined;
        lines[endLine] = undefined;
        if (!local)
            for (let i = startLine; i <= middleLine; ++i)
                lines[i] = undefined;
        if (!remote)
            for (let i = middleLine; i <= endLine; ++i)
                lines[i] = undefined;

        return lines.filter(line => line !== undefined).join("\n");
    }

    /**
     * A naive 3way merge for pxt.json files. It can mostly handle conflicts when adding/removing files concurrently.
     * - highest version number if kept
     * - current preferred editor is kept
     * - conjection of public flag
     * - files list is merged so that added files are kept and deleted files are removed
     * @param configA 
     * @param configO 
     * @param configB 
     */
    export function mergeDiff3Config(configA: string, configO: string, configB: string): string {
        let jsonA: any = pxt.Util.jsonTryParse(configA); //  as pxt.PackageConfig
        let jsonO: any = pxt.Util.jsonTryParse(configO);
        let jsonB: any = pxt.Util.jsonTryParse(configB);
        // A is good, B destroyed
        if (jsonA && !jsonB)
            return configA; // keep A

        // A destroyed, B good, use B or O
        if (!jsonA)
            return configB || configO;

        // O is destroyed, B isnt, use B as O
        if (!jsonO && jsonB)
            jsonO = jsonB;

        // final check
        if (!jsonA || !jsonO || !jsonB)
            return undefined;

        delete jsonA.installedVersion;
        delete jsonO.installedVersion;
        delete jsonB.installedVersion;

        const r: any = {} as pxt.PackageConfig;

        const keys = pxt.U.unique(Object.keys(jsonO).concat(Object.keys(jsonA)).concat(Object.keys(jsonB)), l => l);
        for (const key of keys) {
            const vA = jsonA[key];
            const vO = jsonO[key];
            const vB = jsonB[key];
            const svA = JSON.stringify(vA);
            const svB = JSON.stringify(vB);
            if (svA == svB) { // same serialized keys
                if (vA !== undefined)
                    r[key] = vA;
            } else {
                switch (key) {
                    case "name":
                        r[key] = mergeName(vA, vO, vB);
                        break;
                    case "version": // pick highest version
                        r[key] = pxt.semver.strcmp(vA, vB) > 0 ? vA : vB;
                        break;
                    case "preferredEditor":
                        r[key] = vA; // keep current one
                        break;
                    case "public":
                        r[key] = vA && vB;
                        break;
                    case "files":
                    case "testFiles": {// merge file arrays
                        const m = mergeFiles(vA || [], vO || [], vB || []);
                        if (!m)
                            return undefined;
                        r[key] = m.length ? m : undefined;
                        break;
                    }
                    case "dependencies":
                    case "testDependencies": {
                        const m = mergeDependencies(vA || {}, vO || {}, vB || {});
                        if (Object.keys(m).length)
                            return undefined;
                        r[key] = m;
                        break;
                    }
                    case "description":
                        if (vA && !vB) r[key] = vA; // new description
                        else if (!vA && vB) r[key] = vB;
                        else return undefined;
                        break;
                    default:
                        return undefined;
                }
            }
        }
        return pxt.Package.stringifyConfig(r);

        function mergeName(fA: string, fO: string, fB: string): string {
            if (fA == fO) return fB;
            if (fB == fO) return fA;
            if (fA == lf("Untitled")) return fB;
            return fA;
        }

        function mergeFiles(fA: string[], fO: string[], fB: string[]): string[] {
            const r: string[] = [];
            const fkeys = pxt.U.unique(fO.concat(fA).concat(fB), l => l);
            for (const fkey of fkeys) {
                const mA = fA.indexOf(fkey) > -1;
                const mB = fB.indexOf(fkey) > -1;
                const mO = fO.indexOf(fkey) > -1;
                if (mA == mB) { // both have or have nots
                    if (mA) // key is in set
                        r.push(fkey);
                } else { // conflict
                    if (mB == mO) { // mB not changed, false conflict
                        if (mA) // item added
                            r.push(fkey);
                    } else { // mA == mO, conflict
                        if (mB) // not deleted by A
                            r.push(fkey);
                    }
                }
            }
            return r;
        }

        function mergeDependencies(fA: pxt.Map<string>, fO: pxt.Map<string>, fB: pxt.Map<string>): pxt.Map<string> {
            const r: pxt.Map<string> = {};
            const fkeys = pxt.U.unique(Object.keys(fO).concat(Object.keys(fA)).concat(Object.keys(fB)), l => l);
            for (const fkey of fkeys) {
                const mA = fA[fkey];
                const mB = fB[fkey];
                const mO = fO[fkey]
                if (mA == mB) { // both have or have nots
                    if (mA) // key is in set
                        r[fkey] = mA;
                } else { // conflict
                    // check if it is a version change in github reference
                    const ghA = parseRepoId(mA)
                    const ghB = parseRepoId(mB)
                    if (ghA && ghB
                        && pxt.semver.tryParse(ghA.tag)
                        && pxt.semver.tryParse(ghB.tag)
                        && ghA.owner && ghA.project
                        && ghA.owner == ghB.owner
                        && ghA.project == ghB.project) {
                        const newtag = pxt.semver.strcmp(ghA.tag, ghB.tag) > 0
                            ? ghA.tag : ghB.tag;
                        r[fkey] = `github:${ghA.owner}/${ghA.project}#${newtag}`
                    } else if (mB == mO) { // mB not changed, false conflict
                        if (mA) // item added
                            r[fkey] = mA;
                    } else { // mA == mO, conflict
                        if (mB) // not deleted by A
                            r[fkey] = mB;
                    }
                }
            }
            return r;
        }
    }

    export function hasMergeConflictMarker(content: string) {
        return content && /^(<<<<<<<[^<]|>>>>>>>[^>])/m.test(content);
    }

    export function lookupFile(commit: pxt.github.Commit, path: string) {
        if (!commit)
            return null
        return commit.tree.tree.find(e => e.path == path)
    }

    export function reconstructConfig(files: pxt.Map<string>, commit: pxt.github.Commit, tp: pxt.ProjectTemplate) {
        let dependencies: pxt.Map<string> = {};
        // grab files from commit
        let commitFiles = commit.tree.tree.map(f => f.path)
            .filter(f => /\.(ts|blocks|md|jres|asm|json)$/.test(f))
            .filter(f => f != pxt.CONFIG_NAME);
        // if no available files, include the files from the template
        if (!commitFiles.find(f => /\.ts$/.test(f))) {
            tp.config.files.filter(f => commitFiles.indexOf(f) < 0)
                .forEach(f => {
                    commitFiles.push(f);
                    files[f] = tp.files[f];
                })
            pxt.Util.jsonCopyFrom(dependencies, tp.config.dependencies);
        }

        // include corepkg if no dependencies
        if (!Object.keys(dependencies).length)
            dependencies[pxt.appTarget.corepkg] = "*";

        // yay, we have a new cfg
        const cfg: pxt.PackageConfig = {
            name: "",
            files: commitFiles,
            dependencies,
            preferredEditor: commitFiles.find(f => /.blocks$/.test(f)) ? pxt.BLOCKS_PROJECT_NAME : pxt.JAVASCRIPT_PROJECT_NAME
        };
        return cfg;
    }

    /**
     * Executes a GraphQL query against GitHub v4 api
     * @param query 
     */
    export function ghGraphQLQueryAsync(query: string): Promise<any> {
        const payload = JSON.stringify({
            query
        })
        return ghPostAsync("https://api.github.com/graphql", payload);
    }

    export interface PullRequest {
        number: number;
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
                        state: node.state
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