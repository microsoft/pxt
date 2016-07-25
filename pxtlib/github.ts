namespace pxt.github {
    interface GHRef {
        ref: string;
        url: string;
        object: {
            sha: string;
            type: string;
            url: string;
        }
    }

    function cmpTags(a: string, b: string) {
        let max = 10000000
        function parseTag(s: string) {
            s = s.replace(/^v(er)?/i, "")
            let l = s.split(/[.-]/).map(k => /^\d+$/.test(k) ? parseInt(k) : max)
            if (l[0] < max) return l
            else return null
        }
        let aa = parseTag(a)
        let bb = parseTag(b)
        if (!aa) {
            if (!bb) return U.strcmp(a.toLowerCase(), b.toLowerCase())
            else return 1
        } else if (!bb) {
            return -1
        } else {
            for (let i = 0; i < aa.length + 1; ++i) {
                let d = (aa[i] || 0) - (bb[i] || 0)
                if (d) return -d
            }
            return 0
        }
    }

    export function listRefsAsync(repopath: string, namespace = "tags") {
        return U.httpGetJsonAsync("https://api.github.com/repos/" + repopath + "/git/refs/" + namespace + "/?per_page=100")
            .then((resp: GHRef[]) => {
                let tagnames = resp
                    .map(x => x.ref.replace(/^refs\/[^\/]+\//, ""))
                tagnames.sort(cmpTags)
                return tagnames
            }, err => {
                if (err.statusCode == 404) return []
                else return Promise.reject(err)
            })
    }

    function resolveRefAsync(r: GHRef): Promise<string> {
        if (r.object.type == "commit")
            return Promise.resolve(r.object.sha)
        else if (r.object.type == "tag")
            return U.httpGetJsonAsync(r.object.url)
                .then((r: GHRef) =>
                    r.object.type == "commit" ? r.object.sha :
                        Promise.reject(new Error("Bad type (2nd order) " + r.object.type)))
        else
            return Promise.reject(new Error("Bad type " + r.object.type))
    }

    function tagToShaAsync(repopath: string, tag: string) {
        if (/^[a-f0-9]{40}$/.test(tag))
            return Promise.resolve(tag)
        return U.httpGetJsonAsync("https://api.github.com/repos/" + repopath + "/git/refs/tags/" + tag)
            .then(resolveRefAsync, e =>
                U.httpGetJsonAsync("https://api.github.com/repos/" + repopath + "/git/refs/heads/" + tag)
                    .then(resolveRefAsync))
    }

    export interface CachedPackage {
        sha: string;
        files: U.Map<string>;
    }

    export function pkgConfigAsync(repopath: string, tag = "master") {
        let url = "https://raw.githubusercontent.com/" + repopath + "/" + tag + "/" + pxt.configName
        return U.httpGetTextAsync(url)
            .then(v => JSON.parse(v) as pxt.PackageConfig)
    }

    export function downloadPackageAsync(repopath: string, tag: string, current: CachedPackage = null) {
        return tagToShaAsync(repopath, tag)
            .then(sha => {
                let pref = "https://raw.githubusercontent.com/" + repopath + "/" + sha + "/"
                if (!current) current = { sha: "", files: {} }
                if (current.sha === sha) return Promise.resolve(current)
                else {
                    console.log(`Downloading ${repopath}#${tag} -> ${sha}`)
                    return U.httpGetTextAsync(pref + pxt.configName)
                        .then(pkg => {
                            current.files = {}
                            current.sha = ""
                            current.files[pxt.configName] = pkg
                            let cfg: pxt.PackageConfig = JSON.parse(pkg)
                            return Promise.map(cfg.files.concat(cfg.testFiles || []),
                                fn => U.httpGetTextAsync(pref + fn)
                                    .then(text => {
                                        current.files[fn] = text
                                    }))
                                .then(() => {
                                    current.sha = sha
                                    return current
                                })
                        })
                }
            })
    }

    export interface Repo {
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
    }

    export interface SearchResults {
        total_count: number;
        incomplete_results: boolean;
        items: Repo[];
    }

    export function searchAsync(query: string) {
        query += ` in:name,description,readme "for PXT/${appTarget.id}"`
        return U.httpGetJsonAsync("https://api.github.com/search/repositories?q=" + encodeURIComponent(query))
            .then(r => r as SearchResults)
    }

    export function parseRepoId(repo:string) {
        repo = repo.replace(/^(gh|github):/i, "")
        let m = /([^#]+)#(.*)/.exec(repo)
        return {
            repo: m ? m[1].toLowerCase() : repo.toLowerCase(),
            tag: m ? m[2] : null
        }
    }
}