/// <reference path="../../typings/globals/fusejs/index.d.ts" />

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

            return {
                kind,
                namespace: m ? m[1] : "",
                name: m ? m[2] : qName,
                attributes,
                pkg,
                extendsTypes,
                retType: kind == SymbolKind.Module ? "" : typeOf(decl.type, decl, hasParams),
                parameters: !hasParams ? null : (decl.parameters || []).map((p, i) => {
                    let n = getName(p)
                    let desc = attributes.paramHelp[n] || ""
                    let minVal = attributes.paramMin && attributes.paramMin[n];
                    let maxVal = attributes.paramMax && attributes.paramMax[n];
                    let m = /\beg\.?:\s*(.+)/.exec(desc)
                    let props: PropertyDesc[];
                    if (attributes.mutate && p.type.kind === SK.FunctionType) {
                        const callBackSignature = typechecker.getSignatureFromDeclaration(p.type as FunctionTypeNode);
                        const callbackParameters = callBackSignature.getParameters();
                        assert(callbackParameters.length > 0);
                        props = typechecker.getTypeAtLocation(callbackParameters[0].valueDeclaration).getProperties().map(prop => {
                            return { name: prop.getName(), type: typechecker.typeToString(typechecker.getTypeOfSymbolAtLocation(prop, callbackParameters[0].valueDeclaration)) }
                        });
                    }
                    let options: Map<PropertyOption> = {};
                    const paramType = typechecker.getTypeAtLocation(p);
                    let isEnum = paramType && !!(paramType.flags & TypeFlags.Enum);

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
                        options: options,
                        isEnum
                    }
                }),
                snippet: service.getSnippet(decl, attributes)
            }
        }
        return null;
    }

    export interface GenMarkdownOptions {
        package?: boolean;
        locs?: boolean;
        docs?: boolean;
    }

    export function genMarkdown(pkg: string, apiInfo: ApisInfo, options: GenMarkdownOptions = {}): pxt.Map<string> {
        const files: pxt.Map<string> = {};
        const infos = Util.values(apiInfo.byQName);
        const namespaces = infos.filter(si => si.kind == SymbolKind.Module).sort(compareSymbol);
        const enumMembers = infos.filter(si => si.kind == SymbolKind.EnumMember).sort(compareSymbol);

        const calls: pxt.Map<string> = {};
        infos.filter(si => !!si.qName).forEach(si => calls[si.qName] = renderCall(apiInfo, si));

        const locStrings: pxt.Map<string> = {};
        const jsdocStrings: pxt.Map<string> = {};
        const helpPages: pxt.Map<string> = {};
        let reference = ""
        const nameToFilename = (n: string) => n.replace(/([A-Z])/g, function (m) { return '-' + m.toLowerCase(); });
        const writeRef = (s: string) => reference += s + "\n"
        const writeLoc = (si: SymbolInfo) => {
            if (!options.locs || !si.qName) {
                return;
            }
            // must match blockly loader
            const ns = ts.pxtc.blocksCategory(si);
            if (ns)
                locStrings[`{id:category}${ns}`] = ns;
            if (si.attributes.subcategory)
                locStrings[`{id:category}${si.attributes.subcategory}`] = si.attributes.subcategory;
            if (si.attributes.jsDoc)
                jsdocStrings[si.qName] = si.attributes.jsDoc;
            if (si.attributes.block)
                locStrings[`${si.qName}|block`] = si.attributes.block;
            if (si.parameters)
                si.parameters.filter(pi => !!pi.description).forEach(pi => {
                    jsdocStrings[`${si.qName}|param|${pi.name}`] = pi.description;
                })
        }
        const sipkg = pkg && pkg != "core" ? `\`\`\`package
${pkg}
\`\`\`
` : '';
        const writeApi = (ns: SymbolInfo, si: SymbolInfo, call: string) => {
            if (!options.docs || !si.qName) return;
            let api =
                `# ${si.name.replace(/[A-Z]/g, function (m) { return ' ' + m; })}

${si.attributes.jsDoc.split(/\n\./)[0]}

\`\`\`sig
${call}
\`\`\`

## Parameters
${(si.parameters || []).map(p => `
* **${p.name}**: [${p.type}](/reference/blocks/${p.type}), ${p.description}`)}

## Example

\`\`\`blocks
${call}
\`\`\`

## See Also

${ns.namespace ? `[${ns.namespace}](/reference/${nameToFilename(ns.namespace)})` : ``}
${sipkg}
`;
            files[`reference/${nameToFilename(ns.name)}/${nameToFilename(si.name)}.md`] = api;
        }
        const mapLocs = (m: pxt.Map<string>, name: string) => {
            if (!options.locs) return;
            const locs: pxt.Map<string> = {};
            Object.keys(m).sort().forEach(l => locs[l] = m[l]);
            files[pkg + name + "-strings.json"] = JSON.stringify(locs, null, 2);
        }
        const writePackage = (w: (s: string) => void) => {
            if (options.package) {
                w("");
                w("```package");
                w(pkg);
                w("```");
            }
        }
        const writeHelpPages = (h: pxt.Map<string>, w: (s: string) => void) => {
            w("");
            w("### See Also");
            w("")
            w(Object.keys(h).map(k => `[${k}](/reference/${h[k]})`).join(', '))
        }

        writeRef(`# ${pkg} Reference`)
        writeRef('')
        writeRef('```namespaces')
        for (const ns of namespaces) {
            const nsHelpPages: pxt.Map<string> = {};
            const syms = infos
                .filter(si => si.namespace == ns.name && !!si.attributes.jsDoc)
                .sort(compareSymbol)
            if (!syms.length) continue;

            if (!ns.attributes.block) ns.attributes.block = ns.name; // reusing this field to store localized namespace name
            writeLoc(ns);
            helpPages[ns.name] = ns.name.replace(`\s+`, `-`);

            let nsmd = "";
            const writeNs = (s: string) => {
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
                if (si.attributes.help)
                    nsHelpPages[si.name] = si.attributes.help;
                const call = calls[si.qName];
                if (i == 0)
                    writeRef(call);
                writeNs(call)
                if (!si.attributes.help)
                    writeApi(ns, si, call)
            })
            writeNs('```')
            writePackage(writeNs);
            writeHelpPages(nsHelpPages, writeNs);
            if (options.docs)
                files["reference/" + nameToFilename(ns.name) + '.md'] = nsmd;
        }
        if (options.locs)
            enumMembers.forEach(em => {
                if (em.attributes.block) locStrings[`${em.qName}|block`] = em.attributes.block;
                if (em.attributes.jsDoc) locStrings[em.qName] = em.attributes.jsDoc;
            });
        writeRef('```');
        writePackage(writeRef);
        writeHelpPages(helpPages, writeRef);

        if (options.docs)
            files[pkg + "-reference.md"] = reference;
        mapLocs(locStrings, "");
        mapLocs(jsdocStrings, "-jsdoc");
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

    export function getApiInfo(program: Program, legacyOnly = false): ApisInfo {
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
        }

        // transitive closure of inheritance
        let closed: Map<boolean> = {}
        let closeSi = (si: SymbolInfo) => {
            if (U.lookup(closed, si.qName)) return;
            closed[si.qName] = true
            let mine: Map<boolean> = {}
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
        target: { isNative: false, hasHex: false },
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
    let lastFuse: Fuse;
    let builtinItems: SearchInfo[];
    let blockDefinitions: pxt.Map<pxt.blocks.BlockDefinition>;
    let tbSubset: Map<boolean>;

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

    const blocksInfoOp = (apisInfoLocOverride?: pxtc.ApisInfo) => {
        if (apisInfoLocOverride) {
            if (!lastLocBlocksInfo) {
                lastLocBlocksInfo = getBlocksInfo(apisInfoLocOverride);
            }
            return lastLocBlocksInfo;
        } else {
            if (!lastBlocksInfo) {
                lastBlocksInfo = getBlocksInfo(lastApiInfo);
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
            return decompile(v.options, v.fileName);
        },
        compileTd: v => {
            let res = compile(v.options);
            return getApiInfo(res.ast, true);
        },

        assemble: v => {
            return {
                words: processorInlineAssemble(host.opts.target.nativeType, v.fileContent)
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

        format: v => {
            const formatOptions = v.format;
            return pxtc.format(formatOptions.input, formatOptions.pos);
        },

        apiInfo: () => {
            lastBlocksInfo = undefined;
            lastFuse = undefined;
            return lastApiInfo = getApiInfo(service.getProgram());
        },
        blocksInfo: blocksInfoOp,
        apiSearch: v => {
            const SEARCH_RESULT_COUNT = 7;
            const search = v.search;
            const blockInfo = blocksInfoOp(search.localizedApis); // cache

            if (search.localizedStrings) {
                pxt.Util.setLocalizedStrings(search.localizedStrings);
            }

            // Computes the preferred tooltip or block text to use for search (used for blocks that have multiple tooltips or block texts)
            const computeSearchProperty = (tooltipOrBlock: string | Map<string>, preferredSearch: string, blockDef: pxt.blocks.BlockDefinition): string => {
                if (!tooltipOrBlock) {
                    return;
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
                return Object.keys(tooltipOrBlock).map(k => (<Map<string>>tooltipOrBlock)[k]).join(" ");
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
                                jsdoc: typeof blockDef.tooltip === "string" ? <string>blockDef.tooltip : (<Map<string>>blockDef.tooltip)[v],
                                block: v,
                                field: [op, v]
                            }));
                        }
                    }
                    else {
                        builtinItems.push({
                            id,
                            name: blockDef.name,
                            jsdoc: computeSearchProperty(blockDef.tooltip, blockDef.tooltipSearch, blockDef),
                            block: computeSearchProperty(blockDef.block, blockDef.blockTextSearch, blockDef)
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
                    builtinSearchSet = builtinItems.filter(s => tbSubset[s.id]);
                }

                if (tbSubset) {
                    subset = blockInfo.blocks.filter(s => tbSubset[s.attributes.blockId]);
                }
                else {
                    subset = blockInfo.blocks;
                    builtinSearchSet = builtinItems;
                }

                let searchSet: SearchInfo[] = subset.map(s => {
                    return {
                        id: s.attributes.blockId,
                        qName: s.qName,
                        name: s.name,
                        nameSpace: s.namespace,
                        block: s.attributes.block,
                        jsDoc: s.attributes.jsDoc
                    };
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
                        { name: 'name', weight: 0.3125 },
                        { name: 'namespace', weight: 0.1875 },
                        { name: 'block', weight: 0.4375 },
                        { name: 'jsDoc', weight: 0.0625 }
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
        const args = n.parameters ? n.parameters.filter(param => !param.questionToken).map(param => {
            const typeNode = param.type;
            if (!typeNode) return "null";

            const name = param.name.kind === SK.Identifier ? (param.name as ts.Identifier).text : undefined;

            if (attrs && attrs.paramDefl && attrs.paramDefl[name]) {
                return attrs.paramDefl[name];
            }
            switch (typeNode.kind) {
                case SK.StringKeyword: return (name == "leds" ? defaultImgLit : `""`);
                case SK.NumberKeyword: return "0";
                case SK.BooleanKeyword: return "false";
                case SK.ArrayType: return "[]";
                case SK.TypeReference:
                    if (checker) {
                        const type = checker.getTypeAtLocation(param);
                        if (type) {
                            if (type.flags & ts.TypeFlags.Enum) {
                                if (type.symbol) {
                                    const decl = type.symbol.valueDeclaration as ts.EnumDeclaration;
                                    if (decl.members.length && decl.members[0].name.kind === SK.Identifier) {
                                        return `${type.symbol.name}.${(decl.members[0].name as ts.Identifier).text}`;
                                    }
                                }
                                return `0`;
                            }
                        }
                    }
                    break;
                case SK.FunctionType:
                    const tn = typeNode as ts.FunctionTypeNode;
                    let functionSignature = checker ? checker.getSignatureFromDeclaration(tn) : undefined;
                    if (functionSignature) {
                        return getFunctionString(functionSignature);
                    }
                    return `() => {}`;
            }

            const type = checker ? checker.getTypeAtLocation(param) : undefined;
            if (type) {
                if (type.flags & ts.TypeFlags.Anonymous) {
                    const sigs = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
                    if (sigs.length) {
                        return getFunctionString(sigs[0]);
                    }
                    return `() => {}`;
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
            else if (returnType.flags & ts.TypeFlags.Boolean)
                returnValue = "return false;";

            let displayPartsStr = ts.displayPartsToString(displayParts);
            functionArgument = displayPartsStr.substr(0, displayPartsStr.lastIndexOf(":"));

            return `${functionArgument} => {\n    ${returnValue}\n}`
        }
    }
}
