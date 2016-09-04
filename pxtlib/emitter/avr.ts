/* Docs:
    *
    * Atmel AVR 8-bit Instruction Set Manual
    *  http://www.atmel.com/Images/Atmel-0856-AVR-Instruction-Set-Manual.pdf
    * 

__SP_H__ 
 
Stack pointer high byte at address 0x3E 
 

__SP_L__ 
 
Stack pointer low byte at address 0x3D 
 

    */

namespace ts.pxtc.avr {

    export class AVRProcessor extends assembler.EncodersInstructions {

        public is32bit(i: assembler.Instruction) {
            return i.is32bit;
        }

        // - the call and jmp instructions have both 16-bit and 22-bit varieties
        // - lds and sts are both 16-bit
        // for now, we only support only 16-bit
        public emit32(i: assembler.Instruction, v: number, actual: string): pxtc.assembler.EmitResult {
            if (v % 2) return pxtc.assembler.emitErr("uneven target label?", actual);
            let off = v / 2
            assert(off != null)
            if ((off | 0) != off ||
                // 16-bit only for now (so, can address 128k)
                !(0 <= off && off < 65536))
                return pxtc.assembler.emitErr("jump out of range", actual);

            // note that off is already in instructions, not bytes
            let imm = off & 0xffff

            return {
                opcode: i.opcode,
                opcode2: imm,
                stack: 0,
                numArgs: [v],
                labelName: actual
            }
        }

        public registerNo(actual: string) {
            if (!actual) return null;
            actual = actual.toLowerCase()
            switch (actual) {
                // case "pc": actual = "r15"; break;
                // case "lr": actual = "r14"; break;
                // case "sp": actual = "r13"; break;
            }
            let m = /^r(\d+)$/.exec(actual)
            if (m) {
                let r = parseInt(m[1], 10)
                if (0 <= r && r < 32)
                    return r;
            }
            return null;
        }

        public getRelativeLabel(f: assembler.File, s: string, wordAligned = false): number {
            let l = f.lookupLabel(s);
            if (l == null) return null;
            // assumes this instruction is 16-bit  
            let pc = f.location() + 2;
            // if (wordAligned) pc = pc & 0xfffffffc
            return l - pc;
        }


        public isPop(opcode: number): boolean {
            return opcode == 0x900f;
        }

