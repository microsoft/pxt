/* Docs:
https://riscv.org/specifications/
*/

namespace ts.pxtc.riscv {
    const regs: pxt.Map<number> = {
        "x0": 0,
        "zero": 0,
        "x1": 1,
        "ra": 1,
        "lr": 1,
        "x2": 2,
        "sp": 2,
        "x3": 3,
        "gp": 3, // global pointer
        "x4": 4,
        "tp": 4, // thread pointer
        "x5": 5,
        "t0": 5, // also alt-lr
        "x6": 6,
        "t1": 6,
        "x7": 7,
        "t2": 7,

        "x8": 8,
        "s0": 8,
        "fp": 8,
        "x9": 9,
        "s1": 9,

        "x10": 10,
        "a0": 10,
        "x11": 11,
        "a1": 11,
        "x12": 12,
        "a2": 12,
        "x13": 13,
        "a3": 13,
        "x14": 14,
        "a4": 14,
        "x15": 15,
        "a5": 15,
        "x16": 16,
        "a6": 16,
        "x17": 17,
        "a7": 17,

        "x18": 18,
        "s2": 18,
        "x19": 19,
        "s3": 19,
        "x20": 20,
        "s4": 20,
        "x21": 21,
        "s5": 21,
        "x22": 22,
        "s6": 22,
        "x23": 23,
        "s7": 23,
        "x24": 24,
        "s8": 24,
        "x25": 25,
        "s9": 25,
        "x26": 26,
        "s10": 26,
        "x27": 27,
        "s11": 27,

        "x28": 28,
        "t3": 28,
        "x29": 29,
        "t4": 29,
        "x30": 30,
        "t5": 30,
        "x31": 31,
        "t6": 31,
    }

    export class RV32Processor extends pxtc.assembler.AbstractProcessor {

