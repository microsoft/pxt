namespace ts.pxtc {
    const vmSpecOpcodes: pxt.Map<string> = {
        "Number_::eq": "eq",
        "Number_::adds": "add",
        "Number_::subs": "sub",
    }

    const vmCallMap: pxt.Map<string> = {
    }

    function shimToVM(shimName: string) {
        return shimName
    }

    function qs(s: string) {
        return JSON.stringify(s)
    }

    function vtableToVM(info: ClassInfo, opts: CompileOptions, bin: Binary) {
        return vtableToAsm(info, opts, bin)
    }

    /* tslint:disable:no-trailing-whitespace */
    export function vmEmit(bin: Binary, opts: CompileOptions) {
        let vmsource = `; VM start
${hex.hexPrelude()}
`

        let snip = new ThumbSnippets()

        let address = 0
        function section(name: string, tp: number, body: () => void, alias?: string) {
            if (!alias) alias = "_" + name
            vmsource += `
; --- ${name}
.section code
    .set ${name} = ${address}
    .set ${alias} = ${address}
_start_${name}:
    .byte ${tp}, 0x00
    .short 0x0000
    .word _end_${name}-_start_${name}\n`
            body()
            vmsource += `\n.balign 8\n_end_${name}:\n`
            address++
        }

        section("_info", 0x01, () => {
            vmsource += `
                .string "\nPXT64\n" ; magic; \0 added by assembler
                .hex 5471fe2b5e213768 ; magic
                .hex ${hex.hexTemplateHash()} ; hex template hash
                .hex 0000000000000000 ; @SRCHASH@
                .word ${bin.globalsWords}   ; num. globals
                .word ${bin.nonPtrGlobals} ; non-ptr globals
`
        })
        bin.procs.forEach(p => {
            section(p.label(), 0x20, () => irToVM(bin, p), p.label() + "_Lit")
        })
        bin.usedClassInfos.forEach(info => {
            section(info.id + "_VT", 0x21, () => vtableToVM(info, opts, bin))
        })
        U.iterMap(bin.hexlits, (k, v) => {
            section(k, 0x22, () => snip.hex_literal(v, k))
        })
        U.iterMap(bin.strings, (k, v) => {
            section(k, 0x23, () => snip.string_literal(v, k))
        })
        vmsource += "\n; The end.\n"
        bin.writeFile(BINARY_ASM, vmsource)

        let res = assemble(opts.target, bin, vmsource)
        if (res.src)
            bin.writeFile(pxtc.BINARY_ASM, res.src)

        /*
        let pc = res.thumbFile.peepCounts
        let keys = Object.keys(pc)
        keys.sort((a, b) => pc[b] - pc[a])
        for (let k of keys.slice(0, 50)) {
            console.log(`${k}  ${pc[k]}`)
        }
        */

        if (res.buf) {
            let newBuf: number[] = []
            for (let i = 0; i < res.buf.length; i += 2)
                newBuf.push(res.buf[i] | (res.buf[i + 1] << 8))
            const myhex = ts.pxtc.encodeBase64(hex.patchHex(bin, newBuf, false, true)[0])
            bin.writeFile(pxt.outputName(target), myhex)
        }
    }
    /* tslint:enable */


    function irToVM(bin: Binary, proc: ir.Procedure): string {
        let resText = ""
        let writeRaw = (s: string) => { resText += s + "\n"; }
        let write = (s: string) => { resText += "    " + s + "\n"; }
        let EK = ir.EK;
        let wordSize = 2
        let alltmps: ir.Expr[] = []
        let currTmps: ir.Expr[] = []
        let final = false
        let numBrk = 0
        let numLoc = 0

        //console.log(proc.toString())
        proc.resolve()
        // console.log("OPT", proc.toString())

        emitAll()
        bin.numStmts = numBrk
        resText = ""
        for (let t of alltmps) t.currUses = 0
        final = true
        emitAll()

        return resText

        function emitAll() {
            writeRaw(`;\n; Proc: ${proc.getName()}\n;`)
            write(".section code")
            if (bin.procs[0] == proc) {
                writeRaw(`; main`)
            }

            numLoc = proc.locals.length + currTmps.length
            write(`pushmany ${numLoc} ; incl. ${currTmps.length} tmps`)

            for (let s of proc.body) {
                switch (s.stmtKind) {
                    case ir.SK.Expr:
                        emitExpr(s.expr)
                        break;
                    case ir.SK.StackEmpty:
                        clearStack()
                        for (let e of currTmps) {
                            if (e) {
                                oops(`uses: ${e.currUses}/${e.totalUses} ${e.toString()}`);
                            }
                        }
                        break;
                    case ir.SK.Jmp:
                        emitJmp(s);
                        break;
                    case ir.SK.Label:
                        writeRaw(`${s.lblName}:`)
                        break;
                    case ir.SK.Breakpoint:
                        numBrk++
                        break;
                    default: oops();
                }
            }

            write(`ret ${numLoc + proc.args.length}`)
        }

        function emitJmp(jmp: ir.Stmt) {
            let trg = jmp.lbl.lblName
            if (jmp.jmpMode == ir.JmpMode.Always) {
                if (jmp.expr)
                    emitExpr(jmp.expr)
                write(`jmp ${trg}`)
            } else if (jmp.jmpMode == ir.JmpMode.IfLambda) {
                if (jmp.expr)
                    emitExpr(jmp.expr)
                write(`retlmb ${numLoc * wordSize}`)
            } else if (jmp.jmpMode == ir.JmpMode.IfJmpValEq) {
                write(`push`)
                emitExpr(jmp.expr)
                write(`eq`)
                write(`jmpnz ${trg}`)
            } else {
                emitExpr(jmp.expr)
                if (jmp.jmpMode == ir.JmpMode.IfNotZero) {
                    write(`jmpnz ${trg}`)
                } else if (jmp.jmpMode == ir.JmpMode.IfZero) {
                    write(`jmpz ${trg}`)

                } else {
                    oops()
                }
            }
        }

        function withRef(name: string, isRef: boolean) {
            return name + (isRef ? "Ref" : "")
        }

        function cellref(cell: ir.Cell) {
            if (cell.isGlobal())
                return (`glb ` + cell.index)
            else if (cell.iscap)
                return (`cap ` + (cell.index * wordSize))
            else if (cell.isarg) {
                let idx = proc.args.length - cell.index - 1
                assert(idx >= 0, "arg#" + idx)
                return (`tmp ${(numLoc + 2 + idx) * wordSize}`)
            }
            else {
                let idx = cell.index + currTmps.length
                //console.log(proc.locals.length, currTmps.length, cell.index)
                assert(!final || idx < numLoc, "cell#" + idx)
                assert(idx >= 0, "cell#" + idx)
                return (`tmp ${idx * wordSize}`)
            }
        }

        function emitExprInto(e: ir.Expr) {
            switch (e.exprKind) {
                case EK.NumberLiteral:
                    if (e.data === 0)
                        write(`ldzero`)
                    else if (e.data === 1)
                        write(`ldone`)
                    else
                        write(`ldconst ${e.data & 0xffff}`)
                    return
                case EK.PointerLiteral:
                    write(`ldconst ${e.data}`)
                    return
                case EK.SharedRef:
                    let arg = e.args[0]
                    U.assert(!!arg.currUses) // not first use
                    U.assert(arg.currUses < arg.totalUses)
                    arg.currUses++
                    let idx = currTmps.indexOf(arg)
                    if (idx < 0) {
                        console.log(currTmps, arg)
                        assert(false)
                    }
                    write(`ldtmp ${idx * wordSize}`)
                    clearStack()
                    return
                case EK.CellRef:
                    write("ld" + cellref(e.data))
                    let cell = e.data as ir.Cell
                    if (cell.isGlobal()) {
                        if (cell.bitSize == BitSize.Int8) {
                            write(`sgnext`)
                        } else if (cell.bitSize == BitSize.UInt8) {
                            write(`clrhi`)
                        }
                    }
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
            alltmps.push(arg)
            if (arg.totalUses == 1)
                return emitExpr(arg)
            else {
                emitExpr(arg)
                let idx = -1
                for (let i = 0; i < currTmps.length; ++i)
                    if (currTmps[i] == null) {
                        idx = i
                        break
                    }
                if (idx < 0) {
                    if (final) {
                        console.log(arg, currTmps)
                        assert(false, "missed tmp")
                    }
                    idx = currTmps.length
                    currTmps.push(arg)
                } else {
                    currTmps[idx] = arg
                }
                write(`sttmp ${idx * wordSize}`)
            }
        }

        function emitRtCall(topExpr: ir.Expr) {
            let name: string = topExpr.data
            let m = /^(.*)\^(\d+)$/.exec(name)
            let mask = 0
            if (m) {
                name = m[1]
                mask = parseInt(m[2])
            }
            name = U.lookup(vmCallMap, name) || name
            assert(mask <= 0xf)

            let info = ir.flattenArgs(topExpr)
            assert(info.precomp.length == 0)
            //info.precomp.forEach(emitExpr)
            clearStack()

            if (name == "pxt::stringLiteral" &&
                info.flattened.length == 1 &&
                info.flattened[0].exprKind == EK.PointerLiteral) {
                write(`stringlit ${info.flattened[0].data}`)
                return
            }

            assert(info.flattened.length <= 4)
            let maskStr = "0x" + (mask + info.flattened.length * 16).toString(16)

            name = name.replace(/^thumb::/, "Number_::")

            let spec = U.lookup(vmSpecOpcodes, name)

            if (mask) spec = null

            for (let i = 0; i < info.flattened.length; ++i) {
                emitExpr(info.flattened[i])
                if (i < info.flattened.length - 1)
                    write(`push`)
            }

            //let inf = hex.lookupFunc(name)

            if (spec)
                write(spec)
            else
                write(`call ${maskStr}, ${name}`)
        }


        function clearStack() {
            for (let i = 0; i < currTmps.length; ++i) {
                let e = currTmps[i]
                if (e && e.currUses == e.totalUses) {
                    if (!final)
                        alltmps.push(e)
                    currTmps[i] = null
                }
            }
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
                fetchAddr = "pxtrt::fetchMethodIface"
            } else if (calledProcId.virtualIndex != null) {
                methIdx = calledProcId.virtualIndex + 2
                fetchAddr = "pxtrt::fetchMethod"
            }

            if (fetchAddr) {
                write(`ldstack ${topExpr.args.length * wordSize - 1}`)
                write(`push`)
                write(`ldconst ${methIdx}`)
                write(`call 0x20, ${fetchAddr}`)
                write(`callind`)
            } else {
                write(`callproc ${calledProc.label()}`)
            }
        }

        function emitStore(trg: ir.Expr, src: ir.Expr) {
            switch (trg.exprKind) {
                case EK.CellRef:
                    emitExpr(src)
                    let cell = trg.data as ir.Cell
                    let instr = "st" + cellref(cell)
                    if (cell.isGlobal() &&
                        (cell.bitSize == BitSize.Int8 || cell.bitSize == BitSize.UInt8)) {
                        instr = instr.replace("stglb", "stglb1")
                    }
                    write(instr)
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