        public isPush(opcode: number): boolean {
            return opcode == 0x920f;
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
            this.addEnc("$r5", "R0-7", v => this.inrange(7, v, v))
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

            // TODO: revisit labelling
            this.addEnc("$la", "LABEL", v => this.inrange(255, v / 4, v >> 2)).isWordAligned = true;
            this.addEnc("$lb", "LABEL", v => this.inrangeSigned(63, v / 2, (v >> 1) << 3))
            this.addEnc("$lb11", "LABEL", v => this.inrangeSigned(2047, v / 2, v >> 1))

            this.addInst("adc   $r0, $r1", 0x1C00, 0xfC00);
            this.addInst("add   $r0, $r1", 0x0C00, 0xfC00);
            // adiw deviates from broken syntax in PDF
            this.addInst("adiw  $r2, $i0", 0x9600, 0xff00);
            this.addInst("and   $r0, $r1", 0x2000, 0xfC00);
            this.addInst("andi  $r3, $i1", 0x7000, 0xf000);
            this.addInst("asr   $r0", 0x9405, 0xfe0f);
            this.addInst("bclr  $r4", 0x9488, 0xff8f);
            this.addInst("bld   $r0, $r5", 0xf800, 0xfe08);
            this.addInst("brbc  $r5, $lb", 0xf400, 0xfc00);
            this.addInst("brbs  $r5, $lb", 0xf000, 0xfc00);
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
            this.addInst("bst   $r0, $r5", 0xfa00, 0xfe08);
            // call - 32 bit - special handling
            this.addInst("call  $lb", 0x940e, 0xffff, "CALL");
            this.addInst("cbi   $r7, $r5", 0x9800, 0xff00);
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
            this.addInst("jmp  $lb", 0x940c, 0xffff, "JMP")
            this.addInst("lac   Z, $r0", 0x9206, 0xfe0f);
            this.addInst("las   Z, $r0", 0x9205, 0xfe0f);
            this.addInst("lat   Z, $r0", 0x9207, 0xfe0f);
            this.addInst("ld    $r0, X", 0x9006, 0xfe0f);
            this.addInst("ld    $r0, X+", 0x9007, 0xfe0f);
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
            this.addInst("lds   $r3, $la", 0x9000, 0xfe0f, "LDS");
            this.addInst("lds   $r3, $i6", 0xa000, 0xf800);
            this.addInst("lpm", 0x95a8, 0xffff);
            this.addInst("lpm2  $r0", 0x9004, 0xfe0f);
            this.addInst("lpm3  $r0", 0x9005, 0xfe0f);
            this.addInst("lsl   $r6", 0x0c00, 0xfc00);
            this.addInst("lsr   $r0", 0x9406, 0xfe0f);
            this.addInst("mov   $r0, $r1", 0x2C00, 0xfC00);
            this.addInst("movw  $r8, $r9", 0x0100, 0xff00);
            this.addInst("mul   $r0, $r1", 0x9400, 0xfC00);
            this.addInst("muls  $r3, $r12", 0x0200, 0xff00);
            this.addInst("mulsu $r10, $r11", 0x0300, 0xff88);
            this.addInst("neg $r0", 0x9401, 0xfe0f);
            this.addInst("nop", 0x0000, 0xffff);
            this.addInst("or    $r0, $r1", 0x2800, 0xfC00);
            this.addInst("ori   $r3, $i1", 0x6000, 0xf000);
            this.addInst("out   $i5, $r0", 0xb800, 0xf800);
            this.addInst("pop $r0", 0x900f, 0xfe0f);
            this.addInst("push $r0", 0x920f, 0xfe0f);
            this.addInst("rcall $lbl11", 0xd000, 0xf000);
            this.addInst("ret", 0x9508, 0xffff);
            this.addInst("reti", 0x9518, 0xffff);
            this.addInst("rjmp $lb11", 0xc000, 0xf000);
            this.addInst("rol $r6", 0x1c00, 0xfc00);
            this.addInst("lor $r0", 0x9407, 0xfe0f);
            this.addInst("sbc   $r0, $r1", 0x0800, 0xfC00);
            this.addInst("sbci  $r3, $i1", 0x4000, 0xf000);
            this.addInst("sbi   $r7, $r5", 0x9a00, 0xff00);
            this.addInst("sbic  $r7, $r5", 0x9900, 0xff00);
            this.addInst("sbis  $r7, $r5", 0x9b00, 0xff00);
            this.addInst("sbiw  $r2, $i0", 0x9700, 0xff00);
            this.addInst("sbr   $r3, $i1", 0x6000, 0xf000);
            this.addInst("sbrc  $r0, $r5", 0xfc00, 0xfe08);
            this.addInst("sbrs  $r0, $r5", 0xfe00, 0xfe08);
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
            this.addInst("sts   $la, $r3", 0x9200, 0xfe0f, "STS");
            this.addInst("sts   $i6, $r3", 0xa800, 0xf800);
            this.addInst("sub   $r0, $r1", 0x1800, 0xfC00);
            this.addInst("subi  $r3, $i1", 0x5000, 0xf000);
            this.addInst("swap  $r0", 0x9402, 0xfe0f);
            this.addInst("tst   $r6", 0x2000, 0xfc00);
            this.addInst("wdr", 0x95a8, 0xffff);
            this.addInst("xch   Z, $r0", 0x9204, 0xfe0F);
        }

    }

