namespace ts.pxtc {

    // supporting multiple sizes (byte, short, int, long)
    export interface BitSizeInfo {
        size: number;
        needsSignExt?: boolean;
        immLimit: number;
    }


    export function asmStringLiteral(s: string) {
        let r = "\""
        for (let i = 0; i < s.length; ++i) {
            // TODO generate warning when seeing high character ?
            let c = s.charCodeAt(i) & 0xff
            let cc = String.fromCharCode(c)
            if (cc == "\\" || cc == "\"")
                r += "\\" + cc
            else if (cc == "\n")
                r += "\\n"
            else if (c <= 0xf)
                r += "\\x0" + c.toString(16)
            else if (c < 32 || c > 127)
                r += "\\x" + c.toString(16)
            else
                r += cc;
        }
        return r + "\""
    }

    // this class defines the interface between the IR
    // and a particular assembler (Thumb, AVR). Thus,
    // the registers mentioned below are VIRTUAL registers
    // required by the IR-machine, rather than PHYSICAL registers
    // at the assembly level.

    // that said, the assumptions below about registers are based on
    // ARM, so a mapping will be needed for other processors

    // Assumptions:
    // - registers can hold a pointer (data or code)
    // - special registers include: sp
    // - fixed registers are r0, r1, r2, r3, r5, r6
    //   - r0 is the current value (from expression evaluation)
    //   - registers for runtime calls (r0, r1,r2,r3)
    //   - r5 is for captured locals in lambda
    //   - r6 for global{}
    //   - r4 and r7 are used as temporary
    //   - C code assumes the following are calee saved: r4-r7, r8-r11
    //   - r12 is intra-procedure scratch and can be treated like r0-r3
    //   - r13 is sp, r14 is lr, r15 is pc
    // - for calls to user functions, all arguments passed on stack

    export abstract class AssemblerSnippets {
        nop() { return "TBD(nop)" }
        reg_gets_imm(reg: string, imm: number) { return "TBD(reg_gets_imm)" }
        // Registers are stored on the stack in numerical order
        proc_setup(numlocals: number, main?: boolean) { return "TBD(proc_setup)" }
        push_fixed(reg: string[]) { return "TBD(push_fixed)" }
        push_local(reg: string) { return "TBD(push_local)" }
        push_locals(n: number) { return "TBD(push_locals)" }
        pop_fixed(reg: string[]) { return "TBD(pop_fixed)" }
        pop_locals(n: number) { return "TBD(pop_locals)" }
        proc_return() { return "TBD(proc_return)" }
        debugger_stmt(lbl: string) { return "" }
        debugger_bkpt(lbl: string) { return "" }
        debugger_proc(lbl: string) { return "" }
        unconditional_branch(lbl: string) { return "TBD(unconditional_branch)" }
        beq(lbl: string) { return "TBD(beq)" }
        bne(lbl: string) { return "TBD(bne)" }
        cmp(reg1: string, reg: string) { return "TBD(cmp)" }
        cmp_zero(reg1: string) { return "TBD(cmp_zero)" }
        arithmetic() { return "" }
        // load_reg_src_off is load/store indirect
        // word? - does offset represent an index that must be multiplied by word size?
        // inf?  - control over size of referenced data
        // str?  - true=Store/false=Load
        // src - can range over
        load_reg_src_off(reg: string, src: string, off: string, word?: boolean,
            store?: boolean, inf?: BitSizeInfo) {
            return "TBD(load_reg_src_off)";
        }
        rt_call(name: string, r0: string, r1: string) { return "TBD(rt_call)"; }
        call_lbl(lbl: string, saveStack?: boolean) { return "TBD(call_lbl)" }
        call_reg(reg: string) { return "TBD(call_reg)" }
        helper_prologue() { return "TBD(lambda_prologue)" }
        helper_epilogue() { return "TBD(lambda_epilogue)" }
        pop_clean(pops: boolean[]) { return "TBD" }
        load_ptr_full(lbl: string, reg: string) { return "TBD(load_ptr_full)" }
        emit_int(v: number, reg: string) { return "TBD(emit_int)" }

        obj_header(vt: string) {
            return `.word ${vt}`
        }

        string_literal(lbl: string, strLit: string) {
            const info = utf8AsmStringLiteral(strLit)
            return `
            .balign 4
            .object ${lbl}
            ${lbl}: ${this.obj_header(info.vt)}
            ${info.asm}
`
        }


        hex_literal(lbl: string, data: string) {
            // if buffer looks as if it was prepared for in-app reprogramming (at least 8 bytes of 0xff)
            // align it to 8 bytes, to make sure it can be rewritten also on SAMD51
            const align = /f{16}/i.test(data) ? 8 : 4
            return `
.balign ${align}
.object ${lbl}
${lbl}: ${this.obj_header("pxt::buffer_vt")}
${hexLiteralAsm(data)}
`
        }
    }

    export function utf8AsmStringLiteral(strLit: string) {
        const PXT_STRING_SKIP_INCR = 16
        let vt = "pxt::string_inline_ascii_vt"
        let utfLit = target.utf8 ? U.toUTF8(strLit, true) : strLit
        let asm = ""
        if (utfLit !== strLit) {
            if (strLit.length > PXT_STRING_SKIP_INCR) {
                vt = "pxt::string_skiplist16_packed_vt"
                let skipList: number[] = []
                let off = 0
                for (let i = 0; i + PXT_STRING_SKIP_INCR <= strLit.length; i += PXT_STRING_SKIP_INCR) {
                    off += U.toUTF8(strLit.slice(i, i + PXT_STRING_SKIP_INCR), true).length
                    skipList.push(off)
                }
                asm = `
    .short ${utfLit.length}, ${strLit.length}
    .short ${skipList.map(s => s.toString()).join(", ")}
    .string ${asmStringLiteral(utfLit)}
`
            } else {
                vt = "pxt::string_inline_utf8_vt"
            }
        }

        if (!asm)
            asm = `
    .short ${utfLit.length}
    .string ${asmStringLiteral(utfLit)}
`
        return { vt, asm }
    }

    export function hexLiteralAsm(data: string, suff = "") {
        return `
                .word ${data.length >> 1}${suff}
                .hex ${data}${data.length % 4 == 0 ? "" : "00"}
        `
    }

    // helper for emit_int
    export function numBytes(n: number) {
        let v = 0
        for (let q = n; q > 0; q >>>= 8) {
            v++
        }
        return v || 1
    }

    export class ProctoAssembler {

        private t: ThumbSnippets; // for better "Go To Definition"
        private bin: Binary;
        private resText = ""
        private exprStack: ir.Expr[] = []
        private calls: ProcCallInfo[] = []
        private proc: ir.Procedure = null;
        private baseStackSize = 0; // real stack size is this + exprStack.length
        private labelledHelpers: pxt.Map<string> = {};

        constructor(t: AssemblerSnippets, bin: Binary, proc: ir.Procedure) {
            this.t = t as any; // TODO in future, figure out if we follow the "Snippets" architecture
            this.bin = bin;
            this.proc = proc;
            if (this.proc)
                this.work();
        }

