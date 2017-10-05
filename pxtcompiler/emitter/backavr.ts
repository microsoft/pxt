// Make sure backbase.ts is loaded before us, otherwise 'extends AssemblerSnippets' fails at runtime
/// <reference path="backbase.ts"/>

namespace ts.pxtc {

    // AVR:
    // - 32 8-bit registers (R0 - R31), with mapping to data addresses 0x0000 - 0x001F
    //   - X-register R26 (low), R27 (high)
    //   - Y-register R28 (low), R29 (high), Frame Pointer (FP)
    //   - Z-register R30 (low), R31 (high), use for indirect addressing

    // - 64 I/0 registers ($00-$3F), with mapping to data addresses 0x0020 - 0x005F
    // - 160 Ext I/O registers (0x0060-0x00FF)
    // - Internal SRAM 0x100-

    // - SP: special register in I/O space (0x3D, 0x3E)
    // - instructions that use SP
    //   - PUSH Rr (dec SP by 1) 
    //   - CALL, ICALL, RCALL (dec by 2 - 16 bit code pointer)
    //   - POP Rd (inc SP by 1)
    //   - RET, RETI (inc by 2 - 16 bit code pointer)

    // - in AVR, 0x0060 is lowest address for the stack
    // - stack grows from high (RAMEND) to low (top of stack)

    // Text below from http://gcc.gnu.org/wiki/avr-gcc 

    // R0 is used as scratch register that need not to be restored after its usage. 
    // R1 always contains zero.

    /* 
     * Call-Used Registers
     * 
     * R18–R27, R30, R31. These GPRs are call clobbered. 
     * An ordinary function may use them without restoring the contents. 
     */

    /*
     * Call-Saved Registers
     * 
     * R2–R17, (R28, R29) FP 
     * The remaining GPRs are call-saved, i.e. a function that uses such a registers must restore its original content. 
     * This applies even if the register is used to pass a function argument. 
     * R1 The zero-register is implicity call-saved (implicit because R1 is a fixed register). 
     */

    /*
     * Frame layout
     * 
     * Y-register (R28-R29) is frame pointer
     * 
     * Pseudos that don't get a hard register will be put into a stack slot and loaded / stored as needed. 
     * The stack grows downwards.
     * Stack pointer and frame pointer are not aligned, i.e. 1-byte aligned. 
     * After the function prologue, the frame pointer will point one byte below the stack frame, 
     * i.e. Y+1 points to the bottom of the stack frame. 
     */

    /*
     * Calling convention
     * 
     * - An argument is passed either completely in registers or completely in memory. 
     * - To find the register where a function argument is passed, follow this procedure:
     *   0. X = 26
     *   1. If the argument SIZE is an odd number of bytes, round up SIZE to the next even number. 
     *   2. X = X -SIZE  
     *   3. If the new X is at least 8 and the size of the object is non-zero, 
     *      then the low-byte of the argument is passed in RX. Subsequent bytes of the argument 
     *      are passed in the subsequent registers, i.e. in increasing register numbers. 
     *   4. If X < 8 or the SIZE = 0, the argument will be passed in memory. 
     *   5. If the current argument is passed in memory, stop the procedure: All subsequent arguments will also be passed in memory. 
     *   6. If there are arguments left, goto 1. and proceed with the next argument. 
     *
     * - Return values with a size of 1 byte up to and including a size of 8 bytes will be returned in registers. 
     * - Return values whose size is outside that range will be returned in memory. 
     * - If the return value of a function is returned in registers, the same registers are used as if 
     *   the value was the first parameter of a non-varargs function. 
     * For example, an 8-bit value is returned in R24 and an 32-bit value is returned R22...R25. 
     */

    // for now, everything is 16-bit (word)
    export class AVRSnippets extends AssemblerSnippets {

        nop() { return "nop" }
        reg_gets_imm(reg: string, imm: number) {
            let imm_lo = imm & 0xff
            let imm_hi = (imm & 0xff00) >> 8
            return `
    ldi ${this.rmap_lo[reg]}, #${imm_lo}
    ldi ${this.rmap_hi[reg]}, #${imm_hi}`
        }
        push_fixed(regs: string[]) {
            let res = ""
            regs.forEach(r => {
                res = res + `\npush ${this.rmap_hi[r]}\npush ${this.rmap_lo[r]}`
            });
            res += `
    @dummystack ${regs.length}`
            return res
        }
        pop_fixed(regs: string[]) {
            let res = ""
            regs.forEach(r => {
                res = res + `\npop ${this.rmap_lo[r]}\npop ${this.rmap_hi[r]}`
            });
            res += `
    @dummystack -${regs.length}`
            return res
        }

