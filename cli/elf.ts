import * as fs from 'fs';
import * as path from 'path';
import * as nodeutil from './nodeutil';

import U = pxt.Util;
import Map = pxt.Map;


export const enum SymType {
    Code,
    RoData,
    BSS,
    RwData,
}

export interface Sym {
    name: string;
    type: SymType;
    align: number;
    size: number; // mostly relevant for bss
    text: string; // hex encoded
    _relocs?: Reloc[];
    _id?: number;
    relocEnc?: number[];
    file?: string;
}

export interface Reloc {
    type: RelocType;
    symname: string;
    offset: number;
    addend: number;
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

const enum STB {
    LOCAL = 0,
    GLOBAL = 1,
    WEAK = 2
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

export interface FileInfo {
    syms: Sym[];
    init: Reloc[];
}

export function elfToJson(buf: Buffer): FileInfo {
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
        if (s.isUsed && !s.name) {
            s.name = "." + currNameId++
        }
    }

    let rsyms: Sym[] = []
    let sidx = -1

    for (let s of syms) {
        sidx++
        if (!s.shndx || s.shndx == 65522) continue
        if ((s.bind == STB.GLOBAL && s.name) || s.isUsed) {
            let sect = sects[s.shndx]
            if (!sect) {
                U.userError(`sym=${s.name} using undefined section ${s.shndx}`)
            }
            let ss: Sym = {
                name: s.name,
                type: SymType.Code,
                align: sect.addralign || 1,
                size: sect.size,
                text: "",
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
            else {
                ss.type = SymType.RwData
                console.log(`unknown section name type: ${sect.name} for sym ${s.name} @ ${sidx}`)
            }
            if (ss.type != SymType.BSS)
                ss.text = buf.slice(sect.offset, sect.offset + ss.size).toString("hex")
            rsyms.push(ss)
        }
    }

    let r: FileInfo = {
        syms: rsyms,
        init: convertRelocs(sectsByName[".init_array"])
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
            addend: r.addend
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
            r.sym.isUsed = true
            if (s.type == SHT.RELA)
                r.addend = buf.readInt32LE(off + 8)
            res.push(r)
            off += s.entsize
        }
        return res
    }
}

// TODO rename static (local) symbols with unique names
// TODO merge identical code symbols?
// TODO add support to .a format, including symbol index
// TODO pull in needed symbols from libc and libgcc
// TODO do we need libcrt0?
// TODO support for weak symbols

export function linkInfos(infos: Map<FileInfo>): FileInfo {
    let symLookup: Map<Sym> = {}
    let syms: Sym[] = []
    let inits: Reloc[] = []
    U.iterMap(infos, (fn, fi) => {
        U.pushRange(inits, fi.init)
        for (let s of fi.syms) {
            s._id = syms.length
            syms.push(s)
            let ex = U.lookup(symLookup, s.name)
            if (ex) {
                console.log(`double definitions of ${s.name}`)
            }
            s.file = fn
            symLookup[s.name] = s
        }
    })
    for (let s of syms) {
        s.relocEnc = []
        for (let r of s._relocs) {
            let ts = U.lookup(symLookup, r.symname)
            if (!ts) {
                console.log(`unresolved ref ${s.name} -> ${r.symname}`)
            } else {
                U.assert(r.addend == 0)
                s.relocEnc.push(r.type, r.offset, ts._id)
            }
        }
    }
    for (let s of syms) {
        delete s._relocs
        delete s._id
    }
    return { syms: syms, init: inits, }
}