        public emitHelpers() {
            this.emitLambdaTrampoline()
            this.emitArrayMethods()
            this.emitFieldMethods()
            this.emitBindHelper()
        }

        private write = (s: string) => { this.resText += asmline(s); }

        private redirectOutput(f: () => void) {
            let prevWrite = this.write
            let res = ""
            this.write = s => res += asmline(s)
            try {
                f()
            } finally {
                this.write = prevWrite
            }
            return res
        }

        private stackSize() {
            return this.baseStackSize + this.exprStack.length
        }

        private stackAlignmentNeeded(offset = 0) {
            if (!target.stackAlign) return 0
            let npush = target.stackAlign - ((this.stackSize() + offset) & (target.stackAlign - 1))
            if (npush == target.stackAlign) return 0
            else return npush
        }

        public getAssembly() {
            return this.resText;
        }

        private work() {
            this.write(`
;
; Function ${this.proc.getFullName()}
;
`)

            let baseLabel = this.proc.label()
            this.write(`.object ${baseLabel} ${JSON.stringify(this.proc.getFullName())}`)
            let preLabel = baseLabel + "_pre"
            let bkptLabel = baseLabel + "_bkpt"
            let locLabel = baseLabel + "_locals"
            let endLabel = baseLabel + "_end"

            this.write(`${preLabel}:`)

            this.emitLambdaWrapper(this.proc.isRoot)

            this.write(`.section code`)
            this.write(`${baseLabel}:`)

            if (this.proc.classInfo && this.proc.info.thisParameter
                && !target.switches.skipClassCheck
                && !target.switches.noThisCheckOpt) {
                this.write(`mov r7, lr`)
                this.write(`ldr r0, [sp, #0]`)
                this.emitInstanceOf(this.proc.classInfo, "validate")
                this.write("mov lr, r7")
            }

            this.write(`
${baseLabel}_nochk:
    @stackmark func
    @stackmark args
`)
            // create a new function for later use by hex file generation
            this.proc.fillDebugInfo = th => {
                let labels = th.getLabels()

                this.proc.debugInfo = {
                    locals: (this.proc.seqNo == 1 ? this.bin.globals : this.proc.locals).map(l => l.getDebugInfo()),
                    args: this.proc.args.map(l => l.getDebugInfo()),
                    name: this.proc.getName(),
                    codeStartLoc: U.lookup(labels, locLabel),
                    codeEndLoc: U.lookup(labels, endLabel),
                    bkptLoc: U.lookup(labels, bkptLabel),
                    localsMark: U.lookup(th.stackAtLabel, locLabel),
                    idx: this.proc.seqNo,
                    calls: this.calls,
                    size: U.lookup(labels, endLabel) + 2 - U.lookup(labels, preLabel)
                }

                for (let ci of this.calls) {
                    ci.addr = U.lookup(labels, ci.callLabel)
                    ci.stack = U.lookup(th.stackAtLabel, ci.callLabel)
                    ci.callLabel = undefined // don't waste space
                }

                for (let i = 0; i < this.proc.body.length; ++i) {
                    let bi = this.proc.body[i].breakpointInfo
                    if (bi) {
                        let off = U.lookup(th.stackAtLabel, `__brkp_${bi.id}`)
                        if (off !== this.proc.debugInfo.localsMark) {
                            pxt.log(bi)
                            pxt.log(th.stackAtLabel)
                            U.oops(`offset doesn't match: ${off} != ${this.proc.debugInfo.localsMark}`)
                        }
                    }
                }
            }

            if (this.bin.breakpoints) {
                this.write(this.t.debugger_proc(bkptLabel))
            }
            this.baseStackSize = 1 // push {lr}
            let numlocals = this.proc.locals.length

            this.write("push {lr}")
            this.write(".locals:\n")
            if (this.proc.perfCounterNo) {
                this.write(this.t.emit_int(this.proc.perfCounterNo, "r0"))
                this.write("bl pxt::startPerfCounter")
            }

            this.write(this.t.proc_setup(numlocals))
            this.baseStackSize += numlocals

            this.write("@stackmark locals")
            this.write(`${locLabel}:`)

            for (let i = 0; i < this.proc.body.length; ++i) {
                let s = this.proc.body[i]
                // pxt.log("STMT", s.toString())
                switch (s.stmtKind) {
                    case ir.SK.Expr:
                        this.emitExpr(s.expr)
                        break;
                    case ir.SK.StackEmpty:
                        if (this.exprStack.length > 0) {
                            for (let stmt of this.proc.body.slice(i - 4, i + 1))
                                pxt.log(`PREVSTMT ${stmt.toString().trim()}`)
                            for (let e of this.exprStack)
                                pxt.log(`EXPRSTACK ${e.currUses}/${e.totalUses} E: ${e.toString()}`)
                            oops("stack should be empty")
                        }
                        this.write("@stackempty locals")
                        break;
                    case ir.SK.Jmp:
                        this.emitJmp(s);
                        break;
                    case ir.SK.Label:
                        this.write(s.lblName + ":")
                        this.validateJmpStack(s)
                        break;
                    case ir.SK.Comment:
                        this.write(`; ${s.expr.data}`)
                        break
                    case ir.SK.Breakpoint:
                        if (this.bin.breakpoints) {
                            let lbl = `__brkp_${s.breakpointInfo.id}`
                            if (s.breakpointInfo.isDebuggerStmt) {
                                this.write(this.t.debugger_stmt(lbl))
                            } else {
                                this.write(this.t.debugger_bkpt(lbl))
                            }
                        }
                        break;
                    default: oops();
                }
            }

            assert(0 <= numlocals && numlocals < 127);
            if (numlocals > 0)
                this.write(this.t.pop_locals(numlocals))

            if (this.proc.perfCounterNo) {
                this.write("mov r4, r0")
                this.write(this.t.emit_int(this.proc.perfCounterNo, "r0"))
                this.write("bl pxt::stopPerfCounter")
                this.write("mov r0, r4")
            }

            this.write(`${endLabel}:`)
            this.write(this.t.proc_return())
            this.write("@stackempty func");
            this.write("@stackempty args")
            this.write("; endfun")
        }

        private mkLbl(root: string) {
            let l = root + this.bin.lblNo++
            if (l[0] != "_") l = "." + l
            return l
        }

        private dumpStack() {
            let r = "["
            for (let s of this.exprStack) {
                r += s.sharingInfo() + ": " + s.toString() + "; "
            }
            r += "]"
            return r
        }

        private terminate(expr: ir.Expr) {
            assert(expr.exprKind == ir.EK.SharedRef)
            let arg = expr.args[0]
            // pxt.log("TERM", arg.sharingInfo(), arg.toString(), this.dumpStack())
            U.assert(arg.currUses != arg.totalUses)
            // we should have the terminated expression on top
            U.assert(this.exprStack[0] === arg, "term at top")
            // we pretend it's popped and simulate what clearStack would do
            let numEntries = 1
            while (numEntries < this.exprStack.length) {
                let ee = this.exprStack[numEntries]
                if (ee.currUses != ee.totalUses)
                    break
                numEntries++
            }
            // in this branch we just remove all that stuff off the stack
            this.write(`@dummystack ${numEntries}`)
            this.write(this.t.pop_locals(numEntries))

            return numEntries
        }

