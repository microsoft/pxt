// Make sure backbase.ts is loaded before us, otherwise 'extends AssemblerSnippets' fails at runtime
/// <reference path="backbase.ts"/>

namespace ts.pxtc {

    // snippets for ARM Thumb assembly
    export class ThumbSnippets extends AssemblerSnippets {
        nop() { return "nop" }
        reg_gets_imm(reg: string, imm: number) {
            return `movs ${reg}, #${imm}`
        }
        push_fixed(regs: string[]) { return "push {" + regs.join(", ") + "}"}
        pop_fixed(regs: string[]) { return "pop {" + regs.join(", ") + "}"}
        proc_setup(main?: boolean) { return "push {lr}" }
        proc_return() { return "pop {pc}" }
        debugger_hook(lbl: string) {
            return `
    ldr r0, [r6, #0]
    lsls r0, r0, #30
    bmi ${lbl}
${lbl + "_after"}:
`;
        }

        debugger_bkpt(lbl: string) {
            return `
    ldr r0, [r6, #0]
    lsls r0, r0, #31
    bpl ${lbl}
    bkpt 2
${lbl}:`
        }

        breakpoint() {
            return "bkpt 1"
        }
        push_local(reg: string) { return `push {${reg}}` }
        pop_locals(n: number) { return `add sp, #4*${n} ; pop locals${n}` }
        unconditional_branch(lbl: string) { return "bb " + lbl; }
        beq(lbl: string) { return "beq " + lbl }
        bne(lbl: string) { return "bne " + lbl }
        cmp(reg1: string, reg2: string) { return "cmp " + reg1 + ", " + reg2 }
        cmp_zero(reg1: string) { return "cmp " + reg1 + ", #0" }
        load_reg_src_off(reg: string, src: string, off: string, word: boolean, store: boolean, inf: BitSizeInfo) {
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
                    ldr = str.replace("str", "ldr")
            }
            if (store)
                return `${str} ${reg}, [${src}, ${off}]`
            else
                return `${ldr} ${reg}, [${src}, ${off}]`
        }
        rt_call(name: string, r0: string, r1: string) {
            return name + " " + r0 + ", " + r1;
        }
        call_lbl(lbl: string) {
            return "bl " + lbl;
        }
        call_reg(reg: string) {
            return "blx " + reg;
        }
        vcall(mapMethod: string, isSet: boolean, vtableShift: number) {
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
        prologue_vtable(arg_top_index: number, vtableShift: number) {
            return `
    ldr r0, [sp, #4*${arg_top_index}]  ; ld-this
    ldrh r0, [r0, #2] ; ld-vtable
    lsls r0, r0, #${vtableShift}
    `;
        }
        lambda_prologue() {
            return `
    @stackmark args
    push {lr}
    mov r5, r0
`;
        }
        lambda_epilogue() {
            return `
    bl pxtrt::getGlobalsPtr
    mov r6, r0
    pop {pc}
    @stackempty args
`
        }
        load_ptr(lbl: string, reg: string) {
            assert(!!lbl)
            return `
    movs ${reg}, ${lbl}@hi  ; ldptr
    lsls ${reg}, ${reg}, #8
    adds ${reg}, ${lbl}@lo
`
        }

        emit_int(v: number, reg: string) {
            let movWritten = false

            function writeMov(v: number) {
                assert(0 <= v && v <= 255)
                let result = ""
                if (movWritten) {
                    if (v)
                        result = `adds ${reg}, #${v}\n`
                } else
                    result = `movs ${reg}, #${v}\n`
                movWritten = true
                return result
            }

            function shift(v = 8) {
                return `lsls ${reg}, ${reg}, #${v}\n`
            }

            assert(v != null);

            let n = Math.floor(v)
            let isNeg = false
            if (n < 0) {
                isNeg = true
                n = -n
            }

            // compute number of lower-order 0s and shift that amount
            let numShift = 0
            if (n > 0xff) {
                let shifted = n
                while ((shifted & 1) == 0) {
                    shifted >>>= 1
                    numShift++
                }
                if (numBytes(shifted) < numBytes(n)) {
                    n = shifted
                } else {
                    numShift = 0
                }
            }

            let result = ""
            switch (numBytes(n)) {
                case 4:
                    result += writeMov((n >>> 24) & 0xff)
                    result += shift()
                case 3:
                    result += writeMov((n >>> 16) & 0xff)
                    result += shift()
                case 2:
                    result += writeMov((n >>> 8) & 0xff)
                    result += shift()
                case 1:
                    result += writeMov(n & 0xff)
                    break
                default:
                    oops()
            }

            if (numShift)
                result += shift(numShift)

            if (isNeg) {
                result += `negs ${reg}, ${reg}`
            }
            return result
        }
    }
}

