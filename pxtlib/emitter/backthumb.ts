namespace ts.pxt {
    export var decodeBase64 = function (s: string) { return atob(s); }

    function irToAssembly(bin: Binary, proc: ir.Procedure) {
        let resText = ""
        let write = (s: string) => { resText += asmline(s); }
        let EK = ir.EK;


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

        //console.log(proc.toString())
        proc.resolve()
        //console.log("OPT", proc.toString())

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
                case ir.SK.Breakpoint:
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

        function emitJmp(jmp: ir.Stmt) {
            if (jmp.jmpMode == ir.JmpMode.Always) {
                if (jmp.expr)
                    emitExpr(jmp.expr)
                write("bb " + jmp.lblName + " ; with expression")
            } else {
                let lbl = mkLbl("jmpz")

                if (jmp.jmpMode == ir.JmpMode.IfJmpValEq) {
                    emitExprInto(jmp.expr, "r1")
                    write("cmp r0, r1")
                } else {
                    emitExpr(jmp.expr)

                    if (jmp.expr.exprKind == EK.RuntimeCall && jmp.expr.data === "thumb::subs") {
                        // no cmp required
                    } else {
                        write("cmp r0, #0")
                    }
                }

                if (jmp.jmpMode == ir.JmpMode.IfNotZero) {
                    write("beq " + lbl) // this is to *skip* the following 'b' instruction; beq itself has a very short range
                } else {
                    // IfZero or IfJmpValEq
                    write("bne " + lbl)
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
                    break;
                case EK.SharedRef:
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
                    U.assert(!cell.isGlobal())
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
                    emitCallRaw("pxt::incr")
                    break;
                case EK.Decr:
                    emitExpr(e.args[0])
                    emitCallRaw("pxt::decr")
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
                case EK.CellRef:
                    let cell = e.data as ir.Cell;
                    if (cell.isGlobal())
                        return emitExpr(ir.rtcall(withRef("pxtrt::ldglb", cell.isRef()), [ir.numlit(cell.index)]))
                    else
                        return emitExprInto(e, "r0")
                default:
                    return emitExprInto(e, "r0")
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
                exprStack.unshift(arg)
                write("push {r0} ; tmpstore @" + exprStack.length)
            }
        }

        function emitRtCall(topExpr: ir.Expr) {
            let info = ir.flattenArgs(topExpr)

            info.precomp.forEach(emitExpr)
            info.flattened.forEach((a, i) => {
                U.assert(i <= 3)
                emitExprInto(a, "r" + i)
            })

            let name: string = topExpr.data
            //console.log("RT",name,topExpr.isAsync)

            if (U.startsWith(name, "thumb::")) {
                write(`${name.slice(7)} r0, r1`)
            } else {
                write(`bl ${name}`)
            }
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

            write("bl " + getFunctionLabel(proc.action))

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
                        emitExpr(ir.rtcall(withRef("pxtrt::stglb", cell.isRef()), [src, ir.numlit(cell.index)]))
                    } else {
                        emitExpr(src)
                        write("str r0, " + cellref(cell))
                    }
                    break;
                case EK.FieldAccess:
                    let info = trg.data as FieldAccessInfo
                    // it does the decr itself, no mask
                    emitExpr(ir.rtcall(withRef("pxtrt::stfld", info.isRef), [trg.args[0], ir.numlit(info.idx), src]))
                    break;
                default: oops();
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

            write(`bl ${getFunctionLabel(node)}`)

            write("@stackempty args")
            if (parms.length)
                write("add sp, #4*" + parms.length + " ; pop args")
            write("pop {r5, pc}");
            write("@stackempty litfunc");
        }

        function emitCallRaw(name: string) {
            let inf = hex.lookupFunc(name)
            assert(!!inf, "unimplemented raw function: " + name)
            write("bl " + name + " ; *" + inf.type + inf.args + " (raw)")
        }

        function emitLdPtr(lbl: string, reg: string) {
            assert(!!lbl)
            write(`movs ${reg}, ${lbl}@hi  ; ldptr`)
            write(`lsls ${reg}, ${reg}, #8`)
            write(`adds ${reg}, ${lbl}@lo`);
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
                write(`negs ${reg}, ${reg}`)
            }
        }


    }

    // TODO should be internal
    export namespace hex {
        let funcInfo: StringMap<FuncInfo>;
        let hex: string[];
        let jmpStartAddr: number;
        let jmpStartIdx: number;
        let bytecodeStartAddr: number;
        let bytecodeStartIdx: number;
        let asmLabels: StringMap<boolean> = {};
        export let asmTotalSource: string = "";

        function swapBytes(str: string) {
            let r = ""
            let i = 0
            for (; i < str.length; i += 2)
                r = str[i] + str[i + 1] + r
            assert(i == str.length)
            return r
        }

        export function setupInlineAssembly(opts: CompileOptions) {
            asmLabels = {}
            let asmSources = opts.sourceFiles.filter(f => U.endsWith(f, ".asm"))
            asmTotalSource = ""
            let asmIdx = 0

            for (let f of asmSources) {
                let src = opts.fileSystem[f]
                src.replace(/^\s*(\w+):/mg, (f, lbl) => {
                    asmLabels[lbl] = true
                    return ""
                })
                let code =
                    ".section code\n" +
                    "@stackmark func\n" +
                    "@scope user" + asmIdx++ + "\n" +
                    src + "\n" +
                    "@stackempty func\n" +
                    "@scope\n"
                asmTotalSource += code
            }
        }


        export function isSetupFor(extInfo: ExtensionInfo) {
            return currentSetup == extInfo.sha
        }

        function parseHexBytes(bytes: string): number[] {
            bytes = bytes.replace(/^[\s:]/, "")
            if (!bytes) return []
            let m = /^([a-f0-9][a-f0-9])/i.exec(bytes)
            if (m)
                return [parseInt(m[1], 16)].concat(parseHexBytes(bytes.slice(2)))
            else
                throw oops("bad bytes " + bytes)
        }

        let currentSetup: string = null;
        export let currentHexInfo: any;

        export function setupFor(extInfo: ExtensionInfo, hexinfo: any) {
            if (isSetupFor(extInfo))
                return;

            currentSetup = extInfo.sha;
            currentHexInfo = hexinfo;

            hex = hexinfo.hex;

            let i = 0;
            let upperAddr = "0000"
            let lastAddr = 0
            let lastIdx = 0
            bytecodeStartAddr = 0
            for (; i < hex.length; ++i) {
                let m = /:02000004(....)/.exec(hex[i])
                if (m) {
                    upperAddr = m[1]
                }
                m = /^:..(....)00/.exec(hex[i])
                let isFinal = false
                if (m) {
                    let newAddr = parseInt(upperAddr + m[1], 16)
                    if (newAddr >= 0x3C000) {
                        isFinal = true
                    }
                    lastIdx = i
                    lastAddr = newAddr
                }
                if (/^:00000001/.test(hex[i]))
                    isFinal = true
                if (!bytecodeStartAddr && isFinal) {
                    let bytes = parseHexBytes(hex[lastIdx])
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
                m = /^:10....000108010842424242010801083ED8E98D/.exec(hex[i])
                if (m) {
                    jmpStartAddr = lastAddr
                    jmpStartIdx = i
                }
            }

            if (!jmpStartAddr)
                oops("No hex start")

            if (!bytecodeStartAddr)
                oops("No hex end")

            funcInfo = {};
            let funs: FuncInfo[] = hexinfo.functions.concat(extInfo.functions);

            for (let i = jmpStartIdx + 1; i < hex.length; ++i) {
                let m = /^:10(....)00(.{16})/.exec(hex[i])

                if (!m) continue;

                let s = hex[i].slice(9)
                while (s.length >= 8) {
                    let inf = funs.shift()
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

        export function validateShim(funname: string, attrs: CommentAttrs, hasRet: boolean, numArgs: number) {
            if (attrs.shim == "TD_ID" || attrs.shim == "TD_NOOP")
                return
            if (U.lookup(asmLabels, attrs.shim))
                return
            let nm = `${funname}(...) (shim=${attrs.shim})`
            let inf = lookupFunc(attrs.shim)
            if (inf) {
                if (!hasRet) {
                    if (inf.type != "P")
                        U.userError("expecting procedure for " + nm);
                } else {
                    if (inf.type != "F")
                        U.userError("expecting function for " + nm);
                }
                if (numArgs != inf.args)
                    U.userError("argument number mismatch: " + numArgs + " vs " + inf.args + " in C++")
            } else {
                U.userError("function not found: " + nm)
            }
        }
        export function lookupFunc(name: string) {
            return funcInfo[name]
        }

        export function lookupFunctionAddr(name: string) {
            let inf = lookupFunc(name)
            if (inf)
                return inf.value
            return null
        }


        export function hexTemplateHash() {
            let sha = currentSetup ? currentSetup.slice(0, 16) : ""
            while (sha.length < 16) sha += "0"
            return sha.toUpperCase()
        }

        export function hexPrelude() {
            return `    .startaddr 0x${bytecodeStartAddr.toString(16)}\n`
        }

        function hexBytes(bytes: number[]) {
            let chk = 0
            let r = ":"
            bytes.forEach(b => chk += b)
            bytes.push((-chk) & 0xff)
            bytes.forEach(b => r += ("0" + b.toString(16)).slice(-2))
            return r.toUpperCase();
        }

        export function patchHex(bin: Binary, buf: number[], shortForm: boolean) {
            let myhex = hex.slice(0, bytecodeStartIdx)

            assert(buf.length < 32000)

            let ptr = 0

            function nextLine(buf: number[], addr: number) {
                let bytes = [0x10, (addr >> 8) & 0xff, addr & 0xff, 0]
                for (let j = 0; j < 8; ++j) {
                    bytes.push((buf[ptr] || 0) & 0xff)
                    bytes.push((buf[ptr] || 0) >>> 8)
                    ptr++
                }
                return bytes
            }

            let hd = [0x4208, bin.globals.length, bytecodeStartAddr & 0xffff, bytecodeStartAddr >>> 16]
            let tmp = hexTemplateHash()
            for (let i = 0; i < 4; ++i)
                hd.push(parseInt(swapBytes(tmp.slice(i * 4, i * 4 + 4)), 16))

            myhex[jmpStartIdx] = hexBytes(nextLine(hd, jmpStartAddr))

            ptr = 0

            if (shortForm) myhex = []

            let addr = bytecodeStartAddr;
            let upper = (addr - 16) >> 16
            while (ptr < buf.length) {
                if ((addr >> 16) != upper) {
                    upper = addr >> 16
                    myhex.push(hexBytes([0x02, 0x00, 0x00, 0x04, upper >> 8, upper & 0xff]))
                }

                myhex.push(hexBytes(nextLine(buf, addr)))
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

    function isDataRecord(s: string) {
        if (!s) return false
        let m = /^:......(..)/.exec(s)
        assert(!!m)
        return m[1] == "00"
    }

    function stringLiteral(s: string) {
        let r = "\""
        for (let i = 0; i < s.length; ++i) {
            // TODO generate warning when seeing high character ?
            let c = s.charCodeAt(i) & 0xff
            let cc = String.fromCharCode(c)
            if (cc == "\\" || cc == "\"")
                r += "\\" + cc
            else if (cc == "\n")
                r += "\\n"
            else if (c <= 0xf)
                r += "\\x0" + c.toString(16)
            else if (c < 32 || c > 127)
                r += "\\x" + c.toString(16)
            else
                r += cc;
        }
        return r + "\""
    }

    function emitStrings(bin: Binary) {
        for (let s of Object.keys(bin.strings)) {
            let lbl = bin.strings[s]
            bin.otherLiterals.push(`
.balign 4
${lbl}meta: .short 0xffff, ${s.length}
${lbl}: .string ${stringLiteral(s)}
`)
        }
    }


    function serialize(bin: Binary) {
        let asmsource = `; start
${hex.hexPrelude()}        
    .hex 708E3B92C615A841C49866C975EE5197 ; magic number
    .hex ${hex.hexTemplateHash()} ; hex template hash
    .hex 0000000000000000 ; @SRCHASH@
    .space 16 ; reserved
`
        bin.procs.forEach(p => {
            asmsource += "\n" + irToAssembly(bin, p) + "\n"
        })

        asmsource += hex.asmTotalSource

        asmsource += "_js_end:\n"
        emitStrings(bin)
        asmsource += bin.otherLiterals.join("")
        asmsource += "_program_end:\n"

        return asmsource
    }

    function patchSrcHash(src: string) {
        let sha = U.sha256(src)
        return src.replace(/\n.*@SRCHASH@\n/, "\n    .hex " + sha.slice(0, 16).toUpperCase() + " ; program hash\n")
    }

    export function thumbInlineAssemble(src: string) {
        let b = mkThumbFile()
        b.emit(src)
        throwThumbErrors(b)

        let res: number[] = []
        for (let i = 0; i < b.buf.length; i += 2) {
            res.push((((b.buf[i + 1] || 0) << 16) | b.buf[i]) >>> 0)
        }
        return res
    }

    function mkThumbFile() {
        thumb.test(); // just in case

        let b = new thumb.File();
        b.lookupExternalLabel = hex.lookupFunctionAddr;
        b.normalizeExternalLabel = s => {
            let inf = hex.lookupFunc(s)
            if (inf) return inf.name;
            return s
        }
        // b.throwOnError = true;

        return b
    }

    function throwThumbErrors(b: thumb.File) {
        if (b.errors.length > 0) {
            let userErrors = ""
            b.errors.forEach(e => {
                let m = /^user(\d+)/.exec(e.scope)
                if (m) {
                    // This generally shouldn't happen, but it may for certin kind of global 
                    // errors - jump range and label redefinitions
                    let no = parseInt(m[1]) // TODO lookup assembly file name
                    userErrors += U.lf("At inline assembly:\n")
                    userErrors += e.message
                }
            })

            if (userErrors) {
                //TODO
                console.log(U.lf("errors in inline assembly"))
                console.log(userErrors)
                throw new Error(b.errors[0].message)
            } else {
                throw new Error(b.errors[0].message)
            }
        }
    }

    let peepDbg = false
    function assemble(bin: Binary, src: string) {
        let b = mkThumbFile()
        b.emit(src);

        src = b.getSource(!peepDbg);

        throwThumbErrors(b)

        return {
            src: src,
            buf: b.buf
        }
    }

    function addSource(meta: string, binstring: string) {
        let metablob = Util.toUTF8(meta)
        let totallen = metablob.length + binstring.length

        if (totallen > 40000) {
            return "; program too long\n";
        }

        let str =
            `
    .balign 16
    .hex 41140E2FB82FA2BB
    .short ${metablob.length}
    .short ${binstring.length}
    .short 0, 0   ; future use

_stored_program: .string "`

        let addblob = (b: string) => {
            for (let i = 0; i < b.length; ++i) {
                let v = b.charCodeAt(i) & 0xff
                if (v <= 0xf)
                    str += "\\x0" + v.toString(16)
                else
                    str += "\\x" + v.toString(16)
            }
        }

        addblob(metablob)
        addblob(binstring)

        str += "\"\n"
        return str
    }

    export function thumbEmit(bin: Binary, opts: CompileOptions) {
        let src = serialize(bin)
        src = patchSrcHash(src)
        if (opts.embedBlob)
            src += addSource(opts.embedMeta, decodeBase64(opts.embedBlob))
        bin.writeFile(ts.pxt.BINARY_ASM, src)
        let res = assemble(bin, src)
        if (res.src)
            bin.writeFile(ts.pxt.BINARY_ASM, res.src)
        if (res.buf) {
            const myhex = hex.patchHex(bin, res.buf, false).join("\r\n") + "\r\n"
            bin.writeFile(ts.pxt.BINARY_HEX, myhex)
        }
    }

    export let validateShim = hex.validateShim;
}
