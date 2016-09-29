import * as fs from 'fs';
import * as path from 'path';
import * as nodeutil from './nodeutil';

import U = pxt.Util;
import Map = pxt.Map;

export interface TargetConfig {
    id: string;
    flashOrigin: number;
    flashSize: number;
    ramOrigin: number;
    ramSize: number;
}

let targets: TargetConfig[] = [
    {
        id: "microbit (nrf51-16k)",
        flashOrigin: 0x00018000,
        flashSize: 0x28000,
        ramOrigin: 0x20002000,
        ramSize: 0x2000,
    }
]

export interface FileInfo {
    filename: string;
    syms: Sym[];
    init: string[];
    fromArchive?: boolean;
}

export interface AssemblyInfo {
    infos: FileInfo[];
    target: TargetConfig;
    hexEntries: HexEntry[];
    depInfo: string;
}

export const enum SymType {
    Code,
    RoData,
    BSS,
    RwData,
    Vectors,   // comes at the beginning of the file
    Const,
}

export interface Sym {
    name: string;
    type: SymType;
    align: number;
    size?: number; // mostly relevant for bss
    text: string; // hex encoded
    _textAlias?: string; // name of the symbol where text resides
    offset?: number;
    bind: STB;
    _relocs?: Reloc[];
    _id?: number;
    _fileId?: number;
    _isUsed?: boolean;
    relocEnc?: number[];
    _imported?: boolean;
    symAlias?: number;
    position?: number;
}

export interface Reloc {
    type: RelocType;
    symname: string;
    offset: number;
    addend: number;
    isWeak: boolean;
}

interface Section {
    rawname: number;
    name: string;
    type: SHT;
    flags: SHF;
    addr: number;
    offset: number;
    size: number;
    link: number;
    info: number;
    addralign: number;
    entsize: number;
    reloc?: RawRel[];
    symName?: string;
};

interface RawSym {
    rawname: number;
    name: string;
    value: number;
    size: number;
    info: STT;
    other: number;
    bind: STB;
    shndx: number;
    isUsed?: boolean;
}

interface RawRel {
    offset: number;
    addend: number;
    type: number;
    sym: RawSym;
}

const sectFields = [
    "rawname",
    "type",
    "flags",
    "addr",
    "offset",
    "size",
    "link",
    "info",
    "addralign",
    "entsize",
];

const enum SHT {
    NULL = 0,
    PROGBITS = 1,
    SYMTAB = 2,
    STRTAB = 3,
    RELA = 4,
    HASH = 5,
    DYNAMIC = 6,
    NOTE = 7,
    NOBITS = 8,
    REL = 9,
    SHLIB = 10,
    DYNSYM = 11,
    INIT_ARRAY = 14,
    FINI_ARRAY = 15,
    PREINIT_ARRAY = 16,
    GROUP = 17,
    SYMTAB_SHNDX = 18,
}

const enum SHF {
    WRITE = 0x1,
    ALLOC = 0x2,
    EXECINSTR = 0x4
}

const enum STT {
    NOTYPE = 0,
    OBJECT = 1,
    FUNC = 2,
    SECTION = 3,
    FILE = 4,
    COMMON = 5,
    TLS = 6,
}

export const enum STB {
    LOCAL = 0,
    GLOBAL = 1,
    WEAK = 2,
    EXPORTED = GLOBAL | WEAK
}

const enum SHN {
    ABS = 0xfff1,
    COMMON = 0xfff2
}

