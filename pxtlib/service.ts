/// <reference path="../localtypings/pxtarget.d.ts"/>
/// <reference path="../localtypings/pxtpackage.d.ts"/>

namespace ts.pxtc {
    export const assert = Util.assert;
    export const oops = Util.oops;
    export import U = pxtc.Util;

    export const ON_START_TYPE = "pxt-on-start";
    export const ON_START_COMMENT = "on start"; // TODO: Localize? (adding lf doesn't work because this is run before translations are downloaded)
    export const HANDLER_COMMENT = "code goes here"; // TODO: Localize? (adding lf doesn't work because this is run before translations are downloaded)
    export const TS_STATEMENT_TYPE = "typescript_statement";
    export const TS_DEBUGGER_TYPE = "debugger_keyword";
    export const TS_BREAK_TYPE = "break_keyword";
    export const TS_CONTINUE_TYPE = "continue_keyword";
    export const TS_OUTPUT_TYPE = "typescript_expression";
    export const TS_RETURN_STATEMENT_TYPE = "function_return";
    export const PAUSE_UNTIL_TYPE = "pxt_pause_until";
    export const COLLAPSED_BLOCK = "pxt_collapsed_block"
    export const FUNCTION_DEFINITION_TYPE = "function_definition";

    export const BINARY_JS = "binary.js";
    export const BINARY_ASM = "binary.asm";
    export const BINARY_HEX = "binary.hex";
    export const BINARY_UF2 = "binary.uf2";
    export const BINARY_ELF = "binary.elf";
    export const BINARY_PXT64 = "binary.pxt64";
    export const BINARY_ESP = "binary.bin";
    export const BINARY_SRCMAP = "binary.srcmap";

    export const NATIVE_TYPE_THUMB = "thumb";
    export const NATIVE_TYPE_VM = "vm";
    export const BLOCK_TRANSLATION_CACHE_KEY = "_blocks";

    export interface BlocksInfo {
        apis: ApisInfo;
        blocks: SymbolInfo[];
        blocksById: pxt.Map<SymbolInfo>;
        enumsByName: pxt.Map<EnumInfo>;
        kindsByName: pxt.Map<KindInfo>;
    }

    export interface EnumInfo {
        name: string;
        memberName: string;
        blockId: string;
        isBitMask: boolean;
        isHash: boolean;
        firstValue?: number;
        initialMembers: string[];
        promptHint: string;
    }

    export interface KindInfo {
        name: string;
        memberName: string;
        createFunctionName: string;
        blockId: string;
        promptHint: string;
        initialMembers: string[];
    }

    export interface CompletionEntry {
        name: string;
        kind: string;
        qualifiedName: string;
    }

    export interface CompletionInfo {
        entries: SymbolInfo[];
        isMemberCompletion: boolean;
        isNewIdentifierLocation: boolean;
        isTypeLocation: boolean;
        namespace: string[];
    }

    export interface LocationInfo {
        fileName: string;
        start: number;
        length: number;

        //derived
        line?: number;
        column?: number;
        endLine?: number;
        endColumn?: number;
    }

    export interface FunctionLocationInfo extends LocationInfo {
        functionName: string;
        argumentNames?: string[];
    }

    export interface KsDiagnostic extends LocationInfo {
        code: number;
        category: DiagnosticCategory;
        messageText: string | DiagnosticMessageChain;
    }

    export interface ConfigEntry {
        name: string;
        key: number;
        value: number;
    }

    export type CodeLang = "py" | "blocks" | "ts"
    export type PosSpan = {
        startPos: number;
        endPos: number;
    }
    export interface SourceInterval {
        ts: PosSpan;
        py: PosSpan;
    }

    export type LineColToPos = (line: number, col: number) => number
    export type PosToLineCol = (pos: number) => [number, number]
    export interface SourceMapHelpers {
        ts: {
            posToLineCol: PosToLineCol,
            lineColToPos: LineColToPos,
            allOverlaps: (i: PosSpan) => SourceInterval[],
            smallestOverlap: (i: PosSpan) => SourceInterval | undefined
            locToLoc: (thisLoc: pxtc.LocationInfo) => pxtc.LocationInfo,
            getText: (i: PosSpan) => string,
        },
        py: {
            posToLineCol: PosToLineCol,
            lineColToPos: LineColToPos,
            allOverlaps: (i: PosSpan) => SourceInterval[],
            smallestOverlap: (i: PosSpan) => SourceInterval | undefined,
            locToLoc: (thisLoc: pxtc.LocationInfo) => pxtc.LocationInfo,
            getText: (i: PosSpan) => string,
        },
    }

    export function BuildSourceMapHelpers(sourceMap: SourceInterval[], tsFile: string, pyFile: string): SourceMapHelpers {
        // Notes:
        //  lines are 0-indexed (Monaco they are 1-indexed)
        //  columns are 0-indexed (0th is first character)
        //  positions are 0-indexed, as if getting the index of a character in a file as a giant string (incl. new lines)
        //  line summation is the length of that line plus its newline plus all the lines before it; aka the position of the next line's first character
        //  end positions are zero-index but not inclusive, same behavior as substring
        const makeLineColPosConverters = (file: string): { posToLineCol: PosToLineCol, lineColToPos: LineColToPos } => {
            const lines = file.split("\n")
            const lineLengths = lines
                .map(l => l.length)
            const lineLenSums = lineLengths
                .reduce(({ lens, sum }, n) =>
                    ({ lens: [...lens, sum + n + 1], sum: sum + n + 1 }),
                    { lens: [] as number[], sum: 0 })
                .lens
            const lineColToPos = (line: number, col: number) => {
                let pos = (lineLenSums[line - 1] || 0) + col
                return pos
            }
            const posToLineCol = (pos: number) => {
                const line = lineLenSums
                    .reduce((curr, nextLen, i) => pos < nextLen ? curr : i + 1, 0)
                const col = lineLengths[line] - (lineLenSums[line] - pos) + 1
                return [line, col] as [number, number]
            }
            return { posToLineCol, lineColToPos }
        }

        const lcp = {
            ts: makeLineColPosConverters(tsFile),
            py: makeLineColPosConverters(pyFile)
        }

        const intLen = (i: PosSpan) => i.endPos - i.startPos
        const allOverlaps = (i: PosSpan, lang: "ts" | "py") => {
            const { startPos, endPos } = i
            return sourceMap
                .filter(i => {
                    // O(n), can we and should we do better?
                    return i[lang].startPos <= startPos && endPos <= i[lang].endPos
                })
        }
        const smallestOverlap = (i: PosSpan, lang: "ts" | "py"): SourceInterval | undefined => {
            const overlaps = allOverlaps(i, lang)
            return overlaps.reduce((p, n) => intLen(n[lang]) < intLen(p[lang]) ? n : p, overlaps[0])
        }

        const os = {
            ts: {
                allOverlaps: (i: PosSpan) => allOverlaps(i, "ts"),
                smallestOverlap: (i: PosSpan) => smallestOverlap(i, "ts"),
            },
            py: {
                allOverlaps: (i: PosSpan) => allOverlaps(i, "py"),
                smallestOverlap: (i: PosSpan) => smallestOverlap(i, "py"),
            }
        }

        const makeLocToLoc = (inLang: "ts" | "py", outLang: "ts" | "py") => {
            const inLocToPosAndLen = (inLoc: pxtc.LocationInfo) => [lcp[inLang].lineColToPos(inLoc.line, inLoc.column), inLoc.length] as [number, number]
            const locToLoc = (inLoc: pxtc.LocationInfo): pxtc.LocationInfo | undefined => {
                const [inStartPos, inLen] = inLocToPosAndLen(inLoc)
                const inEndPos = inStartPos + inLen
                const bestOverlap = smallestOverlap({ startPos: inStartPos, endPos: inEndPos }, inLang)
                if (!bestOverlap)
                    return undefined
                const [outStartLine, outStartCol] = lcp[outLang].posToLineCol(bestOverlap[outLang].startPos)
                const outLoc = {
                    fileName: `main.${outLang}`,
                    start: bestOverlap[outLang].startPos,
                    length: intLen(bestOverlap[outLang]),
                    line: outStartLine,
                    column: outStartCol
                }
                return outLoc
            }
            return locToLoc
        }

        const tsLocToPyLoc = makeLocToLoc("ts", "py")
        const pyLocToTsLoc = makeLocToLoc("py", "ts")

        const tsGetText = (i: PosSpan) => tsFile.substring(i.startPos, i.endPos)
        const pyGetText = (i: PosSpan) => pyFile.substring(i.startPos, i.endPos)

        return {
            ts: {
                ...lcp.ts,
                ...os.ts,
                locToLoc: tsLocToPyLoc,
                getText: tsGetText
            },
            py: {
                ...lcp.py,
                ...os.py,
                locToLoc: pyLocToTsLoc,
                getText: pyGetText
            },
        }
    }

