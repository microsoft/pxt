import * as fs from 'fs';
import * as path from 'path';

/**
 * Name of the machine-local file, at the root of a target checkout, that maps
 * GitHub repositories to local directories for `pxt serve`. It holds paths of
 * the developer's machine, so it is meant to stay out of source control.
 */
export const LOCAL_CONFIG_NAME = "pxtlocal.json";

/**
 * Contents of pxtlocal.json.
 */
export interface LocalConfig {
    /**
     * Maps a GitHub repository ("owner/repo") to the local directory holding
     * its checkout, absolute or relative to the directory of pxtlocal.json.
     */
    localRepos?: pxt.Map<string>;
}

/**
 * Repository metadata, in the shape the MakeCode GitHub proxy returns it.
 */
export interface LocalRepoMeta {
    name: string;
    description: string;
}

/**
 * Refs listing, in the shape the MakeCode GitHub proxy returns it.
 */
export interface LocalRepoRefs {
    refs: pxt.Map<string>;
}

function requestError(statusCode: number, msg: string) {
    const err = new Error(msg);
    (err as any).statusCode = statusCode;
    return err;
}

function isDirectory(dir: string) {
    try {
        return fs.statSync(dir).isDirectory();
    } catch (e) {
        return false;
    }
}

function readTextOpt(fn: string): string {
    try {
        return fs.readFileSync(fn, "utf8");
    } catch (e) {
        if (e.code == "ENOENT" || e.code == "ENOTDIR")
            return undefined;
        throw e;
    }
}

/**
 * Resolves `rel` against the absolute directory `base`, and returns the
 * resolved path if it is `base` or lies inside it, undefined otherwise.
 */
function resolveInside(base: string, rel: string): string {
    const resolved = path.resolve(base, rel);
    const prefix = base.endsWith(path.sep) ? base : base + path.sep;
    return resolved == base || resolved.startsWith(prefix) ? resolved : undefined;
}

function addLocalRepo(localRepos: pxt.Map<string>, slug: string, dir: string, baseDir: string, source: string) {
    const repo = pxt.github.parseRepoId(slug);
    if (!repo || repo.fileName || repo.tag !== undefined || repo.slug != slug.trim())
        pxt.U.userError(`${source}: '${slug}' is not a GitHub repository; expected owner/repo`);
    if (!dir)
        pxt.U.userError(`${source}: no directory given for ${slug}`);
    const resolved = path.resolve(baseDir, dir);
    if (!isDirectory(resolved))
        pxt.U.userError(`${source}: directory ${resolved} for ${slug} does not exist`);
    localRepos[repo.slug.toLowerCase()] = resolved;
}

/**
 * Builds the map of GitHub repositories that `pxt serve` resolves from local
 * directories.
 *
 * Entries come from pxtlocal.json in `targetDir`, when the file exists, with
 * relative directories resolved against `targetDir`. Each `flagValue`
 * ("owner/repo=dir", relative directories resolved against `cwd`) is applied
 * after the file and replaces a file entry for the same repository.
 *
 * Returns the map from lowercase "owner/repo" to absolute directory. Throws a
 * user error when pxtlocal.json is not valid JSON, or an entry names
 * something other than a repository or a directory that does not exist.
 */
export function loadLocalRepos(targetDir: string, flagValues: string[], cwd: string): pxt.Map<string> {
    const localRepos: pxt.Map<string> = {};

    const configPath = path.join(targetDir, LOCAL_CONFIG_NAME);
    const configText = readTextOpt(configPath);
    if (configText !== undefined) {
        const config = pxt.U.jsonTryParse(configText) as LocalConfig;
        if (!config)
            pxt.U.userError(`${configPath}: invalid JSON`);
        const entries = config.localRepos || {};
        for (const slug of Object.keys(entries))
            addLocalRepo(localRepos, slug, entries[slug], targetDir, configPath);
    }

    for (const flagValue of flagValues) {
        const m = /^([^=]+)=(.*)$/.exec(flagValue);
        if (!m)
            pxt.U.userError(`--local-repo ${flagValue}: expected owner/repo=directory`);
        addLocalRepo(localRepos, m[1], m[2], cwd, `--local-repo ${flagValue}`);
    }

    return localRepos;
}