        constructor() {
            super();

            this.addEnc("$rd", "REG", v => this.inrange(31, v, v << 7))
            this.addEnc("$rs1", "REG", v => this.inrange(31, v, v << 15))
            this.addEnc("$rs2", "REG", v => this.inrange(31, v, v << 20))
            this.addEnc("$rs2c", "REG", v => this.inrange(31, v, v << 2))
            this.addEnc("$rs1p", "REG8", v => this.inrange(7, v - 8, (v - 8) << 7))
            this.addEnc("$rs2p", "REG8", v => this.inrange(7, v - 8, (v - 8) << 2))

            // encode v[high:low] (inclusive as in spec) at bit number shift
            const E = (v: number, high: number, low: number, shift: number) =>
                ((v >> low) & ((1 << (high - low + 1)) - 1)) << shift

            this.addEnc("$I", "#-2048-2047", v => this.inrangeSigned(2047, v, v << 20))
            this.addEnc("$S", "#-2048-2047", v =>
                this.inrangeSigned(2047, v, E(v, 11, 5, 25) | E(v, 4, 0, 7)))
            this.addEnc("$U", "#<int32>", v =>
                this.inrangeSigned(1024 * 1024 - 1, v / (1 << 12), v))

            this.addEnc("$shift", "#0-31", v => this.inrange(31, v, E(v, 4, 0, 20)))

            this.addEnc("$Cshift", "#1-31", v => this.inrange(30, v - 1, E(v, 4, 0, 2)))
            this.addEnc("$CIW", "#0-252", v => this.inrange(63, v / 4,
                E(v, 5, 5, 12) | E(v, 4, 2, 4) | E(v, 7, 6, 2)))
            this.addEnc("$CSSW", "#0-252", v => this.inrange(63, v / 4,
                E(v, 5, 2, 9) | E(v, 7, 6, 7)))
            this.addEnc("$CLW", "#0-124", v => this.inrange(31, v / 4,
                E(v, 5, 3, 10) | E(v, 2, 2, 6) | E(v, 6, 6, 5)))
            this.addEnc("$CI16", "#-512-496", v => this.inrangeSigned(31, v / 16, v == 0 ? null :
                E(v, 4, 4, 6) | E(v, 6, 6, 5) | E(v, 8, 7, 3) | E(v, 5, 5, 2)))
            this.addEnc("$CI4", "#4-1020", v => this.inrange(254, v / 4 - 1,
                E(v, 5, 4, 11) | E(v, 9, 6, 7) | E(v, 2, 2, 6) | E(v, 3, 3, 5)))
            this.addEnc("$CI", "#-32-31", v => this.inrangeSigned(31, v, v == 0 ? null :
                E(v, 4, 0, 2) | E(v, 5, 5, 12)))
            this.addEnc("$CI4K", "#[17:12]", v => this.inrangeSigned(31, v / 4096, v == 0 ? null :
                E(v, 16, 12, 2) | E(v, 17, 17, 12)))

            this.addEnc("$lj", "LABEL", v => this.inrangeSigned(1024 * 1024 - 1, v / 2,
                E(v, 20, 20, 31) | E(v, 10, 1, 21) | E(v, 11, 11, 20) | E(v, 19, 12, 12)))
            this.addEnc("$lb", "LABEL", v => this.inrangeSigned(2047, v / 2,
                E(v, 12, 12, 31) | E(v, 10, 5, 25) | E(v, 4, 1, 8) | E(v, 11, 11, 7)))
            // the other part of it is auipc
            this.addEnc("$la32", "LABEL", v => (v & 4095) << 20)
            this.addEnc("$lc", "LABEL", v => this.inrangeSigned(1023, v / 2,
                E(v, 11, 11, 12) | E(v, 4, 4, 11) | E(v, 9, 8, 9) |
                E(v, 10, 10, 8) | E(v, 6, 6, 7) | E(v, 7, 7, 6) |
                E(v, 3, 1, 3) | E(v, 5, 5, 2)))
            this.addEnc("$lcb", "LABEL", v => this.inrangeSigned(127, v / 2,
                E(v, 8, 8, 12) | E(v, 4, 3, 10) |
                E(v, 7, 6, 5) | E(v, 2, 1, 3) | E(v, 5, 5, 2)))

            // base RV32I
            this.addI32("add        $rd, $rs1, $I", 0x13);
            this.addI32("add        $rd, $rs1, $rs2", 0x33);
            this.addI32("addi       $rd, $rs1, $I", 0x13);
            this.addI32("and        $rd, $rs1, $I", 0x7013);
            this.addI32("and        $rd, $rs1, $rs2", 0x7033);
            this.addI32("andi       $rd, $rs1, $I", 0x7013);
            this.addI32("auipc      $rd, $U", 0x17);
            this.addI32("beq        $rs1, $rs2, $lb", 0x63);
            this.addI32("beqz       $rs1, $lb", 0x63);
            this.addI32("bge        $rs1, $rs2, $lb", 0x5063);
            this.addI32("bgeu       $rs1, $rs2, $lb", 0x7063);
            this.addI32("bgez       $rs1, $lb", 0x5063);
            this.addI32("bgt        $rs2, $rs1, $lb", 0x4063);
            this.addI32("bgtu       $rs2, $rs1, $lb", 0x6063);
            this.addI32("bgtz       $rs2, $lb", 0x4063);
            this.addI32("ble        $rs2, $rs1, $lb", 0x5063);
            this.addI32("bleu       $rs2, $rs1, $lb", 0x7063);
            this.addI32("blez       $rs2, $lb", 0x5063);
            this.addI32("blt        $rs1, $rs2, $lb", 0x4063);
            this.addI32("bltu       $rs1, $rs2, $lb", 0x6063);
            this.addI32("bltz       $rs1, $lb", 0x4063);
            this.addI32("bne        $rs1, $rs2, $lb", 0x1063);
            this.addI32("bnez       $rs1, $lb", 0x1063);
            this.addI32("dret       ", 0x7b200073);
            this.addI32("ebreak     ", 0x100073);
            this.addI32("ecall      ", 0x73);
            this.addI32("fence      ", 0xff0000f);
            this.addI32("fence.i    ", 0x100f);
            this.addI32("hret       ", 0x20200073);
            this.addI32("j          $lj", 0x6f);
            this.addI32("jal        $lj", 0xef);
            this.addI32("jal        $rd, $lj", 0x6f);
            this.addI32("jalr       $rd, $I($rs1)", 0x67);
            this.addI32("jalr       $rd, $rs1", 0x67);
            this.addI32("jalr       $rd, $rs1, $I", 0x67);
            this.addI32("jalr       $I($rs1)", 0xe7);
            this.addI32("jalr       $rs1", 0xe7);
            this.addI32("jalr       $rs1, $I", 0xe7);
            this.addI32("jr         $I($rs1)", 0x67);
            this.addI32("jr         $rs1", 0x67);
            this.addI32("jr         $rs1, $I", 0x67);
            this.addI32("la         $rd, $la32", 0x13);
            this.addI32("lb         $rd, $la32", 0x3);
            this.addI32("lb         $rd, $I($rs1)", 0x3);
            this.addI32("lbu        $rd, $la32", 0x4003);
            this.addI32("lbu        $rd, $I($rs1)", 0x4003);
            this.addI32("lh         $rd, $la32", 0x1003);
            this.addI32("lh         $rd, $I($rs1)", 0x1003);
            this.addI32("lhu        $rd, $la32", 0x5003);
            this.addI32("lhu        $rd, $I($rs1)", 0x5003);
            this.addI32("li         $rd, $I", 0x13);
            this.addI32("lla        $rd, $la32", 0x13);
            this.addI32("lui        $rd, $U", 0x37);
            this.addI32("lw         $rd, $la32", 0x2003);
            this.addI32("lw         $rd, $I($rs1)", 0x2003);
            this.addI32("move       $rd, $rs1", 0x13);
            this.addI32("mret       ", 0x30200073);
            this.addI32("mv         $rd, $rs1", 0x13);
            this.addI32("neg        $rd, $rs2", 0x40000033);
            this.addI32("nop        ", 0x13);
            this.addI32("not        $rd, $rs1", 0xfff04013);
            this.addI32("or         $rd, $rs1, $I", 0x6013);
            this.addI32("or         $rd, $rs1, $rs2", 0x6033);
            this.addI32("ori        $rd, $rs1, $I", 0x6013);
            this.addI32("rdcycle    $rd", 0xc0002073);
            this.addI32("rdcycleh   $rd", 0xc8002073);
            this.addI32("rdinstret  $rd", 0xc0202073);
            this.addI32("rdinstreth $rd", 0xc8202073);
            this.addI32("rdtime     $rd", 0xc0102073);
            this.addI32("rdtimeh    $rd", 0xc8102073);
            this.addI32("ret        ", 0x8067);
            this.addI32("sb         $rs2, $la32, $rs1", 0x23);
            this.addI32("sb         $rs2, $S($rs1)", 0x23);
            this.addI32("sbreak     ", 0x100073);
            this.addI32("scall      ", 0x73);
            this.addI32("seqz       $rd, $rs1", 0x103013);
            this.addI32("sfence.vm  ", 0x10400073);
            this.addI32("sfence.vm  $rs1", 0x10400073);
            this.addI32("sfence.vma ", 0x12000073);
            this.addI32("sfence.vma $rs1", 0x12000073);
            this.addI32("sfence.vma $rs1, $rs2", 0x12000073);
            this.addI32("sgt        $rd, $rs2, $rs1", 0x2033);
            this.addI32("sgtu       $rd, $rs2, $rs1", 0x3033);
            this.addI32("sgtz       $rd, $rs2", 0x2033);
            this.addI32("sh         $rs2, $la32, $rs1", 0x1023);
            this.addI32("sh         $rs2, $S($rs1)", 0x1023);
            this.addI32("sll        $rd, $rs1, $shift", 0x1013);
            this.addI32("sll        $rd, $rs1, $rs2", 0x1033);
            this.addI32("slli       $rd, $rs1, $shift", 0x1013);
            this.addI32("slt        $rd, $rs1, $I", 0x2013);
            this.addI32("slt        $rd, $rs1, $rs2", 0x2033);
            this.addI32("slti       $rd, $rs1, $I", 0x2013);
            this.addI32("sltiu      $rd, $rs1, $I", 0x3013);
            this.addI32("sltu       $rd, $rs1, $I", 0x3013);
            this.addI32("sltu       $rd, $rs1, $rs2", 0x3033);
            this.addI32("sltz       $rd, $rs1", 0x2033);
            this.addI32("snez       $rd, $rs2", 0x3033);
            this.addI32("sra        $rd, $rs1, $shift", 0x40005013);
            this.addI32("sra        $rd, $rs1, $rs2", 0x40005033);
            this.addI32("srai       $rd, $rs1, $shift", 0x40005013);
            this.addI32("sret       ", 0x10200073);
            this.addI32("srl        $rd, $rs1, $shift", 0x5013);
            this.addI32("srl        $rd, $rs1, $rs2", 0x5033);
            this.addI32("srli       $rd, $rs1, $shift", 0x5013);
            this.addI32("sub        $rd, $rs1, $rs2", 0x40000033);
            this.addI32("sw         $rs2, $la32, $rs1", 0x2023);
            this.addI32("sw         $rs2, $S($rs1)", 0x2023);
            this.addI32("unimp      ", 0xc0001073);
            this.addI32("uret       ", 0x200073);
            this.addI32("wfi        ", 0x10500073);
            this.addI32("xor        $rd, $rs1, $I", 0x4013);
            this.addI32("xor        $rd, $rs1, $rs2", 0x4033);
            this.addI32("xori       $rd, $rs1, $I", 0x4013);

            // M extension
            this.addI32("div        $rd, $rs1, $rs2", 0x2004033);
            this.addI32("divu       $rd, $rs1, $rs2", 0x2005033);
            this.addI32("mul        $rd, $rs1, $rs2", 0x2000033);
            this.addI32("mulh       $rd, $rs1, $rs2", 0x2001033);
            this.addI32("mulhsu     $rd, $rs1, $rs2", 0x2002033);
            this.addI32("mulhu      $rd, $rs1, $rs2", 0x2003033);
            this.addI32("rem        $rd, $rs1, $rs2", 0x2006033);
            this.addI32("remu       $rd, $rs1, $rs2", 0x2007033);

            // C extension
            this.addI16("add        sp, sp, $CI16", 0x6101);
            this.addI16("add        $rs2p, sp, $CI4", 0x0);
            this.addI16("add        $rd, $rd, $rs2c", 0x9002);
            this.addI16("add        $rd, $rd, $CI", 0x1);
            this.addI16("add        $rd, $rs2c, $rd", 0x9002);
            this.addI16("addi       sp, sp, $CI16", 0x6101);
            this.addI16("addi       $rs2p, sp, $CI4", 0x0);
            this.addI16("addi       $rd, $rd, $CI", 0x1);
            this.addI16("and        $rs1p, $rs2p, $rs1p", 0x8c61);
            this.addI16("and        $rs1p, $rs1p, $CI", 0x8801);
            this.addI16("and        $rs1p, $rs1p, $rs2p", 0x8c61);
            this.addI16("andi       $rs1p, $rs1p, $CI", 0x8801);
            this.addI16("beqz       $rs1p, $lcb", 0xc001);
            this.addI16("bnez       $rs1p, $lcb", 0xe001);
            this.addI16("c.addi16sp sp, $CI16", 0x6101);
            this.addI16("c.addi4spn $rs2p, sp, $CI4", 0x0);
            this.addI16("ebreak     ", 0x9002);
            this.addI16("j          $lc", 0xa001);
            this.addI16("jal        $lc", 0x2001);
            this.addI16("jalr       $rd", 0x9002);
            this.addI16("jr         $rd", 0x8002);
            this.addI16("li         $rd, $CI", 0x4001);
            this.addI16("li         $rd, $CI", 0x6001);
            this.addI16("lui        $rd, $CI4K", 0x6001);
            this.addI16("lw         $rs2p, $CLW($rs1p)", 0x4000);
            this.addI16("lw         $rd, $CIW(sp)", 0x4002);
            this.addI16("move       $rd, $rs2c", 0x8002);
            this.addI16("mv         $rd, $rs2c", 0x8002);
            this.addI16("nop        ", 0x1);
            this.addI16("or         $rs1p, $rs2p, $rs1p", 0x8c41);
            this.addI16("or         $rs1p, $rs1p, $rs2p", 0x8c41);
            this.addI16("ret        ", 0x8082);
            this.addI16("sbreak     ", 0x9002);
            this.addI16("sll        $rd, $rd, $Cshift", 0x2);
            this.addI16("slli       $rd, $rd, $Cshift", 0x2);
            this.addI16("sra        $rs1p, $rs1p, $Cshift", 0x8401);
            this.addI16("srai       $rs1p, $rs1p, $Cshift", 0x8401);
            this.addI16("srl        $rs1p, $rs1p, $Cshift", 0x8001);
            this.addI16("srli       $rs1p, $rs1p, $Cshift", 0x8001);
            this.addI16("sub        $rs1p, $rs1p, $rs2p", 0x8c01);
            this.addI16("sw         $rs2c, $CSSW(sp)", 0xc002);
            this.addI16("sw         $rs2p, $CLW($rs1p)", 0xc000);
            this.addI16("unimp      ", 0x0);
            this.addI16("xor        $rs1p, $rs2p, $rs1p", 0x8c21);
            this.addI16("xor        $rs1p, $rs1p, $rs2p", 0x8c21);

            // need to figure out the temp register - x6 is nothing else
            this.addI32("tail       $la32", 0x67);
            this.addI32("call       $la32", 0x67 | (1 << 7));

            // TODO
            // li expansion

            // handled specially - 32 bit instruction
            //this.addInst("bl    $lb", 0xf000, 0xf800, true);
            // this is normally emitted as 'b' but will be emitted as 'bl' if needed
            //this.addInst("bb    $lb", 0xe000, 0xf800, true);

            // this will emit as PC-relative LDR or ADDS
            //this.addInst("ldlit   $r5, $i32", 0x4800, 0xf800);
        }

