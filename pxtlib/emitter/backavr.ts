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

    // - in AVR< 0x0060 is lowest address for the stack
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
     * Return values with a size of 1 byte up to and including a size of 8 bytes will be returned in registers. 
     * Return values whose size is outside that range will be returned in memory. 
     * If a return value cannot be returned in registers, the caller will allocate stack space and 
     * pass the address as implicit first pointer argument to the callee. The callee will put the 
     * return value into the space provided by the caller. 
     * If the return value of a function is returned in registers, the same registers are used as if 
     * the value was the first parameter of a non-varargs function. 
     * For example, an 8-bit value is returned in R24 and an 32-bit value is returned R22...R25. 
     * Arguments of varargs functions are passed on the stack. This applies even to the named arguments. 
     */

    // for now, everything is 16-bit (word)
    class AVRSnippets extends AssemblerSnippets {
        nop() { return "nop" }
        reg_gets_imm(reg: string, imm: number) {
            // TODO: split immediate and load into register pair (check this is correct)
            let imm_lo = imm & 0xff
            let imm_hi = (imm & 0xff00) >> 8
            return `ldi ${this.rmap_lo(reg)}, #${imm_lo}\nldi ${this.rmap_hi(reg)}, #${imm_hi}`
        }
        push(regs: string[]) {
            let res = ""
            regs.forEach(r => {
                res = res + `push ${this.rmap_lo(r)}\npush ${this.rmap_hi(r)}`
            });
            return res
        }
        pop(regs: string[]) {
            let res = ""
            regs.forEach(r => {
                res = res + `pop ${this.rmap_hi(r)}\npop ${this.rmap_lo(r)}`
            });
            return res
        }
        proc_setup() {
            // push the frame pointer
            return "push r28\npush r29"
        }
        proc_return() {
            // pop frame pointer and return
            return "pop r29\npush r28\nret"
        }
        debugger_hook(lbl: string) { return "nop" }
        debugger_bkpt(lbl: string) { return "nop" }
        breakpoint() { return "nop" }
        pop_locals(n: number) {
            // note: updates both the SP and FP
            return `
    in	r28, 0x3d
    in	r29, 0x3e
    sbiw	r28, #2*${n}
    out	0x3d, r28
    out	0x3e, r29`
        }
        unconditional_branch(lbl: string) { return "jmp " + lbl }
        beq(lbl: string) { return "TBD" }
        bne(lbl: string) { return "TBD" }
        cmp(reg1: string, o2: string) {
            // TODO
            return ""
        }
        // load_reg_src_off is load/store indirect
        // word? - does offset represent an index that must be multiplied by word size?
        // inf?  - control over size of referenced data
        // str?  - true=Store/false=Load
        load_reg_src_off(reg: string, src: string, off: string, word?: boolean, store?: boolean, inf?: BitSizeInfo) { return "TBD"; }
        rt_call(name: string, r0: string, r1: string) { return "TBD"; }
        call_lbl(lbl: string) { return "TBD" }
        call_reg(reg: string) { return "TBD" }

        // no virtuals or lambdas for now
        vcall(mapMethod: string, isSet: boolean, vtableShift: number) { assert(false); return "" }
        prologue_vtable(arg_index: number, vtableShift: number) { assert(false); return "" }
        lambda_prologue() { assert(false); return "" }
        lambda_epilogue() { assert(false); return "" }

        load_ptr(lbl: string, reg: string) { return "TBD" }
        emit_int(v: number, reg: string) { return "TBD" }

        // mapping from virtual registers to AVR registers
        private rmap_lo(vreg: string) {
            assert(vreg != "sp" && vreg != "lr")
            if (vreg == "r0")
                return "r18"
            if (vreg == "r1")
                return "r20"
            if (vreg == "r2")
                return "r22"
            if (vreg == "r3")
                return "r24"
            if (vreg == "r5")
                return "r26"
            if (vreg == "r6")
                return "r30"
            oops()
            return ""
        }

        private rmap_hi(vreg: string) {
            assert(vreg != "sp" && vreg != "lr")
            if (vreg == "r0")
                return "r19"
            if (vreg == "r1")
                return "r21"
            if (vreg == "r2")
                return "r23"
            if (vreg == "r3")
                return "r25"
            if (vreg == "r5")
                return "r27"
            if (vreg == "r6")
                return "r31"
            oops()
            return ""
        }
    }
}