        private validateJmpStack(lbl: ir.Stmt, off = 0) {
            // pxt.log("Validate:", off, lbl.lblName, this.dumpStack())
            let currSize = this.exprStack.length - off
            if (lbl.lblStackSize == null) {
                lbl.lblStackSize = currSize
            } else {
                if (lbl.lblStackSize != currSize) {
                    pxt.log(lbl.lblStackSize, currSize)
                    pxt.log(this.dumpStack())
                    U.oops("stack misaligned at: " + lbl.lblName)
                }
            }
        }

        private emitJmp(jmp: ir.Stmt) {
            let termOff = 0
            if (jmp.jmpMode == ir.JmpMode.Always) {
                if (jmp.expr)
                    this.emitExpr(jmp.expr)
                if (jmp.terminateExpr)
                    termOff = this.terminate(jmp.terminateExpr)
                this.write(this.t.unconditional_branch(jmp.lblName) + " ; with expression")
            } else {
                let lbl = this.mkLbl("jmpz")

                this.emitExpr(jmp.expr)

                // TODO: remove ARM-specific code
                if (jmp.expr.exprKind == ir.EK.RuntimeCall &&
                    (jmp.expr.data === "thumb::subs" || U.startsWith(jmp.expr.data, "_cmp_"))) {
                    // no cmp required
                } else {
                    this.write(this.t.cmp_zero("r0"))
                }

                if (jmp.jmpMode == ir.JmpMode.IfNotZero) {
                    this.write(this.t.beq(lbl)) // this is to *skip* the following 'b' instruction; beq itself has a very short range
                } else {
                    // IfZero
                    this.write(this.t.bne(lbl))
                }

                if (jmp.terminateExpr)
                    termOff = this.terminate(jmp.terminateExpr)

                this.write(this.t.unconditional_branch(jmp.lblName))
                this.write(lbl + ":")
            }

            this.validateJmpStack(jmp.lbl, termOff)
        }

        private clearStack(fast = false) {
            let numEntries = 0
            while (this.exprStack.length > 0 && this.exprStack[0].currUses == this.exprStack[0].totalUses) {
                numEntries++;
                this.exprStack.shift()
            }
            if (numEntries)
                this.write(this.t.pop_locals(numEntries))
            if (!fast) {
                let toClear = this.exprStack.filter(e => e.currUses == e.totalUses && e.irCurrUses != -1)
                if (toClear.length > 0) {
                    // use r7 as temp; r0-r3 might be used as arguments to functions
                    this.write(this.t.reg_gets_imm("r7", 0))
                    for (let a of toClear) {
                        a.irCurrUses = -1
                        this.write(this.loadFromExprStack("r7", a, 0, true))
                    }
                }
            }
        }

        private emitExprInto(e: ir.Expr, reg: string) {
            switch (e.exprKind) {
                case ir.EK.NumberLiteral:
                    if (typeof e.data == "number") this.write(this.t.emit_int(e.data, reg))
                    else oops();
                    break;
                case ir.EK.PointerLiteral:
                    this.write(this.t.load_ptr_full(e.data, reg))
                    break;
                case ir.EK.SharedRef:
                    let arg = e.args[0]
                    U.assert(!!arg.currUses) // not first use
                    U.assert(arg.currUses < arg.totalUses)
                    arg.currUses++
                    let idx = this.exprStack.indexOf(arg)
                    U.assert(idx >= 0)
                    if (idx == 0 && arg.totalUses == arg.currUses) {
                        this.write(this.t.pop_fixed([reg]) + ` ; tmpref @${this.exprStack.length}`)
                        this.exprStack.shift()
                        this.clearStack()
                    } else {
                        let idx0 = idx.toString() + ":" + this.exprStack.length
                        this.write(this.t.load_reg_src_off(reg, "sp", idx0, true) + ` ; tmpref @${this.exprStack.length - idx}`)
                    }
                    break;
                case ir.EK.CellRef:
                    let cell = e.data as ir.Cell
                    if (cell.isGlobal()) {
                        let inf = this.bitSizeInfo(cell.bitSize)
                        let off = "#" + cell.index
                        if (inf.needsSignExt || cell.index >= inf.immLimit) {
                            this.write(this.t.emit_int(cell.index, reg))
                            off = reg
                        }
                        this.write(this.t.load_reg_src_off("r7", "r6", "#0"))
                        this.write(this.t.load_reg_src_off(reg, "r7", off, false, false, inf))
                    } else {
                        let [src, imm, idx] = this.cellref(cell)
                        this.write(this.t.load_reg_src_off(reg, src, imm, idx))
                    }
                    break;
                default: oops();
            }
        }

        private bitSizeInfo(b: BitSize) {
            let inf: BitSizeInfo = {
                size: sizeOfBitSize(b),
                immLimit: 128
            }
            if (inf.size == 1) {
                inf.immLimit = 32
            } else if (inf.size == 2) {
                inf.immLimit = 64
            }
            if (b == BitSize.Int8 || b == BitSize.Int16) {
                inf.needsSignExt = true
            }
            return inf
        }

        // result in R0
        private emitExpr(e: ir.Expr): void {
            //pxt.log(`EMITEXPR ${e.sharingInfo()} E: ${e.toString()}`)

            switch (e.exprKind) {
                case ir.EK.JmpValue:
                    this.write("; jmp value (already in r0)")
                    break;
                case ir.EK.Nop:
                    // this is there because we need different addresses for breakpoints
                    this.write(this.t.nop())
                    break;
                case ir.EK.FieldAccess:
                    this.emitExpr(e.args[0])
                    return this.emitFieldAccess(e)
                case ir.EK.Store:
                    return this.emitStore(e.args[0], e.args[1])
                case ir.EK.RuntimeCall:
                    return this.emitRtCall(e);
                case ir.EK.ProcCall:
                    return this.emitProcCall(e)
                case ir.EK.SharedDef:
                    return this.emitSharedDef(e)
                case ir.EK.Sequence:
                    e.args.forEach(e => this.emitExpr(e))
                    return this.clearStack()
                case ir.EK.InstanceOf:
                    this.emitExpr(e.args[0])
                    return this.emitInstanceOf(e.data, e.jsInfo as string)
                default:
                    return this.emitExprInto(e, "r0")
            }
        }

        private emitFieldAccess(e: ir.Expr, store = false) {
            let info = e.data as FieldAccessInfo
            let pref = store ? "st" : "ld"
            let lbl = pref + "fld_" + info.classInfo.id + "_" + info.name
            if (info.needsCheck && !target.switches.skipClassCheck) {
                this.emitInstanceOf(info.classInfo, "validate")
                lbl += "_chk"
            }

            let off = info.idx * 4 + 4
            let xoff = "#" + off
            if (off > 124) {
                this.write(this.t.emit_int(off, "r3"))
                xoff = "r3"
            }
            if (store)
                this.write(`str r1, [r0, ${xoff}]`)
            else
                this.write(`ldr r0, [r0, ${xoff}]`)
            return
        }

