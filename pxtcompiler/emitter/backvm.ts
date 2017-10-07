namespace ts.pxtc {
    const vmOpMap: pxt.Map<string> = {
    }

    function shimToVM(shimName: string) {
        return shimName
    }

    function qs(s: string) {
        return JSON.stringify(s)
    }

    function vtableToVM(info: ClassInfo) {
        return vtableToAsm(info)
    }

    export function vmEmit(bin: Binary, opts: CompileOptions) {

        let vmsource = "; VM start\n"
        bin.procs.forEach(p => {
            vmsource += "\n" + irToVM(bin, p) + "\n"
        })
        bin.usedClassInfos.forEach(info => {
            vmsource += vtableToVM(info).replace(/\./g, "")
        })
        U.iterMap(bin.hexlits, (k, v) => {
            vmsource += `static readonly Buffer ${v} = PXT.BufferMethods.createBufferFromHex("${k}");\n`
        })
        let str = 0
        U.iterMap(bin.strings, (k, v) => {
            vmsource += `${v}:\n    ; .string ${qs(k)}\n`
            str += 2 + k.length
        })
        vmsource += "\n; The end.\n"

        let sz = str
        let push = 0
        for (let line of vmsource.split(/\n/)) {
            line = line.replace(/;.*/, "")
            line = line.trim()
            line = line.replace(/^\S+:/, "")
            if (!line) continue
            let m = /^(\w+)( .)?/.exec(line)
            if (m[2]) {
                if (U.endsWith(".s", m[1])) sz += 2
                else sz += 3
            } else {
                sz += 1
                if (m[1] == "push")
                push++
            }
        }

        vmsource = `; Size: ${sz} (incl.: ${str} strings and ${push} pushes)\n` + vmsource
        bin.writeFile(BINARY_ASM, vmsource)
    }

    function irToVM(bin: Binary, proc: ir.Procedure): string {
        let resText = ""
        let writeRaw = (s: string) => { resText += s + "\n"; }
        let write = (s: string) => { resText += "    " + s + "\n"; }
        let EK = ir.EK;
        let maxStack = 0

        //console.log(proc.toString())
        proc.resolve()
        console.log("OPT", proc.toString())

        if (bin.procs[0] == proc) {
            writeRaw(`; main`)
        }

        writeRaw(`${proc.label()}:`)
        write(`locals.s ${proc.locals.length}`)
        writeRaw(`@PRELUDE@`)

        let exprStack: ir.Expr[] = []
        let currCallArgsIdx = 0
        let maxCallArgsIdx = -1

        for (let s of proc.body) {
            switch (s.stmtKind) {
                case ir.SK.Expr:
                    emitExpr(s.expr)
                    break;
                case ir.SK.StackEmpty:
                    for (let e of exprStack) {
                        if (e.totalUses !== e.currUses) {
                            oops(`uses: ${e.currUses}/${e.totalUses} ${e.toString()}`);
                        }
                    }
                    exprStack = [];
                    break;
                case ir.SK.Jmp:
                    emitJmp(s);
                    break;
                case ir.SK.Label:
                    writeRaw(`${s.lblName}:`)
                    break;
                case ir.SK.Breakpoint:
                    break;
                default: oops();
            }
        }

        write(`ret`)
        resText = resText.replace("@PRELUDE@", `    maxstack.s ${maxStack}`)

        return resText

        function emitJmp(jmp: ir.Stmt) {
            let trg = jmp.lbl.lblName
            if (jmp.jmpMode == ir.JmpMode.Always) {
                if (jmp.expr)
                    emitExpr(jmp.expr)
                write(`jmp ${trg}`)
            } else if (jmp.jmpMode == ir.JmpMode.IfJmpValEq) {
                write(`push`)
                emitExpr(jmp.expr)
                write(`push`)
                write(`call2 pxt::eq_bool`)
                write(`jmpnz ${trg}`)
            } else {
                emitExpr(jmp.expr)
                if (jmp.jmpMode == ir.JmpMode.IfNotZero) {
                    write(`jmpnz ${trg}`)
                } else {
                    write(`jmpz ${trg}`)
                }
            }
        }

        function withRef(name: string, isRef: boolean) {
            return name + (isRef ? "Ref" : "")
        }

        function emitExprInto(e: ir.Expr) {
            switch (e.exprKind) {
                case EK.NumberLiteral:
                    if (e.data === 0)
                        write(`ldzero`)
                    else if (e.data === 1)
                        write(`ldone`)
                    else if (0 <= e.data && e.data <= 255)
                        write(`ldconst.s ${e.data}`)
                    else
                        write(`ldconst ${e.data}`)
                    return
                case EK.PointerLiteral:
                    write(`ldptr ${e.data}`)
                    return
                case EK.SharedRef:
                    let arg = e.args[0]
                    U.assert(!!arg.currUses) // not first use
                    U.assert(arg.currUses < arg.totalUses)
                    arg.currUses++
                    let idx = exprStack.indexOf(arg)
                    U.assert(idx >= 0)
                    write(`ldtmp.s ${idx}`)
                    return
                case EK.CellRef:
                    let cell = e.data as ir.Cell;
                    if (cell.isGlobal())
                        write(`ldglb.s ` + cell.index)
                    else if (cell.iscap)
                        write(`ldcap.s ` + cell.index)
                    else
                        write(`ldloc.s ` + cell.index)
                    return

                default: throw oops();
            }
        }

        // result in R0
        function emitExpr(e: ir.Expr): void {
            //console.log(`EMITEXPR ${e.sharingInfo()} E: ${e.toString()}`)

            switch (e.exprKind) {
                case EK.JmpValue:
                    write("; jmp value (already in r0)")
                    break;
                case EK.Nop:
                    write("; nop")
                    break
                case EK.Incr:
                    emitExpr(e.args[0])
                    write("incr")
                    break;
                case EK.Decr:
                    emitExpr(e.args[0])
                    write("decr")
                    break;
                case EK.FieldAccess:
                    let info = e.data as FieldAccessInfo
                    // it does the decr itself, no mask
                    return emitExpr(ir.rtcall(withRef("pxtrt::ldfld", info.isRef), [e.args[0], ir.numlit(info.idx)]))
                case EK.Store:
                    return emitStore(e.args[0], e.args[1])
                case EK.RuntimeCall:
                    return emitRtCall(e);
                case EK.ProcCall:
                    return emitProcCall(e)
                case EK.SharedDef:
                    return emitSharedDef(e)
                case EK.Sequence:
                    return e.args.forEach(emitExpr)
                default:
                    return emitExprInto(e)
            }
        }

        function emitSharedDef(e: ir.Expr) {
            let arg = e.args[0]
            U.assert(arg.totalUses >= 1)
            U.assert(arg.currUses === 0)
            arg.currUses = 1
            if (arg.totalUses == 1)
                return emitExpr(arg)
            else {
                emitExpr(arg)
                let idx = exprStack.length
                exprStack.push(arg)
                maxStack = Math.max(maxStack, exprStack.length)
                write(`sttmp.s ${idx}`)
            }
        }

        function emitRtCall(topExpr: ir.Expr) {
            let info = ir.flattenArgs(topExpr)

            info.precomp.forEach(emitExpr)

            let name: string = topExpr.data
            name = U.lookup(vmOpMap, name) || name

            for (let e of info.flattened) {
                emitExpr(e)
                write(`push`)
            }

            //let inf = hex.lookupFunc(name)

            write(`call${info.flattened.length} ${name}`)
        }

        function emitProcCall(topExpr: ir.Expr) {
            let calledProcId = topExpr.data as ir.ProcId
            let calledProc = calledProcId.proc

            for (let e of topExpr.args) {
                emitExpr(e)
                write(`push`)
            }

            let methIdx = -1
            let fetchAddr = ""

            if (calledProcId.ifaceIndex != null) {
                methIdx = calledProcId.ifaceIndex
                fetchAddr = "pxtrt::getIfaceMethod"
            } else if (calledProcId.virtualIndex != null) {
                methIdx = calledProcId.virtualIndex
                fetchAddr = "pxtrt::getVirtualMethod"
            }

            if (fetchAddr) {
                write(`ldstack.s ${topExpr.args.length}`)
                write(`push`)
                write(`ldconst.s ${calledProcId.ifaceIndex}`)
                write(`push`)
                write(`call2 ${fetchAddr}`)
                write(`callind`)
            } else {
                write(`callproc ${calledProc.label()}`)
            }
        }

        function emitStore(trg: ir.Expr, src: ir.Expr) {
            switch (trg.exprKind) {
                case EK.CellRef:
                    let cell = trg.data as ir.Cell
                    emitExpr(src)
                    if (cell.isGlobal())
                        write(`stglb.s ` + cell.index) // cell.bitSize
                    else if (cell.iscap)
                        write(`stcap.s ` + cell.index)
                    else
                        write(`stloc.s ` + cell.index)
                    break;
                case EK.FieldAccess:
                    let info = trg.data as FieldAccessInfo
                    // it does the decr itself, no mask
                    emitExpr(ir.rtcall(withRef("pxtrt::stfld", info.isRef), [trg.args[0], ir.numlit(info.idx), src]))
                    break;
                default: oops();
            }
        }
    }
}
