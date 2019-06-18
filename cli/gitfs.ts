
import * as child_process from "child_process";
import * as util from 'util';

import U = pxt.Util;

export async function uploadRefs(id: string, repoUrl: string): Promise<void> {
    pxt.log(`uploading refs to ${pxt.Cloud.apiRoot}`);
    let gitCatFile: child_process.ChildProcess
    let gitCatFileBuf = new U.PromiseBuffer<Buffer>()

    let apiLockAsync = new U.PromiseQueue()

    let gitCache = new Cache<GitObject>()

    let lastUsage = 0
    let repoPath = ''

    startGitCatFile()
    gitCatFile.stdin.write(id + "\n")

    let visited: SMap<boolean> = {};
    let toCheck: string[] = [];

    await processCommit(id);

    await checkHash(undefined, true);

    await refreshRefs(id, repoUrl);

    killGitCatFile();
    process.exit(0);

    async function processCommit(id: string) {
        if (visited[id]) return;
        visited[id] = true;
        await checkHash(id);
        //console.log('commit: ' + id);
        let obj = await getGitObjectAsync(id);
        if (obj.type != "commit")
            throw new Error("bad type")
        if (obj.commit.parents) {
            // Iterate through every parent and parse the commit.
            for (let parent of obj.commit.parents) {
                await processCommit(parent);
            }
        }
        // Process every tree
        await processTreeEntry('000', obj.commit.tree);
    }

    async function processTree(entries: TreeEntry[]) {
        for (let entry of entries) {
            //console.log(entry.name, entry.sha);
            await processTreeEntry(entry.mode, entry.sha);
        }
    }

    async function processTreeEntry(mode: string, id: string) {
        if (visited[id]) return;
        visited[id] = true;
        await checkHash(id);
        if (mode.indexOf('1') != 0) {
            let obj = await getGitObjectAsync(id);
            if (obj.type == 'tree') {
                //console.log('tree:' + obj.id);
                await processTree(obj.tree);
            } else {
                throw new Error("bad entry type: " + obj.type)
            }
        }
    }

    function maybeGcGitCatFile() {
        if (!gitCatFile) return
        let d = Date.now() - lastUsage
        if (d < 3000) return
        //console.log("[gc] git cat-file")
        gitCatFile.stdin.end()
        gitCatFile = null
        gitCatFileBuf.drain()
    }

    function startGitCatFile() {
        if (!lastUsage) {
            setInterval(maybeGcGitCatFile, 1000)
        }
        lastUsage = Date.now()
        if (!gitCatFile) {
            //console.log("[run] git cat-file --batch")
            gitCatFile = child_process.spawn("git", ["cat-file", "--batch"], {
                cwd: repoPath,
                env: process.env,
                stdio: "pipe",
                shell: false
            })
            gitCatFile.stderr.setEncoding("utf8")
            gitCatFile.stderr.on('data', (msg: string) => {
                console.error("[git cat-file error] " + msg)
            })
            gitCatFile.stdout.on('data', (buf: Buffer) => gitCatFileBuf.push(buf))
        }
    }

    function killGitCatFile() {
        gitCatFile.kill();
    }

    async function checkHash(id: string, force?: boolean) {
        if (id) toCheck.push(id);
        if (toCheck.length > 50 || force) {
            let hashes = toCheck;
            toCheck = [];
            // Check with cloud
            console.log(`checking hashes with cloud`);
            let response = await pxt.Cloud.privateRequestAsync({
                url: 'upload/status',
                data: {
                    hashes: hashes
                }
            });
            let missingHashes = response.json.missing;
            for (let missing of missingHashes) {
                let obj = await getGitObjectAsync(missing);
                // Upload data to cloud
                console.log(`uploading raw ${missing} with type ${obj.type} to cloud`);
                await pxt.Cloud.privateRequestAsync({
                    url: `upload/raw`,
                    data: {
                        type: obj.type,
                        content: obj.data.toString('base64'),
                        encoding: 'base64',
                        hash: missing
                    }
                });
            }
        }
    }

    async function refreshRefs(id: string, repoUrl: string) {
        console.log("Updating refs");
        const data = {
            HEAD: id,
            repoUrl: repoUrl
        }
        await pxt.Cloud.privateRequestAsync({
            url: `upload/rawrefs`,
            data: data
        });
    }

    function getGitObjectAsync(id: string) {
        if (!id || /[\r\n]/.test(id))
            throw new Error("bad id: " + id)

        let cached = gitCache.get(id)
        if (cached)
            return Promise.resolve(cached)

        return apiLockAsync.enqueue("cat-file", () => {
            // check again, maybe the object has been cached while we were waiting
            cached = gitCache.get(id)
            if (cached)
                return Promise.resolve(cached)

            //console.log("cat: " + id)

            startGitCatFile()
            gitCatFile.stdin.write(id + "\n")
            let sizeLeft = 0
            let bufs: Buffer[] = []
            let res: GitObject = {
                id: id,
                type: "",
                memsize: 64,
                data: null
            }
            let typeBuf: Buffer = null
            let loop = (): Promise<GitObject> =>
                gitCatFileBuf.shiftAsync()
                    .then(buf => {
                        startGitCatFile() // make sure the usage counter is updated
                        if (!res.type) {
                            //console.log(`cat-file ${id} -> ${buf.length} bytes; ${buf[0]} ${buf[1]}`)
                            if (typeBuf) {
                                buf = Buffer.concat([typeBuf, buf])
                                typeBuf = null
                            } else {
                                while (buf[0] == 10)
                                    buf = buf.slice(1)
                            }
                            let end = buf.indexOf(10)
                            //console.log(`len-${buf.length} pos=${end}`)
                            if (end < 0) {
                                if (buf.length == 0) {
                                    // skip it
                                } else {
                                    typeBuf = buf
                                }
                                //console.info(`retrying read; sz=${buf.length}`)
                                return loop()
                            }
                            let line = buf
                            if (end >= 0) {
                                line = buf.slice(0, end)
                                buf = buf.slice(end + 1)
                            } else {
                                throw new Error("bad cat-file respose: " + buf.toString("utf8").slice(0, 100))
                            }
                            let lineS = line.toString("utf8")
                            if (/ missing/.test(lineS)) {
                                throw new Error("file missing")
                            }
                            let m = /^([0-9a-f]{40}) (\S+) (\d+)/.exec(lineS)
                            if (!m)
                                throw new Error("invalid cat-file response: "
                                    + lineS + " <nl> " + buf.toString("utf8"))
                            res.id = m[1]
                            res.type = m[2]
                            sizeLeft = parseInt(m[3])
                            res.memsize += sizeLeft // approximate
                        }
                        if (buf.length > sizeLeft) {
                            buf = buf.slice(0, sizeLeft)
                        }
                        bufs.push(buf)
                        sizeLeft -= buf.length
                        if (sizeLeft <= 0) {
                            res.data = Buffer.concat(bufs)
                            return res
                        } else {
                            return loop()
                        }
                    })

            return loop().then(obj => {
                //console.log(`[cat-file] ${id} -> ${obj.id} ${obj.type} ${obj.data.length}`)
                if (obj.type == "tree") {
                    obj.tree = parseTree(obj.data)
                } else if (obj.type == "commit") {
                    obj.commit = parseCommit(obj.data)
                }

                // check if this is an object in a specific revision, not say on 'master'
                // and if it's small enough to warant caching
                if (/^[0-9a-f]{40}/.test(id)) {
                    gitCache.set(id, obj, obj.memsize)
                }

                return obj
            })
        })
    }
}

