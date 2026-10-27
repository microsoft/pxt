import * as chai from "chai";
import * as child_process from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as ts from "typescript";
import * as vm from "vm";
import * as nodeutil from "../../cli/nodeutil";

const rimraf: { sync(directory: string): void } = require("rimraf");

interface BumpFlags {
    pr?: boolean;
    nopr?: boolean;
    update?: boolean;
    upload?: boolean;
}

interface BumpOptions {
    kind: "target" | "extension";
    protection?: boolean | "unknown";
    missingCredentials?: boolean;
    failBump?: boolean;
    failPush?: boolean;
}

const sourceFile = ts.createSourceFile("cli.ts", fs.readFileSync(path.resolve("cli", "cli.ts"), "utf8"),
    ts.ScriptTarget.Latest, true);
const declaration = sourceFile.statements.find((statement): statement is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === "bumpAsync");
if (!declaration) throw new Error("Cannot find bumpAsync");
// Load the real command without initializing unrelated CLI services.
const bumpScript = new vm.Script(ts.transpileModule(declaration.getText(sourceFile), {
    compilerOptions: { target: ts.ScriptTarget.ES2017 }
}).outputText + "\nbumpAsync;");

function bumpCommand(options: BumpOptions) {
    const calls: string[] = [];
    const warnings: string[] = [];
    const bump = async (version: string, tag = true): Promise<string> => {
        calls.push(tag ? "bump:tagged" : "bump:untagged");
        if (options.failBump) throw new Error("Bump commit failed");
        return "1.0.1";
    };
    const publish = async (tags = true): Promise<void> => {
        calls.push(tags ? "push:tags" : "push:no-tags");
        if (options.failPush) throw new Error("Bump push failed");
    };
    const color = (value: string) => value;
    const command: (parsed: { flags: BumpFlags }) => Promise<void> = bumpScript.runInNewContext({
        nodeutil: {
            getCurrentBranchNameAsync: async () => "master",
            getGitHubTokenAsync: async () => {
                if (options.missingCredentials) throw new Error("Missing GitHub credentials");
                return "test-token";
            },
            getGitHubUserAsync: async () => "test-user",
            getGitHubOwnerAndRepoAsync: async () => ({ owner: "owner", repo: "repo" }),
            isBranchProtectedAsync: async () => {
                if (options.protection === "unknown") throw new Error("Protection lookup failed");
                return !!options.protection;
            },
            timestamp: () => "test",
            needsGitCleanAsync: async () => { calls.push("clean"); },
            runGitAsync: async (...args: string[]) => {
                if (args[0] === "push") await publish(args.includes("--follow-tags"));
                else calls.push(`git:${args.join(" ")}`);
            },
            runNpmAsync: async () => { await bump("patch"); },
            npmVersionBumpAsync: bump,
            createBranchAsync: async () => { calls.push("branch"); },
            gitPushAsync: publish,
            createPullRequestAsync: async (request: { base: string; head: string }) => {
                chai.expect(request.base).equals("master");
                chai.expect(request.head).equals("test-user/pxt-bump-test");
                calls.push("pr");
                return "https://github.com/owner/repo/pull/1";
            },
            switchBranchAsync: async () => { calls.push("switch"); }
        },
        fs: { existsSync: (file: string) => file === (options.kind === "target" ? "pxtarget.json" : "pxt.json") },
        pxt: { CONFIG_NAME: "pxt.json" },
        U: { userError: (message: string) => { throw new Error(message); } },
        chalk: { yellow: color, green: Object.assign(color, { underline: color }) },
        console: {
            log: () => { },
            warn: (...messages: string[]) => { warnings.push(messages.join(" ")); }
        },
        justBumpPkgAsync: bump,
        bumpPxtCoreDepAsync: async () => { calls.push("update"); },
        uploadTaggedTargetAsync: async () => { calls.push("upload"); }
    });
    return { run: (flags: BumpFlags = {}) => command({ flags }), calls, warnings };
}

async function expectRejected(promise: Promise<unknown>, message: string): Promise<void> {
    try {
        await promise;
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        chai.expect(error.message).contains(message);
        return;
    }
    throw new Error("Expected the operation to fail");
}

