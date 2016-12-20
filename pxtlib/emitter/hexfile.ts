namespace ts.pxtc {

    // HEX file documentation at: https://en.wikipedia.org/wiki/Intel_HEX

    /* From above:
    This example shows a file that has four data records followed by an end-of-file record:

:10010000214601360121470136007EFE09D2190140
:100110002146017E17C20001FF5F16002148011928
:10012000194E79234623965778239EDA3F01B2CAA7
:100130003F0156702B5E712B722B732146013421C7
:00000001FF

        A record (line of text) consists of six fields (parts) that appear in order from left to right:
        - Start code, one character, an ASCII colon ':'.
        - Byte count, two hex digits, indicating the number of bytes (hex digit pairs) in the data field. 
          The maximum byte count is 255 (0xFF). 16 (0x10) and 32 (0x20) are commonly used byte counts.
        - Address, four hex digits, representing the 16-bit beginning memory address offset of the data. 
          The physical address of the data is computed by adding this offset to a previously established 
          base address, thus allowing memory addressing beyond the 64 kilobyte limit of 16-bit addresses. 
          The base address, which defaults to zero, can be changed by various types of records. 
          Base addresses and address offsets are always expressed as big endian values.
        - Record type (see record types below), two hex digits, 00 to 05, defining the meaning of the data field.
        - Data, a sequence of n bytes of data, represented by 2n hex digits. Some records omit this field (n equals zero). 
          The meaning and interpretation of data bytes depends on the application.
        - Checksum, two hex digits, a computed value that can be used to verify the record has no errors.

    */

    export const vtableShift = 2;

    export namespace UF2 {
        export const startMagic = "UF2\x0AWQ]\x9E"
        export const endMagic = "0o\xB1\x0A"

        export const UF2_MAGIC_START0 = 0x0A324655; // "UF2\n"
        export const UF2_MAGIC_START1 = 0x9E5D5157; // Randomly selected
        export const UF2_MAGIC_END = 0x0AB16F30;    // Ditto

        export interface Block {
            flags: number;
            targetAddr: number;
            payloadSize: number;
            blockNo: number;
            numBlocks: number;
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
            return {
                flags: wordAt(8),
                targetAddr: wordAt(12),
                payloadSize: wordAt(16),
                blockNo: wordAt(20),
                numBlocks: wordAt(24),
                data: block.slice(32, 512 - 4)
            }
        }

        export function toBin(blocks: Uint8Array): Uint8Array {
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
            return r
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
        }

        export function newBlockFile(): BlockFile {
            return {
                currBlock: null,
                currPtr: -1,
                blocks: [],
                ptrs: []
            }
        }

        export function serializeFile(f: BlockFile) {
            for (let i = 0; i < f.blocks.length; ++i) {
                setWord(f.blocks[i], 24, f.blocks.length)
            }
            let res = ""
            for (let b of f.blocks)
                res += Util.uint8ArrayToString(b)
            return res
        }

        export function writeBytes(f: BlockFile, addr: number, bytes: number[]) {
            let currBlock = f.currBlock
            let needAddr = addr >> 8
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
                    setWord(currBlock, 12, needAddr << 8)
                    setWord(currBlock, 16, 256)
                    setWord(currBlock, 20, f.blocks.length)
                    setWord(currBlock, 512 - 4, UF2_MAGIC_END)
                    f.blocks.push(currBlock)
                    f.ptrs.push(needAddr)
                }
                f.currPtr = needAddr
                f.currBlock = currBlock
            }
            let p = (addr & 0xff) + 32
            for (let i = 0; i < bytes.length; ++i)
                currBlock[p + i] = bytes[i]
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



    // TODO should be internal
    export namespace hex {
        let funcInfo: Map<FuncInfo>;
        let hex: string[];
        let jmpStartAddr: number;
        let jmpStartIdx: number;
        let bytecodePaddingSize: number;
        let bytecodeStartAddr: number;
        export let bytecodeStartAddrPadded: number;
        let bytecodeStartIdx: number;
        let asmLabels: Map<boolean> = {};
        export let asmTotalSource: string = "";
        export const defaultPageSize = 0x400;

        // utility function
        function swapBytes(str: string) {
            let r = ""
            let i = 0
            for (; i < str.length; i += 2)
                r = str[i] + str[i + 1] + r
            assert(i == str.length)
            return r
        }

        export function setupInlineAssembly(opts: CompileOptions) {
            asmLabels = {}
            let asmSources = opts.sourceFiles.filter(f => U.endsWith(f, ".asm"))
            asmTotalSource = ""
            let asmIdx = 0

            for (let f of asmSources) {
                let src = opts.fileSystem[f]
                src.replace(/^\s*(\w+):/mg, (f, lbl) => {
                    asmLabels[lbl] = true
                    return ""
                })
                let code =
                    ".section code\n" +
                    "@stackmark func\n" +
                    "@scope user" + asmIdx++ + "\n" +
                    src + "\n" +
                    "@stackempty func\n" +
                    "@scope\n"
                asmTotalSource += code
            }
        }


        export function isSetupFor(extInfo: ExtensionInfo) {
            return currentSetup == extInfo.sha
        }

        function parseHexBytes(bytes: string): number[] {
            bytes = bytes.replace(/^[\s:]/, "")
            if (!bytes) return []
            let m = /^([a-f0-9][a-f0-9])/i.exec(bytes)
            if (m)
                return [parseInt(m[1], 16)].concat(parseHexBytes(bytes.slice(2)))
            else
                throw oops("bad bytes " + bytes)
        }

        let currentSetup: string = null;
        export let currentHexInfo: pxtc.HexInfo;

        // setup for a particular .hex template file (which corresponds to the C++ source in included packages and the board)
        export function flashCodeAlign(opts: CompileTarget) {
            return opts.flashCodeAlign || defaultPageSize
        }

        // some hex files use '02' records instead of '04' record for addresses. go figure.
        function patchSegmentHex(hex: string[]) {
            for (let i = 0; i < hex.length; ++i) {
                // :020000021000EC
                if (hex[i][8] == '2') {
                    let m = /^:02....02(....)..$/.exec(hex[i])
                    U.assert(!!m)
                    let upaddr = parseInt(m[1], 16) * 16
                    U.assert((upaddr & 0xffff) == 0)
                    hex[i] = hexBytes([0x02, 0x00, 0x00, 0x04, 0x00, upaddr >> 16])
                }
            }
        }

        export function setupFor(opts: CompileTarget, extInfo: ExtensionInfo, hexinfo: pxtc.HexInfo) {
            if (isSetupFor(extInfo))
                return;

            currentSetup = extInfo.sha;
            currentHexInfo = hexinfo;

            hex = hexinfo.hex;

            patchSegmentHex(hex)

            let i = 0;
            let upperAddr = "0000"
            let lastAddr = 0
            let lastIdx = 0
            bytecodeStartAddr = 0

            let hitEnd = () => {
                if (!bytecodeStartAddr) {
                    let bytes = parseHexBytes(hex[lastIdx])
                    let missing = (0x10 - ((lastAddr + bytes[0]) & 0xf)) & 0xf
                    if (missing)
                        if (bytes[2] & 0xf) {
                            let next = lastAddr + bytes[0]
                            let newline = [missing, next >> 8, next & 0xff, 0x00]
                            for (let i = 0; i < missing; ++i)
                                newline.push(0x00)
                            lastIdx++
                            hex.splice(lastIdx, 0, hexBytes(newline))
                            bytecodeStartAddr = next + missing
                        } else {
                            if (bytes[0] != 0x10) {
                                bytes.pop() // checksum
                                bytes[0] = 0x10;
                                while (bytes.length < 20)
                                    bytes.push(0x00)
                                hex[lastIdx] = hexBytes(bytes)
                            }
                            bytecodeStartAddr = lastAddr + 16
                        }
                    else {
                        bytecodeStartAddr = lastAddr + bytes[0]
                    }

                    bytecodeStartIdx = lastIdx + 1
                    const pageSize = flashCodeAlign(opts)
                    bytecodeStartAddrPadded = (bytecodeStartAddr & ~(pageSize - 1)) + pageSize
                    const paddingBytes = bytecodeStartAddrPadded - bytecodeStartAddr
                    assert((paddingBytes & 0xf) == 0)
                    bytecodePaddingSize = paddingBytes
                }
            }

            for (; i < hex.length; ++i) {
                let m = /:02000004(....)/.exec(hex[i])
                if (m) {
                    upperAddr = m[1]
                }
                m = /^:..(....)00/.exec(hex[i])
                if (m) {
                    let newAddr = parseInt(upperAddr + m[1], 16)
                    if (newAddr >= 0x3C000)
                        hitEnd()
                    lastIdx = i
                    lastAddr = newAddr
                }

                if (/^:00000001/.test(hex[i]))
                    hitEnd()

                // random magic number, which marks the beginning of the array of function pointers in the .hex file
                // it is defined in pxt-microbit-core
                m = /^:10....000108010842424242010801083ED8E98D/.exec(hex[i])
                if (m) {
                    jmpStartAddr = lastAddr
                    jmpStartIdx = i
                }
            }

            if (!jmpStartAddr)
                oops("No hex start")

            if (!bytecodeStartAddr)
                oops("No hex end")

            funcInfo = {};
            let funs: FuncInfo[] = extInfo.functions;

            for (let i = jmpStartIdx + 1; i < hex.length; ++i) {
                let m = /^:10(....)00(.{16})/.exec(hex[i])

                if (!m) continue;

                let s = hex[i].slice(9)
                let step = opts.shortPointers ? 4 : 8
                while (s.length >= step) {
                    let inf = funs.shift()
                    if (!inf) return;
                    funcInfo[inf.name] = inf;
                    let hexb = s.slice(0, step)
                    //console.log(inf.name, hexb)
                    inf.value = parseInt(swapBytes(hexb), 16)
                    if (!inf.value) {
                        U.oops("No value for " + inf.name + " / " + hexb)
                    }
                    s = s.slice(step)
                }
            }

            oops();
        }

        export function validateShim(funname: string, shimName: string, hasRet: boolean, numArgs: number) {
            if (shimName == "TD_ID" || shimName == "TD_NOOP")
                return
            if (U.lookup(asmLabels, shimName))
                return
            let nm = `${funname}(...) (shim=${shimName})`
            let inf = lookupFunc(shimName)
            if (inf) {
                if (!hasRet) {
                    if (inf.type != "P")
                        U.userError("expecting procedure for " + nm);
                } else {
                    if (inf.type != "F")
                        U.userError("expecting function for " + nm);
                }
                if (numArgs != inf.args)
                    U.userError("argument number mismatch: " + numArgs + " vs " + inf.args + " in C++")
            } else {
                U.userError("function not found: " + nm)
            }
        }

        export function lookupFunc(name: string) {
            return funcInfo[name]
        }

        export function lookupFunctionAddr(name: string) {
            let inf = lookupFunc(name)
            if (inf)
                return inf.value
            return null
        }

        export function hexTemplateHash() {
            let sha = currentSetup ? currentSetup.slice(0, 16) : ""
            while (sha.length < 16) sha += "0"
            return sha.toUpperCase()
        }

        export function hexPrelude() {
            return `    .startaddr 0x${bytecodeStartAddrPadded.toString(16)}\n`
        }

        function hexBytes(bytes: number[]) {
            let chk = 0
            let r = ":"
            bytes.forEach(b => chk += b)
            bytes.push((-chk) & 0xff)
            bytes.forEach(b => r += ("0" + b.toString(16)).slice(-2))
            return r.toUpperCase();
        }

        export function patchHex(bin: Binary, buf: number[], shortForm: boolean, useuf2: boolean) {
            let myhex = hex.slice(0, bytecodeStartIdx)

            assert(buf.length < 32000)

            // store the size of the program (in 16 bit words)
            buf[17] = buf.length

            let zeros: number[] = []
            for (let i = 0; i < bytecodePaddingSize >> 1; ++i)
                zeros.push(0)
            buf = zeros.concat(buf)

            let ptr = 0

            function nextLine(buf: number[], addr: number) {
                let bytes = [0x10, (addr >> 8) & 0xff, addr & 0xff, 0]
                for (let j = 0; j < 8; ++j) {
                    bytes.push((buf[ptr] || 0) & 0xff)
                    bytes.push((buf[ptr] || 0) >>> 8)
                    ptr++
                }
                return bytes
            }

            // 0x4209 is the version number matching pxt-microbit-core
            let hd = [0x4209, 0, bytecodeStartAddrPadded & 0xffff, bytecodeStartAddrPadded >>> 16]
            let tmp = hexTemplateHash()
            for (let i = 0; i < 4; ++i)
                hd.push(parseInt(swapBytes(tmp.slice(i * 4, i * 4 + 4)), 16))

            let uf2 = useuf2 ? UF2.newBlockFile() : null

            if (uf2) {
                UF2.writeHex(uf2, myhex)
                UF2.writeBytes(uf2, jmpStartAddr, nextLine(hd, jmpStartIdx).slice(4))
            } else {
                myhex[jmpStartIdx] = hexBytes(nextLine(hd, jmpStartAddr))
            }

            ptr = 0

            if (shortForm) myhex = []

            let addr = bytecodeStartAddr;
            let upper = (addr - 16) >> 16
            while (ptr < buf.length) {
                if (uf2) {
                    UF2.writeBytes(uf2, addr, nextLine(buf, addr).slice(4))
                } else {
                    if ((addr >> 16) != upper) {
                        upper = addr >> 16
                        myhex.push(hexBytes([0x02, 0x00, 0x00, 0x04, upper >> 8, upper & 0xff]))
                    }
                    myhex.push(hexBytes(nextLine(buf, addr)))
                }
                addr += 16
            }

            if (!shortForm) {
                let app = hex.slice(bytecodeStartIdx)
                if (uf2)
                    UF2.writeHex(uf2, app)
                else
                    Util.pushRange(myhex, app)
            }

            if (uf2)
                return [UF2.serializeFile(uf2)]
            else
                return myhex;
        }
    }

    export function asmline(s: string) {
        if (!/(^[\s;])|(:$)/.test(s))
            s = "    " + s
        return s + "\n"
    }

    function stringLiteral(s: string) {
        let r = "\""
        for (let i = 0; i < s.length; ++i) {
            // TODO generate warning when seeing high character ?
            let c = s.charCodeAt(i) & 0xff
            let cc = String.fromCharCode(c)
            if (cc == "\\" || cc == "\"")
                r += "\\" + cc
            else if (cc == "\n")
                r += "\\n"
            else if (c <= 0xf)
                r += "\\x0" + c.toString(16)
            else if (c < 32 || c > 127)
                r += "\\x" + c.toString(16)
            else
                r += cc;
        }
        return r + "\""
    }

    function emitStrings(bin: Binary) {
        for (let s of Object.keys(bin.strings)) {
            let lbl = bin.strings[s]
            // string representation of DAL - 0xffff in general for ref-counted objects means it's static and shouldn't be incr/decred
            bin.otherLiterals.push(`
.balign 4
${lbl}meta: .short 0xffff, ${s.length}
${lbl}: .string ${stringLiteral(s)}
`)
        }
    }

    function vtableToAsm(info: ClassInfo) {
        let s = `
        .balign ${1 << vtableShift}
${info.id}_VT:
        .short ${info.refmask.length * 4 + 4}  ; size in bytes
        .byte ${info.vtable.length + 2}, 0  ; num. methods
`;

        s += `        .word ${info.id}_IfaceVT\n`
        s += `        .word pxt::RefRecord_destroy|1\n`
        s += `        .word pxt::RefRecord_print|1\n`

        for (let m of info.vtable) {
            s += `        .word ${m.label()}|1\n`
        }

        let refmask = info.refmask.map(v => v ? "1" : "0")
        while (refmask.length < 2 || refmask.length % 2 != 0)
            refmask.push("0")

        s += `        .byte ${refmask.join(",")}\n`

        // VTable for interface method is just linear. If we ever have lots of interface
        // methods and lots of classes this could become a problem. We could use a table
        // of (iface-member-id, function-addr) pairs and binary search.
        // See https://codethemicrobit.com/nymuaedeou for Thumb binary search.
        s += `
        .balign 4
${info.id}_IfaceVT:
`
        for (let m of info.itable) {
            s += `        .word ${m ? m.label() + "|1" : "0"}\n`
        }

        s += "\n"
        return s
    }


    function serialize(bin: Binary, opts: CompileOptions) {
        let asmsource = `; start
${hex.hexPrelude()}        
    .hex 708E3B92C615A841C49866C975EE5197 ; magic number
    .hex ${hex.hexTemplateHash()} ; hex template hash
    .hex 0000000000000000 ; @SRCHASH@
    .short ${bin.globalsWords}   ; num. globals
    .short 0 ; patched with number of words resulting from assembly
    .word 0 ; reserved
    .word 0 ; reserved
    .word 0 ; reserved
`
        let snippets: AssemblerSnippets = null;
        if (opts.target.nativeType == "AVR")
            snippets = new AVRSnippets()
        else
            snippets = new ThumbSnippets()
        bin.procs.forEach(p => {
            let p2a = new ProctoAssembler(snippets, bin, p)
            asmsource += "\n" + p2a.getAssembly() + "\n"
        })

        bin.usedClassInfos.forEach(info => {
            asmsource += vtableToAsm(info)
        })

        U.iterMap(bin.codeHelpers, (code, lbl) => {
            asmsource += `    .section code\n${lbl}:\n${code}\n`
        })

        asmsource += hex.asmTotalSource

        asmsource += "_js_end:\n"
        emitStrings(bin)
        asmsource += bin.otherLiterals.join("")
        asmsource += "_program_end:\n"

        return asmsource
    }

    function patchSrcHash(src: string) {
        let sha = U.sha256(src)
        return src.replace(/\n.*@SRCHASH@\n/, "\n    .hex " + sha.slice(0, 16).toUpperCase() + " ; program hash\n")
    }

    export function processorInlineAssemble(nativeType: string, src: string) {
        let b = mkProcessorFile(nativeType)
        b.disablePeepHole = true
        b.emit(src)
        throwAssemblerErrors(b)

        let res: number[] = []
        for (let i = 0; i < b.buf.length; i += 2) {
            res.push((((b.buf[i + 1] || 0) << 16) | b.buf[i]) >>> 0)
        }
        return res
    }

    function mkProcessorFile(nativeType: string) {
        let processor: assembler.AbstractProcessor = null
        if (nativeType == "AVR")
            processor = new avr.AVRProcessor()
        else
            processor = new thumb.ThumbProcessor()

        processor.testAssembler(); // just in case

        let b = new assembler.File(processor);
        b.lookupExternalLabel = hex.lookupFunctionAddr;
        b.normalizeExternalLabel = s => {
            let inf = hex.lookupFunc(s)
            if (inf) return inf.name;
            return s
        }
        // b.throwOnError = true;

        return b
    }

    function throwAssemblerErrors(b: assembler.File) {
        if (b.errors.length > 0) {
            let userErrors = ""
            b.errors.forEach(e => {
                let m = /^user(\d+)/.exec(e.scope)
                if (m) {
                    // This generally shouldn't happen, but it may for certin kind of global 
                    // errors - jump range and label redefinitions
                    let no = parseInt(m[1]) // TODO lookup assembly file name
                    userErrors += U.lf("At inline assembly:\n")
                    userErrors += e.message
                }
            })

            if (userErrors) {
                //TODO
                console.log(U.lf("errors in inline assembly"))
                console.log(userErrors)
                throw new Error(b.errors[0].message)
            } else {
                throw new Error(b.errors[0].message)
            }
        }
    }

    let peepDbg = false
    function assemble(nativeType: string, bin: Binary, src: string) {
        let b = mkProcessorFile(nativeType)
        b.emit(src);

        src = b.getSource(!peepDbg);

        throwAssemblerErrors(b)

        return {
            src: src,
            buf: b.buf,
            thumbFile: b
        }
    }

    function addSource(meta: string, binstring: string) {
        let metablob = Util.toUTF8(meta)
        let totallen = metablob.length + binstring.length

        if (totallen > 40000) {
            return "; program too long\n";
        }

        let str =
            `
    .balign 16
    .hex 41140E2FB82FA2BB
    .short ${metablob.length}
    .short ${binstring.length}
    .short 0, 0   ; future use

_stored_program: .string "`

        let addblob = (b: string) => {
            for (let i = 0; i < b.length; ++i) {
                let v = b.charCodeAt(i) & 0xff
                if (v <= 0xf)
                    str += "\\x0" + v.toString(16)
                else
                    str += "\\x" + v.toString(16)
            }
        }

        addblob(metablob)
        addblob(binstring)

        str += "\"\n"
        return str
    }

    export function processorEmit(bin: Binary, opts: CompileOptions, cres: CompileResult) {
        let src = serialize(bin, opts)
        src = patchSrcHash(src)
        if (opts.embedBlob)
            src += addSource(opts.embedMeta, decodeBase64(opts.embedBlob))
        bin.writeFile(pxtc.BINARY_ASM, src)
        let res = assemble(opts.target.nativeType, bin, src)
        if (res.src)
            bin.writeFile(pxtc.BINARY_ASM, res.src)
        if (res.buf) {
            if (opts.target.useUF2) {
                const myhex = btoa(hex.patchHex(bin, res.buf, false, true)[0])
                bin.writeFile(pxtc.BINARY_UF2, myhex)
            } else {
                const myhex = hex.patchHex(bin, res.buf, false, false).join("\r\n") + "\r\n"
                bin.writeFile(pxtc.BINARY_HEX, myhex)
            }
            cres.quickFlash = {
                startAddr: hex.bytecodeStartAddrPadded,
                words: []
            }
            for (let i = 0; i < res.buf.length; i += 2) {
                cres.quickFlash.words.push(res.buf[i] | (res.buf[i + 1] << 16))
            }
            while (cres.quickFlash.words.length & ((hex.flashCodeAlign(opts.target) >> 2) - 1))
                cres.quickFlash.words.push(0)
        }

        for (let bkpt of cres.breakpoints) {
            let lbl = U.lookup(res.thumbFile.getLabels(), "__brkp_" + bkpt.id)
            if (lbl != null)
                bkpt.binAddr = lbl
        }

        for (let proc of bin.procs) {
            proc.fillDebugInfo(res.thumbFile)
        }

        cres.procDebugInfo = bin.procs.map(p => p.debugInfo)
    }

    export let validateShim = hex.validateShim;
}

