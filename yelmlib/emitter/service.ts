namespace ts.mbit {
    export interface ParameterDesc {
        name: string;
        description: string;
        type: string;
        initializer?: string;
    }

    export enum SymbolKind {
        None,
        Method,
        Property,
        Function,
        Variable,
    }

    export interface SymbolInfo {
        attributes: CommentAttrs;
        name: string;
        namespace: string;
        kind: SymbolKind;
        parameters: ParameterDesc[];
        retType: string;
        qualifiedName: string;
    }

    export interface EnumInfo {
        name: string;
        values: CommentAttrs[];
    }

    export interface ApisInfo {
        functions: SymbolInfo[];
        enums: EnumInfo[];
    }

    export interface CompletionEntry {
        name: string;
        kind: string;
        qualifiedName: string;
    }

    export interface CompletionInfo {
        entries: CompletionEntry[];
        isMemberCompletion: boolean;
        isNewIdentifierLocation: boolean;
        isTypeLocation: boolean;
    }

    export function getFullName(typechecker: TypeChecker, symbol: Symbol): string {
        return typechecker.getFullyQualifiedName(symbol);
    }

    export function fillCompletionEntries(program: Program, symbols: Symbol[], r: CompletionInfo) {
        let typechecker = program.getTypeChecker()

        for (let s of symbols) {

            let tmp = ts.getLocalSymbolForExportDefault(s)
            let name = typechecker.symbolToString(tmp || s)
            let flags = s.getFlags()
            let kind = ""

            let decl = s.valueDeclaration
            let isAmbient = false
            if (decl && ts.isInAmbientContext(decl))
                isAmbient = true

            /* The following are skipped below, possible to do   
       Class             // Class
       Interface         // Interface
       TypeLiteral       // Type Literal
       ObjectLiteral     // Object Literal
       Constructor       // Constructor
       Signature         // Call, construct, or index signature
       TypeParameter     // Type parameter
       TypeAlias         // Type alias
       Alias             // An alias for another symbol (see comment in isAliasSymbolDeclaration in checker)
       Instantiated      // Instantiated symbol
       Merged            // Merged symbol (created during program binding)
       Transient         // Transient symbol (created during type check)
       Prototype         // Prototype property (no source representation)
       SyntheticProperty // Property in union or intersection type
       Optional          // Optional property
       ExportStar        // Export * declaration
       */

            if (flags & SymbolFlags.Module) {
                kind = "module"
            } else if (flags & SymbolFlags.Variable) {
                // local or global
                // also let, const, parameter

                // Ambient vars are things like Array, Number, etc
                if (!isAmbient)
                    kind = "var"
            } else if (flags & SymbolFlags.Function) {
                // local or global
                kind = "function"
            } else if (flags & SymbolFlags.Enum) {
                // local or global
                kind = "enum"
            } else if (flags & SymbolFlags.EnumMember) {
                // local or global
                kind = "enummember"
            } else if (flags & (SymbolFlags.Accessor | SymbolFlags.Property)) {
                kind = "field"
            } else if (flags & SymbolFlags.Method) {
                kind = "method"
            }

            let qualifiedName = getFullName(typechecker, s)

            if (!kind) continue;
            r.entries.push({
                name,
                kind,
                qualifiedName
            });
        }
    }
}


namespace ts.mbit.service {
    let emptyOptions: CompileOptions = {
        fileSystem: {},
        sourceFiles: [],
        hexinfo: null
    }

    class Host implements LanguageServiceHost {
        opts = emptyOptions;
        fileVersions: Util.StringMap<number> = {};
        projectVer = 0;

        getProjectVersion() {
            return this.projectVer + ""
        }

        setFile(fn: string, cont: string) {
            if (this.opts.fileSystem[fn] != cont) {
                this.fileVersions[fn] = (this.fileVersions[fn] || 0) + 1
                this.opts.fileSystem[fn] = cont
                this.projectVer++
            }
        }

