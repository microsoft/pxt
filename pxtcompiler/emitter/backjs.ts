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

    const shortNsCalls: pxt.Map<string> = {
        "pxsim.Boolean_": "",
        "pxsim.pxtcore": "",
        "pxsim.String_": "",
        "pxsim.ImageMethods": "",
        "pxsim.Array_": "",
        "pxsim.pxtrt": "",
        "pxsim.numops": "",
    }

    const shortCalls: pxt.Map<string> = {
        "pxsim.Array_.getAt": "",
        "pxsim.Array_.length": "",
        "pxsim.Array_.mk": "",
        "pxsim.Array_.push": "",
        "pxsim.Boolean_.bang": "",
        "pxsim.String_.concat": "",
        "pxsim.String_.stringConv": "",
        "pxsim.numops.toBool": "",
        "pxsim.numops.toBoolDecr": "",
        "pxsim.pxtcore.mkAction": "",
        "pxsim.pxtcore.mkClassInstance": "",
        "pxsim.pxtrt.ldlocRef": "",
        "pxsim.pxtrt.mapGetByString": "",
        "pxsim.pxtrt.stclo": "",
        "pxsim.pxtrt.stlocRef": "",
    }

    function shortCallsPrefix(m: pxt.Map<string>) {
        let r = ""
        for (let k of Object.keys(m)) {
            const kk = k.replace(/\./g, "_")
            m[k] = kk
            r += `const ${kk} = ${k};\n`
        }
        return r
    }

    export function isBuiltinSimOp(name: string) {
        return !!U.lookup(jsOpMap, name.replace(/\./g, "::"))
    }

    export function shimToJs(shimName: string) {
        shimName = shimName.replace(/::/g, ".")
        if (shimName.slice(0, 4) == "pxt.")
            shimName = "pxtcore." + shimName.slice(4)
        const r = "pxsim." + shimName
        if (shortCalls.hasOwnProperty(r))
            return shortCalls[r]
        const idx = r.lastIndexOf(".")
        if (idx > 0) {
            const pref = r.slice(0, idx)
            if (shortNsCalls.hasOwnProperty(pref))
                return shortNsCalls[pref] + r.slice(idx)
        }
        return r
    }

    function vtableToJs(info: ClassInfo) {
        U.assert(info.classNo !== undefined)
        U.assert(info.lastSubtypeNo !== undefined)
        let maxBg = parseInt(info.attrs.maxBgInstances)
        if (!maxBg) maxBg = null
        let s = `const ${info.id}_VT = mkVTable({\n` +
            `  name: ${JSON.stringify(getName(info.decl))},\n` +
            `  numFields: ${info.allfields.length},\n` +
            `  classNo: ${info.classNo},\n` +
            `  lastSubtypeNo: ${info.lastSubtypeNo},\n` +
            `  maxBgInstances: ${maxBg},\n` +
            `  methods: {\n`
        for (let m of info.vtable) {
            s += `    "${m.getName()}": ${m.label()},\n`
        }
        s += "  },\n"
        s += "  iface: {\n"
        for (let m of info.itable) {
            s += `    "${m.name}": ${m.proc ? m.proc.label() : "null"},\n`
            if (m.setProc)
                s += `    "set/${m.name}": ${m.setProc.label()},\n`
            else if (!m.proc)
                s += `    "set/${m.name}": null,\n`
        }
        s += "  },\n"
        if (info.toStringMethod)
            s += "  toStringMethod: " + info.toStringMethod.label() + ",\n"
        s += "});\n"
        return s
    }

    const evalIfaceFields = [
        "runtime",
        "oops",
        "doNothing",
        "pxsim",
        "globals",
        "maybeYield",
        "setupDebugger",
        "isBreakFrame",
        "breakpoint",
        "trace",
        "checkStack",
        "leave",
        "checkResumeConsumed",
        "setupResume",
        "setupLambda",
        "checkSubtype",
        "failedCast",
        "buildResume",
        "mkVTable",
        "bind",
        "leaveAccessor"
    ]

    export function jsEmit(bin: Binary) {
        let jssource = "(function (ectx) {\n'use strict';\n"

        for (let n of evalIfaceFields) {
            jssource += `const ${n} = ectx.${n};\n`
        }

        jssource += `const __this = runtime;\n`
        jssource += `const pxtrt = pxsim.pxtrt;\n`

        jssource += `let yieldSteps = 1;\n`
        jssource += `ectx.setupYield(function() { yieldSteps = 100; })\n`

        jssource += "pxsim.setTitle(" + JSON.stringify(bin.getTitle()) + ");\n"
        let cfg: pxt.Map<number> = {}
        let cfgKey: pxt.Map<number> = {}
        for (let ce of bin.res.configData || []) {
            cfg[ce.key + ""] = ce.value
            cfgKey[ce.name] = ce.key
        }
        jssource += "pxsim.setConfigData(" +
            JSON.stringify(cfg, null, 1) + ", " +
            JSON.stringify(cfgKey, null, 1) + ");\n"
        jssource += "pxtrt.mapKeyNames = " + JSON.stringify(bin.ifaceMembers, null, 1) + ";\n"

        const perfCounters = bin.setPerfCounters(["SysScreen"])
        jssource += "__this.setupPerfCounters(" + JSON.stringify(perfCounters, null, 1) + ");\n"

        jssource += shortCallsPrefix(shortCalls)
        jssource += shortCallsPrefix(shortNsCalls)

        let cachedLen = 0
        let newLen = 0

        bin.procs.forEach(p => {
            let curr: string
            if (p.cachedJS) {
                curr = p.cachedJS
                cachedLen += curr.length
            } else {
                curr = irToJS(bin, p)
                newLen += curr.length
            }
            jssource += "\n" + curr + "\n"
        })
        jssource += U.values(bin.codeHelpers).join("\n") + "\n"
        bin.usedClassInfos.forEach(info => {
            jssource += vtableToJs(info)
        })
        if (bin.res.breakpoints)
            jssource += `\nconst breakpoints = setupDebugger(${bin.res.breakpoints.length}, [${bin.globals.filter(c => c.isUserVariable).map(c => `"${c.uniqueName()}"`).join(",")}])\n`

        jssource += `\nreturn ${bin.procs[0] ? bin.procs[0].label() : "null"}\n})\n`

        const total = jssource.length
        const perc = (n: number) => ((100 * n) / total).toFixed(2) + "%"
        const sizes = `// total=${jssource.length} new=${perc(newLen)} cached=${perc(cachedLen)} other=${perc(total - newLen - cachedLen)}\n`
        bin.writeFile(BINARY_JS, sizes + jssource)
    }

    function irToJS(bin: Binary, proc: ir.Procedure): string {
        if (proc.cachedJS)
            return proc.cachedJS

        let resText = ""
        let writeRaw = (s: string) => { resText += s + "\n"; }
        let write = (s: string) => { resText += "    " + s + "\n"; }
        let EK = ir.EK;
        let exprStack: ir.Expr[] = []
        let maxStack = 0
        let localsCache: pxt.Map<boolean> = {}
        let hexlits = ""

        writeRaw(`
function ${proc.label()}(s) {
let r0 = s.r0, step = s.pc;
s.pc = -1;
`)
        if (proc.perfCounterNo) {
            writeRaw(`if (step == 0) __this.startPerfCounter(${proc.perfCounterNo});\n`)
        }
        writeRaw(`
while (true) {
if (yieldSteps-- < 0 && maybeYield(s, step, r0) || runtime !== pxsim.runtime) return null;
switch (step) {
  case 0:
`)

        proc.locals.forEach(l => {
            write(`${locref(l)} = undefined;`)
        })

        if (proc.args.length) {
            write(`if (s.lambdaArgs) {`)
            proc.args.forEach((l, i) => {
                write(`  ${locref(l)} = (s.lambdaArgs[${i}]);`)
            })
            write(`  s.lambdaArgs = null;`)
            write(`}`)
        }

        if (proc.classInfo && proc.info.thisParameter) {
            write("r0 = s.arg0;")
            emitInstanceOf(proc.classInfo, "validate")
        }

        let lblIdx = 0
        let asyncContinuations: number[] = []
        for (let s of proc.body) {
            if (s.stmtKind == ir.SK.Label && s.lblNumUses > 0)
                s.lblId = ++lblIdx;
        }

        let idx = 0
        for (let s of proc.body) {
            switch (s.stmtKind) {
                case ir.SK.Expr:
                    emitExpr(s.expr)
                    break;
                case ir.SK.StackEmpty:
                    stackEmpty();
                    break;
                case ir.SK.Jmp:
                    let isJmpNext = false
                    for (let ii = idx + 1; ii < proc.body.length; ++ii) {
                        if (proc.body[ii].stmtKind != ir.SK.Label)
                            break
                        if (s.lbl == proc.body[ii]) {
                            isJmpNext = true
                            break
                        }
                    }
                    emitJmp(s, isJmpNext);
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
            idx++
        }

        stackEmpty();

        if (proc.perfCounterNo) {
            writeRaw(`__this.stopPerfCounter(${proc.perfCounterNo});\n`)
        }

        if (proc.isGetter())
            write(`return leaveAccessor(s, r0)`)
        else
            write(`return leave(s, r0)`)

        writeRaw(`  default: oops()`)
        writeRaw(`} } }`)
        let info = nodeLocationInfo(proc.action) as FunctionLocationInfo
        info.functionName = proc.getName()
        info.argumentNames = proc.args && proc.args.map(a => a.getName());
        writeRaw(`${proc.label()}.info = ${JSON.stringify(info)}`)
        if (proc.isGetter())
            writeRaw(`${proc.label()}.isGetter = true;`)
        if (proc.isRoot)
            writeRaw(`${proc.label()}.continuations = [ ${asyncContinuations.join(",")} ]`)

        writeRaw(fnctor(proc.label() + "_mk", proc.label(), maxStack, Object.keys(localsCache)))
        writeRaw(hexlits)

        proc.cachedJS = resText

        return resText

        // pre-create stack frame for this procedure with all the fields we need, so the
        // Hidden Class in the JIT is initalized optimally
        function fnctor(id: string, procname: string, numTmps: number, locals: string[]) {
            let r = ""
            r += `
function ${id}(s) {
    checkStack(s.depth);
    return {
        parent: s, fn: ${procname}, depth: s.depth + 1,
        pc: 0, retval: undefined, r0: undefined, overwrittenPC: false, lambdaArgs: null,
`
            for (let i = 0; i < numTmps; ++i)
                r += `  tmp_${i}: undefined,\n`
            // this includes parameters
            for (let l of locals)
                r += `  ${l}: undefined,\n`
            r += `} }\n`
            return r
        }

        function emitBreakpoint(s: ir.Stmt) {
            let id = s.breakpointInfo.id
            let lbl: number;
            write(`s.lastBrkId = ${id};`)

            if (bin.options.breakpoints) {
                lbl = ++lblIdx
                let brkCall = `return breakpoint(s, ${lbl}, ${id}, r0);`
                if (s.breakpointInfo.isDebuggerStmt) {
                    write(brkCall)
                }
                else {
                    write(`if ((breakpoints[0] && isBreakFrame(s)) || breakpoints[${id}]) ${brkCall}`)
                    if (bin.options.trace) {
                        write(`else return trace(${id}, s, ${lbl}, ${proc.label()}.info);`)
                    }
                }
            }
            else if (bin.options.trace) {
                lbl = ++lblIdx
                write(`return trace(${id}, s, ${lbl}, ${proc.label()}.info);`)
            }
            else {
                return;
            }
            writeRaw(`  case ${lbl}:`)
        }

        function locref(cell: ir.Cell) {
            if (cell.isGlobal())
                return "globals." + cell.uniqueName()
            else if (cell.iscap)
                return `s.caps[${cell.index}]`
            const un = cell.uniqueName()
            localsCache[un] = true
            return "s." + un
        }

        function emitJmp(jmp: ir.Stmt, isJmpNext: boolean) {
            if (jmp.lbl.lblNumUses == ir.lblNumUsesJmpNext || isJmpNext) {
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
            } else {
                emitExpr(jmp.expr)
                if (jmp.jmpMode == ir.JmpMode.IfNotZero) {
                    write(`if (r0) ${trg}`)
                } else {
                    write(`if (!r0) ${trg}`)
                }
            }
        }

        function canEmitInto(e: ir.Expr) {
            switch (e.exprKind) {
                case EK.NumberLiteral:
                case EK.PointerLiteral:
                case EK.SharedRef:
                case EK.CellRef:
                    return true
                default:
                    return false
            }
        }

        function emitExprPossiblyInto(e: ir.Expr): string {
            if (canEmitInto(e))
                return emitExprInto(e)
            emitExpr(e)
            return "r0"
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
                    if (e.ptrlabel()) {
                        return e.ptrlabel().lblId + "";
                    } else if (e.hexlit() != null) {
                        hexlits += `const ${e.data} = pxsim.BufferMethods.createBufferFromHex("${e.hexlit()}")\n`
                        return e.data;
                    } else if (typeof e.jsInfo == "string") {
                        return e.jsInfo;
                    } else {
                        U.oops()
                    }
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
                case EK.FieldAccess:
                    let info = e.data as FieldAccessInfo
                    let shimName = info.shimName
                    let obj = emitExprPossiblyInto(e.args[0])
                    if (shimName) {
                        write(`r0 = ${obj}${shimName};`)
                        return
                    }
                    write(`r0 = ${obj}.fields["${info.name}"];`)
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
                    emitInstanceOf(e.data, e.jsInfo as string)
                    return
                default:
                    write(`r0 = ${emitExprInto(e)};`)
            }
        }

        function checkSubtype(info: ClassInfo, r0 = "r0") {
            const vt = `${info.id}_VT`
            return `checkSubtype(${r0}, ${vt})`
        }

        function emitInstanceOf(info: ClassInfo, tp: string, r0 = "r0") {
            if (tp == "bool")
                write(`r0 = ${checkSubtype(info)};`)
            else if (tp == "validate") {
                write(`if (!${checkSubtype(info, r0)}) failedCast(${r0});`)
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
                const idx = exprStack.length
                exprStack.push(arg)
                let val = emitExprPossiblyInto(arg)
                if (val != "r0")
                    val = "r0 = " + val
                write(`s.tmp_${idx} = ${val};`)
            }
        }

        function emitRtCall(topExpr: ir.Expr) {
            let info = ir.flattenArgs(topExpr.args)

            info.precomp.forEach(emitExpr)

            let name: string = topExpr.data
            let args = info.flattened.map(emitExprInto)

            if (name == "langsupp::ignore")
                return

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
            const procid = topExpr.data as ir.ProcId
            const callproc = procid.proc

            if (callproc && callproc.inlineBody)
                return emitExpr(callproc.inlineSelf(topExpr.args))

            const frameExpr = ir.rtcall("<frame>", [])
            frameExpr.totalUses = 1
            frameExpr.currUses = 0
            const frameIdx = exprStack.length
            exprStack.push(frameExpr)
            const frameRef = `s.tmp_${frameIdx}`

            const lblId = ++lblIdx
            const isLambda = procid.virtualIndex == -1

            if (callproc)
                write(`${frameRef} = ${callproc.label()}_mk(s);`)
            else {
                let id = "generic"
                if (procid.ifaceIndex != null)
                    id = "if_" + bin.ifaceMembers[procid.ifaceIndex]
                else if (isLambda)
                    id = "lambda"
                else if (procid.virtualIndex != null)
                    id = procid.classInfo.id + "_v" + procid.virtualIndex
                else U.oops();
                const argLen = topExpr.args.length
                id += "_" + argLen + "_mk"
                bin.recordHelper(proc.usingCtx, id, () => {
                    const locals = U.range(argLen).map(i => "arg" + i)
                    return fnctor(id, "null", 5, locals)
                })
                write(`${frameRef} = ${id}(s);`)
            }

            //console.log("PROCCALL", topExpr.toString())
            topExpr.args.forEach((a, i) => {
                let arg = `arg${i}`
                if (isLambda) {
                    if (i == 0)
                        arg = `argL`
                    else
                        arg = `arg${i - 1}`
                }
                write(`${frameRef}.${arg} = ${emitExprPossiblyInto(a)};`)
            })

            let callIt = `s.pc = ${lblId}; return ${frameRef};`

            if (procid.ifaceIndex != null) {
                U.assert(callproc == null)
                const ifaceFieldName = bin.ifaceMembers[procid.ifaceIndex]
                U.assert(!!ifaceFieldName, `no name for ${procid.ifaceIndex}`)

                write(`if (!${frameRef}.arg0.vtable.iface) {`)
                let args = topExpr.args.map((a, i) => `${frameRef}.arg${i}`)
                args.splice(1, 0, JSON.stringify(ifaceFieldName))
                const accessor = `pxsim_pxtrt.map${procid.isSet ? "Set" : "Get"}ByString`
                if (procid.noArgs)
                    write(`  s.retval = ${accessor}(${args.join(", ")});`)
                else {
                    U.assert(!procid.isSet)
                    write(`  setupLambda(${frameRef}, ${accessor}(${args.slice(0, 2).join(", ")}), ${topExpr.args.length});`)
                    write(`  ${callIt}`)
                }
                write(`} else {`)

                write(`  ${frameRef}.fn = ${frameRef}.arg0.vtable.iface["${procid.isSet ? "set/" : ""}${ifaceFieldName}"];`)
                let fld = `${frameRef}.arg0.fields["${ifaceFieldName}"]`
                if (procid.isSet) {
                    write(`  if (${frameRef}.fn === null) { ${fld} = ${frameRef}.arg1; }`)
                    write(`  else if (${frameRef}.fn === undefined) { failedCast(${frameRef}.arg0) } `)
                } else if (procid.noArgs) {
                    write(`  if (${frameRef}.fn == null) { s.retval = ${fld}; }`)
                    write(`  else if (!${frameRef}.fn.isGetter) { s.retval = bind(${frameRef}); }`)
                } else {
                    write(`  if (${frameRef}.fn == null) { setupLambda(${frameRef}, ${fld}, ${topExpr.args.length}); ${callIt} }`)
                    // this is tricky - we need to do two calls, first to the accessor
                    // and then on the returned lambda - this is handled by leaveAccessor() runtime
                    // function
                    write(`  else if (${frameRef}.fn.isGetter) { ${frameRef}.stage2Call = true; ${callIt}; }`)
                }
                write(` else { ${callIt} }`)
                write(`}`)
                callIt = ""
            } else if (procid.virtualIndex == -1) {
                // lambda call
                U.assert(callproc == null)
                write(`setupLambda(${frameRef}, ${frameRef}.argL);`)
            } else if (procid.virtualIndex != null) {
                U.assert(callproc == null)
                assert(procid.virtualIndex >= 0)
                emitInstanceOf(procid.classInfo, "validate", frameRef + ".arg0")
                const meth = procid.classInfo.vtable[procid.virtualIndex]
                write(`${frameRef}.fn = ${frameRef}.arg0.vtable.methods.${meth.getName()};`)
            } else {
                U.assert(callproc != null)
            }

            if (callIt) write(callIt)
            writeRaw(`  case ${lblId}:`)
            write(`r0 = s.retval;`)

            frameExpr.currUses = 1
        }

        function bitSizeConverter(b: BitSize) {
            switch (b) {
                case BitSize.None: return ""
                case BitSize.Int8: return "pxtrt.toInt8"
                case BitSize.Int16: return "pxtrt.toInt16"
                case BitSize.Int32: return "pxtrt.toInt32"
                case BitSize.UInt8: return "pxtrt.toUInt8"
                case BitSize.UInt16: return "pxtrt.toUInt16"
                case BitSize.UInt32: return "pxtrt.toUInt32"
                default: throw oops()
            }
        }

        function emitStore(trg: ir.Expr, src: ir.Expr) {
            switch (trg.exprKind) {
                case EK.CellRef:
                    let cell = trg.data as ir.Cell
                    let src2 = emitExprPossiblyInto(src)
                    write(`${locref(cell)} = ${bitSizeConverter(cell.bitSize)}(${src2});`)
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

        function stackEmpty() {
            for (let e of exprStack) {
                if (e.totalUses !== e.currUses)
                    oops();
            }
            maxStack = Math.max(exprStack.length, maxStack);
            exprStack = [];
        }
    }

}
