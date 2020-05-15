/// <reference path="../localtypings/monaco.d.ts" />
/// <reference path="../built/pxtlib.d.ts"/>
/// <reference path="../built/pxtblocks.d.ts"/>

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
        snippetOnly?: boolean;
    }

    export interface NameDefiniton {
        fns: { [fn: string]: MethodDef };
        vars?: { [index: string]: string }
        metaData?: pxtc.CommentAttrs;
        builtin?: boolean;
    }

    export type DefinitionMap = { [ns: string]: NameDefiniton };

    export function syncModels(mainPkg: MainPackage, libs: { [path: string]: monaco.IDisposable }, currFile: string, readOnly: boolean) {
        if (readOnly) return;

        let extraLibs = (monaco.languages.typescript.typescriptDefaults as any).getExtraLibs();
        let modelMap: Map<string> = {}

        mainPkg.sortedDeps().forEach(pkg => {
            pkg.getFiles().forEach(f => {
                let fp = pkg.id + "/" + f;
                let proto = "pkg:" + fp;
                if (/\.(ts)$/.test(f) && fp != currFile) {
                    if (!(monaco.languages.typescript.typescriptDefaults as any).getExtraLibs()[fp]) {
                        // inserting a space creates syntax errors in Python
                        let content = pkg.readFile(f) || "\n";
                        libs[fp] = monaco.languages.typescript.typescriptDefaults.addExtraLib(content, fp);
                    }
                    modelMap[fp] = "1";
                }
            });
        });

        // dispose of any extra libraries, the typescript worker will be killed as a result of this
        Object.keys(extraLibs)
            .filter(lib => /\.(ts)$/.test(lib) && !modelMap[lib])
            .forEach(lib => {
                libs[lib].dispose();
            });
    }

    export function initMonacoAsync(element: HTMLElement): Promise<monaco.editor.IStandaloneCodeEditor> {
        return new Promise<monaco.editor.IStandaloneCodeEditor>((resolve, reject) => {
            if (typeof ((window as any).monaco) === 'object') {
                // monaco is already loaded
                resolve(createEditor(element));
                return;
            }
            let monacoPaths: Map<string> = (window as any).MonacoPaths

            let onGotAmdLoader = () => {
                let req = (window as any).require
                req.config({
                    paths: monacoPaths,
                    ignoreDuplicateModules: ["vs/basic-languages/typescript/typescript.contribution", "vs/basic-languages/javascript/javascript.contribution"]
                });

                // Mock out the JavaScript and TypeScript modules because we use our own language service
                let def = (window as any).define;
                def("vs/basic-languages/typescript/typescript.contribution", ["require", "exports"], function() { return function() {} })
                def("vs/basic-languages/javascript/javascript.contribution", ["require", "exports"], function() { return function() {} })
                def("vs/language/typescript/tsMode", ["require", "exports"], function() {
                    return {
                        setupTypeScript: () => {},
                        getTypeScriptWorker: () => {},
                        setupJavaScript: () => {},
                        getJavaScriptWorker: () => {},
                    }
                })

                // Load monaco
                req(['vs/editor/editor.main'], () => {
                    setupMonaco();
                    resolve(createEditor(element));
                });
            };

            // Load AMD loader if necessary
            if (!(<any>window).require) {
                let loaderScript = document.createElement('script');
                loaderScript.type = 'text/javascript';
                loaderScript.src = monacoPaths['vs/loader'];
                loaderScript.addEventListener('load', onGotAmdLoader);
                document.body.appendChild(loaderScript);
            } else {
                onGotAmdLoader();
            }
        })
    }

    function setupMonaco() {
        initAsmMonarchLanguage();
        initTypeScriptLanguageDefinition();
    }

    export function createEditor(element: HTMLElement): monaco.editor.IStandaloneCodeEditor {
        const inverted = pxt.appTarget.appTheme.invertedMonaco;
        const hasFieldEditors = !!(pxt.appTarget.appTheme.monacoFieldEditors && pxt.appTarget.appTheme.monacoFieldEditors.length);

        let editor = monaco.editor.create(element, {
            model: null,
            ariaLabel: Util.lf("JavaScript editor"),
            fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', 'monospace'",
            scrollBeyondLastLine: true,
            language: "typescript",
            mouseWheelZoom: false,
            wordBasedSuggestions: true,
            lineNumbersMinChars: 3,
            formatOnPaste: true,
            folding: hasFieldEditors,
            glyphMargin: hasFieldEditors || pxt.appTarget.appTheme.debugger,
            minimap: {
                enabled: false
            },
            fixedOverflowWidgets: true,
            autoIndent: "full",
            useTabStops: true,
            dragAndDrop: true,
            matchBrackets: "always",
            occurrencesHighlight: false,
            quickSuggestionsDelay: 200,
            theme: inverted ? 'vs-dark' : 'vs',
            renderIndentGuides: true,
            //accessibilitySupport: 'on',
            accessibilityHelpUrl: "" //TODO: Add help url explaining how to use the editor with a screen reader
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

    function initTypeScriptLanguageDefinition() {
        // Taken from https://github.com/microsoft/monaco-languages/blob/master/src/typescript/typescript.ts
        monaco.languages.register({
            id: "typescript",
            extensions: [".ts", ".tsx"],
            aliases: ["TypeScript", "ts", "typescript"],
            mimetypes: ["text/typescript"],
        });

        monaco.languages.setLanguageConfiguration("typescript", {
            wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
            comments: {
                lineComment: '//',
                blockComment: ['/*', '*/']
            },
            brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')']
            ],
            onEnterRules: [
                {
                    // e.g. /** | */
                    beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                    afterText: /^\s*\*\/$/,
                    action: { indentAction: monaco.languages.IndentAction.IndentOutdent, appendText: ' * ' }
                },
                {
                    // e.g. /** ...|
                    beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                    action: { indentAction: monaco.languages.IndentAction.None, appendText: ' * ' }
                },
                {
                    // e.g.  * ...|
                    beforeText: /^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
                    action: { indentAction: monaco.languages.IndentAction.None, appendText: '* ' }
                },
                {
                    // e.g.  */|
                    beforeText: /^(\t|(\ \ ))*\ \*\/\s*$/,
                    action: { indentAction: monaco.languages.IndentAction.None, removeText: 1 }
                }
            ],
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '"', close: '"', notIn: ['string'] },
                { open: '\'', close: '\'', notIn: ['string', 'comment'] },
                { open: '`', close: '`', notIn: ['string', 'comment'] },
                { open: "/**", close: " */", notIn: ["string"] }
            ],
            folding: {
                markers: {
                    start: new RegExp("^\\s*//\\s*#?region\\b"),
                    end: new RegExp("^\\s*//\\s*#?endregion\\b")
                }
            }
        });

        monaco.languages.setMonarchTokensProvider("typescript", <monaco.languages.IMonarchLanguage>{
            // Set defaultToken to invalid to see what you do not tokenize yet
            defaultToken: 'invalid',
            tokenPostfix: '.ts',
            keywords: [
                'abstract', 'as', 'break', 'case', 'catch', 'class', 'continue', 'const',
                'constructor', 'debugger', 'declare', 'default', 'delete', 'do', 'else',
                'enum', 'export', 'extends', 'false', 'finally', 'for', 'from', 'function',
                'get', 'if', 'implements', 'import', 'in', 'infer', 'instanceof', 'interface',
                'is', 'keyof', 'let', 'module', 'namespace', 'never', 'new', 'null', 'package',
                'private', 'protected', 'public', 'readonly', 'require', 'global', 'return',
                'set', 'static', 'super', 'switch', 'symbol', 'this', 'throw', 'true', 'try',
                'type', 'typeof', 'unique', 'var', 'void', 'while', 'with', 'yield', 'async',
                'await', 'of'
            ],
            typeKeywords: [
                'any', 'boolean', 'number', 'object', 'string', 'undefined'
            ],
            operators: [
                '<=', '>=', '==', '!=', '===', '!==', '=>', '+', '-', '**',
                '*', '/', '%', '++', '--', '<<', '</', '>>', '>>>', '&',
                '|', '^', '!', '~', '&&', '||', '??', '?', ':', '=', '+=', '-=',
                '*=', '**=', '/=', '%=', '<<=', '>>=', '>>>=', '&=', '|=',
                '^=', '@',
            ],
            // we include these common regular expressions
            symbols: /[=><!~?:&|+\-*\/\^%]+/,
            escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
            digits: /\d+(_+\d+)*/,
            octaldigits: /[0-7]+(_+[0-7]+)*/,
            binarydigits: /[0-1]+(_+[0-1]+)*/,
            hexdigits: /[[0-9a-fA-F]+(_+[0-9a-fA-F]+)*/,
            regexpctl: /[(){}\[\]\$\^|\-*+?\.]/,
            regexpesc: /\\(?:[bBdDfnrstvwWn0\\\/]|@regexpctl|c[A-Z]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4})/,
            // The main tokenizer for our languages
            tokenizer: {
                root: [
                    [/[{}]/, 'delimiter.bracket'],
                    { include: 'common' }
                ],
                common: [
                    // identifiers and keywords
                    [/[a-z_$][\w$]*/, {
                            cases: {
                                '@typeKeywords': 'keyword',
                                '@keywords': 'keyword',
                                '@default': 'identifier'
                            }
                        }],
                    [/[A-Z][\w\$]*/, 'type.identifier'],
                    // [/[A-Z][\w\$]*/, 'identifier'],
                    // whitespace
                    { include: '@whitespace' },
                    // regular expression: ensure it is terminated before beginning (otherwise it is an opeator)
                    [/\/(?=([^\\\/]|\\.)+\/([gimsuy]*)(\s*)(\.|;|,|\)|\]|\}|$))/, { token: 'regexp', bracket: '@open', next: '@regexp' }],
                    // delimiters and operators
                    [/[()\[\]]/, '@brackets'],
                    [/[<>](?!@symbols)/, '@brackets'],
                    [/!(?=([^=]|$))/, 'delimiter'],
                    [/@symbols/, {
                            cases: {
                                '@operators': 'delimiter',
                                '@default': ''
                            }
                        }],
                    // numbers
                    [/(@digits)[eE]([\-+]?(@digits))?/, 'number.float'],
                    [/(@digits)\.(@digits)([eE][\-+]?(@digits))?/, 'number.float'],
                    [/0[xX](@hexdigits)n?/, 'number.hex'],
                    [/0[oO]?(@octaldigits)n?/, 'number.octal'],
                    [/0[bB](@binarydigits)n?/, 'number.binary'],
                    [/(@digits)n?/, 'number'],
                    // delimiter: after number because of .\d floats
                    [/[;,.]/, 'delimiter'],
                    // strings
                    [/"([^"\\]|\\.)*$/, 'string.invalid'],
                    [/'([^'\\]|\\.)*$/, 'string.invalid'],
                    [/"/, 'string', '@string_double'],
                    [/'/, 'string', '@string_single'],
                    [/`/, 'string', '@string_backtick'],
                ],
                whitespace: [
                    [/[ \t\r\n]+/, ''],
                    [/\/\*\*(?!\/)/, 'comment.doc', '@jsdoc'],
                    [/\/\*/, 'comment', '@comment'],
                    [/\/\/.*$/, 'comment'],
                ],
                comment: [
                    [/[^\/*]+/, 'comment'],
                    [/\*\//, 'comment', '@pop'],
                    [/[\/*]/, 'comment']
                ],
                jsdoc: [
                    [/[^\/*]+/, 'comment.doc'],
                    [/\*\//, 'comment.doc', '@pop'],
                    [/[\/*]/, 'comment.doc']
                ],
                // We match regular expression quite precisely
                regexp: [
                    [/(\{)(\d+(?:,\d*)?)(\})/, ['regexp.escape.control', 'regexp.escape.control', 'regexp.escape.control']],
                    [/(\[)(\^?)(?=(?:[^\]\\\/]|\\.)+)/, ['regexp.escape.control', { token: 'regexp.escape.control', next: '@regexrange' }]],
                    [/(\()(\?:|\?=|\?!)/, ['regexp.escape.control', 'regexp.escape.control']],
                    [/[()]/, 'regexp.escape.control'],
                    [/@regexpctl/, 'regexp.escape.control'],
                    [/[^\\\/]/, 'regexp'],
                    [/@regexpesc/, 'regexp.escape'],
                    [/\\\./, 'regexp.invalid'],
                    [/(\/)([gimsuy]*)/, [{ token: 'regexp', bracket: '@close', next: '@pop' }, 'keyword.other']],
                ],
                regexrange: [
                    [/-/, 'regexp.escape.control'],
                    [/\^/, 'regexp.invalid'],
                    [/@regexpesc/, 'regexp.escape'],
                    [/[^\]]/, 'regexp'],
                    [/\]/, { token: 'regexp.escape.control', next: '@pop', bracket: '@close' }]
                ],
                string_double: [
                    [/[^\\"]+/, 'string'],
                    [/@escapes/, 'string.escape'],
                    [/\\./, 'string.escape.invalid'],
                    [/"/, 'string', '@pop']
                ],
                string_single: [
                    [/[^\\']+/, 'string'],
                    [/@escapes/, 'string.escape'],
                    [/\\./, 'string.escape.invalid'],
                    [/'/, 'string', '@pop']
                ],
                string_backtick: [
                    [/\$\{/, { token: 'delimiter.bracket', next: '@bracketCounting' }],
                    [/[^\\`$]+/, 'string'],
                    [/@escapes/, 'string.escape'],
                    [/\\./, 'string.escape.invalid'],
                    [/`/, 'string', '@pop']
                ],
                bracketCounting: [
                    [/\{/, 'delimiter.bracket', '@bracketCounting'],
                    [/\}/, 'delimiter.bracket', '@pop'],
                    { include: 'common' }
                ],
            },
        });
    }
}
