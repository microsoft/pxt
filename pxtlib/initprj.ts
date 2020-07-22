namespace pxt.template {
    export const TS_CONFIG = `{
    "compilerOptions": {
        "target": "es5",
        "noImplicitAny": true,
        "outDir": "built",
        "rootDir": "."
    },
    "exclude": ["pxt_modules/**/*test.ts"]
}
`;
    export function defaultFiles(): Map<string> {
        const files: Map<string> = {
            "tsconfig.json": TS_CONFIG,

            "test.ts": `// ${lf("tests go here; this will not be compiled when this package is used as an extension.")}
`,
            "_config.yml":
                `makecode:
  target: @TARGET@
  platform: @PLATFORM@
  home_url: @HOMEURL@
theme: jekyll-theme-slate
include:
  - assets
  - README.md
`,
            "Makefile": `all: deploy

build:
\tpxt build

deploy:
\tpxt deploy

test:
\tpxt test
`,
            "Gemfile": `source 'https://rubygems.org'
gem 'github-pages', group: :jekyll_plugins`,
            "README.md": `
> ${lf("Open this page at {0}",
                "[https://@REPOOWNER@.github.io/@REPONAME@/](https://@REPOOWNER@.github.io/@REPONAME@/)"
            )}

## ${lf("Use as Extension")}

${lf("This repository can be added as an **extension** in MakeCode.")}

* ${lf("open [@HOMEURL@](@HOMEURL@)")}
* ${lf("click on **New Project**")}
* ${lf("click on **Extensions** under the gearwheel menu")}
* ${lf("search for **https://github.com/@REPO@** and import")}

## ${lf("Edit this project")} ![${lf("Build status badge")}](https://github.com/@REPO@/workflows/MakeCode/badge.svg)

${lf("To edit this repository in MakeCode.")}

* ${lf("open [@HOMEURL@](@HOMEURL@)")}
* ${lf("click on **Import** then click on **Import URL**")}
* ${lf("paste **https://github.com/@REPO@** and click import")}

## ${lf("Blocks preview")}

${lf("This image shows the blocks code from the last commit in master.")}
${lf("This image may take a few minutes to refresh.")}

![${lf("A rendered view of the blocks")}](https://github.com/@REPO@/raw/master/.github/makecode/blocks.png)

#### ${lf("Metadata (used for search, rendering)")}

* for PXT/@TARGET@
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
`,

            ".gitignore":
                `# MakeCode
built
node_modules
yotta_modules
yotta_targets
pxt_modules
_site
*.db
*.tgz
.header.json
.simstate.json
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
            ".github/workflows/makecode.yml": `name: MakeCode

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
      - name: npm install
        run: |
          npm install -g pxt
          pxt target @TARGET@
      - name: build
        run: |
          pxt install
          pxt build --cloud
        env:
          CI: true
`,
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
    }]
}
`
        };

        // override files from target
        const overrides = targetTemplateFiles();
        if (overrides) {
            Object.keys(overrides)
                .forEach(k => files[k] = overrides[k]);
        }

        return files;
    }

    export function targetTemplateFiles(): pxt.Map<string> {
        const overrides = pxt.appTarget.bundledpkgs[pxt.template.TEMPLATE_PRJ];
        if (overrides) {
            const r = Util.clone(overrides);
            delete r[pxt.CONFIG_NAME];
            return r;
        }
        return undefined;
    }

    export const TEMPLATE_PRJ = "template";

    export function packageFiles(name: string): pxt.Map<string> {
        const prj = pxt.appTarget.blocksprj || pxt.appTarget.tsprj;
        const config = U.clone(prj.config);
        // clean up
        delete (<any>config).installedVersion;
        delete config.additionalFilePath;
        delete config.additionalFilePaths;
        // (keep blocks files)
        config.preferredEditor = config.files.find(f => /\.blocks$/.test(f))
            ? pxt.BLOCKS_PROJECT_NAME : pxt.JAVASCRIPT_PROJECT_NAME;
        config.name = name;
        config.public = true;
        if (!config.version)
            config.version = "0.0.0"
        const files: Map<string> = {};
        const defFiles = defaultFiles();
        for (const f in defFiles)
            files[f] = defFiles[f];
        for (const f in prj.files)
            if (f != "README.md") // this one we need to keep
                files[f] = prj.files[f];

        const pkgFiles = Object.keys(files).filter(s =>
            /\.(blocks|md|ts|asm|cpp|h|py)$/.test(s))

        config.files = pkgFiles.filter(s => !/test/.test(s));
        config.testFiles = pkgFiles.filter(s => /test/.test(s));
        config.supportedTargets = [pxt.appTarget.id];

        files[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(config);

        return files
    }

    export function packageFilesFixup(files: Map<string>, options?: pxt.Map<string>) {
        const configMap = JSON.parse(files[pxt.CONFIG_NAME])
        if (options)
            Util.jsonMergeFrom(configMap, options);
        if (pxt.webConfig) { // CLI
            Object.keys(pxt.webConfig).forEach(k => configMap[k.toLowerCase()] = (<any>pxt.webConfig)[k]);
            configMap["platform"] = pxt.appTarget.platformid || pxt.appTarget.id
            configMap["target"] = pxt.appTarget.id
            configMap["docs"] = pxt.appTarget.appTheme.homeUrl || "./";
            configMap["homeurl"] = pxt.appTarget.appTheme.homeUrl || "???";
        }
        U.iterMap(files, (k, v) => {
            v = v.replace(/@([A-Z]+)@/g, (f, n) => configMap[n.toLowerCase()] || "")
            files[k] = v
        })
    }
}