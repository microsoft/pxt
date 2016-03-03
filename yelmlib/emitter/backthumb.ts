namespace ts.yelm {
    export function irToAssembly(bin: Binary, proc: ir.Procedure) {
        let resText = ""
        let write = (s: string) => { resText += asmline(s); }
        let EK = ir.EK;

        //console.log(proc.toString())

        write(`
;
; Function ${proc.getName()}
;
.section code
${getFunctionLabel(proc.action)}:
    @stackmark func
    @stackmark args
    push {lr}
`)

        let numlocals = proc.locals.length
        if (numlocals > 0) write("movs r0, #0")
        proc.locals.forEach(l => {
            write("push {r0} ; loc")
        })
        write("@stackmark locals")

        proc.resolve()

        let exprStack: ir.Expr[] = []

        for (let i = 0; i < proc.body.length; ++i) {
            let s = proc.body[i]
            // console.log("STMT", s.toString())
            switch (s.stmtKind) {
                case ir.SK.Expr:
                    emitExpr(s.expr)
                    break;
                case ir.SK.StackEmpty:
                    if (exprStack.length > 0) {
                        for (let stmt of proc.body.slice(i - 4, i + 1))
                            console.log(`PREVSTMT ${stmt.toString().trim()}`)
                        for (let e of exprStack)
                            console.log(`EXPRSTACK ${e.currUses}/${e.totalUses} E: ${e.toString()}`)
                        oops("stack should be empty")
                    }
                    write("@stackempty locals")
                    break;
                case ir.SK.Jmp:
                    emitJmp(s);
                    break;
                case ir.SK.Label:
                    write(s.lblName + ":")
                    break;
                default: oops();
            }
        }

        assert(0 <= numlocals && numlocals < 127);
        if (numlocals > 0)
            write("add sp, #4*" + numlocals + " ; pop locals " + numlocals)
        write("pop {pc}");
        write("@stackempty func");
        write("@stackempty args")

        if (proc.args.length <= 2)
            emitLambdaWrapper()

        return resText

        function mkLbl(root: string) {
            return "." + root + bin.lblNo++
        }

        function emitStmt(s: ir.Stmt) {
        }

        function emitJmp(jmp: ir.Stmt) {
            if (jmp.jmpMode == ir.JmpMode.Always) {
                if (jmp.expr)
                    emitExpr(jmp.expr)
                write("bb " + jmp.lblName + " ; with expression")
            } else {
                let lbl = mkLbl("jmpz")
                emitExpr(jmp.expr)

                write("*cmp r0, #0")
                if (jmp.jmpMode == ir.JmpMode.IfNotZero) {
                    write("*beq " + lbl) // this is to *skip* the following 'b' instruction; beq itself has a very short range
                    write("@js if (r0)")
                } else {
                    write("*bne " + lbl)
                    write("@js if (!r0)")
                }

                write("bb " + jmp.lblName)
                write(lbl + ":")
            }
        }

        function clearStack() {
            let numEntries = 0
            while (exprStack.length > 0 && exprStack[0].currUses == exprStack[0].totalUses) {
                numEntries++;
                exprStack.shift()
            }
            if (numEntries)
                write("add sp, #4*" + numEntries + " ; clear stack")
        }

        function withRef(name: string, isRef: boolean) {
            return name + (isRef ? "Ref" : "")
        }

        function emitExprInto(e: ir.Expr, reg: string) {
            switch (e.exprKind) {
                case EK.NumberLiteral:
                    if (e.data === true) emitInt(1, reg);
                    else if (e.data === false) emitInt(0, reg);
                    else if (e.data === null) emitInt(0, reg);
                    else if (typeof e.data == "number") emitInt(e.data, reg)
                    else oops();
                    break;
                case EK.PointerLiteral:
                    emitLdPtr(e.data, reg);
                    write(`@js ${reg} = ${e.jsInfo}`)
                    break;
                case EK.Shared:
                    let arg = e.args[0]
                    U.assert(!!arg.currUses) // not first use
                    U.assert(arg.currUses < arg.totalUses)
                    arg.currUses++
                    let idx = exprStack.indexOf(arg)
                    U.assert(idx >= 0)
                    if (idx == 0 && arg.totalUses == arg.currUses) {
                        write(`pop {${reg}}  ; tmpref @${exprStack.length}`)
                        exprStack.shift()
                        clearStack()
                    } else {
                        write(`ldr ${reg}, [sp, #4*${idx}]   ; tmpref @${exprStack.length - idx}`)
                    }
                    break;
                case EK.CellRef:
                    let cell = e.data as ir.Cell;
                    if (cell.isGlobal())
                        return emitExpr(ir.rtcall(withRef("bitvm::ldglb", cell.isRef()), [ir.numlit(cell.index)]))
                    write(`ldr ${reg}, ${cellref(cell)}`)
                    break;
                default: oops();
            }
        }

        // result in R0
        function emitExpr(e: ir.Expr): void {
            //console.log(`EMITEXPR ${e.sharingInfo()} E: ${e.toString()}`)

            switch (e.exprKind) {
                case EK.JmpValue:
                    write("; jmp value (already in r0)")
                    break;
                case EK.Incr:
                    emitExpr(e.args[0])
                    emitCallRaw("bitvm::incr")
                    break;
                case EK.Decr:
                    emitExpr(e.args[0])
                    emitCallRaw("bitvm::decr")
                    break;
                case EK.FieldAccess:
                    let info = e.data as FieldAccessInfo
                    // it does the decr itself, no mask
                    return emitExpr(ir.rtcall(withRef("bitvm::ldfld", info.isRef), [e.args[0], ir.numlit(info.idx)]))
                case EK.Store:
                    return emitStore(e.args[0], e.args[1])
                case EK.RuntimeCall:
                    return emitRtCall(e);
                case EK.ProcCall:
                    return emitProcCall(e)
                case EK.Shared:
                    return emitSharedDef(e)
                case EK.Sequence:
                    return e.args.forEach(emitExpr)
                default:
                    return emitExprInto(e, "r0")
            }
        }

        function emitSharedDef(e: ir.Expr) {
            let arg = e.args[0]
            U.assert(!!arg.totalUses)
            if (arg.currUses > 0)
                return emitExprInto(e, "r0") // cached use
            arg.currUses = 1
            if (arg.totalUses == 1)
                return emitExpr(arg)
            else {
                emitExpr(arg)
                exprStack.unshift(arg)
                write("push {r0} ; tmpstore @" + exprStack.length)
            }
        }

        function emitRtCall(topExpr: ir.Expr) {
            let didStateUpdate = false
            let complexArgs: ir.Expr[] = []
            for (let a of U.reversed(topExpr.args)) {
                if (a.isStateless()) continue
                if (a.exprKind == EK.CellRef && !(a.data as ir.Cell).isGlobal() && !didStateUpdate) continue
                if (a.canUpdateCells()) didStateUpdate = true
                complexArgs.push(a)
            }
            complexArgs.reverse()
            let precomp: ir.Expr[] = []
            let flattened = topExpr.args.map(a => {
                let idx = complexArgs.indexOf(a)
                if (idx >= 0) {
                    let shared = a
                    if (a.exprKind == EK.Shared) {
                        a.args[0].totalUses++
                    } else if (a.exprKind != EK.Shared) {
                        shared = ir.shared(a)
                        a.totalUses = 2
                    }
                    precomp.push(shared)
                    return shared
                } else return a
            })

            precomp.forEach(emitExpr)

            flattened.forEach((a, i) => {
                U.assert(i <= 3)
                emitExprInto(a, "r" + i)
            })
            
            let name: string = topExpr.data
            //console.log("RT",name,topExpr.isAsync)
            let lbl = topExpr.isAsync ? mkLbl("rtcall") : ""
            write(`bl ${name}  ; *F${topExpr.args.length} ${lbl}`)
            if (lbl)
                write(lbl + ":")
        }

        function emitProcCall(topExpr: ir.Expr) {
            let stackBottom = 0
            //console.log("PROCCALL", topExpr.toString())
            let argStmts = topExpr.args.map((a, i) => {
                emitExpr(a)
                write("push {r0} ; proc-arg")
                a.totalUses = 1
                a.currUses = 0
                exprStack.unshift(a)
                if (i == 0) stackBottom = exprStack.length
                U.assert(exprStack.length - stackBottom == i)
                return a
            })

            let proc = bin.procs.filter(p => p.action == topExpr.data)[0]

            let lbl = mkLbl("call")
            write("bl " + getFunctionLabel(proc.action) + " ; *R " + lbl)
            write(lbl + ":")

            for (let a of argStmts) {
                a.currUses = 1
            }
            clearStack()
        }

        function emitStore(trg: ir.Expr, src: ir.Expr) {
            switch (trg.exprKind) {
                case EK.CellRef:
                    let cell = trg.data as ir.Cell
                    if (cell.isGlobal()) {
                        emitExpr(ir.rtcall(withRef("bitvm::stglb", cell.isRef()), [src, ir.numlit(cell.index)]))
                    } else {
                        emitExpr(src)
                        write("str r0, " + cellref(cell))
                    }
                    break;
                case EK.FieldAccess:
                    let info = trg.data as FieldAccessInfo
                    // it does the decr itself, no mask
                    emitExpr(ir.rtcall(withRef("bitvm::stfld", info.isRef), [trg.args[0], ir.numlit(info.idx), src]))
                    break;
            }
        }

        function cellref(cell: ir.Cell) {
            U.assert(!cell.isGlobal())
            if (cell.iscap) {
                assert(0 <= cell.index && cell.index < 32)
                return "[r5, #4*" + cell.index + "]"
            } else if (cell.isarg) {
                let idx = proc.args.length - cell.index - 1
                return "[sp, args@" + idx + "] ; " + cell.toString()
            } else {
                return "[sp, locals@" + cell.index + "] ; " + cell.toString()
            }
        }

        function emitLambdaWrapper() {
            let node = proc.action
            write("")
            write(".section code");
            write(".balign 4");
            write(getFunctionLabel(node) + "_Lit:");
            write(".short 0xffff, 0x0000   ; action literal");
            write("@stackmark litfunc");
            write("push {r5, lr}");
            write("mov r5, r1");

            let parms = proc.args.map(a => a.def)
            parms.forEach((p, i) => {
                if (i >= 2)
                    U.userError(U.lf("only up to two parameters supported in lambdas"))
                write(`push {r${i + 2}}`)
            })
            write("@stackmark args");

            let nxt = mkLbl("nxt")
            write(`bl ${getFunctionLabel(node)}   ; *R ${nxt}`)
            write(nxt + ":")

            write("@stackempty args")
            if (parms.length)
                write("add sp, #4*" + parms.length + " ; pop args")
            write("pop {r5, pc}");
            write("@stackempty litfunc");
        }

        function emitCallRaw(name: string) {
            var inf = hex.lookupFunc(name)
            assert(!!inf, "unimplemented raw function: " + name)
            write("bl " + name + " ; *" + inf.type + inf.args + " (raw)")
        }

        function writeCall(name: string, mask: number, isAsync = false) {
            var inf = hex.lookupFunc(name)
            assert(!!inf, "unimplemented function: " + name)

            assert(inf.args <= 4)

            if (inf.args >= 4)
                write("pop {r3}");
            if (inf.args >= 3)
                write("pop {r2}");
            if (inf.args >= 2)
                write("pop {r1}");
            if (inf.args >= 1)
                write("pop {r0}");

            var reglist: string[] = []

            for (var i = 0; i < 4; ++i) {
                if (mask & (1 << i))
                    reglist.push("r" + i)
            }

            var numMask = reglist.length

            if (inf.type == "F" && mask != 0) {
                // reserve space for return val
                reglist.push("r7")
                write("@stackmark retval")
            }

            assert((mask & ~0xf) == 0)

            if (reglist.length > 0)
                write("push {" + reglist.join(",") + "}")

            let lbl = ""
            if (isAsync)
                lbl = mkLbl("async")

            write("bl " + name + " ; *" + inf.type + inf.args + " " + lbl)

            if (lbl) write(lbl + ":")

            if (inf.type == "F") {
                if (mask == 0)
                    write("push {r0}");
                else {
                    write("str r0, [sp, retval@-1]")
                }
            }
            else if (inf.type == "P") {
                // ok
            }
            else oops("invalid call type " + inf.type)

            while (numMask-- > 0) {
                writeCall("bitvm::decr", 0);
            }
        }

        function emitLdPtr(lbl: string, reg: string) {
            assert(!!lbl)
            write(`*movs ${reg}, ${lbl}@hi  ; ldptr`)
            write(`*lsls ${reg}, ${reg}, #8`)
            write(`*adds ${reg}, ${lbl}@lo`);
        }

        function emitInt(v: number, reg: string) {
            function writeMov(v: number) {
                assert(0 <= v && v <= 255)
                write(`movs ${reg}, #${v}`)
            }

            function writeAdd(v: number) {
                assert(0 <= v && v <= 255)
                write(`adds ${reg}, #${v}`)
            }

            function shift() {
                write(`lsls ${reg}, ${reg}, #8`)
            }

            assert(v != null);

            var n = Math.floor(v)
            var isNeg = false
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
                write(`negs ${reg}, ${reg}`)
            }
        }


    }


    // TODO should be internal
    export module hex {
        var funcInfo: StringMap<FuncInfo>;
        var hex: string[];
        var jmpStartAddr: number;
        var jmpStartIdx: number;
        var bytecodeStartAddr: number;
        var bytecodeStartIdx: number;

        function swapBytes(str: string) {
            var r = ""
            for (var i = 0; i < str.length; i += 2)
                r = str[i] + str[i + 1] + r
            assert(i == str.length)
            return r
        }


        export function isSetupFor(extInfo: ExtensionInfo) {
            return currentSetup == extInfo.sha
        }

        function parseHexBytes(bytes: string): number[] {
            bytes = bytes.replace(/^[\s:]/, "")
            if (!bytes) return []
            var m = /^([a-f0-9][a-f0-9])/i.exec(bytes)
            if (m)
                return [parseInt(m[1], 16)].concat(parseHexBytes(bytes.slice(2)))
            else
                throw oops("bad bytes " + bytes)
        }

        var currentSetup: string = null;
        export function setupFor(extInfo: ExtensionInfo, bytecodeInfo: any) {
            if (isSetupFor(extInfo))
                return;

            currentSetup = extInfo.sha;

            var jsinf = bytecodeInfo
            hex = jsinf.hex;

            var i = 0;
            var upperAddr = "0000"
            var lastAddr = 0
            var lastIdx = 0
            bytecodeStartAddr = 0
            for (; i < hex.length; ++i) {
                var m = /:02000004(....)/.exec(hex[i])
                if (m) {
                    upperAddr = m[1]
                }
                m = /^:..(....)00/.exec(hex[i])
                if (m) {
                    var newAddr = parseInt(upperAddr + m[1], 16)
                    if (!bytecodeStartAddr && newAddr >= 0x3C000) {
                        var bytes = parseHexBytes(hex[lastIdx])
                        if (bytes[0] != 0x10) {
                            bytes.pop() // checksum
                            bytes[0] = 0x10;
                            while (bytes.length < 20)
                                bytes.push(0x00)
                            hex[lastIdx] = hexBytes(bytes)
                        }
                        assert((bytes[2] & 0xf) == 0)

                        bytecodeStartAddr = lastAddr + 16
                        bytecodeStartIdx = lastIdx + 1
                    }
                    lastIdx = i
                    lastAddr = newAddr
                }
                m = /^:10....000108010842424242010801083ED8E98D/.exec(hex[i])
                if (m) {
                    jmpStartAddr = lastAddr
                    jmpStartIdx = i
                }
            }

            if (!jmpStartAddr)
                oops("No hex start")

            funcInfo = {};
            var funs: FuncInfo[] = jsinf.functions.concat(extInfo.functions);

            var addEnum = (enums: any) =>
                Object.keys(enums).forEach(k => {
                    funcInfo[k] = {
                        name: k,
                        type: "E",
                        args: 0,
                        value: enums[k]
                    }
                })

            addEnum(extInfo.enums)
            addEnum(jsinf.enums)

            for (var i = jmpStartIdx + 1; i < hex.length; ++i) {
                var m = /^:10(....)00(.{16})/.exec(hex[i])

                if (!m) continue;

                var s = hex[i].slice(9)
                while (s.length >= 8) {
                    var inf = funs.shift()
                    if (!inf) return;
                    funcInfo[inf.name] = inf;
                    let hexb = s.slice(0, 8)
                    //console.log(inf.name, hexb)
                    inf.value = parseInt(swapBytes(hexb), 16) & 0xfffffffe
                    if (!inf.value) {
                        U.oops("No value for " + inf.name + " / " + hexb)
                    }
                    s = s.slice(8)
                }
            }

            oops();
        }

        export function lookupFunc(name: string) {
            if (/^uBit\./.test(name))
                name = name.replace(/^uBit\./, "micro_bit::").replace(/\.(.)/g, (x, y) => y.toUpperCase())
            return funcInfo[name]
        }

        export function lookupFunctionAddr(name: string) {
            var inf = lookupFunc(name)
            if (inf)
                return inf.value - bytecodeStartAddr
            return null
        }


        export function hexTemplateHash() {
            var sha = currentSetup ? currentSetup.slice(0, 16) : ""
            while (sha.length < 16) sha += "0"
            return sha.toUpperCase()
        }

        function hexBytes(bytes: number[]) {
            var chk = 0
            var r = ":"
            bytes.forEach(b => chk += b)
            bytes.push((-chk) & 0xff)
            bytes.forEach(b => r += ("0" + b.toString(16)).slice(-2))
            return r.toUpperCase();
        }

        export function patchHex(bin: Binary, shortForm: boolean) {
            var myhex = hex.slice(0, bytecodeStartIdx)

            assert(bin.buf.length < 32000)

            var ptr = 0

            function nextLine(buf: number[], addr: number) {
                var bytes = [0x10, (addr >> 8) & 0xff, addr & 0xff, 0]
                for (var j = 0; j < 8; ++j) {
                    bytes.push((buf[ptr] || 0) & 0xff)
                    bytes.push((buf[ptr] || 0) >>> 8)
                    ptr++
                }
                return bytes
            }

            var hd = [0x4207, bin.globals.length, bytecodeStartAddr & 0xffff, bytecodeStartAddr >>> 16]
            var tmp = hexTemplateHash()
            for (var i = 0; i < 4; ++i)
                hd.push(parseInt(swapBytes(tmp.slice(i * 4, i * 4 + 4)), 16))

            myhex[jmpStartIdx] = hexBytes(nextLine(hd, jmpStartAddr))

            ptr = 0

            if (shortForm) myhex = []

            var addr = bytecodeStartAddr;
            var upper = (addr - 16) >> 16
            while (ptr < bin.buf.length) {
                if ((addr >> 16) != upper) {
                    upper = addr >> 16
                    myhex.push(hexBytes([0x02, 0x00, 0x00, 0x04, upper >> 8, upper & 0xff]))
                }

                myhex.push(hexBytes(nextLine(bin.buf, addr)))
                addr += 16
            }

            if (!shortForm)
                hex.slice(bytecodeStartIdx).forEach(l => myhex.push(l))

            return myhex;
        }


    }

    export function asmline(s: string) {
        if (!/(^[\s;])|(:$)/.test(s))
            s = "    " + s
        return s + "\n"
    }


}