export const enum RelocType {
    R_ARM_NONE = 0,
    R_ARM_PC24 = 1,
    R_ARM_ABS32 = 2,
    R_ARM_REL32 = 3,
    R_ARM_LDR_PC_G0 = 4,
    R_ARM_ABS16 = 5,
    R_ARM_ABS12 = 6,
    R_ARM_THM_ABS5 = 7,
    R_ARM_ABS8 = 8,
    R_ARM_SBREL32 = 9,
    R_ARM_THM_CALL = 10,
    R_ARM_THM_PC8 = 11,
    R_ARM_BREL_ADJ = 12,
    R_ARM_SWI24 = 13,
    R_ARM_THM_SWI8 = 14,
    R_ARM_XPC25 = 15,
    R_ARM_THM_XPC22 = 16,
    R_ARM_TLS_DTPMOD32 = 17,
    R_ARM_TLS_DTPOFF32 = 18,
    R_ARM_TLS_TPOFF32 = 19,
    R_ARM_COPY = 20,
    R_ARM_GLOB_DAT = 21,
    R_ARM_JUMP_SLOT = 22,
    R_ARM_RELATIVE = 23,
    R_ARM_GOTOFF32 = 24,
    R_ARM_BASE_PREL = 25,
    R_ARM_GOT_BREL = 26,
    R_ARM_PLT32 = 27,
    R_ARM_CALL = 28,
    R_ARM_JUMP24 = 29,
    R_ARM_THM_JUMP24 = 30,
    R_ARM_BASE_ABS = 31,
    R_ARM_ALU_PCREL_7_0 = 32,
    R_ARM_ALU_PCREL_15_8 = 33,
    R_ARM_ALU_PCREL_23_15 = 34,
    R_ARM_LDR_SBREL_11_0_NC = 35,
    R_ARM_ALU_SBREL_19_12_NC = 36,
    R_ARM_ALU_SBREL_27_20_CK = 37,
    R_ARM_TARGET1 = 38,
    R_ARM_SBREL31 = 39,
    R_ARM_V4BX = 40,
    R_ARM_TARGET2 = 41,
    R_ARM_PREL31 = 42,
    R_ARM_MOVW_ABS_NC = 43,
    R_ARM_MOVT_ABS = 44,
    R_ARM_MOVW_PREL_NC = 45,
    R_ARM_MOVT_PREL = 46,
    R_ARM_THM_MOVW_ABS_NC = 47,
    R_ARM_THM_MOVT_ABS = 48,
    R_ARM_THM_MOVW_PREL_NC = 49,
    R_ARM_THM_MOVT_PREL = 50,
    R_ARM_THM_JUMP19 = 51,
    R_ARM_THM_JUMP6 = 52,
    R_ARM_THM_ALU_PREL_11_0 = 53,
    R_ARM_THM_PC12 = 54,
    R_ARM_ABS32_NOI = 55,
    R_ARM_REL32_NOI = 56,
    R_ARM_ALU_PC_G0_NC = 57,
    R_ARM_ALU_PC_G0 = 58,
    R_ARM_ALU_PC_G1_NC = 59,
    R_ARM_ALU_PC_G1 = 60,
    R_ARM_ALU_PC_G2 = 61,
    R_ARM_LDR_PC_G1 = 62,
    R_ARM_LDR_PC_G2 = 63,
    R_ARM_LDRS_PC_G0 = 64,
    R_ARM_LDRS_PC_G1 = 65,
    R_ARM_LDRS_PC_G2 = 66,
    R_ARM_LDC_PC_G0 = 67,
    R_ARM_LDC_PC_G1 = 68,
    R_ARM_LDC_PC_G2 = 69,
    R_ARM_ALU_SB_G0_NC = 70,
    R_ARM_ALU_SB_G0 = 71,
    R_ARM_ALU_SB_G1_NC = 72,
    R_ARM_ALU_SB_G1 = 73,
    R_ARM_ALU_SB_G2 = 74,
    R_ARM_LDR_SB_G0 = 75,
    R_ARM_LDR_SB_G1 = 76,
    R_ARM_LDR_SB_G2 = 77,
    R_ARM_LDRS_SB_G0 = 78,
    R_ARM_LDRS_SB_G1 = 79,
    R_ARM_LDRS_SB_G2 = 80,
    R_ARM_LDC_SB_G0 = 81,
    R_ARM_LDC_SB_G1 = 82,
    R_ARM_LDC_SB_G2 = 83,
    R_ARM_MOVW_BREL_NC = 84,
    R_ARM_MOVT_BREL = 85,
    R_ARM_MOVW_BREL = 86,
    R_ARM_THM_MOVW_BREL_NC = 87,
    R_ARM_THM_MOVT_BREL = 88,
    R_ARM_THM_MOVW_BREL = 89,
    R_ARM_PLT32_ABS = 94,
    R_ARM_GOT_ABS = 95,
    R_ARM_GOT_PREL = 96,
    R_ARM_GOT_BREL12 = 97,
    R_ARM_GOTOFF12 = 98,
    R_ARM_GOTRELAX = 99,
    R_ARM_GNU_VTENTRY = 100,
    R_ARM_GNU_VTINHERIT = 101,
    R_ARM_THM_JUMP11 = 102,
    R_ARM_THM_JUMP8 = 103,
    R_ARM_TLS_GD32 = 104,
    R_ARM_TLS_LDM32 = 105,
    R_ARM_TLS_LDO32 = 106,
    R_ARM_TLS_IE32 = 107,
    R_ARM_TLS_LE32 = 108,
    R_ARM_TLS_LDO12 = 109,
    R_ARM_TLS_LE12 = 110,
    R_ARM_TLS_IE12GP = 111,
    R_ARM_PRIVATE_0 = 112,
    R_ARM_PRIVATE_1 = 113,
    R_ARM_PRIVATE_2 = 114,
    R_ARM_PRIVATE_3 = 115,
    R_ARM_PRIVATE_4 = 116,
    R_ARM_PRIVATE_5 = 117,
    R_ARM_PRIVATE_6 = 118,
    R_ARM_PRIVATE_7 = 119,
    R_ARM_PRIVATE_8 = 120,
    R_ARM_PRIVATE_9 = 121,
    R_ARM_PRIVATE_10 = 122,
    R_ARM_PRIVATE_11 = 123,
    R_ARM_PRIVATE_12 = 124,
    R_ARM_PRIVATE_13 = 125,
    R_ARM_PRIVATE_14 = 126,
    R_ARM_PRIVATE_15 = 127,
    R_ARM_ME_TOO = 128,
    R_ARM_THM_TLS_DESCSEQ16 = 129,
    R_ARM_THM_TLS_DESCSEQ32 = 130,
    R_ARM_THM_GOT_BREL12 = 131,
    R_ARM_IRELATIVE = 140,
}

