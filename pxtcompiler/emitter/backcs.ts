namespace ts.pxtc {
    // TODO consider that taggedInts is going to be false!

    const csOpMap: pxt.Map<string> = {
        "numops::toBoolDecr": "numops::toBool",
        "pxtrt::ldfldRef": "pxtrt::ldfld",
        "pxtrt::stfldRef": "pxtrt::stfld",
        "pxtrt::ldlocRef": "pxtrt::ldloc",
        "pxtrt::stlocRef": "pxtrt::stloc",
        "pxtrt::mklocRef": "pxtrt::mkloc",
        "pxtrt::mapSetRef": "pxtrt::mapSet",
        "pxtrt::mapGetRef": "pxtrt::mapGet",
    }

    function shimToCs(shimName: string) {
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

#pragma warning disable CS0164, CS1998, CS0219, CS0414, CS0162

namespace PXT {
public static class UserCode {
`
        bin.globals.forEach(g => {
            jssource += `static object ${"g_" + g.uniqueName()};\n`
        })
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
        let maxStack = 0

        let ctxTp = proc.label() + "_CTX"

        //console.log(proc.toString())
        proc.resolve()
        //console.log("OPT", proc.toString())

        if (bin.procs[0] == proc) {
            writeRaw(`

public static void Main() { ${proc.label()}(new CTX(0), null).GetAwaiter().GetResult(); }
`)
        }

        let storeArgs =
            proc.args.map((l, i) =>
                `    ${locref(l)} = ${i} >= args.Length ? TValue.Undefined : args[${i}];\n`)
                .join("")

        writeRaw(`
static Action<Task, object> ${proc.label()}_delegate;
static Task ${proc.label()}(CTX parent, object[] args) {
    var s = new ${ctxTp}(parent);
    if (${proc.label()}_delegate == null) {
        ${proc.label()}_delegate = ${proc.label()}_task;
    }
${storeArgs}
    ${proc.label()}_task(null, s);
    return s.completion.Task;
}

static void ${proc.label()}_task(Task prevTask, object s_) {
    var s = (${ctxTp})s_;
    var r0 = TValue.Undefined;
    var step = s.pc;
    s.pc = -1;

    while (true) {
    switch (step) {
    case 0:
`)
        let exprStack: ir.Expr[] = []
        let currCallArgsIdx = 0
        let maxCallArgsIdx = -1

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
                    write(`goto case ${s.lblId};`)
                    writeRaw(`case ${s.lblId}:`)
                    break;
                case ir.SK.Breakpoint:
                    emitBreakpoint(s)
                    break;
                default: oops();
            }
        }

        write(`s.Leave(r0);`)
        write(`return;`)
        writeRaw(`  default: PXT.Util.check(false, "invalid pc: " + step); return;\n} } }`)

        let info = nodeLocationInfo(proc.action) as FunctionLocationInfo
        info.functionName = proc.getName()
        writeRaw(`// ${proc.label()}.info = ${JSON.stringify(info)}`)

        writeRaw(`
class ${ctxTp} : CTX {
    public ${ctxTp}(CTX parent) : base(parent) {}`)
        for (let o of proc.locals.concat(proc.args)) {
            write(`public object ${o.uniqueName()};`)
        }
        for (let i = 0; i < maxStack; ++i)
            write(`public object tmp_${i};`)

        for (let i = 0; i < maxCallArgsIdx; ++i)
            write(`public object[] callArgs_${i};`)

        writeRaw(`}\n`)

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
            writeRaw(`case ${lbl}: // BRK`)
        }

        function locref(cell: ir.Cell) {
            if (cell.isGlobal())
                return "g_" + cell.uniqueName()
            else if (cell.iscap)
                return `s.mycaps[${cell.index}]`
            return "s." + cell.uniqueName()
        }

        function emitJmp(jmp: ir.Stmt) {
            let trg = `goto case ${jmp.lbl.lblId};`
            if (jmp.jmpMode == ir.JmpMode.Always) {
                if (jmp.expr)
                    emitExpr(jmp.expr)
                write(trg)
            } else if (jmp.jmpMode == ir.JmpMode.IfJmpValEq) {
                write(`if (r0.Eq(${emitExprInto(jmp.expr)})) ${trg}`)
            } else {
                emitExpr(jmp.expr)
                if (jmp.jmpMode == ir.JmpMode.IfNotZero) {
                    write(`if (numops.toBool(r0)) ${trg}`)
                } else {
                    write(`if (!numops.toBool(r0)) ${trg}`)
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
                    else if (typeof e.data == "number") return "(double)(" + e.data + ")"
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
                    return "s.tmp_" + idx
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
                let idx = exprStack.length
                exprStack.push(arg)
                maxStack = Math.max(maxStack, exprStack.length)
                write(`s.tmp_${idx} = r0;`)
            }
        }

        function emitRtCall(topExpr: ir.Expr) {
            let info = ir.flattenArgs(topExpr)

            info.precomp.forEach(emitExpr)

            let name: string = topExpr.data
            name = U.lookup(csOpMap, name) || name

            let args = info.flattened.map(emitExprInto)

            if (name == "langsupp::ignore")
                return

            let isAsync = topExpr.callingConvention != ir.CallingConvention.Plain

            let inf = hex.lookupFunc(name)
            let fmt = inf ? inf.argsFmt : ""

            if (!inf)
                pxt.debug(`warning, missing //%: ${name}`)

            let retTp = "object"
            if (fmt) {
                let fmts = fmt.split(';').filter(s => !!s)
                if (fmts[0] == "async") {
                    isAsync = true
                    fmts.shift()
                }
                retTp = fmts.shift()
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

            //pxt.debug("name: " + name + " fmt: " + fmt)

            let text = ""
            if (name[0] == ".")
                text = `${args[0]}${name}(${args.slice(1).join(", ")})`
            else if (U.startsWith(name, "new "))
                text = `new ${shimToCs(name.slice(4))}(${args.join(", ")})`
            else
                text = `${shimToCs(name)}(${args.join(", ")})`




            if (isAsync) {
                let loc = ++lblIdx
                asyncContinuations.push(loc)
                write(`s.pc = ${loc};`)
                write(`${text}.ContinueWith(${proc.label()}_delegate, (object)s);`)
                write(`return;`)
                writeRaw(`  case ${loc}:\n`)
                if (retTp == "void")
                    text = "/* void */";
                else
                    text = `((Task<${retTp}>)prevTask).Result`
            }

            if (retTp[0] == '#')
                text = "(double)(" + text + ")"

            if (retTp == "void")
                write(`${text};`)
            else
                write(`r0 = ${text};`)
        }

        function emitProcCall(topExpr: ir.Expr) {
            let calledProcId = topExpr.data as ir.ProcId
            let calledProc = calledProcId.proc
            let lblId = ++lblIdx
            let argsArray = `s.callArgs_${currCallArgsIdx}`
            write(`${argsArray} = new object[${topExpr.args.length}];`)
            if (++currCallArgsIdx > maxCallArgsIdx)
                maxCallArgsIdx = currCallArgsIdx

            //console.log("PROCCALL", topExpr.toString())
            topExpr.args.forEach((a, i) => {
                emitExpr(a)
                write(`${argsArray}[${i}] = r0;`)
            })

            write(`s.pc = ${lblId};`)
            let callIt = `(s, ${argsArray}).ContinueWith(${proc.label()}_delegate, s)`
            if (calledProcId.ifaceIndex != null) {
                if (calledProcId.mapMethod) {
                    write(`if (${argsArray}[0] is PXT.RefMap) {`)
                    let args = topExpr.args.map((a, i) => `${argsArray}[${i}]`)
                    args[0] = "(PXT.RefMap)" + args[0]
                    args.splice(1, 0, calledProcId.mapIdx.toString())
                    write(`  s.retval = ${shimToCs(calledProcId.mapMethod).replace("Ref", "")}(${args.join(", ")});`)
                    write(`  goto case ${lblId};`)
                    write(`} else {`)
                }
                write(`PXT.pxtrt.getVT(${argsArray}[0]).iface[${calledProcId.ifaceIndex}]${callIt};`)
                if (calledProcId.mapMethod) {
                    write(`}`)
                }
            } else if (calledProcId.virtualIndex != null) {
                assert(calledProcId.virtualIndex >= 0)
                write(`PXT.pxtrt.getVT(${argsArray}[0]).methods[${calledProcId.virtualIndex}]${callIt};`)
            } else {
                write(`${calledProc.label()}${callIt};`)
            }
            write(`return;`)
            writeRaw(`  case ${lblId}:`)
            write(`r0 = s.retval;`)

            currCallArgsIdx--
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
                    let conv = bitSizeConverter(cell.bitSize)
                    if (conv)
                        write(`${locref(cell)} = ${conv}(PXT.numops.toDouble(r0));`)
                    else
                        write(`${locref(cell)} = r0;`)
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