        proc_setup(numlocals: number, main?: boolean) {
            let r = main ? "eor r1, r1" : ""
            r += `
    push r29
    push r28`
            for (let i = 0; i < numlocals; ++i)
                r += `
    push r1
    push r1`

            // setup frame pointer        
            r += `
    @dummystack ${numlocals + 1}
    in r28, 0x3d
    in r29, 0x3e
    subi r28, #5
    sbci r29, #0`

            return r
        }

        proc_return() {
            // pop frame pointer and return
            return `
    pop r28
    pop r29
    @dummystack -1
    ret`
        }
        debugger_hook(lbl: string) { return "eor r1, r1" }
        debugger_bkpt(lbl: string) { return "eor r1, r1" }
        breakpoint() { return "eor r1, r1" }

        push_local(reg: string) {
            return `
    push ${this.rmap_hi[reg]}
    push ${this.rmap_lo[reg]}
    @dummystack 1`
        }
        push_locals(n: number) {
            return `no stack alignment on AVR`
        }
        pop_locals(n: number) {
            if (n * 2 <= 5) {
                return Util.range(n * 2).map(k => "pop r0").join("\n    ") + `\n    @dummystack -${n}`
            }
            let n0 = n
            let r = `
    in	r30, 0x3d
    in	r31, 0x3e
`
            while (n > 0) {
                // adiw maxes out at #63
                let k = Math.min(n, 31)
                r += `    adiw	r30, #2*${k}\n`
                n -= k
            }
            r += `
    out	0x3d, r30
    out	0x3e, r31
    @dummystack -${n0}`
            return r
        }
        unconditional_branch(lbl: string) { return "jmp " + lbl }
        beq(lbl: string) { return "breq " + lbl }
        bne(lbl: string) { return "brne " + lbl }

        cmp(reg1: string, reg2: string) {
            let reg1_lo = this.rmap_lo[reg1]
            let reg1_hi = this.rmap_hi[reg1]
            let reg2_lo = this.rmap_lo[reg2]
            let reg2_hi = this.rmap_hi[reg2]
            return `
    cp ${reg1_lo}, ${reg2_lo}
    cpc ${reg1_hi}, ${reg2_hi}`
        }

        cmp_zero(reg: string) {
            return `
    cp ${this.rmap_lo[reg]}, r1
    cpc ${this.rmap_hi[reg]}, r1`
        }

        // load_reg_src_off is load/store indirect
        // word? - does offset represent an index that must be multiplied by word size?
        // inf?  - control over size of referenced data
        // str?  - true=Store/false=Load
        load_reg_src_off(reg: string, src: string, off: string, word?: boolean, store?: boolean, inf?: BitSizeInfo) {
            let tgt_reg = ""
            let prelude = ""
            let _this = this

            function maybe_spill_it(new_off: number) {
                assert(!isNaN(new_off))
                if (0 <= new_off && new_off <= 62) {
                    off = new_off.toString()
                } else {
                    if (tgt_reg == "Y") {
                        prelude += `
    movw r30, r28
`               }
                    prelude += `
    ; += ${new_off}`

                    // we don't have a scratch register to store the constant...
                    while (new_off > 0) {
                        let k = Math.min(new_off, 63)
                        prelude += `
    adiw r30, #${k}`
                        new_off -= k
                    }
                    off = "0"
                    tgt_reg = "Z"
                }
            }

            let mm = /^(\d+):(\d+)/.exec(off)
            if (mm) {
                let ridx = parseInt(mm[1])
                let height = parseInt(mm[2])
                let idx = height - ridx
                if (idx <= 3) {
                    off = "locals@-" + idx
                    word = false
                }
            }

            // different possibilities for src: r0, r5, sp, r6
            // any indirection we want to do using Y+C, Z+C (recall Y=FP)
            if (src != "sp") {
                prelude = `
    movw r30, ${this.rmap_lo[src]}`
                tgt_reg = "Z"
            } else {
                tgt_reg = "Y" // Y -> FP = r29
            }


            // different possibilities for off
            if (word || off[0] == "#") {
                let new_off = 0
                if (word) {
                    // word true implies off is an integer
                    new_off = 2 * parseInt(off)
                } else {
                    // word false means we have #integer
                    new_off = parseInt(off.slice(1))
                }
                assert(!isNaN(new_off), "off=" + off + "/" + word)
                if (src == "sp") {
                    new_off += 1 // SP points 1 word ahead
                    prelude += `
    in  r30, 0x3d
    in  r31, 0x3e`
                }
                maybe_spill_it(new_off)
            } else if (off[0] == "r") {
                if (tgt_reg == "Y") {
                    prelude += `
    movw r30, r28`
                }
                prelude += `
    add r30, ${this.rmap_lo[off]}
    adc r31, ${this.rmap_hi[off]}`
                off = "0"
            } else {
                assert(tgt_reg == "Y")
                let new_off = -100000
                let m = /^args@(\d+):(\d+)$/.exec(off)
                if (m) {
                    let argIdx = parseInt(m[1])
                    let baseStack = parseInt(m[2]) + 1 // we have one more word on top of what ARM has
                    new_off = 2 * (argIdx + baseStack)
                }
                m = /^locals@([\-\d]+)$/.exec(off)
                if (m) {
                    let localIdx = parseInt(m[1])
                    new_off = 2 * localIdx
                }
                prelude += `\n; ${off}`
                new_off += 6 // FP points 3 words ahead of locals
                assert(new_off >= 0)
                maybe_spill_it(new_off)
            }
            if (store) {
                return `
    ${prelude}
    std ${tgt_reg}, ${off}, ${this.rmap_lo[reg]}
    std ${tgt_reg}, ${off}+1, ${this.rmap_hi[reg]}`
            } else {
                return `
    ${prelude}
    ldd ${this.rmap_lo[reg]}, ${tgt_reg}, ${off}
    ldd ${this.rmap_hi[reg]}, ${tgt_reg}, ${off}+1`
            }
        }