let currNameId = 0


export function elfToJson(filename: string, buf: Buffer): FileInfo {
    if (buf.readUInt32LE(0) != 0x464c457f)
        U.userError("no magic")
    if (buf[4] != 1)
        U.userError("not 32 bit")
    if (buf[5] != 1)
        U.userError("not little endian")
    if (buf[6] != 1)
        U.userError("bad version")
    if (buf.readUInt16LE(0x10) != 1)
        U.userError("wrong object type")
    if (buf.readUInt16LE(0x12) != 0x28)
        U.userError("not ARM")
    let phoff = buf.readUInt32LE(0x1c)
    let shoff = buf.readUInt32LE(0x20)
    if (phoff != 0)
        U.userError("not expecting program headers")
    if (shoff == 0)
        U.userError("expecting section headers")
    let shentsize = buf.readUInt16LE(0x2e)
    let shnum = buf.readUInt16LE(0x30)
    let shstrndx = buf.readUInt16LE(0x32)

    //console.log(`${shnum} entries of ${shentsize} at ${shoff}`)

    let sects = U.range(shnum).map(no =>
        readSH(shoff + no * shentsize))

    let strtab: Section
    let symtab: Section
    let sectsByName: Map<Section> = {}

    for (let s of sects) {
        s.name = readString(sects[shstrndx], s.rawname)
        sectsByName[s.name] = s
        //console.log(`${s.name} ${s.size} bytes ${s.type}`)
        if (s.name == ".symtab") {
            if (symtab) U.userError("more than one .symtab")
            symtab = s
        }
        if (s.name == ".strtab") {
            if (strtab) U.userError("more than one .strtab")
            strtab = s
        }
    }

    let syms: RawSym[] = []
    readSymbols()

    for (let s of sects) {
        if ((s.type == SHT.PROGBITS || s.type == SHT.NOBITS || s.type == SHT.INIT_ARRAY)
            && !/^\.debug/.test(s.name)) {
            s.reloc = readRel(sectsByName[".rel" + s.name]).concat(readRel(sectsByName[".rela" + s.name]))
        }
    }

    for (let s of syms) {
        if (!s.isUsed) continue
        if (!s.name) {
            s.name = ""
            if (s.shndx && s.shndx != SHN.COMMON) {
                let sect = sects[s.shndx]
                if (sect) s.name = sect.name
            }
            s.name += "." + currNameId++
        }
        else if ((s.bind & STB.EXPORTED) == 0)
            s.name += "." + currNameId++
    }

    let rsyms: Sym[] = []
    let sidx = -1

    for (let s of syms) {
        sidx++
        if (!s.shndx) continue
        if ((s.bind & STB.EXPORTED && s.name) || s.isUsed) {
            let ss: Sym
            if (s.shndx == SHN.COMMON) {
                ss = {
                    name: s.name,
                    type: SymType.BSS,
                    align: s.value || 4,
                    size: s.size,
                    text: "",
                    bind: STB.GLOBAL,
                    _relocs: []
                }
            } else {
                let sect = sects[s.shndx]
                if (!sect) {
                    U.userError(`sym=${s.name} using undefined section ${s.shndx}`)
                }
                ss = {
                    name: s.name,
                    type: SymType.Code,
                    align: sect.addralign || 1,
                    text: "",
                    bind: s.bind,
                    _relocs: convertRelocs(sect)
                }
                if (U.startsWith(sect.name, ".bss"))
                    ss.type = SymType.BSS
                else if (U.startsWith(sect.name, ".rodata"))
                    ss.type = SymType.RoData
                else if (U.startsWith(sect.name, ".data") || U.startsWith(sect.name, "fs_data"))
                    ss.type = SymType.RwData
                else if (U.startsWith(sect.name, ".text"))
                    ss.type = SymType.Code
                else if (sect.name == ".Vectors")
                    ss.type = SymType.Vectors
                else {
                    ss.type = SymType.RwData
                    console.log(`unknown section name type: ${sect.name} for sym ${s.name} @ ${sidx}`)
                    continue
                }

                if (ss.type == SymType.BSS) {
                    ss.size = sect.size
                } else {
                    if (s.value) ss.offset = s.value
                    ss.text = buf.slice(sect.offset, sect.offset + sect.size).toString("hex")
                    if (!sect.symName) {
                        sect.symName = ss.name
                    }
                    ss._textAlias = sect.symName
                }
            }
            rsyms.push(ss)
        }
    }

    let inits = convertRelocs(sectsByName[".init_array"])

    let r: FileInfo = {
        filename: filename,
        syms: rsyms,
        init: inits.map(s => s.symname)
    }

    return r

    function convertRelocs(s: Section): Reloc[] {
        if (!s) return []
        let rx = s.reloc
        if (!rx) return []
        return rx.map(r => ({
            type: r.type,
            symname: r.sym.name,
            offset: r.offset,
            addend: r.addend,
            isWeak: !!(r.sym.bind & STB.WEAK) && !r.sym.shndx
        }))
    }

    function readString(s: Section, off: number) {
        off += s.offset
        let end = off
        while (buf[end])
            end++;
        return buf.slice(off, end).toString("binary")
    }

    function readSH(off: number) {
        let r: Map<number> = {}
        for (let f of sectFields) {
            r[f] = buf.readUInt32LE(off)
            off += 4
        }
        let rr = r as any as Section
        return rr
    }

    function readSymbols() {
        let off = symtab.offset
        let end = off + symtab.size
        if (symtab.entsize != 16) U.userError("wrong entry size in symtab")
        while (off < end) {
            let e: RawSym = {
                rawname: buf.readUInt32LE(off),
                name: "",
                value: buf.readUInt32LE(off + 4),
                size: buf.readUInt32LE(off + 8),
                info: buf[off + 12],
                other: buf[off + 13],
                shndx: buf.readUInt16LE(off + 14),
                bind: 0
            }
            e.bind = e.info >> 4
            e.info = e.info & 0xf
            if (e.rawname)
                e.name = readString(strtab, e.rawname)
            syms.push(e)
            off += symtab.entsize
        }
    }

    function readRel(s: Section) {
        let res: RawRel[] = []
        if (!s) return res
        let off = s.offset
        let end = off + s.size
        let entsize = s.type == SHT.REL ? 8 : s.type == SHT.RELA ? 12 : null;
        if (entsize == null) U.userError("wrong rel type")
        if (s.entsize != 8) U.userError("wrong entry size in " + s.name)
        while (off < end) {
            let info = buf.readUInt32LE(off + 4)
            let r: RawRel = {
                offset: buf.readUInt32LE(off),
                type: info & 0xff,
                sym: syms[info >>> 8],
                addend: 0
            }
            if (r.sym.info == STT.SECTION) {
                let cand = syms.filter(s => s.shndx == r.sym.shndx && s.info == STT.OBJECT)
                if (cand.length == 0) {
                    if (r.sym.bind & STB.EXPORTED)
                        U.userError(`no OBJECT found for SECTION; sym=${info >>> 8} sect=${r.sym.shndx} in ${filename} (${s.name})`)
                } else {
                    r.sym = cand[0]
                }
            }
            r.sym.isUsed = true
            if (s.type == SHT.RELA)
                r.addend = buf.readInt32LE(off + 8)
            res.push(r)
            off += s.entsize
        }
        return res
    }
}

