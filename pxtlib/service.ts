/// <reference path="../localtypings/pxtarget.d.ts"/>
/// <reference path="../localtypings/pxtpackage.d.ts"/>

namespace ts.pxtc {
    export const assert = Util.assert;
    export const oops = Util.oops;
    export import U = pxtc.Util;

    export const ON_START_TYPE = "pxt-on-start";
    export const ON_START_COMMENT = U.lf("on start");
    export const HANDLER_COMMENT = U.lf("code goes here");
    export const TS_STATEMENT_TYPE = "typescript_statement";
    export const TS_OUTPUT_TYPE = "typescript_expression";
    export const BINARY_JS = "binary.js";
    export const BINARY_CS = "binary.cs";
    export const BINARY_ASM = "binary.asm";
    export const BINARY_HEX = "binary.hex";
    export const BINARY_UF2 = "binary.uf2";
    export const BINARY_ELF = "binary.elf";

    export const NATIVE_TYPE_THUMB = "thumb";
    export const NATIVE_TYPE_AVR = "AVR";
    export const NATIVE_TYPE_CS = "C#";
    export const NATIVE_TYPE_AVRVM = "AVRVM";

    export interface ParameterDesc {
        name: string;
        description: string;
        type: string;
        initializer?: string;
        default?: string;
        properties?: PropertyDesc[];
        handlerParameters?: PropertyDesc[];
        options?: pxt.Map<PropertyOption>;
        isEnum?: boolean;
    }

    export interface PropertyDesc {
        name: string;
        type: string;
    }

    export interface PropertyOption {
        value: any;
    }

    export enum SymbolKind {
        None,
        Method,
        Property,
        Function,
        Variable,
        Module,
        Enum,
        EnumMember,
        Class,
        Interface,
    }

    export interface SymbolInfo {
        attributes: CommentAttrs;
        name: string;
        namespace: string;
        kind: SymbolKind;
        parameters: ParameterDesc[];
        retType: string;
        extendsTypes?: string[]; // for classes and interfaces
        isContextual?: boolean;
        qName?: string;
        pkg?: string;
        snippet?: string;
    }

    export interface ApisInfo {
        byQName: pxt.Map<SymbolInfo>;
    }

    export interface BlocksInfo {
        apis: ApisInfo;
        blocks: SymbolInfo[];
        blocksById: pxt.Map<SymbolInfo>;
    }

    export interface CompletionEntry {
        name: string;
        kind: string;
        qualifiedName: string;
    }

    export interface CompletionInfo {
        entries: pxt.Map<SymbolInfo>;
        isMemberCompletion: boolean;
        isNewIdentifierLocation: boolean;
        isTypeLocation: boolean;
    }


    export interface CommentAttrs {
        debug?: boolean; // requires ?dbg=1
        shim?: string;
        enumval?: string;
        helper?: string;
        help?: string;
        async?: boolean;
        promise?: boolean;
        hidden?: boolean;
        undeletable?: boolean;
        callingConvention: ir.CallingConvention;
        block?: string; // format of the block, used at namespace level for category name
        blockId?: string; // unique id of the block
        blockGap?: string; // pixels in toolbox after the block is inserted
        blockExternalInputs?: boolean; // force external inputs. Deprecated; see inlineInputMode.
        blockImportId?: string;
        blockBuiltin?: boolean;
        blockNamespace?: string;
        blockIdentity?: string;
        blockAllowMultiple?: boolean; // override single block behavior for events
        blockHidden?: boolean; // not available directly in toolbox
        blockImage?: boolean; // for enum variable, specifies that it should use an image from a predefined location
        fixedInstances?: boolean;
        fixedInstance?: boolean;
        indexedInstanceNS?: string;
        indexedInstanceShim?: string;
        defaultInstance?: string;
        autoCreate?: string;
        noRefCounting?: boolean;
        color?: string;
        colorSecondary?: string;
        colorTertiary?: string;
        icon?: string;
        imageLiteral?: number;
        weight?: number;
        parts?: string;
        trackArgs?: number[];
        advanced?: boolean;
        deprecated?: boolean;
        useEnumVal?: boolean; // for conversion from typescript to blocks with enumVal
        // On block
        subcategory?: string;
        group?: string;
        whenUsed?: boolean;
        // On namepspace
        subcategories?: string[];
        groups?: string[];
        labelLineWidth?: string;
        handlerStatement?: boolean; // indicates a block with a callback that can be used as a statement
        afterOnStart?: boolean; // indicates an event that should be compiled after on start when converting to typescript

        // on interfaces
        indexerGet?: string;
        indexerSet?: string;

        mutate?: string;
        mutateText?: string;
        mutatePrefix?: string;
        mutateDefaults?: string;
        mutatePropertyEnum?: string;
        inlineInputMode?: string; // can be inline, external, or auto

        optionalVariableArgs?: boolean;
        toolboxVariableArgs?: string;

        _name?: string;
        _source?: string;
        jsDoc?: string;
        paramHelp?: pxt.Map<string>;
        // foo.defl=12 -> paramDefl: { foo: "12" }
        paramDefl: pxt.Map<string>;

