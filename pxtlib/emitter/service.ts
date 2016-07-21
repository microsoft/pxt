namespace ts.pxt {
    export interface ParameterDesc {
        name: string;
        description: string;
        type: string;
        initializer?: string;
        defaults?: string[];
    }

    export enum SymbolKind {
        None,
        Method,
        Property,
        Function,
        Variable,
        Module,
        Enum,
        EnumMember
    }

    export interface SymbolInfo {
        attributes: CommentAttrs;
        name: string;
        namespace: string;
        kind: SymbolKind;
        parameters: ParameterDesc[];
        retType: string;
        isContextual?: boolean;
        qName?: string;
    }

    export interface ApisInfo {
        byQName: Util.Map<SymbolInfo>;
    }

    export interface BlocksInfo {
        apis: ApisInfo;
        blocks: SymbolInfo[];
    }

    export interface CompletionEntry {
        name: string;
        kind: string;
        qualifiedName: string;
    }

    export interface CompletionInfo {
        entries: Util.Map<SymbolInfo>;
        isMemberCompletion: boolean;
        isNewIdentifierLocation: boolean;
        isTypeLocation: boolean;
    }

    export const placeholderChar = "◊";
    export const defaultImgLit = `
. . . . .
. . . . .
. . # . .
. . . . .
. . . . .
`

    function renderDefaultVal(apis: ts.pxt.ApisInfo, p: ts.pxt.ParameterDesc, imgLit: boolean, cursorMarker: string): string {
        if (p.initializer) return p.initializer
        if (p.defaults) return p.defaults[0]
        if (p.type == "number") return "0"
        else if (p.type == "string") {
            if (imgLit) {
                imgLit = false
                return "`" + defaultImgLit + cursorMarker + "`";
            }
            return `"${cursorMarker}"`
        }
        let si = apis ? Util.lookup(apis.byQName, p.type) : undefined;
        if (si && si.kind == SymbolKind.Enum) {
            let en = Util.values(apis.byQName).filter(e => e.namespace == p.type)[0]
            if (en)
                return en.namespace + "." + en.name;
        }
        let m = /^\((.*)\) => (.*)$/.exec(p.type)
        if (m)
            return `(${m[1]}) => {\n    ${cursorMarker}\n}`
        return placeholderChar;
    }

    export function renderParameters(apis: ts.pxt.ApisInfo, si: SymbolInfo, cursorMarker: string = ''): string {
        if (si.parameters) {
            let imgLit = !!si.attributes.imageLiteral
            return "(" + si.parameters
                .filter(p => !p.initializer)
                .map(p => renderDefaultVal(apis, p, imgLit, cursorMarker)).join(", ") + ")"
        }
        return '';
    }

    function getSymbolKind(node: Node) {
        switch (node.kind) {
            case SK.MethodDeclaration:
            case SK.MethodSignature:
                return SymbolKind.Method;
            case SK.PropertyDeclaration:
            case SK.PropertySignature:
                return SymbolKind.Property;
            case SK.FunctionDeclaration:
                return SymbolKind.Function;
            case SK.VariableDeclaration:
                return SymbolKind.Variable;
            case SK.ModuleDeclaration:
                return SymbolKind.Module;
            case SK.EnumDeclaration:
                return SymbolKind.Enum;
            case SK.EnumMember:
                return SymbolKind.EnumMember;
            default:
                return SymbolKind.None
        }
    }

    function isExported(decl: Declaration) {
        if (decl.modifiers && decl.modifiers.some(m => m.kind == SK.PrivateKeyword || m.kind == SK.ProtectedKeyword))
            return false;

        let symbol = decl.symbol

        if (!symbol)
            return false;

        while (true) {
            let parSymbol: Symbol = (symbol as any).parent
            if (parSymbol) symbol = parSymbol
            else break
        }

        let topDecl = symbol.valueDeclaration || symbol.declarations[0]

        if (topDecl.kind == SK.VariableDeclaration)
            topDecl = topDecl.parent.parent as Declaration

        if (topDecl.parent && topDecl.parent.kind == SK.SourceFile)
            return true;
        else
            return false;
    }

    function isInKsModule(decl: Node): boolean {
        while (decl) {
            if (decl.kind == SK.SourceFile) {
                let src = decl as SourceFile
                return src.fileName.indexOf("pxt_modules") >= 0
            }
            decl = decl.parent
        }
        return false
    }

    function createSymbolInfo(typechecker: TypeChecker, qName: string, stmt: Node): SymbolInfo {
        function typeOf(tn: TypeNode, n: Node, stripParams = false) {
            let t = typechecker.getTypeAtLocation(n)
            if (!t) return "None"
            if (stripParams) {
                t = t.getCallSignatures()[0].getReturnType()
            }
            return typechecker.typeToString(t, null, TypeFormatFlags.UseFullyQualifiedType)
        }

        let kind = getSymbolKind(stmt)
        if (kind != SymbolKind.None) {
            let decl: FunctionLikeDeclaration = stmt as any;
            let attributes = parseComments(decl)

            if (attributes.weight < 0)
                return null;

            let m = /^(.*)\.(.*)/.exec(qName)
            let hasParams = kind == SymbolKind.Function || kind == SymbolKind.Method

            return {
                kind,
                namespace: m ? m[1] : "",
                name: m ? m[2] : qName,
                attributes,
                retType: kind == SymbolKind.Module ? "" : typeOf(decl.type, decl, hasParams),
                parameters: !hasParams ? null : (decl.parameters || []).map(p => {
                    let n = getName(p)
                    let desc = attributes.paramHelp[n] || ""
                    let m = /\beg\.?:\s*(.+)/.exec(desc)
                    return {
                        name: n,
                        description: desc,
                        type: typeOf(p.type, p),
                        initializer: p.initializer ? p.initializer.getText() : attributes.paramDefl[n],
                        defaults: m && m[1].trim() ? m[1].split(/,\s*/).map(e => e.trim()) : undefined
                    }
                })
            }
        }
        return null;
    }

    export function getBlocksInfo(info: ApisInfo) {
        return {
            apis: info,
            blocks: pxt.Util.values(info.byQName)
                .filter(s => !!s.attributes.block && !!s.attributes.blockId && (s.kind != ts.pxt.SymbolKind.EnumMember))
        }
    }

    export function genMarkdown(pkg: string, apiInfo: ApisInfo): U.Map<string> {
        let files: U.Map<string> = {};
        let infos = Util.values(apiInfo.byQName);
        let namespaces = infos.filter(si => si.kind == SymbolKind.Module)
        namespaces.sort(compareSymbol)

        let locStrings: U.Map<string> = {};
        let reference = ""
        const writeRef = (s: string) => reference += s + "\n"
        const writeLoc = (si: SymbolInfo) => {
            if (!si.qName) return;
            if (si.attributes.jsDoc)
                locStrings[si.qName] = si.attributes.jsDoc;
            if (si.attributes.block)
                locStrings[`${si.qName}|block`] = si.attributes.block;
            if (si.parameters)
                si.parameters.filter(pi => !!pi.description).forEach(pi => {
                    locStrings[`${si.qName}|param|${pi.name}`] = pi.description;
                })
        }
        const mapLocs = (m: U.Map<string>, name: string) => {
            let locs: U.Map<string> = {};
            Object.keys(m).sort().forEach(l => locs[l] = m[l]);
            files[pkg + name + "-strings.json"] = JSON.stringify(locs, null, 2);
        }

        writeRef(`# ${pkg} Reference`)
        writeRef('')
        writeRef('```namespaces')
        for (let ns of namespaces) {
            let syms = infos
                .filter(si => si.namespace == ns.name && !!si.attributes.help)
                .sort(compareSymbol)
            if (!syms.length) continue;

            if (!ns.attributes.block) ns.attributes.block = ns.name; // reusing this field to store localized namespace name
            writeLoc(ns);

            let nsmd = "";
            let writeNs = (s: string) => {
                nsmd += s + "\n"
            }

            writeNs(`# ${capitalize(ns.name)}`)
            writeNs('')

            if (ns.attributes.jsDoc) {
                writeNs(`${ns.attributes.jsDoc}`)
                writeNs('')
            }

            writeNs('```cards')
            syms.forEach((si, i) => {
                writeLoc(si);
                let call = `${si.namespace}.${si.name}${renderParameters(apiInfo, si)};`;
                if (i == 0)
                    writeRef(call);
                writeNs(call)
            })
            writeNs('```')

            files["reference/" + ns.name + '.md'] = nsmd;
        }
        writeRef('```');

        files[pkg + "-reference.md"] = reference;
        mapLocs(locStrings, "");
        return files;

        function hasBlock(sym: SymbolInfo): boolean {
            return !!sym.attributes.block && !!sym.attributes.blockId;
        }

        function capitalize(name: string) {
            return name[0].toUpperCase() + name.slice(1);
        }

        function urlify(name: string) {
            return name.replace(/[A-Z]/g, '-$&').toLowerCase();
        }

        function compareSymbol(l: SymbolInfo, r: SymbolInfo): number {
            let c = -(hasBlock(l) ? 1 : -1) + (hasBlock(r) ? 1 : -1);
            if (c) return c;
            c = -(l.attributes.weight || 50) + (r.attributes.weight || 50);
            if (c) return c;
            return U.strcmp(l.name, r.name);
        }
    }

    export function getApiInfo(program: Program): ApisInfo {
        let res: ApisInfo = {
            byQName: {}
        }

        let typechecker = program.getTypeChecker()

        let collectDecls = (stmt: Node) => {
            if (stmt.kind == SK.VariableStatement) {
                let vs = stmt as VariableStatement
                vs.declarationList.declarations.forEach(collectDecls)
                return
            }

            // if (!isExported(stmt as Declaration)) return; ?

            if (isExported(stmt as Declaration)) {
                if (!stmt.symbol) {
                    console.warn("no symbol", stmt)
                    return;
                }
                let qName = getFullName(typechecker, stmt.symbol)
                let si = createSymbolInfo(typechecker, qName, stmt)
                if (si)
                    res.byQName[qName] = si
            }

            if (stmt.kind == SK.ModuleDeclaration) {
                let mod = <ModuleDeclaration>stmt
                if (mod.body.kind == SK.ModuleBlock) {
                    let blk = <ModuleBlock>mod.body
                    blk.statements.forEach(collectDecls)
                }
            } else if (stmt.kind == SK.InterfaceDeclaration) {
                let iface = stmt as InterfaceDeclaration
                iface.members.forEach(collectDecls)
            } else if (stmt.kind == SK.ClassDeclaration) {
                let iface = stmt as ClassDeclaration
                iface.members.forEach(collectDecls)
            } else if (stmt.kind == SK.EnumDeclaration) {
                let e = stmt as EnumDeclaration
                e.members.forEach(collectDecls)
            }
        }

        for (let srcFile of program.getSourceFiles()) {
            srcFile.statements.forEach(collectDecls)
        }

        // store qName in symbols
        for (let qName in res.byQName)
            res.byQName[qName].qName = qName;

        return res
    }

    export function getFullName(typechecker: TypeChecker, symbol: Symbol): string {
        return typechecker.getFullyQualifiedName(symbol);
    }

    export function fillCompletionEntries(program: Program, symbols: Symbol[], r: CompletionInfo, lastApiInfo: ApisInfo) {
        let typechecker = program.getTypeChecker()

        for (let s of symbols) {
            let qName = getFullName(typechecker, s)

            if (!r.isMemberCompletion && Util.lookup(lastApiInfo.byQName, qName))
                continue; // global symbol

            if (Util.lookup(r.entries, qName))
                continue;

            let decl = s.valueDeclaration || (s.declarations || [])[0]
            if (!decl) continue;

            let si = createSymbolInfo(typechecker, qName, decl)
            if (!si) continue;

            si.isContextual = true;

            //let tmp = ts.getLocalSymbolForExportDefault(s)
            //let name = typechecker.symbolToString(tmp || s)

            r.entries[qName] = si;
        }
    }
}


