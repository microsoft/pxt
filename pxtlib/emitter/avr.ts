/// <reference path="assembler.ts"/>

/* Docs:
    *
    * Atmel AVR 8-bit Instruction Set Manual
    *  http://www.atmel.com/Images/Atmel-0856-AVR-Instruction-Set-Manual.pdf
    * 
    * Common part for Arduino and Circuit Playground
    * http://www.atmel.com/Images/Atmel-7766-8-bit-AVR-ATmega16U4-32U4_Datasheet.pdf
    *
    */

namespace ts.pxtc.avr {

    export class AVRProcessor extends assembler.AbstractProcessor {

        public wordSize() {
            return 2
        }

        // return offset+1 because stack points to next available slot
        public computeStackOffset(kind: string, offset: number) {
            if (kind == "args")
                return offset + 2   // the return pointer is stored on the stack, skip it to get to args
            return offset + 1
        }

        public is32bit(i: assembler.Instruction) {
            return i.is32bit;
        }

        // - the call and jmp instructions have both 16-bit and 22-bit varieties
        // - lds and sts are both 16-bit
        // for now, we only support only 16-bit
        public emit32(op: number, v: number, actual: string): pxtc.assembler.EmitResult {
            // TODO: optimize call/jmp by rcall/rjmp
            let off = v >> 1
            assert(off != null, "off null")
            if ((off | 0) != off ||
                // 16-bit only for now (so, can address 128k)
                !(-128 * 512 <= off && off <= 128 * 512))
                return pxtc.assembler.emitErr("jump out of range", actual);

            // note that off is already in instructions, not bytes
            let imm = off & 0xffff

            return {
                opcode: op,
                opcode2: imm,
                stack: 0,
                numArgs: [v],
                labelName: actual
            }
        }

        public registerNo(actual: string) {
            if (!actual) return null;
            actual = actual.toLowerCase()
            let m = /^r(\d+)$/.exec(actual)
            if (m) {
                let r = parseInt(m[1], 10)
                if (0 <= r && r < 32)
                    return r;
            }
            return null;
        }

        public postProcessRelAddress(f: assembler.File, v: number): number {
            return v + f.baseOffset;
        }

        // absolute addresses come in divide by two
        public postProcessAbsAddress(f: assembler.File, v: number): number {
            return v << 1;
        }

        public getAddressFromLabel(f: assembler.File, i: assembler.Instruction, s: string, wordAligned = false): number {
            // lookup absolute, relative, dependeing
            let l = f.lookupLabel(s);
            if (l == null) return null;
            if (i.is32bit)
                // absolute address
                return l
            // relative address
            return l - (f.pc() + 2)
        }

        public peephole(ln: pxtc.assembler.Line, lnNext: pxtc.assembler.Line, lnNext2: pxtc.assembler.Line) {
                /*
                let ld = this.encoders["$ld"]
                let lnop = ln.getOp()

                // replace 32-bit with 16-bit when branch distance is within bounds
                if ((lnop == "call" || lnop == "jmp") && ln.numArgs[0] != null) {
                    let offset = ln.numArgs[0] - (this.file.baseOffset + ln.location + 2) >> 1
                    if (ld.encode(offset)) {
                        // RULE: call/jmp .somewhere -> rcall/rjmp .somewhere (if fits)
                        if (lnop == "call")
                        ln.update((lnop == "call" ? "rcall " : "rjmp ") + ln.words[1])
                    }
                }
                */
        }