    export interface CompileResult {
        outfiles: pxt.Map<string>;
        diagnostics: KsDiagnostic[];
        success: boolean;
        times: pxt.Map<number>;
        //ast?: Program; // Not needed, moved to pxtcompiler
        breakpoints?: Breakpoint[];
        procCallLocations?: pxtc.LocationInfo[];
        procDebugInfo?: ProcDebugInfo[];
        blocksInfo?: BlocksInfo;
        blockSourceMap?: pxt.blocks.BlockSourceInterval[]; // mappings id,start,end
        usedSymbols?: pxt.Map<SymbolInfo>; // q-names of symbols used
        usedArguments?: pxt.Map<string[]>;
        usedParts?: string[];
        needsFullRecompile?: boolean;
        // client options
        saveOnly?: boolean;
        userContextWindow?: Window;
        downloadFileBaseName?: string;
        headerId?: string;
        confirmAsync?: (confirmOptions: {}) => Promise<number>;
        configData?: ConfigEntry[];
        sourceMap?: SourceInterval[];
        globalNames?: pxt.Map<SymbolInfo>;
        builtVariants?: string[];
        fileSystem?: pxt.Map<string>;
    }

    export interface Breakpoint extends LocationInfo {
        id: number;
        isDebuggerStmt: boolean;
        binAddr?: number;
    }

    export interface CellInfo {
        name: string;
        type: string;
        index: number;
    }

    export interface ProcCallInfo {
        procIndex: number;
        callLabel: string;
        addr: number;
        stack: number;
    }

    export interface ProcDebugInfo {
        name: string;
        idx: number;
        bkptLoc: number;
        codeStartLoc: number;
        codeEndLoc: number;
        locals: CellInfo[];
        args: CellInfo[];
        localsMark: number;
        calls: ProcCallInfo[];
        size: number;
    }

    export const enum BitSize {
        None,
        Int8,
        UInt8,
        Int16,
        UInt16,
        Int32,
        UInt32,
    }

    /* @internal */
    const enum TokenKind {
        SingleAsterisk = 1,
        DoubleAsterisk = 1 << 1,
        SingleUnderscore = 1 << 2,
        DoubleUnderscore = 1 << 3,
        Escape = 1 << 4,
        Pipe = 1 << 5,
        Parameter = 1 << 6,
        Word = 1 << 7,
        Image = 1 << 8,
        TaggedText = 1 << 9,
        ParamRef = 1 << 10,

        TripleUnderscore = SingleUnderscore | DoubleUnderscore,
        TripleAsterisk = SingleAsterisk | DoubleAsterisk,
        StyleMarks = TripleAsterisk | TripleUnderscore,
        Bold = DoubleUnderscore | DoubleAsterisk,
        Italics = SingleUnderscore | SingleAsterisk,

        Unstylable = Parameter | Pipe | ParamRef,
        Text = Word | Escape
    }

    interface Token {
        kind: TokenKind;
        content?: string;
        type?: string;
        name?: string;
    }

    interface Label {
        content: string;
        styles: number;
        endingToken?: string;
    }

    export function computeUsedParts(resp: CompileResult, filter?: "onlybuiltin" | "ignorebuiltin", force = false): string[] {
        if (!resp.usedSymbols || !pxt.appTarget.simulator || (!force && !pxt.appTarget.simulator.parts))
            return [];

        const parseParts = (partsRaw: string, ps: string[]) => {
            if (partsRaw) {
                const partsSplit = partsRaw.split(/[ ,]+/g);
                ps.push(...partsSplit.filter(p => !!p && ps.indexOf(p) < 0))
             }
        }

        let parts: string[] = [];
        let hiddenParts: string[] = [];
        Object.keys(resp.usedSymbols).forEach(symbol => {
            const info = resp.usedSymbols[symbol]
            parseParts(info?.attributes.parts, parts)
            parseParts(info?.attributes.hiddenParts, hiddenParts)
        });

        if (filter) {
            const builtinParts = pxt.appTarget.simulator.boardDefinition.onboardComponents;
            if (builtinParts) {
                if (filter === "ignorebuiltin") {
                    parts = parts.filter(p => builtinParts.indexOf(p) === -1);
                } else if (filter === "onlybuiltin") {
                    parts = parts.filter(p => builtinParts.indexOf(p) >= 0);
                }
            }
        }

        // apply hidden parts filter
        parts = parts.filter(p => hiddenParts.indexOf(p) < 0)

        //sort parts (so breadboarding layout is stable w.r.t. code ordering)
        parts.sort();
        parts = parts.reverse(); //not strictly necessary, but it's a little
        // nicer for demos to have "ledmatrix"
        // before "buttonpair"

        return parts;
    }

    export function buildSimJsInfo(compileResult: pxtc.CompileResult): pxtc.BuiltSimJsInfo {
        return {
            js: compileResult.outfiles[pxtc.BINARY_JS],
            targetVersion: pxt.appTarget.versions.target,
            fnArgs: compileResult.usedArguments,
            parts: pxtc.computeUsedParts(compileResult, "ignorebuiltin"),
            usedBuiltinParts: pxtc.computeUsedParts(compileResult, "onlybuiltin"),
            allParts: pxtc.computeUsedParts(compileResult, undefined, true),
            breakpoints: compileResult.breakpoints?.map(bp => bp.id),
        };
    }

    /**
     * Unlocalized category name for a symbol
     */
    export function blocksCategory(si: SymbolInfo): string {
        const n = !si ? undefined : (si.attributes.blockNamespace || si.namespace);
        return n ? Util.capitalize(n.split('.')[0]) : undefined;
    }

