// TODO remove decr() on variable init
// TODO figure out why undefined initializer generates code

namespace ts.pxtc.ir {
    let U = pxtc.Util;
    let assert = U.assert;

    export enum EK {
        None,
        NumberLiteral,
        PointerLiteral,
        RuntimeCall,
        ProcCall,
        SharedRef,
        SharedDef,
        FieldAccess,
        Store,
        CellRef,
        Sequence,
        JmpValue,
        Nop,
        InstanceOf,
    }

    let currExprId = 0
    export class Node {
        private _id: number;
        isExpr(): this is Expr { return false }
        isStmt(): this is Stmt { return false }
        getId() {
            if (!this._id)
                this._id = ++currExprId
            return this._id
        }
    }

    export interface ConvInfo {
        argIdx: number;
        method: string;
        returnsRef?: boolean;
        refTag?: pxt.BuiltInType;
        refTagNullable?: boolean;
    }

    export interface MaskInfo {
        refMask: number;
        conversions?: ConvInfo[];
    }

    export class Expr extends Node {
        public jsInfo: {};
        public totalUses: number; // how many references this expression has; only for the only child of Shared
        public currUses: number;
        public irCurrUses: number;
        public callingConvention = CallingConvention.Plain;
        public mask: MaskInfo;
        public isStringLiteral: boolean;

        constructor(
            public exprKind: EK,
            public args: Expr[],
            public data: any
        ) {
            super();
        }

        static clone(e: Expr) {
            let copy = new Expr(e.exprKind, e.args ? e.args.slice(0) : null, e.data)
            if (e.jsInfo)
                copy.jsInfo = e.jsInfo
            if (e.totalUses) {
                copy.totalUses = e.totalUses
                copy.currUses = e.currUses
            }
            copy.callingConvention = e.callingConvention
            copy.mask = e.mask
            copy.isStringLiteral = e.isStringLiteral
            return copy
        }

        ptrlabel() {
            if (this.jsInfo instanceof Stmt)
                return this.jsInfo as Stmt
            return null
        }

        hexlit() {
            const anyJs = this.jsInfo as any
            if (anyJs.hexlit != null)
                return anyJs.hexlit
            return null
        }

        isExpr() { return true }

        isPure() {
            return this.isStateless() || this.exprKind == EK.CellRef;
        }

        isLiteral() {
            switch (this.exprKind) {
                case EK.NumberLiteral:
                case EK.PointerLiteral:
                    return true;
                default: return false;
            }
        }

        isStateless() {
            switch (this.exprKind) {
                case EK.NumberLiteral:
                case EK.PointerLiteral:
                case EK.SharedRef:
                    return true;
                default: return false;
            }
        }

        sharingInfo(): string {
            let arg0: ir.Expr = this
            let id = this.getId()
            if (this.exprKind == EK.SharedRef || this.exprKind == EK.SharedDef) {
                arg0 = this.args[0]
                if (!arg0) arg0 = { currUses: "", totalUses: "" } as any
                else id = arg0.getId()
            }
            return `${arg0.currUses}/${arg0.totalUses} #${id}`
        }

        toString(): string {
            return nodeToString(this)
        }

        canUpdateCells(): boolean {
            switch (this.exprKind) {
                case EK.NumberLiteral:
                case EK.PointerLiteral:
                case EK.CellRef:
                case EK.JmpValue:
                case EK.SharedRef:
                case EK.Nop:
                    return false;

                case EK.SharedDef:
                case EK.FieldAccess:
                case EK.InstanceOf:
                    return this.args[0].canUpdateCells()

                case EK.RuntimeCall:
                case EK.ProcCall:
                case EK.Sequence:
                    return true;

                case EK.Store:
                    return true;

                default: throw oops();
            }
        }
    }


    export enum SK {
        None,
        Expr,
        Label,
        Jmp,
        StackEmpty,
        Breakpoint,
    }

    export enum JmpMode {
        Always = 1,
        IfZero,
        IfNotZero,
    }

    export const lblNumUsesJmpNext = -101

    export class Stmt extends Node {
        public lblName: string;
        public lbl: Stmt;
        public lblNumUses: number;
        public lblStackSize: number;
        public jmpMode: JmpMode;
        public lblId: number;
        public breakpointInfo: Breakpoint;
        public stmtNo: number;
        public findIdx: number;
        // after this jump, the expression will no longer be used and can be cleared from the stack
        public terminateExpr: Expr;