        rt_call(name: string, r0: string, r1: string) {
            assert(r0 == "r0" && r1 == "r1")
            if (this.inst_lo[name] == "Number_::") {
                return this.call_lbl("Number_::" + name)
            } else {
                return `
    ${this.inst_lo[name]} r24, r22
    ${this.inst_hi[name]} r25, r23`
            }
        }

        call_lbl(lbl: string) { return "call " + lbl }
        call_reg(reg: string) {
            return `
    movw r30, ${this.rmap_lo[reg]}
    icall`
        }

        // no virtuals for now
        vcall(mapMethod: string, isSet: boolean, vtableShift: number) { assert(false); return "" }
        prologue_vtable(arg_index: number, vtableShift: number) { assert(false); return "" }

        method_call(procid: ir.ProcId, topExpr: ir.Expr) {
            let res = this.load_reg_src_off("r0", "sp", "#2*" + (topExpr.args.length - 1)) + "\n"
            let isIface = false
            let methodIdx = 0

            if (procid.mapMethod) {
                let isSet = /Set/.test(procid.mapMethod)
                isIface = true
                methodIdx = isSet ? procid.ifaceIndex : procid.mapIdx
            } else {
                methodIdx = procid.virtualIndex + 4
                if (procid.ifaceIndex != null) {
                    isIface = true
                    methodIdx = procid.ifaceIndex
                }
            }
            res += this.emit_int(methodIdx, "r1") + "\n"
            res += this.call_lbl("pxtrt::fetchMethod" + (isIface ? "Iface" : "")) + "\n"
            res += this.call_reg("r0") + "\n"

            return res
        }

        helper_prologue() {
            return `
    @stackmark args
    ${this.proc_setup(0)}
    movw r4, r24` // store captured vars pointer
        }

        helper_epilogue() {
            return `
    call pxtrt::getGlobalsPtr
    movw r2, r24
    ${this.proc_return()}
    @stackempty args`
        }

        load_ptr(lbl: string, reg: string) {
            assert(!!lbl)
            return `
    ldi ${this.rmap_lo[reg]}, ${lbl}@lo
    ldi ${this.rmap_hi[reg]}, ${lbl}@hi`
        }

        emit_int(v: number, reg: string) {
            return this.reg_gets_imm(reg, v)
        }

        string_literal(lbl: string, s: string) {
            return `
.balign 2
${lbl}meta: .short ${s.length}
${lbl}: .string ${asmStringLiteral(s)}
`
        }

        hex_literal(lbl: string, data: string) {
            return `
.balign 2
${lbl}: .short ${data.length >> 1}
        .hex ${data}${data.length % 4 == 0 ? "" : "00"}
`
        }

        // mapping from virtual registers to AVR registers
        rmap_lo: pxt.Map<string> = {
            "r0": "r24",
            "r1": "r22",
            "r2": "r20",
            "r3": "r18",
            "r5": "r4",
            "r6": "r2"
        }

        rmap_hi: pxt.Map<string> = {
            "r0": "r25",
            "r1": "r23",
            "r2": "r21",
            "r3": "r19",
            "r5": "r5",
            "r6": "r3"
        }

        inst_lo: pxt.Map<string> = {
            "adds": "add",
            "subs": "sub",
            "ands": "and",          // case SK.AmpersandToken
            "orrs": "or",           // case SK.BarToken 
            "eors": "eor",
            "muls": "Number_::",    // case SK.CaretToken
            "lsls": "Number_::",    // case SK.LessThanLessThanToken
            "asrs": "Number_::",    // case SK.GreaterThanGreaterThanToken
            "lsrs": "Number_::"     // case SK.GreaterThanGreaterThanGreaterThanToken
        }

        inst_hi: pxt.Map<string> = {
            "adds": "adc",
            "subs": "sbc",
            "ands": "and",
            "orrs": "or",
            "eors": "eor"
        }
    }
}

