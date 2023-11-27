
namespace ts.pxtc.service {

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

    export interface SnippetContext {
        apis: ApisInfo;
        blocksInfo: BlocksInfo;
        takenNames: pxt.Map<SymbolInfo>;
        checker: ts.TypeChecker;
        screenSize?: pxt.Size;
    }

    export function getSnippet(context: SnippetContext, fn: SymbolInfo, decl: ts.FunctionLikeDeclaration, python?: boolean, recursionDepth = 0): SnippetNode {
        // TODO: a lot of this is duplicate logic with blocklyloader.ts:buildBlockFromDef; we should
        //  unify these approaches
        let { apis, takenNames, blocksInfo, screenSize, checker } = context;

        const PY_INDENT: string = (pxt as any).py.INDENT;
        const fileType = python ? "python" : "typescript";

        let snippetPrefix = fn.namespace;
        let addNamespace = false;
        let namespaceToUse = "";
        let functionCount = 0;

        let preStmt: SnippetNode[] = [];

        if (isTaggedTemplate(fn)) {
            if (python) {
                return `${fn.name}(""" """)`
            }
            else {
                return `${fn.name}\`\``
            }
        }

        let fnName = ""
        if (decl.kind == SK.Constructor) {
            fnName = getSymbolName(decl.symbol) || decl.parent.name.getText();
        } else {
            fnName = getSymbolName(decl.symbol) || decl.name.getText();
        }

        if (python)
            fnName = U.snakify(fnName);

        const attrs = fn.attributes;

        if (attrs.shim === "TD_ID" && recursionDepth && decl.parameters.length) {
            return getParameterDefault(decl.parameters[0]);
        }

        const element = fn as pxtc.SymbolInfo;
        const params = pxt.blocks.compileInfo(element);

        const blocksById = blocksInfo.blocksById

        // TODO: move out of getSnippet for general reuse
        const blockParameters = attrs._def?.parameters
            .filter(param => !!params.definitionNameToParam[param.name])
            .map(param => params.definitionNameToParam[param.name].actualName) || [];
        const includedParameters = decl.parameters ? decl.parameters
            // Only keep required parameters and parameters included in the blockdef
            .filter(param => (!param.initializer && !param.questionToken)
                || (blockParameters.indexOf(param.name.getText()) >= 0)) : []

        const args = includedParameters
            .map(getParameterDefault)
            .map(p =>
                // make a "replacement point" out of each parameter
                // e.g. foo(${1:param1}, ${2:param2})
                ({
                    default: p,
                    isLiteral: true
                }) as SnippetNode)

        if (element.attributes.block) {
            if (element.attributes.defaultInstance) {
                snippetPrefix = element.attributes.defaultInstance;
                if (python && snippetPrefix)
                    snippetPrefix = U.snakify(snippetPrefix);
            }
            else if (params.thisParameter?.shadowBlockId === "variables_get") {
                snippetPrefix = params.thisParameter.defaultValue || params.thisParameter.definitionName;
                if (python && snippetPrefix)
                    snippetPrefix = U.snakify(snippetPrefix);
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
                }
                else if (element.kind == pxtc.SymbolKind.Method || element.kind == pxtc.SymbolKind.Property) {
                    if (params.thisParameter) {
                        let varName: string = undefined
                        if (params.thisParameter.definitionName) {
                            varName = params.thisParameter.definitionName
                            varName = varName[0].toUpperCase() + varName.substring(1)
                            varName = `my${varName}`
                        }
                        snippetPrefix = params.thisParameter.defaultValue || varName;
                        if (python && snippetPrefix)
                            snippetPrefix = U.snakify(snippetPrefix);
                    }
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
            snippetPrefix = undefined;
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
                const varName = getUniqueName(U.snakify(attrs.blockSetVariable));
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

        function getUniqueName(inName: string): string {
            if (takenNames[inName])
                return ts.pxtc.decompiler.getNewName(inName, takenNames, false)
            return inName
        }

        function getParameterDefault(param: ParameterDeclaration): SnippetNode {
            const typeNode = param.type;
            if (!typeNode)
                return python ? "None" : "null"

            const name = param.name.kind === SK.Identifier ? (param.name as ts.Identifier).text : undefined;

            const override = attrs.paramSnippets?.[name];
            if (override) {
                if (python) {
                    if (override.python) return override.python;
                }
                else if (override.ts) return override.ts;
            }

            // check for explicit default in the attributes
            const paramDefl = attrs?.paramDefl?.[name]
            if (paramDefl) {
                let deflKind: SyntaxKind;
                if (typeNode.kind == SK.AnyKeyword) {
                    const defaultName = paramDefl.toUpperCase();
                    if (!Number.isNaN(+defaultName)) {
                        // try to parse as a number
                        deflKind = SK.NumberKeyword;
                    } else if (defaultName == "FALSE" || defaultName == "TRUE") {
                        // try to parse as a bool
                        deflKind = SK.BooleanKeyword;
                    } else if (defaultName.includes(".")) {
                        // try to parse as an enum
                        deflKind = SK.EnumKeyword;
                    } else {
                        // otherwise it'll be a string
                        deflKind = SK.StringKeyword;
                    }
                }
                if (typeNode.kind === SK.StringKeyword || deflKind === SK.StringKeyword) {
                    return paramDefl.indexOf(`"`) != 0 ? `"${paramDefl}"` : paramDefl;
                }
                const type = checker?.getTypeAtLocation(param);
                const typeSymbol = getPxtSymbolFromTsSymbol(type?.symbol, apis, checker);
                if ((typeSymbol?.attributes.fixedInstances) && python) {
                    return pxt.Util.snakify(paramDefl);
                }
                if (python) {
                    return pxtc.tsSnippetToPySnippet(paramDefl, typeSymbol)
                }

                return paramDefl
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
                        context,
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
                    return emitEmptyFn();
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
            const compileInfo = pxt.blocks.compileInfo(fn)
            const blockParam = compileInfo.parameters?.find((p) => p.actualName === paramName)
            if (!blockParam?.shadowBlockId)
                return null
            let sym = blocksById[blockParam.shadowBlockId]
            if (!sym)
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

                n = U.snakify(n);
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
                        checker.getSymbolDisplayBuilder().buildSignatureDisplay(functionSignature, writer, undefined, TypeFormatFlags.UseFullyQualifiedType);
                    });
                    let displayPartsStr = ts.displayPartsToString(displayParts);
                    functionArgument = displayPartsStr.substr(0, displayPartsStr.lastIndexOf(":"));
                }
                return [`function`, functionArgument, ` {\n${PY_INDENT}`, { default: returnValue }, `\n}`];
            }
        }

        function emitEmptyFn(n?: string): SnippetNode {
            if (python) {
                n = n || "fn"
                n = U.snakify(n);
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

    export function isTaggedTemplate(sym: SymbolInfo) {
        return (sym.attributes.shim && sym.attributes.shim[0] == "@") || sym.attributes.pyConvertToTaggedTemplate;
    }
}