        constructor(
            public stmtKind: SK,
            public expr: Expr
        ) {
            super()
        }

        isStmt() { return true }

        toString(): string {
            return nodeToString(this)
        }
    }

    function nodeToString(n: Node) {
        return str(n)
        function str(n: Node): string {
            if (n.isExpr()) {
                let e = n as Expr
                let a0 = e.args ? e.args[0] : null
                switch (e.exprKind) {
                    case EK.NumberLiteral:
                        return e.data + ""
                    case EK.PointerLiteral:
                        return e.data + ""
                    case EK.CellRef:
                        return (e.data as Cell).toString()
                    case EK.JmpValue:
                        return "JMPVALUE"
                    case EK.Nop:
                        return "NOP"

                    case EK.SharedRef:
                        return `SHARED_REF(#${a0.getId()})`

                    case EK.SharedDef:
                        return `SHARED_DEF(#${a0.getId()}: ${str(a0)})`

                    case EK.FieldAccess:
                        return `${str(a0)}.${(e.data as FieldAccessInfo).name}`

                    case EK.RuntimeCall:
                        return e.data + "(" + e.args.map(str).join(", ") + ")"

                    case EK.ProcCall:
                        let procid = e.data as ProcId
                        let name = ""
                        if (procid.ifaceIndex != null) name = `IFACE@${procid.ifaceIndex}`
                        else if (procid.virtualIndex != null) name = `VTABLE@${procid.virtualIndex}`
                        else name = getDeclName(procid.proc.action)
                        return name + "(" + e.args.map(str).join(", ") + ")"

                    case EK.Sequence:
                        return "(" + e.args.map(str).join("; ") + ")"

                    case EK.InstanceOf:
                        return "(" + str(e.args[0]) + " instanceof " + (e.data as ClassInfo).id + ")"

                    case EK.Store:
                        return `{ ${str(e.args[0])} := ${str(e.args[1])} }`

                    default: throw oops();
                }
            } else {
                let stmt = n as Stmt
                let inner = stmt.expr ? str(stmt.expr) : "{null}"
                switch (stmt.stmtKind) {
                    case ir.SK.Expr:
                        return "    " + inner + "\n"
                    case ir.SK.Jmp:
                        let fin = `goto ${stmt.lblName}\n`
                        switch (stmt.jmpMode) {
                            case JmpMode.Always:
                                if (stmt.expr)
                                    return `    { JMPVALUE := ${inner} } ${fin}`
                                else return "    " + fin
                            case JmpMode.IfZero:
                                return `    if (! ${inner}) ${fin}`
                            case JmpMode.IfNotZero:
                                return `    if (${inner}) ${fin}`
                            default: throw oops();
                        }
                    case ir.SK.StackEmpty:
                        return "    ;\n"
                    case ir.SK.Breakpoint:
                        return "    // brk " + (stmt.breakpointInfo.id) + "\n"
                    case ir.SK.Label:
                        return stmt.lblName + ":\n"
                    default: throw oops();
                }

            }
        }
    }

    export class Cell {
        isarg = false;
        iscap = false;
        _isLocal = false;
        _isGlobal = false;
        _debugType = "?";
        isUserVariable = false;
        bitSize = BitSize.None;
        repl: Expr;
        replUses: number;

        constructor(public index: number, public def: Declaration, public info: VariableAddInfo) {
            if (def) {
                if (!isInPxtModules(def)) {
                    this.isUserVariable = true
                }
                if (info) {
                    setCellProps(this)
                }
            }
        }

        getName() {
            return getDeclName(this.def)
        }

        getDebugInfo(): CellInfo {
            return {
                name: this.getName(),
                type: this._debugType,
                index: this.index,
            }
        }

        toString() {
            let n = ""
            if (this.def) n += this.getName() || "?"
            if (this.isarg) n = "ARG " + n
            //if (this.isByRefLocal()) n = "BYREF " + n
            return "[" + n + "]"
        }

        uniqueName() {
            if (this.isarg)
                return "arg" + this.index // have to keep names stable for inheritance
            return this.getName().replace(/[^\w]/g, "_") + "___" + getNodeId(this.def)
        }

        isLocal() { return this._isLocal }
        isGlobal() { return this._isGlobal }

        loadCore() {
            return op(EK.CellRef, null, this)
        }

