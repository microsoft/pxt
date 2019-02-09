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

    // TODO should be internal
    export namespace hex {
        let funcInfo: pxt.Map<FuncInfo> = {};
        let hex: string[];
        let jmpStartAddr: number;
        let jmpStartIdx: number;
        let bytecodePaddingSize: number;
        let bytecodeStartAddr: number;
        let elfInfo: pxt.elf.Info;
        export let bytecodeStartAddrPadded: number;
        let bytecodeStartIdx: number;
        let asmLabels: pxt.Map<boolean> = {};
        export let asmTotalSource: string = "";
        export const defaultPageSize = 0x400;
        export let commBase = 0;

        // utility function
        function swapBytes(str: string) {
            let r = ""
            let i = 0
            for (; i < str.length; i += 2)
                r = str[i] + str[i + 1] + r
            assert(i == str.length)
            return r
        }

        export function hexDump(bytes: ArrayLike<number>, startOffset = 0) {
            function toHex(n: number, len = 8) {
                let r = n.toString(16)
                while (r.length < len) r = "0" + r
                return r
            }
            let r = ""
            for (let i = 0; i < bytes.length; i += 16) {
                r += toHex(startOffset + i) + ": "
                let t = ""
                for (let j = 0; j < 16; j++) {
                    if ((j & 3) == 0) r += " "
                    let v = bytes[i + j]
                    if (v == null) {
                        r += "   "
                        continue
                    }
                    r += toHex(v, 2) + " "
                    if (32 <= v && v < 127)
                        t += String.fromCharCode(v)
                    else
                        t += "."
                }
                r += " " + t + "\n"
            }
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

        function parseHexBytes(bytes: string): number[] {
            bytes = bytes.replace(/^[\s:]/, "")
            if (!bytes) return []
            let outp: number[] = []
            let bytes2 = bytes.replace(/([a-f0-9][a-f0-9])/ig, m => {
                outp.push(parseInt(m, 16))
                return ""
            })
            if (bytes2)
                throw oops("bad bytes " + bytes)
            return outp
        }

        function parseHexRecord(bytes: string) {
            let b = parseHexBytes(bytes)
            return {
                len: b[0],
                addr: (b[1] << 8) | b[2],
                type: b[3],

            }
        }


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

        export function encodeVTPtr(ptr: number, opts: CompileOptions) {
            let vv = ptr >> opts.target.vtableShift
            assert(vv < 0xffff)
            assert(vv << opts.target.vtableShift == ptr)
            return vv
        }

        export function setupFor(opts: CompileTarget, extInfo: ExtensionInfo, hexinfo: pxtc.HexInfo) {
            if (isSetupFor(extInfo))
                return;

            let funs: FuncInfo[] = extInfo.functions;

            commBase = extInfo.commBase || 0

            currentSetup = extInfo.sha;
            currentHexInfo = hexinfo;

            hex = hexinfo.hex;

            patchSegmentHex(hex)

            if (hex.length <= 2) {
                elfInfo = pxt.elf.parse(U.fromHex(hex[0]))
                bytecodeStartIdx = -1
                bytecodeStartAddr = elfInfo.imageMemStart
                bytecodeStartAddrPadded = elfInfo.imageMemStart
                bytecodePaddingSize = 0

                let jmpIdx = hex[0].indexOf("0108010842424242010801083ed8e98d")
                if (jmpIdx < 0)
                    oops("no jmp table in elf")

                jmpStartAddr = jmpIdx / 2
                jmpStartIdx = -1

                let ptrs = hex[0].slice(jmpIdx + 32, jmpIdx + 32 + funs.length * 8 + 16)
                readPointers(ptrs)
                checkFuns()
                return
            }

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
                    if (opts.flashUsableEnd && newAddr >= opts.flashUsableEnd)
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

            for (let i = jmpStartIdx + 1; i < hex.length; ++i) {
                let m = /^:..(....)00(.{4,})/.exec(hex[i]);
                if (!m) continue;

                readPointers(m[2])
                if (funs.length == 0) break
            }

            checkFuns();
            return


            function readPointers(s: string) {
                let step = opts.shortPointers ? 4 : 8
                while (s.length >= step) {
                    let hexb = s.slice(0, step)
                    let value = parseInt(swapBytes(hexb), 16)
                    s = s.slice(step)
                    let inf = funs.shift()
                    if (!inf) break;
                    funcInfo[inf.name] = inf;
                    if (!value) {
                        U.oops("No value for " + inf.name + " / " + hexb)
                    }
                    if (inf.argsFmt.length == 0) {
                        value ^= 1
                    } else {
                        if (!opts.runtimeIsARM && opts.nativeType == NATIVE_TYPE_THUMB && !(value & 1)) {
                            U.oops("Non-thumb addr for " + inf.name + " / " + hexb)
                        }
                    }
                    inf.value = value
                }
            }

            function checkFuns() {
                if (funs.length)
                    oops("premature EOF in hex file; missing: " + funs.map(f => f.name).join(", "));
            }
        }

        export function validateShim(funname: string, shimName: string, attrs: CommentAttrs,
            hasRet: boolean, argIsNumber: boolean[]) {
            if (shimName == "TD_ID" || shimName == "TD_NOOP" || shimName == "ENUM_GET")
                return
            if (U.lookup(asmLabels, shimName))
                return
            let nm = `${funname}(...) (shim=${shimName})`
            let inf = lookupFunc(shimName)
            if (inf) {
                if (!hasRet) {
                    if (inf.argsFmt[0] != "V")
                        U.userError("expecting procedure for " + nm);
                } else {
                    if (inf.argsFmt[0] == "V")
                        U.userError("expecting function for " + nm);
                }
                for (let i = 0; i < argIsNumber.length; ++i) {
                    let spec = inf.argsFmt[i + 1]
                    if (!spec)
                        U.userError("excessive parameters passed to " + nm)
                }
                if (argIsNumber.length != inf.argsFmt.length - 1)
                    U.userError(`not enough arguments for ${nm} (got ${argIsNumber.length}; fmt=${inf.argsFmt.join(",")})`)
            } else {
                U.userError("function not found: " + nm)
            }
        }

        export function lookupFunc(name: string) {
            return funcInfo[name]
        }

        export function lookupFunctionAddr(name: string) {
            if (name == "_pxt_comm_base")
                return commBase
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

        // constant strings in the binary are 4-byte aligned, and marked
        // with "@PXT@:" at the beginning - this 6 byte string needs to be
        // replaced with proper reference count (0xfffe to indicate read-only
        // flash location), string virtual table, and the length of the string
        function patchString(bytes: ArrayLike<number>) {
            let stringVT = [0xfe, 0xff, 0x01, 0x00]
            assert(stringVT.length == 4)
            // @PXT
            if (!(bytes[0] == 0x40 && bytes[1] == 0x50 && bytes[2] == 0x58 && bytes[3] == 0x54))
                oops();
            // @:
            if (bytes[5] == 0x3a) {
                let isString = false
                let isBuffer = false
                if (bytes[4] == 0x40) isString = true
                else if (bytes[4] == 0x23) isBuffer = true
                else return null

                let vt = lookupFunctionAddr(isString ? "pxt::string_inline_ascii_vt" : "pxt::buffer_vt")
                let headerBytes = new Uint8Array(6)

                if (!vt) oops("missing vt: " + isString)
                vt ^= 1
                if (vt & 3) oops("Unaligned vt: " + vt)

                if (target.gc) {
                    pxt.HF2.write32(headerBytes, 0, vt)
                } else {
                    pxt.HF2.write16(headerBytes, 0, parseInt(pxt.REFCNT_FLASH))
                    pxt.HF2.write16(headerBytes, 2, vt >> target.vtableShift)
                }

                let len = 0
                if (isString)
                    while (6 + len < bytes.length) {
                        if (bytes[6 + len] == 0)
                            break
                        len++
                    }
                if (6 + len >= bytes.length)
                    U.oops("constant string too long!")
                pxt.HF2.write16(headerBytes, 4, len)
                return headerBytes
                //console.log("patch file: @" + addr + ": " + U.toHex(patchV))
            }
            return null
        }

        function applyPatches(f: UF2.BlockFile, binfile: Uint8Array = null) {
            let patchAt = (b: Uint8Array, i: number,
                readMore: () => Uint8Array) => {
                // @PXT
                if (b[i] == 0x40 && b[i + 1] == 0x50 && b[i + 2] == 0x58 && b[i + 3] == 0x54) {
                    return patchString(readMore())
                }
                return null
            }

            if (binfile) {
                for (let i = 0; i < binfile.length - 8; i += 4) {
                    let patchV = patchAt(binfile, i, () => binfile.slice(i, i + 200))
                    if (patchV)
                        U.memcpy(binfile, i, patchV)
                }
            } else {
                for (let bidx = 0; bidx < f.blocks.length; ++bidx) {
                    let b = f.blocks[bidx]
                    let upper = f.ptrs[bidx] << 8
                    for (let i = 32; i < 32 + 256; i += 4) {
                        let addr = upper + i - 32
                        let patchV = patchAt(b, i, () => UF2.readBytesFromFile(f, addr, 200))
                        if (patchV)
                            UF2.writeBytes(f, addr, patchV)
                    }
                }
            }
        }

        function applyHexPatches(myhex: string[]) {
            const marker = "40505854" // @PXT
            for (let i = 0; i < myhex.length; ++i) {
                let idx = myhex[i].indexOf(marker)
                if (idx > 0) {
                    let off = (idx - 9) >> 1
                    let bytes = readHex(myhex, i, off, 200)
                    let patch = patchString(bytes)
                    if (patch)
                        writeHex(myhex, i, off, patch)
                }
            }
        }

        function writeHex(myhex: string[], lineNo: number, offsetInLine: number, patch: ArrayLike<number>) {
            let src = 0
            while (src < patch.length) {
                let parsedLine = parseHexBytes(myhex[lineNo])
                parsedLine.pop() // pop the checksum
                if (parsedLine[3] == 0x00) {
                    // if data
                    let pos = 4 + offsetInLine
                    let len = parsedLine.length - pos
                    for (let i = 0; i < len; ++i)
                        if (src < patch.length)
                            parsedLine[pos++] = patch[src++]
                    myhex[lineNo] = hexBytes(parsedLine)
                }
                lineNo++
                offsetInLine = 0
            }
        }

        function readHex(myhex: string[], lineNo: number, offsetInLine: number, len: number) {
            let outp: number[] = []
            while (outp.length < len) {
                let b = parseHexBytes(myhex[lineNo])
                b.pop() // pop the checksum
                if (b[3] == 0x00) {
                    // if data
                    let data = b.slice(4 + offsetInLine)
                    U.pushRange(outp, data)
                }
                lineNo++
                offsetInLine = 0
            }
            return outp
        }

        export function patchHex(bin: Binary, buf: number[], shortForm: boolean, useuf2: boolean) {
            let myhex = hex.slice(0, bytecodeStartIdx)

            let sizeEntry = (buf.length * 2 + 7) >> 3

            assert(sizeEntry < 64000, "program too large, bytes: " + buf.length * 2)

            // store the size of the program (in 64 bit words)
            buf[17] = sizeEntry
            // store commSize
            buf[20] = bin.commSize

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

            // 0x4210 is the version number matching pxt-microbit-core
            let hd = [0x4210, 0, bytecodeStartAddrPadded & 0xffff, bytecodeStartAddrPadded >>> 16]
            let tmp = hexTemplateHash()
            for (let i = 0; i < 4; ++i)
                hd.push(parseInt(swapBytes(tmp.slice(i * 4, i * 4 + 4)), 16))

            let uf2 = useuf2 ? UF2.newBlockFile(target.uf2Family) : null

            if (elfInfo) {
                let prog = new Uint8Array(buf.length * 2)
                for (let i = 0; i < buf.length; ++i) {
                    pxt.HF2.write16(prog, i * 2, buf[i])
                }
                let resbuf = pxt.elf.patch(elfInfo, prog)
                for (let i = 0; i < hd.length; ++i)
                    pxt.HF2.write16(resbuf, i * 2 + jmpStartAddr, hd[i])
                applyPatches(null, resbuf)
                if (uf2) {
                    let bn = bin.options.name || "pxt"
                    bn = bn.replace(/[^a-zA-Z0-9\-\.]+/g, "_")
                    uf2.filename = "Projects/" + bn + ".elf"
                    UF2.writeBytes(uf2, 0, resbuf);
                    return [UF2.serializeFile(uf2)];
                }
                return [U.uint8ArrayToString(resbuf)]
            }

            if (uf2) {
                UF2.writeHex(uf2, myhex)
                applyPatches(uf2)
                UF2.writeBytes(uf2, jmpStartAddr, nextLine(hd, jmpStartIdx).slice(4))
                if (bin.checksumBlock) {
                    let bytes: number[] = []
                    for (let w of bin.checksumBlock)
                        bytes.push(w & 0xff, w >> 8)
                    UF2.writeBytes(uf2, bin.target.flashChecksumAddr, bytes)
                }
            } else {
                applyHexPatches(myhex)
                myhex[jmpStartIdx] = hexBytes(nextLine(hd, jmpStartAddr))
                if (bin.checksumBlock) {
                    U.oops("checksum block in HEX not implemented yet")
                }
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

            if (bin.packedSource) {
                if (uf2) {
                    addr = (uf2.currPtr + 0x1000) & ~0xff
                    let buf = new Uint8Array(256)
                    for (let ptr = 0; ptr < bin.packedSource.length; ptr += 256) {
                        for (let i = 0; i < 256; ++i)
                            buf[i] = bin.packedSource.charCodeAt(ptr + i)
                        UF2.writeBytes(uf2, addr, buf, UF2.UF2_FLAG_NOFLASH)
                        addr += 256
                    }
                } else {
                    upper = 0x2000
                    addr = 0
                    myhex.push(hexBytes([0x02, 0x00, 0x00, 0x04, upper >> 8, upper & 0xff]))
                    for (let i = 0; i < bin.packedSource.length; i += 16) {
                        let bytes = [0x10, (addr >> 8) & 0xff, addr & 0xff, 0]
                        for (let j = 0; j < 16; ++j) {
                            bytes.push((bin.packedSource.charCodeAt(i + j) || 0) & 0xff)
                        }
                        myhex.push(hexBytes(bytes))
                        addr += 16
                    }
                }
            }

            if (uf2)
                return [UF2.serializeFile(uf2)]
            else
                return myhex;
        }
    }

    export function asmline(s: string) {
        if (s.indexOf("\n") >= 0) {
            s = s.replace(/^\s*/mg, "")
                .replace(/^(.*)$/mg, (l, x) => {
                    if ((x[0] == ";" && x[1] == " ") || /:\*$/.test(x))
                        return x
                    else
                        return "    " + x
                })
            return s + "\n"
        } else {
            if (!/(^[\s;])|(:$)/.test(s))
                s = "    " + s
            return s + "\n"
        }
    }

    function emitStrings(snippets: AssemblerSnippets, bin: Binary) {
        // ifaceMembers are already sorted alphabetically
        // here we make sure that the pointers to them are also sorted alphabetically
        // by emitting them in order and before everything else
        const keys = U.unique(bin.ifaceMembers.concat(Object.keys(bin.strings)), s => s)
        for (let s of keys) {
            bin.otherLiterals.push(snippets.string_literal(bin.strings[s], s))
        }

        for (let data of Object.keys(bin.doubles)) {
            let lbl = bin.doubles[data]
            bin.otherLiterals.push(`
.balign 4
${lbl}: ${snippets.obj_header("pxt::number_vt")}
        .hex ${data}
`)
        }

        for (let data of Object.keys(bin.hexlits)) {
            bin.otherLiterals.push(snippets.hex_literal(bin.hexlits[data], data))
            bin.otherLiterals.push()
        }
    }

    export function firstMethodOffset() {
        // 4 words header
        // 4 or 2 mem mgmt methods
        // 1 toString
        return 4 + (target.gc ? 4 : 2) + 1
    }

    const primes = [
        21078089, 22513679, 15655169, 18636881, 19658081, 21486649, 21919277, 20041213, 20548751,
        16180187, 18361627, 19338023, 19772677, 16506547, 23530697, 22998697, 21225203, 19815283,
        23679599, 19822889, 21136133, 19540043, 21837031, 18095489, 23924267, 23434627, 22582379,
        21584111, 22615171, 23403001, 19640683, 19998031, 18460439, 20105387, 17595791, 16482043,
        23199959, 18881641, 21578371, 22765747, 20170273, 16547639, 16434589, 21435019, 20226751,
        19506731, 21454393, 23224541, 23431973, 23745511,
    ]

    export const vtLookups = 3
    function computeHashMultiplier(nums: number[]) {
        let shift = 32
        U.assert(U.unique(nums, v => "" + v).length == nums.length, "non unique")
        for (let sz = 2; ; sz = sz << 1) {
            shift--
            if (sz < nums.length) continue
            let minColl = -1
            let minMult = -1
            let minArr: Uint16Array
            for (let mult0 of primes) {
                let mult = (mult0 << 8) | shift
                let arr = new Uint16Array(sz + vtLookups + 1)
                U.assert((arr.length & 1) == 0)
                let numColl = 0
                let vals = []
                for (let n of nums) {
                    U.assert(n > 0)
                    let k = Math.imul(n, mult) >>> shift
                    vals.push(k)
                    let found = false
                    for (let l = 0; l < vtLookups; l++) {
                        if (!arr[k + l]) {
                            found = true
                            arr[k + l] = n
                            break
                        }
                        numColl++
                    }
                    if (!found) {
                        numColl = -1
                        break
                    }
                }

                if (minColl == -1 || minColl > numColl) {
                    minColl = numColl
                    minMult = mult
                    minArr = arr
                }
            }

            if (minColl >= 0) {
                return {
                    mult: minMult,
                    mapping: minArr,
                    size: sz
                }
            }
        }
    }


    export function vtableToAsm(info: ClassInfo, opts: CompileOptions, bin: Binary) {
        /*
        uint16_t numbytes;
        ValType objectType;
        uint8_t magic;
        PVoid *ifaceTable;
        BuiltInType classNo;
        uint16_t reserved;
        uint32_t ifaceHashMult;
        PVoid methods[2 or 4];
        */

        const ifaceInfo = computeHashMultiplier(info.itable.map(e => e.idx))
        //if (info.itable.length == 0)
        //    ifaceInfo.mult = 0

        let ptrSz = target.shortPointers ? ".short" : ".word"
        let s = `
        .balign ${1 << opts.target.vtableShift}
${info.id}_VT:
        .short ${info.allfields.length * 4 + 4}  ; size in bytes
        .byte ${pxt.ValTypeObject}, ${pxt.VTABLE_MAGIC} ; magic
        ${ptrSz} ${info.id}_IfaceVT
        .short ${info.classNo} ; class-id
        .short 0 ; reserved
        .word ${ifaceInfo.mult} ; hash-mult
`;

        let addPtr = (n: string) => {
            if (n != "0") n += "@fn"
            s += `        ${ptrSz} ${n}\n`
        }

        addPtr("pxt::RefRecord_destroy")
        addPtr("pxt::RefRecord_print")
        if (target.gc) {
            addPtr("pxt::RefRecord_scan")
            addPtr("pxt::RefRecord_gcsize")
        }
        let toStr = info.toStringMethod
        addPtr(toStr ? toStr.vtLabel() : "0")

        for (let m of info.vtable) {
            addPtr(m.label() + "_nochk")
        }

        // See https://makecode.microbit.org/15593-01779-41046-40599 for Thumb binary search.
        s += `
        .balign ${target.shortPointers ? 2 : 4}
${info.id}_IfaceVT:
`

        const descSize = 8
        const zeroOffset = ifaceInfo.mapping.length * 2

        let descs = ""
        let offset = zeroOffset
        let offsets: pxt.Map<number> = {}
        for (let e of info.itable) {
            offsets[e.idx + ""] = offset
            descs += `  .short ${e.idx}, ${e.info} ; ${e.name}\n`
            descs += `  .word ${e.proc ? e.proc.vtLabel() + "@fn" : e.info}\n`
            offset += descSize
            if (e.setProc) {
                descs += `  .short ${e.idx}, 0 ; set ${e.name}\n`
                descs += `  .word ${e.setProc.vtLabel()}@fn\n`
                offset += descSize
            }
        }

        descs += "  .word 0, 0 ; the end\n"
        offset += descSize

        let map = ifaceInfo.mapping

        for (let i = 0; i < map.length; ++i) {
            bin.itEntries++
            if (map[i])
                bin.itFullEntries++
        }

        // offsets are relative to the position in the array
        s += "  .short " + U.toArray(map).map((e, i) => (offsets[e + ""] || zeroOffset) - (i * 2)).join(", ") + "\n"
        s += descs

        s += "\n"
        return s
    }

    const systemPerfCounters = [
        "GC"
    ]


    function serialize(bin: Binary, opts: CompileOptions) {
        let asmsource = `; start
${hex.hexPrelude()}
    .hex 708E3B92C615A841C49866C975EE5197 ; magic number
    .hex ${hex.hexTemplateHash()} ; hex template hash
    .hex 0000000000000000 ; @SRCHASH@
    .short ${bin.globalsWords}   ; num. globals
    .short 0 ; patched with number of 64 bit words resulting from assembly
    .word _pxt_config_data
    .short 0 ; patched with comm section size
    .short ${bin.nonPtrGlobals} ; number of globals that are not pointers (they come first)
    .word _pxt_iface_member_names
    .word _pxt_lambda_trampoline@fn
    .word _pxt_perf_counters
    .word 0 ; reserved
    .word 0 ; reserved
`
        let snippets: AssemblerSnippets = null;
        snippets = new ThumbSnippets()

        const perfCounters = bin.setPerfCounters(systemPerfCounters)

        bin.procs.forEach(p => {
            let p2a = new ProctoAssembler(snippets, bin, p)
            asmsource += "\n" + p2a.getAssembly() + "\n"
        })

        let helpers = new ProctoAssembler(snippets, bin, null)
        helpers.emitHelpers()
        asmsource += "\n" + helpers.getAssembly() + "\n"

        asmsource += hex.asmTotalSource // user-supplied asm

        asmsource += "_code_end:\n\n"

        U.iterMap(bin.codeHelpers, (code, lbl) => {
            asmsource += `    .section code\n${lbl}:\n${code}\n`
        })
        asmsource += snippets.arithmetic()
        asmsource += "_helpers_end:\n\n"

        bin.usedClassInfos.forEach(info => {
            asmsource += vtableToAsm(info, opts, bin)
        })

        asmsource += `\n.balign 4\n_pxt_iface_member_names:\n`
        asmsource += `    .word ${bin.ifaceMembers.length}\n`
        let idx = 0
        for (let d of bin.ifaceMembers) {
            let lbl = bin.emitString(d)
            asmsource += `    .word ${lbl}meta  ; ${idx++} .${d}\n`
        }
        asmsource += `    .word 0\n`
        asmsource += "_vtables_end:\n\n"

        asmsource += `\n.balign 4\n_pxt_config_data:\n`
        const cfg = bin.res.configData || []
        // asmsource += `    .word ${cfg.length}, 0 ; num. entries`
        for (let d of cfg) {
            asmsource += `    .word ${d.key}, ${d.value}  ; ${d.name}=${d.value}\n`
        }
        asmsource += `    .word 0\n\n`

        emitStrings(snippets, bin)
        asmsource += bin.otherLiterals.join("")

        asmsource += `\n.balign 4\n.section code\n_pxt_perf_counters:\n`
        asmsource += `    .word ${perfCounters.length}\n`
        let strs = ""
        for (let i = 0; i < perfCounters.length; ++i) {
            let lbl = ".perf" + i
            asmsource += `    .word ${lbl}\n`
            strs += `${lbl}: .string ${JSON.stringify(perfCounters[i])}\n`
        }
        asmsource += strs

        asmsource += "_literals_end:\n"

        return asmsource
    }

    function patchSrcHash(bin: Binary, src: string) {
        let sha = U.sha256(src)
        bin.sourceHash = sha
        return src.replace(/\n.*@SRCHASH@\n/, "\n    .hex " + sha.slice(0, 16).toUpperCase() + " ; program hash\n")
    }

    export function processorInlineAssemble(target: CompileTarget, src: string) {
        let b = mkProcessorFile(target)
        b.disablePeepHole = true
        b.emit(src)
        throwAssemblerErrors(b)

        let res: number[] = []
        for (let i = 0; i < b.buf.length; i += 2) {
            res.push((((b.buf[i + 1] || 0) << 16) | b.buf[i]) >>> 0)
        }
        return res
    }

    function mkProcessorFile(target: CompileTarget) {
        let b: assembler.File

        b = new assembler.File(new thumb.ThumbProcessor())

        b.ei.testAssembler(); // just in case

        if (target.switches.noPeepHole)
            b.disablePeepHole = true

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
    export function assemble(target: CompileTarget, bin: Binary, src: string) {
        let b = mkProcessorFile(target)
        b.emit(src);

        src = `; Interface tables: ${bin.itFullEntries}/${bin.itEntries} (${Math.round(100 * bin.itFullEntries / bin.itEntries)}%)\n` +
            `; Virtual methods: ${bin.numVirtMethods} / ${bin.numMethods}\n` +
            b.getSource(!peepDbg, bin.numStmts, target.flashEnd);

        throwAssemblerErrors(b)

        return {
            src: src,
            buf: b.buf,
            thumbFile: b
        }
    }

    function addSource(blob: string) {
        let res = ""

        for (let i = 0; i < blob.length; ++i) {
            let v = blob.charCodeAt(i) & 0xff
            if (v <= 0xf)
                res += "0" + v.toString(16)
            else
                res += v.toString(16)
        }

        return `
    .balign 16
_stored_program: .hex ${res}
`
    }

    function packSource(meta: string, binstring: string) {
        let metablob = Util.toUTF8(meta)
        let totallen = metablob.length + binstring.length

        let res = "\x41\x14\x0E\x2F\xB8\x2F\xA2\xBB"

        res += U.uint8ArrayToString([
            metablob.length & 0xff, metablob.length >> 8,
            binstring.length & 0xff, binstring.length >> 8,
            0, 0, 0, 0
        ])

        res += metablob
        res += binstring

        if (res.length % 2)
            res += "\x00"

        return res
    }

    export function processorEmit(bin: Binary, opts: CompileOptions, cres: CompileResult) {
        let src = serialize(bin, opts)
        src = patchSrcHash(bin, src)
        let sourceAtTheEnd = false
        if (opts.embedBlob) {
            bin.packedSource = packSource(opts.embedMeta, ts.pxtc.decodeBase64(opts.embedBlob))
            // TODO more dynamic check for source size
            if (!bin.target.noSourceInFlash && bin.packedSource.length < 40000) {
                src += addSource(bin.packedSource)
                bin.packedSource = null // no need to append anymore
            }
        }
        let checksumWords = 8
        let pageSize = hex.flashCodeAlign(opts.target)
        if (opts.target.flashChecksumAddr) {
            let k = 0
            while (pageSize > (1 << k)) k++;
            let endMarker = parseInt(bin.sourceHash.slice(0, 8), 16)
            let progStart = hex.bytecodeStartAddrPadded / pageSize
            endMarker = (endMarker & 0xffffff00) | k
            let templBeg = 0
            let templSize = progStart
            // we exclude the checksum block from the template
            if (opts.target.flashChecksumAddr < hex.bytecodeStartAddrPadded) {
                templBeg = Math.ceil((opts.target.flashChecksumAddr + 32) / pageSize)
                templSize -= templBeg
            }
            src += `
    .balign 4
__end_marker:
    .word ${endMarker}

; ------- this will get removed from the final binary ------
__flash_checksums:
    .word 0x87eeb07c ; magic
    .word __end_marker ; end marker position
    .word ${endMarker} ; end marker
    ; template region
    .short ${templBeg}, ${templSize}
    .word 0x${hex.hexTemplateHash().slice(0, 8)}
    ; user region
    .short ${progStart}, 0xffff
    .word 0x${bin.sourceHash.slice(0, 8)}
    .word 0x0 ; terminator
`
        }
        bin.writeFile(pxtc.BINARY_ASM, src)
        let res = assemble(opts.target, bin, src)
        if (res.thumbFile.commPtr)
            bin.commSize = res.thumbFile.commPtr - hex.commBase
        if (res.src)
            bin.writeFile(pxtc.BINARY_ASM, res.src)

        const cfg = cres.configData || []

        // When BOOTLOADER_BOARD_ID is present in project, it means it's meant as configuration
        // for bootloader. Spit out config.c file in that case, so it can be included in bootloader.
        if (cfg.some(e => e.name == "BOOTLOADER_BOARD_ID")) {
            let c = `const uint32_t configData[] = {\n`
            c += `    0x1e9e10f1, 0x20227a79, // magic\n`
            c += `    ${cfg.length}, 0, // num. entries; reserved\n`
            for (let e of cfg) {
                c += `    ${e.key}, 0x${e.value.toString(16)}, // ${e.name}\n`
            }
            c += "    0, 0\n};\n"
            bin.writeFile("config.c", c)
        }

        if (res.buf) {
            if (opts.target.flashChecksumAddr) {
                let pos = res.thumbFile.lookupLabel("__flash_checksums") / 2
                U.assert(pos == res.buf.length - checksumWords * 2)
                let chk = res.buf.slice(res.buf.length - checksumWords * 2)
                res.buf.splice(res.buf.length - checksumWords * 2, checksumWords * 2)
                let len = Math.ceil(res.buf.length * 2 / pageSize)
                chk[chk.length - 5] = len
                bin.checksumBlock = chk;
            }
            if (!pxt.isOutputText(target)) {
                const myhex = ts.pxtc.encodeBase64(hex.patchHex(bin, res.buf, false, !!target.useUF2)[0])
                bin.writeFile(pxt.outputName(target), myhex)
            } else {
                const myhex = hex.patchHex(bin, res.buf, false, false).join("\r\n") + "\r\n"
                bin.writeFile(pxt.outputName(target), myhex)
            }
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

    export function f4EncodeImg(w: number, h: number, bpp: number, getPix: (x: number, y: number) => number) {
        let r = hex2(0xe0 | bpp) + hex2(w) + hex2(h) + "00"
        let ptr = 4
        let curr = 0
        let shift = 0

        let pushBits = (n: number) => {
            curr |= n << shift
            if (shift == 8 - bpp) {
                r += hex2(curr)
                ptr++
                curr = 0
                shift = 0
            } else {
                shift += bpp
            }
        }

        for (let i = 0; i < w; ++i) {
            for (let j = 0; j < h; ++j)
                pushBits(getPix(i, j))
            while (shift != 0)
                pushBits(0)
            if (bpp > 1) {
                while (ptr & 3)
                    pushBits(0)
            }
        }

        return r

        function hex2(n: number) {
            return ("0" + n.toString(16)).slice(-2)
        }

    }
}
