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
            return U.httpGetJsonAsync(`${pxt.Cloud.apiRoot}gh/${repopath}/${tag}/text`)
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
            let url = "https://raw.githubusercontent.com/" + repopath + "/" + tag + "/" + pxt.CONFIG_NAME
            return ghGetTextAsync(url)
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

    export function downloadTextAsync(repopath: string, commitid: string, filepath: string) {
        return ghGetTextAsync(
            "https://raw.githubusercontent.com/" + repopath + "/" + commitid + "/" + filepath)
    }

    // overriden by client
    export let db: IGithubDb = new MemoryGithubDb();

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

    function ghPostAsync(path: string, data: any) {
        return ghRequestAsync({
            url: /^https:/.test(path) ? path : "https://api.github.com/repos/" + path,
            method: "POST",
            allowHttpErrors: true,
            data: data
        }).then(resp => {
            if (resp.statusCode == 200 || resp.statusCode == 201 || resp.statusCode == 204)
                return resp.json
            throw U.userError(lf("Cannot create object at github.com/{0}; code: {1}",
                path, resp.statusCode))
        })
    }

    export function createObjectAsync(repopath: string, type: string, data: any) {
        return ghPostAsync(repopath + "/git/" + type + "s", data)
            .then((resp: SHAObject) => resp.sha)
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

    export async function createPRAsync(repopath: string, branch: string, commitid: string, msg: string) {
        let branchName = "pr-" + commitid.slice(0, 8)
        await ghPostAsync(repopath + "/git/refs", {
            ref: "refs/heads/" + branchName,
            sha: commitid
        })
        let res = await ghPostAsync(repopath + "/pulls", {
            title: msg,
            body: lf("Automatically created from MakeCode."),
            head: branchName,
            base: "master",
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
        return ghGetJsonAsync("https://api.github.com/repos/" + repopath + "/git/refs/heads/" + branch)
            .then(resolveRefAsync)
    }

    export function listRefsAsync(repopath: string, namespace = "tags"): Promise<string[]> {
        return listRefsExtAsync(repopath, namespace)
            .then(res => Object.keys(res.refs))
    }

    export function listRefsExtAsync(repopath: string, namespace = "tags"): Promise<RefsResult> {
        let head: string = null
        const fetch = !useProxy() ?
            ghGetJsonAsync("https://api.github.com/repos/" + repopath + "/git/refs/" + namespace + "/?per_page=100") :
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
            pxt.log('Unknown github syntax');
            return Promise.resolve<CachedPackage>(undefined);
        }

        if (isRepoBanned(p, config)) {
            pxt.tickEvent("github.download.banned");
            pxt.log('Github repo is banned');
            return Promise.resolve<CachedPackage>(undefined);
        }

        return db.loadPackageAsync(p.fullName, p.tag);
    }

    interface Repo {
        id: number;
        name: string; // "pxt-microbit-cppsample",
        full_name: string; // "Microsoft/pxt-microbit-cppsample",
        owner: {
            login: string; // "Microsoft",
            id: number; // 6154722,
            avatar_url: string; // "https://avatars.githubusercontent.com/u/6154722?v=3",
            gravatar_id: string; // "",
            html_url: string; // "https://github.com/Microsoft",
            type: string; // "Organization"
        },
        private: boolean;
        html_url: string; // "https://github.com/Microsoft/pxt-microbit-cppsample",
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
        fullName: string;
        tag?: string;
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
    }

    export function listUserReposAsync() {
        return ghGetJsonAsync("https://api.github.com/user/repos?per_page=200&sort=updated&affiliation=owner,collaborator")
            .then((res: Repo[]) => res.map(r => mkRepo(r, null)))
    }

    export function createRepoAsync(name: string, description: string) {
        return ghPostAsync("https://api.github.com/user/repos", {
            name,
            description,
            private: false,
        }).then(v => mkRepo(v, null))
    }

    export function repoIconUrl(repo: GitRepo): string {
        if (repo.status != GitRepoStatus.Approved) return undefined;

        return mkRepoIconUrl(repo)
    }

    export function mkRepoIconUrl(repo: ParsedRepo): string {
        return Cloud.apiRoot + `gh/${repo.fullName}/icon`;
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
            updatedAt: Math.round(new Date(r.updated_at).getTime() / 1000)
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
        return Util.httpGetJsonAsync(`${pxt.Cloud.apiRoot}gh/${rid.fullName}`)
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
            })
    }

    export function searchAsync(query: string, config: pxt.PackagesConfig): Promise<GitRepo[]> {
        if (!config) return Promise.resolve([]);

        let repos = query.split('|').map(parseRepoUrl).filter(repo => !!repo);
        if (repos.length > 0)
            return Promise.all(repos.map(id => repoAsync(id.path, config)))
                .then(rs => rs.filter(r => r.status != GitRepoStatus.Banned)); // allow deep links to github repos

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

        let m = /^((https:\/\/)?github.com\/)?([^/]+\/[^/#]+)(#(\w+))?$/i.exec(url.trim());
        if (!m) return undefined;

        let r: { repo: string; tag?: string; path?: string; } = {
            repo: m ? m[3].toLowerCase() : null,
            tag: m ? m[5] : null
        }
        r.path = r.repo + (r.tag ? '#' + r.tag : '');
        return r;
    }

    export function parseRepoId(repo: string): ParsedRepo {
        if (!repo) return undefined;

        repo = repo.replace(/^github:/i, "")
        repo = repo.replace(/^https:\/\/github.com\//i, "")
        repo = repo.replace(/\.git\b/i, "")
        let m = /([^#]+)(#(.*))?/.exec(repo)
        let owner = m ? m[1].split('/')[0].toLowerCase() : undefined;
        return {
            owner,
            fullName: m ? m[1].toLowerCase() : repo.toLowerCase(),
            tag: m ? m[3] : null
        }
    }

    export function isGithubId(id: string) {
        if (!id)
            return false
        return id.slice(0, 7) == "github:"
    }

    export function stringifyRepo(p: ParsedRepo) {
        return p ? "github:" + p.fullName.toLowerCase() + "#" + (p.tag || "master") : undefined;
    }

    export function noramlizeRepoId(id: string) {
        return stringifyRepo(parseRepoId(id))
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
    }

    export const GIT_JSON = ".git.json"
}