        load() {
            let r = this.loadCore()

            if (target.isNative && this.bitSize != BitSize.None) {
                if (this.bitSize == BitSize.UInt32)
                    return rtcall("pxt::fromUInt", [r])
                return rtcall("pxt::fromInt", [r])
            }

            if (this.isByRefLocal())
                return rtcall("pxtrt::ldlocRef", [r])

            return r
        }

        isByRefLocal() {
            return this.isLocal() && this.info.captured && this.info.written
        }

        storeDirect(src: Expr) {
            return op(EK.Store, [this.loadCore(), src])
        }

        storeByRef(src: Expr) {
            if (this.isByRefLocal()) {
                return rtcall("pxtrt::stlocRef", [this.loadCore(), src])
            } else {
                if (target.isNative && this.bitSize != BitSize.None) {
                    let cnv = this.bitSize == BitSize.UInt32 ? "pxt::toUInt" : "pxt::toInt"
                    return this.storeDirect(rtcall(cnv, [src], 1))
                }

                return this.storeDirect(src)
            }
        }

        get isTemporary(): boolean {
            return false
        }
    }

    //Cells that represent variables that are generated by the compiler as temporaries
    //The user cannot access these cells from JS or blocks
    export class UnnamedCell extends Cell {
        private static unnamedCellCounter = 0
        private uid: number

        constructor(public index: number, public owningProc: Procedure) {
            super(index, null, null)
            this.uid = UnnamedCell.unnamedCellCounter++
        }

        getName() {
            return "unnamed" + this.uid
        }

        uniqueName() {
            return this.getName() + "___U" + this.index
        }

        isByRefLocal() {
            return false
        }

        get isTemporary(): boolean {
            return true
        }
    }

    export interface ProcId {
        proc?: Procedure;
        virtualIndex?: number;
        ifaceIndex?: number;
        classInfo?: ClassInfo;
        isSet?: boolean;
        isThis?: boolean; // it's a call of the form this.foo(...) - no need to check subtyping
        noArgs?: boolean; // this property access, with no arguments, except for 'this', passed
    }

    // estimated cost in bytes of Thumb code to execute given expression
    function inlineWeight(e: ir.Expr): number {
        const cantInline = 1000000
        const inner = () => {
            if (!e.args) return 0
            let inner = 0
            for (let ee of e.args)
                inner += inlineWeight(ee)
            if (e.mask && e.mask.conversions)
                inner += e.mask.conversions.length * 4
            return inner
        }
        switch (e.exprKind) {
            case EK.NumberLiteral:
                return 2
            case EK.PointerLiteral:
                return 2 + 4
            case EK.RuntimeCall:
                return inner() + 2 + 2 + 4
            case EK.CellRef:
                return 2
            case EK.FieldAccess:
                return inner() + ((e.data as FieldAccessInfo).needsCheck ? 4 : 0) + 2;

            case EK.ProcCall:
            case EK.SharedRef:
            case EK.SharedDef:
            case EK.Store:
            case EK.Sequence:
            case EK.JmpValue:
            case EK.Nop:
            case EK.InstanceOf:
                return cantInline

            /* maybe in future
            case EK.ProcCall:
                return inner() + 2 * e.args.length + 4 + 2
            case EK.SharedRef:
                return 2
            case EK.SharedDef:
                return inner() + 2
            case EK.Store:
                return inner()
            case EK.Sequence:
                return inner()
            case EK.JmpValue:
                return 0
            case EK.Nop:
                return 0
            case EK.InstanceOf:
                return inner() + 8
                */
            default:
                throw U.oops()
        }
    }

    function inlineSubst(e: Expr): Expr {
        e = Expr.clone(e)
        switch (e.exprKind) {
            case EK.PointerLiteral:
            case EK.NumberLiteral:
                return e
            case EK.RuntimeCall:
                for (let i = 0; i < e.args.length; ++i)
                    e.args[i] = inlineSubst(e.args[i])
                return e
            case EK.CellRef:
                const cell = e.data as Cell
                if (cell.repl) {
                    cell.replUses++
                    return cell.repl
                }
                return e
            case EK.FieldAccess:
                e.args[0] = inlineSubst(e.args[0])
                return e
            default:
                throw U.oops()
        }
    }

    export class Procedure extends Node {
        numArgs = 0;
        info: FunctionAddInfo = null;
        seqNo: number = -1;
        isRoot = false;
        locals: Cell[] = [];
        captured: Cell[] = [];
        args: Cell[] = [];
        parent: Procedure = null;
        debugInfo: ProcDebugInfo = null;
        fillDebugInfo: (th: assembler.File) => void = null;
        classInfo: ClassInfo = null;
        perfCounterName: string = null;
        perfCounterNo = 0;

