namespace pxt.github {

    export interface ParsedRepo {
        owner?: string;
        project?: string;
        // owner/project (aka slug)
        slug: string;
        fullName: string;
        tag?: string;
        fileName?: string;
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

    export function stringifyRepo(p: ParsedRepo, ignoreCase = false) {
        return p ? "github:" + (ignoreCase ? p.fullName : p.fullName.toLowerCase()) + (p.tag ? `#${p.tag}` : '') : undefined;
    }

    export function join(...parts: string[]) {
        return parts.filter(p => !!p).join('/');
    }
}
