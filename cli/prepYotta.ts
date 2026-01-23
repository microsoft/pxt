// Do not require this file! It's for docker builds only.

// The built version of this file is used by the CLI to set
// .netrc and .yotta/config.json when building targets locally

const os = require("os");
const path = require("path");
const fs = require("fs");

const token = process.env["GITHUB_ACCESS_TOKEN"];
if (process.env["GITHUB_ACCESS_TOKEN"]) {
    console.log("Writing .netrc and .yotta/config.json")
    const home = os.homedir();


    const yottaDir = path.join(home, ".yotta");
    if (!directoryExists(yottaDir)) {
        fs.mkdirSync(yottaDir);
    }

    fs.writeFileSync(path.join(yottaDir, "config.json"), getYottaConfig(token), "utf8");
    fs.writeFileSync(path.join(home, ".netrc"), getNetrc(token), "utf8");
}

function getNetrc(token: string) {
    return (
`
machine github.com
login build
password ${token}

machine api.github.com
login build
password ${token}
`
    );
}

function getYottaConfig(token: string) {
    const yottaConfig = {
        "github": {
            "authtoken": token
        }
    };

    return JSON.stringify(yottaConfig);
}

function directoryExists(dir: string) {
    try {
        const stat = fs.lstatSync(dir);
        return stat.isDirectory;
    }
    catch(e) {
        return false;
    }
}