        body: Stmt[] = [];
        lblNo = 0;
        action: ts.FunctionLikeDeclaration = null;
        inlineBody: ir.Expr;
        cachedJS: string = null;
        usingCtx: PxtNode = null;

        reset() {
            this.body = []
            this.lblNo = 0
            this.locals = []
            this.captured = []
            this.args = []
        }

        isGetter() {
            return this.action && this.action.kind == ts.SyntaxKind.GetAccessor
        }

        vtLabel() {
            return this.label() + (isStackMachine() ? "" : "_args")
        }

        label() {
            return getFunctionLabel(this.action)
        }

        toString(): string {
            return `\nPROC ${getDeclName(this.action)}\n${this.body.map(s => s.toString()).join("")}\n`
        }

        emit(stmt: Stmt) {
            this.body.push(stmt)
        }

        emitExpr(expr: Expr) {
            this.emit(stmt(SK.Expr, expr))
        }

        mkLabel(name: string) {
            let lbl = stmt(SK.Label, null)
            lbl.lblName = "." + name + "_" + this.lblNo++ + "_" + this.seqNo
            lbl.lbl = lbl
            return lbl
        }
        emitLbl(lbl: Stmt) {
            this.emit(lbl)
        }
        emitLblDirect(lblName: string) {
            let lbl = stmt(SK.Label, null)
            lbl.lblName = lblName
            lbl.lbl = lbl
            this.emit(lbl)
        }

        getFullName() {
            let name = this.getName()
            if (this.action) {
                let info = ts.pxtc.nodeLocationInfo(this.action)
                name += " " + info.fileName.replace("pxt_modules/", "") + ":" + (info.line + 1)
            }
            return name
        }

        getName() {
            let text = this.action && this.action.name ? (<Identifier>this.action.name).text : null
            return text || "inline"
        }

        mkLocal(def: Declaration, info: VariableAddInfo) {
            let l = new Cell(this.locals.length, def, info)
            this.locals.push(l)
            return l
        }

        mkLocalUnnamed() {
            let uc = new UnnamedCell(this.locals.length, this);
            this.locals.push(uc)
            return uc
        }

        localIndex(l: Declaration, noargs = false): Cell {
            return this.captured.filter(n => n.def == l)[0] ||
                this.locals.filter(n => n.def == l)[0] ||
                (noargs ? null : this.args.filter(n => n.def == l)[0])
        }

        stackEmpty() {
            this.emit(stmt(SK.StackEmpty, null))
        }

        emitJmpZ(trg: string | Stmt, expr: Expr) {
            this.emitJmp(trg, expr, JmpMode.IfZero)
        }

        emitJmp(trg: string | Stmt, expr?: Expr, mode = JmpMode.Always, terminate: Expr = null) {
            let jmp = stmt(SK.Jmp, expr)

            jmp.jmpMode = mode;
            if (terminate && terminate.exprKind == EK.NumberLiteral)
                terminate = null
            jmp.terminateExpr = terminate

            if (typeof trg == "string")
                jmp.lblName = trg as any
            else {
                jmp.lbl = trg as Stmt
                jmp.lblName = jmp.lbl.lblName
            }

            this.emit(jmp)
        }

        inlineSelf(args: ir.Expr[]) {
            const { precomp, flattened } = flattenArgs(args)
            U.assert(flattened.length == this.args.length)
            this.args.map((a, i) => {
                a.repl = flattened[i]
                a.replUses = 0
            })
            const r = inlineSubst(this.inlineBody)
            this.args.forEach((a, i) => {
                if (a.repl.exprKind == EK.SharedRef) {
                    a.repl.args[0].totalUses += a.replUses - 1
                }
                a.repl = null
                a.replUses = 0
            })
            if (precomp.length) {
                precomp.push(r)
                return op(EK.Sequence, precomp)
            } else {
                return r
            }
        }