namespace ts.pxt.service {
    let emptyOptions: CompileOptions = {
        fileSystem: {},
        sourceFiles: [],
        target: { isNative: false, hasHex: false },
        hexinfo: null
    }

    class Host implements LanguageServiceHost {
        opts = emptyOptions;
        fileVersions: Util.Map<number> = {};
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
            return this.opts.sourceFiles.filter(f => U.endsWith(f, ".ts"));
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
    let lastApiInfo: ApisInfo;

    export interface OpArg {
        fileName?: string;
        fileContent?: string;
        position?: number;
        options?: CompileOptions;
    }

    function fileDiags(fn: string) {
        if (!/\.ts$/.test(fn))
            return []

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

    let operations: Util.Map<(v: OpArg) => any> = {
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

            if (!data) return {}

            let typechecker = program.getTypeChecker()

            let r: CompletionInfo = {
                entries: {},
                isMemberCompletion: data.isMemberCompletion,
                isNewIdentifierLocation: data.isNewIdentifierLocation,
                isTypeLocation: false // TODO
            }

            fillCompletionEntries(program, data.symbols, r, lastApiInfo)

            return r;
        },

        compile: v => {
            return compile(v.options)
        },
        decompile: v => {
            return decompile(v.options, v.fileName);
        },

        assemble: v => {
            return {
                words: thumbInlineAssemble(v.fileContent)
            }
        },

        fileDiags: v => patchUpDiagnostics(fileDiags(v.fileName)),

        allDiags: () => {
            let global = service.getCompilerOptionsDiagnostics() || []
            let byFile = host.getScriptFileNames().map(fileDiags)
            let allD = global.concat(Util.concat(byFile))

            if (allD.length == 0) {
                let res: CompileResult = {
                    outfiles: {},
                    diagnostics: [],
                    success: true,
                    times: {}
                }
                const binOutput = compileBinary(service.getProgram(), null, host.opts, res);
                allD = binOutput.diagnostics
            }

            return patchUpDiagnostics(allD)
        },

        apiInfo: () => {
            return (lastApiInfo = getApiInfo(service.getProgram()))
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