    export function getBlocksInfo(info: ApisInfo, categoryFilters?: string[]): BlocksInfo {
        let blocks: SymbolInfo[] = []
        const combinedSet: pxt.Map<SymbolInfo> = {}
        const combinedGet: pxt.Map<SymbolInfo> = {}
        const combinedChange: pxt.Map<SymbolInfo> = {}
        const enumsByName: pxt.Map<EnumInfo> = {};
        const kindsByName: pxt.Map<KindInfo> = {};

        function addCombined(rtp: string, s: SymbolInfo) {
            const isGet = rtp == "get"
            const isSet = rtp == "set"
            const isNumberType = s.retType == "number"
            const m = isGet ? combinedGet : (isSet ? combinedSet : combinedChange)
            const mkey = `${s.namespace}.${s.retType}`

            let ex = U.lookup(m, mkey)
            if (!ex) {
                const tp = `@${rtp}@`

                let paramNameShadow: string, paramValueShadow: string;

                if (s.attributes.blockCombineShadow) {

                    // allowable %blockCombineShadow strings:-
                    //   '{name shadow},' or '{value shadow}' or ',{value shadow}' or '{name shadow},{value shadow}'
                    const attribute = s.attributes.blockCombineShadow;
                    const match = attribute.match(/^([^,.]*),?([^,.]*)$/);
                    if (match && match.length == 3) {
                        paramNameShadow = match[1].trim();
                        paramValueShadow = match[2].trim();
                        if (paramValueShadow.length == 0 && !Util.endsWith(attribute, ",")) {
                            paramValueShadow = paramNameShadow;
                            paramNameShadow = "";
                        }
                    }
                }
                const varName = s.attributes.blockSetVariable || s.namespace.toLocaleLowerCase();

                const paramName = `${varName}=${paramNameShadow || ""}`
                const paramValue = `value=${paramValueShadow || ""}`;

                ex = m[mkey] = {
                    attributes: {
                        blockId: `${isNumberType ? s.namespace : mkey}_blockCombine_${rtp}`,
                        callingConvention: ir.CallingConvention.Plain,
                        group: s.attributes.group, // first %blockCombine defines
                        paramDefl: {},
                        jsDoc: isGet
                            ? U.lf("Read value of a property on an object")
                            : U.lf("Update value of property on an object")
                    },
                    name: tp,
                    namespace: s.namespace,
                    fileName: s.fileName,
                    qName: `${mkey}.${tp}`,
                    pkg: s.pkg,
                    kind: SymbolKind.Property,
                    parameters: [
                        {
                            name: "property",
                            description: isGet ?
                                U.lf("the name of the property to read") :
                                U.lf("the name of the property to change"),
                            isEnum: true,
                            type: "@combined@"
                        },
                        {
                            name: "value",
                            description: isSet ?
                                U.lf("the new value of the property") :
                                U.lf("the amount by which to change the property"),
                            type: s.retType,
                        }
                    ].slice(0, isGet ? 1 : 2),
                    retType: isGet ? s.retType : "void",
                    combinedProperties: []
                }
                ex.attributes.block =
                    isGet ? `%${paramName} %property`:
                        isSet ? U.lf("set %{0} %property to %{1}", paramName, paramValue) :
                            U.lf("change %{0} %property by %{1}", paramName, paramValue)
                updateBlockDef(ex.attributes)
                if (pxt.Util.isTranslationMode()) {
                    ex.attributes.translationId = ex.attributes.block;
                    // This kicks off async work but doesn't wait; give untranslated values to start with
                    // to avoid a race causing a crash.
                    ex.attributes.block = isGet ? `%${paramName} %property` :
                        isSet ? `set %${paramName} %property to %${paramValue}` :
                            `change %${paramName} %property by %${paramValue}`;
                    updateBlockDef(ex.attributes);
                    pxt.crowdin.inContextLoadAsync(ex.attributes.translationId)
                        .then(r => {
                            ex.attributes.block = r;
                            updateBlockDef(ex.attributes);
                        });
                }
                blocks.push(ex)
            }

            ex.combinedProperties.push(s.qName)
        }

        for (let s of pxtc.Util.values(info.byQName)) {
            if (s.attributes.shim === "ENUM_GET" && s.attributes.enumName && s.attributes.blockId) {
                let didFail = false;
                if (enumsByName[s.attributes.enumName]) {
                    pxt.warn(`Enum block ${s.attributes.blockId} trying to overwrite enum ${s.attributes.enumName}`);
                    didFail = true;
                }

                if (!s.attributes.enumMemberName) {
                    pxt.warn(`Enum block ${s.attributes.blockId} should specify enumMemberName`);
                    didFail = true;
                }

                if (!s.attributes.enumPromptHint) {
                    pxt.warn(`Enum block ${s.attributes.blockId} should specify enumPromptHint`);
                    didFail = true;
                }

                if (!s.attributes.enumInitialMembers || !s.attributes.enumInitialMembers.length) {
                    pxt.warn(`Enum block ${s.attributes.blockId} should specify enumInitialMembers`);
                    didFail = true;
                }

                if (didFail) {
                    continue;
                }

                const firstValue = parseInt(s.attributes.enumStartValue as any);

                enumsByName[s.attributes.enumName] = {
                    blockId: s.attributes.blockId,
                    name: s.attributes.enumName,
                    memberName: s.attributes.enumMemberName,
                    firstValue: isNaN(firstValue) ? undefined : firstValue,
                    isBitMask: s.attributes.enumIsBitMask,
                    isHash: s.attributes.enumIsHash,
                    initialMembers: s.attributes.enumInitialMembers,
                    promptHint: s.attributes.enumPromptHint
                };
            }

            if (s.attributes.shim === "KIND_GET" && s.attributes.blockId) {
                const kindNamespace = s.attributes.kindNamespace || s.attributes.blockNamespace || s.namespace;

                if (kindsByName[kindNamespace]) {
                    pxt.warn(`More than one block defined for kind ${kindNamespace}`);
                    continue;
                }

                const initialMembers: string[] = [];
                if (info.byQName[kindNamespace]) {
                    for (const api of pxtc.Util.values(info.byQName)) {
                        if (api.namespace === kindNamespace && api.attributes.isKind) {
                            initialMembers.push(api.name);
                        }
                    }
                }


                kindsByName[kindNamespace] = {
                    blockId: s.attributes.blockId,
                    name: kindNamespace,
                    memberName: s.attributes.kindMemberName || kindNamespace,
                    initialMembers: initialMembers,
                    promptHint: s.attributes.enumPromptHint || Util.lf("Create a new kind..."),
                    createFunctionName: s.attributes.kindCreateFunction || "create"
                };
            }

            if (s.attributes.blockCombine) {
                if (!/@set/.test(s.name)) {
                    addCombined("get", s)
                }

                if (!s.isReadOnly) {
                    if (s.retType == 'number') {
                        addCombined("change", s)
                    }
                    addCombined("set", s)
                }
            } else if (!!s.attributes.block
                && !s.attributes.fixedInstance
                && s.kind != pxtc.SymbolKind.EnumMember
                && s.kind != pxtc.SymbolKind.Module
                && s.kind != pxtc.SymbolKind.Interface
                && s.kind != pxtc.SymbolKind.Class
                && !s.attributes.blockIdentity) {
                if (!s.attributes.blockId)
                    s.attributes.blockId = s.qName.replace(/\./g, "_")
                if (s.attributes.block == "true") {
                    let b = U.uncapitalize(s.name)
                    if (s.kind == SymbolKind.Method || s.kind == SymbolKind.Property) {
                        b += " %" + s.namespace.toLowerCase()
                    }

                    const params = s.parameters?.filter(pr => !parameterTypeIsArrowFunction(pr)) ?? [];
                    for (let p of params) {
                        b += " %" + p.name
                    }

                    s.attributes.block = b
                    updateBlockDef(s.attributes)
                }
                blocks.push(s)
            }
        }

        // derive common block properties from namespace
        for (let b of blocks) {
            let parent = U.lookup(info.byQName, b.namespace)
            if (!parent) continue
            let pattr = parent.attributes as any
            let battr = b.attributes as any

            for (let n of ["blockNamespace", "color", "blockGap"]) {
                if (battr[n] === undefined && pattr[n])
                    battr[n] = pattr[n]
            }
        }

        if (categoryFilters)
            filterCategories(categoryFilters);

        return {
            apis: info,
            blocks,
            blocksById: pxt.Util.toDictionary(blocks, b => b.attributes.blockId),
            enumsByName,
            kindsByName
        }

        function filterCategories(banned: string[]) {
            if (banned.length) {
                blocks = blocks.filter(b => {
                    let ns = (b.attributes.blockNamespace || b.namespace).split('.')[0];
                    return banned.indexOf(ns) === -1;
                });
            }
        }
    }


