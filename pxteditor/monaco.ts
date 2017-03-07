/// <reference path="../typings/globals/bluebird/index.d.ts"/>
/// <reference path="../localtypings/monaco.d.ts" />
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
        vars?: { [index: string]: string }
        metaData?: pxtc.CommentAttrs;
    }

    export type DefinitionMap = { [ns: string]: NameDefiniton };

    export function syncModels(mainPkg: MainPackage, libs: { [path: string]: monaco.IDisposable }, currFile: string, readOnly: boolean): monaco.Promise<DefinitionMap> {
        if (readOnly) return monaco.Promise.as(undefined);

        let extraLibs = (monaco.languages.typescript.typescriptDefaults as any).getExtraLibs();
        let modelMap: Map<string> = {}
        let toPopulate: {f: string, fp: string} [] = [];
        let definitions: DefinitionMap = {}

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

                    // store which files we need to populate definitions for the monaco toolbox
                    toPopulate.push({f: f, fp: fp});
                }
            });
        });

        // dispose of any extra libraries, the typescript worker will be killed as a result of this
        Object.keys(extraLibs)
            .filter(lib => /\.(ts)$/.test(lib) && !modelMap[lib])
            .forEach(lib => {
                libs[lib].dispose();
            });

        // populate definitions for the monaco toolbox
        const promises: monaco.Promise<any>[] = [];
        toPopulate.forEach((populate) => {
            let promise = populateDefinitions(populate.f, populate.fp, definitions);
            promises.push(promise);
        })

        return monaco.Promise.join(promises)
            .then(() => {
                return definitions;
            });
    }

    function displayPartsToParameterSignature(parts: ts.SymbolDisplayPart[]): string {
        return `(${parts.filter(part => part.kind == "parameterName").map(part => part.text).join(", ")})`;
    }

    function populateDefinitions(f: string, fp: string, definitions: DefinitionMap): monaco.Promise<any> {
        const typeDefs: DefinitionMap = {};
        return monaco.languages.typescript.getTypeScriptWorker().then((worker) => {
            return worker(monaco.Uri.parse(fp))
                .then((client: any) => {
                    return client.getNavigationBarItems(fp).then((items: ts.NavigationBarItem[]) =>
                        populateDefinitionsForKind(client, ts.ScriptElementKind.interfaceElement, items)
                            .then(() => populateDefinitionsForKind(client, ts.ScriptElementKind.classElement, items))
                            .then(() => populateDefinitionsForKind(client, ts.ScriptElementKind.moduleElement, items))
                    );
                })
                .then(() => {
                    Object.keys(definitions).forEach(name => {
                        const moduleDef = definitions[name];
                        if (moduleDef.vars) {
                            Object.keys(moduleDef.vars).forEach(typeString => {
                                const typeDef = typeDefs[typeString];
                                if (typeDef) {
                                    Object.keys(typeDef.fns).forEach(functionName => {
                                        const qName = `${typeString}.${functionName}`;
                                        if (moduleDef.fns[qName]) {
                                            return;
                                        }

                                        const fn = typeDef.fns[functionName];
                                        if (fn) {
                                            fn.snippet = `${moduleDef.vars[typeString]}.${fn.snippet}`;
                                            moduleDef.fns[qName] = fn;
                                        }
                                    });
                                }
                            });
                        }
                    });
                });
        });

        function populateDefinitionsForKind(client: any, kind: string, items: ts.NavigationBarItem[]) {
            return monaco.Promise.join(items.filter(item => item.kind == kind).map((item) => {
                if (kind === ts.ScriptElementKind.moduleElement) {
                    if (!definitions[item.text]) {
                        definitions[item.text] = {
                            fns: {}
                        };
                    }

                    return populateNameDefinition(client, fp, item, definitions[item.text]);
                }
                else {
                    if (!typeDefs[item.text]) {
                        typeDefs[item.text] = {
                            fns: {}
                        };
                    }

                    return populateNameDefinition(client, fp, item, typeDefs[item.text]);
                }
            }));

            function populateNameDefinition(client: any, fp: string, parent: ts.NavigationBarItem, definition: NameDefiniton) {
                let promises: monaco.Promise<any>[] = [];

                // metadata promise
                promises.push(client.getLeadingComments(fp, parent.spans[0].start)
                    .then((comments: string) => {
                        if (comments) {
                            const meta = pxtc.parseCommentString(comments);
                            if (meta) {
                                if (!definition.metaData) {
                                    definition.metaData = meta
                                }
                                else {
                                    Object.keys(meta).forEach(k => (definition.metaData as any)[k] = (meta as any)[k])
                                }
                            }
                        }
                }));

                // function promises
                promises.push(monaco.Promise.join(parent.childItems
                    .filter(item => (item.kind == ts.ScriptElementKind.functionElement ||
                        item.kind === ts.ScriptElementKind.memberFunctionElement) && isExported(item))
                    .map((fn) => {
                        // exported function
                        return client.getCompletionEntryDetailsAndSnippet(fp, fn.spans[0].start, fn.text, fn.text, parent.text)
                            .then((details: [ts.CompletionEntryDetails, string]) => {
                                if (!details) return;

                                return client.getLeadingComments(fp, fn.spans[0].start)
                                    .then((comments: string) => {
                                        let meta: pxtc.CommentAttrs;
                                        if (comments)
                                            meta = pxtc.parseCommentString(comments);
                                        let comment = meta ? meta.jsDoc : ts.displayPartsToString(details[0].documentation);
                                        definition.fns[fn.text] = {
                                            sig: displayPartsToParameterSignature(details[0].displayParts),
                                            snippet: details[1],
                                            comment: comment,
                                            metaData: meta
                                        }
                                    });
                            });
                    })
                ));

                if (kind === ts.ScriptElementKind.moduleElement) {
                    if (!definition.vars) {
                        definition.vars = {};
                    }

                    promises.push(monaco.Promise.join(parent.childItems.filter(v => v.kind === ts.ScriptElementKind.constElement && isExported(v)).map(v => {
                        return (client.getQuickInfoAtPosition(fp, v.spans[0].start) as monaco.Promise<ts.QuickInfo>)
                            .then(qInfo => {
                                if (qInfo) {
                                    const typePart = qInfo.displayParts.filter(part => part.kind === "interfaceName" ||  part.kind === "className")[0];

                                    if (typePart && !definition.vars[typePart.text]) {
                                        definition.vars[typePart.text] = v.text;
                                    }
                                }
                            })
                    })));
                }

                return monaco.Promise.join(promises);

                function isExported(item: ts.NavigationBarItem) {
                    if (kind === ts.ScriptElementKind.interfaceElement) {
                        return true;
                    }

                    if (item.kind === ts.ScriptElementKind.memberFunctionElement && !item.kindModifiers) {
                        return true;
                    }

                    return item.kindModifiers.indexOf(ts.ScriptElementKindModifier.exportedModifier) !== -1 ||
                        item.kindModifiers.indexOf(ts.ScriptElementKindModifier.ambientModifier) !== -1
                }
            }
        }
    }


    export function initMonacoAsync(element: HTMLElement): Promise<monaco.editor.IStandaloneCodeEditor> {
        return new Promise<monaco.editor.IStandaloneCodeEditor>((resolve, reject) => {
            if (typeof((window as any).monaco) === 'object') {
                // monaco is already loaded
                resolve(createEditor(element));
                return;
            }

            let onGotAmdLoader = () => {
                (window as any).require.config({ paths: { 'vs': pxt.webConfig.pxtCdnUrl + 'vs' }});

                // Load monaco
                (window as any).require(['vs/editor/editor.main'], () => {
                    setupMonaco();

                    resolve(createEditor(element));
                });
            };

            // Load AMD loader if necessary
            if (!(<any>window).require) {
                let loaderScript = document.createElement('script');
                loaderScript.type = 'text/javascript';
                loaderScript.src = pxt.webConfig.pxtCdnUrl + 'vs/loader.js';
                loaderScript.addEventListener('load', onGotAmdLoader);
                document.body.appendChild(loaderScript);
            } else {
                onGotAmdLoader();
            }
        })
    }

    function setupMonaco() {
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
    }

    export function createEditor(element: HTMLElement): monaco.editor.IStandaloneCodeEditor {
        const inverted = pxt.appTarget.appTheme.invertedMonaco;

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
            theme: inverted ? 'vs-dark' : 'vs'
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
