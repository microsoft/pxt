namespace ts.pxtc {

   // AVR:
   // - 32 8-bit registers (R0 - R31), with mapping to data addresses 0x0000 - 0x001F
   //   - X-register R26 (low), R27 (high)
   //   - Y-register R28 (low), R29 (high)
   //   - Z-register R30 (low), R31 (high)
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
    * The call-used or call-clobbered general purpose registers (GPRs) are registers that might be 
    * destroyed (clobbered) by a function call. 
    * R18–R27, R30, R31. These GPRs are call clobbered. An ordinary function may use them without restoring the contents. 
    * Interrupt service routines (ISRs) must save and restore each register they use. 
    * R0, T-Flag The temporary register and the T-flag in SREG are also call-clobbered, but this 
    * knowledge is not exposed explicitly to the compiler (R0 is a fixed register). 
    */

   /*
    * Call-Saved Registers
    * 
    * R2–R17, R28, R29 
    * The remaining GPRs are call-saved, i.e. a function that uses such a registers must restore its original content. 
    * This applies even if the register is used to pass a function argument. 
    * R1 The zero-register is implicity call-saved (implicit because R1 is a fixed register). 
    */

    /*
     * Frame layout
     * 
     * Pseudos that don't get a hard register will be put into a stack slot and loaded / stored as needed. 
     * In order to access stack locations, avr-gcc will set up a 16-bit frame pointer in R29:R28 (Y) 
     * because the stack pointer (SP) cannot be used to access stack slots. 
     * The stack grows downwards. Smaller addresses are at the bottom of the drawing at the right. 
     * Stack pointer and frame pointer are not aligned, i.e. 1-byte aligned. 
     * After the function prologue, the frame pointer will point one byte below the stack frame, 
     * i.e. Y+1 points to the bottom of the stack frame. 
     */

    /*
    class AVRSnippets extends AssemblerSnippets {
        nop() { return "nop" }
        reg_gets_imm(reg: string, imm: number) { return "TBD" }
        push(reg: string[]) { return "TBD" }
        pop(reg: string[]) { return "TBD" }
        debugger_hook(lbl: string) { return "TBD" }
        debugger_bkpt(lbl: string) { return "TBD" }
        breakpoint() { return "TBD" }
        pop_locals(n: number) { return "TBD" }
        unconditional_branch(lbl: string) { return "TBD" }
        beq(lbl: string) { return "TBD" }
        bne(lbl: string) { return "TBD" }
        cmp(o1: string, o2: string) { return "TBD" }
        // load_reg_src_off is load/store indirect
        // word? - does offset represent an index that must be multiplied by word size?
        // inf?  - control over size of referenced data
        // str?  - true=Store/false=Load
        load_reg_src_off(reg: string, src: string, off: string, word?: boolean, store?: boolean, inf?: BitSizeInfo) { return "TBD"; }  
        rt_call(name: string, r0: string, r1: string) { return "TBD"; }
        call_lbl(lbl: string) { return "TBD" }
        call_reg(reg: string) { return "TBD" }
        vcall(mapMethod: string, isSet: boolean, vtableShift: number) { return "TBD" }
        prologue_vtable(arg_index: number, vtableShift: number) { return "TBD" }
        lambda_prologue() { return "TBD" }
        lambda_epilogue() { return "TBD" }
        load_ptr(lbl: string, reg: string) { return "TBD" }
        adds(reg: string, imm: number) { return "TBD" }
        lsls(reg: string, imm: number) { return "TBD" }
        negs(reg: string) { return "TBD" }
    }
    */
}