        paramMin?: pxt.Map<string>; // min range
        paramMax?: pxt.Map<string>; // max range
        // Map for custom field editor parameters
        paramFieldEditor?: pxt.Map<string>; //.fieldEditor
        paramShadowOptions?: pxt.Map<pxt.Map<string>>; //.shadowOptions.
        paramFieldEditorOptions?: pxt.Map<pxt.Map<string>>; //.fieldOptions.
    }

    export interface LocationInfo {
        fileName: string;
        start: number;
        length: number;

        //derived
        line: number;
        column: number;
        endLine?: number;
        endColumn?: number;
    }

    export interface FunctionLocationInfo extends LocationInfo {
        functionName: string;
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

    export interface CompileResult {
        outfiles: pxt.Map<string>;
        diagnostics: KsDiagnostic[];
        success: boolean;
        times: pxt.Map<number>;
        //ast?: Program; // Not needed, moved to pxtcompiler
        breakpoints?: Breakpoint[];
        procDebugInfo?: ProcDebugInfo[];
        blocksInfo?: BlocksInfo;
        usedSymbols?: pxt.Map<SymbolInfo>; // q-names of symbols used
        usedArguments?: pxt.Map<string[]>;
        // client options
        saveOnly?: boolean;
        userContextWindow?: Window;
        downloadFileBaseName?: string;
        confirmAsync?: (confirmOptions: {}) => Promise<number>;
        configData?: ConfigEntry[];
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

    export function computeUsedParts(resp: CompileResult, ignoreBuiltin = false): string[] {
        if (!resp.usedSymbols || !pxt.appTarget.simulator || !pxt.appTarget.simulator.parts)
            return [];

        let parts: string[] = [];
        for (let symbol in resp.usedSymbols) {
            let info = resp.usedSymbols[symbol]
            if (info && info.attributes.parts) {
                let partsRaw = info.attributes.parts;
                if (partsRaw) {
                    let partsSplit = partsRaw.split(/[ ,]+/);
                    partsSplit.forEach(p => {
                        if (0 < p.length && parts.indexOf(p) < 0) {
                            parts.push(p);
                        }
                    });
                }
            }
        }

        if (ignoreBuiltin) {
            const builtinParts = pxt.appTarget.simulator.boardDefinition.onboardComponents;
            if (builtinParts)
                parts = parts.filter(p => builtinParts.indexOf(p) < 0);
        }

        //sort parts (so breadboarding layout is stable w.r.t. code ordering)
        parts.sort();
        parts = parts.reverse(); //not strictly necessary, but it's a little
        // nicer for demos to have "ledmatrix"
        // before "buttonpair"

        return parts;
    }

    /**
     * Unlocalized category name for a symbol
     */
    export function blocksCategory(si: SymbolInfo): string {
        const n = !si ? undefined : (si.attributes.blockNamespace || si.namespace);
        return n ? Util.capitalize(n.split('.')[0]) : undefined;
    }

    export function getBlocksInfo(info: ApisInfo): BlocksInfo {
        const blocks = pxtc.Util.values(info.byQName)
            .filter(s => !!s.attributes.block && !!s.attributes.blockId && (s.kind != pxtc.SymbolKind.EnumMember));
        return {
            apis: info,
            blocks,
            blocksById: pxt.Util.toDictionary(blocks, b => b.attributes.blockId)
        }
    }

    export function localizeApisAsync(apis: pxtc.ApisInfo, mainPkg: pxt.MainPackage): Promise<pxtc.ApisInfo> {
        const lang = pxtc.Util.userLanguage();
        if (pxtc.Util.userLanguage() == "en") return Promise.resolve(apis);

        return mainPkg.localizationStringsAsync(lang)
            .then(loc => Util.values(apis.byQName).forEach(fn => {
                const jsDoc = loc[fn.qName]
                if (jsDoc) {
                    fn.attributes.jsDoc = jsDoc;
                    if (fn.parameters)
                        fn.parameters.forEach(pi => pi.description = loc[`${fn.qName}|param|${pi.name}`] || pi.description);
                }
                const nsDoc = loc['{id:category}' + Util.capitalize(fn.qName)];
                const locBlock = loc[`${fn.qName}|block`];
                if (nsDoc) {
                    // Check for "friendly namespace"
                    if (fn.attributes.block) {
                        fn.attributes.block = locBlock || fn.attributes.block;
                    } else {
                        fn.attributes.block = nsDoc;
                    }
                }
                else if (fn.attributes.block && locBlock) {
                    const ps = pxt.blocks.parameterNames(fn).attrNames;
                    const oldBlock = fn.attributes.block;
                    fn.attributes.block = pxt.blocks.normalizeBlock(locBlock);
                    if (oldBlock != fn.attributes.block) {
                        const locps = pxt.blocks.parameterNames(fn).attrNames;
                        if (JSON.stringify(ps) != JSON.stringify(locps)) {
                            pxt.log(`block has non matching arguments: ${oldBlock} vs ${fn.attributes.block}`)
                            fn.attributes.block = oldBlock;
                        }
                    }
                }
            }))
            .then(() => apis);
    }