        private writeFailBranch() {
            this.write(`.fail:`)
            this.write(`mov r1, lr`)
            this.write(this.t.callCPP("pxt::failedCast"))
        }

        private emitClassCall(procid: ir.ProcId) {
            let effIdx = procid.virtualIndex + firstMethodOffset()
            this.write(this.t.emit_int(effIdx * 4, "r1"))

            let info = procid.classInfo
            let suff = ""
            if (procid.isThis)
                suff += "_this"
            this.emitLabelledHelper("classCall_" + info.id + suff, () => {
                this.write(`ldr r0, [sp, #0] ; ld-this`)
                this.loadVTable()
                if (!target.switches.skipClassCheck && !procid.isThis)
                    this.checkSubtype(info)
                this.write(`ldr r1, [r3, r1] ; ld-method`)
                this.write(`bx r1 ; keep lr from caller`)
                this.writeFailBranch()
            })
        }

        private helperObject(desc: string) {
            return `.object _pxt_helper_${desc.replace(/[^\w]+/g, "_")} "helper: ${desc}"`
        }

        private emitBindHelper() {
            const maxArgs = 12
            this.write(`
                ${this.helperObject("bind")}
                .section code
                _pxt_bind_helper:
                    push {r0, r2}
                    movs r0, #2
                    ldlit r1, _pxt_bind_lit
                    ${this.t.callCPP("pxt::mkAction")}
                    pop {r1, r2}
                    str r1, [r0, #12]
                    str r2, [r0, #16]
                    bx r4 ; return

                _pxt_bind_lit:
                    ${this.t.obj_header("pxt::RefAction_vtable")}
                    .short 0, 0 ; no captured vars
                    .word .bindCode@fn
                .bindCode:
                    ; r0-bind object, r4-#args
                    cmp r4, #${maxArgs}
                    bge .fail
                    lsls r3, r4, #2
                    ldlit r2, _pxt_copy_list
                    ldr r1, [r2, r3]

                    ldr r3, [r0, #12]
                    ldr r2, [r0, #16]
                    adds r4, r4, #1
                    bx r1
            `)

            this.writeFailBranch()

            this.write(`_pxt_copy_list:`)

            this.write(U.range(maxArgs).map(k => `.word _pxt_bind_${k}@fn`).join("\n"))

            for (let numargs = 0; numargs < maxArgs; numargs++) {
                this.write(`
                _pxt_bind_${numargs}:
                    sub sp, #4
                `)
                // inject recv argument
                for (let i = 0; i < numargs; ++i) {
                    this.write(`ldr r1, [sp, #4*${i + 1}]`)
                    this.write(`str r1, [sp, #4*${i}]`)
                }
                this.write(`
                    push {r3} ; this-ptr
                    mov r1, lr
                    str r1, [sp, #4*${numargs + 1}] ; store LR
                    blx r2
                    ldr r1, [sp, #4*${numargs + 1}]
                    add sp, #8
                    bx r1
                `)
            }
        }

        private ifaceCallCore(numargs: number, getset: string, noObjlit = false) {
            this.write(`
                ldr r2, [r3, #12] ; load mult
                movs r7, r2
                beq .objlit ; built-in types have mult=0
                muls r7, r1
                lsrs r7, r2
                lsls r7, r7, #1 ; r7 - hash offset
                ldr r3, [r3, #4] ; iface table
                adds r3, r3, r7
                ; r0-this, r1-method idx, r2-free, r3-hash entry, r4-num args, r7-free
                `)

            for (let i = 0; i < vtLookups; ++i) {
                if (i > 0)
                    this.write("    adds r3, #2")
                this.write(`
                ldrh r2, [r3, #0] ; r2-offset of descriptor
                ldrh r7, [r2, r3] ; r7-method idx
                cmp r7, r1
                beq .hit
                `)
            }

            if (getset == "get") {
                this.write("movs r0, #0 ; undefined")
                this.write("bx lr")
            } else
                this.write("b .fail2")

            this.write(`
            .hit:
                adds r3, r3, r2 ; r3-descriptor
                ldr r2, [r3, #4]
                lsls r7, r2, #31
                beq .field
            `)

            // here, it's a method entry in iface table

            const callIt = this.t.emit_int(numargs, "r4") + "\n     bx r2"

            if (getset == "set") {
                this.write(`
                    ; check for next descriptor
                    ldrh r7, [r3, #8]
                    cmp r7, r1
                    bne .fail2 ; no setter!
                    ldr r2, [r3, #12]
                    ${callIt}
                `)
            } else {
                this.write(`
                    ; check if it's getter
                    ldrh r7, [r3, #2]
                    cmp r7, #1
                `)
                if (getset == "get") {
                    this.write(`
                        bne .bind
                        ${callIt}
                    .bind:
                        mov r4, lr
                        bl _pxt_bind_helper
                    `)
                } else {
                    this.write(`
                        beq .doublecall
                        ${callIt}
                    .doublecall:
                        ; call getter
                        movs r4, #1
                        push {r0, lr}
                        blx r2
                        pop {r1, r2}
                        mov lr, r2
                        b .moveArgs
                    `)
                }
            }

            if (!noObjlit) {
                this.write(`
                .objlit:
                    ldrh r2, [r3, #8]
                    cmp r2, #${pxt.BuiltInType.RefMap}
                    bne .fail
                    mov r4, lr
                `)

                if (getset == "set") {
                    this.write("ldr r2, [sp, #4] ; ld-val")
                }

                this.write(this.t.callCPP(getset == "set" ? "pxtrt::mapSet" : "pxtrt::mapGet"))

                if (getset) {
                    this.write("bx r4")
                } else {
                    this.write("mov lr, r4")
                    this.write("b .moveArgs")
                }
            }

            this.write(".field:")
            if (getset == "set") {
                this.write(`
                        ldr r3, [sp, #4] ; ld-val
                        str r3, [r0, r2] ; store field
                        bx lr
                    `)
            } else if (getset == "get") {
                this.write(`
                        ldr r0, [r0, r2] ; load field
                        bx lr
                    `)

            } else {
                this.write(`
                        ldr r0, [r0, r2] ; load field
                    `)

            }

            if (!getset) {
                this.write(`.moveArgs:`)

                for (let i = 0; i < numargs; ++i) {
                    if (i == numargs - 1)
                        // we keep the actual lambda value on the stack, so it won't be collected
                        this.write(`movs r1, r0`)
                    else
                        this.write(`ldr r1, [sp, #4*${i + 1}]`)
                    this.write(`str r1, [sp, #4*${i}]`)
                }

                // one argument consumed
                this.lambdaCall(numargs - 1)
            }

            if (noObjlit)
                this.write(".objlit:")

            this.writeFailBranch()

            this.write(`
            .fail2:
                ${this.t.callCPP("pxt::missingProperty")}
            `)
        }