function readPackageFiles(fullName: string, root: string, fileName: string): pxt.Map<string> {
    const dir = resolveInside(root, fileName);
    if (!dir)
        throw requestError(400, `${fullName}: the path is outside the repository`);
    pxt.debug(`local repo: ${fullName} from ${dir}`);
    const configPath = path.join(dir, pxt.CONFIG_NAME);
    const configText = readTextOpt(configPath);
    if (configText === undefined)
        throw requestError(404, `${fullName}: ${configPath} does not exist (the repository is served from ${root})`);
    const config = pxt.Package.parseAndValidConfig(configText);
    if (!config)
        throw requestError(400, `${fullName}: ${configPath} is not a valid ${pxt.CONFIG_NAME}`);

    const files: pxt.Map<string> = {};
    files[pxt.CONFIG_NAME] = configText;
    for (const fn of pxt.allPkgFiles(config).slice(1)) {
        const filePath = resolveInside(dir, fn);
        if (!filePath)
            throw requestError(400, `${fullName}: ${configPath} lists ${fn}, which is outside the package directory`);
        const text = readTextOpt(filePath);
        if (text === undefined)
            throw requestError(404, `${fullName}: ${filePath}, listed in ${configPath}, does not exist`);
        files[fn] = text;
    }
    return files;
}

/**
 * Answers a request for an aliased repository in the shape the MakeCode
 * GitHub proxy answers it, reading the repository's local directory. The
 * request is the path after "gh/":
 *
 * - "owner/repo": the repository metadata ({@link LocalRepoMeta}); the
 *   description is the one in the repository's root pxt.json, if any
 * - "owner/repo/refs": the refs listing ({@link LocalRepoRefs}), always
 *   empty, because an aliased repository serves its working tree whatever
 *   ref is asked for
 * - "owner/repo[/path]/text": the files of the package at `path` (the
 *   repository root when omitted), keyed by file name: its pxt.json and
 *   every file that pxt.json lists
 *
 * Throws an error carrying the HTTP `statusCode` to answer with: 404 when
 * the repository is not aliased, or when the package's pxt.json or a file it
 * lists does not exist; 400 when the path lies outside the repository's
 * directory, the pxt.json is not valid or lists a file outside the package's
 * directory, or the request matches none of the forms above. Every error is
 * also written to the console.
 */
export function resolveLocalRepoRequest(localRepos: pxt.Map<string>, request: string): LocalRepoMeta | LocalRepoRefs | pxt.Map<string> {
    try {
        return answerLocalRepoRequest(localRepos, request);
    } catch (e) {
        pxt.error(e.message);
        throw e;
    }
}

function answerLocalRepoRequest(localRepos: pxt.Map<string>, request: string): LocalRepoMeta | LocalRepoRefs | pxt.Map<string> {
    const elts = request.split("/").filter(e => !!e);
    const repo = elts.length >= 2 ? pxt.github.parseRepoId(elts.slice(0, 2).join("/")) : undefined;
    const root = repo && localRepos[repo.slug.toLowerCase()];
    if (!root)
        throw requestError(404, `${request}: not a locally served repository`);

    const rest = elts.slice(2);
    if (!rest.length) {
        pxt.debug(`local repo: ${repo.slug} metadata from ${root}`);
        const rootConfig = pxt.Package.parseAndValidConfig(readTextOpt(path.join(root, pxt.CONFIG_NAME)));
        return {
            name: repo.project,
            description: rootConfig?.description || ""
        };
    }
    if (rest.length == 1 && rest[0] == "refs") {
        pxt.debug(`local repo: ${repo.slug} refs (working tree only)`);
        return { refs: {} };
    }
    if (rest[rest.length - 1] == "text") {
        const fileName = rest.slice(0, -1).join("/");
        return readPackageFiles(pxt.github.join(repo.slug, fileName), root, fileName);
    }
    throw requestError(400, `${request}: unknown local repository request`);
}
