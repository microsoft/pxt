/// <reference path="../node_modules/monaco-editor/monaco.d.ts" />
/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>

namespace pxt.vs {

    export function syncModels(mainPkg: MainPackage, libs: { [path: string]: monaco.IDisposable }, currFile: string, readOnly: boolean): void {
        let extraLibs = monaco.languages.typescript.typescriptDefaults.extraLibs;
        let modelMap: U.Map<string> = {}
        if (!readOnly) {
            mainPkg.sortedDeps().forEach(pkg => {
                pkg.getFiles().forEach(f => {
                    let fp = pkg.id + "/" + f;
                    if (/\.(ts)$/.test(f) && fp != currFile) {
                        let proto = "pkg:" + fp;
                        if (!monaco.languages.typescript.typescriptDefaults.extraLibs[fp]) {
                            let content = pkg.readFile(f) || " ";
                            libs[fp] = monaco.languages.typescript.typescriptDefaults.addExtraLib(content, fp);
                        }
                        modelMap[fp] = "1";
                    }
                });
            });
        }
        Object.keys(extraLibs)
            .filter(lib => /\.(ts)$/.test(lib) && !modelMap[lib])
            .forEach(lib => {
                libs[lib].dispose();
            });
    }

    export function initMonacoAsync(element: HTMLElement): monaco.editor.IStandaloneCodeEditor {
        // validation settings
        let diagnosticOptions = monaco.languages.typescript.typescriptDefaults.diagnosticsOptions;
        diagnosticOptions.noSyntaxValidation = false;
        diagnosticOptions.noSemanticValidation = false;

        // compiler options
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
            model: null,
            //ariaLabel: lf("JavaScript Editor"),
            fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro'",
            scrollBeyondLastLine: false,
            language: "typescript",
            experimentalScreenReader: true
        });

        window.addEventListener('resize', function () {
            editor.layout();
        });

        editor.layout();

        return editor;
    }
}