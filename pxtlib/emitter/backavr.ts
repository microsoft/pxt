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
        private push_cnt: number = 0;

        nop() { return "nop" }
        reg_gets_imm(reg: string, imm: number) {
            let imm_lo = imm & 0xff
            let imm_hi = (imm & 0xff00) >> 8
            return `
    ldi ${this.rmap_lo[reg]}, #${imm_lo}
    ldi ${this.rmap_hi[reg]}, #${imm_hi}`
        }
        push_fixed(regs: string[]) {
            this.push_cnt += regs.length
            let res = ""
            regs.forEach(r => {
                res = res + `\npush ${this.rmap_lo[r]}\npush ${this.rmap_hi[r]}`
            });
            return res
        }
        pop_fixed(regs: string[]) {
            let res = ""
            regs.forEach(r => {
                res = res + `\npop ${this.rmap_hi[r]}\npop ${this.rmap_lo[r]}`
            });
            return res
        }
        proc_setup(main?: boolean) {
            this.push_cnt = 0;
            let set_r1_zero = main ? "eor r1, r1" : ""
            // push the frame pointer
            return `
    ${set_r1_zero}
    push r28
    push r29`
        }
        proc_setup_end() {
            if (this.push_cnt > 0) {
                // FP <- SP
                return `
    in r28, 0x3d
    in r29, 0x3e`
            } else {
                return ""
            }
        }
        proc_return() {
            // pop frame pointer and return
            return `
    pop r29
    pop r28
    ret`
        }
        debugger_hook(lbl: string) { return "eor r1, r1" }
        debugger_bkpt(lbl: string) { return "eor r1, r1" }
        breakpoint() { return "eor r1, r1" }
        push_local(reg: string) {
            this.push_cnt += 1
            return `
    push ${this.rmap_lo[reg]}
    push ${this.rmap_hi[reg]}`
        }
        pop_locals(n: number) {
            // note: updates both the SP and FP
            // could make this into a call???
            return `
    in	r28, 0x3d
    in	r29, 0x3e
    sbiw	r28, #2*${n}
    out	0x3d, r28
    out	0x3e, r29`
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
            let reg_lo = this.rmap_lo[reg]
            return `
    cp ${reg_lo}, r1`
        }

        // load_reg_src_off is load/store indirect
        // word? - does offset represent an index that must be multiplied by word size?
        // inf?  - control over size of referenced data
        // str?  - true=Store/false=Load
        load_reg_src_off(reg: string, src: string, off: string, word?: boolean, store?: boolean, inf?: BitSizeInfo) {
            assert(src != "r1")
            let z_reg = ""
            let prelude = ""

            function spill_it(new_off: number) {
                prelude += `
    ${this.reg_gets_imm("r1", new_off)}
    `
                if (z_reg == "Y") {
                    prelude += `
    movw r30, r28
`               }
                prelude += `
    add r30, ${this.rmap_lo["r1"]}
    adc r31, ${this.rmap_hi["r1"]}`
                off = "0"
                z_reg = "Z"
            }

            // different possibilities for src: r0, r5, sp, r6
            // any indirection we want to do using Y+C, Z+C (recall Y=sp, r6 -> Z)
            if (src != "sp") {
                prelude = `
    movw r30, ${this.rmap_lo[src]}`
                z_reg = "Z"
            } else
                z_reg = "Y" // sp -> FP = r29

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
                if (0 <= new_off && new_off <= 63) {
                    off = new_off.toString()
                } else {
                    spill_it(new_off)
                }
            } else if (off[0] == "r") {
                if (z_reg == "Y") {
                    prelude += `
    movw r30, r28
`           }
                prelude += `
    add r30, ${this.rmap_lo[off]}
    adc r31, ${this.rmap_hi[off]}`
                off = "0"
            } else {
                // args@, locals@
                let at_index = off.indexOf("@")
                assert(at_index >= 0)
                let slot = parseInt(off.slice(at_index + 1)) * 2
                if (!(0 <= slot && slot <= 63)) {
                    spill_it(slot)
                }
            }

            if (store)
                // std	Y+2, r25
                return `
    ${prelude}
    std ${z_reg}, ${off}, ${this.rmap_lo[reg]}
    std ${z_reg}, ${off}|1, ${this.rmap_hi[reg]}`
            else
                // ldd	r24, Y+1
                return `
    ${prelude}
    ldd ${this.rmap_lo[reg]}, ${z_reg}, ${off}
    ldd ${this.rmap_hi[reg]}, ${z_reg}, ${off}|1`
        }

        rt_call(name: string, r0: string, r1: string) {
            assert(r0 == "r0" && r1 == "r1")
            assert(name == "adds" || name == "subs" || name == "muls")
            if (name == "muls") {
                // for multiplication, we get result of multiplying r20 x r18 into R0,R1!
                // need to clear r0 at end - result in r24,r25 
                // can we make this a procedure call??
                return `
    movw r20, r24 ; r24 will hold result
    mul r20, r22
    movw r24, r0
    mul	r20, r23
    add	r25, r0
    mul	r21, r22
    add	r25, r0
    eor	r1, r1`
            } else {
                return `
    ${this.inst_lo[name]} r18, r20
    ${this.inst_hi[name]} r19, r21`
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

        lambda_prologue() {
            return `
    @stackmark args
    ${this.proc_setup()}
    movw r26, r24`
        }

        lambda_epilogue() {
            return `
    call pxtrt::getGlobalsPtr
    movw r30, r24
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

        // mapping from virtual registers to AVR registers
        rmap_lo: pxt.Map<string> = {
            "r0": "r24",
            "r1": "r22",
            "r2": "r20",
            "r3": "r18",
            "r5": "r26",  // X
            "r6": "r30"   // Z
        }

        rmap_hi: pxt.Map<string> = {
            "r0": "r25",
            "r1": "r23",
            "r2": "r21",
            "r3": "r19",
            "r5": "r27",
            "r6": "r31"
        }

        inst_lo: pxt.Map<string> = {
            "adds": "add",
            "subs": "sub"
        }

        inst_hi: pxt.Map<string> = {
            "adds": "adc",
            "subs": "sbc"
        }
    }
}