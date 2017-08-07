// Make sure backbase.ts is loaded before us, otherwise 'extends AssemblerSnippets' fails at runtime
/// <reference path="backbase.ts"/>

namespace ts.pxtc {

    const inlineArithmetic: pxt.Map<string> = {
        "numops::adds": "_numops_adds",
        "numops::subs": "_numops_subs",
        "numops::orrs": "_numops_orrs",
        "numops::ands": "_numops_ands",
        "pxt::toInt": "_numops_toInt",
        "pxt::fromInt": "_numops_fromInt",
    }

    // snippets for ARM Thumb assembly
    export class ThumbSnippets extends AssemblerSnippets {
        stackAligned() {
            return target.stackAlign && target.stackAlign > 1
        }
        pushLR() {
            if (this.stackAligned()) return "push {lr, r3}  ; r3 for align"
            else return "push {lr}"
        }
        popPC() {
            if (this.stackAligned()) return "pop {pc, r3}  ; r3 for align"
            else return "pop {pc}"
        }
        nop() { return "nop" }
        reg_gets_imm(reg: string, imm: number) {
            return `movs ${reg}, #${imm}`
        }
        push_fixed(regs: string[]) { return "push {" + regs.join(", ") + "}" }
        pop_fixed(regs: string[]) { return "pop {" + regs.join(", ") + "}" }
        proc_setup(main?: boolean) { return "push {lr}" }
        proc_return() { return "pop {pc}" }

        debugger_stmt(lbl: string) {
            return `
    @stackempty locals
    ldr r0, [r6, #0] ; debugger
    subs r0, r0, #4  ; debugger
${lbl}:
    ldr r0, [r0, #0] ; debugger
`
        }

        debugger_bkpt(lbl: string) {
            return `
    @stackempty locals
    ldr r0, [r6, #0] ; brk
${lbl}:
    ldr r0, [r0, #0] ; brk
`
        }

        debugger_proc(lbl: string) {
            return `
    ldr r0, [r6, #0]  ; brk-entry
    ldr r0, [r0, #4]  ; brk-entry
${lbl}:`
        }

        push_local(reg: string) { return `push {${reg}}` }
        push_locals(n: number) { return `sub sp, #4*${n} ; push locals ${n} (align)` }
        pop_locals(n: number) { return `add sp, #4*${n} ; pop locals ${n}` }
        unconditional_branch(lbl: string) { return "bb " + lbl; }
        beq(lbl: string) { return "beq " + lbl }
        bne(lbl: string) { return "bne " + lbl }
        cmp(reg1: string, reg2: string) { return "cmp " + reg1 + ", " + reg2 }
        cmp_zero(reg1: string) { return "cmp " + reg1 + ", #0" }
        load_reg_src_off(reg: string, src: string, off: string, word?: boolean, store?: boolean, inf?: BitSizeInfo) {
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
            if (target.taggedInts && !target.boxDebug) {
                let o = U.lookup(inlineArithmetic, lbl)
                if (o) lbl = o
            }
            return "bl " + lbl;
        }
        call_reg(reg: string) {
            return "blx " + reg;
        }
        // NOTE: 43 (in cmp instruction below) is magic number to distinguish
        // NOTE: Map from RefRecord
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
    ${this.pushLR()}
    bl ${mapMethod}
    ${this.popPC()}
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
    ${this.pushLR()}
    mov r5, r0
`;
        }
        lambda_epilogue() {
            return `
    bl pxtrt::getGlobalsPtr
    mov r6, r0
    ${this.popPC()}
    @stackempty args
`
        }
        load_ptr_full(lbl: string, reg: string) {
            assert(!!lbl)
            return `
    ldlit ${reg}, ${lbl}
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

        arithmetic() {
            let r = ""

            if (!target.taggedInts || target.boxDebug) {
                return r
            }

            for (let op of ["adds", "subs", "ands", "orrs", "eors"]) {
                r +=
                    `
_numops_${op}:
    @scope _numops_${op}
    lsls r2, r0, #31
    beq .boxed
    lsls r2, r1, #31
    beq .boxed
`
                if (op == "adds" || op == "subs")
                    r += `
    subs r2, r1, #1
    ${op} r2, r0, r2
    bvs .boxed
    movs r0, r2
    blx lr
`
                else {
                    r += `    ${op} r0, r1\n`
                    if (op == "eors")
                        r += `    adds r0, r0, #1\n`
                    r += `    blx lr\n`
                }

                r += `
.boxed:
    ${this.pushLR()}
    bl numops::${op}
    ${this.popPC()}
`
            }

            r += `
@scope _numops_toInt
_numops_toInt:
    asrs r0, r0, #1
    bcc .over
    blx lr
.over:
    ${this.pushLR()}
    lsls r0, r0, #1
    bl pxt::toInt
    ${this.popPC()}

_numops_fromInt:
    lsls r2, r0, #1
    asrs r1, r2, #1
    cmp r0, r1
    bne .over2
    adds r0, r2, #1
    blx lr
.over2:
    ${this.pushLR()}
    bl pxt::fromInt
    ${this.popPC()}
`

            return r
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
                result += `negs ${reg}, ${reg}\n`
            }

            if (result.split("\n").length > 3 + 1) {
                // more than 3 instructions? replace with LDR at PC-relative address
                return `ldlit ${reg}, ${Math.floor(v)}\n`
            }

            return result
        }
    }
}