    export function tsSnippetToPySnippet(param: string, symbol?: SymbolInfo): string {
        const keywords: pxt.Map<string> = {
            "true": "True",
            "false": "False",
            "null": "None"
        }
        const key = keywords[param];
        if (key) {
            return key
        }
        if ((symbol && symbol.kind == SymbolKind.Enum) || (!symbol && param.includes("."))) {
            // Python enums are all caps
            const dotIdx = param.lastIndexOf(".");
            const left = param.substr(0, dotIdx)
            let right = param.substr(dotIdx + 1)
            right = U.snakify(right).toUpperCase();

            if (left) {
                return `${left}.${right}`
            }
            else {
                return right;
            }
        }
        return param;
    }


    export let apiLocalizationStrings: pxt.Map<string> = {};

    export async function localizeApisAsync(apis: pxtc.ApisInfo, mainPkg: pxt.MainPackage): Promise<pxtc.ApisInfo> {
        const lang = pxtc.Util.userLanguage();

        if (lang == "en")
            return Promise.resolve(cleanLocalizations(apis));

        const langLower = lang.toLowerCase();
        const attrJsLocsKey = langLower + "|jsdoc";
        const attrBlockLocsKey = langLower + "|block";

        const loc = await mainPkg.localizationStringsAsync(lang);
        if (apiLocalizationStrings)
            Util.jsonMergeFrom(loc, apiLocalizationStrings);

        const toLocalize = Util.values(apis.byQName).filter(fn => fn.attributes._translatedLanguageCode !== lang);
        await Util.promiseMapAll(toLocalize, async fn => {
            const altLocSrc = fn.attributes.useLoc || fn.attributes.blockAliasFor;
            const altLocSrcFn = altLocSrc && apis.byQName[altLocSrc];

            if (fn.attributes._untranslatedJsDoc) fn.attributes.jsDoc = fn.attributes._untranslatedJsDoc;
            if (fn.attributes._untranslatedBlock) fn.attributes.jsDoc = fn.attributes._untranslatedBlock;

            const lookupLoc = (locSuff: string, attrKey: string) => {
                return loc[fn.qName + locSuff] || fn.attributes.locs?.[attrKey]
                    || (altLocSrcFn && (loc[altLocSrcFn.qName + locSuff] || altLocSrcFn.attributes.locs?.[attrKey]));
            }

            const locJsDoc = lookupLoc("", attrJsLocsKey);
            if (locJsDoc) {
                if (!fn.attributes._untranslatedJsDoc) {
                    fn.attributes._untranslatedJsDoc = fn.attributes.jsDoc;
                }
                fn.attributes.jsDoc = locJsDoc;
            }

            fn.parameters?.forEach(pi => {
                const paramSuff = `|param|${pi.name}`;
                const paramLocs = lookupLoc(paramSuff, langLower + paramSuff);

                if (paramLocs) {
                    pi.description = paramLocs;
                }
            });

            const nsDoc = loc['{id:category}' + Util.capitalize(fn.qName)];
            let locBlock = loc[`${fn.qName}|block`] || fn.attributes.locs?.[attrBlockLocsKey];

            if (fn.attributes.block) {
                const comp = pxt.blocks.compileInfo(fn);
                if (comp.handlerArgs) {
                    for (const arg of comp.handlerArgs) {
                        if (loc[arg.localizationKey]) {
                           setBlockTranslationCacheKey(arg.localizationKey, loc[arg.localizationKey]);
                        }
                        else {
                            clearBlockTranslationCacheKey(arg.localizationKey);
                        }
                    }
                }
            }

            if (!locBlock && altLocSrcFn) {
                const otherTranslation = loc[`${altLocSrcFn.qName}|block`] || altLocSrcFn.attributes.locs?.[attrBlockLocsKey];
                const isSameBlockDef = fn.attributes.block === (altLocSrcFn.attributes._untranslatedBlock || altLocSrcFn.attributes.block);

                if (isSameBlockDef && !!otherTranslation) {
                    locBlock = otherTranslation;
                }
            }

            if (locBlock && pxt.Util.isTranslationMode()) {
                // in translation mode, crowdin sends translation identifiers which break the block parsing
                // push identifier in DOM so that crowdin sends back the actual translation
                fn.attributes.translationId = locBlock;
                locBlock = await pxt.crowdin.inContextLoadAsync(locBlock);
            }

            if (nsDoc) {
                // Check for "friendly namespace"
                if (fn.attributes.block) {
                    fn.attributes.block = locBlock || fn.attributes.block;
                } else {
                    fn.attributes.block = nsDoc;
                }
                updateBlockDef(fn.attributes);
            } else if (fn.attributes.block && locBlock) {
                const ps = pxt.blocks.compileInfo(fn);
                const oldBlock = fn.attributes.block;
                fn.attributes.block = pxt.blocks.normalizeBlock(locBlock, err => {
                    pxt.tickEvent("loc.normalized", {
                        block: fn.attributes.block,
                        lang: lang,
                        error: err,
                    });
                });
                if (!fn.attributes._untranslatedBlock) {
                    fn.attributes._untranslatedBlock = oldBlock;
                }
                if (oldBlock != fn.attributes.block) {
                    updateBlockDef(fn.attributes);
                    const locps = pxt.blocks.compileInfo(fn);
                    if (!hasEquivalentParameters(ps, locps)) {
                        pxt.reportError("loc.errors", "block has non matching arguments", {
                            block: fn.attributes.blockId,
                            lang: lang,
                            originalDefinition: oldBlock,
                            translatedBlock: fn.attributes.block,
                        });
                        pxt.tickEvent("loc.errors", {
                            block: fn.attributes.blockId,
                            lang: lang,
                        });
                        fn.attributes.block = oldBlock;
                        updateBlockDef(fn.attributes);
                    }
                }
            } else {
                updateBlockDef(fn.attributes);
            }
            fn.attributes._translatedLanguageCode = lang;
        });

        return cleanLocalizations(apis);
    }

