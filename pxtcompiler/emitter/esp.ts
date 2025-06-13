namespace pxt.esp {
    export interface Segment {
        addr: number
        isMapped: boolean
        isDROM: boolean
        data: Uint8Array
    }

    export interface Image {
        header: Uint8Array
        chipName: string
        segments: Segment[]
    }

    const r32 = pxt.HF2.read32
    const r16 = pxt.HF2.read16

    /* layout:
  u8 magic 0xE9
  u8 numsegs
  u8 flash_mode
  u8 flash_size_freq
  u32 entrypoint // 4
  u8 wp_pin // 8
  u8 clk/q drv // 9
  u8 d/cs drv // 10
  u8 hd/wp drv // 11
  u16 chip_id // 12
  */

    interface MemSegment {
        from: number
        to: number
        id: string
    }

    interface ChipDesc {
        name: string
        chipId: number
        memmap: MemSegment[]
    }

    const chips: ChipDesc[] = [
        {
            name: "esp32", chipId: 0,
            memmap: [
                { from: 0x00000000, to: 0x00010000, id: "PADDING" },
                { from: 0x3F400000, to: 0x3F800000, id: "DROM" },
                { from: 0x3F800000, to: 0x3FC00000, id: "EXTRAM_DATA" },
                { from: 0x3FF80000, to: 0x3FF82000, id: "RTC_DRAM" },
                { from: 0x3FF90000, to: 0x40000000, id: "BYTE_ACCESSIBLE" },
                { from: 0x3FFAE000, to: 0x40000000, id: "DRAM" },
                { from: 0x3FFE0000, to: 0x3FFFFFFC, id: "DIRAM_DRAM" },
                { from: 0x40000000, to: 0x40070000, id: "IROM" },
                { from: 0x40070000, to: 0x40078000, id: "CACHE_PRO" },
                { from: 0x40078000, to: 0x40080000, id: "CACHE_APP" },
                { from: 0x40080000, to: 0x400A0000, id: "IRAM" },
                { from: 0x400A0000, to: 0x400BFFFC, id: "DIRAM_IRAM" },
                { from: 0x400C0000, to: 0x400C2000, id: "RTC_IRAM" },
                { from: 0x400D0000, to: 0x40400000, id: "IROM" },
                { from: 0x50000000, to: 0x50002000, id: "RTC_DATA" },
            ]
        },
        {
            name: "esp32-s2", chipId: 2,
            memmap: [
                { from: 0x00000000, to: 0x00010000, id: "PADDING" },
                { from: 0x3F000000, to: 0x3FF80000, id: "DROM" },
                { from: 0x3F500000, to: 0x3FF80000, id: "EXTRAM_DATA" },
                { from: 0x3FF9E000, to: 0x3FFA0000, id: "RTC_DRAM" },
                { from: 0x3FF9E000, to: 0x40000000, id: "BYTE_ACCESSIBLE" },
                { from: 0x3FF9E000, to: 0x40072000, id: "MEM_INTERNAL" },
                { from: 0x3FFB0000, to: 0x40000000, id: "DRAM" },
                { from: 0x40000000, to: 0x4001A100, id: "IROM_MASK" },
                { from: 0x40020000, to: 0x40070000, id: "IRAM" },
                { from: 0x40070000, to: 0x40072000, id: "RTC_IRAM" },
                { from: 0x40080000, to: 0x40800000, id: "IROM" },
                { from: 0x50000000, to: 0x50002000, id: "RTC_DATA" },
            ]
        },
        {
            name: "esp32-s3", chipId: 4,
            memmap: [
                { from: 0x00000000, to: 0x00010000, id: "PADDING" },
                { from: 0x3C000000, to: 0x3D000000, id: "DROM" },
                { from: 0x3D000000, to: 0x3E000000, id: "EXTRAM_DATA" },
                { from: 0x600FE000, to: 0x60100000, id: "RTC_DRAM" },
                { from: 0x3FC88000, to: 0x3FD00000, id: "BYTE_ACCESSIBLE" },
                { from: 0x3FC88000, to: 0x403E2000, id: "MEM_INTERNAL" },
                { from: 0x3FC88000, to: 0x3FD00000, id: "DRAM" },
                { from: 0x40000000, to: 0x4001A100, id: "IROM_MASK" },
                { from: 0x40370000, to: 0x403E0000, id: "IRAM" },
                { from: 0x600FE000, to: 0x60100000, id: "RTC_IRAM" },
                { from: 0x42000000, to: 0x42800000, id: "IROM" },
                { from: 0x50000000, to: 0x50002000, id: "RTC_DATA" },
            ]
        },
        {
            name: "esp32-c3", chipId: 5,
            memmap: [
                { from: 0x00000000, to: 0x00010000, id: "PADDING" },
                { from: 0x3C000000, to: 0x3C800000, id: "DROM" },
                { from: 0x3FC80000, to: 0x3FCE0000, id: "DRAM" },
                { from: 0x3FC88000, to: 0x3FD00000, id: "BYTE_ACCESSIBLE" },
                { from: 0x3FF00000, to: 0x3FF20000, id: "DROM_MASK" },
                { from: 0x40000000, to: 0x40060000, id: "IROM_MASK" },
                { from: 0x42000000, to: 0x42800000, id: "IROM" },
                { from: 0x4037C000, to: 0x403E0000, id: "IRAM" },
                { from: 0x50000000, to: 0x50002000, id: "RTC_IRAM" },
                { from: 0x50000000, to: 0x50002000, id: "RTC_DRAM" },
                { from: 0x600FE000, to: 0x60100000, id: "MEM_INTERNAL2" },
            ]
        },
    ]

    const segHdLen = 8

    function segToString(seg: Segment) {
        return `0x${seg.addr.toString(16)} 0x${seg.data.length.toString(16)} bytes; ` +
            `${seg.isDROM ? "drom " : ""}${seg.isMapped ? "mapped " : ""}${U.toHex(seg.data.slice(0, 20))}...`
    }

    function padSegments(image: Image) {
        const align = 0x10000
        const alignMask = align - 1

        image = cloneStruct(image)
        image.segments.sort((a, b) => a.addr - b.addr)

        pxt.debug("esp padding:\n" + image.segments.map(segToString).join("\n") + "\n")

        const mapped = image.segments.filter(s => s.isMapped)
        const nonMapped = image.segments.filter(s => !s.isMapped)
        image.segments = []
        let foff = image.header.length

        for (const seg of mapped) {
            // there's apparently a bug in ESP32 bootloader, that doesn't map the last page if it's smaller than 0x24
            const leftoff = (seg.addr + seg.data.length) & alignMask
            if (leftoff < 0x24) {
                const padding = new Uint8Array(0x24 - leftoff)
                seg.data = pxt.U.uint8ArrayConcat([seg.data, padding])
            }
        }

        while (mapped.length > 0) {
            let seg = mapped[0]
            const padLen = alignmentNeeded(seg)
            if (padLen > 0) {
                seg = getPaddingSegment(padLen)
            } else {
                if (((foff + segHdLen) & alignMask) != (seg.addr & alignMask)) {
                    throw new Error(`pad oops 0 ${foff}+${segHdLen} != ${seg.addr} (mod mask)`)
                }
                mapped.shift()
            }
            image.segments.push(seg)
            foff += segHdLen + seg.data.length
            if (foff & 3)
                throw new Error("pad oops 1")
        }

        // append any remaining non-mapped segments
        image.segments = image.segments.concat(nonMapped)

        pxt.debug("esp padded:\n" + image.segments.map(segToString).join("\n") + "\n")

        return image

        function alignmentNeeded(seg: Segment) {
            const reqd = (seg.addr - segHdLen) & alignMask
            let padLen = (reqd - foff) & alignMask
            if (padLen == 0)
                return 0
            padLen -= segHdLen
            if (padLen < 0)
                padLen += align
            return padLen
        }

        function getPaddingSegment(bytes: number): Segment {
            if (!nonMapped.length || bytes <= segHdLen)
                return {
                    addr: 0,
                    isMapped: false,
                    isDROM: false,
                    data: new Uint8Array(bytes)
                }
            const seg = nonMapped[0]
            const res: Segment = {
                addr: seg.addr,
                isMapped: seg.isMapped,
                isDROM: seg.isDROM,
                data: seg.data.slice(0, bytes)
            }
            seg.data = seg.data.slice(bytes)
            seg.addr += res.data.length
            if (seg.data.length == 0)
                nonMapped.shift()
            return res
        }
    }

    export function toBuffer(image: Image, digest = true) {
        image = padSegments(image)
        let size = image.header.length
        for (const seg of image.segments) {
            size += segHdLen + seg.data.length
        }
        size = (size + 16) & ~15 // align to 16 bytes - last byte will be weak checksum
        let res = new Uint8Array(size)
        res.set(image.header)
        res[1] = image.segments.length
        let off = image.header.length
        let checksum = 0xEF
        for (const seg of image.segments) {
            pxt.HF2.write32(res, off, seg.addr)
            pxt.HF2.write32(res, off + 4, seg.data.length)
            res.set(seg.data, off + segHdLen)
            off += segHdLen + seg.data.length
            for (let i = 0; i < seg.data.length; ++i)
                checksum ^= seg.data[i]
        }
        res[res.length - 1] = checksum

        if (digest) {
            res[23] = 1
            const digest = ts.pxtc.BrowserImpl.sha256buffer(res)
            res = pxt.U.uint8ArrayConcat([res, pxt.U.fromHex(digest)])
        } else {
            res[23] = 0 // disable digest
        }

        // pxt.log("reparsed\n" + parseBuffer(res).segments.map(segToString).join("\n") + "\n")

        return res
    }

    export function parseBuffer(buf: Uint8Array) {
        if (buf[0] != 0xE9)
            throw new Error("ESP: invalid magic: " + buf[0])

        let ptr = 24

        const chipId = r16(buf, 12)
        const chipdesc = chips.find(c => c.chipId == chipId)

        if (!chipdesc)
            throw new Error("ESP: unknown chipid: " + chipId)

        const image: Image = {
            header: buf.slice(0, ptr),
            chipName: chipdesc.name,
            segments: []
        }

        const numseg = buf[1]
        for (let i = 0; i < numseg; ++i) {
            const offset = r32(buf, ptr)
            const size = r32(buf, ptr + 4)

            ptr += segHdLen

            const data = buf.slice(ptr, ptr + size)
            if (data.length != size)
                throw new Error("too short file")
            ptr += size

            if (isInSection(offset, "PADDING"))
                continue

            const ex = image.segments.filter(seg => seg.addr + seg.data.length == offset)[0]
            if (ex)
                ex.data = pxt.U.uint8ArrayConcat([ex.data, data])
            else
                image.segments.push({
                    addr: offset,
                    isMapped: isInSection(offset, "DROM") || isInSection(offset, "IROM"),
                    isDROM: isInSection(offset, "DROM"),
                    data: data
                })
        }

        return image

        function isInSection(addr: number, sect: string) {
            return chipdesc.memmap.some(m => m.id == sect && m.from <= addr && addr <= m.to)
        }
    }

    export function parseB64(lines: string[]) {
        return parseBuffer(pxt.U.stringToUint8Array(atob(lines.join(""))))
    }

    export function cloneStruct(img: Image) {
        const res = U.flatClone(img)
        res.segments = res.segments.map(U.flatClone)
        return res
    }
}