        private emitIfaceCall(procid: ir.ProcId, numargs: number, getset = "") {
            U.assert(procid.ifaceIndex > 0)
            this.write(this.t.emit_int(procid.ifaceIndex, "r1"))

            this.emitLabelledHelper("ifacecall" + numargs + "_" + getset, () => {
                this.write(`ldr r0, [sp, #0] ; ld-this`)
                this.loadVTable()
                this.ifaceCallCore(numargs, getset)
            })
        }

        // vtable in r3; clobber r2
        private checkSubtype(info: ClassInfo, failLbl = ".fail", r2 = "r2") {
            if (!info.classNo) {
                this.write(`b ${failLbl} ; always fails; class never instantiated`)
                return
            }
            this.write(`ldrh ${r2}, [r3, #8]`)
            this.write(`cmp ${r2}, #${info.classNo}`)
            if (info.classNo == info.lastSubtypeNo) {
                this.write(`bne ${failLbl}`) // different class
            } else {
                this.write(`blt ${failLbl}`)
                this.write(`cmp ${r2}, #${info.lastSubtypeNo}`)
                this.write(`bgt ${failLbl}`)
            }
        }

        // keep r0, keep r1, clobber r2, vtable in r3
        private loadVTable(r2 = "r2", taglbl = ".fail", nulllbl = ".fail") {
            this.write(`lsls ${r2}, r0, #30`)
            this.write(`bne ${taglbl}`) // tagged
            this.write(`cmp r0, #0`)
            this.write(`beq ${nulllbl}`) // null

            this.write(`ldr r3, [r0, #0]`)
            this.write("; vtable in R3")
        }

        private emitInstanceOf(info: ClassInfo, tp: string) {
            let lbl = "inst_" + info.id + "_" + tp

            this.emitLabelledHelper(lbl, () => {
                if (tp == "validateNullable")
                    this.loadVTable("r2", ".tagged", ".undefined")
                else
                    this.loadVTable("r2", ".fail", ".fail")
                this.checkSubtype(info)

                if (tp == "bool") {
                    this.write(`movs r0, #${taggedTrue}`)
                    this.write(`bx lr`)
                    this.write(`.fail:`)
                    this.write(`movs r0, #${taggedFalse}`)
                    this.write(`bx lr`)
                } else if (tp == "validate") {
                    this.write(`bx lr`)
                    this.writeFailBranch()
                } else if (tp == "validateNullable") {
                    this.write(`.undefined:`)
                    this.write(`bx lr`)
                    this.write(`.tagged:`)
                    this.write(`cmp r0, #${taggedNull} ; check for null`)
                    this.write(`bne .fail`)
                    this.write(`movs r0, #0`)
                    this.write(`bx lr`)
                    this.writeFailBranch()
                } else {
                    U.oops()
                }
            })
        }

        private emitSharedDef(e: ir.Expr) {
            let arg = e.args[0]
            U.assert(arg.totalUses >= 1)
            U.assert(arg.currUses === 0)
            arg.currUses = 1
            if (arg.totalUses == 1)
                return this.emitExpr(arg)
            else {
                this.emitExpr(arg)
                this.exprStack.unshift(arg)
                this.write(this.t.push_local("r0") + "; tmpstore @" + this.exprStack.length)
            }
        }

        private clearArgs(nonRefs: ir.Expr[], refs: ir.Expr[]) {
            let numArgs = nonRefs.length + refs.length

            let allArgs = nonRefs.concat(refs)
            for (let r of allArgs) {
                if (r.currUses != 0 || r.totalUses != 1) {
                    pxt.log(r.toString())
                    pxt.log(allArgs.map(a => a.toString()))
                    U.oops(`wrong uses: ${r.currUses} ${r.totalUses}`)
                }
                r.currUses = 1
            }
            this.clearStack()
        }

        private builtInClassNo(typeNo: pxt.BuiltInType): ClassInfo {
            return { id: "builtin" + typeNo, classNo: typeNo, lastSubtypeNo: typeNo } as any
        }

        private emitBeginTry(topExpr: ir.Expr) {
            // this.write(`adr r0, ${topExpr.args[0].data}`)
            this.emitExprInto(topExpr.args[0], "r0")
            this.write(`bl _pxt_save_exception_state`)
        }

        private emitRtCall(topExpr: ir.Expr, genCall: () => void = null) {
            let name: string = topExpr.data

            if (name == "pxt::beginTry") {
                return this.emitBeginTry(topExpr)
            }

            let maskInfo = topExpr.mask || { refMask: 0 }
            let convs = maskInfo.conversions || []
            let allArgs = topExpr.args.map((a, i) => ({
                idx: i,
                expr: a,
                isSimple: a.isLiteral(),
                isRef: (maskInfo.refMask & (1 << i)) != 0,
                conv: convs.find(c => c.argIdx == i)
            }))

            U.assert(allArgs.length <= 4)

            let seenUpdate = false
            for (let a of U.reversed(allArgs)) {
                if (a.expr.isPure()) {
                    if (!a.isSimple && !a.isRef)
                        if (!seenUpdate || a.expr.isStateless())
                            a.isSimple = true
                } else {
                    seenUpdate = true
                }
            }

            for (let a of allArgs) {
                // we might want conversion from literal numbers to strings for example
                if (a.conv) a.isSimple = false
            }

            let complexArgs = allArgs.filter(a => !a.isSimple)

            if (complexArgs.every(c => c.expr.isPure() && !c.isRef && !c.conv)) {
                for (let c of complexArgs) c.isSimple = true
                complexArgs = []
            }

            let c0 = complexArgs[0]
            let clearStack = true

            if (complexArgs.length == 1 && !c0.conv && !c0.isRef) {
                this.emitExpr(c0.expr)
                if (c0.idx != 0)
                    this.write(this.t.mov("r" + c0.idx, "r0"))
                clearStack = false
            } else {
                for (let a of complexArgs)
                    this.pushArg(a.expr)

                this.alignExprStack(0)

                let convArgs = complexArgs.filter(a => !!a.conv)
                if (convArgs.length) {
                    const conv = this.redirectOutput(() => {
                        let off = 0
                        if (!target.switches.inlineConversions) {
                            if (this.t.stackAligned())
                                off += 2
                            else
                                off += 1
                        }
                        for (let a of convArgs) {
                            if (isThumb() && a.conv.method == "pxt::toInt") {
                                // SPEED 2.5%
                                this.write(this.loadFromExprStack("r0", a.expr, off))
                                this.write("asrs r0, r0, #1")
                                let idx = target.switches.inlineConversions ? a.expr.getId() : off
                                this.write("bcs .isint" + idx)
                                this.write("lsls r0, r0, #1")
                                this.alignedCall(a.conv.method, "", off)
                                this.write(".isint" + idx + ":")
                                this.write(this.t.push_fixed(["r0"]))
                            } else {
                                this.write(this.loadFromExprStack("r0", a.expr, off))
                                if (a.conv.refTag) {
                                    if (!target.switches.skipClassCheck)
                                        this.emitInstanceOf(this.builtInClassNo(a.conv.refTag),
                                            a.conv.refTagNullable ? "validateNullable" : "validate")
                                } else {
                                    this.alignedCall(a.conv.method, "", off)
                                    if (a.conv.returnsRef)
                                        // replace the entry on the stack with the return value,
                                        // as the original was already decr'ed, but the result
                                        // has yet to be
                                        this.write(this.loadFromExprStack("r0", a.expr, off, true))
                                }
                                this.write(this.t.push_fixed(["r0"]))
                            }
                            off++
                        }
                        for (let a of U.reversed(convArgs)) {
                            off--
                            this.write(this.t.pop_fixed(["r" + a.idx]))
                        }
                        for (let a of complexArgs) {
                            if (!a.conv)
                                this.write(this.loadFromExprStack("r" + a.idx, a.expr, off))
                        }
                    })
                    if (target.switches.inlineConversions)
                        this.write(conv)
                    else
                        this.emitHelper(this.t.helper_prologue() + conv + this.t.helper_epilogue(), "conv")
                } else {
                    // not really worth a helper; some of this will be peep-holed away
                    for (let a of complexArgs)
                        this.write(this.loadFromExprStack("r" + a.idx, a.expr))
                }
            }

            for (let a of allArgs)
                if (a.isSimple)
                    this.emitExprInto(a.expr, "r" + a.idx)

            if (genCall) {
                genCall()
            } else {
                if (name != "langsupp::ignore")
                    this.alignedCall(name, "", 0, true)
            }

            if (clearStack) {
                this.clearArgs(complexArgs.filter(a => !a.isRef).map(a => a.expr),
                    complexArgs.filter(a => a.isRef).map(a => a.expr))
            }
        }

