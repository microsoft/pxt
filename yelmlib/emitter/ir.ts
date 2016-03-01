namespace ts.yelm.ir {
    let U = ts.yelm.Util;
    let assert = U.assert;

    export enum EK {
        None,
        NumberLiteral,
        StringLiteral,
        PointerLiteral,
        RuntimeCall,
        ProcCall,
        TmpRef,
        FieldAccess,
        Store,
        LocalRef,
        GlobalRef,
        Incr,
        Decr,
    }

    export class Node {
        isExpr(): this is Expr { return false }
        isStmt(): this is Stmt { return false }
    }

    export class Expr extends Node {
        public jsInfo: string;

        constructor(
            public exprKind: EK,
            public args: Expr[],
            public data: any
        ) {
            super();
        }

        isExpr() { return true }
    }

    export enum SK {
        None,
        Expr,
        Label,
        JmpZ,
        JmpNZ,
    }

    export class Stmt extends Node {
        constructor(
            public stmtKind: SK,
            public expr: Expr,
            public data: any
        ) {
            super()
        }

        isStmt() { return true }
    }

    export class Location {
        isarg = false;
        iscap = false;
        _isRef = false;
        _isLocal = false;
        _isGlobal = false;

        constructor(public index: number, public def: Declaration, public info: VariableAddInfo) {
            setLocationProps(this)
        }

        toString() {
            var n = ""
            if (this.def) n += (<any>this.def.name).text || "?"
            if (this.isarg) n = "ARG " + n
            if (this.isRef) n = "REF " + n
            //if (this.isByRefLocal()) n = "BYREF " + n
            return "[" + n + "]"
        }

        refSuff() {
            if (this.isRef()) return "Ref"
            else return ""
        }

        isRef() { return this._isRef }
        isLocal() { return this._isLocal }
        isGlobal() { return this._isGlobal }

        refCore() {
            return op(EK.LocalRef, null, this)
        }

        isByRefLocal() {
            return this.isLocal() && this.info.captured && this.info.written
        }
    }


    export class Procedure extends Node {
        numArgs = 0;
        info: FunctionAddInfo;
        seqNo: number;
        isRoot = false;
        locals: Location[] = [];
        captured: Location[] = [];
        args: Location[] = [];
        parent: Procedure;

        body: Stmt[] = [];
        lblNo = 0;
        action: ts.FunctionLikeDeclaration;

        emit(stmt: Stmt) {
            this.body.push(stmt)
        }
        
        emitExpr(expr: Expr) {
            this.emit(stmt(SK.Expr, expr))
        }
        
        emitTmp(expr: Expr) {
            switch (expr.exprKind) {
                case EK.NumberLiteral:
                case EK.TmpRef:
                    return expr;
            }
            let s = stmt(SK.Expr, expr)
            this.emit(s)
            return op(EK.TmpRef, null, s)
        }

        mkLabel(name: string) {
            return stmt(SK.Label, null, "." + name + "." + this.lblNo++)
        }
        emitLbl(lbl: Stmt) {
            this.emit(lbl)
        }

        getName() {
            let text = this.action && this.action.name ? (<Identifier>this.action.name).text : null
            return text || "inline"
        }

        mkLocal(def: Declaration, info: VariableAddInfo) {
            var l = new Location(this.locals.length, def, info)
            this.locals.push(l)
            return l
        }

        localIndex(l: Declaration, noargs = false): Location {
            return this.captured.filter(n => n.def == l)[0] ||
                this.locals.filter(n => n.def == l)[0] ||
                (noargs ? null : this.args.filter(n => n.def == l)[0])
        }

        emitClrs() {
            if (this.isRoot) return;
            var lst = this.locals.concat(this.args)
            lst.forEach(p => {
                assert(!p.isGlobal() && !p.iscap)
                if (p.isRef() || p.isByRefLocal()) {
                    this.emitExpr(op(EK.Decr, [p.refCore()]))
                }
            })
        }
    }

    export function stmt(kind: SK, expr: Expr, data?: any): Stmt {
        return new Stmt(kind, expr, data)
    }

    export function op(kind: EK, args: Expr[], data?: any): Expr {
        return new Expr(kind, args, data)
    }

    export function numlit(v: number | boolean): Expr {
        return op(EK.NumberLiteral, null, v)
    }

    export function ptrlit(lbl: string, jsInfo: string): Expr {
        let r = op(EK.PointerLiteral, null, lbl)
        r.jsInfo = jsInfo
        return r
    }

    export function rtcall(name: string, args: Expr[]) {
        return op(EK.RuntimeCall, args, name)
    }

    export function rtcallMask(name: string, mask: number, isAsync: boolean, args: Expr[]) {
        //TODO
        return op(EK.RuntimeCall, args, name)
    }
}