        setOpts(o: CompileOptions) {
            Util.iterStringMap(o.fileSystem, (fn, v) => {
                if (this.opts.fileSystem[fn] != v) {
                    this.fileVersions[fn] = (this.fileVersions[fn] || 0) + 1
                }
            })
            this.opts = o
            this.projectVer++
        }

        getCompilationSettings(): CompilerOptions {
            return getTsCompilerOptions(this.opts)
        }

        getScriptFileNames(): string[] {
            return this.opts.sourceFiles;
        }

        getScriptVersion(fileName: string): string {
            return (this.fileVersions[fileName] || 0).toString()
        }

        getScriptSnapshot(fileName: string): IScriptSnapshot {
            let f = this.opts.fileSystem[fileName]
            if (f)
                return ScriptSnapshot.fromString(f)
            else
                return null
        }

        getNewLine() { return "\n" }
        getCurrentDirectory(): string { return "." }
        getDefaultLibFileName(options: CompilerOptions): string { return null }
        log(s: string): void { console.log("LOG", s) }
        trace(s: string): void { console.log("TRACE", s) }
        error(s: string): void { console.error("ERROR", s) }
        useCaseSensitiveFileNames(): boolean { return true }

        // resolveModuleNames?(moduleNames: string[], containingFile: string): ResolvedModule[];
        // directoryExists?(directoryName: string): boolean;
    }

    let service: LanguageService;
    let host: Host;

    export interface OpArg {
        fileName?: string;
        fileContent?: string;
        position?: number;
        options?: CompileOptions;
    }

    function fileDiags(fn: string) {
        let d = service.getSyntacticDiagnostics(fn)
        if (!d || !d.length)
            d = service.getSemanticDiagnostics(fn)
        if (!d) d = []
        return d
    }

    interface InternalCompletionData {
        symbols: ts.Symbol[];
        isMemberCompletion: boolean;
        isNewIdentifierLocation: boolean;
        location: ts.Node;
        isRightOfDot: boolean;
        isJsDocTagName: boolean;
    }

    let operations: Util.StringMap<(v: OpArg) => any> = {
        reset: () => {
            service.cleanupSemanticCache();
            host.setOpts(emptyOptions)
        },

        setOptions: v => {
            host.setOpts(v.options)
        },

        getCompletions: v => {
            if (v.fileContent) {
                host.setFile(v.fileName, v.fileContent);
            }

            let program = service.getProgram() // this synchornizes host data as well
            let data: InternalCompletionData = (service as any).getCompletionData(v.fileName, v.position);
            let typechecker = program.getTypeChecker()

            let r: CompletionInfo = {
                entries: [],
                isMemberCompletion: data.isMemberCompletion,
                isNewIdentifierLocation: data.isNewIdentifierLocation,
                isTypeLocation: false // TODO
            }

            fillCompletionEntries(program, data.symbols, r)

            return r;
        },

        compile: v => {
            return compile(v.options)
        },

        fileDiags: v => patchUpDiagnostics(fileDiags(v.fileName)),

        allDiags: () => {
            let global = service.getCompilerOptionsDiagnostics() || []
            let byFile = host.getScriptFileNames().map(fileDiags)
            return patchUpDiagnostics(global.concat(Util.concat(byFile)))
        },

        apiInfo: () => {
            return mbit.getApiInfo(service.getProgram())
        },
    }

    export function performOperation(op: string, arg: OpArg) {
        init();
        let res: any = null;

        if (operations.hasOwnProperty(op)) {
            try {
                res = operations[op](arg) || {}
            } catch (e) {
                res = {
                    errorMessage: e.stack
                }
            }
        } else {
            res = {
                errorMessage: "No such operation: " + op
            }
        }

        return res
    }

    function init() {
        if (!service) {
            host = new Host()
            service = ts.createLanguageService(host)
        }
    }
}