export interface ArArchive {
    name: string;
    symbols: Map<number>;
    buf: Buffer;
    entries: ArEntry[];
    filenamesOffset: number;
}

export interface ArEntry {
    filename: string;
    size: number;
    offset: number;
    buf?: Buffer;
}

export function getArEntry(ar: ArArchive, pos: number) {
    let ent = parseArEntry(ar, pos)
    ent.buf = ar.buf.slice(pos + 60, pos + 60 + ent.size)
    return ent
}

function parseArEntry(ar: ArArchive, pos: number): ArEntry {
    let buf = ar.buf
    let fn = buf.slice(pos, pos + 16).toString("binary").replace(/ *$/, "")
    let sz = parseInt(buf.slice(pos + 48, pos + 58).toString("binary"))
    if (buf[pos + 58] != 0x60 || buf[pos + 59] != 0x0A)
        U.userError("invalid AR")
    let m = /^\/(\d+)/.exec(fn)
    if (m && ar.filenamesOffset > 0) {
        let oo = parseInt(m[1]) + ar.filenamesOffset
        let e = oo
        while (e < oo + 200 && buf[e] != 0x0A)
            e++
        fn = buf.slice(oo, e).toString("binary")
    }
    return {
        filename: fn,
        size: sz,
        offset: pos
    }
}

export interface HexEntry {
    address: number;
    hex: string;
}