        private alignedCall(name: string, cmt = "", off = 0, saveStack = false) {
            if (U.startsWith(name, "_cmp_") || U.startsWith(name, "_pxt_"))
                saveStack = false
            this.write(this.t.call_lbl(name, saveStack, this.stackAlignmentNeeded(off)) + cmt)
        }

        private emitLabelledHelper(lbl: string, generate: () => void) {
            if (!this.labelledHelpers[lbl]) {
                let outp = this.redirectOutput(generate)
                this.emitHelper(outp, lbl)
                this.labelledHelpers[lbl] = this.bin.codeHelpers[outp];
            } else {
                this.write(this.t.call_lbl(this.labelledHelpers[lbl]))
            }
        }

        private emitHelper(asm: string, baseName = "hlp") {
            if (!this.bin.codeHelpers[asm]) {
                let len = Object.keys(this.bin.codeHelpers).length
                this.bin.codeHelpers[asm] = `_${baseName}_${len}`
            }
            this.write(this.t.call_lbl(this.bin.codeHelpers[asm]))
        }

        private pushToExprStack(a: ir.Expr) {
            a.totalUses = 1
            a.currUses = 0
            this.exprStack.unshift(a)
        }

        private pushArg(a: ir.Expr) {
            this.clearStack(true)
            let bot = this.exprStack.length
            this.emitExpr(a)
            this.clearStack(true)
            this.write(this.t.push_local("r0") + " ; proc-arg")
            this.pushToExprStack(a)
        }

        private loadFromExprStack(r: string, a: ir.Expr, off = 0, store = false) {
            let idx = this.exprStack.indexOf(a)
            assert(idx >= 0)
            return this.t.load_reg_src_off(r, "sp", (idx + off).toString(), true, store) + ` ; estack\n`
        }

        private pushDummy() {
            let dummy = ir.numlit(0)
            dummy.totalUses = 1
            dummy.currUses = 1
            this.exprStack.unshift(dummy)
        }

        private alignExprStack(numargs: number) {
            let interAlign = this.stackAlignmentNeeded(numargs)
            if (interAlign) {
                for (let i = 0; i < interAlign; ++i) {
                    // r5 should be safe to push on gc stack
                    this.write(`push {r5} ; align`)
                    this.pushDummy()
                }
            }
        }

        private emitFieldMethods() {
            for (let op of ["get", "set"]) {
                this.write(`
                ${this.helperObject(op)}
                .section code
                _pxt_map_${op}:
                `)

                this.loadVTable("r4")
                this.checkSubtype(this.builtInClassNo(pxt.BuiltInType.RefMap), ".notmap", "r4")

                this.write(this.t.callCPPPush(op == "set" ? "pxtrt::mapSetByString" : "pxtrt::mapGetByString"))
                this.write(".notmap:")

                let numargs = op == "set" ? 2 : 1
                let hasAlign = false

                this.write("mov r4, r3 ; save VT")

                if (op == "set") {
                    if (target.stackAlign) {
                        hasAlign = true
                        this.write("push {lr} ; align")
                    }
                    this.write(`
                            push {r0, r2, lr}
                            mov r0, r1
                        `)

                } else {
                    this.write(`
                            push {r0, lr}
                            mov r0, r1
                        `)
                }

                this.write(`
                    bl pxtrt::lookupMapKey
                    mov r1, r0 ; put key index in r1
                    ldr r0, [sp, #0] ; restore obj pointer
                    mov r3, r4 ; restore vt
                    bl .dowork
                `)


                this.write(this.t.pop_locals(numargs + (hasAlign ? 1 : 0)))

                this.write("pop {pc}")

                this.write(".dowork:")
                this.ifaceCallCore(numargs, op, true)
            }
        }

        private emitArrayMethod(op: string, isBuffer: boolean) {
            this.write(`
            ${this.helperObject(op + " " + (isBuffer ? "buffer" : "array"))}
            .section code
            _pxt_${isBuffer ? "buffer" : "array"}_${op}:
            `)

            this.loadVTable("r4")

            let classNo = this.builtInClassNo(!isBuffer ?
                pxt.BuiltInType.RefCollection : pxt.BuiltInType.BoxedBuffer)
            if (!target.switches.skipClassCheck)
                this.checkSubtype(classNo, ".fail", "r4")

            // on linux we use 32 bits for array size
            const ldrSize = isStackMachine() || target.runtimeIsARM || isBuffer ? "ldr" : "ldrh"

            this.write(`
                asrs r1, r1, #1
                bcc .notint
                ${ldrSize} r4, [r0, #${isBuffer ? 4 : 8}]
                cmp r1, r4
                bhs .oob
            `)

            let off = "r1"
            if (isBuffer) {
                off = "#8"
                this.write(`
                    adds r4, r0, r1
                `);
            } else {
                this.write(`
                    lsls r1, r1, #2
                    ldr r4, [r0, #4]
                `);
            }

            let suff = isBuffer ? "b" : ""
            let conv = isBuffer && op == "get" ? "lsls r0, r0, #1\nadds r0, #1" : ""

            if (op == "set") {
                this.write(`
                        str${suff} r2, [r4, ${off}]
                        bx lr
                    `)
            } else {
                this.write(`
                        ldr${suff} r0, [r4, ${off}]
                        ${conv}
                        bx lr
                    `)
            }

            this.write(`
            .notint:
                lsls r1, r1, #1
                ${this.t.pushLR()}
                push {r0, r2}
                mov r0, r1
                ${this.t.callCPP("pxt::toInt")}
                mov r1, r0
                pop {r0, r2}
            .doop:
                ${this.t.callCPP(`Array_::${op}At`)}
                ${conv}
                ${this.t.popPC()}
            `)

            this.writeFailBranch()

            if (op == "get") {
                this.write(`
                    .oob:
                        movs r0, #${isBuffer ? 1 : 0} ; 0 or undefined
                        bx lr
                `)
            } else {
                this.write(`
                    .oob:
                        ${this.t.pushLR()}
                        b .doop
                `)
            }

        }