export interface GitObject {
    id: string;
    type: string;
    memsize: number;
    data: Buffer;
    tree?: TreeEntry[];
    commit?: Commit;
}

export interface Commit {
    tree: string;
    parents: string[];
    author: string;
    date: number;
    msg: string;
}

export interface TreeEntry {
    mode: string;
    name: string;
    sha: string;
}

export type SMap<T> = { [s: string]: T };

interface QEntry {
    run: () => Promise<any>;
    resolve: (v: any) => void;
    reject: (err: any) => void;
}

const maxCacheSize = 32 * 1024 * 1024
const maxCacheEltSize = 256 * 1024

export class Cache<T> {
    cache: SMap<T> = {}
    size = 0
    get(key: string) {
        if (!key) return null
        if (this.cache.hasOwnProperty(key))
            return this.cache[key]
        return null
    }

    set(key: string, v: T, sz: number) {
        if (!key) return
        delete this.cache[key]
        if (!v || sz > maxCacheEltSize) return
        if (this.size + sz > maxCacheSize) {
            this.flush()
        }
        this.size += sz
        this.cache[key] = v
    }

    flush() {
        this.size = 0
        this.cache = {}
    }
}

export function splitName(fullname: string) {
    let m = /(.*)\/([^\/]+)/.exec(fullname)
    let parent: string = null
    let name = ""
    if (!m) {
        if (fullname == "/") { }
        else if (fullname.indexOf("/") == -1) {
            parent = "/"
            name = fullname
        } else {
            throw new Error("bad name")
        }
    } else {
        parent = m[1] || "/"
        name = m[2]
    }
    return { parent, name }
}

function parseTree(buf: Buffer) {
    let entries: TreeEntry[] = []
    let ptr = 0
    while (ptr < buf.length) {
        let start = ptr
        while (48 <= buf[ptr] && buf[ptr] <= 55)
            ptr++
        if (buf[ptr] != 32)
            throw new Error("bad tree format")
        let mode = buf.slice(start, ptr).toString("utf8")
        ptr++
        start = ptr
        while (buf[ptr])
            ptr++
        if (buf[ptr] != 0)
            throw new Error("bad tree format 2")
        let name = buf.slice(start, ptr).toString("utf8")
        ptr++
        let sha = buf.slice(ptr, ptr + 20).toString("hex")
        ptr += 20
        if (ptr > buf.length)
            throw new Error("bad tree format 3")
        entries.push({ mode, name, sha })
    }
    return entries
}

function parseCommit(buf: Buffer): Commit {
    let cmt = buf.toString("utf8")
    let mtree = /^tree (\S+)/m.exec(cmt)
    let mpar = /^parent (.+)/m.exec(cmt)
    let mauthor = /^author (.+) (\d+) ([+\-]\d{4})$/m.exec(cmt)
    let midx = cmt.indexOf("\n\n")
    return {
        tree: mtree[1],
        parents: mpar ? mpar[1].split(/\s+/) : undefined,
        author: mauthor[1],
        date: parseInt(mauthor[2]),
        msg: cmt.slice(midx + 2)
    }
}