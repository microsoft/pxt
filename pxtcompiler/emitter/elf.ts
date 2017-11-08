namespace pxt.elf {
    interface ProgramHeader {
        _filepos: number;
        type: PHT;
        offset: number;
        vaddr: number;
        paddr: number;
        filesz: number;
        memsz: number;
        flags: PHF;
        align: number;
    };

    const progHeaderFields = [
        "type",
        "offset",
        "vaddr",
        "paddr",
        "filesz",
        "memsz",
        "flags",
        "align",
    ];

    const enum PHT {
        NULL = 0,
        LOAD = 1,
        DYNAMIC = 2,
        INTERP = 3,
        NOTE = 4,
        SHLIB = 5,
        PHDR = 6,
        TLS = 7,
        LOOS = 0x60000000,
        HIOS = 0x6fffffff,
        LOPROC = 0x70000000,
        HIPROC = 0x7fffffff,
        STACK = 0x6474e551,
    };

    const enum PHF {
        X = 0x1,
        W = 0x2,
        R = 0x4,
        MASKOS = 0x0ff00000,
        MASKPROC = 0xf0000000,
    }

    const r32 = pxt.HF2.read32
    const r16 = pxt.HF2.read16

    export interface Info {
        template: Uint8Array;
        imageMemStart: number;
        imageFileStart: number;
        phOffset: number;
    }

    const pageSize = 4096

    export function parse(buf: Uint8Array): Info {
        if (r32(buf, 0) != 0x464c457f)
            U.userError("no magic")
        if (buf[4] != 1)
            U.userError("not 32 bit")
        if (buf[5] != 1)
            U.userError("not little endian")
        if (buf[6] != 1)
            U.userError("bad version")

        if (r16(buf, 0x10) != 2)
            U.userError("wrong object type")
        if (r16(buf, 0x12) != 0x28)
            U.userError("not ARM")
        let phoff = r32(buf, 0x1c)
        let shoff = r32(buf, 0x20)
        if (phoff == 0)
            U.userError("expecting program headers")
        let phentsize = r16(buf, 42)
        let phnum = r16(buf, 44)

        let progHeaders = U.range(phnum).map(no =>
            readPH(phoff + no * phentsize))

        let addFileOff = buf.length + 1;
        while (addFileOff & 0xf) addFileOff++

        let mapEnd = 0

        for (let s of progHeaders) {
            if (s.type == PHT.LOAD)
                mapEnd = Math.max(mapEnd, s.vaddr + s.memsz)
        }

        let addMemOff = ((mapEnd + pageSize - 1) & ~(pageSize - 1)) + (addFileOff & (pageSize - 1))
        let phOffset = -1

        for (let s of progHeaders) {
            if (s.type == PHT.NOTE) {
                phOffset = s._filepos
            }
        }

        return {
            imageMemStart: addMemOff,
            imageFileStart: addFileOff,
            phOffset,
            template: buf
        }

        function readPH(off: number) {
            let r: pxt.Map<number> = {};
            let o0 = off
            for (let f of progHeaderFields) {
                r[f] = r32(buf, off)
                off += 4
            }
            let rr = r as any as ProgramHeader
            rr._filepos = o0
            return rr
        }
    }

    export function patch(info: Info, program: Uint8Array): Uint8Array {
        let resBuf = new Uint8Array(info.imageFileStart + program.length)
        resBuf.fill(0)
        U.memcpy(resBuf, 0, info.template)
        U.memcpy(resBuf, info.imageFileStart, program)

        let ph: ProgramHeader = {
            _filepos: info.phOffset,
            type: PHT.LOAD,
            offset: info.imageFileStart,
            vaddr: info.imageMemStart,
            paddr: info.imageMemStart,
            filesz: program.length,
            memsz: program.length,
            flags: PHF.R | PHF.X,
            align: pageSize
        }
        savePH(resBuf, ph)

        return resBuf

        function savePH(buf: Uint8Array, ph: ProgramHeader) {
            let off = ph._filepos
            for (let f of progHeaderFields) {
                pxt.HF2.write32(buf, off, (ph as any)[f] || 0)
                off += 4
            }
        }
    }
}