    function cleanLocalizations(apis: ApisInfo) {
        Util.values(apis.byQName)
            .filter(fb => fb.attributes.block && /^{[^:]+:[^}]+}/.test(fb.attributes.block))
            .forEach(fn => { fn.attributes.block = fn.attributes.block.replace(/^{[^:]+:[^}]+}/, ''); });
        return apis;
    }

    function setBlockTranslationCacheKey(key: string, value: string) {
        const cache = pxt.Util.translationsCache();

        if (!cache[BLOCK_TRANSLATION_CACHE_KEY]) {
            cache[BLOCK_TRANSLATION_CACHE_KEY] = {};
        }

        cache[BLOCK_TRANSLATION_CACHE_KEY][key] = value;
    }

    function clearBlockTranslationCacheKey(key: string) {
        const cache = pxt.Util.translationsCache();

        if (cache[BLOCK_TRANSLATION_CACHE_KEY]) {
            delete cache[BLOCK_TRANSLATION_CACHE_KEY][key];
        }
    }

    export function getBlockTranslationsCacheKey(key: string): string | undefined {
        const cache = pxt.Util.translationsCache();

        if (cache[BLOCK_TRANSLATION_CACHE_KEY]) {
            return cache[BLOCK_TRANSLATION_CACHE_KEY][key];
        }

        return undefined;
    }

    function hasEquivalentParameters(a: pxt.blocks.BlockCompileInfo, b: pxt.blocks.BlockCompileInfo) {
        if (a.parameters.length != b.parameters.length) {
            pxt.debug(`Localized block has extra or missing parameters`);
            return false;
        }

        for (const aParam of a.parameters) {
            const bParam = b.actualNameToParam[aParam.actualName];
            if (!bParam
                || aParam.type != bParam.type
                || aParam.shadowBlockId != bParam.shadowBlockId
                || aParam.definitionName != bParam.definitionName) {
                pxt.debug(`Parameter ${aParam.actualName} type, shadow block, or definition name does not match after localization`);
                return false;
            }
        }
        return true;
    }

    export function emptyExtInfo(): ExtensionInfo {
        let cs = pxt.appTarget.compileService
        if (!cs) cs = {} as any
        const pio = !!cs.platformioIni;
        const docker = cs.buildEngine == "dockermake" || cs.buildEngine == "dockercross" || cs.buildEngine == "dockerespidf";
        const r: ExtensionInfo = {
            functions: [],
            generatedFiles: {},
            extensionFiles: {},
            sha: "",
            compileData: "",
            shimsDTS: "",
            enumsDTS: "",
            onlyPublic: true
        }
        if (pio) r.platformio = { dependencies: {} };
        else if (docker) r.npmDependencies = {};
        else r.yotta = { config: {}, dependencies: {} };
        return r;
    }

    const numberAttributes: (keyof CommentAttrs)[] = [
        "weight",
        "imageLiteral",
        "gridLiteral",
        "topblockWeight",
        "inlineInputModeLimit"
    ];

    const booleanAttributes: (keyof CommentAttrs)[] = [
        "advanced",
        "handlerStatement",
        "afterOnStart",
        "optionalVariableArgs",
        "blockHidden",
        "constantShim",
        "blockCombine",
        "enumIsBitMask",
        "enumIsHash",
        "decompileIndirectFixedInstances",
        "topblock",
        "callInDebugger",
        "duplicateShadowOnDrag",
        "argsNullable",
        "compileHiddenArguments",
        "expandArgumentsInToolbox",
    ];

    export function parseCommentString(cmt: string): CommentAttrs {
        let res: CommentAttrs = {
            paramDefl: {},
            callingConvention: ir.CallingConvention.Plain,
            _source: cmt
        }
        let didSomething = true
        while (didSomething) {
            didSomething = false
            cmt = cmt.replace(/\/\/%[ \t]*([\w\.-]+)(=(("[^"\n]*")|'([^'\n]*)'|([^\s]*)))?/,
                (f: string, n: string, d0: string, d1: string,
                    v0: string, v1: string, v2: string) => {
                    let v = v0 ? JSON.parse(v0) : (d0 ? (v0 || v1 || v2) : "true");
                    if (!v) v = "";
                    if (U.startsWith(n, "block.loc.")) {
                        if (!res.locs) res.locs = {};
                        res.locs[n.slice("block.loc.".length).toLowerCase() + "|block"] = v;
                    } else if (U.startsWith(n, "jsdoc.loc.")) {
                        if (!res.locs) res.locs = {};
                        res.locs[n.slice("jsdoc.loc.".length).toLowerCase() + "|jsdoc"] = v;
                    } else if (U.contains(n, ".loc.")) {
                        if (!res.locs) res.locs = {};
                        const p = n.slice(0, n.indexOf('.loc.'));
                        const l = n.slice(n.indexOf('.loc.') + '.loc.'.length);
                        res.locs[l + "|param|" + p] = v;
                    } else if (U.endsWith(n, ".defl")) {
                        if (v.indexOf(" ") > -1) {
                            res.paramDefl[n.slice(0, n.length - 5)] = `"${v}"`
                        } else {
                            res.paramDefl[n.slice(0, n.length - 5)] = v
                        }
                        if (!res.explicitDefaults) res.explicitDefaults = []
                        res.explicitDefaults.push(n.slice(0, n.length - 5))
                    } else if (U.endsWith(n, ".shadow")) {
                        if (!res._shadowOverrides) res._shadowOverrides = {};
                        res._shadowOverrides[n.slice(0, n.length - 7)] = v;
                    } else if (U.endsWith(n, ".snippet")) {
                        if (!res.paramSnippets) res.paramSnippets = {};
                        const paramName = n.slice(0, n.length - 8);
                        if (!res.paramSnippets[paramName]) res.paramSnippets[paramName] = {};
                        res.paramSnippets[paramName].ts = v;
                    } else if (U.endsWith(n, ".pySnippet")) {
                        if (!res.paramSnippets) res.paramSnippets = {};
                        const paramName = n.slice(0, n.length - 10);
                        if (!res.paramSnippets[paramName]) res.paramSnippets[paramName] = {};
                        res.paramSnippets[paramName].python = v;
                    } else if (U.endsWith(n, ".fieldEditor")) {
                        if (!res.paramFieldEditor) res.paramFieldEditor = {}
                        res.paramFieldEditor[n.slice(0, n.length - 12)] = v
                    } else if (U.contains(n, ".fieldOptions.")) {
                        if (!res.paramFieldEditorOptions) res.paramFieldEditorOptions = {}
                        const field = n.slice(0, n.indexOf('.fieldOptions.'));
                        const key = n.slice(n.indexOf('.fieldOptions.') + 14, n.length);
                        if (!res.paramFieldEditorOptions[field]) res.paramFieldEditorOptions[field] = {};
                        res.paramFieldEditorOptions[field][key] = v
                    } else if (U.contains(n, ".shadowOptions.")) {
                        if (!res.paramShadowOptions) res.paramShadowOptions = {}
                        const field = n.slice(0, n.indexOf('.shadowOptions.'));
                        const key = n.slice(n.indexOf('.shadowOptions.') + 15, n.length);
                        if (!res.paramShadowOptions[field]) res.paramShadowOptions[field] = {};
                        res.paramShadowOptions[field][key] = v
                    } else if (U.endsWith(n, ".min")) {
                        if (!res.paramMin) res.paramMin = {}
                        res.paramMin[n.slice(0, n.length - 4)] = v
                    } else if (U.endsWith(n, ".max")) {
                        if (!res.paramMax) res.paramMax = {}
                        res.paramMax[n.slice(0, n.length - 4)] = v
                    } else {
                        (<any>res)[n] = v;
                    }
                    didSomething = true
                    return "//% "
                })
        }

        for (let n of numberAttributes) {
            if (typeof (res as any)[n] == "string")
                (res as any)[n] = parseInt((res as any)[n])
        }

        for (let n of booleanAttributes) {
            if (typeof (res as any)[n] == "string")
                (res as any)[n] = (res as any)[n] == 'true' || (res as any)[n] == '1' ? true : false;
        }

        if (res.trackArgs) {
            res.trackArgs = ((res.trackArgs as any) as string).split(/[ ,]+/).map(s => parseInt(s) || 0)
        }

        if (res.enumInitialMembers) {
            res.enumInitialMembers = ((res.enumInitialMembers as any) as string).split(/[ ,]+/);
        }

        if (res.blockExternalInputs && !res.inlineInputMode) {
            res.inlineInputMode = "external";
        }

        res.paramHelp = {}
        res.jsDoc = ""
        cmt = cmt.replace(/\/\*\*([^]*?)\*\//g, (full: string, doccmt: string) => {
            doccmt = doccmt.replace(/\n\s*(\*\s*)?/g, "\n")
            doccmt = doccmt.replace(/^\s*@param\s+(\w+)\s+(.*)$/mg, (full: string, name: string, desc: string) => {
                res.paramHelp[name] = desc
                if (!res.paramDefl[name]) {
                    // these don't add to res.explicitDefaults
                    let m = /\beg\.?:\s*(.+)/.exec(desc);
                    if (m && m[1]) {
                        let defaultValue = /(?:"([^"]*)")|(?:'([^']*)')|(?:([^\s,]+))/g.exec(m[1]);
                        if (defaultValue) {
                            let val = defaultValue[1] || defaultValue[2] || defaultValue[3];
                            if (!val) val = "";
                            // If there are spaces in the value, it means the value was surrounded with quotes, so add them back
                            if (val.indexOf(" ") > -1) {
                                res.paramDefl[name] = `"${val}"`;
                            }
                            else {
                                res.paramDefl[name] = val;
                            }
                        }
                    }
                }
                return ""
            })
            res.jsDoc += doccmt
            return ""
        })

        res.jsDoc = res.jsDoc.trim()

        if (res.async)
            res.callingConvention = ir.CallingConvention.Async
        if (res.promise)
            res.callingConvention = ir.CallingConvention.Promise
        if (res.jres)
            res.whenUsed = true
        if (res.subcategories) {
            try {
                res.subcategories = JSON.parse(res.subcategories as any);
            }
            catch (e) {
                res.subcategories = undefined;
            }
        }
        if (res.groups) {
            try {
                res.groups = JSON.parse(res.groups as any);
            }
            catch (e) {
                res.groups = undefined;
            }
        }
        if (res.groupIcons) {
            try {
                res.groupIcons = JSON.parse(res.groupIcons as any);
            }
            catch (e) {
                res.groupIcons = undefined;
            }
        }
        if (res.groupHelp) {
            try {
                res.groupHelp = JSON.parse(res.groupHelp as any);
            }
            catch (e) {
                res.groupHelp = undefined;
            }
        }
        updateBlockDef(res);

        return res
    }

    export function parameterTypeIsArrowFunction(pr: pxtc.ParameterDesc) {
        return pr.type === "Action" || /^\([^\)]*\)\s*=>/.test(pr.type);
    }

    export function updateBlockDef(attrs: CommentAttrs) {
        if (attrs.block) {
            const parts = attrs.block.split("||");
            attrs._def = applyOverrides(parseBlockDefinition(parts[0]));
            if (!attrs._def) pxt.debug("Unable to parse block def for id: " + attrs.blockId);
            if (parts[1]) attrs._expandedDef = applyOverrides(parseBlockDefinition(parts[1]));
            if (parts[1] && !attrs._expandedDef) pxt.debug("Unable to parse expanded block def for id: " + attrs.blockId);
        }

        function applyOverrides(def: ParsedBlockDef) {
            if (attrs._shadowOverrides) {
                def.parameters.forEach(p => {
                    const shadow = attrs._shadowOverrides[p.name];
                    if (shadow === "unset") delete p.shadowBlockId;
                    else if (shadow != null) p.shadowBlockId = shadow;
                });
            }
            return def;
        }
    }

    export function parseBlockDefinition(def: string): ParsedBlockDef {
        const tokens: Token[] = [];
        let currentWord: string;

        let strIndex = 0;
        for (; strIndex < def.length; strIndex++) {
            const char = def[strIndex];
            const restoreIndex = strIndex;
            let newToken: Token;
            switch (char) {
                case "*":
                case "_":
                    const tk = eatToken(c => c == char);
                    const offset = char === "_" ? 2 : 0;
                    if (tk.length === 1) newToken = { kind: TokenKind.SingleAsterisk << offset, content: tk }
                    else if (tk.length === 2) newToken = { kind: TokenKind.DoubleAsterisk << offset, content: tk };
                    else if (tk.length === 3) newToken = { kind: TokenKind.TripleAsterisk << offset, content: tk };
                    else strIndex = restoreIndex; // error: no more than three style marks
                    break;
                case "`":
                    const image = eatEnclosure("`");
                    if (image === undefined) {
                        strIndex = restoreIndex; // error: not terminated
                        break;
                    }
                    newToken = { kind: TokenKind.Image, content: image };
                    break;
                case "|":
                    newToken = { kind: TokenKind.Pipe };
                    break;
                case "\\":
                    if (strIndex < (def.length - 1)) newToken = { kind: TokenKind.Escape, content: def[1 + (strIndex++)] };
                    break;
                case "[":
                    const contentText = eatEnclosure("]");
                    if (contentText !== undefined && def[strIndex++ + 1] === "(") {
                        const contentClass = eatEnclosure(")");
                        if (contentClass !== undefined) {
                            newToken = { kind: TokenKind.TaggedText, content: contentText, type: contentClass };
                            break;
                        }
                    }
                    strIndex = restoreIndex; // error: format should be [text](class)
                    break;
                case "$":
                case "%":
                    const param = eatToken(c => /[a-zA-Z0-9_=]/.test(c), true).split("=");
                    if (param.length > 2) {
                        strIndex = restoreIndex; // error: too many equals signs
                        break;
                    }

                    let varName: string;
                    if (def[strIndex + 1] === "(") {
                        const oldIndex = strIndex;
                        ++strIndex;
                        varName = eatEnclosure(")");
                        if (!varName) strIndex = oldIndex;
                    }
                    newToken = { kind: (char === "$") ? TokenKind.ParamRef : TokenKind.Parameter, content: param[0], type: param[1], name: varName };
                    break;
            }

            if (newToken) {
                if (currentWord)
                    tokens.push({ kind: TokenKind.Word, content: currentWord });
                currentWord = undefined;
                tokens.push(newToken);
            }
            else if (!currentWord) {
                currentWord = char;
            }
            else {
                currentWord += char;
            }
        }

        if (currentWord)
            tokens.push({ kind: TokenKind.Word, content: currentWord });

        const parts: BlockPart[] = [];
        const parameters: BlockParameter[] = [];

        let stack: TokenKind[] = [];
        let open = 0;
        let currentLabel = ""

        let labelStack: (Label | BlockPart)[] = [];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i].kind;
            const top = stack[stack.length - 1];
            if (token & TokenKind.StyleMarks) {
                pushCurrentLabel(tokens[i].content);

                if (token & open) {
                    if (top & token) {
                        stack.pop();
                        open ^= token;

                        // Handle triple tokens
                        const remainder = (top & open) | (token & open);
                        if (remainder) {
                            stack.push(remainder);
                        }
                    }
                    else {
                        // We encountered a mismatched mark, so clear previous styles
                        collapseLabels();
                    }
                }
                else {
                    open |= token;
                    stack.push(token);
                }
            }
            else if (token & TokenKind.Text) {
                currentLabel += tokens[i].content;
            }
            else if (token & TokenKind.Unstylable) {
                pushLabels();
            }

            if (token == TokenKind.Parameter) {
                const param: BlockParameter = { kind: "param", name: tokens[i].content, shadowBlockId: tokens[i].type, ref: false };
                if (tokens[i].name) param.varName = tokens[i].name;
                parts.push(param);
                parameters.push(param);
            }
            else if (token == TokenKind.ParamRef) {
                const param: BlockParameter = { kind: "param", name: tokens[i].content, shadowBlockId: tokens[i].type, ref: true };
                if (tokens[i].name) param.varName = tokens[i].name;
                parts.push(param);
                parameters.push(param);
            }
            else if (token == TokenKind.Image) {
                pushCurrentLabel();
                labelStack.push({ kind: "image", uri: tokens[i].content } as BlockImage);
            }
            else if (token == TokenKind.TaggedText) {
                pushCurrentLabel();
                labelStack.push({ kind: "label", text: tokens[i].content, cssClass: tokens[i].type } as BlockLabel)
            }
            else if (token == TokenKind.Pipe) {
                parts.push({ kind: "break" });
            }
        }

        pushLabels();

        return { parts, parameters };

        function eatToken(pred: (c: string) => boolean, skipCurrent = false) {
            let current = "";
            if (skipCurrent) strIndex++
            while (strIndex < def.length && pred(def[strIndex])) {
                current += def[strIndex];
                ++strIndex;
            }
            if (current) strIndex--;
            return current;
        }

        function eatEnclosure(endMark: string) {
            const content = eatToken(c => c !== endMark, true);
            if (def[strIndex + 1] !== endMark) return undefined;
            ++strIndex;
            return content;
        }

        function collapseLabels() {
            let combined = "";
            let newStack: (Label | BlockPart)[] = [];
            for (const item of labelStack) {
                if (isBlockPart(item)) {
                    newStack.push({
                        content: combined,
                        styles: 0
                    });
                    newStack.push(item);
                    combined = "";
                }
                else {
                    combined += item.content;
                    if (item.endingToken) {
                        combined += item.endingToken;
                    }
                }
            }

            labelStack = newStack;

            if (combined) {
                labelStack.push({
                    content: combined,
                    styles: 0
                });
            }

            // Clear the style state as well
            stack = [];
            open = 0;
        }

        function pushLabels() {
            pushCurrentLabel();

            if (open) {
                collapseLabels();
            }

            while (labelStack.length) {
                const label = labelStack.shift();

                if (isBlockPart(label)) {
                    parts.push(label);
                }
                else {
                    if (!label.content) continue;

                    const styles: string[] = [];

                    if (label.styles & TokenKind.Bold) styles.push("bold");
                    if (label.styles & TokenKind.Italics) styles.push("italics");

                    parts.push({ kind: "label", text: label.content, style: styles } as BlockLabel);
                }
            }
        }

        function pushCurrentLabel(endingToken?: string) {
            labelStack.push({
                content: currentLabel,
                styles: open,
                endingToken
            });
            currentLabel = "";
        }
    }

    function isBlockPart(p: Label | BlockPart): p is BlockPart {
        return !!((p as BlockPart).kind);
    }

    export interface ChecksumBlock {
        magic: number;
        endMarkerPos: number;
        endMarker: number;
        regions: { start: number; length: number; checksum: number; }[];
    }

    export function parseChecksumBlock(buf: ArrayLike<number>, pos = 0): ChecksumBlock {
        let magic = pxt.HF2.read32(buf, pos)
        if ((magic & 0x7fffffff) != 0x07eeb07c) {
            pxt.log("no checksum block magic")
            return null
        }
        let endMarkerPos = pxt.HF2.read32(buf, pos + 4)
        let endMarker = pxt.HF2.read32(buf, pos + 8)
        if (endMarkerPos & 3) {
            pxt.log("invalid end marker position")
            return null
        }
        let pageSize = 1 << (endMarker & 0xff)
        if (pageSize != pxt.appTarget.compile.flashCodeAlign) {
            pxt.log("invalid page size: " + pageSize)
            return null
        }

        let blk: ChecksumBlock = {
            magic,
            endMarkerPos,
            endMarker,
            regions: []
        }

        for (let i = pos + 12; i < buf.length - 7; i += 8) {
            let r = {
                start: pageSize * pxt.HF2.read16(buf, i),
                length: pageSize * pxt.HF2.read16(buf, i + 2),
                checksum: pxt.HF2.read32(buf, i + 4)
            }
            if (r.length && r.checksum) {
                blk.regions.push(r)
            } else {
                break
            }
        }

        //pxt.log(hexDump(buf), blk)

        return blk
    }


    export namespace UF2 {
        export const UF2_MAGIC_START0 = 0x0A324655; // "UF2\n"
        export const UF2_MAGIC_START1 = 0x9E5D5157; // Randomly selected
        export const UF2_MAGIC_END = 0x0AB16F30;    // Ditto

        export const UF2_FLAG_NONE = 0x00000000
        export const UF2_FLAG_NOFLASH = 0x00000001
        export const UF2_FLAG_FILE = 0x00001000
        export const UF2_FLAG_FAMILY_ID_PRESENT = 0x00002000

        export interface Block {
            flags: number;
            targetAddr: number;
            payloadSize: number;
            blockNo: number;
            numBlocks: number;
            fileSize: number;
            familyId: number;
            filename?: string;
            data: Uint8Array;
        }

        export function parseBlock(block: Uint8Array): Block {
            let wordAt = (k: number) => {
                return (block[k] + (block[k + 1] << 8) + (block[k + 2] << 16) + (block[k + 3] << 24)) >>> 0
            }
            if (!block || block.length != 512 ||
                wordAt(0) != UF2_MAGIC_START0 || wordAt(4) != UF2_MAGIC_START1 ||
                wordAt(block.length - 4) != UF2_MAGIC_END)
                return null
            let flags = wordAt(8)
            let payloadSize = wordAt(16)
            if (payloadSize > 476)
                payloadSize = 256
            let filename: string = null
            let familyId = 0
            let fileSize = 0
            if (flags & UF2_FLAG_FILE) {
                let fnbuf = block.slice(32 + payloadSize)
                let len = fnbuf.indexOf(0)
                if (len >= 0) {
                    fnbuf = fnbuf.slice(0, len)
                }
                filename = U.fromUTF8Array(fnbuf);
                fileSize = wordAt(28)
            }

            if (flags & UF2_FLAG_FAMILY_ID_PRESENT) {
                familyId = wordAt(28)
            }

            return {
                flags,
                targetAddr: wordAt(12),
                payloadSize,
                blockNo: wordAt(20),
                numBlocks: wordAt(24),
                fileSize,
                familyId,
                data: block.slice(32, 32 + payloadSize),
                filename
            }
        }

        export function parseFile(blocks: Uint8Array) {
            let r: Block[] = []
            for (let i = 0; i < blocks.length; i += 512) {
                let b = parseBlock(blocks.slice(i, i + 512))
                if (b) r.push(b)
            }
            return r
        }

        export interface ShiftedBuffer {
            start: number;
            buf: Uint8Array;
        }

        export function toBin(blocks: Uint8Array, endAddr: number = undefined): ShiftedBuffer {
            if (blocks.length < 512)
                return null
            let curraddr = -1
            let appstartaddr = -1
            let bufs: Uint8Array[] = []
            for (let i = 0; i < blocks.length; ++i) {
                let ptr = i * 512
                let bl = parseBlock(blocks.slice(ptr, ptr + 512))
                if (!bl) continue
                if (endAddr && bl.targetAddr + 256 > endAddr) break;
                if (curraddr == -1) {
                    curraddr = bl.targetAddr
                    appstartaddr = curraddr
                }
                let padding = bl.targetAddr - curraddr
                if (padding < 0 || padding % 4 || padding > 1024 * 1024)
                    continue
                if (padding > 0)
                    bufs.push(new Uint8Array(padding))
                bufs.push(blocks.slice(ptr + 32, ptr + 32 + bl.payloadSize))
                curraddr = bl.targetAddr + bl.payloadSize
            }
            let len = 0
            for (let b of bufs) len += b.length
            if (len == 0)
                return null
            let r = new Uint8Array(len)
            let dst = 0
            for (let b of bufs) {
                for (let i = 0; i < b.length; ++i)
                    r[dst++] = b[i]
            }
            return {
                buf: r,
                start: appstartaddr,
            }
        }

        function hasAddr(b: Block, a: number) {
            if (!b) return false
            return b.targetAddr <= a && a < b.targetAddr + b.payloadSize
        }

        export function readBytes(blocks: Block[], addr: number, length: number) {
            let res = new Uint8Array(length)
            let bl: Block
            for (let i = 0; i < length; ++i, ++addr) {
                if (!hasAddr(bl, addr))
                    bl = blocks.filter(b => hasAddr(b, addr))[0]
                if (bl)
                    res[i] = bl.data[addr - bl.targetAddr]
            }
            return res
        }

        function setWord(block: Uint8Array, ptr: number, v: number) {
            block[ptr] = (v & 0xff)
            block[ptr + 1] = ((v >> 8) & 0xff)
            block[ptr + 2] = ((v >> 16) & 0xff)
            block[ptr + 3] = ((v >> 24) & 0xff)
        }

        export interface BlockFile {
            currBlock: Uint8Array;
            currPtr: number;
            blocks: Uint8Array[];
            ptrs: number[];
            filename?: string;
            filesize: number;
            familyId: number;
        }

        export function newBlockFile(familyId?: string | number): BlockFile {
            if (typeof familyId == "string")
                familyId = parseInt(familyId)
            return {
                currBlock: null,
                currPtr: -1,
                blocks: [],
                ptrs: [],
                filesize: 0,
                familyId: familyId || 0
            }
        }

        export function finalizeFile(f: BlockFile) {
            for (let i = 0; i < f.blocks.length; ++i) {
                setWord(f.blocks[i], 20, i)
                setWord(f.blocks[i], 24, f.blocks.length)
                if (f.filename)
                    setWord(f.blocks[i], 28, f.filesize)
            }
        }

        export function concatFiles(fs: BlockFile[]) {
            for (let f of fs) {
                finalizeFile(f)
                f.filename = null
            }
            let r = newBlockFile()
            r.blocks = U.concat(fs.map(f => f.blocks))
            for (let f of fs) {
                f.blocks = []
            }
            return r
        }

        export function serializeFile(f: BlockFile) {
            finalizeFile(f)
            let res = ""
            for (let b of f.blocks)
                res += Util.uint8ArrayToString(b)
            return res
        }

        export function readBytesFromFile(f: BlockFile, addr: number, length: number): Uint8Array {
            //pxt.log(`read @${addr} len=${length}`)
            let needAddr = addr >> 8
            let bl: Uint8Array
            if (needAddr == f.currPtr)
                bl = f.currBlock
            else {
                for (let i = 0; i < f.ptrs.length; ++i) {
                    if (f.ptrs[i] == needAddr) {
                        bl = f.blocks[i]
                        break
                    }
                }
                if (bl) {
                    f.currPtr = needAddr
                    f.currBlock = bl
                }
            }
            if (!bl)
                return null
            let res = new Uint8Array(length)
            let toRead = Math.min(length, 256 - (addr & 0xff))
            U.memcpy(res, 0, bl, (addr & 0xff) + 32, toRead)
            let leftOver = length - toRead
            if (leftOver > 0) {
                let le = readBytesFromFile(f, addr + toRead, leftOver)
                U.memcpy(res, toRead, le)
            }
            return res
        }

        export function writeBytes(f: BlockFile, addr: number, bytes: ArrayLike<number>, flags = 0) {
            let currBlock = f.currBlock
            let needAddr = addr >> 8

            // account for unaligned writes
            let thisChunk = 256 - (addr & 0xff)
            if (bytes.length > thisChunk) {
                let b = new Uint8Array(bytes)
                writeBytes(f, addr, b.slice(0, thisChunk))
                while (thisChunk < bytes.length) {
                    let nextOff = Math.min(thisChunk + 256, bytes.length)
                    writeBytes(f, addr + thisChunk, b.slice(thisChunk, nextOff))
                    thisChunk = nextOff
                }
                return
            }

            if (needAddr != f.currPtr) {
                let i = 0;
                currBlock = null
                for (let i = 0; i < f.ptrs.length; ++i) {
                    if (f.ptrs[i] == needAddr) {
                        currBlock = f.blocks[i]
                        break
                    }
                }
                if (!currBlock) {
                    currBlock = new Uint8Array(512)
                    if (f.filename)
                        flags |= UF2_FLAG_FILE
                    else if (f.familyId)
                        flags |= UF2_FLAG_FAMILY_ID_PRESENT
                    setWord(currBlock, 0, UF2_MAGIC_START0)
                    setWord(currBlock, 4, UF2_MAGIC_START1)
                    setWord(currBlock, 8, flags)
                    setWord(currBlock, 12, needAddr << 8)
                    setWord(currBlock, 16, 256)
                    setWord(currBlock, 20, f.blocks.length)
                    setWord(currBlock, 28, f.familyId)
                    setWord(currBlock, 512 - 4, UF2_MAGIC_END)
                    // if bytes are not written, leave them at erase value
                    for (let i = 32; i < 32 + 256; ++i)
                        currBlock[i] = 0xff
                    if (f.filename) {
                        U.memcpy(currBlock, 32 + 256, U.toUTF8Array(f.filename))
                    }
                    f.blocks.push(currBlock)
                    f.ptrs.push(needAddr)
                }
                f.currPtr = needAddr
                f.currBlock = currBlock
            }
            let p = (addr & 0xff) + 32
            for (let i = 0; i < bytes.length; ++i)
                currBlock[p + i] = bytes[i]
            f.filesize = Math.max(f.filesize, bytes.length + addr)
        }

        export function writeHex(f: BlockFile, hex: string[]) {
            let upperAddr = "0000"

            for (let i = 0; i < hex.length; ++i) {
                let m = /:02000004(....)/.exec(hex[i])
                if (m) {
                    upperAddr = m[1]
                }
                m = /^:..(....)00(.*)[0-9A-F][0-9A-F]$/.exec(hex[i])
                if (m) {
                    let newAddr = parseInt(upperAddr + m[1], 16)
                    let hh = m[2]
                    let arr: number[] = []
                    for (let j = 0; j < hh.length; j += 2) {
                        arr.push(parseInt(hh[j] + hh[j + 1], 16))
                    }
                    writeBytes(f, newAddr, arr)
                }
            }
        }


    }
}

