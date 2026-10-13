/// <reference path="../../built/pxtlib.d.ts"/>

/* eslint-disable import/no-unassigned-import */
import "mocha";
import * as chai from "chai";
import * as path from "path";

import * as localrepos from "../../cli/localrepos";

// the cli modules read pxtlib from the global scope, as they do in pxt.js
(global as any).pxt = pxt;

const fixturesDir = path.resolve("tests", "cli-test", "localrepos");
const monoDir = path.join(fixturesDir, "mono");

class CapturingLogger extends pxt.ConsoleLogger {
    errors: string[] = [];

    error(...args: any[]) {
        this.errors.push(args.join(" "));
    }
}

function expectStatus(f: () => any, statusCode: number, messagePart: string) {
    let err: any;
    try {
        f();
    } catch (e) {
        err = e;
    }
    chai.expect(err, "expected an error").to.exist;
    chai.expect(err.statusCode).equals(statusCode);
    chai.expect(err.message).contains(messagePart);
}

function expectUserError(f: () => any) {
    let err: any;
    try {
        f();
    } catch (e) {
        err = e;
    }
    chai.expect(err, "expected an error").to.exist;
    chai.expect(err.isUserError).equals(true);
}

describe("local repos config", () => {
    it("reads pxtlocal.json, resolving directories against the target directory", () => {
        const repos = localrepos.loadLocalRepos(path.join(fixturesDir, "target"), [], "/");
        chai.expect(repos).deep.equals({ "owner/mono": monoDir });
    });

    it("returns no repositories without pxtlocal.json or flags", () => {
        chai.expect(localrepos.loadLocalRepos(monoDir, [], "/")).deep.equals({});
    });

    it("applies --local-repo values over pxtlocal.json, resolving directories against the working directory", () => {
        const repos = localrepos.loadLocalRepos(path.join(fixturesDir, "target"), [
            "owner/mono=ext",
            "Other/Repo=" + monoDir
        ], monoDir);
        chai.expect(repos).deep.equals({
            "owner/mono": path.join(monoDir, "ext"),
            "other/repo": monoDir
        });
    });

    it("rejects entries that are not owner/repo", () => {
        expectUserError(() => localrepos.loadLocalRepos(monoDir, ["owner/mono/ext=" + monoDir], "/"));
        expectUserError(() => localrepos.loadLocalRepos(monoDir, ["owner/mono#v1.0.0=" + monoDir], "/"));
        expectUserError(() => localrepos.loadLocalRepos(monoDir, ["owner=" + monoDir], "/"));
        expectUserError(() => localrepos.loadLocalRepos(monoDir, [monoDir], "/"));
    });

    it("rejects directories that do not exist", () => {
        expectUserError(() => localrepos.loadLocalRepos(monoDir, ["owner/mono=missing"], monoDir));
    });

    it("rejects a pxtlocal.json that is not JSON", () => {
        expectUserError(() => localrepos.loadLocalRepos(path.join(fixturesDir, "badjson"), [], "/"));
    });
});

describe("local repos requests", () => {
    const repos = { "owner/mono": monoDir };
    let logger: CapturingLogger;

    beforeEach(() => {
        logger = new CapturingLogger();
        pxt.setLogger(logger);
    });

    afterEach(() => {
        pxt.setLogger(new pxt.ConsoleLogger());
    });

    it("answers repository metadata", () => {
        chai.expect(localrepos.resolveLocalRepoRequest(repos, "owner/mono")).deep.equals({
            name: "mono",
            description: "Monorepo root"
        });
    });

    it("answers an empty refs listing", () => {
        chai.expect(localrepos.resolveLocalRepoRequest(repos, "owner/mono/refs")).deep.equals({ refs: {} });
    });

    it("answers the files of a nested package", () => {
        const files = localrepos.resolveLocalRepoRequest(repos, "owner/mono/ext/text") as pxt.Map<string>;
        chai.expect(Object.keys(files).sort()).deep.equals(["main.ts", "pxt.json", "test.ts"]);
        chai.expect(files["main.ts"]).contains("export const answer = 42;");
        chai.expect(JSON.parse(files["pxt.json"]).name).equals("ext");
    });

    it("answers the files of the root package", () => {
        const files = localrepos.resolveLocalRepoRequest(repos, "owner/mono/text") as pxt.Map<string>;
        chai.expect(Object.keys(files)).deep.equals(["pxt.json"]);
    });

    it("matches repositories case-insensitively", () => {
        const files = localrepos.resolveLocalRepoRequest(repos, "Owner/Mono/ext/text") as pxt.Map<string>;
        chai.expect(JSON.parse(files["pxt.json"]).name).equals("ext");
    });

    it("declines repositories that are not aliased, and logs it", () => {
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner/other/text"), 404, "owner/other");
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner"), 404, "owner");
        chai.expect(logger.errors.length).equals(2);
        chai.expect(logger.errors[0]).contains("owner/other/text");
    });

    it("fails with the missing path when an aliased repository has no package there, and logs it", () => {
        const missing = path.join(monoDir, "nothere", "pxt.json");
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner/mono/nothere/text"), 404, missing);
        chai.expect(logger.errors.length).equals(1);
        chai.expect(logger.errors[0]).contains(missing);
    });

    it("fails with the missing path when the request path runs through a file", () => {
        const missing = path.join(monoDir, "ext", "main.ts", "pxt.json");
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner/mono/ext/main.ts/text"), 404, missing);
    });

    it("rejects a request path that leads outside the repository, without reading there", () => {
        const extRepos = { "owner/ext": path.join(monoDir, "ext") };
        const outside = path.join(monoDir, "pxt.json");
        let err: any;
        try {
            localrepos.resolveLocalRepoRequest(extRepos, "owner/ext/../text");
        } catch (e) {
            err = e;
        }
        chai.expect(err, "expected an error").to.exist;
        chai.expect(err.statusCode).equals(400);
        chai.expect(err.message).contains("owner/ext/..");
        chai.expect(err.message).not.contains(outside);
        chai.expect(logger.errors).deep.equals([err.message]);
    });

    it("rejects a package that lists a file outside its directory", () => {
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner/mono/escaping/text"), 400, "../ext/main.ts");
        chai.expect(logger.errors.length).equals(1);
        chai.expect(logger.errors[0]).contains(path.join(monoDir, "escaping", "pxt.json"));
    });

    it("fails with the missing file when a package lists a file that does not exist", () => {
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner/mono/incomplete/text"), 404,
            path.join(monoDir, "incomplete", "missing.ts"));
    });

    it("fails when a package's pxt.json is not valid", () => {
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner/mono/invalid/text"), 400,
            path.join(monoDir, "invalid", "pxt.json"));
    });

    it("rejects unknown requests, and logs it", () => {
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner/mono/ext"), 400, "owner/mono/ext");
        chai.expect(logger.errors.length).equals(1);
        chai.expect(logger.errors[0]).contains("owner/mono/ext");
    });
});