        resolve() {
            let iterargs = (e: Expr, f: (v: Expr) => Expr) => {
                if (e.args)
                    for (let i = 0; i < e.args.length; ++i)
                        e.args[i] = f(e.args[i])
            }

            // after this, totalUses holds the negation of the actual usage count
            // also the first SharedRef is replaced with SharedDef
            let refdef = (e: Expr): Expr => {
                switch (e.exprKind) {
                    case EK.SharedDef: throw U.oops();
                    case EK.SharedRef:
                        let arg = e.args[0]
                        if (!arg.totalUses) {
                            arg.totalUses = -1
                            arg.currUses = 0
                            arg.irCurrUses = 0
                            let e2 = Expr.clone(e)
                            e2.exprKind = EK.SharedDef
                            e2.args[0] = refdef(e2.args[0])
                            return e2
                        } else {
                            arg.totalUses--;
                            return e
                        }
                }

                iterargs(e, refdef)

                return e
            }

            let opt = (e: ir.Expr): ir.Expr => {
                if (e.exprKind == EK.SharedRef)
                    return e;

                iterargs(e, opt)

                switch (e.exprKind) {
                    case EK.Sequence:
                        e.args = e.args.filter((a, i) => {
                            if (i != e.args.length - 1 && a.isPure()) {
                                // in the second opt() phase, we already have computed the total usage counts
                                // if we drop some expressions, these need to be updated
                                if (a.exprKind == EK.SharedRef && a.args[0].totalUses > 0)
                                    a.args[0].totalUses--
                                return false
                            }
                            return true
                        })
                        break;
                }

                return e
            }

            let cntuses = (e: Expr): Expr => {
                switch (e.exprKind) {
                    case EK.SharedDef:
                        let arg = e.args[0]
                        //console.log(arg)
                        U.assert(arg.totalUses < 0, "arg.totalUses < 0")
                        U.assert(arg.currUses === 0, "arg.currUses === 0")
                        // if there is just one usage, strip the SharedDef
                        if (arg.totalUses == -1)
                            return cntuses(arg)
                        else
                            // now, we start counting for real
                            arg.totalUses = 1;
                        break;
                    case EK.SharedRef:
                        U.assert(e.args[0].totalUses > 0, "e.args[0].totalUses > 0")
                        e.args[0].totalUses++;
                        return e;
                    case EK.PointerLiteral:
                        const pl = e.ptrlabel()
                        if (pl) {
                            if (!pl.lblNumUses) pl.lblNumUses = 0
                            pl.lblNumUses++
                        }
                        break
                }
                iterargs(e, cntuses)
                return e
            }

            let sharedincr = (e: Expr): Expr => {
                //console.log("OUTSH", e.toString())
                switch (e.exprKind) {
                    case EK.SharedDef:
                        iterargs(e, sharedincr)
                    case EK.SharedRef:
                        let arg = e.args[0]
                        U.assert(arg.totalUses > 0, "arg.totalUses > 0")
                        if (arg.totalUses == 1) {
                            U.assert(e.exprKind == EK.SharedDef)
                            return arg
                        }
                        arg.irCurrUses++
                        return e
                    default:
                        iterargs(e, sharedincr)
                        return e
                }
            }

            this.body = this.body.filter(s => {
                if (s.expr) {
                    //console.log("OPT", s.expr.toString())
                    s.expr = opt(refdef(s.expr))
                    //console.log("INTO", s.expr.toString())
                    if (s.stmtKind == ir.SK.Expr && s.expr.isPure())
                        return false;
                }
                return true
            })

            let lbls = U.toDictionary(this.body.filter(s => s.stmtKind == ir.SK.Label), s => s.lblName)

            for (let i = 0; i < this.body.length; ++i)
                this.body[i].stmtNo = i

            for (let s of this.body) {
                if (s.expr) {
                    //console.log("CNT", s.expr.toString())
                    s.expr = cntuses(s.expr)
                }

                switch (s.stmtKind) {
                    case ir.SK.Expr:
                        break;
                    case ir.SK.Jmp:
                        s.lbl = U.lookup(lbls, s.lblName)
                        if (!s.lbl) oops("missing label: " + s.lblName)
                        if (!s.lbl.lblNumUses) s.lbl.lblNumUses = 1
                        else s.lbl.lblNumUses++
                        break;
                    case ir.SK.StackEmpty:
                    case ir.SK.Label:
                    case ir.SK.Breakpoint:
                        break;
                    default: oops();
                }
            }

            let allBrkp: Breakpoint[] = []

            let prev: Stmt = null
            let canInline = target.debugMode ? false : true
            let inlineBody: Expr = null
            for (let s of this.body) {
                if (s.expr) {
                    s.expr = opt(sharedincr(s.expr))
                }

                // mark Jump-to-next-instruction
                if (prev && prev.lbl == s &&
                    prev.stmtKind == ir.SK.Jmp &&
                    s.stmtKind == ir.SK.Label &&
                    prev.jmpMode == ir.JmpMode.Always &&
                    s.lblNumUses == 1) {
                    s.lblNumUses = lblNumUsesJmpNext
                }
                prev = s

                if (s.stmtKind == ir.SK.Breakpoint) {
                    allBrkp[s.breakpointInfo.id] = s.breakpointInfo
                } else if (canInline) {
                    if (s.stmtKind == ir.SK.Jmp) {
                        if (s.expr) {
                            if (inlineBody) canInline = false
                            else inlineBody = s.expr
                        }
                    } else if (s.stmtKind == ir.SK.StackEmpty) {
                        // OK
                    } else if (s.stmtKind == ir.SK.Label) {
                        if (s.lblNumUses != lblNumUsesJmpNext)
                            canInline = false
                    } else {
                        canInline = false
                    }
                }
            }

            if (canInline && inlineBody) {
                const bodyCost = inlineWeight(inlineBody)
                const callCost = 4 * this.args.length + 4 + 2
                const inlineBonus = target.isNative ? 4 : 30
                if (bodyCost <= callCost + inlineBonus) {
                    this.inlineBody = inlineBody
                    //pxt.log("INLINE: " + inlineWeight(inlineBody) + "/" + callCost + " - " + this.toString())
                }
            }

            if (pxt.options.debug)
                pxt.debug(this.toString())

            let debugSucc = false
            if (debugSucc) {
                let s = "BRKP: " + this.getName() + ":\n"
                for (let i = 0; i < allBrkp.length; ++i) {
                    let b = allBrkp[i]
                    if (!b) continue

                    s += `${b.line + 1}: `
                    let n = allBrkp[i + 1]
                    s += "\n"
                }
                console.log(s)
            }
        }
    }

