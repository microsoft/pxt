// TODO: enable reference so we don't need to use: (pxt as any).py
//      the issue is that this creates a circular dependency. This
//      is easily handled if we used proper TS modules.
//// <reference path="../../built/pxtpy.d.ts"/>

namespace ts.pxtc {

    export const placeholderChar = "◊";

    export interface FunOverride {
        n: string;
        t: any;
        scale?: number;
        snippet?: string;
    }

    export const ts2PyFunNameMap: pxt.Map<FunOverride> = {
        "Math.trunc": { n: "int", t: ts.SyntaxKind.NumberKeyword, snippet: "int(0)" },
        "Math.min": { n: "min", t: ts.SyntaxKind.NumberKeyword, snippet: "min(0, 0)" },
        "Math.max": { n: "max", t: ts.SyntaxKind.NumberKeyword, snippet: "max(0, 0)" },
        "Math.abs": { n: "abs", t: ts.SyntaxKind.NumberKeyword, snippet: "abs(0)" },
        "console.log": { n: "print", t: ts.SyntaxKind.VoidKeyword, snippet: 'print(":)")' },
        ".length": { n: "len", t: ts.SyntaxKind.NumberKeyword },
        ".toLowerCase()": { n: "string.lower", t: ts.SyntaxKind.StringKeyword },
        ".toUpperCase()": { n: "string.upper", t: ts.SyntaxKind.StringKeyword },
        ".charCodeAt(0)": { n: "ord", t: ts.SyntaxKind.NumberKeyword },
        "pins.createBuffer": { n: "bytearray", t: ts.SyntaxKind.Unknown },
        "pins.createBufferFromArray": { n: "bytes", t: ts.SyntaxKind.Unknown },
        "control.createBuffer": { n: "bytearray", t: ts.SyntaxKind.Unknown },
        "control.createBufferFromArray": { n: "bytes", t: ts.SyntaxKind.Unknown },
        "!!": { n: "bool", t: ts.SyntaxKind.BooleanKeyword },
        "Array.push": { n: "Array.append", t: ts.SyntaxKind.Unknown },
        "parseInt": { n: "int", t: ts.SyntaxKind.NumberKeyword, snippet: 'int("0")' },
        "_py.range": { n: "range", t: ts.SyntaxKind.Unknown, snippet: 'range(4)' }
    }


    export function emitPyTypeFromTypeNode(s: ts.TypeNode): string {
        if (!s || !s.kind) return null;
        switch (s.kind) {
            case ts.SyntaxKind.StringKeyword:
                return "str"
            case ts.SyntaxKind.NumberKeyword:
                // Note, "real" python expects this to be "float" or "int", we're intentionally diverging here
                return "number"
            case ts.SyntaxKind.BooleanKeyword:
                return "bool"
            case ts.SyntaxKind.VoidKeyword:
                return "None"
            case ts.SyntaxKind.FunctionType:
                return emitFuncPyType(s as ts.FunctionTypeNode)
            case ts.SyntaxKind.ArrayType: {
                let t = s as ts.ArrayTypeNode
                let elType = emitPyTypeFromTypeNode(t.elementType)
                return `List[${elType}]`
            }
            case ts.SyntaxKind.TypeReference: {
                let t = s as ts.TypeReferenceNode
                let nm = t.typeName && t.typeName.getText ? t.typeName.getText() : "";
                return nm
            }
            case ts.SyntaxKind.AnyKeyword:
                return "any"
            default:
                pxt.tickEvent("depython.todo.tstypenodetopytype", { kind: s.kind })
                return ``
        }
        // // TODO translate type
        // return s.getText()
    }

    export function emitPyTypeFromTsType(s: ts.Type): string {
        if (!s || !s.flags) return null;
        switch (s.flags) {
            case ts.TypeFlags.String:
                return "str"
            case ts.TypeFlags.Number:
                // Note: "real" python expects this to be "float" or "int", we're intentionally diverging here
                return "number"
            case ts.TypeFlags.Boolean:
                return "bool"
            case ts.TypeFlags.Void:
                return "None"
            case ts.TypeFlags.Any:
                return "any"
            default:
                pxt.tickEvent("depython.todo.tstypetopytype", { kind: s.flags })
                return ``
        }
    }