    export function emptyExtInfo(): ExtensionInfo {
        let cs = pxt.appTarget.compileService
        if (!cs) cs = {} as any
        const pio = !!cs.platformioIni;
        const docker = cs.buildEngine == "dockermake";
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

    const numberAttributes = ["weight", "imageLiteral"]
    const booleanAttributes = ["advanced", "handlerStatement", "afterOnStart", "optionalVariableArgs", "blockHidden"]

    export function parseCommentString(cmt: string): CommentAttrs {
        let res: CommentAttrs = {
            paramDefl: {},
            callingConvention: ir.CallingConvention.Plain,
            _source: cmt
        }
        let didSomething = true
        while (didSomething) {
            didSomething = false
            cmt = cmt.replace(/\/\/%[ \t]*([\w\.]+)(=(("[^"\n]*")|'([^'\n]*)'|([^\s]*)))?/,
                (f: string, n: string, d0: string, d1: string,
                    v0: string, v1: string, v2: string) => {
                    let v = v0 ? JSON.parse(v0) : (d0 ? (v0 || v1 || v2) : "true");
                    if (!v) v = "";
                    if (U.endsWith(n, ".defl")) {
                        if (v.indexOf(" ") > -1) {
                            res.paramDefl[n.slice(0, n.length - 5)] = `"${v}"`
                        } else {
                            res.paramDefl[n.slice(0, n.length - 5)] = v
                        }
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

        return res
    }

    // TODO should be internal
    export namespace hex {
        export function isSetupFor(extInfo: ExtensionInfo) {
            return currentSetup == extInfo.sha
        }

        export let currentSetup: string = null;
        export let currentHexInfo: pxtc.HexInfo;

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

            //console.log(hexDump(buf), blk)

            return blk
        }

    }

    export var decodeBase64 = function (s: string) { return atob(s); }

    export namespace UF2 {
        export const UF2_MAGIC_START0 = 0x0A324655; // "UF2\n"
        export const UF2_MAGIC_START1 = 0x9E5D5157; // Randomly selected
        export const UF2_MAGIC_END = 0x0AB16F30;    // Ditto

        export const UF2_FLAG_NONE = 0x00000000
        export const UF2_FLAG_NOFLASH = 0x00000001
        export const UF2_FLAG_FILE = 0x00001000

        export interface Block {
            flags: number;
            targetAddr: number;
            payloadSize: number;
            blockNo: number;
            numBlocks: number;
            fileSize: number;
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
            if (flags & UF2_FLAG_FILE) {
                let fnbuf = block.slice(32 + payloadSize)
                let len = fnbuf.indexOf(0)
                if (len >= 0) {
                    fnbuf = fnbuf.slice(0, len)
                }
                filename = U.fromUTF8(U.uint8ArrayToString(fnbuf))
            }
            return {
                flags,
                targetAddr: wordAt(12),
                payloadSize,
                blockNo: wordAt(20),
                numBlocks: wordAt(24),
                fileSize: wordAt(28),
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

        export function toBin(blocks: Uint8Array): ShiftedBuffer {
            if (blocks.length < 512)
                return null
            let curraddr = -1
            let appstartaddr = -1
            let bufs: Uint8Array[] = []
            for (let i = 0; i < blocks.length; ++i) {
                let ptr = i * 512
                let bl = parseBlock(blocks.slice(ptr, ptr + 512))
                if (!bl) continue
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
        }

        export function newBlockFile(): BlockFile {
            return {
                currBlock: null,
                currPtr: -1,
                blocks: [],
                ptrs: [],
                filesize: 0
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
            //console.log(`read @${addr} len=${length}`)
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

        export function writeBytes(f: BlockFile, addr: number, bytes: ArrayLike<number>) {
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
                    setWord(currBlock, 0, UF2_MAGIC_START0)
                    setWord(currBlock, 4, UF2_MAGIC_START1)
                    setWord(currBlock, 8, f.filename ? UF2_FLAG_FILE : UF2_FLAG_NONE)
                    setWord(currBlock, 12, needAddr << 8)
                    setWord(currBlock, 16, 256)
                    setWord(currBlock, 20, f.blocks.length)
                    setWord(currBlock, 512 - 4, UF2_MAGIC_END)
                    if (f.filename) {
                        U.memcpy(currBlock, 32 + 256, U.stringToUint8Array(U.toUTF8(f.filename)))
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
        position?: number;
        options?: CompileOptions;
        search?: SearchOptions;
        format?: FormatOptions;
    }

    export interface SearchOptions {
        subset?: pxt.Map<boolean>;
        term: string;
        localizedApis?: ApisInfo;
        localizedStrings?: pxt.Map<string>;
    }

    export interface FormatOptions {
        input: string;
        pos: number;
    }

    export interface SearchInfo {
        id: string;
        name: string;
        qName?: string;
        block?: string;
        namespace?: string;
        jsdoc?: string;
        field?: [string, string];
    }
}

namespace ts.pxtc.ir {

    export enum CallingConvention {
        Plain,
        Async,
        Promise,
    }
}