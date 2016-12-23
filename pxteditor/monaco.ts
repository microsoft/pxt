/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../built/monaco.d.ts" />
/// <reference path="../built/pxtlib.d.ts"/>

namespace pxt.vs {

    export interface BlockDefiniton {
        commentAttr: pxtc.CommentAttrs;
        fns?: Map<string>;
    }

    export interface MethodDef {
        sig: string;
        snippet: string;
        comment?: string;
        metaData?: pxtc.CommentAttrs;
    }

    export interface NameDefiniton {
        fns: { [fn: string]: MethodDef };
        metaData?: pxtc.CommentAttrs;
    }

    export function syncModels(mainPkg: MainPackage, libs: { [path: string]: monaco.IDisposable }, currFile: string, readOnly: boolean): monaco.Promise<{ [ns: string]: NameDefiniton }> {
        let extraLibs = (monaco.languages.typescript.typescriptDefaults as any).getExtraLibs();
        let modelMap: Map<string> = {}
        const promises: monaco.Promise<any>[] = [];
        let definitions: { [ns: string]: NameDefiniton } = {}

        if (readOnly) return;

        mainPkg.sortedDeps().forEach(pkg => {
            pkg.getFiles().forEach(f => {
                let fp = pkg.id + "/" + f;
                let proto = "pkg:" + fp;
                if (/\.(ts)$/.test(f) && fp != currFile) {
                    if (!(monaco.languages.typescript.typescriptDefaults as any).getExtraLibs()[fp]) {
                        let content = pkg.readFile(f) || " ";
                        libs[fp] = monaco.languages.typescript.typescriptDefaults.addExtraLib(content, fp);
                    }
                    modelMap[fp] = "1";

                    // populate definitions
                    let promise = populateDefinitions(f, fp, definitions);
                    promises.push(promise);
                }
            });
        });

        Object.keys(extraLibs)
            .filter(lib => /\.(ts)$/.test(lib) && !modelMap[lib])
            .forEach(lib => {
                libs[lib].dispose();
            });

        return monaco.Promise.join(promises)
            .then(() => {
                return definitions;
            });
    }

    function displayPartsToParameterSignature(parts: ts.SymbolDisplayPart[]): string {
        return `(${parts.filter(part => part.kind == "parameterName").map(part => part.text).join(", ")})`;
    }

    function populateDefinitions(f: string, fp: string, definitions: { [ns: string]: NameDefiniton }): monaco.Promise<any> {
        return monaco.languages.typescript.getTypeScriptWorker().then((worker) => {
            return worker(monaco.Uri.parse(fp))
                .then((client: any) => {
                    return client.getNavigationBarItems(fp).then((items: ts.NavigationBarItem[]) => {
                        return monaco.Promise.join(items.filter(item => item.kind == 'module').map((item) => {
                            let promises: monaco.Promise<any>[] = [];
                            // namespace
                            if (!definitions[item.text]) {
                                definitions[item.text] = {
                                    fns: {}
                                };
                            }

                            // metadata promise
                            promises.push(client.getLeadingComments(fp, item.spans[0].start)
                                .then((comments: string) => {
                                    let meta: pxtc.CommentAttrs;
                                    if (comments) {
                                        definitions[item.text].metaData = pxtc.parseCommentString(comments);
                                    }
                            }));

                            // function promises
                            promises.push(monaco.Promise.join(item.childItems
                                .filter(item => item.kind == 'function' && (item.kindModifiers.indexOf('export') > -1 || item.kindModifiers.indexOf('declare') > -1)).map((fn) => {
                                    // exported function 
                                    return client.getCompletionEntryDetailsAndSnippet(fp, fn.spans[0].start, fn.text, fn.text)
                                        .then((details: [ts.CompletionEntryDetails, string]) => {
                                            if (!details) return;

                                            return client.getLeadingComments(fp, fn.spans[0].start)
                                                .then((comments: string) => {
                                                    let meta: pxtc.CommentAttrs;
                                                    if (comments)
                                                        meta = pxtc.parseCommentString(comments);
                                                    let comment = meta ? meta.jsDoc : ts.displayPartsToString(details[0].documentation);
                                                    definitions[item.text].fns[fn.text] = {
                                                        sig: displayPartsToParameterSignature(details[0].displayParts),
                                                        snippet: details[1],
                                                        comment: comment,
                                                        metaData: meta
                                                    }
                                                });
                                        });
                                })));
                            return monaco.Promise.join(promises);
                        }));
                    });
                });
        });
    }

