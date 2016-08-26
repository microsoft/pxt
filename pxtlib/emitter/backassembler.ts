// base class for generating assembly code 

namespace ts.pxtc {

    abstract class AssemblySnippets {
        public reg_gets_imm(reg: string, imm: number) { return "TBD" }
        public push(reg: string) { return "TBD" }
        public pop(reg: string) { return "TBD" }
        public debugger_hook(lbl: string) { return "TBD" }
        public debugger_bkpt(lbl: string) { return "TBD" }
        public pop_locals(n: number) { return "TBD" }
        public pop_pc() { return "TBD" }
        public unconditional_branch() { return "TBD" }
        public beq() { return "TBD" }
        public bne() { return "TBD" }
        public cmp(o1: string, o2: string) { return "TBD" }
        public load_reg_sp_off(reg: string, off: number) { return "TBD"; }
    }

    // we have a very simple code generation strategy
    class ThumbSnippets extends AssemblySnippets {
        public reg_gets_imm(reg: string, imm: number) {
            return `movs ${reg}, #${imm}`
        }
        public push(reg: string) { return `push {${reg}} ` }
        public pop(reg: string) { return `pop {${reg}} ` }

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

        public pop_locals(n: number) { return `add sp, #4*${n} ; pop locals${n}` }
        public pop_pc() { return "pop {pc}" }
        public unconditional_branch() { return "bb "; }
        public beq() { return "beq " }
        public bne() { return "bne " }
        public cmp(o1: string, o2: string) { return "cmp " + o1 + ", " + o2 }
        public load_reg_sp_off(reg: string, off: number) {
            return `ldr ${reg}, [sp, #4*${off}]`
        }
    }


    class ProcToAssembly {

        private t: AssemblySnippets;
        private bin: Binary;
        private resText = ""
        private exprStack: ir.Expr[] = []
        private calls: ProcCallInfo[] = []
        private proc: ir.Procedure = null;

        constructor(t: AssemblySnippets, bin: Binary, proc: ir.Procedure) {
            this.t = t;
            this.bin = bin;
            this.proc = proc;
            this.work(proc);
        }

        private write = (s: string) => { this.resText += asmline(s); }