export function readHexFile(buf: Buffer): HexEntry[] {
    let res: HexEntry[] = []
    let currAddr = -1
    let upperAddr = 0
    let ptr = 0

    while (ptr < buf.length) {
        while (buf[ptr] == 10 || buf[ptr] == 13)
            ptr++
        let beg = ptr
        while (ptr < buf.length && buf[ptr] != 10 && buf[ptr] != 13)
            ptr++
        if (buf[beg] != 58)
            U.userError("bad hex record, beg=" + beg)
        let lineBuf = new Buffer(buf.slice(beg + 1, ptr).toString("binary"), "hex")
        if (lineBuf.length != lineBuf[0] + 5)
            U.userError("bad hex record len")
        let sum = 0
        for (let i = 0; i < lineBuf.length; ++i)
            sum = (sum + lineBuf[i]) & 0xff
        if (sum != 0)
            U.userError("bad hex record checksum")
        let currRes = res[res.length - 1]
        switch (lineBuf[3]) {
            case 0:
                let addr = lineBuf.readUInt16BE(1)
                if (currAddr != (upperAddr | addr)) {
                    currAddr = upperAddr | addr
                    currRes = {
                        hex: "",
                        address: currAddr
                    }
                    res.push(currRes)
                }
                currRes.hex += lineBuf.slice(4, lineBuf.length - 1).toString("hex")
                currAddr += lineBuf[0]
                break
            case 4:
                upperAddr = lineBuf.readUInt16BE(4) << 16
                break
            case 1:
                return res
        }
    }
    throw U.userError("unexpected end of hex file")
}

export function readArFile(arname: string, buf: Buffer, onlySyms = false) {
    let magic = "!<arch>\n"
    if (buf.slice(0, magic.length).toString("binary") != magic)
        U.userError("bad AR header")
    let pos = magic.length
    let hd: ArArchive = {
        symbols: {},
        buf,
        entries: [],
        name: arname,
        filenamesOffset: -1
    }
    let gotSyms = false
    while (pos < buf.length - 2) {
        let ent = parseArEntry(hd, pos)
        hd.entries.push(ent)
        if (ent.filename == "//") {
            hd.filenamesOffset = pos + 60
            if (onlySyms && gotSyms) break
        }
        if (ent.filename == "/") {
            let numsym = buf.readUInt32BE(pos + 60)
            let ptr = numsym * 4 + pos + 60 + 4
            let endptr = pos + 60 + ent.size
            let currsym = 0
            let beg = ptr
            while (ptr < endptr) {
                if (buf[ptr] == 0) {
                    let symname = buf.slice(beg, ptr).toString("binary")
                    let off = buf.readUInt32BE(pos + 60 + 4 + 4 * currsym)
                    hd.symbols[symname] = off
                    currsym++
                    if (currsym >= numsym) break
                    ptr++
                    beg = ptr
                } else ptr++
            }
            gotSyms = true
            if (onlySyms && hd.filenamesOffset >= 0) break
        }
        let off = 60 + ent.size
        if (ent.size & 1) off++
        pos += off
    }
    return hd
}