        private addI32(fmt: string, code: number) { }
        private addI16(fmt: string, code: number) { }

        public toFnPtr(v: number, baseOff: number, lbl: string) {
            return (v + baseOff);
        }

        public wordSize() {
            return 4
        }

        public is32bit(i: assembler.Instruction) {
            // TODO
            return i.name == "bl" || i.name == "bb";
        }

        public postProcessAbsAddress(f: assembler.File, v: number) {
            // Thumb addresses have last bit set, but we are ourselves always
            // in Thumb state, so to go to ARM state, we signal that with that last bit
            v ^= 1
            v -= f.baseOffset
            return v
        }

        public emit32(v0: number, v: number, actual: string): pxtc.assembler.EmitResult {
            let isBLX = v % 2 ? true : false
            if (isBLX) {
                v = (v + 1) & ~3
            }
            let off = v >> 1
            assert(off != null)
            // Range is +-4M (i.e., 2M instructions)
            if ((off | 0) != off ||
                !(-2 * 1024 * 1024 < off && off < 2 * 1024 * 1024))
                return pxtc.assembler.emitErr("jump out of range", actual);

            // note that off is already in instructions, not bytes
            let imm11 = off & 0x7ff
            let imm10 = (off >> 11) & 0x3ff

            return {
                opcode: (off & 0xf0000000) ? (0xf400 | imm10) : (0xf000 | imm10),
                opcode2: isBLX ? (0xe800 | imm11) : (0xf800 | imm11),
                stack: 0,
                numArgs: [v],
                labelName: actual
            }
        }

        public expandLdlit(f: assembler.File): void {
            // TODO
        }

        public getAddressFromLabel(f: assembler.File, i: assembler.Instruction, s: string, wordAligned = false): number {
            let l = f.lookupLabel(s);
            if (l == null) return null;
            let pc = f.location() + 4
            if (wordAligned) pc = pc & 0xfffffffc
            return l - pc;
        }

        public registerNo(actual: string) {
            if (!actual) return null;
            actual = actual.toLowerCase()
            const r = regs[actual]
            if (r === undefined)
                return null
            return r
        }

        public testAssembler() {
            assembler.expectError(this, "...");
            assembler.expect(this,
                "4291      cmp     r1, r2\n" +
                "d100      bne     l6\n" +
                "e000      b       l8\n" +
                "1840  l6: adds    r0, r0, r1\n" +
                "4718  l8: bx      r3\n")
        }
    }


}