    export function testAVR() {
        let avr = new AVRProcessor();

        assembler.expect(avr,
            "0c00      lsl     r0\n" +
            "920f      push    r0\n" +
            "e604      ldi     r16, #100        ; 0x64\n" +
            "903f      pop     r3\n")

        // had problems with .word
        // "          .balign 4\n" +
        //           "e6c0      .word   -72000\n")

        assembler.expect(avr,
            "1412      cp      r1, r2\n" +
            "f409      brne    l6\n" +
            "c001      rjmp    l8\n" +
            "0e01  l6: add     r0, r17\n" +
            "0000  l8: nop     \n")

assembler.expect(avr,
".startaddr 0x1b8\n" +
"0b08 sbc r16, r24\n" +
"0200 muls r16, r16\n" +
"0202 muls r16, r18\n" +
"0001 .word 0x0001\n" +
"0409 cpc r0, r9\n" +
"0000 nop \n" +
"0201 muls r16, r17\n" +
"0002 .word 0x0002\n" +
"0500 cpc r16, r0\n" +
"0024 .word 0x0024\n" +
"0110 movw r2, r0\n" +
"2405 eor r0, r5\n" +
"0101 movw r0, r2\n" +
"0401 cpc r0, r1\n" +
"0224 muls r18, r20\n" +
"0506 cpc r16, r6\n" +
"0624 cpc r2, r20\n" +
"0100 movw r0, r0\n" +
"0507 cpc r16, r7\n" +
"0381 fmuls r16, r17\n" +
"0010 .word 0x0010\n" +
"0940 sbc r20, r0\n" +
"0104 movw r0, r8\n" +
"0200 muls r16, r16\n" +
"000a .word 0x000a\n" +
"0000 nop \n" +
"0507 cpc r16, r7\n" +
"0202 muls r16, r18\n" +
"0040 .word 0x0040\n" +
"0700 cpc r16, r16\n" +
"8305 std Z, #5, r16\n" +
"4002 sbci r16, 0x02\n" +
"0000 nop \n" +
"0304 mulsu r16, r20\n" +
"0409 cpc r0, r9\n" +
"6441 ori r20, 0x41\n" +
"6661 ori r22, 0x61\n" +
"7572 andi r23, 0x52\n" +
"7469 andi r22, 0x49\n" +
"4300 sbci r16, 0x30\n" +
"7269 andi r22, 0x29\n" +
"7563 andi r22, 0x53\n" +
"7469 andi r22, 0x49\n" +
"5020 subi r18, 0x00\n" +
"616c ori r22, 0x1C\n" +
"6779 ori r23, 0x79\n" +
"6f72 ori r23, 0xF2\n" +
"6e75 ori r23, 0xE5\n" +
"0064 .word 0x0064\n" +
"0112 movw r2, r4\n" +
"0200 muls r16, r16\n" +
"0000 nop \n" +
"4000 sbci r16, 0x00\n" +
"239a and r25, r26\n" +
"8011 ldd r1, Z, #1\n" +
"0100 movw r0, r0\n" +
"0201 muls r16, r17\n" +
"0103 movw r0, r6\n" +
"0112 movw r2, r4\n" +
"0200 muls r16, r16\n" +
"02ef muls r30, r31\n" +
"4001 sbci r16, 0x01\n" +
"239a and r25, r26\n" +
"8011 ldd r1, Z, #1\n" +
"0100 movw r0, r0\n" +
"0201 muls r16, r17\n" +
"0103 movw r0, r6\n" +
"18a5 sub r10, r5\n" +
"18a1 sub r10, r1\n" +
"2411 eor r1, r1\n" +
"be1f out 0x3f, r1\n" +
"efcf ldi r28, 0xFF\n" +
"e0da ldi r29, 0x0A\n" +
"bfde out 0x3e, r29\n" +
"bfcd out 0x3d, r28\n" +
"e012 ldi r17, 0x02\n" +
"e0a0 ldi r26, 0x00\n" +
"e0b1 ldi r27, 0x01\n" +
"e9ec ldi r30, 0x9C\n" +
"e3fb ldi r31, 0x3B\n" +
"c002 rjmp L1\n" +
"9005 L2: lpm r0, Z+\n" +
"920d st X+, r0\n" +
"39a0 L1: cpi r26, 0x90\n" +
"07b1 cpc r27, r17\n" +
"f7d9 brne L2\n" +
"e025 ldi r18, 0x05\n" +
"e9a0 ldi r26, 0x90\n" +
"e0b2 ldi r27, 0x02\n" +
"c001 rjmp L3\n" +
"921d L4: st X+, r1\n" +
"3ca4 L3: cpi r26, 0xC4\n" +
"07b2 cpc r27, r18\n" +
"f7e1 brne L4\n" +
"e011 ldi r17, 0x01\n" +
"e2c0 ldi r28, 0x20\n" +
"e0d1 ldi r29, 0x01\n" +
"c004 rjmp L5\n" +
"9721 L7: sbiw r28, 0x01\n" +
"01fe movw r30, r28\n" +
"940e199c call L6\n" +
"31cf L5: cpi r28, 0x1F\n" +
"07d1 cpc r29, r17\n" +
"f7c9 brne L7\n" +
"940e13c9 call L8\n" +
"940c1dc1 jmp L9\n" +
"940c0000 jmp L10\n" +
"940e1da6 call L11\n" +
"ed85 L107: ldi r24, 0xD5\n" +
"938000bc sts 0x00BC, r24\n" +
"918000bc L12: lds r24, 0x00BC\n" +
"fd84 sbrc r24, #4\n" +
"cffc rjmp L12\n" +
"92100362 sts 0x0362, r1\n" +
"9508 ret \n" +
"9508 ret \n" +
"91e0031b lds r30, 0x031B\n" +
"9180031a lds r24, 0x031A\n" +
"17e8 cp r30, r24\n" +
"f430 brcc L13\n" +
"e0f0 ldi r31, 0x00\n" +
"5ee4 subi r30, 0xE4\n" +
"4ffc sbci r31, 0xFC\n" +
"8180 ld r24, Z\n" +
"e090 ldi r25, 0x00\n" +
"9508 ret \n" +
"ef8f L13: ldi r24, 0xFF\n" +
"ef9f ldi r25, 0xFF\n" +
"9508 ret \n" +
"9190031b L126: lds r25, 0x031B\n" +
"9180031a lds r24, 0x031A\n" +
"1798 cp r25, r24\n" +
"f450 brcc L14\n" +
"2fe9 mov r30, r25\n" +
"e0f0 ldi r31, 0x00\n" +
"5ee4 subi r30, 0xE4\n" +
"4ffc sbci r31, 0xFC\n" +
"8120 ld r18, Z\n" +
"e030 ldi r19, 0x00\n" +
"5f9f subi r25, 0xFF\n" +
"9390031b sts 0x031B, r25\n" +
"c002 rjmp L15\n" +
"ef2f L14: ldi r18, 0xFF\n" +
"ef3f ldi r19, 0xFF\n" +
"01c9 L15: movw r24, r18\n" +
"9508 ret \n" +
"9180031a lds r24, 0x031A\n" +
"e090 ldi r25, 0x00\n" +
"9120031b lds r18, 0x031B\n" +
"1b82 sub r24, r18\n" +
"0991 sbc r25, r1\n" +
"9508 ret \n" +
"92cf push r12\n" +
"92df push r13\n" +
"92ef push r14\n" +
"92ff push r15\n" +
"930f push r16\n" +
"931f push r17\n" +
"93cf push r28\n" +
"93df push r29\n" +
"017c movw r14, r24\n" +
"018a movw r16, r20\n" +
"91800363 lds r24, 0x0363\n" +
"2388 and r24, r24\n" +
"f089 breq L16\n" +
"01eb movw r28, r22\n" +
"016b movw r12, r22\n" +
"0ec4 add r12, r20\n" +
"1ed5 adc r13, r21\n" +
"15cc L18: cp r28, r12\n" +
"05dd cpc r29, r13\n" +
"f0f1 breq L17\n" +
"9169 ld r22, Y+\n" +
"01d7 movw r26, r14\n" +
"91ed ld r30, X+\n" +
"91fc ld r31, X\n" +
"9001 ld r0, Z+\n" +
"81f0 ld r31, Z\n" +
"2de0 mov r30, r0\n" +
"01c7 movw r24, r14\n" +
"9509 icall \n" +
"cff3 rjmp L18\n" +
"2f84 L16: mov r24, r20\n" +
"3241 cpi r20, 0x21\n" +
"f488 brcc L17\n" +
"91900362 lds r25, 0x0362\n" +
"3094 cpi r25, 0x04\n" +
"f469 brne L17\n" +
"934002d7 sts 0x02D7, r20\n" +
"01fb movw r30, r22\n" +
"eb25 ldi r18, 0xB5\n" +
"e032 ldi r19, 0x02\n" +
"01d9 movw r26, r18\n" +
"2f9a L19: mov r25, r26\n" +
"1b92 sub r25, r18\n" +
"1798 cp r25, r24\n" +
"f418 brcc L17\n" +
"9191 ld r25, Z+\n" +
"939d st X+, r25\n" +
"cff9 rjmp L19\n" +
"01c8 L17: movw r24, r16\n" +
"91df pop r29\n" +
"91cf pop r28\n" +
"911f pop r17\n" +
"910f pop r16\n" +
"90ff pop r15\n" +
"90ef pop r14\n" +
"90df pop r13\n" +
"90cf pop r12\n" +
"9508 ret \n" +
"91200363 L123: lds r18, 0x0363\n" +
"2322 and r18, r18\n" +
"f0c9 breq L20\n" +
"91200386 lds r18, 0x0386\n" +
"3220 cpi r18, 0x20\n" +
"f040 brcs L21\n" +
"e021 ldi r18, 0x01\n" +
"e030 ldi r19, 0x00\n" +
"01fc movw r30, r24\n" +
"8333 std Z, #3, r19\n" +
"8322 std Z, #2, r18\n" +
"e080 ldi r24, 0x00\n" +
"e090 ldi r25, 0x00\n" +
"9508 ret \n" +
"91800364 L21: lds r24, 0x0364\n" +
"2fe8 mov r30, r24\n" +
"e0f0 ldi r31, 0x00\n" +
"59eb subi r30, 0x9B\n" +
"4ffc sbci r31, 0xFC\n" +
"8360 st Z, r22\n" +
"5f8f subi r24, 0xFF\n" +
"93800364 sts 0x0364, r24\n" +
"93800386 sts 0x0386, r24\n" +
"c009 rjmp L22\n" +
"91800362 L20: lds r24, 0x0362\n" +
"3084 cpi r24, 0x04\n" +
"f429 brne L22\n" +
"e081 ldi r24, 0x01\n" +
"938002d7 sts 0x02D7, r24\n" +
"936002b5 sts 0x02B5, r22\n" +
"e081 L22: ldi r24, 0x01\n" +
"e090 ldi r25, 0x00\n" +
"9508 ret \n" +
"9508 ret \n" +
"940c1d0e jmp L23\n" +
"930f push r16\n" +
"931f push r17\n" +
"93cf push r28\n" +
"93df push r29\n" +
"018c movw r16, r24\n" +
"01eb movw r28, r22\n" +
"e288 ldi r24, 0x28\n" +
"01fb movw r30, r22\n" +
"9211 L24: st Z+, r1\n" +
"958a dec r24\n" +
"f7e9 brne L24\n" +
"e04b ldi r20, 0x0B\n" +
"e050 ldi r21, 0x00\n" +
"e767 ldi r22, 0x77\n" +
"e072 ldi r23, 0x02\n" +
"01ce movw r24, r28\n" +
"940e1db2 call L25\n" +
"861b std Y, #11, r1\n" +
"e041 ldi r20, 0x01\n" +
"e050 ldi r21, 0x00\n" +
"e060 ldi r22, 0x00\n" +
"e070 ldi r23, 0x00\n" +
"874c std Y, #12, r20\n" +
"875d std Y, #13, r21\n" +
"876e std Y, #14, r22\n" +
"877f std Y, #15, r23\n" +
"01f8 movw r30, r16\n" +
"8985 ldd r24, Z, #21\n" +
"8996 ldd r25, Z, #22\n" +
"89a7 ldd r26, Z, #23\n" +
"8db0 ldd r27, Z, #24\n" +
"8b88 std Y, #16, r24\n" +
"8b99 std Y, #17, r25\n" +
"8baa std Y, #18, r26\n" +
"8bbb std Y, #19, r27\n" +
"8b4c std Y, #20, r20\n" +
"8b5d std Y, #21, r21\n" +
"8b6e std Y, #22, r22\n" +
"8b7f std Y, #23, r23\n" +
"a21c std Y, #36, r1\n" +
"a21d std Y, #37, r1\n" +
"a21e std Y, #38, r1\n" +
"a21f std Y, #39, r1\n" +
"8e18 std Y, #24, r1\n" +
"8e19 std Y, #25, r1\n" +
"8e1a std Y, #26, r1\n" +
"8e1b std Y, #27, r1\n" +
"8e1c std Y, #28, r1\n" +
"8e1d std Y, #29, r1\n" +
"8e1e std Y, #30, r1\n" +
"8e1f std Y, #31, r1\n" +
"a218 std Y, #32, r1\n" +
"a219 std Y, #33, r1\n" +
"a21a std Y, #34, r1\n" +
"a21b std Y, #35, r1\n" +
"91df pop r29\n" +
"91cf pop r28\n" +
"911f pop r17\n" +
"910f pop r16\n" +
"9508 ret \n" +
"e090 L32: ldi r25, 0x00\n" +
"01fc movw r30, r24\n" +
"9731 sbiw r30, 0x01\n" +
"30ef cpi r30, 0x0F\n" +
"05f1 cpc r31, r1\n" +
"f5b0 brcc L26\n" +
"5aea subi r30, 0xAA\n" +
"4fff sbci r31, 0xFF\n" +
"940c199c jmp L6\n" +
"91800080 lds r24, 0x0080\n" +
"778f andi r24, 0x7F\n" +
"c003 rjmp L27\n" +
"91800080 lds r24, 0x0080\n" +
"7d8f andi r24, 0xDF\n" +
"93800080 L27: sts 0x0080, r24\n" +
"9508 ret \n" +
"91800080 lds r24, 0x0080\n" +
"7f87 andi r24, 0xF7\n" +
"cff9 rjmp L27\n" +
"b584 in r24, 0x24\n" +
"778f andi r24, 0x7F\n" +
"c002 rjmp L28\n" +
"b584 in r24, 0x24\n" +
"7d8f andi r24, 0xDF\n" +
"bd84 L28: out 0x24, r24\n" +
"9508 ret \n" +
"91800090 lds r24, 0x0090\n" +
"778f andi r24, 0x7F\n" +
"c007 rjmp L29\n" +
"91800090 lds r24, 0x0090\n" +
"7d8f andi r24, 0xDF\n" +
"c003 rjmp L29\n" +
"91800090 lds r24, 0x0090\n" +
"7f87 andi r24, 0xF7\n" +
"93800090 L29: sts 0x0090, r24\n" +
"9508 ret \n" +
"918000c0 lds r24, 0x00C0\n" +
"778f andi r24, 0x7F\n" +
"c003 rjmp L30\n" +
"918000c0 lds r24, 0x00C0\n" +
"7d8f andi r24, 0xDF\n" +
"938000c0 L30: sts 0x00C0, r24\n" +
"9508 ret \n" +
"918000c2 lds r24, 0x00C2\n" +
"7f87 andi r24, 0xF7\n" +
"938000c2 sts 0x00C2, r24\n" +
"9508 L26: ret \n" +
"931f L111: push r17\n" +
"93cf push r28\n" +
"93df push r29\n" +
"2f28 mov r18, r24\n" +
"e030 ldi r19, 0x00\n" +
"01f9 movw r30, r18\n" +
"56e7 subi r30, 0x67\n" +
"4ffe sbci r31, 0xFE\n" +
"9184 lpm r24, Z\n" +
"01f9 movw r30, r18\n" +
"5ce1 subi r30, 0xC1\n" +
"4ffe sbci r31, 0xFE\n" +
"91d4 lpm r29, Z\n" +
"01f9 movw r30, r18\n" +
"59e4 subi r30, 0x94\n" +
"4ffe sbci r31, 0xFE\n" +
"91c4 lpm r28, Z\n" +
"23cc and r28, r28\n" +
"f0c9 breq L31\n" +
"2f16 mov r17, r22\n" +
"1181 cpse r24, r1\n" +
"940e0229 call L32\n" +
"2fec mov r30, r28\n" +
"e0f0 ldi r31, 0x00\n" +
"0fee add r30, r30\n" +
"1fff adc r31, r31\n" +
"5ae2 subi r30, 0xA2\n" +
"4ffe sbci r31, 0xFE\n" +
"91a5 lpm r26, Z+\n" +
"91b4 lpm r27, Z\n" +
"b78f in r24, 0x3f\n" +
"94f8 cli \n" +
"1111 cpse r17, r1\n" +
"c005 rjmp L33\n" +
"919c ld r25, X\n" +
"2fed mov r30, r29\n" +
"95e0 com r30\n" +
"23e9 and r30, r25\n" +
"c002 rjmp L34\n" +
"91ec L33: ld r30, X\n" +
"2bed or r30, r29\n" +
"93ec L34: st X, r30\n" +
"bf8f out 0x3f, r24\n" +
"91df L31: pop r29\n" +
"91cf pop r28\n" +
"911f pop r17\n" +
"9508 ret \n" +
"93cf L110: push r28\n" +
"93df push r29\n" +
"e090 ldi r25, 0x00\n" +
"01fc movw r30, r24\n" +
"5ce1 subi r30, 0xC1\n" +
"4ffe sbci r31, 0xFE\n" +
"9124 lpm r18, Z\n" +
"01fc movw r30, r24\n" +
"59e4 subi r30, 0x94\n" +
"4ffe sbci r31, 0xFE\n" +
"9184 lpm r24, Z\n" +
"2388 and r24, r24\n" +
"f161 breq L35\n" +
"e090 ldi r25, 0x00\n" +
"0f88 add r24, r24\n" +
"1f99 adc r25, r25\n" +
"01fc movw r30, r24\n" +
"5cef subi r30, 0xCF\n" +
"4ffe sbci r31, 0xFE\n" +
"91c5 lpm r28, Z+\n" +
"91d4 lpm r29, Z\n" +
"01fc movw r30, r24\n" +
"5ae2 subi r30, 0xA2\n" +
"4ffe sbci r31, 0xFE\n" +
"91a5 lpm r26, Z+\n" +
"91b4 lpm r27, Z\n" +
"1161 cpse r22, r1\n" +
"c009 rjmp L36\n" +
"b79f in r25, 0x3f\n" +
"94f8 cli \n" +
"8188 ld r24, Y\n" +
"9520 com r18\n" +
"2382 and r24, r18\n" +
"8388 st Y, r24\n" +
"91ec ld r30, X\n" +
"232e and r18, r30\n" +
"c00b rjmp L37\n" +
"3062 L36: cpi r22, 0x02\n" +
"f461 brne L38\n" +
"b79f in r25, 0x3f\n" +
"94f8 cli \n" +
"8138 ld r19, Y\n" +
"2f82 mov r24, r18\n" +
"9580 com r24\n" +
"2383 and r24, r19\n" +
"8388 st Y, r24\n" +
"91ec ld r30, X\n" +
"2b2e or r18, r30\n" +
"932c L37: st X, r18\n" +
"bf9f out 0x3f, r25\n" +
"c006 rjmp L35\n" +
"b78f L38: in r24, 0x3f\n" +
"94f8 cli \n" +
"81e8 ld r30, Y\n" +
"2b2e or r18, r30\n" +
"8328 st Y, r18\n" +
"bf8f out 0x3f, r24\n" +
"91df L35: pop r29\n" +
"91cf pop r28\n" +
"9508 ret \n" +
"3182 L487: cpi r24, 0x12\n" +
"f008 brcs L39\n" +
"5182 subi r24, 0x12\n" +
"2fe8 L39: mov r30, r24\n" +
"e0f0 ldi r31, 0x00\n" +
"5deb subi r30, 0xDB\n" +
"4ffe sbci r31, 0xFE\n" +
"91e4 lpm r30, Z\n" +
"9180007b lds r24, 0x007B\n" +
"fbe3 bst r30, #3\n" +
"2722 eor r18, r18\n" +
"f920 bld r18, #0\n" +
"e030 ldi r19, 0x00\n" +
"e095 ldi r25, 0x05\n" +
"0f22 L40: add r18, r18\n" +
"1f33 adc r19, r19\n" +
"959a dec r25\n" +
"f7e1 brne L40\n" +
"7d8f andi r24, 0xDF\n" +
"2b28 or r18, r24\n" +
"9320007b sts 0x007B, r18\n" +
"70e7 andi r30, 0x07\n" +
"64e0 ori r30, 0x40\n" +
"93e0007c sts 0x007C, r30\n" +
"9180007a lds r24, 0x007A\n" +
"6480 ori r24, 0x40\n" +
"9380007a sts 0x007A, r24\n" +
"9180007a L41: lds r24, 0x007A\n" +
"fd86 sbrc r24, #6\n" +
"cffc rjmp L41\n" +
"91800078 lds r24, 0x0078\n" +
"91200079 lds r18, 0x0079\n" +
"e090 ldi r25, 0x00\n" +
"2b92 or r25, r18\n" +
"9508 ret \n" +
"b73f L44: in r19, 0x3f\n" +
"94f8 cli \n" +
"918002fd lds r24, 0x02FD\n" +
"919002fe lds r25, 0x02FE\n" +
"91a002ff lds r26, 0x02FF\n" +
"91b00300 lds r27, 0x0300\n" +
"")

/*
        assembler.expect(avr,
            "          @stackmark base\n" +
            "920f      push    r0\n" +
            "921f      push    r1\n" +
            "          @stackmark locals\n" +
            // TODO
            "9801      ldr     r0, [sp, locals@1]\n" +
            "920f      push    r0\n" +
            //"9802      ldr     r0, [sp, locals@1]\n" +
            "900f      pop     r0\n" +
            "          @stackempty locals\n" +
            //"9901      ldr     r1, [sp, locals@1]\n" +
            //"9102      str     r1, [sp, base@0]\n" +
            "          @stackempty locals\n" +
            // AVR - does it have explicit access to SP?
            // SP is in I/O space 
            "b002      add     sp, #8\n" +
            "          @stackempty base\n")

        /* 
                expect(
                    "b090      sub sp, #4*16\n" +
                    "b010      add sp, #4*16\n"
                )
        
                expect(
                    "6261      .string \"abc\"\n" +
                    "0063      \n"
                )
        
                expect(
                    "6261      .string \"abcde\"\n" +
                    "6463      \n" +
                    "0065      \n"
                )
        
                expect(
                    "3042      adds r0, 0x42\n" +
                    "1c0d      adds r5, r1, #0\n" +
                    "d100      bne #0\n" +
                    "2800      cmp r0, #0\n" +
                    "6b28      ldr r0, [r5, #48]\n" +
                    "0200      lsls r0, r0, #8\n" +
                    "2063      movs r0, 0x63\n" +
                    "4240      negs r0, r0\n" +
                    "46c0      nop\n" +
                    "b500      push {lr}\n" +
                    "b401      push {r0}\n" +
                    "b402      push {r1}\n" +
                    "b404      push {r2}\n" +
                    "b408      push {r3}\n" +
                    "b520      push {r5, lr}\n" +
                    "bd00      pop {pc}\n" +
                    "bc01      pop {r0}\n" +
                    "bc02      pop {r1}\n" +
                    "bc04      pop {r2}\n" +
                    "bc08      pop {r3}\n" +
                    "bd20      pop {r5, pc}\n" +
                    "9003      str r0, [sp, #4*3]\n")
                    */
    }
}
