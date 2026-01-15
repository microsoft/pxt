namespace ts.pxtc.service {
    // these weights dictate the relative ordering of certain results in the completion
    const COMPLETION_KEYWORD_WEIGHT = 0;
    const COMPLETION_DEFAULT_WEIGHT = 1;
    const COMPLETION_IN_SCOPE_VAR_WEIGHT = 5;
    const COMPLETION_MATCHING_PARAM_TYPE_WEIGHT = 10;

    export function getCallSymbol(callExp: CallExpression): SymbolInfo {// pxt symbol
        const qName = callExp?.pxt?.callInfo?.qName
        const api = lastApiInfo.apis.byQName[qName]
        return api
    }

    export function getParameter(callSym: SymbolInfo, paramIdx: number, blocksInfo: BlocksInfo): ParameterDesc | undefined {
        if (!callSym || paramIdx < 0)
            return undefined;

        const paramDesc = callSym.parameters[paramIdx]
        let result = paramDesc;

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
                    result =  shadowApi.parameters[0]
                }
            }
        }

        return result
    }

    export function getApisForTsType(pxtType: string, location: Node, tc: TypeChecker, symbols: CompletionSymbol[], isEnum = false): CompletionSymbol[] {
        // any apis that return this type?
        // TODO: if this becomes expensive, this can be cached between calls since the same
        // return type is likely to occur over and over.
        const apisByRetType: pxt.Map<CompletionSymbol[]> = {}
        symbols.forEach(i => {
            let retType = i.symbol.retType
            // special case for enum members and enum members exported as constants,
            // which have the return type 'EnumName.MemberName'. we want to match 'EnumName'
            if (isEnum) {
                if (i.symbol.kind == SymbolKind.EnumMember) {
                    retType = i.symbol.namespace;
                } else if (i.symbol.kind == SymbolKind.Variable) {
                    const enumParts = i.symbol.attributes?.enumIdentity?.split(".")
                    if (enumParts?.length > 1) retType = enumParts[0]
                }
            }
            apisByRetType[retType] = [...(apisByRetType[retType] || []), i]
        })

        const retApis = apisByRetType[pxtType] || []

        // any enum members?
        let enumVals: SymbolInfo[] = []
        for (let r of retApis) {
            const asTsEnum = getTsSymbolFromPxtSymbol(r.symbol, location, SymbolFlags.Enum)
            if (asTsEnum) {
                const enumType = tc.getTypeOfSymbolAtLocation(asTsEnum, location)
                const mems = getEnumMembers(tc, enumType)
                const enumValQNames = mems.map(e => enumMemberToQName(tc, e))
                const symbols = enumValQNames.map(n => lastApiInfo.apis.byQName[n])
                enumVals = [...enumVals, ...symbols]
            }
        }

        return [...retApis, ...completionSymbols(enumVals, COMPLETION_DEFAULT_WEIGHT)]
    }

    export function getBasicKindDefault(kind: SyntaxKind, isPython: boolean): string | undefined {
        switch (kind) {
            case SK.StringKeyword: return "\"\"";
            case SK.NumberKeyword: return "0";
            case SK.BooleanKeyword: return isPython ? "False" : "false";
            case SK.ArrayType: return "[]";
            case SK.NullKeyword: return isPython ? "None" : "null";
            default:
                return undefined
        }
    }

    export function tsSymbolToPxtSymbolKind(ts: ts.Symbol): SymbolKind {
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

    export function makePxtSymbolFromKeyword(keyword: string): SymbolInfo {
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
            fileName: pxt.MAIN_TS,
            parameters: [],
            retType: "any",
        }
        return sym
    }

    export function makePxtSymbolFromTsSymbol(tsSym: ts.Symbol, tsType: ts.Type): SymbolInfo {
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
            fileName: pxt.MAIN_TS,
            parameters: [],
            retType: typeName,
        }
        return sym;
    }

    export function getPxtSymbolFromTsSymbol(tsSym: ts.Symbol, apiInfo: ApisInfo, tc: TypeChecker): SymbolInfo | undefined {
        if (tsSym) {
            return apiInfo.byQName[tc.getFullyQualifiedName(tsSym)]
        }
        return undefined;
    }

    export function compareCompletionSymbols(a: CompletionSymbol, b: CompletionSymbol) {
        if (a.weight !== b.weight) {
            return b.weight - a.weight
        }
        return compareSymbols(a.symbol, b.symbol);
    }

    export function completionSymbol(symbol: SymbolInfo, weight: number): CompletionSymbol {
        return { symbol, weight };
    }

    export function completionSymbols(symbols: SymbolInfo[], weight: number): CompletionSymbol[] {
        return symbols.map(s => completionSymbol(s, weight));
    }

    export function getNodeAndSymbolAtLocation(program: Program, filename: string, position: number, apiInfo: ApisInfo): [Node, SymbolInfo] {
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


    export function tsTypeToPxtTypeString(t: Type, tc: TypeChecker) {
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

    export function filenameWithExtension(filename: string, extension: string) {
        if (extension.charAt(0) === ".") extension = extension.substr(1);
        return filename.substr(0, filename.lastIndexOf(".") + 1) + extension;
    }



    /**
     * This function only cares about getting words of the form [a-zA-z]+
     */
    export function getWordAtPosition(text: string, position: number) {
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

    export function getTsSymbolFromPxtSymbol(pxtSym: SymbolInfo, location: ts.Node, meaning: SymbolFlags): ts.Symbol | null {
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

    export function getDefaultEnumValue(t: Type, python: boolean): string {
        // Note: AFAIK this is NOT guranteed to get the same default as you get in
        // blocks. That being said, it should get the first declared value. Only way
        // to guarantee an API has the same default in blocks and in TS is to actually
        // set a default on the parameter in its comment attributes
        const checker = service && service.getProgram().getTypeChecker();
        const members = getEnumMembers(checker, t)
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

    export function getCompletions(v: OpArg) {
        const { fileName, fileContent, position, wordStartPos, wordEndPos, runtime } = v
        let src: string = fileContent
        if (fileContent) {
            host.setFile(fileName, fileContent);
        }

        const tsFilename = filenameWithExtension(fileName, "ts");

        const span: PosSpan = { startPos: wordStartPos, endPos: wordEndPos }

        const isPython = /\.py$/.test(fileName);

        const r: CompletionInfo = {
            entries: [],
            isMemberCompletion: false,
            isNewIdentifierLocation: true,
            isTypeLocation: false,
            namespace: [],
        };

        // get line text
        let lastNl = src.lastIndexOf("\n", position - 1)
        lastNl = Math.max(0, lastNl)
        const lineText = src.substring(lastNl + 1, position)

        // are we on a line comment, if so don't show completions
        // NOTE: multi-line comments and string literals are handled
        //  later as they require parsing
        const lineCommentStr = isPython ? "#" : "//"
        if (lineText.trim().startsWith(lineCommentStr)) {
            return r;
        }

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

        const isMemberCompletion = dotIdx !== -1
        r.isMemberCompletion = isMemberCompletion

        const partialWord = isMemberCompletion ? src.slice(dotIdx + 1, wordEndPos) : src.slice(wordStartPos, wordEndPos)

        const MAX_SYMBOLS_BEFORE_FILTER = 50
        const MAX_SYMBOLS = 100

        if (isMemberCompletion)
            complPosition = dotIdx

        const entries: pxt.Map<CompletionSymbol> = {};

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
                const tsSrc = res.outfiles[tsFilename] || ""
                const srcMap = pxtc.BuildSourceMapHelpers(res.sourceMap, tsSrc, pySrc)

                const smallest = srcMap.py.smallestOverlap(span)
                if (smallest) {
                    tsPos = smallest.ts.startPos
                }
            }

            // filter based on word match if we get too many (ideally we'd leave this filtering for monaco as it's
            // better at fuzzy matching and fluidly changing but for performance reasons we want to do it here)
            if (!isMemberCompletion && resultSymbols.length > MAX_SYMBOLS_BEFORE_FILTER) {
                resultSymbols = resultSymbols
                    .filter(s => (isPython ? s.symbol.pyQName : s.symbol.qName).toLowerCase().indexOf(partialWord.toLowerCase()) >= 0)
            }

            opts.ast = true;
            const ts2asm = compile(opts, service);
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
        const commentMap = pxtc.decompiler.buildCommentMap(tsAst);

        // abort if we're in a comment
        const inComment = commentMap.some(range => range.start <= position && position <= range.end)
        if (inComment) {
            return r;
        }

        // abort if we're in a string literal
        if (tsNode) {
            const stringLiteralKinds = [SK.StringLiteral, SK.FirstTemplateToken, SK.NoSubstitutionTemplateLiteral];
            const inLiteral = stringLiteralKinds.some(k => tsNode.kind === k)
            if (inLiteral) {
                return r;
            }
        }

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

        const allSymbols = pxt.U.values(lastApiInfo.apis.byQName)

        if (resultSymbols.length === 0) {
            // if by this point we don't yet have a specialized set of results (like those for member completion), use all global api symbols as the start and filter by matching prefix if possible
            let wordMatching = allSymbols.filter(s => (isPython ? s.pyQName : s.qName).toLowerCase().indexOf(partialWord.toLowerCase()) >= 0)
            resultSymbols = completionSymbols(wordMatching, COMPLETION_DEFAULT_WEIGHT)
        }

        // gather local variables that won't have pxt symbol info
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
                    const param = getParameter(callSym, paramIdx, blocksInfo) // shakao get param type
                    if (param) {
                        // weight the results higher if they return the correct type for the parameter
                        const matchingApis = getApisForTsType(param.type, call, tc, resultSymbols, param.isEnum);
                        matchingApis.forEach(match => match.weight = COMPLETION_MATCHING_PARAM_TYPE_WEIGHT);
                    }
                }
            }
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
                .filter(k => k.indexOf(partialWord) >= 0)
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

        // swap aliases, filter symbols
        resultSymbols
            .map(sym => {
                // skip for enum member completions (eg "AnimalMob."" should have "Chicken", not "CHICKEN")
                if (sym.symbol.attributes.alias && !(isMemberCompletion && sym.symbol.kind === SymbolKind.EnumMember)) {
                    return completionSymbol(lastApiInfo.apis.byQName[sym.symbol.attributes.alias], sym.weight);
                } else {
                    return sym;
                }
            })
            .filter(shouldUseSymbol)
            .forEach(sym => {
                entries[sym.symbol.qName] = sym
            })
        resultSymbols = pxt.Util.values(entries)
            .filter(a => !!a && !!a.symbol)

        // sort entries
        resultSymbols.sort(compareCompletionSymbols);

        // limit the number of entries
        if (v.light && resultSymbols.length > MAX_SYMBOLS) {
            resultSymbols = resultSymbols.splice(0, MAX_SYMBOLS)
        }

        // add in snippets if not present already
        const { bannedCategories, screenSize } = v.runtime;
        const blocksInfo = blocksInfoOp(lastApiInfo.apis, bannedCategories)
        const context: SnippetContext = {
            takenNames,
            blocksInfo,
            screenSize,
            apis: lastApiInfo.apis,
            decls: lastApiInfo.decls,
            checker: service?.getProgram()?.getTypeChecker()
        }
        resultSymbols.forEach(sym => patchSymbolWithSnippet(sym.symbol, isPython, context))

        r.entries = resultSymbols.map(sym => sym.symbol);

        return r;
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

    function patchSymbolWithSnippet(si: SymbolInfo, isPython: boolean, context: SnippetContext) {
        const n = lastApiInfo.decls[si.qName];
        if (isFunctionLike(n)) {
            // snippet/pySnippet might have been set already, but even if it has,
            // we always want to recompute it if the snippet introduces new definitions
            // because we need to ensure name uniqueness
            if (si.snippetAddsDefinitions
                || (isPython && !si.pySnippet)
                || (!isPython && !si.snippet)) {
                const snippetNode = getSnippet(context, si, n, isPython);
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
}
