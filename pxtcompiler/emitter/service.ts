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
        "Array.indexOf": { n: "Array.index", t: ts.SyntaxKind.Unknown },
        "Array.push": { n: "Array.append", t: ts.SyntaxKind.Unknown },
        "parseInt": { n: "int", t: ts.SyntaxKind.NumberKeyword, snippet: 'int("0")' },
        "_py.range": { n: "range", t: ts.SyntaxKind.Unknown, snippet: 'range(4)' }
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

        // If the name is is all caps (like a constant), preserve it
        if (r.toUpperCase() === r) {
            return r;
        }
        return r.toLowerCase();
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
                return emitFuncType(s as ts.FunctionTypeNode)
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
                pxt.tickEvent("depython.todo", { kind: s.kind })
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
                pxt.tickEvent("depython.todo", { kind: s.flags })
                return ``
        }
    }

    function emitFuncType(s: ts.FunctionTypeNode): string {
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

    function isReadonly(decl: Declaration) {
        return decl.modifiers && decl.modifiers.some(m => m.kind == SK.ReadonlyKeyword)
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
                    r.pyName = snakify(r.name).toUpperCase()
                    break
                case SymbolKind.Variable:
                case SymbolKind.Method:
                case SymbolKind.Property:
                case SymbolKind.Function:
                    r.pyName = snakify(r.name)
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
                    console.warn("no symbol", stmt)
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
    // these weights dictate the relative ordering of certain results in the completion
    const COMPLETION_KEYWORD_WEIGHT = 0;
    const COMPLETION_DEFAULT_WEIGHT = 1;
    const COMPLETION_IN_SCOPE_VAR_WEIGHT = 5;
    const COMPLETION_MATCHING_PARAM_TYPE_WEIGHT = 10;

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
            if (f != null)
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

    interface CompletionSymbol {
        symbol: SymbolInfo;
        weight: number;
    }

    let lastApiInfo: CachedApisInfo | undefined;
    let lastGlobalNames: pxt.Map<SymbolInfo> | undefined;
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

    const blocksInfoOp = (apisInfoLocOverride: pxtc.ApisInfo, bannedCategories: string[]) => {
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

    function getLastApiInfo(opts: CompileOptions) {
        if (!lastApiInfo)
            lastApiInfo = internalGetApiInfo(service.getProgram(), opts.jres)
        return lastApiInfo;
    }

    function addApiInfo(opts: CompileOptions) {
        if (!opts.apisInfo) {
            const info = getLastApiInfo(opts);
            opts.apisInfo = U.clone(info.apis)
        }
    }

    function cloneCompileOpts(opts: CompileOptions) {
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
            service.cleanupSemanticCache();
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

            const isPython = opts.target.preferredEditor == pxt.PYTHON_PROJECT_NAME;
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
            // TODO: break out into seperate file
            const { fileName, fileContent, position, wordStartPos, wordEndPos, runtime } = v
            let src: string = fileContent
            if (fileContent) {
                host.setFile(fileName, fileContent);
            }

            const tsFilename = filenameWithExtension(fileName, "ts");

            const span: PosSpan = { startPos: wordStartPos, endPos: wordEndPos }

            const isPython = /\.py$/.test(fileName);
            let dotIdx = -1
            let complPosition = -1
            for (let i = position - 1; i >= 0; --i) {
                if (src[i] == ".") {
                    dotIdx = i
                    break
                }
                if (!/\w/.test(src[i]))
                    break
                if (complPosition == -1)
                    complPosition = i
            }

            if (dotIdx == position - 1) {
                // "foo.|" -> we add "_" as field name to minimize the risk of a parse error
                src = src.slice(0, position) + "_" + src.slice(position)
            } else if (complPosition == -1) {
                src = src.slice(0, position) + "_" + src.slice(position)
                complPosition = position
            }

            let lastNl = src.lastIndexOf("\n", position)
            lastNl = Math.max(0, lastNl)

            const isMemberCompletion = dotIdx !== -1

            if (isMemberCompletion)
                complPosition = dotIdx

            const entries: pxt.Map<CompletionSymbol> = {};
            const r: CompletionInfo = {
                entries: [],
                isMemberCompletion: isMemberCompletion,
                isNewIdentifierLocation: true,
                isTypeLocation: false,
                namespace: [],
            };

            let opts = cloneCompileOpts(host.opts)
            opts.fileSystem[fileName] = src
            addApiInfo(opts);
            opts.syntaxInfo = {
                position: complPosition,
                type: r.isMemberCompletion ? "memberCompletion" : "identifierCompletion"
            };

            let resultSymbols: CompletionSymbol[] = []

            let tsPos: number;
            if (isPython) {
                // for Python, we need to transpile into TS and map our location into
                // TS
                const res = transpile.pyToTs(opts)
                if (res.syntaxInfo && res.syntaxInfo.symbols) {
                    resultSymbols = completionSymbols(res.syntaxInfo.symbols, COMPLETION_DEFAULT_WEIGHT);
                }
                if (res.globalNames)
                    lastGlobalNames = res.globalNames

                if (!resultSymbols.length && res.globalNames) {
                    resultSymbols = completionSymbols(pxt.U.values(res.globalNames), COMPLETION_DEFAULT_WEIGHT)
                }

                // update our language host
                Object.keys(res.outfiles)
                    .forEach(k => {
                        if (k === tsFilename) {
                            host.setFile(k, res.outfiles[k])
                        }
                    })

                // convert our location from python to typescript
                if (res.sourceMap) {
                    const pySrc = src
                    const tsSrc = res.outfiles[tsFilename]
                    const srcMap = pxtc.BuildSourceMapHelpers(res.sourceMap, tsSrc, pySrc)

                    const smallest = srcMap.py.smallestOverlap(span)
                    if (smallest) {
                        tsPos = smallest.ts.startPos
                    }
                }
            } else {
                tsPos = position
                opts.ast = true;
                host.setOpts(opts)
                const res = runConversionsAndCompileUsingService()
            }

            const prog = service.getProgram()
            const tsAst = prog.getSourceFile(tsFilename)
            const tc = prog.getTypeChecker()
            let tsNode = findInnerMostNodeAtPosition(tsAst, tsPos);

            // determine the current namespace
            r.namespace = getCurrentNamespaces(tsNode)

            // special handing for member completion
            let didFindMemberCompletions = false;
            if (isMemberCompletion) {
                const propertyAccessTarget = findInnerMostNodeAtPosition(tsAst, isPython ? tsPos : dotIdx - 1)

                if (propertyAccessTarget) {
                    let type: Type;

                    const symbol = tc.getSymbolAtLocation(propertyAccessTarget);
                    if (symbol?.members?.size > 0) {
                        // Some symbols for nodes like "this" are directly the symbol for the type (e.g. "this" gives "Foo" class symbol)
                        type = tc.getDeclaredTypeOfSymbol(symbol)
                    }
                    else if (symbol) {
                        // Otherwise we use the typechecker to lookup the symbol type
                        type = tc.getTypeOfSymbolAtLocation(symbol, propertyAccessTarget);
                    }
                    else {
                        type = tc.getTypeAtLocation(propertyAccessTarget);
                    }

                    if (type) {
                        const qname = type.symbol ? tc.getFullyQualifiedName(type.symbol) : tsTypeToPxtTypeString(type, tc);

                        if (qname) {
                            const props = type.getApparentProperties()
                                .map(prop => qname + "." + prop.getName())
                                .map(propQname => lastApiInfo.apis.byQName[propQname])
                                .filter(prop => !!prop)
                                .map(prop => completionSymbol(prop, COMPLETION_DEFAULT_WEIGHT));

                            resultSymbols = props;
                            didFindMemberCompletions = true;
                        }
                    }
                }
            }

            if (resultSymbols.length === 0) {
                // if by this point we don't yet have a specialized set of results (like those for member completion or a specific type for a call expression), use all global api symbols as the start (Monaco will filter and sort these based on the prefix user input)
                resultSymbols = completionSymbols(pxt.U.values(lastApiInfo.apis.byQName), COMPLETION_DEFAULT_WEIGHT)
            }

            // special handling for call expressions
            const call = getParentCallExpression(tsNode)
            if (call) {
                // which argument are we ?
                let paramIdx = findCurrentCallArgIdx(call, tsNode, tsPos)

                // if we're not one of the arguments, are we at the
                // determine parameter idx

                if (paramIdx >= 0) {
                    const blocksInfo = blocksInfoOp(lastApiInfo.apis, runtime.bannedCategories);
                    const callSym = getCallSymbol(call)
                    if (callSym) {
                        if (paramIdx >= callSym.parameters.length)
                            paramIdx = callSym.parameters.length - 1
                        const paramType = getParameterTsType(callSym, paramIdx, blocksInfo)
                        if (paramType) {
                            // weight the results higher if they return the correct type for the parameter
                            const matchingApis = getApisForTsType(paramType, call, tc, resultSymbols);
                            matchingApis.forEach(match => match.weight = COMPLETION_MATCHING_PARAM_TYPE_WEIGHT);
                        }
                    }
                }
            }

            if (!isPython && !didFindMemberCompletions) {
                // TODO: share this with the "syntaxinfo" service

                // use the typescript service to get symbols in scope
                tsNode = findInnerMostNodeAtPosition(tsAst, wordStartPos);
                if (!tsNode)
                    tsNode = tsAst.getSourceFile()
                let symSearch = SymbolFlags.Variable;
                let inScopeTsSyms = tc.getSymbolsInScope(tsNode, symSearch);
                // filter these to just what's at the cursor, otherwise we get things
                //  like JS Array methods we don't support
                let matchStr = tsNode.getText()
                if (matchStr !== "_") // if have a real identifier ("_" is a placeholder we added), filter to prefix matches
                    inScopeTsSyms = inScopeTsSyms.filter(s => s.name.indexOf(matchStr) >= 0)

                // convert these to pxt symbols
                let inScopePxtSyms = inScopeTsSyms
                    .map(t => {
                        let pxtSym = getPxtSymbolFromTsSymbol(t, lastApiInfo.apis, tc)
                        if (!pxtSym) {
                            let tsType = tc.getTypeOfSymbolAtLocation(t, tsNode);
                            pxtSym = makePxtSymbolFromTsSymbol(t, tsType)
                        }
                        return pxtSym
                    })
                    .filter(s => !!s)
                    .map(s => completionSymbol(s, COMPLETION_DEFAULT_WEIGHT))

                // in scope locals should be weighter higher
                inScopePxtSyms.forEach(s => s.weight += COMPLETION_IN_SCOPE_VAR_WEIGHT)

                resultSymbols = [...resultSymbols, ...inScopePxtSyms]
            }

            // add in keywords
            if (!isMemberCompletion) {
                // TODO: use more context to filter keywords
                //      e.g. "while" shouldn't show up in an expression
                let keywords: string[];
                if (isPython) {
                    let keywordsMap = (pxt as any).py.keywords as Map<boolean>
                    keywords = Object.keys(keywordsMap)
                } else {
                    keywords = [...ts.pxtc.reservedWords, ...ts.pxtc.keywordTypes]
                }
                let keywordSymbols = keywords
                    .map(makePxtSymbolFromKeyword)
                    .map(s => completionSymbol(s, COMPLETION_KEYWORD_WEIGHT))
                resultSymbols = [...resultSymbols, ...keywordSymbols]
            }

            // determine which names are taken for auto-generated variable names
            let takenNames: pxt.Map<SymbolInfo> = {}
            if (isPython && lastGlobalNames) {
                takenNames = lastGlobalNames
            } else {
                takenNames = lastApiInfo.apis.byQName
            }

            function shouldUseSymbol({ symbol: si }: CompletionSymbol) {
                let use = !(
                    /^__/.test(si.name) || // ignore members starting with __
                    /^__/.test(si.namespace) || // ignore namespaces starting with __
                    si.attributes.hidden ||
                    si.attributes.deprecated ||
                    // ignore TD_ID helpers
                    si.attributes.shim == "TD_ID" ||
                    // ignore block aliases like "_popStatement" on arrays
                    si.attributes.blockAliasFor
                )
                return use
            }

            function patchSymbolWithSnippet(si: SymbolInfo) {
                const n = lastApiInfo.decls[si.qName];
                if (isFunctionLike(n)) {
                    // snippet/pySnippet might have been set already, but even if it has,
                    // we always want to recompute it if the snippet introduces new definitions
                    // because we need to ensure name uniqueness
                    if (si.snippetAddsDefinitions
                        || (isPython && !si.pySnippet)
                        || (!isPython && !si.snippet)) {
                        const snippetNode = getSnippet(lastApiInfo.apis, takenNames, v.runtime, si, n, isPython);
                        const snippet = snippetStringify(snippetNode)
                        const snippetWithMarkers = snippetStringify(snippetNode, true)
                        const addsDefinitions = snippetAddsDefinitions(snippetNode)
                        if (isPython) {
                            si.pySnippet = snippet
                            si.pySnippetWithMarkers = snippetWithMarkers
                        }
                        else {
                            si.snippet = snippet
                            si.snippetWithMarkers = snippetWithMarkers
                        }
                        si.snippetAddsDefinitions = addsDefinitions
                    }
                }
            }

            // swap aliases, filter symbols and add snippets
            resultSymbols
                .map(sym => sym.symbol.attributes.alias ? completionSymbol(lastApiInfo.apis.byQName[sym.symbol.attributes.alias], sym.weight) : sym)
                .filter(shouldUseSymbol)
                .forEach(sym => {
                    entries[sym.symbol.qName] = sym
                    patchSymbolWithSnippet(sym.symbol)
                })

            resultSymbols = pxt.Util.values(entries)
                .filter(a => !!a && !!a.symbol)

            resultSymbols.sort(compareCompletionSymbols);

            // sort entries
            r.entries = resultSymbols.map(sym => sym.symbol);

            return r;
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
                console.log("DIAG-TIME", res.times)
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

            const snippetNode = ts.pxtc.service.getSnippet(
                lastApiInfo.apis, takenNames, v.runtime, fn, n as FunctionLikeDeclaration, isPython)
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
            const computeBlockString = (symbol: SymbolInfo): string => {
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
                                block.push(actualParam?.defaultValue
                                    || part.varName
                                    || actualParam?.actualName
                                    || part.name);
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

    function getParentCallExpression(tsNode: Node): ts.CallExpression | undefined {
        while (tsNode && !ts.isCallExpression(tsNode)) {
            if (ts.isBlock(tsNode))
                return undefined // we don't want to traverse through a block scope (e.g. an anonymous function)
            tsNode = tsNode.parent
        }
        if (tsNode && ts.isCallExpression(tsNode))
            return tsNode as ts.CallExpression
        return undefined
    }

    function findCurrentCallArgIdx(call: ts.CallExpression, tsNode: Node, tsPos: number) {
        // does our cursor syntax node trivially map to an argument?
        let paramIdx = call.arguments
            .map(a => a === tsNode)
            .indexOf(true)
        if (paramIdx >= 0)
            return paramIdx

        // is our cursor within the argument range?
        const inRange = call.arguments.pos <= tsPos && tsPos < call.end
        if (!inRange)
            return -1

        // no arguments?
        if (call.arguments.length === 0)
            return 0

        // then find which argument we're refering to
        paramIdx = 0;
        for (let a of call.arguments) {
            if (a.end <= tsPos)
                paramIdx++
            else
                break
        }
        if (!call.arguments.hasTrailingComma)
            paramIdx = Math.max(0, paramIdx - 1)

        return paramIdx
    }

    function getCallSymbol(callExp: CallExpression): SymbolInfo {// pxt symbol
        const qName = callExp?.pxt?.callInfo?.qName
        const api = lastApiInfo.apis.byQName[qName]
        return api
    }

    function getParameterTsType(callSym: SymbolInfo, paramIdx: number, blocksInfo: BlocksInfo): string | undefined {
        if (!callSym || paramIdx < 0)
            return undefined;

        const paramDesc = callSym.parameters[paramIdx]
        let result = paramDesc.type;

        // check if this parameter has a shadow block, if so use the type from that instead
        if (callSym.attributes._def) {
            const blockParams = callSym.attributes._def.parameters
            const blockParam = blockParams[paramIdx]

            const shadowId = blockParam.shadowBlockId
            if (shadowId) {
                const shadowBlk = blocksInfo.blocksById[shadowId]
                const shadowApi = lastApiInfo.apis.byQName[shadowBlk.qName]

                const isPassThrough = shadowApi.attributes.shim === "TD_ID"
                if (isPassThrough && shadowApi.parameters.length === 1) {
                    const realTyp = shadowApi.parameters[0].type
                    result = realTyp
                }
            }
        }

        return result
    }

    function getApisForTsType(pxtType: string, location: Node, tc: TypeChecker, symbols: CompletionSymbol[]): CompletionSymbol[] {
        // any apis that return this type?
        // TODO: if this becomes expensive, this can be cached between calls since the same
        // return type is likely to occur over and over.
        const apisByRetType: pxt.Map<CompletionSymbol[]> = {}
        symbols.forEach(i => {
            apisByRetType[i.symbol.retType] = [...(apisByRetType[i.symbol.retType] || []), i]
        })

        const retApis = apisByRetType[pxtType]

        // any enum members?
        let enumVals: SymbolInfo[] = []
        for (let r of retApis) {
            const asTsEnum = getTsSymbolFromPxtSymbol(r.symbol, location, SymbolFlags.Enum)
            if (asTsEnum) {
                const enumType = tc.getTypeOfSymbolAtLocation(asTsEnum, location)
                const mems = getEnumMembers(enumType)
                const enumValQNames = mems.map(e => enumMemberToQName(tc, e))
                const symbols = enumValQNames.map(n => lastApiInfo.apis.byQName[n])
                enumVals = [...enumVals, ...symbols]
            }
        }

        return [...retApis, ...completionSymbols(enumVals, COMPLETION_DEFAULT_WEIGHT)]
    }

    function runConversionsAndCompileUsingService(): CompileResult {
        addApiInfo(host.opts)
        const prevFS = U.flatClone(host.opts.fileSystem);
        let res = runConversionsAndStoreResults(host.opts);
        if (res && res.globalNames) {
            lastGlobalNames = res.globalNames
        }
        const newFS = host.opts.fileSystem
        host.opts.fileSystem = prevFS
        for (let k of Object.keys(newFS))
            host.setFile(k, newFS[k]) // update version numbers
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
            res = { sourceMap: res.sourceMap, ...ts2asm }
            if (res.needsFullRecompile) {
                pxt.log("trigering full recompile")
                pxt.tickEvent("compile.fullrecompile")
                host.opts.skipPxtModulesEmit = false
                ts2asm = compile(host.opts, service);
                res = { sourceMap: res.sourceMap, ...ts2asm }
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
    const defaultTsImgList = `\`
. . . . .
. . . . .
. . # . .
. . . . .
. . . . .
\``;
    const defaultPyImgList = `"""
. . . . .
. . . . .
. . # . .
. . . . .
. . . . .
"""`;

    export type SnippetNode = SnippetReplacePoint | string | SnippetNode[]
    export interface SnippetReplacePoint {
        default: SnippetNode;
        isLiteral?: boolean;
        isDefinition?: boolean;
    }
    function isSnippetReplacePoint(n: SnippetNode): n is SnippetReplacePoint {
        return typeof (n) === "object" && (n as SnippetReplacePoint).default !== undefined
    }
    function isSnippetNodeList(n: SnippetNode): n is SnippetNode[] {
        return typeof (n) === "object" && typeof ((n as SnippetNode[]).length) === "number"
    }
    export function snippetStringify(snippet: SnippetNode, emitMonacoReplacementPoints = false): string {
        const namesToReplacementNumbers: { [key: string]: number } = {}
        let nextNum: number = 1

        return internalSnippetStringify(snippet)

        function internalSnippetStringify(snippet: SnippetNode): string {
            // The format for monaco snippets is:
            //      foo(${1:bar}, ${2:baz},  ${1:bar})
            // so both instances of "bar" will start highlighted, then tab will cycle to "baz", etc.
            if (isSnippetReplacePoint(snippet)) {
                if (emitMonacoReplacementPoints) {
                    if (snippetHasReplacementPoints(snippet.default)) {
                        return internalSnippetStringify(snippet.default)
                    }

                    const name = snippetStringify(snippet.default, false)
                    let num = namesToReplacementNumbers[name]
                    if (!num || snippet.isLiteral) {
                        num = nextNum
                        nextNum++
                        namesToReplacementNumbers[name] = num
                    }
                    if (name.indexOf(".") >= 0 && name.indexOf(" ") < 0) {
                        // heuristic: if we're going to have a replacement for a qualified name, only
                        // replace the last part. E.g. "SpriteEffects.spray" we want "SpriteEffects.${spray}" not "${SpriteEffects.spray}"
                        let nmParts = name.split(".")
                        nmParts[nmParts.length - 1] = "${" + num + ":" + nmParts[nmParts.length - 1] + "}"
                        return nmParts.join(".")
                    } else {
                        return "${" + num + ":" + name + "}"
                    }
                } else {
                    return internalSnippetStringify(snippet.default)
                }
            } else if (isSnippetNodeList(snippet)) {
                return snippet
                    .map(s => internalSnippetStringify(s))
                    .join("")
            } else {
                return snippet
            }
        }
    }
    export function snippetHasReplacementPoints(snippet: SnippetNode): boolean {
        if (isSnippetReplacePoint(snippet)) {
            return true
        } else if (isSnippetNodeList(snippet)) {
            return snippet
                .map(snippetHasReplacementPoints)
                .reduce((p, n) => p || n, false)
        } else {
            return false
        }

    }
    export function snippetAddsDefinitions(snippet: SnippetNode): boolean {
        if (isSnippetReplacePoint(snippet)) {
            return snippet.isDefinition || snippetAddsDefinitions(snippet.default)
        } else if (isSnippetNodeList(snippet)) {
            return snippet
                .map(snippetAddsDefinitions)
                .reduce((p, n) => p || n, false)
        } else {
            return false
        }
    }

    export function getSnippet(apis: ApisInfo, takenNames: pxt.Map<SymbolInfo>, runtimeOps: pxt.RuntimeOptions, fn: SymbolInfo, decl: ts.FunctionLikeDeclaration, python?: boolean, recursionDepth = 0): SnippetNode {
        // TODO: a lot of this is duplicate logic with blocklyloader.ts:buildBlockFromDef; we should
        //  unify these approaches
        const PY_INDENT: string = (pxt as any).py.INDENT;
        const fileType = python ? "python" : "typescript";

        let preStmt: SnippetNode[] = [];

        let fnName = ""
        if (decl.kind == SK.Constructor) {
            fnName = getSymbolName(decl.symbol) || decl.parent.name.getText();
        } else {
            fnName = getSymbolName(decl.symbol) || decl.name.getText();
        }

        if (python)
            fnName = snakify(fnName);

        function getUniqueName(inName: string): string {
            if (takenNames[inName])
                return ts.pxtc.decompiler.getNewName(inName, takenNames, false)
            return inName
        }

        const attrs = fn.attributes;

        if (attrs.shim === "TD_ID" && recursionDepth && decl.parameters.length) {
            return getParameterDefault(decl.parameters[0]);
        }

        const checker = service && service.getProgram().getTypeChecker();

        const blocksInfo = blocksInfoOp(apis, runtimeOps.bannedCategories);
        const blocksById = blocksInfo.blocksById

        // TODO: move out of getSnippet for general reuse
        function getParameterDefault(param: ParameterDeclaration): SnippetNode {
            const typeNode = param.type;
            if (!typeNode)
                return python ? "None" : "null"

            const name = param.name.kind === SK.Identifier ? (param.name as ts.Identifier).text : undefined;

            // check for explicit default in the attributes
            if (attrs && attrs.paramDefl && attrs.paramDefl[name]) {
                if (typeNode.kind == SK.AnyKeyword) {
                    const defaultName = attrs.paramDefl[name].toUpperCase();
                    if (!Number.isNaN(+defaultName)) {
                        // try to parse as a number
                        typeNode.kind = SK.NumberKeyword;
                    } else if (defaultName == "FALSE" || defaultName == "TRUE") {
                        // try to parse as a bool
                        typeNode.kind = SK.BooleanKeyword;
                    } else if (defaultName.includes(".")) {
                        // try to parse as an enum
                        typeNode.kind = SK.EnumKeyword;
                    } else {
                        // otherwise it'll be a string
                        typeNode.kind = SK.StringKeyword;
                    }
                }
                if (typeNode.kind == SK.StringKeyword) {
                    const defaultName = attrs.paramDefl[name];
                    const snippet = typeNode.kind == SK.StringKeyword && defaultName.indexOf(`"`) != 0 ? `"${defaultName}"` : defaultName;
                    return snippet
                }
                return attrs.paramDefl[name];
            }

            function getDefaultValueOfType(type: ts.Type): SnippetNode | undefined {
                // TODO: generalize this to handle more types
                if (type.symbol && type.symbol.flags & SymbolFlags.Enum) {
                    const defl = getDefaultEnumValue(type, python)
                    return defl
                }
                const typeSymbol = getPxtSymbolFromTsSymbol(type.symbol, apis, checker)
                if (isObjectType(type)) {
                    const snip = typeSymbol && typeSymbol.attributes && (python ? typeSymbol.attributes.pySnippet : typeSymbol.attributes.snippet);
                    if (snip)
                        return snip;
                    if (type.objectFlags & ts.ObjectFlags.Anonymous) {
                        const sigs = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
                        if (sigs && sigs.length) {
                            return createDefaultFunction(sigs[0], false);
                        }
                        return emitEmptyFn(name);
                    }
                }
                if (type.flags & ts.TypeFlags.NumberLike) {
                    return "0";
                }

                // check for fixed instances
                if (typeSymbol && typeSymbol.attributes.fixedInstances) {
                    const fixedSyms = getFixedInstancesOf(typeSymbol)
                    if (fixedSyms.length) {
                        const defl = fixedSyms[0]
                        return python ? defl.pyQName : defl.qName
                    }

                }
                return undefined
            }

            function getFixedInstancesOf(type: SymbolInfo) {
                return pxt.Util.values(apis.byQName).filter(sym => sym.kind === pxtc.SymbolKind.Variable
                    && sym.attributes.fixedInstance
                    && isSubtype(apis, sym.retType, type.qName));
            }

            function isSubtype(apis: pxtc.ApisInfo, specific: string, general: string) {
                if (specific == general) return true
                let inf = apis.byQName[specific]
                if (inf && inf.extendsTypes)
                    return inf.extendsTypes.indexOf(general) >= 0
                return false
            }

            function snippetFromSpriteEditorParams(opts: pxt.Map<string>): SnippetNode | null {
                // TODO: Generalize this to share implementation with FieldSpriteEditor in field_sprite.ts
                const parsed = {
                    initColor: 0,
                    initWidth: 16,
                    initHeight: 16,
                };

                if (opts?.sizes) {
                    const pairs = opts.sizes.split(";");
                    const sizes: [number, number][] = [];
                    for (let i = 0; i < pairs.length; i++) {
                        const pair = pairs[i].split(",");
                        if (pair.length !== 2) {
                            continue;
                        }

                        let width = parseInt(pair[0]);
                        let height = parseInt(pair[1]);

                        if (isNaN(width) || isNaN(height)) {
                            continue;
                        }

                        const screenSize = runtimeOps?.screenSize;
                        if (width < 0 && screenSize)
                            width = screenSize.width;
                        if (height < 0 && screenSize)
                            height = screenSize.height;

                        sizes.push([width, height]);
                    }
                    if (sizes.length > 0) {
                        parsed.initWidth = sizes[0][0];
                        parsed.initHeight = sizes[0][1];
                    }
                }

                parsed.initColor = withDefault(opts?.initColor, parsed.initColor);
                parsed.initWidth = withDefault(opts?.initWidth, parsed.initWidth);
                parsed.initHeight = withDefault(opts?.initHeight, parsed.initHeight);

                return pxt.sprite.imageLiteralFromDimensions(parsed.initWidth, parsed.initHeight, parsed.initColor, fileType);

                function withDefault(raw: string, def: number) {
                    const res = parseInt(raw);
                    if (isNaN(res)) {
                        return def;
                    }
                    return res;
                }
            }

            function getDefaultValueFromFieldEditor(paramName: string): SnippetNode | null {
                const blockParam = attrs._def?.parameters?.find((p) => p.name === name);
                if (!blockParam?.shadowBlockId)
                    return null
                let sym = blocksById[blockParam.shadowBlockId]
                if (!sym)
                    return null
                if (sym.attributes?.blockId !== blockParam.shadowBlockId)
                    return null
                const fieldEditor = sym.attributes?.paramFieldEditor
                if (!fieldEditor)
                    return null
                const fieldEditorName = fieldEditor[paramName]
                if (!fieldEditorName)
                    return null
                const fieldEditorOptions = sym.attributes.paramFieldEditorOptions || {}
                switch (fieldEditorName) {
                    // TODO: Generalize this to share editor mapping with blocklycustomeditor.ts
                    case "sprite": return snippetFromSpriteEditorParams(fieldEditorOptions[paramName])
                    // TODO: Handle other field editor types
                }
                return null;
            }

            function getShadowSymbol(paramName: string): SymbolInfo | null {
                // TODO: generalize and unify this with getCompletions code
                let shadowBlock = (attrs._shadowOverrides || {})[paramName]
                if (!shadowBlock) {
                    const comp = pxt.blocks.compileInfo(fn);
                    for (const param of comp.parameters) {
                        if (param.actualName === paramName) {
                            shadowBlock = param.shadowBlockId;
                            break;
                        }
                    }
                }
                if (!shadowBlock)
                    return null
                let sym = blocksById[shadowBlock]
                if (!sym)
                    return null
                if (sym.attributes.shim === "TD_ID" && sym.parameters.length) {
                    let realName = sym.parameters[0].type
                    let realSym = apis.byQName[realName]
                    sym = realSym || sym
                }
                return sym
            }

            let shadowDefFromFieldEditor = getDefaultValueFromFieldEditor(name)
            if (shadowDefFromFieldEditor) {
                return shadowDefFromFieldEditor
            }

            // check if there's a shadow override defined
            let shadowSymbol = getShadowSymbol(name)
            if (shadowSymbol) {
                let tsSymbol = getTsSymbolFromPxtSymbol(shadowSymbol, param, SymbolFlags.Enum)
                if (tsSymbol) {
                    let shadowType = checker.getTypeOfSymbolAtLocation(tsSymbol, param)
                    if (shadowType) {
                        let shadowDef = getDefaultValueOfType(shadowType)
                        if (shadowDef) {
                            return shadowDef
                        }
                    }
                }

                const shadowAttrs = shadowSymbol.attributes;
                if (shadowAttrs.shim === "KIND_GET" && shadowAttrs.blockId) {
                    const kindNamespace = shadowAttrs.kindNamespace || fn.namespace;
                    const defaultValueForKind = pxtc.Util.values(apis.byQName).find(api => api.namespace === kindNamespace && api.attributes.isKind);
                    if (defaultValueForKind) {
                        return python ? defaultValueForKind.pyQName : defaultValueForKind.qName;
                    }
                }

                // 3 is completely arbitrarily chosen here
                if (recursionDepth < 3 && lastApiInfo.decls[shadowSymbol.qName]) {
                    let snippet = getSnippet(
                        apis,
                        takenNames,
                        runtimeOps,
                        shadowSymbol,
                        lastApiInfo.decls[shadowSymbol.qName] as ts.FunctionLikeDeclaration,
                        python,
                        recursionDepth + 1
                    );

                    if (snippet) return snippet;
                }
            }

            // HACK: special handling for single-color (e.g. micro:bit) image literal
            if (typeNode.kind === SK.StringKeyword && name === "leds") {
                return python ? defaultPyImgList : defaultTsImgList
            }

            // handle function types
            if (typeNode.kind === SK.FunctionType) {
                const tn = typeNode as ts.FunctionTypeNode;
                let functionSignature = checker ? checker.getSignatureFromDeclaration(tn) : undefined;
                if (functionSignature) {
                    return createDefaultFunction(functionSignature, true);
                }
                return emitEmptyFn(name);
            }

            // simple types we can determine defaults for
            const basicRes = getBasicKindDefault(typeNode.kind, python)
            if (basicRes !== undefined) {
                return basicRes
            }

            // get default of Typescript type
            let type = checker && checker.getTypeAtLocation(param);
            if (type) {
                let typeDef = getDefaultValueOfType(type)
                if (typeDef)
                    return typeDef
            }

            // lastly, null or none
            return python ? "None" : "null";
        }

        const includedParameters = decl.parameters ? decl.parameters
            .filter(param => !param.initializer && !param.questionToken) : []

        const args = includedParameters
            .map(getParameterDefault)
            .map(p =>
                // make a "replacement point" out of each parameter
                // e.g. foo(${1:param1}, ${2:param2})
                ({
                    default: p,
                    isLiteral: true
                }) as SnippetNode)

        let snippetPrefix = fn.namespace;
        let isInstance = false;
        let addNamespace = false;
        let namespaceToUse = "";
        let functionCount = 0;

        const element = fn as pxtc.SymbolInfo;
        if (element.attributes.block) {
            if (element.attributes.defaultInstance) {
                snippetPrefix = element.attributes.defaultInstance;
                if (python && snippetPrefix)
                    snippetPrefix = snakify(snippetPrefix);
            }
            else if (element.namespace) { // some blocks don't have a namespace such as parseInt
                const nsInfo = apis.byQName[element.namespace];
                if (nsInfo.attributes.fixedInstances) {
                    let instances = Util.values(apis.byQName)
                    let getExtendsTypesFor = function (name: string) {
                        return instances
                            .filter(v => v.extendsTypes)
                            .filter(v => v.extendsTypes.reduce((x, y) => x || y.indexOf(name) != -1, false))
                            .reduce((x, y) => x.concat(y.extendsTypes), [])
                    }

                    // all fixed instances for this namespace
                    let fixedInstances = instances.filter(value =>
                        value.kind === pxtc.SymbolKind.Variable &&
                        value.attributes.fixedInstance
                    );

                    let instanceToUse: SymbolInfo;
                    // first try to get fixed instances whose retType matches nsInfo.name
                    // e.g., DigitalPin
                    const exactInstances = fixedInstances.filter(value =>
                        value.retType == nsInfo.qName)
                        .sort((v1, v2) => v1.name.localeCompare(v2.name));

                    if (exactInstances.length) {
                        instanceToUse = exactInstances[0];
                    } else {
                        // second choice: use fixed instances whose retType extends type of nsInfo.name
                        // e.g., nsInfo.name == AnalogPin and instance retType == PwmPin
                        const extendedInstances = fixedInstances.filter(value =>
                            getExtendsTypesFor(nsInfo.qName).indexOf(value.retType) !== -1)
                            .sort((v1, v2) => v1.name.localeCompare(v2.name));

                        instanceToUse = extendedInstances[0];
                    }

                    if (instanceToUse) {
                        snippetPrefix = `${getName(instanceToUse)}`;
                        namespaceToUse = instanceToUse.namespace;
                    } else {
                        namespaceToUse = nsInfo.namespace;
                    }

                    if (namespaceToUse) {
                        addNamespace = true;
                    }

                    isInstance = true;
                }
                else if (element.kind == pxtc.SymbolKind.Method || element.kind == pxtc.SymbolKind.Property) {
                    const params = pxt.blocks.compileInfo(element);
                    if (params.thisParameter) {
                        let varName: string = undefined
                        if (params.thisParameter.definitionName) {
                            varName = params.thisParameter.definitionName
                            varName = varName[0].toUpperCase() + varName.substring(1)
                            varName = `my${varName}`
                        }
                        snippetPrefix = params.thisParameter.defaultValue || varName;
                        if (python && snippetPrefix)
                            snippetPrefix = snakify(snippetPrefix);
                    }
                    isInstance = true;
                }
                else if (nsInfo.kind === pxtc.SymbolKind.Class) {
                    return undefined;
                }
            }
        }

        const preDefinedSnippet = attrs && (python ? attrs.pySnippet : attrs.snippet);
        let snippet: SnippetNode[];
        if (preDefinedSnippet) {
            snippet = [preDefinedSnippet];
        } else {
            snippet = [fnName];
            if (args?.length || element.kind == pxtc.SymbolKind.Method || element.kind == pxtc.SymbolKind.Function || element.kind == pxtc.SymbolKind.Class) {
                const argsWithCommas = args.reduce((p: SnippetNode[], n) => [...p, p.length ? ", " : "", n], []) as SnippetNode[]
                snippet = snippet.concat(["(", ...argsWithCommas, ")"]);
            }
        }
        let insertText = snippetPrefix ? [snippetPrefix, ".", ...snippet] : snippet;
        insertText = addNamespace ? [firstWord(namespaceToUse), ".", ...insertText] : insertText;

        if (attrs && attrs.blockSetVariable) {
            if (python) {
                const varName = getUniqueName(snakify(attrs.blockSetVariable));
                const varNode = {
                    default: varName,
                    isDefinition: true
                }
                insertText = [varNode, " = ", ...insertText];
            } else {
                const varName = getUniqueName(attrs.blockSetVariable);
                const varNode = {
                    default: varName,
                    isDefinition: true
                }
                insertText = ["let ", varNode, " = ", ...insertText];
            }
        }

        return [preStmt, insertText]

        function getSymbolName(symbol: Symbol) {
            if (checker) {
                const qName = getFullName(checker, symbol);
                const si = apis.byQName[qName];
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

        function createDefaultFunction(functionSignature: ts.Signature, isArgument: boolean): SnippetNode {
            let returnValue = "";

            let returnType = checker.getReturnTypeOfSignature(functionSignature);

            if (returnType.flags & ts.TypeFlags.NumberLike)
                returnValue = "return 0";
            else if (returnType.flags & ts.TypeFlags.StringLike)
                returnValue = "return \"\"";
            else if (returnType.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral))
                returnValue = python ? "return False" : "return false";

            if (python) {
                let functionArgument: string;
                if (attrs.optionalVariableArgs)
                    functionArgument = `()`
                else
                    functionArgument = `(${functionSignature.parameters.map(p => p.name).join(', ')})`;
                let n = fnName || "fn";
                if (functionCount++ > 0) n += functionCount;
                if (isArgument && !/^on/i.test(n)) // forever -> on_forever
                    n = "on" + pxt.Util.capitalize(n);


                // This is replicating the name hint behavior in the pydecompiler. We put the default
                // enum value at the end of the function name
                const enumParams = includedParameters.filter(p => {
                    const t = checker && checker.getTypeAtLocation(p);
                    return !!(t && t.symbol && t.symbol.flags & SymbolFlags.Enum)
                }).map(p => {
                    const snippet = snippetStringify(getParameterDefault(p));
                    const str = snippet.toLowerCase()
                    const index = str.lastIndexOf(".");
                    return index !== -1 ? str.substr(index + 1) : str;
                }).join("_");

                if (enumParams) n += "_" + enumParams;

                n = snakify(n);
                n = getUniqueName(n)
                preStmt = [
                    ...preStmt, preStmt.length ? "\n" : "",
                    "def ", { default: n, isDefinition: true }, functionArgument, `:\n${PY_INDENT}`,
                    { default: returnValue || "pass" }, `\n`
                ];
                return {
                    default: n
                }
            } else {
                let functionArgument = "()";
                if (!attrs.optionalVariableArgs) {
                    let displayParts = (ts as any).mapToDisplayParts((writer: ts.DisplayPartsSymbolWriter) => {
                        checker.getSymbolDisplayBuilder().buildSignatureDisplay(functionSignature, writer);
                    });
                    let displayPartsStr = ts.displayPartsToString(displayParts);
                    functionArgument = displayPartsStr.substr(0, displayPartsStr.lastIndexOf(":"));
                }
                return [`function`, functionArgument, ` {\n${PY_INDENT}`, { default: returnValue }, `\n}`];
            }
        }

        function emitEmptyFn(n: string): SnippetNode {
            if (python) {
                n = n || "fn"
                n = snakify(n);
                n = getUniqueName(n)
                preStmt = [
                    ...preStmt, preStmt.length ? "\n" : "",
                    "def ", { default: n, isDefinition: true }, `():\n${PY_INDENT}`, { default: `pass` }, `\n`,
                ];
                return {
                    default: n
                }
            } else return `function () {}`;
        }
    }

    function getBasicKindDefault(kind: SyntaxKind, isPython: boolean): string | undefined {
        switch (kind) {
            case SK.StringKeyword: return "";
            case SK.NumberKeyword: return "0";
            case SK.BooleanKeyword: return isPython ? "False" : "false";
            case SK.ArrayType: return "[]";
            case SK.NullKeyword: return isPython ? "None" : "null";
            default:
                return undefined
        }
    }

    function tsSymbolToPxtSymbolKind(ts: ts.Symbol): SymbolKind {
        if (ts.flags & SymbolFlags.Variable)
            return SymbolKind.Variable
        if (ts.flags & SymbolFlags.Class)
            return SymbolKind.Class
        if (ts.flags & SymbolFlags.Enum)
            return SymbolKind.Enum
        if (ts.flags & SymbolFlags.EnumMember)
            return SymbolKind.EnumMember
        if (ts.flags & SymbolFlags.Method)
            return SymbolKind.Method
        if (ts.flags & SymbolFlags.Module)
            return SymbolKind.Module
        if (ts.flags & SymbolFlags.Property)
            return SymbolKind.Property
        return SymbolKind.None
    }

    function makePxtSymbolFromKeyword(keyword: string): SymbolInfo {
        // TODO: since keywords aren't exactly symbols, consider using a different
        //       type than "SymbolInfo" to carry auto completion information.
        //       Some progress on this exists here: dazuniga/completionitem_refactor

        let sym: SymbolInfo = {
            kind: SymbolKind.None,
            name: keyword,
            pyName: keyword,
            qName: keyword,
            pyQName: keyword,
            namespace: "",
            attributes: {
                callingConvention: ir.CallingConvention.Plain,
                paramDefl: {},
            },
            fileName: "main.ts",
            parameters: [],
            retType: "any",
        }
        return sym
    }

    function makePxtSymbolFromTsSymbol(tsSym: ts.Symbol, tsType: ts.Type): SymbolInfo {
        // TODO: get proper filename, fill out parameter info, handle qualified names
        //      none of these are needed for JS auto-complete which is the primary
        //      use case for this.
        let qname = tsSym.getName()

        let match = /(.*)\.(.*)/.exec(qname)
        let name = match ? match[2] : qname
        let ns = match ? match[1] : ""

        let typeName = tsType.getSymbol()?.getName() ?? "any"

        let sym: SymbolInfo = {
            kind: tsSymbolToPxtSymbolKind(tsSym),
            name: name,
            pyName: name,
            qName: qname,
            pyQName: qname,
            namespace: ns,
            attributes: {
                callingConvention: ir.CallingConvention.Plain,
                paramDefl: {},
            },
            fileName: "main.ts",
            parameters: [],
            retType: typeName,
        }
        return sym;
    }

    function getPxtSymbolFromTsSymbol(tsSym: ts.Symbol, apiInfo: ApisInfo, tc: TypeChecker): SymbolInfo | undefined {
        if (tsSym) {
            return apiInfo.byQName[tc.getFullyQualifiedName(tsSym)]
        }
        return undefined;
    }

    function getTsSymbolFromPxtSymbol(pxtSym: SymbolInfo, location: ts.Node, meaning: SymbolFlags): ts.Symbol | null {
        const checker = service && service.getProgram().getTypeChecker();
        if (!checker)
            return null
        const tsSymbols = checker.getSymbolsInScope(location, meaning)
        for (let tsSym of tsSymbols) {
            if (tsSym.escapedName.toString() === pxtSym.qName)
                return tsSym
        }
        return null
    }

    function getEnumMembers(t: Type): NodeArray<EnumMember> | undefined {
        const checker = service && service.getProgram().getTypeChecker();
        if (checker && t.symbol && t.symbol.declarations && t.symbol.declarations.length) {
            for (let i = 0; i < t.symbol.declarations.length; i++) {
                const decl = t.symbol.declarations[i];
                if (decl.kind === SK.EnumDeclaration) {
                    const enumDeclaration = decl as EnumDeclaration;
                    return enumDeclaration.members
                }
            }
        }
        return undefined
    }

    function enumMemberToQName(tc: TypeChecker, e: EnumMember) {
        if (e.name.kind === SK.Identifier) {
            return tc.getFullyQualifiedName(tc.getSymbolAtLocation(e.name));
        }
        return undefined
    }

    function getDefaultEnumValue(t: Type, python: boolean): string {
        // Note: AFAIK this is NOT guranteed to get the same default as you get in
        // blocks. That being said, it should get the first declared value. Only way
        // to guarantee an API has the same default in blocks and in TS is to actually
        // set a default on the parameter in its comment attributes
        const checker = service && service.getProgram().getTypeChecker();
        const members = getEnumMembers(t)
        for (const member of members) {
            if (member.name.kind === SK.Identifier) {
                const fullName = enumMemberToQName(checker, member)
                const pxtSym = lastApiInfo.apis.byQName[fullName]
                if (pxtSym) {
                    if (pxtSym.attributes.alias)
                        // use pyAlias if python; or default to alias
                        return (python && pxtSym.attributes.pyAlias) || pxtSym.attributes.alias; // prefer alias
                    return python ? pxtSym.pyQName : pxtSym.qName
                }
                else
                    return fullName
            }
        }

        return "0";
    }

    function compareCompletionSymbols(a: CompletionSymbol, b: CompletionSymbol) {
        if (a.weight !== b.weight) {
            return b.weight - a.weight
        }
        return compareSymbols(a.symbol, b.symbol);
    }

    function completionSymbol(symbol: SymbolInfo, weight: number): CompletionSymbol {
        return { symbol, weight };
    }

    function completionSymbols(symbols: SymbolInfo[], weight: number): CompletionSymbol[] {
        return symbols.map(s => completionSymbol(s, weight));
    }

    function getNodeAndSymbolAtLocation(program: Program, filename: string, position: number, apiInfo: ApisInfo): [Node, SymbolInfo] {
        const source = program.getSourceFile(filename);
        const checker = program.getTypeChecker();

        const node = findInnerMostNodeAtPosition(source, position);

        if (node) {
            const symbol = checker.getSymbolAtLocation(node);
            if (symbol) {
                let pxtSym = getPxtSymbolFromTsSymbol(symbol, apiInfo, checker)
                return [node, pxtSym];
            }
        }

        return null;
    }

    function findInnerMostNodeAtPosition(n: Node, position: number): Node | null {
        for (let child of n.getChildren()) {
            if (child.kind >= ts.SyntaxKind.FirstPunctuation && child.kind <= ts.SyntaxKind.LastPunctuation)
                continue;

            let s = child.getStart()
            let e = child.getEnd()
            if (s <= position && position < e)
                return findInnerMostNodeAtPosition(child, position)
        }
        return (n && n.kind === SK.SourceFile) ? null : n;
    }

    function tsTypeToPxtTypeString(t: Type, tc: TypeChecker) {
        if (t.flags & TypeFlags.NumberLiteral) {
            return "Number";
        }
        else if (t.flags & TypeFlags.StringLiteral) {
            return "String";
        }
        else if (t.flags & TypeFlags.BooleanLiteral) {
            return "Boolean";
        }

        const tcString = tc.typeToString(t);
        const primativeToQname: pxt.Map<string> = {
            "number": "Number",
            "string": "String",
            "boolean": "Boolean"
        }
        const pxtString = primativeToQname[tcString] ?? tcString
        return pxtString
    }


    function filenameWithExtension(filename: string, extension: string) {
        if (extension.charAt(0) === ".") extension = extension.substr(1);
        return filename.substr(0, filename.lastIndexOf(".") + 1) + extension;
    }

    function getParentNamespace(n?: Node): ModuleDeclaration | null {
        if (!n)
            return null
        if (ts.isModuleDeclaration(n))
            return n
        return getParentNamespace(n.parent)
    }
    function getCurrentNamespaces(n?: Node): string[] {
        if (!n)
            return [];
        let parent = getParentNamespace(n)
        if (!parent)
            return [];
        let ns = parent.name.getText()
        return [...getCurrentNamespaces(parent.parent), ns]
    }

    /**
     * This function only cares about getting words of the form [a-zA-z]+
     */
    function getWordAtPosition(text: string, position: number) {
        let start = position;
        let end = position;

        while (start > 0 && isWordCharacter(start)) --start;
        while (end < text.length - 1 && isWordCharacter(end)) ++end

        if (start != end) {
            return {
                text: text.substring(start + 1, end),
                start: start + 1,
                end: end
            };
        }
        return null;

        function isWordCharacter(index: number) {
            const charCode = text.charCodeAt(index);
            return charCode >= 65 && charCode <= 90 || charCode >= 97 && charCode <= 122;
        }
    }
}