        private emitArrayMethods() {
            for (let op of ["get", "set"]) {
                this.emitArrayMethod(op, true)
                this.emitArrayMethod(op, false)
            }
        }

        private emitLambdaTrampoline() {
            let r3 = target.stackAlign ? "r3," : ""
            this.write(`
            ${this.helperObject("trampoline")}
            .section code
            _pxt_lambda_trampoline:
                push {${r3} r4, r5, r6, r7, lr}
                mov r4, r8
                mov r5, r9
                mov r6, r10
                mov r7, r11
                push {r4, r5, r6, r7} ; save high registers
                mov r4, r1
                mov r5, r2
                mov r6, r3
                mov r7, r0
                `)
            // TODO should inline this?
            this.emitInstanceOf(this.builtInClassNo(pxt.BuiltInType.RefAction), "validate")
            this.write(`
                mov r0, sp
                push {r4, r5, r6, r7} ; push args and the lambda
                mov r1, sp
                bl pxt::pushThreadContext
                mov r6, r0          ; save ctx or globals
                mov r5, r7          ; save lambda for closure
                mov r0, r5          ; also save lambda pointer in r0 - needed by pxt::bindMethod
                ldr r1, [r5, #8]    ; ld fnptr
                movs r4, #3         ; 3 args
                blx r1              ; execute the actual lambda
                mov r7, r0          ; save result
                @dummystack 4
                add sp, #4*4        ; remove arguments and lambda
                mov r0, r6   ; or pop the thread context
                bl pxt::popThreadContext
                mov r0, r7 ; restore result
                pop {r4, r5, r6, r7} ; restore high registers
                mov r8, r4
                mov r9, r5
                mov r10, r6
                mov r11, r7
                pop {${r3} r4, r5, r6, r7, pc}`)

            this.write(`
            ${this.helperObject("exn")}
            .section code
            ; r0 - try frame
            ; r1 - handler PC
            _pxt_save_exception_state:
                push {r0, lr}
                ${this.t.callCPP("pxt::beginTry")}
                pop {r1, r4}
                str r1, [r0, #1*4] ; PC
                mov r1, sp
                str r1, [r0, #2*4] ; SP
                str r5, [r0, #3*4] ; lambda ptr
                bx r4
                `)

            this.write(`
            .section code
            ; r0 - try frame
            ; r1 - thread context
            _pxt_restore_exception_state:
                mov r6, r1
                ldr r1, [r0, #2*4] ; SP
                mov sp, r1
                ldr r5, [r0, #3*4] ; lambda ptr
                ldr r1, [r0, #1*4] ; PC
                movs r0, #1
                orrs r1, r0
                bx r1
                `)

            this.write(`
            ${this.helperObject("stringconv")}
            .section code
            _pxt_stringConv:
            `)

            this.loadVTable()
            this.checkSubtype(this.builtInClassNo(pxt.BuiltInType.BoxedString), ".notstring")

            this.write(`
                bx lr

            .notstring: ; no string, but vtable in r3
                ldr r7, [r3, #4*${firstMethodOffset() - 1}]
                cmp r7, #0
                beq .fail
                push {r0, lr}
                movs r4, #1
                blx r7
                str r0, [sp, #0]
                b .numops

            .fail: ; not an object or no toString
                push {r0, lr}
            .numops:
                ${this.t.callCPP("numops::toString")}
                pop {r1}
                pop {pc}
            `)
        }

        private emitProcCall(topExpr: ir.Expr) {
            let complexArgs: ir.Expr[] = []
            let theOne: ir.Expr = null
            let theOneReg = ""
            let procid = topExpr.data as ir.ProcId

            if (procid.proc && procid.proc.inlineBody)
                return this.emitExpr(procid.proc.inlineSelf(topExpr.args))

            let isLambda = procid.virtualIndex == -1

            let seenUpdate = false
            for (let c of U.reversed(topExpr.args)) {
                if (c.isPure()) {
                    if (!seenUpdate || c.isStateless())
                        continue
                } else {
                    seenUpdate = true
                }
                complexArgs.push(c)
            }
            complexArgs.reverse()

            if (complexArgs.length <= 1) {
                // in case there is at most one complex argument, we don't need to re-push anything
                let a0 = complexArgs[0]
                if (a0) {
                    theOne = a0
                    this.clearStack(true)
                    this.emitExpr(a0)
                    if (a0 == topExpr.args[topExpr.args.length - 1])
                        theOneReg = "r0"
                    else {
                        theOneReg = "r3"
                        this.write(this.t.mov("r3", "r0"))
                    }
                }
                complexArgs = []
            } else {
                for (let a of complexArgs)
                    this.pushArg(a)
            }

            this.alignExprStack(topExpr.args.length)

            // available registers; r7 can be used in loading globals, don't use it
            let regList = ["r1", "r2", "r3", "r4"]
            let regExprs: ir.Expr[] = []

            if (complexArgs.length) {
                let maxDepth = -1
                for (let c of complexArgs) {
                    maxDepth = Math.max(this.exprStack.indexOf(c), maxDepth)
                }
                maxDepth++
                // we have 6 registers to play with
                if (maxDepth <= regList.length) {
                    regList = regList.slice(0, maxDepth)
                    this.write(this.t.pop_fixed(regList))
                    regExprs = this.exprStack.splice(0, maxDepth)

                    // now push anything that isn't an argument
                    let pushList: string[] = []
                    for (let i = maxDepth - 1; i >= 0; --i) {
                        if (complexArgs.indexOf(regExprs[i]) < 0) {
                            pushList.push(regList[i])
                            this.exprStack.unshift(regExprs[i])
                        }
                    }
                    if (pushList.length)
                        this.write(this.t.push_fixed(pushList))
                } else {
                    regList = null
                    this.write(this.t.reg_gets_imm("r7", 0))
                }
            }

            let argsToPush = U.reversed(topExpr.args)
            // for lambda, move the first argument (lambda object) to the end
            if (isLambda)
                argsToPush.unshift(argsToPush.pop())

            for (let a of argsToPush) {
                if (complexArgs.indexOf(a) >= 0) {
                    if (regList) {
                        this.write(this.t.push_fixed([regList[regExprs.indexOf(a)]]))
                    } else {
                        this.write(this.loadFromExprStack("r0", a))
                        this.write(this.t.push_local("r0") + " ; re-push")
                        this.write(this.loadFromExprStack("r7", a, 1, true))
                        let idx = this.exprStack.indexOf(a)
                        let theNull = ir.numlit(0)
                        theNull.currUses = 1
                        theNull.totalUses = 1
                        this.exprStack[idx] = theNull
                    }
                    this.exprStack.unshift(a)
                } else if (a === theOne) {
                    this.write(this.t.push_local(theOneReg) + " ; the one arg")
                    this.pushToExprStack(a)
                } else {
                    this.pushArg(a)
                }
            }

            let lbl = this.mkLbl("_proccall")

            let procIdx = -1
            if (isLambda) {
                let numargs = topExpr.args.length - 1
                this.write(this.loadFromExprStack("r0", topExpr.args[0]))
                this.emitLabelledHelper("lambda_call" + numargs, () => {
                    this.lambdaCall(numargs)
                    this.writeFailBranch()
                })
            } else if (procid.virtualIndex != null || procid.ifaceIndex != null) {
                if (procid.ifaceIndex != null) {
                    if (procid.isSet) {
                        assert(topExpr.args.length == 2)
                        this.emitIfaceCall(procid, topExpr.args.length, "set")
                    } else {
                        this.emitIfaceCall(procid, topExpr.args.length, procid.noArgs ? "get" : "")
                    }
                } else {
                    this.emitClassCall(procid)
                }
                this.write(lbl + ":")
            } else {
                let proc = procid.proc
                procIdx = proc.seqNo
                this.write(this.t.call_lbl(proc.label() + (procid.isThis ? "_nochk" : "")))
                this.write(lbl + ":")
            }
            this.calls.push({
                procIndex: procIdx,
                stack: 0,
                addr: 0,
                callLabel: lbl,
            })

            // note that we have to treat all arguments as refs,
            // because the procedure might have overriden them and we need to unref them
            // this doesn't apply to the lambda expression itself though
            if (isLambda && topExpr.args[0].isStateless()) {
                this.clearArgs([topExpr.args[0]], topExpr.args.slice(1))
            } else {
                this.clearArgs([], topExpr.args)
            }
        }