export function linkInfos(inputInfos: FileInfo[], libs: ArArchive[]): AssemblyInfo {
    let symLookup: Map<Sym[]> = {}
    let inits: string[][] = []
    let libOFiles: Map<FileInfo> = {}
    let builtInFI: FileInfo = {
        filename: "_builtin_",
        syms: [],
        init: [],
    }
    let res: AssemblyInfo = {
        infos: [],
        target: targets[0],
        hexEntries: [],
        depInfo: ""
    }
    let depIndent = ""
    let usedSyms: Sym[] = []

    function defineSyms(fi: FileInfo) {
        for (let s of fi.syms) {
            let ex = U.lookup(symLookup, s.name)
            if (ex) {
                if (s.bind & STB.WEAK)
                    ex.push(s)
                else
                    ex.unshift(s)
            } else {
                symLookup[s.name] = [s]
            }
        }
    }

    function defineSymsRec(fi: FileInfo) {
        let fid = res.infos.length
        res.infos.push(fi)
        res.depInfo += depIndent + "> " + fi.filename + "\n"
        depIndent += "    "
        for (let s of fi.syms) {
            res.depInfo += depIndent + s.name + "\n"
            addDeps(s)
        }
        depIndent = depIndent.slice(4)
    }

    function defineBuiltin(name: string) {
        let ss: Sym = {
            name: name,
            type: SymType.Const,
            align: 4,
            size: 0,
            text: "",
            bind: STB.GLOBAL,
            _relocs: []
        }
        builtInFI.syms.push(ss)
        return ss
    }

    let bxLr = "4770"
    let firstNoop = ""
    function defineNoop(name: string) {
        let sym = defineBuiltin(name)
        sym.type = SymType.Code
        sym.text = bxLr
        delete sym.size
        if (!firstNoop) {
            firstNoop = name
        } else {
            sym._textAlias = firstNoop
        }
        return sym
    }

    defineBuiltin("__etext") // end of text, start of RAM globals to be copied
    defineBuiltin("__data_start__") // RAM globals
    defineBuiltin("__data_end__") // RAM globals
    defineBuiltin("__bss_start__")
    defineBuiltin("__bss_end__")
    defineBuiltin("__end__")
    defineBuiltin("__stack")
    defineBuiltin("__StackTop")
    defineBuiltin("__StackLimit")
    defineBuiltin("__HeapLimit")
    defineBuiltin("__HeapBase")

    let dso = defineBuiltin("__dso_handle")
    dso.size = 4
    dso.type = SymType.BSS

    defineNoop("__libc_fini_array")
    defineNoop("hardware_init_hook")
    defineNoop("software_init_hook")
    defineNoop("__real_main") // unused, avoid warning

    let initSym = defineNoop("__libc_init_array")
    delete initSym._textAlias

    // we never exit...
    defineNoop("atexit")
    defineNoop("__cxa_atexit")
    defineNoop("__aeabi_atexit")
    defineNoop("_global_atexit")

    function lookupLib(sn: string) {
        for (let l of libs) {
            let soff = U.lookup(l.symbols, sn)
            if (soff) {
                let id = l.name + "." + soff
                let fi = U.lookup(libOFiles, id)
                if (!fi) {
                    let e = getArEntry(l, soff)
                    let fn = path.basename(l.name) + "/" + path.basename(e.filename)
                    libOFiles[id] = fi = elfToJson(fn, e.buf)
                    fi.fromArchive = true
                    defineSyms(fi)
                    defineSymsRec(fi)
                }
                let ss = fi.syms.filter(x => x.name == sn)[0]
                if (!ss)
                    U.userError(`unresolved symbol ${sn} in ${l.name} (${fi.filename})  `)
                return [ss]
            }
        }
        return null
    }

    let topInfos = [builtInFI].concat(inputInfos)

    topInfos.forEach(defineSyms)
    topInfos.forEach(defineSymsRec)

    usedSyms = U.concat(topInfos.map(i => i.syms))
    usedSyms.push(lookupLib("__Vectors")[0])

    for (let inf of res.infos) {
        for (let initName of inf.init) {
            usedSyms.push(inf.syms.filter(s => s.name == initName)[0])
        }
    }

    usedSyms.forEach(chaseRelocs)
    usedSyms = []

    res.infos = res.infos.filter(inf => {
        inf.syms = inf.syms.filter(s => s._isUsed)
        return inf.syms.length > 0
    })

    let fid = 0
    for (let inf of res.infos) {
        for (let s of inf.syms) {
            s._id = usedSyms.length
            s._fileId = fid
            usedSyms.push(s)
        }
        fid++
    }

    usedSyms.forEach(resolveRelocs)

    function addDeps(s: Sym) {
        s.relocEnc = []
        for (let r of s._relocs) {
            let ts = U.lookup(symLookup, r.symname) || lookupLib(r.symname)
            if (!ts) {
                //console.log(`unresolved ref ${s.name} -> ${r.symname}`)
            } else {
                U.assert(r.addend == 0)
            }
        }
    }

    function chaseRelocs(s: Sym) {
        if (s._isUsed) return
        s._isUsed = true
        res.depInfo += depIndent + "* " + s.name + "\n"
        depIndent += "  "
        for (let r of s._relocs) {
            let ts = U.lookup(symLookup, r.symname)
            if (!ts) {
                console.log(`unresolved ref ${s.name} -> ${r.symname}`)
            } else {
                U.assert(r.addend == 0)
                ts.forEach(chaseRelocs)
            }
        }
        depIndent = depIndent.slice(2)
    }

    function resolveRelocs(s: Sym) {
        s.relocEnc = []
        for (let r of s._relocs) {
            let ts = U.lookup(symLookup, r.symname)
            U.assert(r.addend == 0)
            let id = ts[0]._id
            if (r.isWeak) id = -id
            s.relocEnc.push(r.type, r.offset, id)
        }
    }

    let byAlias: Map<number> = {}
    let idx = -1
    for (let s of usedSyms) {
        idx++
        if (!s._textAlias) continue
        let v = U.lookup(byAlias, s._textAlias)
        if (v != null) {
            s.symAlias = v
            s.text = ""
            s.relocEnc = []
        } else {
            byAlias[s._textAlias] = idx
        }
    }
    let minimal = false
    for (let s of usedSyms) {
        delete s._textAlias
        delete s._relocs
        delete s._imported
        delete s._isUsed
        if (minimal) {
            delete s._id
            delete s._fileId
        }
    }

    return res
}

function bufToHex(buf: Uint8Array, origin: number) {
    let addr = origin;
    let upper = -1
    let ptr = 0
    let myhex = ""

    while (ptr < buf.length) {
        if ((addr >> 16) != upper) {
            upper = addr >> 16
            hexBytes([0x02, 0x00, 0x00, 0x04, upper >> 8, upper & 0xff])
        }

        hexBytes(nextLine(addr))
        addr += 16
    }

    return myhex

    function nextLine(addr: number) {
        let bytes = [0x10, (addr >> 8) & 0xff, addr & 0xff, 0]
        for (let j = 0; j < 16; ++j) {
            bytes.push((buf[ptr] || 0) & 0xff)
            ptr++
        }
        return bytes
    }


    function hexBytes(bytes: number[]) {
        let chk = 0
        let r = ":"
        bytes.forEach(b => chk += b)
        bytes.push((-chk) & 0xff)
        bytes.forEach(b => r += ("0" + b.toString(16)).slice(-2))
        myhex += r.toUpperCase() + "\r\n";
    }
}