for (const kind of ["target", "extension"] as const) {
    describe(`${kind} bump safety`, () => {
        it("falls back to a tag-free PR when protection cannot be determined", async () => {
            const command = bumpCommand({ kind, protection: "unknown" });
            await command.run();
            chai.expect(command.warnings.join(" ")).contains("Protection lookup failed");
            chai.expect(command.calls).includes("pr");
            chai.expect(command.calls).includes("bump:untagged");
            chai.expect(command.calls.filter(call => call.startsWith("push:"))).deep.equals(["push:no-tags"]);
        });

        it("uses a tag-free PR for a protected branch", async () => {
            const command = bumpCommand({ kind, protection: true });
            await command.run();
            chai.expect(command.calls).includes("pr");
            chai.expect(command.calls.filter(call => call.startsWith("push:"))).deep.equals(["push:no-tags"]);
        });

        it("honors --pr on an unprotected branch", async () => {
            const command = bumpCommand({ kind, protection: false });
            await command.run({ pr: true });
            chai.expect(command.calls).includes("pr");
            chai.expect(command.calls).includes("bump:untagged");
        });

        it("honors explicit --nopr when protection cannot be determined", async () => {
            const command = bumpCommand({ kind, protection: "unknown" });
            await command.run({ pr: true, nopr: true });
            chai.expect(command.calls).not.includes("pr");
            chai.expect(command.calls).includes("bump:tagged");
            chai.expect(command.calls.filter(call => call.startsWith("push:"))).deep.equals(["push:tags"]);
        });

        it("pushes a direct bump only once", async () => {
            const command = bumpCommand({ kind, protection: false });
            await command.run();
            chai.expect(command.calls).not.includes("pr");
            chai.expect(command.calls.filter(call => call.startsWith("push:"))).deep.equals(["push:tags"]);
        });

        it("does not push after the local bump commit fails", async () => {
            const command = bumpCommand({ kind, protection: false, failBump: true });
            await expectRejected(command.run(), "Bump commit failed");
            chai.expect(command.calls.filter(call => call.startsWith("push:"))).deep.equals([]);
        });

        it("propagates a rejected push without retrying or uploading", async () => {
            const command = bumpCommand({ kind, protection: false, failPush: true });
            await expectRejected(command.run(kind === "target" ? { upload: true } : {}), "Bump push failed");
            chai.expect(command.calls.filter(call => call.startsWith("push:"))).deep.equals(["push:tags"]);
            chai.expect(command.calls).not.includes("upload");
        });

        it("fails before changing the repository if it cannot prepare a PR", async () => {
            const command = bumpCommand({ kind, missingCredentials: true });
            await expectRejected(command.run(), "Unable to prepare a bump pull request");
            chai.expect(command.calls).deep.equals([]);
        });

        it("still permits explicit --nopr without GitHub API credentials", async () => {
            const command = bumpCommand({ kind, missingCredentials: true });
            await command.run({ nopr: true });
            chai.expect(command.calls.filter(call => call.startsWith("push:"))).deep.equals(["push:tags"]);
        });
    });
}

describe("target dependency bump", () => {
    it("does not push tags with the preliminary dependency commit", async () => {
        const command = bumpCommand({ kind: "target", protection: false });
        await command.run({ update: true });
        chai.expect(command.calls).deep.equals([
            "git:pull", "update", "push:no-tags", "bump:tagged", "push:tags"
        ]);
    });
});

