namespace ts.pxtc {

    // snippets for ARM Thumb assembly
    export class ThumbSnippets extends AssemblerSnippets {
        public nop() { return "nop" }
        public reg_gets_imm(reg: string, imm: number) {
            return `movs ${reg}, #${imm}`
        }
        public push(reg: string) { return `push ${reg}` }
        public pop(reg: string) { return `pop ${reg}` }

        public debugger_hook(lbl: string) {
            return `
    ldr r0, [r6, #0]
    lsls r0, r0, #30
    bmi ${lbl}
${lbl + "_after"}:
`;
        }

        public debugger_bkpt(lbl: string) {
            return `
    ldr r0, [r6, #0]
    lsls r0, r0, #31
    bpl ${lbl}
    bkpt 2
${lbl}:`
        }

        public breakpoint() {
            return "bkpt 1"
        }

        public pop_locals(n: number) { return `add sp, #4*${n} ; pop locals${n}` }
        public unconditional_branch(lbl: string) { return "b " + lbl; }
        public beq(lbl: string) { return "beq " + lbl }
        public bne(lbl: string) { return "bne " + lbl }
        public cmp(o1: string, o2: string) { return "cmp " + o1 + ", " + o2 }
        public load_reg_src_off(reg: string, src: string, off: string, word: boolean, store: boolean, inf: BitSizeInfo) {
            if (word) {
                off = `#4*${off}`
            }
            let str = "str"
            let ldr = "ldr"
            if (inf) {
                if (inf.immLimit == 32)
                    str = "strb"
                else if (inf.immLimit == 64)
                    str = "strh"
                if (inf.needsSignExt)
                    ldr = str.replace("str", "ldrs")
                else
                    ldr = str.replace("str","ldr")
            }
            if (store)
                return `${str} ${reg}, [${src}, ${off}]`
            else
                return `${ldr} ${reg}, [${src}, ${off}]`
        }
        public rt_call(name:string, r0: string, r1: string) { 
            return name + " " + r0 + ", " + r1;
        }
        public call_lbl(name:string) {
            return "bl " + name;
        }
        public call_reg(reg: string) {
            return "blx " + reg;
        }
        public vcall(mapMethod: string, isSet: boolean, vtableShift: number) {
            return `
    ldr r0, [sp, #${isSet ? 4 : 0}] ; ld-this
    ldrh r3, [r0, #2] ; ld-vtable
    lsls r3, r3, #${vtableShift}
    ldr r3, [r3, #4] ; iface table
    cmp r3, #43
    beq .objlit
.nonlit:
    lsls r1, ${isSet ? "r2" : "r1"}, #2
    ldr r0, [r3, r1] ; ld-method
    bx r0
.objlit:
    ${isSet ? "ldr r2, [sp, #0]" : ""}
    push {lr}
    bl ${mapMethod}
    pop {pc}
`;
        }
        public prologue_vtable(arg_top_index: number, vtableShift: number) {
            return `
    ldr r0, [sp, #4*${arg_top_index}]  ; ld-this
    ldrh r0, [r0, #2] ; ld-vtable
    lsls r0, r0, #${vtableShift}
    `;
        }
        public lambda_prologue() {
            return `
    @stackmark args
    push {lr}
    mov r5, r0
`;
        }
        public lambda_epilogue() {
            return `
    bl pxtrt::getGlobalsPtr
    mov r6, r0
    pop {pc}
    @stackempty args
`
        }
        public LdPtr(lbl: string, reg: string) {
            assert(!!lbl)
            return `
    movs ${reg}, ${lbl}@hi  ; ldptr
    lsls ${reg}, ${reg}, #8
    adds ${reg}, ${lbl}@lo
`
        }
        public adds(reg: string, imm: number) {
            return `adds ${reg}, #${imm}`
        }
        public movs(reg: string, imm: number) {
            return `movs ${reg}, #${imm}`
        }
        public lsls(reg: string, imm: number) {
            return `lsls ${reg}, ${reg}, #${imm}`
        }
        public negs(reg: string) { 
            return `negs ${reg}, ${reg}`
        }
    }
}