    function emitFuncPyType(s: ts.FunctionTypeNode): string {
        let returnType = emitPyTypeFromTypeNode(s.type)
        let params = s.parameters
            .map(p => p.type) // python type syntax doesn't allow names
            .map(emitPyTypeFromTypeNode)

        // "Real" python expects this to be "Callable[[arg1, arg2], ret]", we're intentionally changing to "(arg1, arg2) -> ret"
        return `(${params.join(", ")}) -> ${returnType}`
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



    function createSymbolInfo(typechecker: TypeChecker, qName: string, stmt: Node): SymbolInfo {
        function typeOf(tn: TypeNode, n: Node, stripParams = false): string {
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
            let pkgs: string[] = null

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
                fileName: stmt.getSourceFile().fileName,
                attributes,
                pkg,
                pkgs,
                extendsTypes,
                isStatic: decl.modifiers?.some(m => m.kind === SyntaxKind.StaticKeyword),
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
                                    type: typechecker.typeToString(typechecker.getTypeOfSymbolAtLocation(sym, p), undefined, TypeFormatFlags.UseFullyQualifiedType)
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
                    const pyTypeString = (p.type && emitPyTypeFromTypeNode(p.type))
                        || (paramType && emitPyTypeFromTsType(paramType))
                        || "unknown";
                    const initializer = p.initializer ? p.initializer.getText() :
                        getExplicitDefault(attributes, n) ||
                        (p.questionToken ? "undefined" : undefined)
                    return {
                        name: n,
                        description: desc,
                        type: typeOf(p.type, p),
                        pyTypeString,
                        initializer,
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
                    r.pyName = U.snakify(r.name).toUpperCase()
                    break
                case SymbolKind.Variable:
                case SymbolKind.Method:
                case SymbolKind.Property:
                case SymbolKind.Function:
                    r.pyName = U.snakify(r.name)
                    break
                case SymbolKind.Enum:
                case SymbolKind.Class:
                case SymbolKind.Interface:
                case SymbolKind.Module:
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
        pxtsnippet?: pxt.SnippetConfig[]; // extract localizable strings from pxtsnippets.json files
    }

    export function genDocs(pkg: string, apiInfo: ApisInfo, options: GenDocsOptions = {}): pxt.Map<string> {
        pxt.debug(`generating docs for ${pkg}`)
        pxt.debug(JSON.stringify(Object.keys(apiInfo.byQName), null, 2))

        const files: pxt.Map<string> = {};
        const infos = Util.values(apiInfo.byQName);
        const enumMembers = infos.filter(si => si.kind == SymbolKind.EnumMember)
            .sort(compareSymbols);

        const snippetStrings: pxt.Map<string> = {};
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
            if (si.attributes.group)
                locStrings[`{id:group}${si.attributes.group}`] = si.attributes.group;
            if (si.attributes.subcategory)
                locStrings[`{id:subcategory}${si.attributes.subcategory}`] = si.attributes.subcategory;
            if (si.parameters)
                si.parameters.filter(pi => !!pi.description).forEach(pi => {
                    jsdocStrings[`${si.qName}|param|${pi.name}`] = pi.description;
                })

            if (si.attributes.block) {
                locStrings[`${si.qName}|block`] = si.attributes.block;
                const comp = pxt.blocks.compileInfo(si);
                if (comp.handlerArgs?.length) {
                    for (const arg of comp.handlerArgs) {
                        locStrings[arg.localizationKey] = arg.name;
                    }
                }
            }
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
        // Localize pxtsnippets.json files
        if (options.pxtsnippet) {
            options.pxtsnippet.forEach(snippet => localizeSnippet(snippet, snippetStrings));
            mapLocs(snippetStrings, "-snippet");
        }

        return files;
    }

    function localizeSnippet(snippet: pxt.SnippetConfig, locs: pxt.Map<string>) {
        const localizableQuestionProperties = ['label', 'title', 'hint', 'errorMessage']; // TODO(jb) provide this elsewhere
        locs[snippet.label] = snippet.label;
        snippet.questions.forEach((question: pxt.Map<any>) => {
            localizableQuestionProperties.forEach((prop) => {
                if (question[prop]) {
                    locs[question[prop]] = question[prop];
                }
            });
        })
    }

    export function hasBlock(sym: SymbolInfo): boolean {
        return !!sym.attributes.block && !!sym.attributes.blockId;
    }

    let symbolKindWeight: pxt.Map<number>;
    export function compareSymbols(l: SymbolInfo, r: SymbolInfo): number {
        function cmpr(toValue: (s: SymbolInfo) => number) {
            const c = -toValue(l) + toValue(r)
            return c
        }

        // favor symbols with blocks
        let c = cmpr(s => hasBlock(s) ? 1 : -1);
        if (c) return c;

        // favor top-level symbols
        c = cmpr(s => !s.namespace ? 1 : -1)
        if (c) return c;

        // sort by symbol kind
        if (!symbolKindWeight) {
            symbolKindWeight = {};
            symbolKindWeight[SymbolKind.Variable] = 100;
            symbolKindWeight[SymbolKind.Module] = 101;
            symbolKindWeight[SymbolKind.Function] = 99;
            symbolKindWeight[SymbolKind.Property] = 98;
            symbolKindWeight[SymbolKind.Method] = 97;
            symbolKindWeight[SymbolKind.Class] = 89;
            symbolKindWeight[SymbolKind.Enum] = 81;
            symbolKindWeight[SymbolKind.EnumMember] = 80;
        }
        c = cmpr(s => symbolKindWeight[s.kind] || 0)
        if (c) return c;

        // check for a weight attribute
        c = cmpr(s => s.attributes.weight || 50)
        if (c) return c;

        return U.strcmp(l.name, r.name);
    }


    export function getApiInfo(program: Program, jres?: pxt.Map<pxt.JRes>, legacyOnly = false): ApisInfo {
        return internalGetApiInfo(program, jres, legacyOnly).apis;
    }

    export function internalGetApiInfo(program: Program, jres?: pxt.Map<pxt.JRes>, legacyOnly = false) {
        const res: ApisInfo = {
            byQName: {},
            jres: jres
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
                    pxt.warn("no symbol", stmt)
                    return;
                }
                let qName = getFullName(typechecker, stmt.symbol)
                if (stmt.kind == SK.SetAccessor)
                    qName += "@set" // otherwise we get a clash with the getter
                qNameToNode[qName] = stmt as Declaration;
                let si = createSymbolInfo(typechecker, qName, stmt)
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
                            const foundSrc = existing.attributes._source?.trim();
                            const newSrc = si.attributes._source?.trim();
                            let source = foundSrc + "\n" + newSrc;
                            // Avoid duplicating source if possible
                            if (!!foundSrc && newSrc?.indexOf(foundSrc) >= 0) {
                                source = newSrc;
                            } else if (!!newSrc && foundSrc?.indexOf(newSrc) >= 0) {
                                source = foundSrc;
                            }
                            si.attributes = parseCommentString(source);

                            // Check if the colliding symbols are namespace definitions. The same namespace can be
                            // defined in different packages/extensions, so we want to keep track of that information.
                            // That way, we can make sure each cached extension has a copy of the namespace
                            if (existing.kind === SymbolKind.Module) {
                                // Reference the existing array of packages where this namespace has been defined
                                si.pkgs = existing.pkgs || []
                                if (existing.pkg !== si.pkg) {
                                    if (!si.pkgs.find(element => element === existing.pkg)) {
                                        si.pkgs.push(existing.pkg)
                                    }
                                }
                            }
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
                let jr = U.lookup(jres || {}, jrname)
                if (jr && jr.icon && !si.attributes.iconURL) {
                    si.attributes.iconURL = jr.icon
                }
                if (jr && jr.data && !si.attributes.jresURL) {
                    si.attributes.jresURL = "data:" + jr.mimeType + ";base64," + jr.data
                }
            }

            if (si.pyName) {
                let override = U.lookup(ts2PyFunNameMap, si.qName);
                if (override && override.n) {
                    si.pyQName = override.n;
                    si.pySnippet = override.snippet;
                    si.pySnippetName = override.n;
                    si.pySnippetWithMarkers = undefined;
                } else if (si.namespace) {
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
}

namespace ts.pxtc.service {

    let emptyOptions: CompileOptions = {
        fileSystem: {},
        sourceFiles: [],
        target: { isNative: false, hasHex: false, switches: {} }
    }

    class Host implements LanguageServiceHost {
        opts = emptyOptions;
        fileVersions: pxt.Map<number> = {};
        projectVer = 0;
        pxtModulesOK: string = null;

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

        reset() {
            this.setOpts(emptyOptions)
            this.pxtModulesOK = null
        }

        setOpts(o: CompileOptions) {
            Util.iterMap(o.fileSystem, (fn, v) => {
                if (this.opts.fileSystem[fn] != v) {
                    this.fileVersions[fn] = (this.fileVersions[fn] || 0) + 1
                }
            });
            // shallow copy, but deep copy the file system
            this.opts = {
                ...o,
                fileSystem: {
                    ...o.fileSystem,
                },
            }
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
            if (f != null)
                return ScriptSnapshot.fromString(f)
            else
                return null
        }

        getNewLine() { return "\n" }
        getCurrentDirectory(): string { return "." }
        getDefaultLibFileName(options: CompilerOptions): string { return "no-default-lib.d.ts" }
        log(s: string): void { pxt.log("LOG", s) }
        trace(s: string): void { pxt.log("TRACE", s) }
        error(s: string): void { pxt.error("ERROR", s) }
        useCaseSensitiveFileNames(): boolean { return true }

        // resolveModuleNames?(moduleNames: string[], containingFile: string): ResolvedModule[];
        // directoryExists?(directoryName: string): boolean;
    }

    interface CachedApisInfo {
        apis: ApisInfo;
        decls: pxt.Map<Declaration>;
    }

    export interface CompletionSymbol {
        symbol: SymbolInfo;
        weight: number;
    }

    // compiler service context
    export let service: LanguageService;
    export let host: Host;
    export let lastApiInfo: CachedApisInfo | undefined;
    export let lastGlobalNames: pxt.Map<SymbolInfo> | undefined;
    export let lastBlocksInfo: BlocksInfo;
    export let lastLocBlocksInfo: BlocksInfo;
    // don't export, fuse is internal only
    let lastFuse: Fuse<SearchInfo>;
    let lastProjectFuse: Fuse<ProjectSearchInfo>;
    export let builtinItems: SearchInfo[];
    export let blockDefinitions: pxt.Map<pxt.blocks.BlockDefinition>;
    export let tbSubset: pxt.Map<boolean | string>;

    function fileDiags(fn: string) {
        if (!/\.ts$/.test(fn))
            return []

        let d = service.getSyntacticDiagnostics(fn)
        if (!d || !d.length)
            d = service.getSemanticDiagnostics(fn)
        if (!d) d = []
        return d
    }

    export function blocksInfoOp(apisInfoLocOverride: pxtc.ApisInfo, bannedCategories: string[]) {
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

    export function getLastApiInfo(opts: CompileOptions) {
        if (!lastApiInfo)
            lastApiInfo = internalGetApiInfo(service.getProgram(), opts.jres)
        return lastApiInfo;
    }

    export function addApiInfo(opts: CompileOptions) {
        if (!opts.apisInfo) {
            const info = getLastApiInfo(opts);
            opts.apisInfo = U.clone(info.apis)
        }
    }

    export function cloneCompileOpts(opts: CompileOptions) {
        let newOpts = pxt.U.flatClone(opts)
        newOpts.fileSystem = pxt.U.flatClone(newOpts.fileSystem)
        return newOpts
    }

    export interface ServiceOps {
        reset: () => void;
        setOptions: (v: OpArg) => void;
        syntaxInfo: (v: OpArg) => SyntaxInfo;
        getCompletions: (v: OpArg) => CompletionInfo;
        compile: (v: OpArg) => CompileResult;
        decompile: (v: OpArg) => CompileResult;
        pydecompile: (v: OpArg) => transpile.TranspileResult;
        decompileSnippets: (v: OpArg) => string[];
        assemble: (v: OpArg) => {
            words: number[];
        };
        py2ts: (v: OpArg) => transpile.TranspileResult;
        fileDiags: (v: OpArg) => KsDiagnostic[];
        allDiags: () => CompileResult;
        format: (v: OpArg) => {
            formatted: string;
            pos: number;
        };
        apiInfo: () => ApisInfo;
        snippet: (v: OpArg) => string;
        blocksInfo: (v: OpArg) => BlocksInfo;
        apiSearch: (v: OpArg) => SearchInfo[];
        projectSearch: (v: OpArg) => ProjectSearchInfo[];
        projectSearchClear: () => void;
    };

    export type OpRes =
        string | void | SyntaxInfo | CompletionInfo | CompileResult
        | transpile.TranspileResult
        | { words: number[]; }
        | KsDiagnostic[]
        | { formatted: string; pos: number; }
        | ApisInfo | BlocksInfo | ProjectSearchInfo[]
        | {};

    export type OpError = { errorMessage: string };

    export type OpResOrError = OpRes | OpError;

    export function IsOpErr(res: OpResOrError): res is OpError {
        return !!(res as OpError).errorMessage;
    }

    const operations: ServiceOps = {
        reset: () => {
            service = ts.createLanguageService(host)
            lastApiInfo = undefined
            lastGlobalNames = undefined
            host.reset()
        },

        setOptions: v => {
            host.setOpts(v.options)
        },

        syntaxInfo: v => {
            let src: string = v.fileContent
            if (v.fileContent) {
                host.setFile(v.fileName, v.fileContent);
            }
            let opts = cloneCompileOpts(host.opts)
            opts.fileSystem[v.fileName] = src
            addApiInfo(opts);
            opts.syntaxInfo = {
                position: v.position,
                type: v.infoType
            };

            const isPython = v.fileName.endsWith(".py");
            const isSymbolReq = opts.syntaxInfo.type === "symbol";
            const isSignatureReq = opts.syntaxInfo.type === "signature";

            if (isPython) {
                let res = transpile.pyToTs(opts)
                if (res.globalNames)
                    lastGlobalNames = res.globalNames
            }
            else {
                // typescript
                opts.ast = true;
                host.setOpts(opts)
                const res = runConversionsAndCompileUsingService()
                const prog = service.getProgram()
                const tsAst = prog.getSourceFile(v.fileName)
                const tc = prog.getTypeChecker()

                if (isSymbolReq || isSignatureReq) {
                    let tsNode = findInnerMostNodeAtPosition(tsAst, v.position);
                    if (tsNode) {
                        if (isSymbolReq) {
                            const symbol = tc.getSymbolAtLocation(tsNode);
                            if (symbol) {
                                let pxtSym = getPxtSymbolFromTsSymbol(symbol, opts.apisInfo, tc)
                                opts.syntaxInfo.symbols = [pxtSym];
                                opts.syntaxInfo.beginPos = tsNode.getStart();
                                opts.syntaxInfo.endPos = tsNode.getEnd();
                            }
                        }
                        else if (isSignatureReq) {
                            const pxtCall = tsNode?.pxt?.callInfo
                            if (pxtCall) {
                                const pxtSym = opts.apisInfo.byQName[pxtCall.qName]
                                opts.syntaxInfo.symbols = [pxtSym];
                                opts.syntaxInfo.beginPos = tsNode.getStart();
                                opts.syntaxInfo.endPos = tsNode.getEnd();

                                const tsCall = getParentCallExpression(tsNode)
                                if (tsCall) {
                                    const argIdx = findCurrentCallArgIdx(tsCall, tsNode, v.position)
                                    opts.syntaxInfo.auxResult = argIdx
                                }
                            }
                        }
                    }
                }
            }

            if (isSymbolReq && !opts.syntaxInfo.symbols?.length) {
                const possibleKeyword = getWordAtPosition(v.fileContent, v.position);
                if (possibleKeyword) {
                    // In python if range() is used in a for-loop, we don't convert
                    // it to a function call when going to TS (we just convert it to
                    // a regular for-loop). Because our symbol detection is based off
                    // of the TS, we won't get a symbol result for range at this position
                    // in the file. This special case makes sure we return the same help
                    // as a standalone call to range().
                    if (isPython && possibleKeyword.text === "range") {
                        const apiInfo = getLastApiInfo(opts).apis;
                        if (apiInfo.byQName["_py.range"]) {
                            opts.syntaxInfo.symbols = [apiInfo.byQName["_py.range"]];
                            opts.syntaxInfo.beginPos = possibleKeyword.start;
                            opts.syntaxInfo.endPos = possibleKeyword.end;
                        }
                    }
                    else {
                        const help = getHelpForKeyword(possibleKeyword.text, isPython);

                        if (help) {
                            opts.syntaxInfo.auxResult = {
                                documentation: help,
                                displayString: displayStringForKeyword(possibleKeyword.text, isPython),
                            };
                            opts.syntaxInfo.beginPos = possibleKeyword.start;
                            opts.syntaxInfo.endPos = possibleKeyword.end;
                        }
                    }
                }
            }

            if (opts.syntaxInfo.symbols?.length) {
                const apiInfo = getLastApiInfo(opts).apis;
                if (isPython) {
                    opts.syntaxInfo.symbols = opts.syntaxInfo.symbols.map(s => {
                        // symbol info gathered during the py->ts compilation phase
                        // is less precise than the symbol info created when doing
                        // a pass over ts, so we prefer the latter if available
                        return apiInfo.byQName[s.qName] || s
                    })
                }

                if (isSymbolReq) {
                    opts.syntaxInfo.auxResult = opts.syntaxInfo.symbols.map(s =>
                        displayStringForSymbol(s, isPython, apiInfo))
                }
            }

            return opts.syntaxInfo
        },

        getCompletions: v => {
            return getCompletions(v)
        },

        compile: v => {
            host.setOpts(v.options)
            const res = runConversionsAndCompileUsingService()
            timesToMs(res);
            return res
        },
        decompile: v => {
            host.setOpts(v.options)
            return decompile(service.getProgram(), v.options, v.fileName, false);
        },
        pydecompile: v => {
            host.setOpts(v.options)
            return transpile.tsToPy(service.getProgram(), v.fileName);

        },
        decompileSnippets: v => {
            host.setOpts(v.options)
            return decompileSnippets(service.getProgram(), v.options, false);
        },
        assemble: v => {
            return {
                words: processorInlineAssemble(host.opts.target, v.fileContent)
            }
        },

        py2ts: v => {
            addApiInfo(v.options)
            return transpile.pyToTs(v.options)
        },

        fileDiags: v => patchUpDiagnostics(fileDiags(v.fileName)),

        allDiags: () => {
            // not comapatible with incremental compilation
            // host.opts.noEmit = true
            // TODO: "allDiags" sounds like it's just reading state
            // but it's actually kicking off a full compile. We should
            // do better about caching and returning cached results from
            // previous compiles.
            let res = runConversionsAndCompileUsingService();
            timesToMs(res);
            if (host.opts.target.switches.time)
                pxt.log("DIAG-TIME", res.times)
            return res
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
            lastApiInfo = internalGetApiInfo(service.getProgram(), host.opts.jres);
            return lastApiInfo.apis;
        },
        snippet: v => {
            const o = v.snippet;
            if (!lastApiInfo) return undefined;
            const fn = lastApiInfo.apis.byQName[o.qName];
            const n = lastApiInfo.decls[o.qName];
            if (!fn || !n || !ts.isFunctionLike(n))
                return undefined;

            const isPython = !!o.python

            // determine which names are taken for auto-generated variable names
            let takenNames: pxt.Map<SymbolInfo> = {}
            if (isPython && lastGlobalNames) {
                takenNames = lastGlobalNames
            } else {
                takenNames = lastApiInfo.apis.byQName
            }

            const { bannedCategories, screenSize } = v.runtime;
            const { apis } = lastApiInfo;
            const blocksInfo = blocksInfoOp(apis, bannedCategories);
            const checker = service && service.getProgram().getTypeChecker();
            // needed for blocks that have parent wraps like music.play(...)
            // with this snippet call, we are dragging a block from the toolbox,
            // so we want to include the parent snippet
            const includeParentSnippet = true;
            const snippetContext = {
                apis,
                blocksInfo,
                takenNames,
                bannedCategories,
                screenSize,
                checker,
                includeParentSnippet
            }
            const snippetNode = getSnippet(snippetContext, fn, n as FunctionLikeDeclaration, isPython)
            const snippet = snippetStringify(snippetNode)
            return snippet
        },
        blocksInfo: v => blocksInfoOp(v as any, v.blocks && v.blocks.bannedCategories),
        apiSearch: v => {
            const SEARCH_RESULT_COUNT = 7;
            const search = v.search;
            const blockInfo = blocksInfoOp(search.localizedApis, v.blocks && v.blocks.bannedCategories); // caches

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

            // Fill default parameters in block string
            const computeBlockString = (symbol: SymbolInfo, skipParent = false, paramMap?: pxt.Map<string>): string => {
                const toolboxParent = symbol.attributes?.toolboxParent || symbol.attributes?.duplicateWithToolboxParent;
                const toolboxArgument = symbol.attributes?.toolboxParentArgument || symbol.attributes?.duplicateWithToolboxParentArgument;

                if (toolboxParent && !skipParent) {
                    const parentSymbol = blockInfo.blocksById[toolboxParent];

                    if (parentSymbol) {
                        const childString = computeBlockString(symbol, true);

                        const paramMap = {
                            [toolboxArgument || "*"]: childString
                        };

                        return computeBlockString(parentSymbol, true, paramMap);
                    }
                }

                if (symbol.attributes?._def) {
                    let block = [];
                    const blockDef = symbol.attributes._def;
                    const compileInfo = pxt.blocks.compileInfo(symbol);

                    // Construct block string from parsed blockdef
                    for (let part of blockDef.parts) {
                        switch (part.kind) {
                            case "label":
                                block.push(part.text);
                                break;
                            case "param":
                                // In order, preference default value, var name, param name, blockdef param name
                                let actualParam = compileInfo.definitionNameToParam[part.name];

                                let valueString = actualParam?.defaultValue
                                    || part.varName
                                    || actualParam?.actualName
                                    || part.name;

                                if (paramMap?.["*"]) {
                                    valueString = paramMap["*"];
                                    delete paramMap["*"];
                                }
                                else if (paramMap?.[actualParam.definitionName]) {
                                    valueString = paramMap[actualParam.definitionName];
                                }

                                block.push(valueString);
                                break;
                        }
                    }

                    return block.join(" ");
                }
                return symbol.attributes.block;
            }

            // Join parameter jsdoc into a string
            const computeParameterString = (symbol: SymbolInfo): string => {
                const paramHelp = symbol.attributes?.paramHelp;
                if (paramHelp) {
                    Object.keys(paramHelp).map(p => paramHelp[p]).join(" ");
                }
                return "";
            }

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
                        block: computeBlockString(s),
                        params: computeParameterString(s),
                        jsdoc: s.attributes.jsDoc,
                        localizedCategory: tbSubset && typeof tbSubset[s.attributes.blockId] === "string"
                            ? tbSubset[s.attributes.blockId] as string : undefined,
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
                        { name: 'params', weight: 0.0625 },
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

    export function runConversionsAndCompileUsingService(): CompileResult {
        addApiInfo(host.opts)
        const prevFS = U.flatClone(host.opts.fileSystem);
        let res = runConversionsAndStoreResults(host.opts);
        if (res?.globalNames) {
            lastGlobalNames = res.globalNames
        }
        const newFS = host.opts.fileSystem
        host.opts.fileSystem = prevFS
        for (let k of Object.keys(newFS))
            host.setFile(k, newFS[k]) // update version numbers
        res.fileSystem = U.flatClone(newFS)
        if (res.diagnostics.length == 0) {
            host.opts.skipPxtModulesEmit = false
            host.opts.skipPxtModulesTSC = false
            const currKey = host.opts.target.isNative ? "native" : "js"
            if (!host.opts.target.switches.noIncr && host.pxtModulesOK) {
                host.opts.skipPxtModulesTSC = true
                if (host.opts.noEmit)
                    host.opts.skipPxtModulesEmit = true
                else if (host.opts.target.isNative)
                    host.opts.skipPxtModulesEmit = false
                // don't cache emit when debugging pxt_modules/*
                else if (host.pxtModulesOK == "js" && (!host.opts.breakpoints || host.opts.justMyCode))
                    host.opts.skipPxtModulesEmit = true
            }
            let ts2asm = compile(host.opts, service)
            res = {
                sourceMap: res.sourceMap,
                fileSystem: res.fileSystem,
                ...ts2asm,
            }
            if (res.needsFullRecompile || ((!res.success || res.diagnostics.length) && host.opts.clearIncrBuildAndRetryOnError)) {
                pxt.debug("triggering full recompile")
                pxt.tickEvent("compile.fullrecompile")
                host.opts.skipPxtModulesEmit = false;
                ts2asm = compile(host.opts, service);
                res = {
                    sourceMap: res.sourceMap,
                    ...ts2asm,
                }
            }
            if (res.diagnostics.every(d => !isPxtModulesFilename(d.fileName)))
                host.pxtModulesOK = currKey
            if (res.ast) {
                // keep api info up to date after each compile
                let ai = internalGetApiInfo(res.ast);
                if (ai)
                    lastApiInfo = ai
            }
        }
        return res;
    }

    export function performOperation<T extends keyof ServiceOps>(op: T, arg: OpArg):
        OpResOrError {
        init();
        let res: OpResOrError = null;

        if (operations.hasOwnProperty(op)) {
            try {
                let opFn = operations[op]
                res = opFn(arg) || {}
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