namespace ts.pxtc.service {

    export interface OpArg {
        fileName?: string;
        fileContent?: string;
        infoType?: InfoType;
        position?: number;
        wordStartPos?: number;
        wordEndPos?: number;
        options?: CompileOptions;
        search?: SearchOptions;
        format?: FormatOptions;
        blocks?: BlocksOptions;
        extensions?: ExtensionsOptions;
        projectSearch?: ProjectSearchOptions;
        snippet?: SnippetOptions;
        runtime?: pxt.RuntimeOptions;
        light?: boolean; // in light mode?
    }

    export interface SnippetOptions {
        qName: string;
        python?: boolean;
    }

    export interface SearchOptions {
        subset?: pxt.Map<boolean | string>;
        term: string;
        localizedApis?: ApisInfo;
        localizedStrings?: pxt.Map<string>;
    }

    export interface FormatOptions {
        input: string;
        pos: number;
    }


    export enum ExtensionType {
        Bundled = 1,
        Github = 2,
        ShareScript = 3,
    }

    export interface ExtensionMeta {
        name: string;
        displayName?: string;
        fullRepo?: string;
        description?: string;
        imageUrl?: string;
        type?: ExtensionType;
        learnMoreUrl?: string;

        pkgConfig?: pxt.PackageConfig; // Added if the type is Bundled
        repo?: pxt.github.GitRepo; //Added if the type is Github VVN TODO ADD THIS
        scriptInfo?: pxt.Cloud.JsonScript
    }

    export interface SearchInfo {
        id: string;
        name: string;
        qName?: string;
        block?: string;
        namespace?: string;
        jsdoc?: string;
        field?: [string, string];
        localizedCategory?: string;
        builtinBlock?: boolean;
        params?: string;
        dropdownOptions?: string;
    }

    export interface ProjectSearchOptions {
        term: string;
        headers: ProjectSearchInfo[];
    }

    export interface ProjectSearchInfo {
        name: string;
        id?: string;
    }

    export interface BlocksOptions {
        bannedCategories?: string[];
    }
    export interface ExtensionsOptions {
        srcs: ExtensionMeta[];
    }
}