        private lambdaCall(numargs: number) {
            this.write("; lambda call")
            this.loadVTable()
            if (!target.switches.skipClassCheck)
                this.checkSubtype(this.builtInClassNo(pxt.BuiltInType.RefAction))
            // the conditional branch below saves stack space for functions that do not require closure
            this.write(`
                movs r4, #${numargs}
                ldrh r1, [r0, #4]
                cmp r1, #0
                bne .pushR5
                ldr r1, [r0, #8]
                bx r1 ; keep lr from the caller
            .pushR5:
                sub sp, #8
            `)

            // move arguments two steps up
            for (let i = 0; i < numargs; ++i) {
                this.write(`ldr r1, [sp, #4*${i + 2}]`)
                this.write(`str r1, [sp, #4*${i}]`)
            }

            // save lr and r5 (outer lambda ctx) in the newly free spots
            this.write(`
                str r5, [sp, #4*${numargs}]
                mov r1, lr
                str r1, [sp, #4*${numargs + 1}]
                mov r5, r0
                ldr r7, [r5, #8]
                blx r7 ; exec actual lambda
                ldr r4, [sp, #4*${numargs + 1}] ; restore what was in LR
                ldr r5, [sp, #4*${numargs}] ; restore lambda ctx
            `)

            // move arguments back where they were
            for (let i = 0; i < numargs; ++i) {
                this.write(`ldr r1, [sp, #4*${i}]`)
                this.write(`str r1, [sp, #4*${i + 2}]`)
            }

            this.write(`
                add sp, #8
                bx r4
            `)

            this.write("; end lambda call")
        }

        private emitStore(trg: ir.Expr, src: ir.Expr) {
            switch (trg.exprKind) {
                case ir.EK.CellRef:
                    let cell = trg.data as ir.Cell
                    this.emitExpr(src)
                    if (cell.isGlobal()) {
                        let inf = this.bitSizeInfo(cell.bitSize)
                        let off = "#" + cell.index
                        if (cell.index >= inf.immLimit) {
                            this.write(this.t.emit_int(cell.index, "r1"))
                            off = "r1"
                        }

                        this.write(this.t.load_reg_src_off("r7", "r6", "#0"))
                        this.write(this.t.load_reg_src_off("r0", "r7", off, false, true, inf))
                    } else {
                        let [reg, imm, off] = this.cellref(cell)
                        this.write(this.t.load_reg_src_off("r0", reg, imm, off, true))
                    }
                    break;
                case ir.EK.FieldAccess:
                    this.emitRtCall(ir.rtcall("dummy", [trg.args[0], src]), () => this.emitFieldAccess(trg, true))
                    break;
                default: oops();
            }
        }

        private cellref(cell: ir.Cell): [string, string, boolean] {
            if (cell.isGlobal()) {
                throw oops()
            } else if (cell.iscap) {
                let idx = cell.index + 3
                assert(0 <= idx && idx < 32)
                return ["r5", idx.toString(), true]
            } else if (cell.isarg) {
                let idx = cell.index
                return ["sp", "args@" + idx.toString() + ":" + this.baseStackSize, false]
            } else {
                return ["sp", "locals@" + cell.index, false]
            }
        }

        private emitLambdaWrapper(isMain: boolean) {
            this.write("")
            this.write(".section code");

            this.write(".balign 4");

            if (isMain)
                this.proc.info.usedAsValue = true

            if (!this.proc.info.usedAsValue && !this.proc.info.usedAsIface)
                return

            // TODO can use InlineRefAction_vtable or something to limit the size of the thing

            if (this.proc.info.usedAsValue) {
                this.write(this.proc.label() + "_Lit:");
                this.write(this.t.obj_header("pxt::RefAction_vtable"));
                this.write(`.short 0, 0 ; no captured vars`)
                this.write(`.word ${this.proc.label()}_args@fn`)
            }

            this.write(`${this.proc.label()}_args:`)

            let numargs = this.proc.args.length
            if (numargs == 0)
                return

            this.write(`cmp r4, #${numargs}`)
            this.write(`bge ${this.proc.label()}_nochk`)

            let needsAlign = this.stackAlignmentNeeded(numargs + 1)

            let numpush = needsAlign ? numargs + 2 : numargs + 1

            this.write(`push {lr}`)

            this.emitLabelledHelper(`expand_args_${numargs}`, () => {
                this.write(`movs r0, #0`)
                this.write(`movs r1, #0`)
                if (needsAlign)
                    this.write(`push {r0}`)
                for (let i = numargs; i > 0; i--) {
                    if (i != numargs) {
                        this.write(`cmp r4, #${i}`)
                        this.write(`blt .zero${i}`)
                        this.write(`ldr r0, [sp, #${numpush - 1}*4]`)
                        this.write(`str r1, [sp, #${numpush - 1}*4] ; clear existing`)
                        this.write(`.zero${i}:`)
                    }
                    this.write(`push {r0}`)
                }
                this.write(`bx lr`)
            })

            this.write(`bl ${this.proc.label()}_nochk`)

            let stackSize = numargs + (needsAlign ? 1 : 0)
            this.write(`@dummystack ${stackSize}`)
            this.write(`add sp, #4*${stackSize}`)
            this.write(`pop {pc}`)
        }

        private emitCallRaw(name: string) {
            let inf = hexfile.lookupFunc(name)
            assert(!!inf, "unimplemented raw function: " + name)
            this.alignedCall(name)
        }
    }
}