    export function initMonacoAsync(element: HTMLElement): monaco.editor.IStandaloneCodeEditor {
        if (!monaco.languages.typescript) return;

        initAsmMonarchLanguage();

        // validation settings
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSyntaxValidation: false,
            noSemanticValidation: false
        });

        // compiler options
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            allowUnreachableCode: true,
            noImplicitAny: true,
            allowJs: false,
            allowUnusedLabels: true,
            target: monaco.languages.typescript.ScriptTarget.ES5,
            outDir: "built",
            rootDir: ".",
            noLib: true,
            mouseWheelZoom: true
        });

        // maximum idle time
        monaco.languages.typescript.typescriptDefaults.setMaximunWorkerIdleTime(20 * 60 * 1000);

        let editor = monaco.editor.create(element, {
            model: null,
            //ariaLabel: lf("JavaScript Editor"),
            fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', 'monospace'",
            scrollBeyondLastLine: false,
            language: "typescript",
            experimentalScreenReader: true,
            mouseWheelZoom: true,
            tabCompletion: true,
            wordBasedSuggestions: true,
            lineNumbersMinChars: 3,
            //automaticLayout: true,
            mouseWheelScrollSensitivity: 0.5,
            quickSuggestionsDelay: 200,
            theme: pxt.appTarget.appTheme.invertedMonaco ? 'vs-dark' : 'vs'
        });

        editor.layout();

        return editor;
    }

    function initAsmMonarchLanguage(): void {
        monaco.languages.register({ id: 'asm', extensions: ['.asm'] });
        monaco.languages.setMonarchTokensProvider('asm', <monaco.languages.IMonarchLanguage>{
            // Set defaultToken to invalid to see what you do not tokenize yet
            // defaultToken: 'invalid',
            tokenPostfix: '',

            //Extracted from http://infocenter.arm.com/help/topic/com.arm.doc.qrc0006e/QRC0006_UAL16.pdf
            //Should be a superset of the instructions emitted
            keywords: [
                'movs', 'mov', 'adds', 'add', 'adcs', 'adr', 'subs', 'sbcs', 'sub', 'rsbs',
                'muls', 'cmp', 'cmn', 'ands', 'eors', 'orrs', 'bics', 'mvns', 'tst', 'lsls',
                'lsrs', 'asrs', 'rors', 'ldr', 'ldrh', 'ldrb', 'ldrsh', 'ldrsb', 'ldm',
                'str', 'strh', 'strb', 'stm', 'push', 'pop', 'cbz', 'cbnz', 'b', 'bl', 'bx', 'blx',
                'sxth', 'sxtb', 'uxth', 'uxtb', 'rev', 'rev16', 'revsh', 'svc', 'cpsid', 'cpsie',
                'setend', 'bkpt', 'nop', 'sev', 'wfe', 'wfi', 'yield',
                'beq', 'bne', 'bcs', 'bhs', 'bcc', 'blo', 'bmi', 'bpl', 'bvs', 'bvc', 'bhi', 'bls',
                'bge', 'blt', 'bgt', 'ble', 'bal',
                //Registers
                'r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15',
                'pc', 'sp', 'lr'
            ],

            typeKeywords: [
                '.startaddr', '.hex', '.short', '.space', '.section', '.string', '.byte'
            ],

            operators: [],

            // Not all of these are valid in ARM Assembly
            symbols: /[:\*]+/,

            // C# style strings
            escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

            // The main tokenizer for our languages
            tokenizer: {
                root: [
                    // identifiers and keywords
                    [/(\.)?[a-z_$\.][\w$]*/, {
                        cases: {
                            '@typeKeywords': 'keyword',
                            '@keywords': 'keyword',
                            '@default': 'identifier'
                        }
                    }],

                    // whitespace
                    { include: '@whitespace' },

                    // delimiters and operators
                    [/[{}()\[\]]/, '@brackets'],
                    [/[<>](?!@symbols)/, '@brackets'],
                    [/@symbols/, {
                        cases: {
                            '@operators': 'operator',
                            '@default': ''
                        }
                    }],

                    // @ annotations.
                    [/@\s*[a-zA-Z_\$][\w\$]*/, { token: 'annotation' }],

                    // numbers
                    //[/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                    [/(#|(0[xX]))?[0-9a-fA-F]+/, 'number'],

                    // delimiter: after number because of .\d floats
                    [/[;,.]/, 'delimiter'],

                    // strings
                    [/"([^"\\]|\\.)*$/, 'string.invalid'],  // non-teminated string
                    [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],

                    // characters
                    [/'[^\\']'/, 'string'],
                    [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
                    [/'/, 'string.invalid']
                ],

                comment: [],

                string: [
                    [/[^\\"]+/, 'string'],
                    [/@escapes/, 'string.escape'],
                    [/\\./, 'string.escape.invalid'],
                    [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
                ],

                whitespace: [
                    [/[ \t\r\n]+/, 'white'],
                    [/\/\*/, 'comment', '@comment'],
                    [/;.*$/, 'comment'],
                ],
            }
        });
    }
}
