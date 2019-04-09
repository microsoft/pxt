namespace ts.pxtc {
    const vmSpecOpcodes: pxt.Map<string> = {
        /*
        "Number_::eq": "eq",
        "Number_::adds": "add",
        "Number_::subs": "sub",
        */
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

        const ctx: EmitCtx = {
            dblText: [],
            dbls: {}
        }

        let address = 0
        function section(name: string, tp: number, body: () => string, alias?: string) {
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
            vmsource += body()
            vmsource += `\n.balign 8\n_end_${name}:\n`
            address++
        }

        section("_info", 0x01, () => `
                ; magic - \\0 added by assembler
                .string "\\nPXT64\\n"
                .hex 5471fe2b5e213768 ; magic
                .hex ${hex.hexTemplateHash()} ; hex template hash
                .hex 0000000000000000 ; @SRCHASH@
                .word ${bin.globalsWords}   ; num. globals
                .word ${bin.nonPtrGlobals} ; non-ptr globals
`
        )
        bin.procs.forEach(p => {
            section(p.label(), 0x20, () => irToVM(ctx, bin, p), p.label() + "_Lit")
        })
        vmsource += "_code_end:\n_helpers_end:\n\n"
        bin.usedClassInfos.forEach(info => {
            section(info.id + "_VT", 0x21, () => vtableToVM(info, opts, bin))
        })

        let idx = 0
        section("ifaceMemberNames", 0x05, () => bin.ifaceMembers.map(d =>
            `    .word ${bin.emitString(d)}  ; ${idx++} .${d}`
        ).join("\n"))

        vmsource += "_vtables_end:\n\n"

        U.iterMap(bin.hexlits, (k, v) => {
            section(v, 0x22, () => hexLiteralAsm(k))
        })
        U.iterMap(bin.strings, (k, v) => {
            section(v, 0x23, () => `.word ${k.length}\n.utf16 ${JSON.stringify(k)}`)
        })
        section("numberLiterals", 0x03, () => ctx.dblText.join("\n"))

        const cfg = bin.res.configData || []
        section("configData", 0x04, () => cfg.map(d =>
            `    .word ${d.key}, ${d.value}  ; ${d.name}=${d.value}`).join("\n")
            + "\n    .word 0, 0")

        vmsource += "_literals_end:\n"

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

    interface EmitCtx {
        dblText: string[]
        dbls: pxt.Map<number>
    }


    function irToVM(ctx: EmitCtx, bin: Binary, proc: ir.Procedure): string {
        let resText = ""
        let writeRaw = (s: string) => { resText += s + "\n"; }
        let write = (s: string) => { resText += "    " + s + "\n"; }
        let EK = ir.EK;
        let alltmps: ir.Expr[] = []
        let currTmps: ir.Expr[] = []
        let final = false
        let numBrk = 0
        let numLoc = 0
        let argDepth = 0

        const immMax = (1 << 23) - 1

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

            // use this funny encoding to often fit the argument in 8 bits
            let retarg = (numLoc & 0xf) | ((numLoc >> 4) << 8)
            retarg |= (proc.args.length & 0xf) << 4
            retarg |= (proc.args.length >> 4) << 16

            write(`ret ${retarg} ; ${numLoc} locals, ${proc.args.length} args`)
        }

        function emitJmp(jmp: ir.Stmt) {
            let trg = jmp.lbl.lblName
            if (jmp.jmpMode == ir.JmpMode.Always) {
                if (jmp.expr)
                    emitExpr(jmp.expr)
                write(`jmp ${trg}`)
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

        function cellref(cell: ir.Cell) {
            if (cell.isGlobal()) {
                U.assert((cell.index & 3) == 0)
                return (`glb ` + (cell.index >> 2))
            } else if (cell.iscap)
                return (`cap ` + cell.index)
            else if (cell.isarg) {
                let idx = proc.args.length - cell.index - 1
                assert(idx >= 0, "arg#" + idx)
                return (`loc ${argDepth + numLoc + 1 + idx}`)
            }
            else {
                let idx = cell.index + currTmps.length
                //console.log(proc.locals.length, currTmps.length, cell.index)
                assert(!final || idx < numLoc, "cell#" + idx)
                assert(idx >= 0, "cell#" + idx)
                return (`loc ${argDepth + idx}`)
            }
        }

        function emitInstanceOf(info: ClassInfo, tp: string) {
            push()
            write(`ldint ${info.classNo}`)
            push()
            write(`ldint ${info.lastSubtypeNo}`)
            if (tp == "bool")
                write(`callrt pxt::instanceOf`)
            else if (tp == "validate" || tp == "validateDecr") {
                write(`callrt pxt::validateInstanceOf`)
            } else {
                U.oops()
            }
        }

        function emitExprInto(e: ir.Expr) {
            switch (e.exprKind) {
                case EK.NumberLiteral:
                    const tagged = taggedSpecial(e.data)
                    if (tagged != null)
                        write(`ldspecial ${tagged} ; ${e.data}`)
                    else {
                        let n = e.data as number
                        let n0 = 0, n1 = 0
                        if ((n | 0) == n) {
                            if (Math.abs(n) <= immMax) {
                                if (n < 0)
                                    write(`ldintneg ${-n}`)
                                else
                                    write(`ldint ${n}`)
                                return
                            } else {
                                n0 = ((n << 1) | 1) >>> 0
                                n1 = n < 0 ? 1 : 0
                            }
                        } else {
                            let a = new Float64Array(1)
                            a[0] = n
                            let u = new Uint32Array(a.buffer)
                            u[1] += 0x10000
                            n0 = u[0]
                            n1 = u[1]
                        }
                        let key = n0 + "," + n1
                        let id = U.lookup(ctx.dbls, key)
                        if (id == null) {
                            id = ctx.dbls.length
                            ctx.dblText.push(`.word ${n0}, ${n1}  ; ${id}: ${e.data}`)
                            ctx.dbls[key] = id
                        }
                        write(`ldnumber ${id} ; ${e.data}`)
                    }
                    return
                case EK.PointerLiteral:
                    write(`ldlit ${e.data}`)
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
                    write(`ldloc ${idx + argDepth}`)
                    clearStack()
                    return
                case EK.CellRef:
                    write("ld" + cellref(e.data))
                    let cell = e.data as ir.Cell
                    if (cell.isGlobal()) {
                        // TODO
                        if (cell.bitSize == BitSize.Int8) {
                            write(`sgnext`)
                        } else if (cell.bitSize == BitSize.UInt8) {
                            write(`clrhi`)
                        }
                    }
                    return
                case EK.InstanceOf:
                    emitExpr(e.args[0])
                    emitInstanceOf(e.data, e.jsInfo)
                    break

                default: throw oops("kind: " + e.exprKind);
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
                case EK.Decr:
                    U.oops()
                    break;
                case EK.FieldAccess:
                    let info = e.data as FieldAccessInfo
                    // it does the decr itself, no mask
                    return emitExpr(ir.rtcall("pxtrt::ldfld", [e.args[0], ir.numlit(info.idx)]))
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
                write(`stloc ${idx + argDepth}`)
            }
        }

        function push() {
            write(`push`)
            argDepth++
        }

        function emitRtCall(topExpr: ir.Expr) {
            let name: string = topExpr.data
            name = U.lookup(vmCallMap, name) || name

            clearStack()

            let spec = U.lookup(vmSpecOpcodes, name)
            let args = topExpr.args
            let numPush = 0

            for (let i = 0; i < args.length; ++i) {
                emitExpr(args[i])
                if (i < args.length - 1) {
                    push()
                    numPush++
                }
            }

            //let inf = hex.lookupFunc(name)

            if (spec)
                write(spec)
            else
                write(`callrt ${name}`)

            argDepth -= numPush
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

            let numPush = 0

            for (let e of topExpr.args) {
                emitExpr(e)
                push()
                numPush++
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
                write(`ldloc ${topExpr.args.length - 1}`)
                write(`push`)
                write(`ldint ${methIdx}`)
                write(`callrt ${fetchAddr}`)
                write(`callind ${topExpr.args.length}`)
            } else {
                write(`callproc ${calledProc.label()}`)
            }

            argDepth -= numPush
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
                    emitExpr(ir.rtcall("pxtrt::stfld", [trg.args[0], ir.numlit(info.idx), src]))
                    break;
                default: oops();
            }
        }
    }
}
