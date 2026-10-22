import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";

const expectedKeys = [
    "Header",
    "JavaScript editor",
    "MakeCode Tutorial Tool",
    "MakeCode Tutorial Tool. Build markdown tutorials for MakeCode editors",
    "MakeCode editor",
    "Open the MakeCode editor",
    "Run Code",
    "Your Profile",
    "{0} Logo"
];

describe("Tutorial Tool localization extraction", () => {
    it("scans the configured Tutorial Tool source and extracts the expected keys", () => {
        const webapps = JSON.parse(fs.readFileSync(path.resolve("cli/webapps-config.json"), "utf8"));
        expect(webapps.webapps.some((app: { name: string }) => app.name === "tutorialtool")).to.equal(true);

        const strings = JSON.parse(fs.readFileSync(path.resolve("built/tutorialtool-strings.json"), "utf8"));
        expect(Object.keys(strings).sort()).to.deep.equal(expectedKeys.slice().sort());
    });
});
