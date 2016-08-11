/// <reference path="../node_modules/monaco-editor/monaco.d.ts" />
/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>

namespace pxt.vs {

    export function syncModels(mainPkg: MainPackage): void {
        let models = monaco.editor.getModels();
        let modelMap: U.Map<string> = {}
        mainPkg.sortedDeps().forEach(pkg => {
            pkg.getFiles().forEach(f => {
                let fp = pkg.id + "/" + f;
                if (/\.(ts)$/.test(f)) {
                    let sn = f;
                    if (pkg.level > 0)
                        sn = "pxt_modules/" + fp
                    let proto = "pkg:" + fp;
                    let currModel = models.filter( model => model.uri.toString() == proto)[0];
                    if (!currModel) {
                        let uri: monaco.Uri = monaco.Uri.parse(proto);
                        monaco.editor.createModel(pkg.readFile(f),"typescript",uri);
                    } else {
                        currModel.setValue(pkg.readFile(f))
                    }
                    modelMap[proto] = "1";
                }
            });
        });

        models
            .filter(model => /\.(ts)$/.test(model.uri.toString()) && !modelMap[model.uri.toString()])
            .forEach(model => model.dispose());
    }

    export function initMonacoAsync(element: HTMLElement): monaco.editor.IStandaloneCodeEditor {
        let compilerOptions = monaco.languages.typescript.typescriptDefaults.compilerOptions;
        compilerOptions.allowUnreachableCode = true;
        compilerOptions.noImplicitAny = true;
        compilerOptions.allowJs = false;
        compilerOptions.allowUnusedLabels = true;
        compilerOptions.target = monaco.languages.typescript.ScriptTarget.ES5;
        compilerOptions.outDir = "built";
        compilerOptions.rootDir = ".";
        compilerOptions.noLib = true;

        let editor = monaco.editor.create(element, {
            value: "",
            //ariaLabel: lf("JavaScript Editor"),
            readOnly: false,
            contextmenu: true,
            fontSize: 25,
            folding: true,
            //formatOnType: true,
            outlineMarkers: true,
            parameterHints: true,
            fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro'",
            scrollBeyondLastLine: false,
            language: "typescript",
        });

        window.addEventListener('resize', function () {
            editor.layout();
        });

        editor.layout();

        return editor;
    }
}