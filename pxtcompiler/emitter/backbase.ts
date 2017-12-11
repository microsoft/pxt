namespace ts.pxtc {

    export var decodeBase64 = function (s: string) { return atob(s); }

    // supporting multiple sizes (byte, short, int, long)
    export interface BitSizeInfo {
        size: number;
        needsSignExt?: boolean;
        immLimit: number;
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
    // - for calls to user functions, all arguments passed on stack

    export abstract class AssemblerSnippets {
        nop() { return "TBD " }
        reg_gets_imm(reg: string, imm: number) { return "TBD" }
        // Registers are stored on the stack in numerical order 
        proc_setup(main?: boolean) { return "TBD" }
        push_fixed(reg: string[]) { return "TBD" }
        push_local(reg: string) { return "TBD" }
        proc_setup_end() { return "" }
        pop_fixed(reg: string[]) { return "TBD" }
        pop_locals(n: number) { return "TBD" }
        proc_return() { return "TBD" }
        debugger_hook(lbl: string) { return "TBD" }
        debugger_bkpt(lbl: string) { return "TBD" }
        breakpoint() { return "TBD" }
        unconditional_branch(lbl: string) { return "TBD" }
        beq(lbl: string) { return "TBD" }
        bne(lbl: string) { return "TBD" }
        cmp(reg1: string, reg: string) { return "TBD" }
        cmp_zero(reg1: string) { return "TBD" }
        // load_reg_src_off is load/store indirect
        // word? - does offset represent an index that must be multiplied by word size?
        // inf?  - control over size of referenced data
        // str?  - true=Store/false=Load
        // src - can range over

        load_reg_src_off(reg: string, src: string, off: string, word?: boolean, store?: boolean, inf?: BitSizeInfo) { return "TBD"; }
        rt_call(name: string, r0: string, r1: string) { return "TBD"; }
        call_lbl(lbl: string) { return "TBD" }
        call_reg(reg: string) { return "TBD" }
        vcall(mapMethod: string, isSet: boolean, vtableShift: number) { return "TBD" }
        prologue_vtable(arg_index: number, vtableShift: number) { return "TBD" }
        lambda_prologue() { return "TBD" }
        lambda_epilogue() { return "TBD" }
        load_ptr(lbl: string, reg: string) { return "TBD" }

        emit_int(v: number, reg: string) { return "TBD" }
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

        private t: AssemblerSnippets;
        private bin: Binary;
        private resText = ""
        private exprStack: ir.Expr[] = []
        private calls: ProcCallInfo[] = []
        private proc: ir.Procedure = null;

        constructor(t: AssemblerSnippets, bin: Binary, proc: ir.Procedure) {
            this.t = t;
            this.bin = bin;
            this.proc = proc;
            this.work();
        }

        private write = (s: string) => { this.resText += asmline(s); }

        public getAssembly() {
            return this.resText;
        }

        private work() {
            this.write(`
;
; Function ${this.proc.getName()}
;
`)

            if (this.proc.args.length <= 3)
                this.emitLambdaWrapper(this.proc.isRoot)

            let baseLabel = this.proc.label()
            let bkptLabel = baseLabel + "_bkpt"
            let locLabel = baseLabel + "_locals"
            this.write(`
.section code
${bkptLabel}:`)
            this.write(this.t.breakpoint())
            this.write(`
${baseLabel}:
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
                    codeStartLoc: U.lookup(labels, bkptLabel + "_after"),
                    bkptLoc: U.lookup(labels, bkptLabel),
                    localsMark: U.lookup(th.stackAtLabel, locLabel),
                    idx: this.proc.seqNo,
                    calls: this.calls
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
                        assert(off === this.proc.debugInfo.localsMark)
                    }
                }
            }

            this.write(this.t.proc_setup(true))
            // initialize the locals
            let numlocals = this.proc.locals.length
            if (numlocals > 0)
                this.write(this.t.reg_gets_imm("r0", 0));
            this.proc.locals.forEach(l => {
                this.write(this.t.push_local("r0") + " ;loc")
            })
            this.write(this.t.proc_setup_end())

            this.write("@stackmark locals")
            this.write(`${locLabel}:`)

            //console.log(proc.toString())
            this.proc.resolve()
            //console.log("OPT", proc.toString())

            // debugger hook - bit #1 of global #0 determines break on function entry
            // we could have put the 'bkpt' inline, and used `bpl`, but that would be 2 cycles slower
            this.write(this.t.debugger_hook(bkptLabel))

            for (let i = 0; i < this.proc.body.length; ++i) {
                let s = this.proc.body[i]
                // console.log("STMT", s.toString())
                switch (s.stmtKind) {
                    case ir.SK.Expr:
                        this.emitExpr(s.expr)
                        break;
                    case ir.SK.StackEmpty:
                        if (this.exprStack.length > 0) {
                            for (let stmt of this.proc.body.slice(i - 4, i + 1))
                                console.log(`PREVSTMT ${stmt.toString().trim()}`)
                            for (let e of this.exprStack)
                                console.log(`EXPRSTACK ${e.currUses}/${e.totalUses} E: ${e.toString()}`)
                            oops("stack should be empty")
                        }
                        this.write("@stackempty locals")
                        break;
                    case ir.SK.Jmp:
                        this.emitJmp(s);
                        break;
                    case ir.SK.Label:
                        this.write(s.lblName + ":")
                        break;
                    case ir.SK.Breakpoint:
                        this.write(`__brkp_${s.breakpointInfo.id}:`)
                        if (s.breakpointInfo.isDebuggerStmt) {
                            let lbl = this.mkLbl("debugger")
                            // bit #0 of debugger register is set when debugger is attached
                            this.t.debugger_bkpt(lbl)
                        } else {
                            // do nothing
                        }
                        break;
                    default: oops();
                }
            }

            assert(0 <= numlocals && numlocals < 127);
            if (numlocals > 0)
                this.write(this.t.pop_locals(numlocals))
            this.write(this.t.proc_return())
            this.write("@stackempty func");
            this.write("@stackempty args")
        }

        private mkLbl(root: string) {
            return "." + root + this.bin.lblNo++
        }

        private terminate(expr: ir.Expr) {
            assert(expr.exprKind == ir.EK.SharedRef)
            let arg = expr.args[0]
            if (arg.currUses == arg.totalUses)
                return
            let numEntries = 0
            while (numEntries < this.exprStack.length) {
                let ee = this.exprStack[numEntries]
                if (ee != arg && ee.currUses != ee.totalUses)
                    break
                numEntries++
            }
            assert(numEntries > 0)
            this.write(`@dummystack ${numEntries}`)
            this.write(this.t.pop_locals(numEntries))

        }

        private emitJmp(jmp: ir.Stmt) {
            if (jmp.jmpMode == ir.JmpMode.Always) {
                if (jmp.expr)
                    this.emitExpr(jmp.expr)
                if (jmp.terminateExpr)
                    this.terminate(jmp.terminateExpr)
                this.write(this.t.unconditional_branch(jmp.lblName) + " ; with expression")
            } else {
                let lbl = this.mkLbl("jmpz")

                if (jmp.jmpMode == ir.JmpMode.IfJmpValEq) {
                    this.emitExprInto(jmp.expr, "r1")
                    this.write(this.t.cmp("r0", "r1"))
                } else {
                    this.emitExpr(jmp.expr)

                    // TODO: remove ARM-specific code
                    if (jmp.expr.exprKind == ir.EK.RuntimeCall && jmp.expr.data === "thumb::subs") {
                        // no cmp required
                    } else {
                        this.write(this.t.cmp_zero("r0"))
                    }
                }

                if (jmp.jmpMode == ir.JmpMode.IfNotZero) {
                    this.write(this.t.beq(lbl)) // this is to *skip* the following 'b' instruction; beq itself has a very short range
                } else {
                    // IfZero or IfJmpValEq
                    this.write(this.t.bne(lbl))
                }

                if (jmp.terminateExpr)
                    this.terminate(jmp.terminateExpr)

                this.write(this.t.unconditional_branch(jmp.lblName))
                this.write(lbl + ":")
            }
        }

        private clearStack() {
            let numEntries = 0
            while (this.exprStack.length > 0 && this.exprStack[0].currUses == this.exprStack[0].totalUses) {
                numEntries++;
                this.exprStack.shift()
            }
            if (numEntries)
                this.write(this.t.pop_locals(numEntries))
        }

        private withRef(name: string, isRef: boolean) {
            return name + (isRef ? "Ref" : "")
        }

        private emitExprInto(e: ir.Expr, reg: string) {
            switch (e.exprKind) {
                case ir.EK.NumberLiteral:
                    if (e.data === true) this.write(this.t.emit_int(1, reg))
                    else if (e.data === false) this.write(this.t.emit_int(0, reg))
                    else if (e.data === null) this.write(this.t.emit_int(0, reg))
                    else if (typeof e.data == "number") this.write(this.t.emit_int(e.data, reg))
                    else oops();
                    break;
                case ir.EK.PointerLiteral:
                    this.write(this.t.load_ptr(e.data, reg))
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
                        this.write(this.t.load_reg_src_off(reg, "sp", idx.toString(), true) + ` ; tmpref @${this.exprStack.length - idx}`)
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
                        this.write(this.t.load_reg_src_off(reg, "r6", off, false, false, inf))
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
            //console.log(`EMITEXPR ${e.sharingInfo()} E: ${e.toString()}`)

            switch (e.exprKind) {
                case ir.EK.JmpValue:
                    this.write("; jmp value (already in r0)")
                    break;
                case ir.EK.Nop:
                    // this is there because we need different addresses for breakpoints
                    this.write(this.t.nop())
                    break;
                case ir.EK.Incr:
                    this.emitExpr(e.args[0])
                    this.emitCallRaw("pxt::incr")
                    break;
                case ir.EK.Decr:
                    this.emitExpr(e.args[0])
                    this.emitCallRaw("pxt::decr")
                    break;
                case ir.EK.FieldAccess:
                    let info = e.data as FieldAccessInfo
                    // it does the decr itself, no mask
                    return this.emitExpr(ir.rtcall(this.withRef("pxtrt::ldfld", info.isRef), [e.args[0], ir.numlit(info.idx)]))
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
                default:
                    return this.emitExprInto(e, "r0")
            }
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

        private emitSharedTerminate(e: ir.Expr) {
            this.emitExpr(e)
            let arg = e.data as ir.Expr
            // ??? missing ???
        }

        private emitRtCall(topExpr: ir.Expr) {
            let info = ir.flattenArgs(topExpr)

            info.precomp.forEach(e => this.emitExpr(e))
            info.flattened.forEach((a, i) => {
                U.assert(i <= 3)
                this.emitExprInto(a, "r" + i)
            })

            this.clearStack()

            let name: string = topExpr.data
            //console.log("RT",name,topExpr.isAsync)

            if (name == "thumb::ignore")
                return

            if (U.startsWith(name, "thumb::")) {
                this.write(this.t.rt_call(name.slice(7), "r0", "r1"))
            } else {
                this.write(this.t.call_lbl(name))
            }
        }

        private emitHelper(asm: string) {
            if (!this.bin.codeHelpers[asm]) {
                let len = Object.keys(this.bin.codeHelpers).length
                this.bin.codeHelpers[asm] = "_hlp_" + len
            }
            this.write(this.t.call_lbl(this.bin.codeHelpers[asm]))
        }

        private emitProcCall(topExpr: ir.Expr) {
            let stackBottom = 0
            //console.log("PROCCALL", topExpr.toString())
            let argStmts = topExpr.args.map((a, i) => {
                this.emitExpr(a)
                this.write(this.t.push_local("r0") + " ; proc-arg")
                a.totalUses = 1
                a.currUses = 0
                this.exprStack.unshift(a)
                if (i == 0) stackBottom = this.exprStack.length
                U.assert(this.exprStack.length - stackBottom == i)
                return a
            })

            let lbl = this.mkLbl("proccall")
            let afterall = this.mkLbl("afterall")

            let procid = topExpr.data as ir.ProcId
            let procIdx = -1
            if (procid.virtualIndex != null || procid.ifaceIndex != null) {
                if (procid.mapMethod) {
                    let isSet = /Set/.test(procid.mapMethod)
                    assert(isSet == (topExpr.args.length == 2))
                    assert(!isSet == (topExpr.args.length == 1))
                    this.write(this.t.emit_int(procid.mapIdx, "r1"))
                    if (isSet)
                        this.write(this.t.emit_int(procid.ifaceIndex, "r2"))
                    this.write(lbl + ":")
                    this.emitHelper(this.t.vcall(procid.mapMethod, isSet, vtableShift))
                } else {
                    this.write(this.t.prologue_vtable(topExpr.args.length - 1, vtableShift))

                    let effIdx = procid.virtualIndex + 4
                    if (procid.ifaceIndex != null) {
                        this.write(this.t.load_reg_src_off("r0", "r0", "#4") + " ; iface table")
                        effIdx = procid.ifaceIndex
                    }
                    if (effIdx <= 31) {
                        this.write(this.t.load_reg_src_off("r0", "r0", effIdx.toString(), true) + " ; ld-method")
                    } else {
                        this.write(this.t.emit_int(effIdx * 4, "r1"))
                        this.write(this.t.load_reg_src_off("r0", "r0", "r1") + " ; ld-method")
                    }

                    this.write(lbl + ":")
                    this.write(this.t.call_reg("r0"))
                    this.write(afterall + ":")
                }
            } else {
                let proc = procid.proc
                procIdx = proc.seqNo
                this.write(lbl + ":")
                this.write(this.t.call_lbl(proc.label()))
            }
            this.calls.push({
                procIndex: procIdx,
                stack: 0,
                addr: 0,
                callLabel: lbl,
            })
            for (let a of argStmts) {
                a.currUses = 1
            }
            this.clearStack()
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
                        this.write(this.t.load_reg_src_off("r0", "r6", off, false, true, inf))
                    } else {
                        let [reg, imm, off] = this.cellref(cell)
                        this.write(this.t.load_reg_src_off("r0", reg, imm, off, true))
                    }
                    break;
                case ir.EK.FieldAccess:
                    let info = trg.data as FieldAccessInfo
                    // it does the decr itself, no mask
                    this.emitExpr(ir.rtcall(this.withRef("pxtrt::stfld", info.isRef), [trg.args[0], ir.numlit(info.idx), src]))
                    break;
                default: oops();
            }
        }

        private cellref(cell: ir.Cell): [string, string, boolean] {
            if (cell.isGlobal()) {
                throw oops()
            } else if (cell.iscap) {
                assert(0 <= cell.index && cell.index < 32)
                return ["r5", cell.index.toString(), true]
            } else if (cell.isarg) {
                let idx = this.proc.args.length - cell.index - 1
                return ["sp", "args@" + idx.toString(), false]
            } else {
                return ["sp", "locals@" + cell.index, false]
            }
        }

        private emitLambdaWrapper(isMain: boolean) {
            let node = this.proc.action
            this.write("")
            this.write(".section code");
            if (isMain)
                this.write(this.t.unconditional_branch(".themain"))
            this.write(".balign 4");
            this.write(this.proc.label() + "_Lit:");
            this.write(".short 0xffff, 0x0000   ; action literal");
            this.write("@stackmark litfunc");
            if (isMain)
                this.write(".themain:")
            let parms = this.proc.args.map(a => a.def)
            this.write(this.t.proc_setup())
            this.write(this.t.push_fixed(["r5", "r6"]))
            if (parms.length >= 1)
                this.write(this.t.push_local("r1"))

            parms.forEach((_, i) => {
                if (i >= 3)
                    U.userError(U.lf("only up to three parameters supported in lambdas"))
                if (i > 0) // r1 already done
                    this.write(this.t.push_local(`r${i + 1}`))
            })
            this.write(this.t.proc_setup_end())

            let asm = this.t.lambda_prologue()

            this.proc.args.forEach((p, i) => {
                if (p.isRef()) {
                    let [reg, off, idx] = this.cellref(p)
                    asm += this.t.load_reg_src_off("r0", reg, off, idx) + "\n"
                    asm += this.t.call_lbl("pxt::incr") + "\n"
                }
            })

            asm += this.t.lambda_epilogue()

            this.emitHelper(asm) // using shared helper saves about 3% of binary size
            this.write(this.t.call_lbl(this.proc.label()))

            if (parms.length)
                this.write(this.t.pop_locals(parms.length))
            this.write(this.t.pop_fixed(["r6", "r5"]))
            this.write(this.t.proc_return())
            this.write("@stackempty litfunc");
        }

        private emitCallRaw(name: string) {
            let inf = hex.lookupFunc(name)
            assert(!!inf, "unimplemented raw function: " + name)
            this.write(this.t.call_lbl(name) + " ; *" + inf.type + inf.args + " (raw)")
        }
    }
}