        constructor() {
            super();

            // TODO: use $lbl whenever we need an address

            // Registers
            // $Rd - bits 8:7:6:5:4 (r0)
            // $Rr - bits 9:3:2:1:0 (r1)
            this.addEnc("$r0", "R0-31", v => this.inrange(31, v, v << 4))
            this.addEnc("$r1", "R0-31", v => this.inrange(31, v, (v & 15) | ((v & 16) << 5)))
            this.addEnc("$r2", "R0-4",
                (v: number) => {
                    let r = this.inseq([24, 26, 28, 30], v)
                    return r == null ? null : r << 4
                })
            this.addEnc("$r3", "R0-16-31", v => this.inminmax(16, 31, v, (v - 16) << 4))
            this.addEnc("$r4", "R0-7", v => this.inrange(7, v, v << 4))
            this.addEnc("$r6", "R0-31", v => this.inrange(31, v, v << 5 | v))
            this.addEnc("$r7", "R0-31", v => this.inrange(31, v, v << 3))
            this.addEnc("$r8", "Reven", (v: number) => v & 0x1 ? null : (v >> 1) << 4)
            this.addEnc("$r9", "Reven", (v: number) => v & 0x1 ? null : (v >> 1))
            this.addEnc("$r10", "R0-16-23", v => this.inminmax(16, 23, v, (v - 16) << 4))
            this.addEnc("$r11", "R0-16-23", v => this.inminmax(16, 23, v, v - 16))
            this.addEnc("$r12", "R0-16-31", v => this.inminmax(16, 31, v, v - 16))

            // Immediates:
            this.addEnc("$i0", "#0-63", v => this.inrange(63, v, (v & 0x0f) | (v & 0x30) << 2))
            this.addEnc("$i1", "#0-255", v => this.inrange(255, v, (v & 0x0f) | (v & 0xf0) << 4))
            this.addEnc("$i2", "#0-127", v => this.inrange(127, v, v << 3))
            this.addEnc("$i3", "#0-255", v => this.inrange(255, v, (~v & 0x0f) | (~v & 0xf0) << 4))
            this.addEnc("$i4", "#0-15", v => this.inrange(15, v, v << 4))
            this.addEnc("$i5", "#0-63", v => this.inrange(63, v, (v & 0x0f) | (v & 0x30) << 5))
            this.addEnc("$i6", "#0-127", v => this.inrange(127, v, (v & 0x0f) | (v & 0x70) << 4))
            this.addEnc("$i7", "#0-4095", v => this.inrange(4095, v, v))
            this.addEnc("$i8", "#0-63", v => this.inrange(63, v, v & 0x7 | (v & 0x18) << 7) | (v & 0x20) << 7)
            this.addEnc("$i9", "#0-7", v => this.inrange(7, v, v))

            // labels
            // this.addEnc("$la", "LABEL", v => this.inrange(255, v >> 1, v >> 1)).isWordAligned = true;
            this.addEnc("$la", "LABEL", v => this.inrange(65535, v, v))
            this.addEnc("$lb", "LABEL", v => this.inrangeSigned(127, v >> 1, v >> 1) << 3)
            this.addEnc("$lc", "LABEL", v => this.inrange(65535, v >> 1, v >> 1))
            this.addEnc("$ld", "LABEL", v => this.inrangeSigned(2047, v >> 1, v >> 1))

            this.addInst("adc   $r0, $r1", 0x1C00, 0xfC00);
            this.addInst("add   $r0, $r1", 0x0C00, 0xfC00);
            // adiw deviates from broken syntax in PDF
            this.addInst("adiw  $r2, $i0", 0x9600, 0xff00);
            this.addInst("and   $r0, $r1", 0x2000, 0xfC00);
            this.addInst("andi  $r3, $i1", 0x7000, 0xf000);
            this.addInst("asr   $r0", 0x9405, 0xfe0f);
            this.addInst("bclr  $r4", 0x9488, 0xff8f);
            this.addInst("bld   $r0, $i9", 0xf800, 0xfe08);
            this.addInst("brbc  $i9, $lb", 0xf400, 0xfc00);
            this.addInst("brbs  $i9, $lb", 0xf000, 0xfc00);
            this.addInst("brcc  $lb", 0xf400, 0xfc07);
            this.addInst("brcs  $lb", 0xf000, 0xfc07);
            this.addInst("break", 0x9598, 0xffff);
            this.addInst("breq  $lb", 0xf001, 0xfc07);
            this.addInst("brge  $lb", 0xf404, 0xfc07);
            this.addInst("brhc  $lb", 0xf405, 0xfc07);
            this.addInst("brhs  $lb", 0xf005, 0xfc07);
            this.addInst("brid  $lb", 0xf407, 0xfc07);
            this.addInst("brie  $lb", 0xf007, 0xfc07);
            // conflict with brbs?
            this.addInst("brlo  $lb", 0xf000, 0xfc07);
            this.addInst("brlt  $lb", 0xf004, 0xfc07);
            this.addInst("brmi  $lb", 0xf002, 0xfc07);
            this.addInst("brne  $lb", 0xf401, 0xfc07);
            this.addInst("brpl  $lb", 0xf402, 0xfc07);
            // error in doc? - this has same opcode as brcc
            this.addInst("brsh  $lb", 0xf400, 0xfc07);
            this.addInst("brtc  $lb", 0xf406, 0xfc07);
            this.addInst("brts  $lb", 0xf006, 0xfc07);
            this.addInst("brvc  $lb", 0xf403, 0xfc07);
            this.addInst("brvs  $lb", 0xf003, 0xfc07);
            this.addInst("bset  $r4", 0x9408, 0xff8f);
            this.addInst("bst   $r0, $i9", 0xfa00, 0xfe08);
            // call - 32 bit - special handling
            this.addInst("call  $lc", 0x940e, 0xffff, "CALL");
            this.addInst("cbi   $r7, $i9", 0x9800, 0xff00);
            this.addInst("cbr   $r3, $i3", 0x7000, 0xf000);
            this.addInst("clc", 0x9488, 0xffff);
            this.addInst("clh", 0x94d8, 0xffff);
            this.addInst("cli", 0x94f8, 0xffff);
            this.addInst("cln", 0x94a8, 0xffff);
            this.addInst("clr $r6", 0x2400, 0xfc00);
            this.addInst("cls", 0x94c8, 0xffff);
            this.addInst("clt", 0x94e8, 0xffff);
            this.addInst("clv", 0x94b8, 0xffff);
            this.addInst("clz", 0x9498, 0xffff);
            this.addInst("com   $r0", 0x9400, 0xfe0f);
            this.addInst("cp    $r0, $r1", 0x1400, 0xfC00);
            this.addInst("cpc   $r0, $r1", 0x0400, 0xfC00);
            this.addInst("cpi   $r3, $i1", 0x3000, 0xf000);
            this.addInst("cpse  $r0, $r1", 0x1000, 0xfC00);
            this.addInst("dec   $r0", 0x940a, 0xfe0f);
            this.addInst("des   $i4", 0x940b, 0xff0f);
            this.addInst("eicall", 0x9519, 0xffff);
            this.addInst("eijmp", 0x9419, 0xffff);
            this.addInst("elpm", 0x95d8, 0xffff);
            this.addInst("elpm  $r0, Z0", 0x9006, 0xfe0f);
            this.addInst("elpm  $r0, Z+0", 0x9007, 0xfe0f);
            this.addInst("eor   $r0, $r1", 0x2400, 0xfC00);
            this.addInst("fmul   $r10, $r11", 0x0308, 0xff88);
            this.addInst("fmuls  $r10, $r11", 0x0380, 0xff88);
            this.addInst("fmulsu $r10, $r11", 0x0388, 0xff88);
            this.addInst("icall", 0x9509, 0xffff);
            this.addInst("ijmp", 0x9409, 0xffff);
            this.addInst("in    $r0, $i5", 0xb000, 0xf800);
            this.addInst("inc   $r0", 0x9403, 0xfe0f);
            // jmp - 32 bit - special handling
            this.addInst("jmp  $lc", 0x940c, 0xffff, "JMP")
            this.addInst("lac   Z, $r0", 0x9206, 0xfe0f);
            this.addInst("las   Z, $r0", 0x9205, 0xfe0f);
            this.addInst("lat   Z, $r0", 0x9207, 0xfe0f);
            this.addInst("ld    $r0, X", 0x900c, 0xfe0f);
            this.addInst("ld    $r0, X+", 0x900d, 0xfe0f);
            this.addInst("ld    $r0, -X", 0x900e, 0xfe0f);
            this.addInst("ld    $r0, Y", 0x8008, 0xfe0f);
            this.addInst("ld    $r0, Y+", 0x9009, 0xfe0f);
            this.addInst("ld    $r0, -Y", 0x900a, 0xfe0f);
            this.addInst("ldd   $r0, Y, $i8", 0x8008, 0xd208);
            this.addInst("ld    $r0, Z", 0x8000, 0xfe0f);
            this.addInst("ld    $r0, Z+", 0x9001, 0xfe0f);
            this.addInst("ld    $r0, -Z", 0x9002, 0xfe0f);
            this.addInst("ldd   $r0, Z, $i8", 0x8000, 0xd208);
            this.addInst("ldi   $r3, $i1", 0xe000, 0xf000);
            // lds - 32 bit (special handling required)
            this.addInst("lds   $r0, $la", 0x9000, 0xfe0f, "LDS");
            this.addInst("lds   $r3, $i6", 0xa000, 0xf800);
            this.addInst("lpm", 0x95a8, 0xffff);
            this.addInst("lpm   $r0, Z", 0x9004, 0xfe0f);
            this.addInst("lpm   $r0, Z+", 0x9005, 0xfe0f);
            this.addInst("lsl   $r6", 0x0c00, 0xfc00);
            this.addInst("lsr   $r0", 0x9406, 0xfe0f);
            this.addInst("mov   $r0, $r1", 0x2C00, 0xfC00);
            this.addInst("movw  $r8, $r9", 0x0100, 0xff00);
            this.addInst("mul   $r0, $r1", 0x9c00, 0xfC00);
            this.addInst("muls  $r3, $r12", 0x0200, 0xff00);
            this.addInst("mulsu $r10, $r11", 0x0300, 0xff88);
            this.addInst("neg $r0", 0x9401, 0xfe0f);
            this.addInst("nop", 0x0000, 0xffff);
            this.addInst("or    $r0, $r1", 0x2800, 0xfC00);
            this.addInst("ori   $r3, $i1", 0x6000, 0xf000);
            this.addInst("out   $i5, $r0", 0xb800, 0xf800);
            this.addInst("pop $r0", 0x900f, 0xfe0f);
            this.addInst("push $r0", 0x920f, 0xfe0f);
            this.addInst("rcall $ld", 0xd000, 0xf000);
            this.addInst("ret", 0x9508, 0xffff);
            this.addInst("reti", 0x9518, 0xffff);
            this.addInst("rjmp $ld", 0xc000, 0xf000);
            this.addInst("rol $r6", 0x1c00, 0xfc00);
            this.addInst("ror $r0", 0x9407, 0xfe0f);
            this.addInst("sbc   $r0, $r1", 0x0800, 0xfC00);
            this.addInst("sbci  $r3, $i1", 0x4000, 0xf000);
            this.addInst("sbi   $r7, $i9", 0x9a00, 0xff00);
            this.addInst("sbic  $r7, $i9", 0x9900, 0xff00);
            this.addInst("sbis  $r7, $i9", 0x9b00, 0xff00);
            this.addInst("sbiw  $r2, $i0", 0x9700, 0xff00);
            this.addInst("sbr   $r3, $i1", 0x6000, 0xf000);
            this.addInst("sbrc  $r0, $i9", 0xfc00, 0xfe08);
            this.addInst("sbrs  $r0, $i9", 0xfe00, 0xfe08);
            this.addInst("sec", 0x9408, 0xffff);
            this.addInst("seh", 0x9458, 0xffff);
            this.addInst("sei", 0x9478, 0xffff);
            this.addInst("sen", 0x9428, 0xffff);
            this.addInst("sec", 0x9408, 0xffff);
            this.addInst("ser $r3", 0xef0f, 0xff0f);
            this.addInst("ses", 0x9448, 0xffff);
            this.addInst("set", 0x9468, 0xffff);
            this.addInst("sev", 0x9438, 0xffff);
            this.addInst("sez", 0x9418, 0xffff);
            this.addInst("sleep", 0x9588, 0xffff);
            this.addInst("spm", 0x95e8, 0xffff);
            this.addInst("st    X, $r0", 0x920c, 0xfe0f);
            this.addInst("st    X+, $r0", 0x920d, 0xfe0f);
            this.addInst("st    -X, $r0", 0x920e, 0xfe0f);
            this.addInst("st    Y, $r0", 0x8208, 0xfe0f);
            this.addInst("st    Y+, $r0", 0x9209, 0xfe0f);
            this.addInst("st    -Y, $r0", 0x920a, 0xfe0f);
            this.addInst("std   Y, $i8, $r0", 0x8208, 0xd208);
            this.addInst("st    Z, $r0", 0x8200, 0xfe0f);
            this.addInst("st    Z+, $r0", 0x9201, 0xfe0f);
            this.addInst("st    -Z, $r0", 0x9202, 0xfe0f);
            this.addInst("std   Z, $i8, $r0", 0x8200, 0xd208);
            // sts - 32-bit (special handing required)
            this.addInst("sts   $la, $r0", 0x9200, 0xfe0f, "STS");
            this.addInst("sts   $i6, $r3", 0xa800, 0xf800);
            this.addInst("sub   $r0, $r1", 0x1800, 0xfC00);
            this.addInst("subi  $r3, $i1", 0x5000, 0xf000);
            this.addInst("swap  $r0", 0x9402, 0xfe0f);
            this.addInst("tst   $r6", 0x2000, 0xfc00);
            this.addInst("wdr", 0x95a8, 0xffff);
            this.addInst("xch   Z, $r0", 0x9204, 0xfe0F);
        }

        public testAssembler() {
            assembler.expect(this,
                "2411       eor	r1, r1 \n" +
                "be1f       out	0x3f, r1 \n" +
                "efcf       ldi	r28, 0xFF \n" +
                "e0da       ldi	r29, 0x0A \n" +
                "bfde       out	0x3e, r29 \n" +
                "bfcd      	out	0x3d, r28 \n")

            assembler.expect(this,
                "0c00      lsl     r0\n" +
                "920f      push    r0\n" +
                "e604      ldi     r16, #100        ; 0x64\n" +
                "903f      pop     r3\n")

            assembler.expect(this,
                "1412      cp      r1, r2\n" +
                "f409      brne    l6\n" +
                "c001      rjmp    l8\n" +
                "0e01  l6: add     r0, r17\n" +
                "0000  l8: nop     \n")
        }
    }
}
