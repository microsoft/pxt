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

    export function snakify(s: string) {
        const up = s.toUpperCase()
        const lo = s.toLowerCase()

        // if the name is all lowercase or all upper case don't do anything
        if (s == up || s == lo)
            return s

        // if the name already has underscores (not as first character), leave it alone
        if (s.lastIndexOf("_") > 0)
            return s

        const isUpper = (i: number) => s[i] != lo[i]
        const isLower = (i: number) => s[i] != up[i]
        //const isDigit = (i: number) => /\d/.test(s[i])

        let r = ""
        let i = 0
        while (i < s.length) {
            let upperMode = isUpper(i)
            let j = i
            while (j < s.length) {
                if (upperMode && isLower(j)) {
                    // ABCd -> AB_Cd
                    if (j - i > 2) {
                        j--
                        break
                    } else {
                        // ABdefQ -> ABdef_Q
                        upperMode = false
                    }
                }
                // abcdE -> abcd_E
                if (!upperMode && isUpper(j)) {
                    break
                }
                j++
            }
            if (r) r += "_"
            r += s.slice(i, j)
            i = j
        }
        return r
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
            case SK.Constructor:
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

    function createSymbolInfo(typechecker: TypeChecker, qName: string, stmt: Node, opts: CompileOptions): SymbolInfo {
        function typeOf(tn: TypeNode, n: Node, stripParams = false) {
            let t = typechecker.getTypeAtLocation(n)
            if (!t) return "None"
            if (stripParams) {
                t = t.getCallSignatures()[0].getReturnType()
            }
            const readableName = typechecker.typeToString(t, undefined, TypeFormatFlags.UseFullyQualifiedType)

            // TypeScript 2.0.0+ will assign constant variables numeric literal types which breaks the
            // type checking we do in the blocks
            // This can be a number literal '7' or a union type of them '0 | 1 | 2'
            if (/^\d/.test(readableName)) {
                return "number";
            }

            if (readableName == "this") {
                return getFullName(typechecker, t.symbol);
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
                qName,
                namespace: m ? m[1] : "",
                name: m ? m[2] : qName,
                attributes,
                pkg,
                extendsTypes,
                retType:
                    stmt.kind == SyntaxKind.Constructor ? "void" :
                        kind == SymbolKind.Module ? "" :
                            typeOf(decl.type, decl, hasParams),
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
                        initializer:
                            p.initializer ? p.initializer.getText() :
                                attributes.paramDefl[n] || (p.questionToken ? "undefined" : undefined),
                        default: attributes.paramDefl[n],
                        properties: props,
                        handlerParameters: parameters,
                        options: options,
                        isEnum
                    }
                }),
                snippet: ts.isFunctionLike(stmt) ? null : undefined
            }

            switch (r.kind) {
                case SymbolKind.EnumMember:
                    r.pyName = snakify(r.name).toUpperCase()
                    break
                case SymbolKind.Variable:
                case SymbolKind.Module:
                case SymbolKind.Method:
                case SymbolKind.Property:
                case SymbolKind.Function:
                    r.pyName = snakify(r.name).toLowerCase()
                    break
                case SymbolKind.Enum:
                case SymbolKind.Class:
                case SymbolKind.Interface:
                default:
                    r.pyName = r.name
                    break
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
        const enumMembers = infos.filter(si => si.kind == SymbolKind.EnumMember)
            .sort(compareSymbols);

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
    }

    export function hasBlock(sym: SymbolInfo): boolean {
        return !!sym.attributes.block && !!sym.attributes.blockId;
    }

    let symbolKindWeight: pxt.Map<number>;
    export function compareSymbols(l: SymbolInfo, r: SymbolInfo): number {
        let c = -(hasBlock(l) ? 1 : -1) + (hasBlock(r) ? 1 : -1);
        if (c) return c;

        if (!symbolKindWeight) {
            symbolKindWeight = {};
            symbolKindWeight[SymbolKind.Variable] = 100;
            symbolKindWeight[SymbolKind.Function] = 99;
            symbolKindWeight[SymbolKind.Property] = 98;
            symbolKindWeight[SymbolKind.Method] = 97;
            symbolKindWeight[SymbolKind.Module] = 90
            symbolKindWeight[SymbolKind.Class] = 89;
            symbolKindWeight[SymbolKind.Enum] = 81;
            symbolKindWeight[SymbolKind.EnumMember] = 80;
        }

        // favor functions
        c = -(symbolKindWeight[l.kind] || 0) + (symbolKindWeight[r.kind] || 0);
        if (c) return c;

        c = -(l.attributes.weight || 50) + (r.attributes.weight || 50);
        if (c) return c;

        return U.strcmp(l.name, r.name);
    }


    export function getApiInfo(opts: CompileOptions, program: Program, legacyOnly = false): ApisInfo {
        return internalGetApiInfo(opts, program, legacyOnly).apis;
    }

    export function internalGetApiInfo(opts: CompileOptions, program: Program, legacyOnly = false) {
        const res: ApisInfo = {
            byQName: {},
            jres: opts.jres
        }
        const qNameToNode: pxt.Map<Declaration> = {};
        const typechecker = program.getTypeChecker()
        const collectDecls = (stmt: Node) => {
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
                qNameToNode[qName] = stmt as Declaration;
                let si = createSymbolInfo(typechecker, qName, stmt, opts)
                if (si) {
                    let existing = U.lookup(res.byQName, qName)
                    if (existing) {
                        // we can have a function and an interface of the same name
                        if (existing.kind == SymbolKind.Interface && si.kind != SymbolKind.Interface) {
                            // save existing entry
                            res.byQName[qName + "@type"] = existing
                        } else if (existing.kind != SymbolKind.Interface && si.kind == SymbolKind.Interface) {
                            res.byQName[qName + "@type"] = si
                            si = existing
                        } else {
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
                    }
                    if (stmt.parent &&
                        (stmt.parent.kind == SK.ClassDeclaration || stmt.parent.kind == SK.InterfaceDeclaration) &&
                        !isStatic(stmt as Declaration))
                        si.isInstance = true
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

            if (si.pyName) {
                if (si.namespace) {
                    let par = res.byQName[si.namespace]
                    if (par) {
                        si.pyQName = par.pyQName + "." + si.pyName
                    } else {
                        // shouldn't happen
                        pxt.log("namespace missing: " + si.namespace)
                        si.pyQName = si.namespace + "." + si.pyName
                    }
                } else {
                    si.pyQName = si.pyName
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

        return {
            apis: res,
            decls: qNameToNode
        }
    }

    export function getFullName(typechecker: TypeChecker, symbol: Symbol): string {
        if ((symbol as any).isBogusSymbol)
            return symbol.name
        return typechecker.getFullyQualifiedName(symbol);
    }

    /*
    export function fillCompletionEntries(program: Program, symbols: Symbol[], r: CompletionInfo, apiInfo: ApisInfo, opts: CompileOptions) {
        const typechecker = program.getTypeChecker()

        for (let s of symbols) {
            let qName = getFullName(typechecker, s)
            const gsi = Util.lookup(apiInfo.byQName, qName);

            // filter out symbols starting with __
            if (gsi && /^__/.test(gsi.name))
                continue;

            if (!r.isMemberCompletion && gsi)
                continue; // global symbol

            if (Util.lookup(r.entries, qName))
                continue;

            const decl = s.valueDeclaration || (s.declarations || [])[0]
            if (!decl) continue;

            const si = createSymbolInfo(typechecker, qName, decl, opts)
            if (!si) continue;

            si.isContextual = true;

            r.entries[qName] = si;
        }
    }*/
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

    interface CachedApisInfo {
        apis: ApisInfo;
        decls: pxt.Map<Declaration>;
    }

    let lastApiInfo: CachedApisInfo;
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
                lastBlocksInfo = getBlocksInfo(lastApiInfo.apis, bannedCategories);
            }
            return lastBlocksInfo;
        }
    }

    function addApiInfo(opts: CompileOptions) {
        if (!opts.apisInfo && opts.target.preferredEditor == pxt.PYTHON_PROJECT_NAME) {
            if (!lastApiInfo)
                lastApiInfo = internalGetApiInfo(opts, service.getProgram())
            opts.apisInfo = U.clone(lastApiInfo.apis)
        }
    }

    const operations: pxt.Map<(v: OpArg) => any> = {
        reset: () => {
            service.cleanupSemanticCache();
            lastApiInfo = null
            host.setOpts(emptyOptions)
        },

        setOptions: v => {
            host.setOpts(v.options)
        },

        syntaxInfo: v => {
            let src: string = v.fileContent
            if (v.fileContent) {
                host.setFile(v.fileName, v.fileContent);
            }
            let opts = U.flatClone(host.opts)
            opts.fileSystem[v.fileName] = src
            addApiInfo(opts);
            opts.syntaxInfo = {
                position: v.position,
                type: v.infoType
            };
            (pxt as any).py.py2ts(opts)
            return opts.syntaxInfo
        },

        getCompletions: v => {
            let src: string = v.fileContent
            if (v.fileContent) {
                host.setFile(v.fileName, v.fileContent);
            }
            const python = /\.py$/.test(v.fileName);
            let dotIdx = -1
            let complPosition = -1
            for (let i = v.position - 1; i >= 0; --i) {
                if (src[i] == ".") {
                    dotIdx = i
                    break
                }
                if (!/\w/.test(src[i]))
                    break
                if (complPosition == -1)
                    complPosition = i
            }

            if (dotIdx == v.position - 1) {
                // "foo.|" -> we add "_" as field name to minimize the risk of a parse error
                src = src.slice(0, v.position) + "_" + src.slice(v.position)
            } else if (complPosition == -1) {
                src = src.slice(0, v.position) + "_" + src.slice(v.position)
                complPosition = v.position
            }

            if (dotIdx != -1)
                complPosition = dotIdx

            //console.log(v.fileContent.slice(v.position - 20, v.position) + "<X>" + v.fileContent.slice(v.position, v.position + 20))

            const entries: pxt.Map<SymbolInfo> = {};
            const r: CompletionInfo = {
                entries: [],
                isMemberCompletion: dotIdx != -1,
                isNewIdentifierLocation: true,
                isTypeLocation: false
            }

            let opts = U.flatClone(host.opts)
            opts.fileSystem[v.fileName] = src
            addApiInfo(opts);
            opts.syntaxInfo = {
                position: complPosition,
                type: r.isMemberCompletion ? "memberCompletion" : "identifierCompletion"
            };
            (pxt as any).py.py2ts(opts)
            let symbols = opts.syntaxInfo.symbols || []

            for (let si of symbols) {
                if (
                    /^__/.test(si.name) || // ignore members starting with __
                    /^__/.test(si.namespace) || // ignore namespaces starting with _-
                    si.attributes.hidden ||
                    si.attributes.deprecated
                ) continue; // ignore 
                entries[si.qName] = si
                const n = lastApiInfo.decls[si.qName];
                if (isFunctionLike(n)) {
                    if (python)
                        si.pySnippet = getSnippet(lastApiInfo.apis.byQName, si, n, python);
                    else
                        si.snippet = getSnippet(lastApiInfo.apis.byQName, si, n, python);
                }
            }
            //fillCompletionEntries(program, data.symbols, r, lastApiInfo.apis, host.opts)

            // sort entries
            r.entries = pxt.Util.values(entries);
            r.entries.sort(compareSymbols);

            return r;
        },

        compile: v => {
            addApiInfo(v.options)
            return compile(v.options)
        },
        decompile: v => {
            const bannedCategories = v.blocks ? v.blocks.bannedCategories : undefined;
            return decompile(v.options, v.fileName, false, bannedCategories);
        },
        pydecompile: v => {
            let program = getTSProgram(v.options);
            return (pxt as any).py.decompileToPython(program, v.fileName);
        },
        assemble: v => {
            return {
                words: processorInlineAssemble(host.opts.target, v.fileContent)
            }
        },

        py2ts: v => {
            addApiInfo(v.options)
            return (pxt as any).py.py2ts(v.options)
        },

        fileDiags: v => patchUpDiagnostics(fileDiags(v.fileName)),

        allDiags: () => {
            addApiInfo(host.opts)

            let convDiag = runConversions(host.opts)
            if (convDiag.length > 0)
                return convDiag

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
            lastApiInfo = internalGetApiInfo(host.opts, service.getProgram());
            return lastApiInfo.apis;
        },
        snippet: v => {
            const o = v.snippet;
            if (!lastApiInfo) return undefined;
            const fn = lastApiInfo.apis.byQName[o.qName];
            const n = lastApiInfo.decls[o.qName];
            if (!fn || !n || !ts.isFunctionLike(n))
                return undefined;
            return ts.pxtc.service.getSnippet(lastApiInfo.apis.byQName, fn, n as FunctionLikeDeclaration, !!o.python)
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
                let builtinSearchSet: SearchInfo[] = [];

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

                // filter out built-ins from the main search set as those 
                // should come from the built-in search set 
                let builtinBlockIds: pxt.Map<Boolean> = {}
                builtinSearchSet.forEach(b => builtinBlockIds[b.id] = true)
                searchSet = searchSet.filter(b => !(b.id in builtinBlockIds));

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

    export function getSnippet(apis: pxt.Map<SymbolInfo>, fn: SymbolInfo, n: ts.FunctionLikeDeclaration, python?: boolean): string {
        let findex = 0;
        let preStmt = "";

        const attrs = fn.attributes;
        const checker = service && service.getProgram().getTypeChecker();
        const args = n.parameters ? n.parameters.filter(param => !param.initializer && !param.questionToken).map(param => {
            const typeNode = param.type;
            if (!typeNode) return python ? "None" : "null";

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
                case SK.BooleanKeyword: return python ? "False" : "false";
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
                    return emitFn(name);
            }

            const type = checker && checker.getTypeAtLocation(param);
            if (type) {
                if (isObjectType(type)) {
                    const typeSymbol = apis[checker.getFullyQualifiedName(type.symbol)];
                    const snip = typeSymbol && typeSymbol.attributes && (python ? typeSymbol.attributes.pySnippet : typeSymbol.attributes.snippet);
                    if (snip) return snip;
                    if (type.objectFlags & ts.ObjectFlags.Anonymous) {
                        const sigs = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
                        if (sigs && sigs.length) {
                            return getFunctionString(sigs[0]);
                        }
                        return emitFn(name);
                    }
                }
                if (type.flags & ts.TypeFlags.EnumLike) {
                    return getDefaultEnumValue(type);
                }
                if (type.flags & ts.TypeFlags.NumberLike) {
                    return "0";
                }
            }
            return python ? "None" : "null";
        }) : [];

        let fnName = ""
        if (n.kind == SK.Constructor) {
            fnName = getSymbolName(n.symbol) || n.parent.name.getText();
        } else {
            fnName = getSymbolName(n.symbol) || n.name.getText();
        }

        let snippetPrefix = (fn.attributes.blockNamespace || fn.namespace);
        let isInstance = false;
        let addNamespace = false;
        let namespaceToUse = "";

        const element = fn as pxtc.SymbolInfo;
        if (element.attributes.block) {
            if (element.attributes.defaultInstance) {
                snippetPrefix = element.attributes.defaultInstance;
                if (python)
                    snippetPrefix = snakify(snippetPrefix);
            }
            else if (element.namespace) { // some blocks don't have a namespace such as parseInt
                const nsInfo = apis[element.namespace];
                if (nsInfo.attributes.fixedInstances) {
                    let instances = Util.values(apis)
                    let getExtendsTypesFor = function (name: string) {
                        return instances
                            .filter(v => v.extendsTypes)
                            .filter(v => v.extendsTypes.reduce((x, y) => x || y.indexOf(name) != -1, false))
                            .reduce((x, y) => x.concat(y.extendsTypes), [])
                    }
                    // if blockNamespace exists, e.g., "pins", use it for snippet
                    // else use nsInfo.namespace, e.g., "motors"
                    namespaceToUse = element.attributes.blockNamespace || nsInfo.namespace || "";
                    // all fixed instances for this namespace
                    let fixedInstances = instances.filter(value =>
                        value.kind === pxtc.SymbolKind.Variable &&
                        value.attributes.fixedInstance
                    );
                    // first try to get fixed instances whose retType matches nsInfo.name
                    // e.g., DigitalPin
                    let exactInstances = fixedInstances.filter(value =>
                        value.retType == nsInfo.qName)
                        .sort((v1, v2) => v1.name.localeCompare(v2.name));
                    if (exactInstances.length) {
                        snippetPrefix = `${getName(exactInstances[0])}`
                    } else {
                        // second choice: use fixed instances whose retType extends type of nsInfo.name
                        // e.g., nsInfo.name == AnalogPin and instance retType == PwmPin
                        let extendedInstances = fixedInstances.filter(value =>
                            getExtendsTypesFor(nsInfo.qName).indexOf(value.retType) !== -1)
                            .sort((v1, v2) => v1.name.localeCompare(v2.name));
                        if (extendedInstances.length) {
                            snippetPrefix = `${getName(extendedInstances[0])}`
                        }
                    }
                    isInstance = true;
                    addNamespace = true;
                }
                else if (element.kind == pxtc.SymbolKind.Method || element.kind == pxtc.SymbolKind.Property) {
                    const params = pxt.blocks.compileInfo(element);
                    if (params.thisParameter) {
                        snippetPrefix = params.thisParameter.defaultValue || params.thisParameter.definitionName;
                        if (python)
                            snippetPrefix = snakify(snippetPrefix);
                    }
                    isInstance = true;
                }
                else if (nsInfo.kind === pxtc.SymbolKind.Class) {
                    return undefined;
                }
            }
        }

        let snippet = `${fnName}(${args.join(', ')})`;
        let insertText = snippetPrefix ? `${snippetPrefix}.${snippet}` : snippet;
        insertText = addNamespace ? `${firstWord(namespaceToUse)}.${insertText}` : insertText;

        if (attrs && attrs.blockSetVariable)
            insertText = `${python ? "" : "let "}${python ? snakify(attrs.blockSetVariable) : attrs.blockSetVariable} = ${insertText}`;

        return preStmt + insertText;

        function getSymbolName(symbol: Symbol) {
            if (checker) {
                const qName = getFullName(checker, symbol);
                const si = apis[qName];
                if (si)
                    return getName(si);
            }
            return undefined;
        }

        function getName(si: SymbolInfo) {
            return python ? si.pyName : si.name;
        }

        function firstWord(s: string): string {
            const i = s.indexOf('.');
            return i < 0 ? s : s.substring(0, i);
        }

        function getFunctionString(functionSignature: ts.Signature) {
            let functionArgument = "()";
            let returnValue = "";

            let displayParts = (ts as any).mapToDisplayParts((writer: ts.DisplayPartsSymbolWriter) => {
                checker.getSymbolDisplayBuilder().buildSignatureDisplay(functionSignature, writer);
            });

            let returnType = checker.getReturnTypeOfSignature(functionSignature);

            if (returnType.flags & ts.TypeFlags.NumberLike)
                returnValue = "return 0";
            else if (returnType.flags & ts.TypeFlags.StringLike)
                returnValue = "return \"\"";
            else if (returnType.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral))
                returnValue = python ? "return False" : "return false";

            let displayPartsStr = ts.displayPartsToString(displayParts);
            functionArgument = displayPartsStr.substr(0, displayPartsStr.lastIndexOf(":"));

            if (python) {
                const n = "fn" + (findex++) + functionArgument;
                preStmt += `def ${n}:\n  ${returnValue || "pass"}\n`;
                return n.replace(/\(\)$/, '');
            } else return `function ${functionArgument} {\n    ${returnValue}\n}`;
        }

        function emitFn(n: string): string {
            if (python) {
                n = snakify(n);
                preStmt += `def ${n}():\n  pass\n`;
                return n;
            } else return `function () {}`;
        }

        function getDefaultEnumValue(t: Type) {
            // Note: AFAIK this is NOT guranteed to get the same default as you get in
            // blocks. That being said, it should get the first declared value. Only way
            // to guarantee an API has the same default in blocks and in TS is to actually
            // set a default on the parameter in its comment attributes
            if (checker && t.symbol && t.symbol.declarations && t.symbol.declarations.length) {
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
}
