namespace ts.pxtc {
    // TODO consider that taggedInts is going to be false!

    const csOpMap: pxt.Map<string> = {
        "numops::toBoolDecr": "numops::toBool",
        "pxtrt::ldfldRef": "pxtrt::ldfld",
        "pxtrt::stfldRef": "pxtrt::stfld",
        "pxtrt::ldlocRef": "pxtrt::ldloc",
        "pxtrt::stlocRef": "pxtrt::stloc",
        "pxtrt::mklocRef": "pxtrt::mkloc",
    }

    function shimToCs(shimName: string) {
        shimName = U.lookup(csOpMap, shimName) || shimName
        shimName = shimName.replace(/::/g, ".")
        //if (shimName.slice(0, 4) == "pxt.")
        //    shimName = "pxtcore." + shimName.slice(4)
        return "PXT." + shimName
    }

    function qs(s: string) {
        return JSON.stringify(s)
    }

    function vtableToCS(info: ClassInfo) {
        let s = `static readonly VTable ${info.id}_VT = new VTable(${qs(getName(info.decl))}, ` +
            `  ${info.refmask.length}, new FnPtr[] {\n`
        for (let m of info.vtable) {
            s += `    ${m.label()},\n`
        }
        s += "  },\n"
        s += "  new FnPtr[] {\n"
        let i = 0
        for (let m of info.itable) {
            s += `    ${m ? m.label() : "null"},  // ${info.itableInfo[i] || "."}\n`
            i++
        }
        s += "});\n"
        return s
    }

    export function csEmit(bin: Binary, opts: CompileOptions) {
        let jssource = opts.hexinfo.hex[0]
        jssource += `
// User code starts

#pragma warning disable CS0164, CS1998, CS0219

namespace PXT {
public static class UserCode {
`
        bin.procs.forEach(p => {
            jssource += "\n" + irToCS(bin, p) + "\n"
        })
        bin.usedClassInfos.forEach(info => {
            jssource += vtableToCS(info)
        })
        //if (bin.res.breakpoints)
        //    jssource += `\nsetupDebugger(${bin.res.breakpoints.length})\n`
        U.iterMap(bin.hexlits, (k, v) => {
            jssource += `static readonly Buffer ${v} = PXT.BufferMethods.createBufferFromHex("${k}");\n`
        })
        jssource += "\n} } // end UserCode\n"
        bin.writeFile(BINARY_CS, jssource)
    }

