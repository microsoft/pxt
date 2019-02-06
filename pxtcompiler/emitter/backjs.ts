namespace ts.pxtc {
    const jsOpMap: pxt.Map<string> = {
        "numops::adds": "+",
        "numops::subs": "-",
        "numops::div": "/",
        "numops::mod": "%",
        "numops::muls": "*",
        "numops::ands": "&",
        "numops::orrs": "|",
        "numops::eors": "^",
        "numops::bnot": "~", // unary
        "numops::lsls": "<<",
        "numops::asrs": ">>",
        "numops::lsrs": ">>>",
        "numops::le": "<=",
        "numops::lt": "<",
        "numops::lt_bool": "<",
        "numops::ge": ">=",
        "numops::gt": ">",
        "numops::eq": "==",
        "pxt::eq_bool": "==",
        "pxt::eqq_bool": "===",
        "numops::eqq": "===",
        "numops::neqq": "!==",
        "numops::neq": "!=",
    }

    export function isBuiltinSimOp(name: string) {
        return !!U.lookup(jsOpMap, name.replace(/\./g, "::"))
    }

    export function shimToJs(shimName: string) {
        shimName = shimName.replace(/::/g, ".")
        if (shimName.slice(0, 4) == "pxt.")
            shimName = "pxtcore." + shimName.slice(4)
        if (target.shortPointers)
            shimName = shimName.replace(/^thumb\./, "avr.")
        return "pxsim." + shimName
    }

    function vtableToJs(info: ClassInfo) {
        let s = `var ${info.id}_VT = {\n` +
            `  name: ${JSON.stringify(getName(info.decl))},\n` +
            `  numFields: ${info.allfields.length},\n` +
            `  classNo: ${info.classNo},\n` +
            `  methods: [\n`
        for (let m of info.vtable) {
            s += `    ${m.label()},\n`
        }
        s += "  ],\n"
        s += "  iface: {\n"
        for (let m of info.itable) {
            s += `    "${m.name}": ${m.proc ? m.proc.label() : "13"},\n`
            if (m.setProc)
                s += `    "set/${m.name}": ${m.setProc.label()},\n`
            else if (!m.proc)
                s += `    "set/${m.name}": 13,\n`
        }
        s += "  },\n"
        if (info.toStringMethod)
            s += "  toStringMethod: " + info.toStringMethod.label() + ",\n"
        s += "};\n"
        return s
    }

    export function jsEmit(bin: Binary) {
        let jssource = "'use strict';\n"
        if (!bin.target.jsRefCounting)
            jssource += "pxsim.noRefCounting();\n"
        jssource += "pxsim.setTitle(" + JSON.stringify(bin.options.name || "") + ");\n"
        let cfg: pxt.Map<number> = {}
        let cfgKey: pxt.Map<number> = {}
        for (let ce of bin.res.configData || []) {
            cfg[ce.key + ""] = ce.value
            cfgKey[ce.name] = ce.key
        }
        jssource += "pxsim.setConfigData(" +
            JSON.stringify(cfg, null, 1) + ", " +
            JSON.stringify(cfgKey, null, 1) + ");\n"
        jssource += "pxsim.pxtrt.mapKeyNames = " + JSON.stringify(bin.ifaceMembers, null, 1) + ";\n"

        const perfCounters = bin.setPerfCounters(["SysScreen"])
        jssource += "__this.setupPerfCounters(" + JSON.stringify(perfCounters, null, 1) + ");\n"

        bin.procs.forEach(p => {
            jssource += "\n" + irToJS(bin, p) + "\n"
        })
        bin.usedClassInfos.forEach(info => {
            jssource += vtableToJs(info)
        })
        if (bin.res.breakpoints)
            jssource += `\nsetupDebugger(${bin.res.breakpoints.length})\n`
        U.iterMap(bin.hexlits, (k, v) => {
            jssource += `var ${v} = pxsim.BufferMethods.createBufferFromHex("${k}")\n`
        })
        bin.writeFile(BINARY_JS, jssource)
    }

    function irToJS(bin: Binary, proc: ir.Procedure): string {
        let resText = ""
        let writeRaw = (s: string) => { resText += s + "\n"; }
        let write = (s: string) => { resText += "    " + s + "\n"; }
        let EK = ir.EK;
        let refCounting = !!bin.target.jsRefCounting

        writeRaw(`
var ${proc.label()} ${bin.procs[0] == proc ? "= entryPoint" : ""} = function (s) {
var r0 = s.r0, step = s.pc;
s.pc = -1;
`)
        if (proc.perfCounterNo) {
            writeRaw(`if (step == 0) __this.startPerfCounter(${proc.perfCounterNo});\n`)
        }
        writeRaw(`
while (true) {
if (yieldSteps-- < 0 && maybeYield(s, step, r0)) return null;
switch (step) {
  case 0:
`)

        //console.log(proc.toString())
        proc.resolve()
        //console.log("OPT", proc.toString())

        proc.locals.forEach(l => {
            write(`${locref(l)} = undefined;`)
        })

        if (proc.args.length) {
            write(`if (s.lambdaArgs) {`)
            proc.args.forEach((l, i) => {
                // TODO incr needed?
                write(`  ${locref(l)} = ${refCounting ? "pxtrt.incr" : ""}(s.lambdaArgs[${i}]);`)
            })
            write(`  s.lambdaArgs = null;`)
            write(`}`)
        }

        if (proc.classInfo && proc.info.thisParameter) {
            write("r0 = s.arg0;")
            emitInstanceOf(proc.classInfo, "validate")
        }

        const jumpToNextInstructionMarker = -1


        let exprStack: ir.Expr[] = []

        let lblIdx = 0
        let asyncContinuations: number[] = []
        let prev: ir.Stmt
        for (let s of proc.body) {
            // mark Jump-to-next-instruction
            if (prev && prev.lbl == s &&
                prev.stmtKind == ir.SK.Jmp &&
                s.stmtKind == ir.SK.Label &&
                prev.jmpMode == ir.JmpMode.Always &&
                s.lblNumUses == 1) {
                s.lblNumUses = jumpToNextInstructionMarker
            }
            if (s.stmtKind == ir.SK.Label)
                s.lblId = ++lblIdx;
            prev = s
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
                    if (s.lblNumUses > 0)
                        writeRaw(`  case ${s.lblId}:`)
                    break;
                case ir.SK.Breakpoint:
                    emitBreakpoint(s)
                    break;
                default: oops();
            }
        }

        if (proc.perfCounterNo) {
            writeRaw(`__this.stopPerfCounter(${proc.perfCounterNo});\n`)
        }
        write(`return leave(s, r0)`)

        writeRaw(`  default: oops()`)
        writeRaw(`} } }`)
        let info = nodeLocationInfo(proc.action) as FunctionLocationInfo
        info.functionName = proc.getName()
        writeRaw(`${proc.label()}.info = ${JSON.stringify(info)}`)
        if (proc.isRoot)
            writeRaw(`${proc.label()}.continuations = [ ${asyncContinuations.join(",")} ]`)
        return resText

        function emitBreakpoint(s: ir.Stmt) {
            let id = s.breakpointInfo.id
            let lbl: number;
            write(`s.lastBrkId = ${id};`)
            if (bin.options.trace) {
                lbl = ++lblIdx
                write(`return trace(${id}, s, ${lbl}, ${proc.label()}.info);`)
            }
            else {
                if (!bin.options.breakpoints)
                    return;
                lbl = ++lblIdx
                let brkCall = `return breakpoint(s, ${lbl}, ${id}, r0);`
                if (s.breakpointInfo.isDebuggerStmt)
                    write(brkCall)
                else
                    write(`if ((breakAlways && isBreakFrame(s)) || breakpoints[${id}]) ${brkCall}`)
            }
            writeRaw(`  case ${lbl}:`)
        }

        function locref(cell: ir.Cell) {
            if (cell.isGlobal())
                return "globals." + cell.uniqueName()
            else if (cell.iscap)
                return `s.caps[${cell.index}]`
            return "s." + cell.uniqueName()
        }

        function emitJmp(jmp: ir.Stmt) {
            if (jmp.lbl.lblNumUses == jumpToNextInstructionMarker) {
                assert(jmp.jmpMode == ir.JmpMode.Always)
                if (jmp.expr)
                    emitExpr(jmp.expr)
                // no actual jump needed
                return
            }

            assert(jmp.lbl.lblNumUses > 0)
            let trg = `{ step = ${jmp.lbl.lblId}; continue; }`
            if (jmp.jmpMode == ir.JmpMode.Always) {
                if (jmp.expr)
                    emitExpr(jmp.expr)
                write(trg)
            } else if (jmp.jmpMode == ir.JmpMode.IfJmpValEq) {
                write(`if (r0 == (${emitExprInto(jmp.expr)})) ${trg}`)
            } else {
                emitExpr(jmp.expr)
                if (jmp.jmpMode == ir.JmpMode.IfNotZero) {
                    write(`if (r0) ${trg}`)
                } else {
                    write(`if (!r0) ${trg}`)
                }
            }
        }

        function withRef(name: string, isRef: boolean) {
            return name + (isRef ? "Ref" : "")
        }

        function emitExprInto(e: ir.Expr): string {
            switch (e.exprKind) {
                case EK.NumberLiteral:
                    if (e.data === true) return "true"
                    else if (e.data === false) return "false"
                    else if (e.data === null) return "null"
                    else if (e.data === undefined) return "undefined"
                    else if (typeof e.data == "number") return e.data + ""
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
                    emitExpr(e.args[0])
                    if (refCounting)
                        write(`pxtrt.incr(r0);`)
                    break;
                case EK.Decr:
                    emitExpr(e.args[0])
                    if (refCounting)
                        write(`pxtrt.decr(r0);`)
                    break;
                case EK.FieldAccess:
                    let info = e.data as FieldAccessInfo
                    let shimName = info.shimName
                    if (shimName) {
                        assert(!refCounting)
                        emitExpr(e.args[0])
                        write(`r0 = r0${shimName};`)
                        return
                    }
                    emitExpr(e.args[0]);
                    write(`r0 = r0.fields["${info.name}"];`)
                    return
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
                case EK.InstanceOf:
                    emitExpr(e.args[0])
                    emitInstanceOf(e.data, e.jsInfo)
                    return
                default:
                    write(`r0 = ${emitExprInto(e)};`)
            }
        }

        function checkSubtype(info: ClassInfo) {
            return `checkSubtype(r0, ${info.classNo}, ${info.lastSubtypeNo})`
        }

        function emitInstanceOf(info: ClassInfo, tp: string) {
            if (tp == "bool")
                write(`r0 = ${checkSubtype(info)};`)
            else if (tp == "validate" || tp == "validateDecr") {
                write(`if (!${checkSubtype(info)}) failedCast(r0);`)
            } else {
                U.oops()
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
                write(`s.tmp_${idx} = r0;`)
            }
        }

        function emitRtCall(topExpr: ir.Expr) {
            let info = ir.flattenArgs(topExpr)

            info.precomp.forEach(emitExpr)

            let name: string = topExpr.data
            let args = info.flattened.map(emitExprInto)

            let text = ""
            if (name[0] == ".")
                text = `${args[0]}${name}(${args.slice(1).join(", ")})`
            else if (name[0] == "=")
                text = `(${args[0]})${name.slice(1)} = (${args[1]})`
            else if (U.startsWith(name, "new "))
                text = `new ${shimToJs(name.slice(4))}(${args.join(", ")})`
            else if (U.lookup(jsOpMap, name))
                text = args.length == 2 ? `(${args[0]} ${U.lookup(jsOpMap, name)} ${args[1]})` : `(${U.lookup(jsOpMap, name)} ${args[0]})`;
            else
                text = `${shimToJs(name)}(${args.join(", ")})`

            if (topExpr.callingConvention == ir.CallingConvention.Plain) {
                write(`r0 = ${text};`)
            } else {
                let loc = ++lblIdx
                asyncContinuations.push(loc)
                if (name == "String_::stringConv") {
                    write(`if ((${args[0]}) && (${args[0]}).vtable) {`)
                }
                if (topExpr.callingConvention == ir.CallingConvention.Promise) {
                    write(`(function(cb) { ${text}.done(cb) })(buildResume(s, ${loc}));`)
                } else {
                    write(`setupResume(s, ${loc});`)
                    write(`${text};`)
                }
                write(`checkResumeConsumed();`)
                write(`return;`)
                if (name == "String_::stringConv") write(`} else { s.retval = (${args[0]}) + ""; }`)
                writeRaw(`  case ${loc}:`)
                write(`r0 = s.retval;`)
            }
        }

        function emitProcCall(topExpr: ir.Expr) {
            let frameExpr = ir.rtcall("<frame>", [])
            frameExpr.totalUses = 1
            frameExpr.currUses = 0
            let frameIdx = exprStack.length
            exprStack.push(frameExpr)

            let procid = topExpr.data as ir.ProcId
            let proc = procid.proc
            let frameRef = `s.tmp_${frameIdx}`
            let lblId = ++lblIdx
            write(`${frameRef} = { fn: ${proc ? proc.label() : null}, parent: s };`)

            let isLambda = procid.virtualIndex == -1

            //console.log("PROCCALL", topExpr.toString())
            topExpr.args.forEach((a, i) => {
                emitExpr(a)
                let arg = `arg${i}`
                if (isLambda) {
                    if (i == 0)
                        arg = `argL`
                    else
                        arg = `arg${i - 1}`
                }
                write(`${frameRef}.${arg} = r0;`)
            })

            write(`s.pc = ${lblId};`)
            if (procid.ifaceIndex != null) {
                let isSet = false
                if (procid.mapMethod) {
                    write(`if (${frameRef}.arg0.vtable === 42) {`)
                    let args = topExpr.args.map((a, i) => `${frameRef}.arg${i}`)
                    args.splice(1, 0, procid.ifaceIndex.toString())
                    write(`  s.retval = ${shimToJs(procid.mapMethod)}(${args.join(", ")});`)
                    write(`  ${frameRef}.fn = doNothing;`)
                    write(`} else {`)
                    if (/Set/.test(procid.mapMethod))
                        isSet = true
                }
                write(`${frameRef}.fn = ${frameRef}.arg0.vtable.iface["${isSet ? "set/" : ""}${bin.ifaceMembers[procid.ifaceIndex]}"];`)
                write(`if (${frameRef}.fn === 13) {`)
                let fld = `${frameRef}.arg0.fields["${bin.ifaceMembers[procid.ifaceIndex]}"]`
                if (isSet) {
                    write(`  ${fld} = ${frameRef}.arg1;`)
                } else {
                    write(`  s.retval = ${fld};`)
                }
                write(`  ${frameRef}.fn = doNothing;`)
                write(`}`)
                if (procid.mapMethod) {
                    write(`}`)
                }
            } else if (procid.virtualIndex == -1) {
                // lambda call
                write(`setupLambda(${frameRef}, ${frameRef}.argL);`)
            } else if (procid.virtualIndex != null) {
                assert(procid.virtualIndex >= 0)
                write(`pxsim.check(typeof ${frameRef}.arg0  != "number", "Can't access property of null/undefined.")`)
                write(`${frameRef}.fn = ${frameRef}.arg0.vtable.methods[${procid.virtualIndex}];`)
            }
            write(`return actionCall(${frameRef})`)
            writeRaw(`  case ${lblId}:`)
            write(`r0 = s.retval;`)

            frameExpr.currUses = 1
        }

        function bitSizeConverter(b: BitSize) {
            switch (b) {
                case BitSize.None: return ""
                case BitSize.Int8: return "pxsim.pxtrt.toInt8"
                case BitSize.Int16: return "pxsim.pxtrt.toInt16"
                case BitSize.Int32: return "pxsim.pxtrt.toInt32"
                case BitSize.UInt8: return "pxsim.pxtrt.toUInt8"
                case BitSize.UInt16: return "pxsim.pxtrt.toUInt16"
                case BitSize.UInt32: return "pxsim.pxtrt.toUInt32"
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
                    let shimName = info.shimName
                    if (!shimName)
                        shimName = `.fields["${info.name}"]`
                    emitExpr(ir.rtcall("=" + shimName, [trg.args[0], src]))
                    break;
                default: oops();
            }
        }
    }
}
