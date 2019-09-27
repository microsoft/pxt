namespace pxt {
    export const TS_CONFIG =             `{
    "compilerOptions": {
        "target": "es5",
        "noImplicitAny": true,
        "outDir": "built",
        "rootDir": "."
    },
    "exclude": ["pxt_modules/**/*test.ts"]
}
`;
    const _defaultFiles: Map<string> = {
        "tsconfig.json": TS_CONFIG,

        "test.ts": `// tests go here; this will not be compiled when this package is used as a library
`,

        "Makefile": `all: deploy

build:
\tpxt build

deploy:
\tpxt deploy

test:
\tpxt test
`,

        "README.md": `# @NAME@

@DESCRIPTION@

## Usage

This repository contains a MakeCode extension. To use it in MakeCode,

* open @HOMEURL@
* click on **New Project**
* click on **Extensions** under the gearwheel menu
* search for the URL of this repository

## Collaborators

You can invite users to become collaborators to this repository. This will allow multiple users to work on the same project at the same time.
[Learn more...](https://help.github.com/en/articles/inviting-collaborators-to-a-personal-repository)

To edit this repository in MakeCode,

* open @HOMEURL@
* click on **Import** then click on **Import URL**
* paste the repository URL and click import

## Supported targets

* for PXT/@TARGET@
* for PXT/@PLATFORM@
(The metadata above is needed for package search.)

`,

        ".gitignore":
            `built
node_modules
yotta_modules
yotta_targets
pxt_modules
*.db
*.tgz
.header.json
`,
        ".vscode/settings.json":
            `{
    "editor.formatOnType": true,
    "files.autoSave": "afterDelay",
    "files.watcherExclude": {
        "**/.git/objects/**": true,
        "**/built/**": true,
        "**/node_modules/**": true,
        "**/yotta_modules/**": true,
        "**/yotta_targets": true,
        "**/pxt_modules/**": true
    },
    "files.associations": {
        "*.blocks": "html",
        "*.jres": "json"
    },
    "search.exclude": {
        "**/built": true,
        "**/node_modules": true,
        "**/yotta_modules": true,
        "**/yotta_targets": true,
        "**/pxt_modules": true
    }
}`,
        ".github/workflows/makecode.yml": `name: MakeCode CI

on: [push]

jobs:
  build:

    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [8.x]

    steps:
      - uses: actions/checkout@v1
      - name: Use Node.js $\{{ matrix.node-version }}
        uses: actions/setup-node@v1
        with:
          node-version: $\{{ matrix.node-version }}
      - name: npm install, build, and test
        run: |
          npm install -g pxt
          pxt target @TARGET@
          pxt install
          pxt build --cloud
        env:
          CI: true
`,
        ".travis.yml": `language: node_js
node_js:
    - "8.9.4"
script:
    - "npm install -g pxt"
    - "pxt target @TARGET@"
    - "pxt install"
    - "pxt build"
sudo: false
cache:
    directories:
    - npm_modules
    - pxt_modules`,
        ".vscode/tasks.json":
            `
// A task runner that calls the MakeCode (PXT) compiler
{
    "version": "2.0.0",
    "tasks": [{
        "label": "pxt deploy",
        "type": "shell",
        "command": "pxt deploy --local",
        "group": "build",
        "problemMatcher": [ "$tsc" ]
    }, {
        "label": "pxt build",
        "type": "shell",
        "command": "pxt build --local",
        "group": "build",
        "problemMatcher": [ "$tsc" ]
    }, {
        "label": "pxt install",
        "type": "shell",
        "command": "pxt install",
        "group": "build",
        "problemMatcher": [ "$tsc" ]
    }, {
        "label": "pxt clean",
        "type": "shell",
        "command": "pxt clean",
        "group": "test",
        "problemMatcher": [ "$tsc" ]
    }, {
        "label": "pxt serial",
        "type": "shell",
        "command": "pxt serial",
        "group": "test",
        "problemMatcher": [ "$tsc" ]
    }]
}
`
    }

    export function packageFiles(name: string): pxt.Map<string> {
        let prj = pxt.appTarget.tsprj || pxt.appTarget.blocksprj;
        let config = U.clone(prj.config);
        // remove blocks file
        Object.keys(prj.files)
            .filter(f => /\.blocks$/.test(f))
            .forEach(f => delete prj.files[f]);
        config.files = config.files.filter(f => !/\.blocks$/.test(f));

        config.name = name;
        // by default, projects are not public
        config.public = false;

        if (!config.version) {
            config.version = "0.0.0"
        }

        const files: Map<string> = {};
        for (const f in _defaultFiles)
            files[f] = _defaultFiles[f];
        for (const f in prj.files)
            if (f != "README.md") // this one we need to keep
                files[f] = prj.files[f];

        const pkgFiles = Object.keys(files).filter(s =>
            /\.(md|ts|asm|cpp|h|py)$/.test(s))

        const fieldsOrder = [
            "name",
            "version",
            "description",
            "license",
            "dependencies",
            "files",
            "testFiles",
            "testDependencies",
            "public",
            "targetVersions"
        ]

        config.files = pkgFiles.filter(s => !/test/.test(s));
        config.testFiles = pkgFiles.filter(s => /test/.test(s));

        let configMap: Map<string> = config as any
        // make it look nice
        const newCfg: any = {}
        for (const f of fieldsOrder) {
            if (configMap.hasOwnProperty(f))
                newCfg[f] = configMap[f]
        }
        for (const f of Object.keys(configMap)) {
            if (!newCfg.hasOwnProperty(f))
                newCfg[f] = configMap[f]
        }

        files[pxt.CONFIG_NAME] = JSON.stringify(newCfg, null, 4)

        return files
    }

    export function packageFilesFixup(files: Map<string>, removeSubdirs = false) {
        const configMap = JSON.parse(files[pxt.CONFIG_NAME])
        configMap["platform"] = pxt.appTarget.platformid || pxt.appTarget.id
        configMap["target"] = pxt.appTarget.id
        configMap["docs"] = pxt.appTarget.appTheme.homeUrl || "./";
        configMap["homeurl"] = pxt.appTarget.appTheme.homeUrl || "???";

        if (removeSubdirs)
            for (let k of Object.keys(files)) {
                if (k.indexOf("/") >= 0)
                    delete files[k]
            }

        U.iterMap(files, (k, v) => {
            v = v.replace(/@([A-Z]+)@/g, (f, n) => configMap[n.toLowerCase()] || "")
            files[k] = v
        })
    }
}