    export function iterExpr(e: Expr, f: (v: Expr) => void) {
        f(e)
        if (e.args)
            for (let a of e.args)
                iterExpr(a, f)
    }

    export function stmt(kind: SK, expr: Expr): Stmt {
        return new Stmt(kind, expr)
    }

    export function op(kind: EK, args: Expr[], data?: any): Expr {
        return new Expr(kind, args, data)
    }

    export function numlit(v: number | boolean): Expr {
        return op(EK.NumberLiteral, null, v)
    }

    export function shared(expr: Expr) {
        switch (expr.exprKind) {
            case EK.SharedRef:
                expr = expr.args[0]
                break
            //case EK.PointerLiteral:
            case EK.NumberLiteral:
                return expr
        }

        let r = op(EK.SharedRef, [expr])
        return r
    }

    export function ptrlit(lbl: string, jsInfo: string): Expr {
        let r = op(EK.PointerLiteral, null, lbl)
        r.jsInfo = jsInfo
        return r
    }

    export function rtcall(name: string, args: Expr[], mask = 0) {
        let r = op(EK.RuntimeCall, args, name)
        if (mask)
            r.mask = { refMask: mask }
        return r
    }

    export function rtcallMask(name: string, mask: number, callingConv: CallingConvention, args: Expr[]) {
        if (U.startsWith(name, "@nomask@")) {
            name = name.slice(8)
            mask = 0
        }

        let r = rtcall(name, args, mask)
        r.callingConvention = callingConv

        return r
    }

    export function flattenArgs(args: ir.Expr[], reorder = false) {
        let didStateUpdate = reorder ? args.some(a => a.canUpdateCells()) : false
        let complexArgs: ir.Expr[] = []
        for (let a of U.reversed(args)) {
            if (a.isStateless()) continue
            if (a.exprKind == EK.CellRef && !didStateUpdate) continue
            if (a.canUpdateCells()) didStateUpdate = true
            complexArgs.push(a)
        }
        complexArgs.reverse()

        if (isStackMachine())
            complexArgs = []

        let precomp: ir.Expr[] = []
        let flattened = args.map(a => {
            let idx = complexArgs.indexOf(a)
            if (idx >= 0) {
                let sharedRef = a
                let sharedDef = a
                if (a.exprKind == EK.SharedDef) {
                    a.args[0].totalUses++
                    sharedRef = ir.op(EK.SharedRef, [a.args[0]])
                } else {
                    sharedRef = ir.op(EK.SharedRef, [a])
                    sharedDef = ir.op(EK.SharedDef, [a])
                    a.totalUses = 2
                    a.currUses = 0
                }
                precomp.push(sharedDef)
                return sharedRef
            } else return a
        })

        return { precomp, flattened }
    }
}
