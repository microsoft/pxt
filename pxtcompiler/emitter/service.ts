namespace ts.pxtc {

    export const placeholderChar = "◊";
    export const defaultImgLit = `
. . . . .
. . . . .
. . # . .
. . . . .
. . . . .
`

    function renderDefaultVal(apis: pxtc.ApisInfo, p: pxtc.ParameterDesc, imgLit: boolean, cursorMarker: string): string {
        if (p.initializer) return p.initializer
        if (p.default) return p.default
        if (p.type == "number") return "0"
        if (p.type == "boolean") return "false"
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

    export function renderCall(apiInfo: pxtc.ApisInfo, si: SymbolInfo): string {
        return `${si.namespace}.${si.name}${renderParameters(apiInfo, si)};`;
    }

    export function renderParameters(apis: pxtc.ApisInfo, si: SymbolInfo, cursorMarker: string = ''): string {
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
            case SK.GetAccessor:
            case SK.SetAccessor:
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
            case SK.ClassDeclaration:
                return SymbolKind.Class;
            case SK.InterfaceDeclaration:
                return SymbolKind.Interface;
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

    function isReadonly(decl: Declaration) {
        return decl.modifiers && decl.modifiers.some(m => m.kind == SK.ReadonlyKeyword)
    }

    function createSymbolInfo(typechecker: TypeChecker, qName: string, stmt: Node): SymbolInfo {
        function typeOf(tn: TypeNode, n: Node, stripParams = false) {
            let t = typechecker.getTypeAtLocation(n)
            if (!t) return "None"
            if (stripParams) {
                t = t.getCallSignatures()[0].getReturnType()
            }
            const readableName = typechecker.typeToString(t, undefined, TypeFormatFlags.UseFullyQualifiedType)

            // TypeScript 2.0.0+ will assign constant variables numeric literal types which breaks the
            // type checking we do in the blocks
            if (!isNaN(Number(readableName))) {
                return "number";
            }

            return readableName;
        }

        let kind = getSymbolKind(stmt)
        if (kind != SymbolKind.None) {
            let decl: FunctionLikeDeclaration = stmt as any;
            let attributes = parseComments(decl)

            if (attributes.weight < 0)
                return null;

            let m = /^(.*)\.(.*)/.exec(qName)
            let hasParams = kind == SymbolKind.Function || kind == SymbolKind.Method

            let pkg: string = null

            let src = getSourceFileOfNode(stmt)
            if (src) {
                let m = /^pxt_modules\/([^\/]+)/.exec(src.fileName)
                if (m)
                    pkg = m[1]
            }

            let extendsTypes: string[] = undefined

            if (kind == SymbolKind.Class || kind == SymbolKind.Interface) {
                let cl = stmt as ClassLikeDeclaration
                extendsTypes = []
                if (cl.heritageClauses)
                    for (let h of cl.heritageClauses) {
                        if (h.types) {
                            for (let t of h.types) {
                                extendsTypes.push(typeOf(t, t))
                            }
                        }
                    }
            }

            if (kind == SymbolKind.Enum || kind === SymbolKind.EnumMember) {
                (extendsTypes || (extendsTypes = [])).push("Number");
            }

            let r: SymbolInfo = {
                kind,
                namespace: m ? m[1] : "",
                name: m ? m[2] : qName,
                attributes,
                pkg,
                extendsTypes,
                retType: kind == SymbolKind.Module ? "" : typeOf(decl.type, decl, hasParams),
                parameters: !hasParams ? null : Util.toArray(decl.parameters).map((p, i) => {
                    let n = getName(p)
                    let desc = attributes.paramHelp[n] || ""
                    let minVal = attributes.paramMin && attributes.paramMin[n];
                    let maxVal = attributes.paramMax && attributes.paramMax[n];
                    let m = /\beg\.?:\s*(.+)/.exec(desc)
                    let props: PropertyDesc[];
                    let parameters: PropertyDesc[];
                    if (p.type && p.type.kind === SK.FunctionType) {
                        const callBackSignature = typechecker.getSignatureFromDeclaration(p.type as FunctionTypeNode);
                        const callbackParameters = callBackSignature.getParameters();
                        if (attributes.mutate === "objectdestructuring") {
                            assert(callbackParameters.length > 0);
                            props = typechecker.getTypeAtLocation(callbackParameters[0].valueDeclaration).getProperties().map(prop => {
                                return { name: prop.getName(), type: typechecker.typeToString(typechecker.getTypeOfSymbolAtLocation(prop, callbackParameters[0].valueDeclaration)) }
                            });
                        }
                        else {
                            parameters = callbackParameters.map((sym, i) => {
                                return {
                                    name: sym.getName(),
                                    type: typechecker.typeToString(typechecker.getTypeOfSymbolAtLocation(sym, p))
                                };
                            });
                        }
                    }
                    let options: pxt.Map<PropertyOption> = {};
                    const paramType = typechecker.getTypeAtLocation(p);
                    let isEnum = paramType && !!(paramType.flags & (TypeFlags.Enum | TypeFlags.EnumLiteral));

                    if (attributes.block && attributes.paramShadowOptions) {
                        const argNames: string[] = []
                        attributes.block.replace(/%(\w+)/g, (f, n) => {
                            argNames.push(n)
                            return ""
                        });
                        if (attributes.paramShadowOptions[argNames[i]]) {
                            options['fieldEditorOptions'] = { value: attributes.paramShadowOptions[argNames[i]] }
                        }
                    }
                    if (minVal) options['min'] = { value: minVal };
                    if (maxVal) options['max'] = { value: maxVal };
                    return {
                        name: n,
                        description: desc,
                        type: typeOf(p.type, p),
                        initializer: p.initializer ? p.initializer.getText() : attributes.paramDefl[n],
                        default: attributes.paramDefl[n],
                        properties: props,
                        handlerParameters: parameters,
                        options: options,
                        isEnum
                    }
                }),
                snippet: service.getSnippet(decl, attributes)
            }

            if (stmt.kind === SK.GetAccessor ||
                ((stmt.kind === SK.PropertyDeclaration || stmt.kind === SK.PropertySignature) && isReadonly(stmt as Declaration))) {
                r.isReadOnly = true
            }

            return r
        }
        return null;
    }

    export interface GenDocsOptions {
        package?: boolean;
        locs?: boolean;
        docs?: boolean;
    }

    export function genDocs(pkg: string, apiInfo: ApisInfo, options: GenDocsOptions = {}): pxt.Map<string> {
        pxt.debug(`generating docs for ${pkg}`)
        pxt.debug(JSON.stringify(Object.keys(apiInfo.byQName), null, 2))

        const files: pxt.Map<string> = {};
        const infos = Util.values(apiInfo.byQName);
        const enumMembers = infos.filter(si => si.kind == SymbolKind.EnumMember).sort(compareSymbol);

        const locStrings: pxt.Map<string> = {};
        const jsdocStrings: pxt.Map<string> = {};
        const writeLoc = (si: SymbolInfo) => {
            if (!options.locs || !si.qName) {
                return;
            }
            if (/^__/.test(si.name))
                return; // skip functions starting with __
            pxt.debug(`loc: ${si.qName}`)
            // must match blockly loader
            if (si.kind != SymbolKind.EnumMember) {
                const ns = ts.pxtc.blocksCategory(si);
                if (ns)
                    locStrings[`{id:category}${ns}`] = ns;
            }
            if (si.attributes.jsDoc)
                jsdocStrings[si.qName] = si.attributes.jsDoc;
            if (si.attributes.block)
                locStrings[`${si.qName}|block`] = si.attributes.block;
            if (si.attributes.group)
                locStrings[`{id:group}${si.attributes.group}`] = si.attributes.group;
            if (si.attributes.subcategory)
                locStrings[`{id:subcategory}${si.attributes.subcategory}`] = si.attributes.subcategory;
            if (si.parameters)
                si.parameters.filter(pi => !!pi.description).forEach(pi => {
                    jsdocStrings[`${si.qName}|param|${pi.name}`] = pi.description;
                })
        }
        const mapLocs = (m: pxt.Map<string>, name: string) => {
            if (!options.locs) return;
            const locs: pxt.Map<string> = {};
            Object.keys(m).sort().forEach(l => locs[l] = m[l]);
            files[pkg + name + "-strings.json"] = JSON.stringify(locs, null, 2);
        }
        for (const info of infos) {
            const isNamespace = info.kind == SymbolKind.Module;
            if (isNamespace) {
                if (!infos.filter(si => si.namespace == info.name && !!si.attributes.jsDoc)[0])
                    continue; // nothing in namespace
                if (!info.attributes.block) info.attributes.block = info.name; // reusing this field to store localized namespace name
            }
            writeLoc(info);
        }
        if (options.locs)
            enumMembers.forEach(em => {
                if (em.attributes.block) locStrings[`${em.qName}|block`] = em.attributes.block;
                if (em.attributes.jsDoc) locStrings[em.qName] = em.attributes.jsDoc;
            });
        mapLocs(locStrings, "");
        mapLocs(jsdocStrings, "-jsdoc");
        return files;

        function hasBlock(sym: SymbolInfo): boolean {
            return !!sym.attributes.block && !!sym.attributes.blockId;
        }

        function capitalize(name: string) {
            return name[0].toUpperCase() + name.slice(1);
        }

        function compareSymbol(l: SymbolInfo, r: SymbolInfo): number {
            let c = -(hasBlock(l) ? 1 : -1) + (hasBlock(r) ? 1 : -1);
            if (c) return c;
            c = -(l.attributes.weight || 50) + (r.attributes.weight || 50);
            if (c) return c;
            return U.strcmp(l.name, r.name);
        }
    }

    export function getApiInfo(opts: CompileOptions, program: Program, legacyOnly = false): ApisInfo {
        let res: ApisInfo = {
            byQName: {},
            jres: opts.jres
        }

        let typechecker = program.getTypeChecker()

        let collectDecls = (stmt: Node) => {
            if (stmt.kind == SK.VariableStatement) {
                let vs = stmt as VariableStatement
                vs.declarationList.declarations.forEach(collectDecls)
                return
            }

            if (isExported(stmt as Declaration)) {
                if (!stmt.symbol) {
                    console.warn("no symbol", stmt)
                    return;
                }
                let qName = getFullName(typechecker, stmt.symbol)
                if (stmt.kind == SK.SetAccessor)
                    qName += "@set" // otherwise we get a clash with the getter
                let si = createSymbolInfo(typechecker, qName, stmt)
                if (si) {
                    let existing = U.lookup(res.byQName, qName)
                    if (existing) {
                        si.attributes = parseCommentString(
                            existing.attributes._source + "\n" +
                            si.attributes._source)
                        if (existing.extendsTypes) {
                            si.extendsTypes = si.extendsTypes || []
                            existing.extendsTypes.forEach(t => {
                                if (si.extendsTypes.indexOf(t) === -1) {
                                    si.extendsTypes.push(t);
                                }
                            })
                        }
                    }
                    res.byQName[qName] = si
                }
            }

            if (stmt.kind == SK.ModuleDeclaration) {
                let mod = <ModuleDeclaration>stmt
                if (mod.body.kind == SK.ModuleBlock) {
                    let blk = <ModuleBlock>mod.body
                    blk.statements.forEach(collectDecls)
                } else if (mod.body.kind == SK.ModuleDeclaration) {
                    collectDecls(mod.body)
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

        let toclose: SymbolInfo[] = []

        // store qName in symbols
        for (let qName in res.byQName) {
            let si = res.byQName[qName]
            si.qName = qName;
            si.attributes._source = null
            if (si.extendsTypes && si.extendsTypes.length) toclose.push(si)

            let jrname = si.attributes.jres
            if (jrname) {
                if (jrname == "true") jrname = qName
                let jr = U.lookup(opts.jres || {}, jrname)
                if (jr && jr.icon && !si.attributes.iconURL) {
                    si.attributes.iconURL = jr.icon
                }
                if (jr && jr.data && !si.attributes.jresURL) {
                    si.attributes.jresURL = "data:" + jr.mimeType + ";base64," + jr.data
                }
            }
        }

        // transitive closure of inheritance
        let closed: pxt.Map<boolean> = {}
        let closeSi = (si: SymbolInfo) => {
            if (U.lookup(closed, si.qName)) return;
            closed[si.qName] = true
            let mine: pxt.Map<boolean> = {}
            mine[si.qName] = true
            for (let e of si.extendsTypes || []) {
                mine[e] = true
                let psi = res.byQName[e]
                if (psi) {
                    closeSi(psi)
                    for (let ee of psi.extendsTypes) mine[ee] = true
                }
            }
            si.extendsTypes = Object.keys(mine)
        }
        toclose.forEach(closeSi)

        if (legacyOnly) {
            // conflicts with pins.map()
            delete res.byQName["Array.map"]
        }

        return res
    }

    export function getFullName(typechecker: TypeChecker, symbol: Symbol): string {
        if ((symbol as any).isBogusSymbol)
            return symbol.name
        return typechecker.getFullyQualifiedName(symbol);
    }

    export function fillCompletionEntries(program: Program, symbols: Symbol[], r: CompletionInfo, apiInfo: ApisInfo) {
        let typechecker = program.getTypeChecker()

        for (let s of symbols) {
            let qName = getFullName(typechecker, s)

            if (!r.isMemberCompletion && Util.lookup(apiInfo.byQName, qName))
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


namespace ts.pxtc.service {
    let emptyOptions: CompileOptions = {
        fileSystem: {},
        sourceFiles: [],
        target: { isNative: false, hasHex: false, switches: {} },
        hexinfo: null
    }

    class Host implements LanguageServiceHost {
        opts = emptyOptions;
        fileVersions: pxt.Map<number> = {};
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
            Util.iterMap(o.fileSystem, (fn, v) => {
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
        getDefaultLibFileName(options: CompilerOptions): string { return "no-default-lib.d.ts" }
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
    let lastBlocksInfo: BlocksInfo;
    let lastLocBlocksInfo: BlocksInfo;
    let lastFuse: Fuse<SearchInfo>;
    let lastProjectFuse: Fuse<ProjectSearchInfo>;
    let builtinItems: SearchInfo[];
    let blockDefinitions: pxt.Map<pxt.blocks.BlockDefinition>;
    let tbSubset: pxt.Map<boolean | string>;

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

    const blocksInfoOp = (apisInfoLocOverride?: pxtc.ApisInfo, bannedCategories?: string[]) => {
        if (apisInfoLocOverride) {
            if (!lastLocBlocksInfo) {
                lastLocBlocksInfo = getBlocksInfo(apisInfoLocOverride, bannedCategories);
            }
            return lastLocBlocksInfo;
        } else {
            if (!lastBlocksInfo) {
                lastBlocksInfo = getBlocksInfo(lastApiInfo, bannedCategories);
            }
            return lastBlocksInfo;
        }
    }

    const operations: pxt.Map<(v: OpArg) => any> = {
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
            const bannedCategories = v.blocks ? v.blocks.bannedCategories : undefined;
            return decompile(v.options, v.fileName, false, bannedCategories);
        },
        assemble: v => {
            return {
                words: processorInlineAssemble(host.opts.target, v.fileContent)
            }
        },

        fileDiags: v => patchUpDiagnostics(fileDiags(v.fileName)),

        allDiags: () => {
            let global = service.getCompilerOptionsDiagnostics() || []
            let byFile = host.getScriptFileNames().map(fileDiags)
            let allD: ReadonlyArray<Diagnostic> = global.concat(Util.concat(byFile))

            if (allD.length == 0) {
                let res: CompileResult = {
                    outfiles: {},
                    diagnostics: [],
                    success: true,
                    times: {}
                }
                const program = service.getProgram();
                const sources = program.getSourceFiles();
                // entry point is main.ts or the last file which should be the test file if any
                const entryPoint = sources.filter(f => f.fileName == "main.ts")[0] || sources[sources.length - 1];
                const binOutput = compileBinary(program, null, host.opts, res, entryPoint ? entryPoint.fileName : "main.ts");
                allD = binOutput.diagnostics
            }

            return patchUpDiagnostics(allD)
        },

        format: v => {
            const formatOptions = v.format;
            return pxtc.format(formatOptions.input, formatOptions.pos);
        },

        apiInfo: () => {
            lastBlocksInfo = undefined;
            lastFuse = undefined;
            if (host.opts === emptyOptions) {
                // Host was reset, don't load apis with empty options
                return undefined;
            }
            return lastApiInfo = getApiInfo(host.opts, service.getProgram());
        },
        blocksInfo: v => blocksInfoOp(v as any),
        apiSearch: v => {
            const SEARCH_RESULT_COUNT = 7;
            const search = v.search;
            const bannedCategories = v.blocks ? v.blocks.bannedCategories : undefined;
            const blockInfo = blocksInfoOp(search.localizedApis, bannedCategories); // cache

            if (search.localizedStrings) {
                pxt.Util.setLocalizedStrings(search.localizedStrings);
            }

            // Computes the preferred tooltip or block text to use for search (used for blocks that have multiple tooltips or block texts)
            const computeSearchProperty = (tooltipOrBlock: string | pxt.Map<string>, preferredSearch: string, blockDef: pxt.blocks.BlockDefinition): string => {
                if (!tooltipOrBlock) {
                    return undefined;
                }
                if (typeof tooltipOrBlock === "string") {
                    // There is only one tooltip or block text; use it
                    return tooltipOrBlock;
                }
                if (preferredSearch) {
                    // The block definition specifies a preferred tooltip / block text to use for search; use it
                    return (<any>tooltipOrBlock)[preferredSearch];
                }
                // The block definition does not specify which tooltip or block text to use for search; join all values with a space
                return Object.keys(tooltipOrBlock).map(k => (<pxt.Map<string>>tooltipOrBlock)[k]).join(" ");
            };

            if (!builtinItems) {
                builtinItems = [];
                blockDefinitions = pxt.blocks.blockDefinitions();
                for (const id in blockDefinitions) {
                    const blockDef = blockDefinitions[id];

                    if (blockDef.operators) {
                        for (const op in blockDef.operators) {
                            const opValues = blockDef.operators[op];
                            opValues.forEach(v => builtinItems.push({
                                id,
                                name: blockDef.name,
                                jsdoc: typeof blockDef.tooltip === "string" ? <string>blockDef.tooltip : (<pxt.Map<string>>blockDef.tooltip)[v],
                                block: v,
                                field: [op, v],
                                builtinBlock: true
                            }));
                        }
                    }
                    else {
                        builtinItems.push({
                            id,
                            name: blockDef.name,
                            jsdoc: computeSearchProperty(blockDef.tooltip, blockDef.tooltipSearch, blockDef),
                            block: computeSearchProperty(blockDef.block, blockDef.blockTextSearch, blockDef),
                            builtinBlock: true
                        });
                    }
                }
            }

            let subset: SymbolInfo[];

            const fnweight = (fn: ts.pxtc.SymbolInfo): number => {
                const fnw = fn.attributes.weight || 50;
                const nsInfo = blockInfo.apis.byQName[fn.namespace];
                const nsw = nsInfo ? (nsInfo.attributes.weight || 50) : 50;
                const ad = (nsInfo ? nsInfo.attributes.advanced : false) || fn.attributes.advanced
                const weight = (nsw * 1000 + fnw) * (ad ? 1 : 1e6);
                return weight;
            }

            if (!lastFuse || search.subset) {
                const weights: pxt.Map<number> = {};
                let builtinSearchSet: SearchInfo[];

                if (search.subset) {
                    tbSubset = search.subset;
                    builtinSearchSet = builtinItems.filter(s => !!tbSubset[s.id]);
                }

                if (tbSubset) {
                    subset = blockInfo.blocks.filter(s => !!tbSubset[s.attributes.blockId]);
                }
                else {
                    subset = blockInfo.blocks;
                    builtinSearchSet = builtinItems;
                }

                let searchSet: SearchInfo[] = subset.map(s => {
                    const mappedSi: SearchInfo = {
                        id: s.attributes.blockId,
                        qName: s.qName,
                        name: s.name,
                        namespace: s.namespace,
                        block: s.attributes.block,
                        jsdoc: s.attributes.jsDoc,
                        localizedCategory: tbSubset && typeof tbSubset[s.attributes.blockId] === "string"
                            ? tbSubset[s.attributes.blockId] as string : undefined
                    };
                    return mappedSi;
                });


                let mw = 0;
                subset.forEach(b => {
                    const w = weights[b.qName] = fnweight(b);
                    mw = Math.max(mw, w);
                });

                searchSet = searchSet.concat(builtinSearchSet);

                const fuseOptions = {
                    shouldSort: true,
                    threshold: 0.6,
                    location: 0,
                    distance: 100,
                    maxPatternLength: 16,
                    minMatchCharLength: 2,
                    findAllMatches: false,
                    caseSensitive: false,
                    keys: [
                        { name: 'name', weight: 0.3 },
                        { name: 'namespace', weight: 0.1 },
                        { name: 'localizedCategory', weight: 0.1 },
                        { name: 'block', weight: 0.4375 },
                        { name: 'jsdoc', weight: 0.0625 }
                    ],
                    sortFn: function (a: any, b: any): number {
                        const wa = a.qName ? 1 - weights[a.item.qName] / mw : 1;
                        const wb = b.qName ? 1 - weights[b.item.qName] / mw : 1;
                        // allow 10% wiggle room for weights
                        return a.score * (1 + wa / 10) - b.score * (1 + wb / 10);
                    }
                };
                lastFuse = new Fuse(searchSet, fuseOptions);
            }
            const fns = lastFuse.search(search.term);
            return fns.slice(0, SEARCH_RESULT_COUNT);
        },
        projectSearch: v => {
            const search = v.projectSearch;
            const searchSet = search.headers;

            if (!lastProjectFuse) {
                const fuseOptions = {
                    shouldSort: true,
                    threshold: 0.6,
                    location: 0,
                    distance: 100,
                    maxPatternLength: 16,
                    minMatchCharLength: 2,
                    findAllMatches: false,
                    caseSensitive: false,
                    keys: [
                        { name: 'name', weight: 0.3 }
                    ]
                };
                lastProjectFuse = new Fuse(searchSet, fuseOptions);
            }
            const fns = lastProjectFuse.search(search.term);
            return fns;
        },
        projectSearchClear: () => {
            lastProjectFuse = undefined;
        }
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
    const defaultImgLit = `\`
. . . . .
. . . . .
. . # . .
. . . . .
. . . . .
\``;

    export function getSnippet(n: ts.SignatureDeclaration, attrs?: CommentAttrs): string {
        if (!ts.isFunctionLike(n)) {
            return undefined;
        }
        const checker = service ? service.getProgram().getTypeChecker() : undefined;
        const args = n.parameters ? n.parameters.filter(param => !param.initializer && !param.questionToken).map(param => {
            const typeNode = param.type;
            if (!typeNode) return "null";

            const name = param.name.kind === SK.Identifier ? (param.name as ts.Identifier).text : undefined;

            if (attrs && attrs.paramDefl && attrs.paramDefl[name]) {
                if (typeNode.kind == SK.StringKeyword) {
                    const defaultName = attrs.paramDefl[name];
                    return typeNode.kind == SK.StringKeyword && defaultName.indexOf(`"`) != 0 ? `"${defaultName}"` : defaultName;
                }
                return attrs.paramDefl[name];
            }
            switch (typeNode.kind) {
                case SK.StringKeyword: return (name == "leds" ? defaultImgLit : `""`);
                case SK.NumberKeyword: return "0";
                case SK.BooleanKeyword: return "false";
                case SK.ArrayType: return "[]";
                case SK.TypeReference:
                    // handled below
                    break;
                case SK.FunctionType:
                    const tn = typeNode as ts.FunctionTypeNode;
                    let functionSignature = checker ? checker.getSignatureFromDeclaration(tn) : undefined;
                    if (functionSignature) {
                        return getFunctionString(functionSignature);
                    }
                    return `function () {}`;
            }

            const type = checker ? checker.getTypeAtLocation(param) : undefined;
            if (type) {
                if (isObjectType(type)) {
                    if (type.objectFlags & ts.ObjectFlags.Anonymous) {
                        const sigs = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
                        if (sigs.length) {
                            return getFunctionString(sigs[0]);
                        }
                        return `function () {}`;
                    }
                }
                if (type.flags & ts.TypeFlags.EnumLike) {
                    return getDefaultEnumValue(type, checker);
                }
                if (type.flags & ts.TypeFlags.NumberLike) {
                    return "0";
                }
            }
            return "null";
        }) : [];


        return `${n.name.getText()}(${args.join(', ')})`;

        function getFunctionString(functionSignature: ts.Signature) {
            let functionArgument = "()";
            let returnValue = "";

            let displayParts = (ts as any).mapToDisplayParts((writer: ts.DisplayPartsSymbolWriter) => {
                checker.getSymbolDisplayBuilder().buildSignatureDisplay(functionSignature, writer);
            });

            let returnType = checker.getReturnTypeOfSignature(functionSignature);

            if (returnType.flags & ts.TypeFlags.NumberLike)
                returnValue = "return 0;";
            else if (returnType.flags & ts.TypeFlags.StringLike)
                returnValue = "return \"\";";
            else if (returnType.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral))
                returnValue = "return false;";

            let displayPartsStr = ts.displayPartsToString(displayParts);
            functionArgument = displayPartsStr.substr(0, displayPartsStr.lastIndexOf(":"));

            return `function ${functionArgument} {\n    ${returnValue}\n}`
        }
    }

    function getDefaultEnumValue(t: Type, checker: TypeChecker) {
        // Note: AFAIK this is NOT guranteed to get the same default as you get in
        // blocks. That being said, it should get the first declared value. Only way
        // to guarantee an API has the same default in blocks and in TS is to actually
        // set a default on the parameter in its comment attributes
        if (t.symbol && t.symbol.declarations && t.symbol.declarations.length) {
            for (let i = 0; i < t.symbol.declarations.length; i++) {
                const decl = t.symbol.declarations[i];
                if (decl.kind === SK.EnumDeclaration) {
                    const enumDeclaration = decl as EnumDeclaration;
                    for (let j = 0; j < enumDeclaration.members.length; j++) {
                        const member = enumDeclaration.members[i];
                        if (member.name.kind === SK.Identifier) {
                            return checker.getFullyQualifiedName(checker.getSymbolAtLocation(member.name));
                        }
                    }
                }
            }
        }

        return "0";
    }
}