describe("bump Git pushes", function () {
    this.timeout(20000);
    let originalDirectory: string;
    let temporaryDirectory: string;
    let remote: string;
    let working: string;
    let initialCommit: string;

    const git = (cwd: string, ...args: string[]): string =>
        child_process.execFileSync("git", cwd === remote ? ["--git-dir", remote, ...args] : args,
            { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    const rejectRef = (ref: string) => {
        const hook = path.join(remote, "hooks", "update");
        fs.writeFileSync(hook, `#!/bin/sh\nif [ "$1" = "${ref}" ]; then\n    exit 1\nfi\nexit 0\n`);
        fs.chmodSync(hook, 0o755);
    };

    beforeEach(() => {
        originalDirectory = process.cwd();
        temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "pxt-bump-"));
        remote = path.join(temporaryDirectory, "remote");
        working = path.join(temporaryDirectory, "working");
        git(temporaryDirectory, "init", "--bare", "--initial-branch=main", remote);
        git(temporaryDirectory, "init", "--initial-branch=main", working);
        git(remote, "config", "core.hooksPath", path.join(remote, "hooks"));
        git(working, "config", "core.hooksPath", path.join(working, ".git", "hooks"));
        git(working, "config", "user.name", "PXT tests");
        git(working, "config", "user.email", "pxt-tests@example.com");
        git(working, "config", "commit.gpgsign", "false");
        git(working, "config", "tag.gpgsign", "false");
        git(working, "config", "push.followTags", "true");
        git(working, "commit", "--allow-empty", "-m", "initial");
        git(working, "remote", "add", "origin", remote);
        git(working, "push", "--no-follow-tags", "--set-upstream", "origin", "HEAD");
        initialCommit = git(working, "rev-parse", "HEAD");
        git(working, "commit", "--allow-empty", "-m", "bump version");
        git(working, "tag", "-a", "v1.0.1", "-m", "v1.0.1");
        process.chdir(working);
    });

    afterEach(() => {
        process.chdir(originalDirectory);
        if (temporaryDirectory) rimraf.sync(temporaryDirectory);
    });

    it("reproduces a tag-only publication with a non-atomic push", async () => {
        rejectRef("refs/heads/main");
        await expectRejected(nodeutil.runGitAsync("push", "--follow-tags", "origin", "HEAD"), "Exit code:");
        chai.expect(git(remote, "rev-parse", "refs/heads/main")).equals(initialCommit);
        chai.expect(git(remote, "rev-parse", "v1.0.1^{}")).equals(git(working, "rev-parse", "HEAD"));
    });

    it("does not publish the tag if the server rejects the bump commit", async () => {
        rejectRef("refs/heads/main");
        await expectRejected(nodeutil.gitPushAsync(), "Exit code:");
        chai.expect(git(remote, "rev-parse", "refs/heads/main")).equals(initialCommit);
        chai.expect(git(remote, "tag", "--list")).equals("");
    });

    it("does not publish the commit if the server rejects its tag", async () => {
        rejectRef("refs/tags/v1.0.1");
        await expectRejected(nodeutil.gitPushAsync(), "Exit code:");
        chai.expect(git(remote, "rev-parse", "refs/heads/main")).equals(initialCommit);
        chai.expect(git(remote, "tag", "--list")).equals("");
    });

    it("publishes the accepted bump commit and tag together", async () => {
        await nodeutil.gitPushAsync();
        const commit = git(working, "rev-parse", "HEAD");
        chai.expect(git(remote, "rev-parse", "refs/heads/main")).equals(commit);
        chai.expect(git(remote, "rev-parse", "v1.0.1^{}")).equals(commit);
    });

    it("does not fall back when the server does not support atomic pushes", async () => {
        git(remote, "config", "receive.advertiseAtomic", "false");
        await expectRejected(nodeutil.gitPushAsync(), "Exit code:");
        chai.expect(git(remote, "rev-parse", "refs/heads/main")).equals(initialCommit);
        chai.expect(git(remote, "tag", "--list")).equals("");
    });

    it("does not publish tags on a PR push even with push.followTags enabled", async () => {
        await nodeutil.gitPushAsync(false);
        chai.expect(git(remote, "rev-parse", "refs/heads/main")).equals(git(working, "rev-parse", "HEAD"));
        chai.expect(git(remote, "tag", "--list")).equals("");
    });

    it("does not publish tags when creating a PR branch", async () => {
        await nodeutil.createBranchAsync("pxt-bump-test");
        chai.expect(git(remote, "rev-parse", "refs/heads/pxt-bump-test")).equals(git(working, "rev-parse", "HEAD"));
        chai.expect(git(remote, "tag", "--list")).equals("");
    });
});