    function irToCS(bin: Binary, proc: ir.Procedure): string {
        let resText = ""
        let writeRaw = (s: string) => { resText += s + "\n"; }
        let write = (s: string) => { resText += "    " + s + "\n"; }
        let EK = ir.EK;

        let ctxTp = proc.label() + "_CTX"

        if (bin.procs[0] == proc) {
            writeRaw(`

public static void Main() { ${proc.label()}(new CTX(), null).GetAwaiter().GetResult(); }
`)
        }

        writeRaw(`
class ${ctxTp} : CTX {}
        
static async Task ${proc.label()}(CTX parent, object[] args) {
    var r0 = TValue.Undefined;
    var s = new ${ctxTp}();
    var caps = parent.caps;
    s.parent = parent;
`)

        //console.log(proc.toString())
        proc.resolve()
        //console.log("OPT", proc.toString())

        proc.locals.forEach(l => {
            write(`object ${locref(l)} = TValue.Undefined;`)
        })

        if (proc.args.length) {
            proc.args.forEach((l, i) => {
                write(`object ${locref(l)} = ${i} >= args.Length ? TValue.Undefined : args[${i}];`)
            })
            write(`args = null;`)
        }

        let exprStack: ir.Expr[] = []

        let lblIdx = 0
        let asyncContinuations: number[] = []
        for (let s of proc.body) {
            if (s.stmtKind == ir.SK.Label)
                s.lblId = ++lblIdx;
        }

        for (let s of proc.body) {
            switch (s.stmtKind) {
                case ir.SK.Expr:
                    emitExpr(s.expr)
                    break;
                case ir.SK.StackEmpty:
                    for (let e of exprStack) {
                        if (e.totalUses !== e.currUses) oops();
                    }
                    exprStack = [];
                    break;
                case ir.SK.Jmp:
                    emitJmp(s);
                    break;
                case ir.SK.Label:
                    writeRaw(`L${s.lblId}:`)
                    break;
                case ir.SK.Breakpoint:
                    emitBreakpoint(s)
                    break;
                default: oops();
            }
        }

        write(`s.Leave(r0);`)

        writeRaw(`}`)
        let info = nodeLocationInfo(proc.action) as FunctionLocationInfo
        info.functionName = proc.getName()
        writeRaw(`// ${proc.label()}.info = ${JSON.stringify(info)}`)
        //if (proc.isRoot)
        //    writeRaw(`${proc.label()}.continuations = [ ${asyncContinuations.join(",")} ]`)
        return resText

        function emitBreakpoint(s: ir.Stmt) {
            let id = s.breakpointInfo.id
            let lbl: number;
            write(`s.lastBrkId = ${id};`)
            if (bin.options.trace) {
                lbl = ++lblIdx
                write(`s.Trace(${id}, ${lbl}, ${proc.label()}_info);`)
            }
            else {
                if (!bin.options.breakpoints)
                    return;
                lbl = ++lblIdx
                let brkCall = `s.Breakpoint(${lbl}, ${id}, r0);`
                if (s.breakpointInfo.isDebuggerStmt)
                    write(brkCall)
                else
                    write(`if ((breakAlways && s.IsBreakFrame()) || breakpoints[${id}]) ${brkCall}`)
            }
            writeRaw(`L${lbl}:`)
        }

        function locref(cell: ir.Cell) {
            if (cell.isGlobal())
                return "g_" + cell.uniqueName()
            else if (cell.iscap)
                return `caps[${cell.index}]`
            return cell.uniqueName()
        }

        function emitJmp(jmp: ir.Stmt) {
            let trg = `goto L${jmp.lbl.lblId};`
            if (jmp.jmpMode == ir.JmpMode.Always) {
                if (jmp.expr)
                    emitExpr(jmp.expr)
                write(trg)
            } else if (jmp.jmpMode == ir.JmpMode.IfJmpValEq) {
                write(`if (r0.Eq(${emitExprInto(jmp.expr)})) ${trg}`)
            } else {
                emitExpr(jmp.expr)
                if (jmp.jmpMode == ir.JmpMode.IfNotZero) {
                    write(`if (r0.ToBool()) ${trg}`)
                } else {
                    write(`if (!r0.ToBool()) ${trg}`)
                }
            }
        }

        function withRef(name: string, isRef: boolean) {
            return name + (isRef ? "Ref" : "")
        }

        function emitExprInto(e: ir.Expr): string {
            switch (e.exprKind) {
                case EK.NumberLiteral:
                    if (e.data === true) return "TValue.True"
                    else if (e.data === false) return "TValue.False"
                    else if (e.data === null) return "TValue.Null"
                    else if (e.data === undefined) return "TValue.Undefined"
                    else if (typeof e.data == "number") return e.data
                    else throw oops("invalid data: " + typeof e.data);
                case EK.PointerLiteral:
                    return e.jsInfo;
                case EK.SharedRef:
                    let arg = e.args[0]
                    U.assert(!!arg.currUses) // not first use
                    U.assert(arg.currUses < arg.totalUses)
                    arg.currUses++
                    let idx = exprStack.indexOf(arg)
                    U.assert(idx >= 0)
                    return "tmp_" + arg.getId()
                case EK.CellRef:
                    let cell = e.data as ir.Cell;
                    return locref(cell)
                default: throw oops();
            }
        }

        // result in R0
        function emitExpr(e: ir.Expr): void {
            //console.log(`EMITEXPR ${e.sharingInfo()} E: ${e.toString()}`)

            switch (e.exprKind) {
                case EK.JmpValue:
                    write("// jmp value (already in r0)")
                    break;
                case EK.Nop:
                    write("// nop")
                    break
                case EK.Incr:
                case EK.Decr:
                    emitExpr(e.args[0])
                    break;
                case EK.FieldAccess:
                    let info = e.data as FieldAccessInfo
                    if (info.shimName) {
                        emitExpr(e.args[0])
                        write(`r0 = r0${info.shimName};`)
                        return
                    }
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
                    write(`r0 = ${emitExprInto(e)};`)
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
                exprStack.push(arg)
                let idx = arg.getId()
                write(`object tmp_${idx} = r0;`)
            }
        }

        function emitRtCall(topExpr: ir.Expr) {
            let info = ir.flattenArgs(topExpr)

            info.precomp.forEach(emitExpr)

            let name: string = topExpr.data
            let args = info.flattened.map(emitExprInto)
            let isAsync = topExpr.callingConvention != ir.CallingConvention.Plain

            let fmt = topExpr.argsFmt
            if (fmt) {
                let fmts = fmt.split(';').filter(s => !!s)
                if (fmts[0] == "async") {
                    isAsync = true
                    fmts.shift()
                }
                fmts.shift() // return type
                args = args.map((a, i) => {
                    let f = fmts[i]
                    if (f[0] == '#') {
                        f = f.slice(1)
                        a = "numops.toDouble(" + a + ")"
                    }
                    if (f != "object") {
                        a = "((" + f + ")(" + a + "))"
                    }
                    return a
                })
            }

            let text = ""
            if (name[0] == ".")
                text = `${args[0]}${name}(${args.slice(1).join(", ")})`
            else if (U.startsWith(name, "new "))
                text = `new ${shimToCs(name.slice(4))}(${args.join(", ")})`
            else
                text = `${shimToCs(name)}(${args.join(", ")})`

            if (isAsync)
                text = "await " + text

            write(`r0 = ${text};`)
        }

        function emitProcCall(topExpr: ir.Expr) {
            let procid = topExpr.data as ir.ProcId
            let proc = procid.proc
            let lblId = ++lblIdx
            let argsArray = `callargs_${lblId}`
            write(`var ${argsArray} = new object[${topExpr.args.length}];`)

            //console.log("PROCCALL", topExpr.toString())
            topExpr.args.forEach((a, i) => {
                emitExpr(a)
                write(`${argsArray}[${i}] = r0;`)
            })

            // write(`s.pc = ${lblId};`)
            if (procid.ifaceIndex != null) {
                if (procid.mapMethod) {
                    write(`if (${argsArray}.arg0.vtable == null) {`)
                    let args = topExpr.args.map((a, i) => `${argsArray}.arg${i}`)
                    args.splice(1, 0, procid.mapIdx.toString())
                    write(`  s.retval = ${shimToCs(procid.mapMethod)}(${args.join(", ")});`)
                    write(`  goto L${lblId};`)
                    write(`} else {`)
                }
                write(`await PXT.pxtrt.toUserObject(${argsArray}[0]).vtable.iface[${procid.ifaceIndex}](s, ${argsArray});`)
                if (procid.mapMethod) {
                    write(`}`)
                }
            } else if (procid.virtualIndex != null) {
                assert(procid.virtualIndex >= 0)
                write(`await PXT.pxtrt.toUserObject(${argsArray}[0]).vtable.methods[${procid.virtualIndex}](s, ${argsArray});`)
            } else {
                write(`await ${proc.label()}(s, ${argsArray});`)
            }
            writeRaw(`L${lblId}:`)
            write(`r0 = s.retval;`)
        }

        function bitSizeConverter(b: BitSize) {
            switch (b) {
                case BitSize.None: return ""
                case BitSize.Int8: return "PXT.pxtrt.toInt8"
                case BitSize.Int16: return "PXT.pxtrt.toInt16"
                case BitSize.Int32: return "PXT.pxtrt.toInt32"
                case BitSize.UInt8: return "PXT.pxtrt.toUInt8"
                case BitSize.UInt16: return "PXT.pxtrt.toUInt16"
                case BitSize.UInt32: return "PXT.pxtrt.toUInt32"
                default: throw oops()
            }
        }

        function emitStore(trg: ir.Expr, src: ir.Expr) {
            switch (trg.exprKind) {
                case EK.CellRef:
                    let cell = trg.data as ir.Cell
                    emitExpr(src)
                    write(`${locref(cell)} = ${bitSizeConverter(cell.bitSize)}(r0);`)
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