export function linkBinary(assembly: AssemblyInfo) {
    let syms = U.concat(assembly.infos.map(i => i.syms))
    let vect = syms.filter(s => s.type == SymType.Vectors)
    if (vect.length != 1) {
        U.userError(`expecting one vector section, got ${vect.length}`)
    }
    let byName = U.groupBy(syms, s => s.name)
    let flashPos = assembly.target.flashOrigin
    let dataPos = assembly.target.ramOrigin
    let etext = 0
    let dataStart = dataPos
    let inits: Sym[] = []
    let map = ""
    let mapInd = ""

    let usedSyms: Sym[] = []
    let rwDataSyms: Sym[] = []
    let bssSyms: Sym[] = []
    let codeSyms: Sym[] = []

    assembly.infos[0].syms.forEach(addSymCore)

    setPos("__stack", assembly.target.ramOrigin + assembly.target.ramSize)
    setPos("__StackTop", assembly.target.ramOrigin + assembly.target.ramSize)
    let stackLimit = assembly.target.ramOrigin + assembly.target.ramSize - 2048
    setPos("__StackLimit", stackLimit)

    //
    // Recursively pull in symbols
    //

    addSym(vect[0])

    // also include all non-archive members
    for (let inf of assembly.infos)
        if (!inf.fromArchive)
            addSym(inf.syms[0])

    let prevUsed = usedSyms.length
    for (let s of usedSyms) {
        setRelocs(s) // fixup
    }
    U.assert(prevUsed == usedSyms.length) // nothing should be added!

    // TODO remove unused symbols here

    for (let s of codeSyms) {
        if (s.symAlias == null)
            flashPos = place(s, flashPos)
    }

    for (let s of codeSyms) {
        if (s.symAlias != null)
            s.position = syms[s.symAlias].position
    }

    flashPos = align(flashPos, 4)
    etext = flashPos
    setPos("__etext", etext)

    let sizes: Map<number> = {
        codeSize: etext - assembly.target.flashOrigin,
    }

    dataPos = layoutSyms(rwDataSyms, dataPos, "data")
    let dataSize = dataPos - dataStart
    flashPos += dataSize
    flashPos = align(flashPos, 4)

    dataPos = layoutSyms(bssSyms, dataPos, "bss")
    setPos("__end__", dataPos)

    setPos("__HeapBase", dataPos)
    setPos("__HeapLimit", stackLimit)

    let initSym = byName["__libc_init_array"][0]
    initSym.text = "b500" + inits.map(i => "fff7feff").join("") + "bd00"
    initSym.relocEnc = U.concat(inits.map((isym, idx) =>
        [RelocType.R_ARM_THM_CALL, idx * 4 + 2, isym._id]))
    console.log(inits.map(s => s.name))


    let flash = new Uint8Array(assembly.target.flashSize)

    // so they appear nicely in the memory map
    usedSyms.sort((a, b) => a.position - b.position || U.strcmp(a.name, b.name))
    usedSyms.forEach(writeSymbol)

    let hexEntries = assembly.hexEntries || []

    hexEntries.push({
        address: assembly.target.flashOrigin,
        hex: "-"
    })
    hexEntries.sort((a, b) => a.address - b.address)

    let resHex = ""
    for (let he of hexEntries) {
        if (he.hex === "-")
            resHex += bufToHex(flash.slice(0, flashPos - assembly.target.flashOrigin), he.address)
        else {
            let hbuf = new Uint8Array(he.hex.length >> 1)
            for (let i = 0; i < hbuf.length; ++i)
                hbuf[i] = parseInt(he.hex.slice(i << 1, (i << 1) + 2))
            resHex += bufToHex(hbuf, he.address)
        }
    }
    resHex += ":00000001FF\r\n"

    return {
        hex: resHex,
        sizes: sizes,
        map: map
    }

    function layoutSyms(syms: Sym[], p: number, id: string) {
        let byAlign = U.groupBy(syms, s => (s.align || 1) + "")
        let aligns = Object.keys(byAlign).map(s => parseInt(s))
        let wasted = 0
        aligns.sort((a, b) => b - a)
        function findAligned(): Sym {
            for (let align of aligns) {
                if ((p & (align - 1)) == 0 && byAlign[align + ""].length) {
                    return byAlign[align + ""].shift()
                }
            }
            wasted++
            p++
            return findAligned()
        }
        let beg = p
        setPos("__" + id + "_start__", beg)
        for (let i = 0; i < syms.length; ++i) {
            let d: Sym = findAligned()
            p = place(d, p)
        }
        p = align(p, 4)
        setPos("__" + id + "_end__", p)
        sizes[id + "Size"] = p - beg
        sizes[id + "Wasted"] = wasted
        return p
    }

    function align(p: number, a: number) {
        while (p & (a - 1))
            p++
        return p
    }

    function place(s: Sym, p: number) {
        p = align(p, s.align || 1)
        s.position = p
        if (s.text)
            p += s.text.length / 2
        else if (s.size != null)
            p += s.size
        else
            U.oops(`sym: ${s.name}`)
        return p
    }

    function setPos(name: string, p: number) {
        byName[name][0].position = p
    }

    function addSymCore(s: Sym) {
        U.assert(s.position == null)

        s.position = -1
        usedSyms.push(s)

        switch (s.type) {
            case SymType.BSS:
                U.assert(s.relocEnc.length == 0)
                bssSyms.push(s)
                break;
            case SymType.Code:
            case SymType.RoData:
            case SymType.Vectors:
                codeSyms.push(s)
                break;
            case SymType.RwData:
                rwDataSyms.push(s)
                break;
            case SymType.Const:
                // do nothing
                break;
        }
    }

    function setRelocs(s: Sym) {
        for (let i = 0; i < s.relocEnc.length; i += 3) {
            let id = s.relocEnc[i + 2]
            if (id < 0) {
                //console.log(`skip weak ref: ${ss.name}`)
                continue
            }
            let ss = syms[Math.abs(id)]
            let cand = U.lookup(byName, ss.name)
            if (cand.length == 1) {
                U.assert(cand[0] === ss)
            } else {
                ss = pickCandidate(cand)
                s.relocEnc[i + 2] = ss._id
            }
            addSym(ss)
        }
    }

    function symbolImported(s: Sym) {
        if (s.position != null) return true
        let fi = assembly.infos[s._fileId]
        if (!fi.fromArchive) return true
        return false
    }

    function pickCandidate(cand: Sym[]) {
        let curr = cand.filter(symbolImported)
        if (curr.length == 0)
            curr = cand
        let strong = curr.filter(s => !(s.bind & STB.WEAK))
        if (strong.length == 0)
            return curr[0] // multiple weak symbols are OK
        else {
            if (strong.length > 1) {
                console.log(`multiple symbols to consider: ${strong.map(symInfo).join(", ")}`)
            }
            return strong[0]
        }
    }

    function addSym(s: Sym) {
        if (s.position != null) return

        let fi = assembly.infos[s._fileId]

        for (let ss of fi.syms)
            addSymCore(ss)

        // start with the requested one?
        for (let ss of fi.syms) {
            map += mapInd + ss.name + "\n"
            mapInd += "  "
            setRelocs(ss)
            mapInd = mapInd.slice(2)
        }

        U.assert(!!fi.init)
        let arr = fi.init
        fi.init = null
        for (let sname of arr) {
            let isym = U.lookup(byName, sname)[0]
            if (!isym) U.userError(`init symbol ${sname} not found`)
            if (isym._fileId != s._fileId) U.userError(`init symbol ${sname} in wrong place`)
            inits.push(isym)
        }
    }

    function symInfo(s: Sym) {
        let f = assembly.infos[s._fileId]

        return `${s.name} (${f.filename})`
    }

    function writeSymbol(s: Sym) {
        map += ("00000000" + s.position.toString(16)).slice(-8) + "  " + s.name + "\n"
        if (!s.text) return
        let dst = s.position
        if (s.type == SymType.RwData)
            dst = s.position - dataStart + etext
        dst -= assembly.target.flashOrigin
        for (let i = 0; i < s.text.length; i += 2) {
            let v = parseInt(s.text.slice(i, i + 2), 16)
            flash[dst++] = v
        }
        for (let i = 0; i < s.relocEnc.length; i += 3) {
            let id = s.relocEnc[i + 2]
            let ts = syms[Math.abs(id)]
            if (ts.symAlias != null)
                ts = syms[ts.symAlias]
            if (ts.position == null || ts.position < 0) {
                if (id < 0) {
                    console.log(`skip weak ref: ${ts.name} from ${s.name}`)
                    continue // weak symbol
                }
                U.oops(`unpositioned symbol: ${symInfo(ts)} at ${ts.position} type ${ts.type} @${rwDataSyms.indexOf(ts)}`)
            }
            let pc = s.relocEnc[i + 1] + s.position
            let off = pc - assembly.target.flashOrigin
            let tp = s.relocEnc[i + 0]
            let currV = flash[off]
                | (flash[off + 1] << 8)
                | (flash[off + 2] << 16)
                | (flash[off + 3] << 24)
            let symV = ts.position + ts.offset
            switch (tp) {
                case RelocType.R_ARM_ABS32:
                    currV += symV
                    break;
                case RelocType.R_ARM_REL32:
                    currV += symV - pc
                    break;
                case RelocType.R_ARM_THM_CALL:
                    if ((currV >>> 0) != 0xfffef7ff)
                        U.oops(`bad thm call value: ${(currV >>> 0).toString(16)}`)
                    // TODO
                    break;
                default:
                    U.oops(`unknown reloc type: ${tp} (${symInfo(ts)}) in ${symInfo(s)}`)
            }
        }
    }
}