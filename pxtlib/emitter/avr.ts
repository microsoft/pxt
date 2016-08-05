/* Docs:
    *
    * Atmel AVR 8-bit Instruction Set Manual
    *  http://www.atmel.com/Images/Atmel-0856-AVR-Instruction-Set-Manual.pdf
    *  
    */

namespace ts.pxt.avr {
   
    export class AVRProcessor extends assembler.EncodersInstructions {
        constructor() {
            super();

            // Registers
            // $Rd - bits 8:7:6:5:4 (r0)
            // $Rr - bits 9:3:2:1:0 (r1)
            this.addEnc("$r0", "R0-31", v => this.inrange(31, v, v<<4))
            this.addEnc("$r1", "R0-31", v => this.inrange(31, v, (v & 15) | ((v & 16) << 5)))
            this.addEnc("$r2", "R0-4", 
                (v:number) => { let r = this.inseq([24,26,28,30],v)
                                return r == null ? null : r << 4 })
            this.addEnc("$r3", "R0-16-31", v => this.inminmax(16, 31, v, (v-16) << 4))
            this.addEnc("$r4", "R0-7", v => this.inrange(7,v,v<<4))
            this.addEnc("$r5", "R0-7", v => this.inrange(7,v,v))
            this.addEnc("$r6", "R0-31", v => this.inrange(31,v,v<<5|v))
            this.addEnc("$r7", "R0-31", v => this.inrange(31, v, v<<3))
            this.addEnc("$r8", "Reven", (v:number) => v&0x1 ? null : (v >> 1)<<4)
            this.addEnc("$r9", "Reven", (v:number) => v&0x1 ? null : (v >> 1))
            this.addEnc("$r10", "R0-16-23", v => this.inminmax(16, 23, v, (v-16) << 4))
            this.addEnc("$r11", "R0-16-23", v => this.inminmax(16, 23, v, v-16))
            this.addEnc("$r12", "R0-16-31", v => this.inminmax(16, 31, v, v-16))

            // Immediates:
            this.addEnc("$i0", "#0-63", v => this.inrange(63, v,  (v & 0x0f) | (v & 0x30) << 2))
            this.addEnc("$i1", "#0-255", v => this.inrange(255, v,  (v & 0x0f) | (v &0xf0) << 4))
            this.addEnc("$i2", "#0-127", v => this.inrange(127, v,  v << 3))
            this.addEnc("$i3", "#0-255", v => this.inrange(255, v,  (~v & 0x0f) | (~v &0xf0) << 4))
            this.addEnc("$i4", "#0-15", v => this.inrange(15, v,  v << 4))
            this.addEnc("$i5", "#0-63", v => this.inrange(63, v,  (v & 0x0f) | (v & 0x30) << 5))
            this.addEnc("$i6", "#0-127", v => this.inrange(127, v,  (v & 0x0f) | (v &0x70) << 4))
            this.addEnc("$i7", "#0-4095", v => this.inrange(4095, v,  v))

            this.addEnc("$la", "LABEL", v => this.inrange(255, v / 4, v >> 2)).isWordAligned = true;
            this.addEnc("$lb", "LABEL", v => this.inrangeSigned(127, v / 2, v >> 1))
            this.addEnc("$lb11", "LABEL", v => this.inrangeSigned(1023, v / 2, v >> 1))


            this.addInst("adc   $r0, $r1", 0x1C00, 0xfC00);
            this.addInst("add   $r0, $r1", 0x0C00, 0xfC00);
            // deviates from broken syntax in PDF
            this.addInst("adiw  $r2, $i0", 0x9600, 0xff00);
            this.addInst("and   $r0, $r1", 0x2000, 0xfC00);
            this.addInst("andi  $r3  $i1", 0x7000, 0xf000);
            this.addInst("asr   $r0",      0x9405, 0xfe0f);
            this.addInst("bclr  $r4",      0x9488, 0xff8f);
            this.addInst("bld   $r0  $r5", 0xf800, 0xfe08); 
            this.addInst("brbc  $r5  $i2", 0xf400, 0xfc00);
            this.addInst("brbs  $r5  $i2", 0xf000, 0xfc00);
            this.addInst("brcc  $i2",      0xf400, 0xfc07);
            this.addInst("brcs  $i2",      0xf000, 0xfc07);
            this.addInst("break",          0x9598, 0xffff);
            this.addInst("breq  $i2",      0xf001, 0xfc07);
            this.addInst("brge  $i2",      0xf404, 0xfc07);
            this.addInst("brhc  $i2",      0xf405, 0xfc07);
            this.addInst("brhs  $i2",      0xf005, 0xfc07);
            this.addInst("brid  $i2",      0xf407, 0xfc07);
            this.addInst("brie  $i2",      0xf007, 0xfc07);
            // conflict with brbs?
            this.addInst("brlo  $i2",      0xf000, 0xfc07);
            this.addInst("brlt  $i2",      0xf004, 0xfc07);
            this.addInst("brmi  $i2",      0xf002, 0xfc07);
            this.addInst("brne  $i2",      0xf401, 0xfc07);
            this.addInst("brpl  $i2",      0xf402, 0xfc07);
            // error in doc? - this has same opcode as brcc
            this.addInst("brsh  $i2",      0xf400, 0xfc07);
            this.addInst("brtc  $i2",      0xf406, 0xfc07);
            this.addInst("brts  $i2",      0xf006, 0xfc07);
            this.addInst("brvc  $i2",      0xf403, 0xfc07);
            this.addInst("brvs  $i2",      0xf003, 0xfc07);
            this.addInst("bset  $r4",      0x9408, 0xff8f);
            this.addInst("bst   $r0 $r5",  0xfa00, 0xfe08);
            // call - 32 bit
            this.addInst("cbi   $r7 $r5",  0x9800, 0xff00);
            this.addInst("cbr   $r3 $i3",  0x7000, 0xf000);
            this.addInst("clc",            0x9488, 0xffff);
            this.addInst("clh",            0x94d8, 0xffff);
            this.addInst("cli",            0x94f8, 0xffff);
            this.addInst("cln",            0x94a8, 0xffff);
            this.addInst("clr $r6",        0x2400, 0xfc00);
            this.addInst("cls",            0x94c8, 0xffff);
            this.addInst("clt",            0x94e8, 0xffff);
            this.addInst("clv",            0x94b8, 0xffff);
            this.addInst("clz",            0x9498, 0xffff);
            this.addInst("com   $r0",      0x9400, 0xfe0f);
            this.addInst("cp    $r0, $r1", 0x1400, 0xfC00);
            this.addInst("cpc   $r0, $r1", 0x0400, 0xfC00);
            this.addInst("cpi   $r3  $i1", 0x3000, 0xf000);
            this.addInst("cpse  $r0, $r1", 0x1000, 0xfC00);
            this.addInst("dec   $r0",      0x940a, 0xfe0f);
            this.addInst("des   $i4",      0x940b, 0xff0f);
            this.addInst("eicall",         0x9519, 0xffff);
            this.addInst("eijmp",          0x9419, 0xffff);
            this.addInst("elpm",           0x95d8, 0xffff);
            this.addInst("elpm  $r0, Z0",  0x9006, 0xfe0f);
            this.addInst("elpm  $r0, Z+0", 0x9007, 0xfe0f);
            this.addInst("eor   $r0, $r1", 0x2400, 0xfC00);
            this.addInst("fmul   $r10, $r11", 0x0308, 0xff88);
            this.addInst("fmuls  $r10, $r11", 0x0380, 0xff88);
            this.addInst("fmulsu $r10, $r11", 0x0388, 0xff88);
            this.addInst("icall",          0x9509, 0xffff);
            this.addInst("ijmp",           0x9409, 0xffff);
            this.addInst("in    $r0, $i5", 0xb000, 0xf800);
            this.addInst("inc   $r0",      0x9403, 0xfe0f);
            // jmp - 32 bit
            this.addInst("lac   Z, $r0",   0x9206, 0xfe0f);
            this.addInst("las   Z, $r0",   0x9205, 0xfe0f);
            this.addInst("lat   Z, $r0",   0x9207, 0xfe0f);
            this.addInst("ld    $r0, X",   0x9006, 0xfe0f);
            this.addInst("ld    $r0, X+",  0x9007, 0xfe0f);
            this.addInst("ld    $r0, -X",  0x900e, 0xfe0f);
            this.addInst("ld    $r0, Y",   0x8008, 0xfe0f);
            this.addInst("ld    $r0, Y+",  0x9009, 0xfe0f);
            this.addInst("ld    $r0, -Y",  0x900a, 0xfe0f);
            // ldy(iv)
            this.addInst("ld    $r0, Z",   0x8000, 0xfe0f);
            this.addInst("ld    $r0, Z+",  0x9001, 0xfe0f);
            this.addInst("ld    $r0, -Z",  0x9002, 0xfe0f);
            // ldz(iv)
            this.addInst("ldi   $r3  $i1", 0xe000, 0xf000);
            // lds - 32 bit
            this.addInst("lds   $r3  $i6", 0xa000, 0xf800);
            this.addInst("lpm",            0x95a8, 0xffff);
            this.addInst("lpm2  $r0",      0x9004, 0xfe0f);
            this.addInst("lpm3  $r0",      0x9005, 0xfe0f);
            this.addInst("lsl $r6",        0x0c00, 0xfc00);
            this.addInst("lsr $r0",        0x9406, 0xfe0f);
            this.addInst("mov   $r0, $r1", 0x2C00, 0xfC00);
            this.addInst("movw  $r8, $r9", 0x0100, 0xff00);
            this.addInst("mul   $r0, $r1", 0x9400, 0xfC00);
            this.addInst("muls  $r3, $r12", 0x0200, 0xff00);
            this.addInst("mulsu $r10, $r11", 0x0300, 0xff88);
            this.addInst("neg $r0",        0x9401, 0xfe0f);
            this.addInst("nop",            0x0000, 0xffff);
            this.addInst("or    $r0, $r1", 0x2800, 0xfC00);  
            this.addInst("ori   $r3  $i1", 0x6000, 0xf000);
            this.addInst("out   $r0, $i5", 0xb800, 0xf800);
            this.addInst("pop $r0",        0x900f, 0xfe0f);
            this.addInst("push $r0",       0x920f, 0xfe0f);  
            this.addInst("rcall $i7",      0xd000, 0xf000); 
            this.addInst("ret",            0x9508, 0xffff);
            this.addInst("reti",           0x9518, 0xffff);
            this.addInst("rjmp $i7",       0xc000, 0xf000); 
            this.addInst("rol $r6",        0x1c00, 0xfc00);
            this.addInst("lor $r0",        0x9407, 0xfe0f);
            this.addInst("sbc   $r0, $r1", 0x0800, 0xfC00);
            this.addInst("sbci  $r3  $i1", 0x4000, 0xf000);
            this.addInst("sbi   $r7 $r5",  0x9a00, 0xff00);
            this.addInst("sbic  $r7 $r5",  0x9900, 0xff00);
            this.addInst("sbis  $r7 $r5",  0x9b00, 0xff00);
            this.addInst("sbiw  $r2, $i0", 0x9700, 0xff00);
            this.addInst("sbr   $r3  $i1", 0x6000, 0xf000);
            this.addInst("sbrc  $r0, $r5", 0xfc00, 0xfe08);
            this.addInst("sbrs  $r0, $r5", 0xfe00, 0xfe08)
            this.addInst("sec",            0x9408, 0xffff);
            this.addInst("seh",            0x9458, 0xffff);
            this.addInst("sei",            0x9478, 0xffff);
            this.addInst("sen",            0x9428, 0xffff);
            this.addInst("sec",            0x9408, 0xffff);
            this.addInst("ser $r3",        0xef0f, 0xff0f);
            this.addInst("ses",            0x9448, 0xffff);
            this.addInst("set",            0x9468, 0xffff);
            this.addInst("sev",            0x9438, 0xffff);
            this.addInst("sez",            0x9418, 0xffff);
            this.addInst("sleep",          0x9588, 0xffff);
            this.addInst("spm",            0x95e8, 0xffff);
            this.addInst("st    X, $r0",   0x920c, 0xfe0f);
            this.addInst("st    X+, $r0",  0x920d, 0xfe0f);
            this.addInst("st    -X, $r0",  0x920e, 0xfe0f);
            this.addInst("st    Y, $r0",   0x8208, 0xfe0f);
            this.addInst("st    Y+, $r0",  0x9209, 0xfe0f);
            this.addInst("st    -Y, $r0",  0x920a, 0xfe0f);
            // missing st (iv)
            this.addInst("st    Z, $r0",   0x8200, 0xfe0f);
            this.addInst("st    Z+, $r0",  0x9201, 0xfe0f);
            this.addInst("st    -Z, $r0",  0x9202, 0xfe0f);
            // missing st (iv)
            // std - 32 bit
            this.addInst("sts   $i6, $r3", 0xa800, 0xf800);
            this.addInst("sub   $r0, $r1", 0x1800, 0xfC00);
            this.addInst("subi  $r3  $i1", 0x5000, 0xf000);
            this.addInst("swap  $r0",      0x9402, 0xfe0f);
            this.addInst("tst   $r6",      0x2004, 0xfc00);
            this.addInst("wdr",            0x95a8, 0xffff);
            this.addInst("xch   Z, $r0",   0x9204, 0xfe0F);
        }

    }

    export function test() {
        let avr = new AVRProcessor();

        assembler.expect(avr,
            "0c00      lsl     r0\n" +
            "920f      push    r0\n" +
            "e604      ldi     r16, #100        ; 0x64\n" +
            "903f      pop     r3\n" +
            "0000      .balign 4\n" +
            "e6c0      .word   -72000\n" +
            "fffe\n")

/*
        expect(
            "4291      cmp     r1, r2\n" +
            "d100      bne     l6\n" +
            "e000      b       l8\n" +
            "1840  l6: adds    r0, r0, r1\n" +
            "4718  l8: bx      r3\n")

        expect(
            "          @stackmark base\n" +
            "b403      push    {r0, r1}\n" +
            "          @stackmark locals\n" +
            "9801      ldr     r0, [sp, locals@1]\n" +
            "b401      push    {r0}\n" +
            "9802      ldr     r0, [sp, locals@1]\n" +
            "bc01      pop     {r0}\n" +
            "          @stackempty locals\n" +
            "9901      ldr     r1, [sp, locals@1]\n" +
            "9102      str     r1, [sp, base@0]\n" +
            "          @stackempty locals\n" +
            "b002      add     sp, #8\n" +
            "          @stackempty base\n")

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
