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
        public emit32(v0: number, v: number, actual: string): pxtc.assembler.EmitResult {
            // TODO: we can have odd addresses in AVR
            // if (v % 2) return pxtc.assembler.emitErr("uneven target label?", actual);
            let off = v // / 2
            assert(off != null)
            if ((off | 0) != off ||
                // 16-bit only for now (so, can address 128k)
                !(0 <= off && off < 65536))
                return pxtc.assembler.emitErr("jump out of range", actual);

            // note that off is already in instructions, not bytes
            let imm = off & 0xffff

            return {
                opcode: v0,
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
            let rel = l - pc
            // console.log("lookup =", l, " pc+2 =", pc, " rel = ", rel);
            return rel;
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

            // TODO: revisit labelling
            this.addEnc("$la", "LABEL", v => this.inrange(255, v >> 1, v >> 1)).isWordAligned = true;
            this.addEnc("$lb", "LABEL", v => this.inrangeSigned(127, v >> 1, v >> 1) << 3)
            this.addEnc("$lb11", "LABEL", v => this.inrangeSigned(2047, v >> 1, v >> 1))

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
            this.addInst("call  $lb", 0x940e, 0xffff, "CALL");
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
            this.addInst("jmp  $lb", 0x940c, 0xffff, "JMP")
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
            "9508 ret \n")


        assembler.expect(avr,
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
            "9508 ret \n")

        assembler.expect(avr,
            ".global\n" +
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
            "940e0229 call 0x0229\n" +
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
            "9508 ret \n")

    assembler.expect(avr,
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
        "f161 breq L35\n" +      // 01 0110 0 = 12+32 = 44
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
        "9508 ret \n")

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
