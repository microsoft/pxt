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

    // [Monolith] GitHub API 요청은 원본 makecode 서버로 라우팅
    // 자체 서버(class rails)에는 GitHub 프록시가 없으므로 원본 서버 사용
    // CORS: makecode.com에서 허용됨
    const MAKECODE_API_ROOT = "https://www.makecode.com/api/";

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

    export let handleGithubNetworkError: (opts: U.HttpRequestOptions, e: any) => boolean;

    const isPrivateRepoCache: pxt.Map<boolean> = {};

    export interface CachedPackage {
        files: Map<string>;
    }

    // caching
    export interface IGithubDb {
        latestVersionAsync(repopath: string, config: PackagesConfig): Promise<string>;
        loadConfigAsync(repopath: string, tag: string): Promise<pxt.PackageConfig>;
        loadPackageAsync(repopath: string, tag: string): Promise<CachedPackage>;
    }

    function ghRequestAsync(options: U.HttpRequestOptions) {
        options.method = options.method ?? "GET";
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
                    // defeat browser cache when signed in
                    opts.url = pxt.BrowserUtils.cacheBustingUrl(opts.url);
                    opts.headers['Authorization'] = `token ${token}`
                }
            }
            opts.allowHttpErrors = opts.allowHttpErrors ?? false;
            return U.requestAsync(opts)
                .catch(e => {
                    pxt.tickEvent("github.error", { statusCode: e.statusCode });
                    if (handleGithubNetworkError) {
                        const retry = handleGithubNetworkError(opts, e)
                        // retry if it may fix the issue
                        if (retry) return workAsync(false);
                    }
                    throw e;
                });
        }
    }

    function ghGetJsonAsync(url: string) {
        return ghRequestAsync({ url, method: "GET" }).then(resp => resp.json)
    }

    function ghProxyWithCdnJsonAsync(path: string) {
        // [Monolith] GitHub 프록시 요청은 원본 makecode 서버로 직접 전송
        // 자체 서버에는 /api/gh/* 엔드포인트가 없음
        return U.requestAsync({
            url: MAKECODE_API_ROOT + "gh/" + path,
            allowGzipPost: true
        }).then(r => r.json);
    }

    function ghProxyHandleException(e: any) {
        pxt.log(`github proxy error: ${e.message}`)
        pxt.debug(e);
    }

    export function isOrgAsync(owner: string): Promise<boolean> {
        return ghRequestAsync({ url: `https://api.github.com/orgs/${owner}`, method: "GET", allowHttpErrors: true })
            .then(resp => resp.statusCode == 200);
    }

    export class MemoryGithubDb implements IGithubDb {
        private latestVersions: pxt.Map<string> = {};
        private configs: pxt.Map<pxt.PackageConfig> = {};
        private packages: pxt.Map<CachedPackage> = {};

        private proxyWithCdnLoadPackageAsync(repopath: string, tag: string): Promise<CachedPackage> {
            // cache lookup
            const key = `${repopath}/${tag}`;
            let res = this.packages[key];
            if (res) {
                pxt.debug(`github cache ${repopath}/${tag}/text`);
                return Promise.resolve(res);
            }

            // load and cache
            const parsed = parseRepoId(repopath)
            return ghProxyWithCdnJsonAsync(join(parsed.slug, tag, parsed.fileName, "text"))
                .then(v => this.packages[key] = { files: v });
        }

        private cacheConfig(key: string, v: string) {
            const cfg = pxt.Package.parseAndValidConfig(v);
            this.configs[key] = cfg;
            return U.clone(cfg);
        }

        async loadConfigAsync(repopath: string, tag: string): Promise<pxt.PackageConfig> {
            if (!tag) {
                pxt.debug(`dep: default to master branch`)
                tag = "master";
            }

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
                    const gpkg = await this.proxyWithCdnLoadPackageAsync(repopath, tag)
                    return this.cacheConfig(key, gpkg.files[pxt.CONFIG_NAME]);
                } catch (e) {
                    ghProxyHandleException(e);
                }
            }
            // if failed, try github apis
            const cfg = await downloadTextAsync(repopath, tag, pxt.CONFIG_NAME);
            return this.cacheConfig(key, cfg);
        }

        async latestVersionAsync(repopath: string, config: PackagesConfig): Promise<string> {
            let resolved = this.latestVersions[repopath]
            if (!resolved) {
                pxt.debug(`dep: resolve latest version of ${repopath}`)
                this.latestVersions[repopath] = resolved = await pxt.github.latestVersionAsync(repopath, config, true, false)
            }
            return resolved
        }

        async loadPackageAsync(repopath: string, tag: string): Promise<CachedPackage> {
            if (!tag) {
                pxt.debug(`load pkg: default to master branch`)
                tag = "master";
            }

            // try using github proxy first
            if (hasProxy()) {
                try {
                    return await this.proxyWithCdnLoadPackageAsync(repopath, tag).then(v => U.clone(v));
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
                            return U.promiseMapAll(pxt.allPkgFiles(cfg).slice(1),
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

    function fallbackDownloadTextAsync(parsed: ParsedRepo, commitid: string, filepath: string) {
        return ghRequestAsync({
            url: "https://api.github.com/repos/" + join(parsed.slug, "contents", parsed.fileName, filepath + "?ref=" + commitid),
            method: "GET"
        }).then(resp => {
            const f = resp.json as FileContent
            isPrivateRepoCache[parsed.slug] = true
            // if they give us content, just return it
            if (f && f.encoding == "base64" && f.content != null)
                return atob(f.content)
            // otherwise, go to download URL
            return U.httpGetTextAsync(f.download_url)
        })
    }

    export function downloadTextAsync(repopath: string, commitid: string, filepath: string) {
        const parsed = parseRepoId(repopath);
        // raw.githubusercontent.com doesn't accept ?access_token=... and has wrong CORS settings
        // for Authorization: header; so try anonymous access first, and otherwise fetch using API

        if (isPrivateRepoCache[parsed.slug])
            return fallbackDownloadTextAsync(parsed, commitid, filepath)

        return U.requestAsync({
            url: "https://raw.githubusercontent.com/" + join(parsed.slug, commitid, parsed.fileName, filepath),
            allowHttpErrors: true
        }).then(resp => {
            if (resp.statusCode == 200)
                return resp.text
            return fallbackDownloadTextAsync(parsed, commitid, filepath)
        })
    }

    // overriden by client
    export let db: IGithubDb = new MemoryGithubDb();

    export function authenticatedUserAsync(): Promise<User> {
        if (!token) return Promise.resolve(undefined); // no token, bail out
        return ghGetJsonAsync("https://api.github.com/user");
    }

    export function getCommitsAsync(repopath: string, sha: string): Promise<CommitInfo[]> {
        const parsed = parseRepoId(repopath);
        return ghGetJsonAsync("https://api.github.com/repos/" + parsed.slug + "/commits?sha=" + sha)
            .then(objs => objs.map((obj: any) => {
                const c = obj.commit;
                c.url = obj.url;
                c.sha = obj.sha;
                return c;
            }));
    }

    export function getCommitAsync(repopath: string, sha: string) {
        const parsed = parseRepoId(repopath);
        return ghGetJsonAsync("https://api.github.com/repos/" + parsed.slug + "/git/commits/" + sha)
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

    function ghPostAsync(path: string, data: any, headers?: any, method?: string): Promise<any> {
        // need to handle 204
        return ghRequestAsync({
            url: /^https:/.test(path) ? path : "https://api.github.com/repos/" + path,
            headers,
            method: method || "POST",
            data: data,
            successCodes: [200, 201, 202, 204]
        }).then(resp => resp.json);
    }

    export function createObjectAsync(repopath: string, type: string, data: any) {
        const parsed = parseRepoId(repopath);
        return ghPostAsync(parsed.slug + "/git/" + type + "s", data)
            .then((resp: SHAObject) => resp.sha)
    }

    export function postCommitComment(repopath: string, commitSha: string, body: string, path?: string, position?: number) {
        const parsed = parseRepoId(repopath);
        return ghPostAsync(`${parsed.slug}/commits/${commitSha}/comments`, {
            body, path, position
        })
            .then((resp: CommitComment) => resp.id);
    }

    export async function fastForwardAsync(repopath: string, branch: string, commitid: string) {
        const parsed = parseRepoId(repopath);
        const resp = await ghRequestAsync({
            url: `https://api.github.com/repos/${parsed.slug}/git/refs/heads/${branch}`,
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
        const parsed = parseRepoId(repopath);
        await ghRequestAsync({
            url: `https://api.github.com/repos/${pxt.github.join(parsed.slug, "contents", parsed.fileName, path)}`,
            method: "PUT",
            allowHttpErrors: true,
            data: {
                message: lf("Initialize empty repo"),
                content: btoa(U.toUTF8(content)),
                branch: "master"
            },
            successCodes: [201]
        })
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
        return res?.html_url as string
    }

    export function mergeAsync(repopath: string, base: string, head: string, message?: string) {
        const parsed = parseRepoId(repopath);
        return ghRequestAsync({
            url: `https://api.github.com/repos/${parsed.slug}/merges`,
            method: "POST",
            successCodes: [201, 204, 409],
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
        const parsed = parseRepoId(repopath);
        const res = await ghPostAsync(`${parsed.slug}/forks`, {})
        const repoInfo = mkRepo(res, { fullName: parsed.fullName, fileName: parsed.fileName })
        const endTm = Date.now() + 5 * 60 * 1000
        let refs: RefsResult = null
        while (!refs && Date.now() < endTm) {
            await U.delay(1000)
            try {
                refs = await listRefsExtAsync(repoInfo.slug, "heads");
            } catch (err) {
                // not created
            }
        }
        if (!refs)
            throw new Error(lf("Timeout waiting for fork"))

        const branchName = generateNextRefName(refs, pref);
        await createNewBranchAsync(repoInfo.slug, branchName, commitid)
        return repoInfo.fullName + "#" + branchName
    }

    export function listRefsAsync(repopath: string, namespace = "tags", useProxy?: boolean, noCache?: boolean): Promise<string[]> {
        return listRefsExtAsync(repopath, namespace, useProxy, noCache)
            .then(res => Object.keys(res.refs))
    }

    export function listRefsExtAsync(repopath: string, namespace = "tags", useProxy?: boolean, noCache?: boolean): Promise<RefsResult> {
        const parsed = parseRepoId(repopath);
        const proxy = shouldUseProxy(useProxy);
        let head: string = null
        const fetch = !proxy ?
            ghGetJsonAsync(`https://api.github.com/repos/${parsed.slug}/git/refs/${namespace}/?per_page=100`) :
            // no CDN caching here, bust browser cace
            // [Monolith] refs 조회는 원본 makecode 서버로 전송
            U.httpGetJsonAsync(pxt.BrowserUtils.cacheBustingUrl(`${MAKECODE_API_ROOT}gh/${parsed.slug}/refs${noCache ? "?nocache=1" : ""}`))
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
            if (err.statusCode == 404)
                return { refs: {} } as any
            else
                return Promise.reject(err)
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
        const parsed = parseRepoId(repopath)
        return ghGetJsonAsync(`https://api.github.com/repos/${parsed.slug}/git/refs/tags/${tag}`)
            .then(resolveRefAsync, e =>
                ghGetJsonAsync(`https://api.github.com/repos/${parsed.slug}/git/refs/heads/${tag}`)
                    .then(resolveRefAsync))
    }

    export async function pkgConfigAsync(repopath: string, tag: string, config: pxt.PackagesConfig) {
        if (!tag)
            tag = await db.latestVersionAsync(repopath, config)
        return await db.loadConfigAsync(repopath, tag)
    }

    export async function downloadPackageAsync(repoWithTag: string, config: pxt.PackagesConfig): Promise<CachedPackage> {
        const p = parseRepoId(repoWithTag)
        if (!p) {
            pxt.log('Unknown GitHub syntax');
            return undefined
        }

        if (isRepoBanned(p, config)) {
            pxt.tickEvent("github.download.banned");
            pxt.log('Github repo is banned');
            return undefined;
        }

        // always try to upgrade unbound versions
        if (!p.tag) {
            p.tag = await db.latestVersionAsync(p.slug, config)
        }
        const cached = await db.loadPackageAsync(p.fullName, p.tag)
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
    }

    export async function downloadLatestPackageAsync(repo: ParsedRepo, useProxy?: boolean, noCache?: boolean): Promise<{ version: string, config: pxt.PackageConfig }> {
        const packageConfig = await pxt.packagesConfigAsync()
        const tag = await pxt.github.latestVersionAsync(repo.slug, packageConfig, useProxy, noCache)
        // download package into cache
        const repoWithTag = `${repo.fullName}#${tag}`;
        await pxt.github.downloadPackageAsync(repoWithTag, packageConfig)

        // return config
        const config = await pkgConfigAsync(repo.fullName, tag, packageConfig)
        const version = `github:${repoWithTag}`

        return { version, config };
    }

    export async function cacheProjectDependenciesAsync(cfg: pxt.PackageConfig): Promise<void> {
        const ghExtensions = Object.keys(cfg.dependencies)
            ?.filter(dep => isGithubId(cfg.dependencies[dep]));

        if (ghExtensions.length) {
            const pkgConfig = await pxt.packagesConfigAsync();
            // Make sure external packages load before installing header.
            await Promise.all(
                ghExtensions.map(
                    async ext => {
                        const extSrc = cfg.dependencies[ext];
                        const ghPkg = await downloadPackageAsync(extSrc, pkgConfig);
                        if (!ghPkg) {
                            throw new Error(lf("Cannot load extension {0} from {1}", ext, extSrc));
                        }
                    }
                )
            );
        }
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
        default_branch: string; // "main", "master",
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
        // owner/project (aka slug)
        slug: string;
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

    export function isDefaultBranch(branch: string, repo?: GitRepo) {
        if (repo && repo.defaultBranch)
            return branch === repo.defaultBranch;
        return /^(main|master)$/.test(branch);
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
        pxtjson: object(expression: "HEAD:pxt.json") {
          ... on Blob {
            text
          }
        }
        readme: object(expression: "HEAD:README.md") {
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
                .map((node: any) => mkRepo(node, { fullName: node.full_name }))
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
        }).then(v => mkRepo(v))
    }

    export async function enablePagesAsync(repo: string) {
        // https://developer.github.com/v3/repos/pages/#enable-a-pages-site
        // try read status
        const parsed = parseRepoId(repo);
        let url: string = undefined;
        try {
            const status = await ghGetJsonAsync(`https://api.github.com/repos/${parsed.slug}/pages`) // try to get the pages
            if (status)
                url = status.html_url;
        } catch (e) { }

        // status failed, try enabling pages
        if (!url) {
            // enable pages
            try {
                const r = await ghPostAsync(`https://api.github.com/repos/${parsed.slug}/pages`, {
                    source: {
                        branch: "master",
                        path: "/"
                    }
                }, {
                    "Accept": "application/vnd.github.switcheroo-preview+json"
                });
                url = r.html_url;
            }
            catch (e) {// this is still an experimental api subject to changes
                pxt.tickEvent("github.pages.error");
                pxt.reportException(e);
            }
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
        // [Monolith] 아이콘 URL은 원본 makecode 서버 사용
        return `${MAKECODE_API_ROOT}gh/${repo.fullName}/icon`;
    }

    function mkRepo(r: Repo, options?: {
        config?: pxt.PackagesConfig,
        fullName?: string,
        fileName?: string,
        tag?: string
    }): GitRepo {
        if (!r) return undefined;
        const rr: GitRepo = {
            owner: r.owner.login.toLowerCase(),
            slug: r.full_name.toLowerCase(),
            fullName: (options?.fullName || r.full_name).toLowerCase(),
            fileName: options?.fileName?.toLocaleLowerCase(),
            name: r.name,
            description: r.description,
            defaultBranch: r.default_branch,
            tag: options?.tag,
            updatedAt: Math.round(new Date(r.updated_at).getTime() / 1000),
            fork: r.fork,
            private: r.private,
        }
        rr.status = repoStatus(rr, options?.config);
        return rr;
    }

    export function repoStatus(rr: ParsedRepo, config: pxt.PackagesConfig): GitRepoStatus {
        if (!rr) return GitRepoStatus.Unknown;
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
        if (!repo) return true;
        const repoFull = repo.fullName?.toLowerCase();
        const repoSlug = repo.slug?.toLowerCase();

        if (config.bannedRepos
            && config.bannedRepos.some(fn => fn && (fn.toLowerCase() == repoFull || fn.toLowerCase() == repoSlug)))
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

        const repoFull = repo?.fullName?.toLowerCase();
        const repoSlug = repo?.slug?.toLowerCase();
        if (!config?.approvedRepoLib || !(repoFull || repoSlug)) return false;
        if (config.approvedRepoLib[repoFull]
            || config.approvedRepoLib[repoSlug])
            return true;
        return false;
    }

    export async function repoAsync(repopath: string, config: pxt.PackagesConfig): Promise<GitRepo> {
        const rid = parseRepoId(repopath);
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
        const r = await ghGetJsonAsync("https://api.github.com/repos/" + rid.slug)
        return mkRepo(r, { config, fullName: rid.fullName, fileName: rid.fileName, tag: rid.tag });
    }

    function proxyRepoAsync(rid: ParsedRepo, status: GitRepoStatus): Promise<GitRepo> {
        // always use proxy
        return ghProxyWithCdnJsonAsync(rid.slug)
            .then(meta => {
                if (!meta) return undefined;
                return {
                    github: true,
                    owner: rid.owner,
                    fullName: rid.fullName,
                    fileName: rid.fileName,
                    slug: rid.slug,
                    name: rid.fileName ? `${meta.name}-${rid.fileName}` : meta.name,
                    description: meta.description,
                    defaultBranch: meta.defaultBranch || "master",
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

        let repos = query.split('|').map(parseRepoId).filter(repo => !!repo);
        if (repos.length > 0)
            return Promise.all(repos.map(id => repoAsync(id.fullName, config)))
                .then(rs => rs.filter(r => r && r.status != GitRepoStatus.Banned)); // allow deep links to github repos

        // todo fix search
        // [Monolith] GitHub 검색은 원본 makecode 서버로 전송
        const fetch = () => U.httpGetJsonAsync(`${MAKECODE_API_ROOT}ghsearch/${appTarget.id}/${appTarget.platformid || appTarget.id}?q=${encodeURIComponent(query)}`)
        return fetch()
            .then((rs: SearchResults) =>
                rs.items.map(item => mkRepo(item, { config, fullName: item.full_name }))
                    .filter(r => r.status == GitRepoStatus.Approved || (config.allowUnapproved && r.status == GitRepoStatus.Unknown))
                    // don't return the target itself!
                    .filter(r => !pxt.appTarget.appTheme.githubUrl || `https://github.com/${r.fullName}` != pxt.appTarget.appTheme.githubUrl.toLowerCase())
            )
            .catch(err => []); // offline
    }

    // parse https://github.com/[company]/[project](/filepath)(#tag)
    export function parseRepoId(repo: string): ParsedRepo {
        if (!repo) return undefined;
        // clean out whitespaces
        repo = repo.trim();
        // trim trailing /
        repo = repo.replace(/\/$/, '')

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
        let fileName = m[4];
        const tag = m[6];

        const treeM = fileName && /^tree\/([^\/]+\/)/.exec(fileName)
        if (treeM) {
            // https://github.com/pelikhan/mono-demo/tree/master/demo2
            fileName = fileName.slice(treeM[0].length);
            // branch info?
        }

        return {
            owner,
            project,
            slug: join(owner, project),
            fullName: join(owner, project, fileName),
            tag,
            fileName
        }
    }

    export function toGithubDependencyPath(path: string, tag?: string): string {
        let r = "github:" + path;
        if (tag) r += "#" + tag;
        return r;
    }

    export function isGithubId(id: string) {
        if (!id)
            return false
        return id.slice(0, 7) == "github:"
    }

    export function stringifyRepo(p: ParsedRepo, ignoreCase = false) {
        return p ? "github:" + (ignoreCase ? p.fullName : p.fullName.toLowerCase()) + (p.tag ? `#${p.tag}` : '') : undefined;
    }

    export function normalizeRepoId(id: string, defaultTag?: string) {
        const gid = parseRepoId(id);
        if (!gid) return undefined;
        if (!gid.tag && defaultTag)
            gid.tag = defaultTag
        return stringifyRepo(gid);
    }

    export function join(...parts: string[]) {
        return parts.filter(p => !!p).join('/');
    }

    function upgradeRules(cfg: PackagesConfig, id: string) {
        if (!cfg)
            return null
        const parsed = parseRepoId(id)
        if (!parsed) return null
        const repoData = cfg.approvedRepoLib
        // lookup base repo for upgrade rules
        // (since nested repoes share the same version number)
        return cfg.approvedRepoLib && U.lookup(cfg.approvedRepoLib, parsed.slug.toLowerCase())?.upgrades;
    }

    function upgradedDisablesVariants(cfg: PackagesConfig, id: string) {
        const rules = upgradeRules(cfg, id) || [];
        if (!rules)
            return null;

        for (const upgr of rules) {
            const m = /^dv:(.*)/.exec(upgr)
            if (m) {
                const disabled = m[1].split(/,/)
                if (disabled.some(d => !/^\w+$/.test(d)))
                    return null
                return disabled
            }
        }
        return null
    }

    export function upgradedPackageReference(cfg: PackagesConfig, id: string) {
        const rules = upgradeRules(cfg, id)
        if (!rules)
            return null

        for (const upgr of rules) {
            const m = /^min:(.*)/.exec(upgr)
            const minV = m && pxt.semver.tryParse(m[1]);
            if (minV) {
                const parsed = parseRepoId(id)
                const currV = pxt.semver.tryParse(parsed.tag)
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
        }

        return id
    }

    export function upgradedPackageId(cfg: PackagesConfig, id: string) {
        const dv = upgradedDisablesVariants(cfg, id)
        if (dv)
            return id + "?dv=" + dv.join(",")
        return id
    }

    export function latestVersionAsync(repopath: string, config: PackagesConfig, useProxy?: boolean, noCache?: boolean): Promise<string> {
        const parsed = parseRepoId(repopath)

        if (!parsed) return Promise.resolve<string>(null);

        return repoAsync(parsed.slug, config)
            .then(scr => {
                if (!scr) return undefined;
                return listRefsExtAsync(scr.slug, "tags", useProxy, noCache)
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
                            return refsRes.head || tagToShaAsync(scr.slug, scr.defaultBranch)
                    })
            });
    }

    export function resolveMonoRepoVersions(deps: pxt.Map<string>): pxt.Map<string> {
        deps = Util.clone(deps);
        // before loading dependencies, ensure that all mono-repo are in sync
        const slugVersions: pxt.Map<{
            tag: string;
            deps: { id: string; ghid: ParsedRepo; }[];
        }> = {};
        // group and collect versions
        Object.keys(deps)
            .map(id => ({ id, ghid: github.parseRepoId(deps[id]) }))
            .filter(v => v.ghid?.tag)
            .forEach(v => {
                const { id, ghid } = v;
                // check version
                let version = slugVersions[ghid.slug];
                if (!version) {
                    version = slugVersions[ghid.slug] = {
                        tag: ghid.tag,
                        deps: []
                    }
                }
                version.deps.push(v);
                if (pxt.semver.strcmp(version.tag, ghid.tag) < 0) {
                    pxt.debug(`dep: resolve later monorepo tag to ${pxt.github.stringifyRepo(ghid)}`)
                    version.tag = ghid.tag;
                }
            });
        // patch depdencies
        U.values(slugVersions)
            .forEach(v => v.deps
                .forEach(dep => {
                    if (dep.ghid.tag !== v.tag) {
                        pxt.debug(`dep: ${pxt.github.stringifyRepo(dep.ghid)} -> ${v.tag}`);
                        dep.ghid.tag = v.tag;
                        deps[dep.id] = pxt.github.stringifyRepo(dep.ghid);
                    }
                }))

        return deps;
    }

    export interface GitJson {
        repo: string;
        commit: pxt.github.Commit;
        isFork?: boolean;
        mergeSha?: string;
    }

    export const GIT_JSON = ".git.json"
    const GRAPHQL_URL = "https://api.github.com/graphql";

    export function lookupFile(parsed: ParsedRepo, commit: pxt.github.Commit, path: string) {
        if (!commit)
            return null
        const fpath = join(parsed.fileName, path);
        return commit.tree.tree.find(e => e.path == fpath)
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