        public getAssembly() {
            return this.resText;

        }
        private work(proc: ir.Procedure) {

            this.write(`
;
; Function ${proc.getName()}
;
`)

            if (proc.args.length <= 2)
                this.emitLambdaWrapper(proc.isRoot)

            let baseLabel = proc.label()
            let bkptLabel = baseLabel + "_bkpt"
            let locLabel = baseLabel + "_locals"
            this.write(`
.section code
${bkptLabel}:
    bkpt 1
${baseLabel}:
    @stackmark func
    @stackmark args
    push {lr}
`)
            //TODO: push{lr} above needs to be generalized

            proc.fillDebugInfo = th => {
                let labels = th.getLabels()

                proc.debugInfo = {
                    locals: (proc.seqNo == 1 ? this.bin.globals : proc.locals).map(l => l.getDebugInfo()),
                    args: proc.args.map(l => l.getDebugInfo()),
                    name: proc.getName(),
                    codeStartLoc: U.lookup(labels, bkptLabel + "_after"),
                    bkptLoc: U.lookup(labels, bkptLabel),
                    localsMark: U.lookup(th.stackAtLabel, locLabel),
                    idx: proc.seqNo,
                    calls: this.calls
                }

                for (let ci of this.calls) {
                    ci.addr = U.lookup(labels, ci.callLabel)
                    ci.stack = U.lookup(th.stackAtLabel, ci.callLabel)
                    ci.callLabel = undefined // don't waste space
                }

                for (let i = 0; i < proc.body.length; ++i) {
                    let bi = proc.body[i].breakpointInfo
                    if (bi) {
                        let off = U.lookup(th.stackAtLabel, `__brkp_${bi.id}`)
                        assert(off === proc.debugInfo.localsMark)
                    }
                }
            }

            let numlocals = proc.locals.length
            // ARM-specific
            if (numlocals > 0) this.write(this.t.reg_gets_imm("r0", 0));
            proc.locals.forEach(l => {
                this.write(this.t.push("r0"))
            });
            this.write("@stackmark locals")
            this.write(`${locLabel}:`)

            //console.log(proc.toString())
            proc.resolve()
            //console.log("OPT", proc.toString())

            // debugger hook - bit #1 of global #0 determines break on function entry
            // we could have put the 'bkpt' inline, and used `bpl`, but that would be 2 cycles slower
            this.write(this.t.debugger_hook(bkptLabel))

            for (let i = 0; i < proc.body.length; ++i) {
                let s = proc.body[i]
                // console.log("STMT", s.toString())
                switch (s.stmtKind) {
                    case ir.SK.Expr:
                        this.emitExpr(s.expr)
                        break;
                    case ir.SK.StackEmpty:
                        if (this.exprStack.length > 0) {
                            for (let stmt of proc.body.slice(i - 4, i + 1))
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
            this.write(this.t.pop_pc());
            this.write("@stackempty func");
            this.write("@stackempty args")

            return this.resText
        }

        private mkLbl(root: string) {
            return "." + root + this.bin.lblNo++;
        }

        private emitJmp(jmp: ir.Stmt) {
            if (jmp.jmpMode == ir.JmpMode.Always) {
                if (jmp.expr)
                    this.emitExpr(jmp.expr)
                this.write(this.t.unconditional_branch() + jmp.lblName + " ; with expression")
            } else {
                let lbl = this.mkLbl("jmpz")

                if (jmp.jmpMode == ir.JmpMode.IfJmpValEq) {
                    this.emitExprInto(jmp.expr, "r1")
                    this.write(this.t.cmp("r0", "r1"))
                } else {
                    this.emitExpr(jmp.expr)

                    if (jmp.expr.exprKind == ir.EK.RuntimeCall && jmp.expr.data === "thumb::subs") {
                        // no cmp required
                    } else {
                        this.write(this.t.cmp("r0", "#0"))
                    }
                }

                if (jmp.jmpMode == ir.JmpMode.IfNotZero) {
                    this.write(this.t.beq() + lbl) // this is to *skip* the following 'b' instruction; beq itself has a very short range
                } else {
                    // IfZero or IfJmpValEq
                    this.write(this.t.bne() + lbl)
                }

                this.write(this.t.unconditional_branch() + jmp.lblName)
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
                this.write(this.t.pop_locals(numEntries) + "; clear stack")
        }

        private withRef(name: string, isRef: boolean) {
            return name + (isRef ? "Ref" : "")
        }

        private emitExprInto(e: ir.Expr, reg: string) {
            switch (e.exprKind) {
                case ir.EK.NumberLiteral:
                    if (e.data === true) this.emitInt(1, reg);
                    else if (e.data === false) this.emitInt(0, reg);
                    else if (e.data === null) this.emitInt(0, reg);
                    else if (typeof e.data == "number") this.emitInt(e.data, reg)
                    else oops();
                    break;
                case ir.EK.PointerLiteral:
                    this.emitLdPtr(e.data, reg);
                    break;
                case ir.EK.SharedRef:
                    let arg = e.args[0]
                    U.assert(!!arg.currUses) // not first use
                    U.assert(arg.currUses < arg.totalUses)
                    arg.currUses++
                    let idx = this.exprStack.indexOf(arg)
                    U.assert(idx >= 0)
                    if (idx == 0 && arg.totalUses == arg.currUses) {
                        this.write(this.t.pop(reg) + `; tmpref @${this.exprStack.length}`)
                        this.exprStack.shift()
                        this.clearStack()
                    } else {
                        this.write(this.t.load_reg_sp_off(reg, idx) + `; tmpref @${this.exprStack.length - idx}`)
                    }
                    break;
                case ir.EK.CellRef:
                    let cell = e.data as ir.Cell;
                    // HERE: what is a cellref yield?
                    this.write(`ldr ${reg}, ${this.cellref(cell)}`)
                    break;
                default: oops();
            }
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
                    this.write("nop")
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
                    return e.args.forEach(this.emitExpr)
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
                this.write("push {r0} ; tmpstore @" + this.exprStack.length)
            }
        }

        private emitRtCall(topExpr: ir.Expr) {
            let info = ir.flattenArgs(topExpr)

            info.precomp.forEach(this.emitExpr)
            info.flattened.forEach((a, i) => {
                U.assert(i <= 3)
                this.emitExprInto(a, "r" + i)
            })

            let name: string = topExpr.data
            //console.log("RT",name,topExpr.isAsync)

            if (U.startsWith(name, "thumb::")) {
                this.write(`${name.slice(7)} r0, r1`)
            } else {
                this.write(`bl ${name}`)
            }
        }

        private emitProcCall(topExpr: ir.Expr) {
            let stackBottom = 0
            //console.log("PROCCALL", topExpr.toString())
            let argStmts = topExpr.args.map((a, i) => {
                this.emitExpr(a)
                this.write("push {r0} ; proc-arg")
                a.totalUses = 1
                a.currUses = 0
                this.exprStack.unshift(a)
                if (i == 0) stackBottom = this.exprStack.length
                U.assert(this.exprStack.length - stackBottom == i)
                return a
            })

            let proc = this.bin.procs.filter(p => p.matches(topExpr.data))[0]
            let lbl = this.mkLbl("proccall")
            this.calls.push({
                procIndex: proc.seqNo,
                stack: 0,
                addr: 0,
                callLabel: lbl,
            })
            this.write(lbl + ":")
            this.write("bl " + proc.label())

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
                    this.write("str r0, " + this.cellref(cell))
                    break;
                case ir.EK.FieldAccess:
                    let info = trg.data as FieldAccessInfo
                    // it does the decr itself, no mask
                    this.emitExpr(ir.rtcall(this.withRef("pxtrt::stfld", info.isRef), [trg.args[0], ir.numlit(info.idx), src]))
                    break;
                default: oops();
            }
        }

        private cellref(cell: ir.Cell) {
            if (cell.isGlobal()) {
                return "[r6, #4*" + cell.index + "]"
            } else if (cell.iscap) {
                assert(0 <= cell.index && cell.index < 32)
                return "[r5, #4*" + cell.index + "]"
            } else if (cell.isarg) {
                let idx = this.proc.args.length - cell.index - 1
                return "[sp, args@" + idx + "] ; " + cell.toString()
            } else {
                return "[sp, locals@" + cell.index + "] ; " + cell.toString()
            }
        }

        private emitLambdaWrapper(isMain: boolean) {
            let node = this.proc.action
            this.write("")
            this.write(".section code");
            if (isMain)
                this.write("b .themain")
            this.write(".balign 4");
            this.write(this.proc.label() + "_Lit:");
            this.write(".short 0xffff, 0x0000   ; action literal");
            this.write("@stackmark litfunc");
            if (isMain)
                this.write(".themain:")
            this.write("push {r5, r6, lr}");
            this.write("mov r5, r1");

            let parms = this.proc.args.map(a => a.def)
            parms.forEach((p, i) => {
                if (i >= 2)
                    U.userError(U.lf("only up to two parameters supported in lambdas"))
                this.write(`push {r${i + 2}}`)
            })
            this.write("@stackmark args");

            this.write(`bl pxtrt::getGlobalsPtr`)
            this.write(`mov r6, r0`)

            this.write(`bl ${this.proc.label()}`)

            this.write("@stackempty args")
            if (parms.length)
                this.write("add sp, #4*" + parms.length + " ; pop args")
            this.write("pop {r5, r6, pc}");
            this.write("@stackempty litfunc");
        }

        private emitCallRaw(name: string) {
            let inf = hex.lookupFunc(name)
            assert(!!inf, "unimplemented raw function: " + name)
            this.write("bl " + name + " ; *" + inf.type + inf.args + " (raw)")
        }

        private emitLdPtr(lbl: string, reg: string) {
            assert(!!lbl)
            this.write(`movs ${reg}, ${lbl}@hi  ; ldptr`)
            this.write(`lsls ${reg}, ${reg}, #8`)
            this.write(`adds ${reg}, ${lbl}@lo`);
        }

        private emitInt(v: number, reg: string) {
            function writeMov(v: number) {
                assert(0 <= v && v <= 255)
                this.write(`movs ${reg}, #${v}`)
            }

            function writeAdd(v: number) {
                assert(0 <= v && v <= 255)
                this.write(`adds ${reg}, #${v}`)
            }

            function shift() {
                this.write(`lsls ${reg}, ${reg}, #8`)
            }

            assert(v != null);

            let n = Math.floor(v)
            let isNeg = false
            if (n < 0) {
                isNeg = true
                n = -n
            }

            if (n <= 255) {
                writeMov(n)
            } else if (n <= 0xffff) {
                writeMov((n >> 8) & 0xff)
                shift()
                writeAdd(n & 0xff)
            } else if (n <= 0xffffff) {
                writeMov((n >> 16) & 0xff)
                shift()
                writeAdd((n >> 8) & 0xff)
                shift()
                writeAdd(n & 0xff)
            } else {
                writeMov((n >> 24) & 0xff)
                shift()
                writeAdd((n >> 16) & 0xff)
                shift()
                writeAdd((n >> 8) & 0xff)
                shift()
                writeAdd((n >> 0) & 0xff)
            }
            if (isNeg) {
                this.write(`negs ${reg}, ${reg}`)
            }
        }
    }

}

