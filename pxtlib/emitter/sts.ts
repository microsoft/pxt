/// <reference path="../../localtypings/pxtarget.d.ts"/>
/// <reference path="../../localtypings/pxtpackage.d.ts"/>

/*
// generate IR (ir.ts) from a pass over the TypeScript AST
namespace ts.pxtc.sts {

    let checker: TypeChecker;

    // Static TypeScript subset
    // this file defines the subset

    const expressionsIn = [ 
            SK.NullKeyword,
            SK.TrueKeyword,
            SK.FalseKeyword,
            SK.TemplateHead,
            SK.TemplateMiddle,
            SK.TemplateTail,
            SK.NumericLiteral,
            SK.StringLiteral,
            SK.NoSubstitutionTemplateLiteral,
            SK.PropertyAccessExpression,
            SK.BinaryExpression,
            SK.PrefixUnaryExpression,
            SK.PostfixUnaryExpression,
            SK.ElementAccessExpression,
            SK.ParenthesizedExpression,
            SK.ArrayLiteralExpression,
            SK.NewExpression,
            SK.SuperKeyword,
            SK.ThisKeyword,
            SK.CallExpression,
            SK.FunctionExpression,
            SK.ArrowFunction,
            SK.Identifier,
            SK.ConditionalExpression,
            SK.TemplateExpression,
            SK.Expression,
    ]

    function goodExpr(n : Node) {
        return expressionsIn.indexOf(n.kind) != -1
    }

    const stmtDeclIn = [
        SK.SourceFile,
        SK.InterfaceDeclaration,
        SK.VariableStatement,
        SK.ModuleDeclaration,
        SK.EnumDeclaration,
        SK.FunctionDeclaration,
        SK.Constructor,
        SK.MethodDeclaration,
        SK.ExpressionStatement,
        SK.Block,
        SK.ModuleBlock,
        SK.VariableDeclaration,
        SK.IfStatement,
        SK.WhileStatement,
        SK.DoStatement,
        SK.ForStatement,
        SK.ForOfStatement,
        SK.ContinueStatement,
        SK.BreakStatement,
        SK.LabeledStatement,
        SK.ReturnStatement,
        SK.ClassDeclaration,
        SK.PropertyDeclaration,
        SK.PropertyAssignment,
        SK.SwitchStatement,
        SK.TypeAliasDeclaration,
        SK.DebuggerStatement,
        SK.GetAccessor,
        SK.SetAccessor,
        SK.ImportEqualsDeclaration,
        SK.EmptyStatement,
    ]

   function isArrayType(t: Type) {
        return (t.flags & TypeFlags.Reference) && t.symbol.name == "Array"
    }

    function isInterfaceType(t: Type) {
        return t.flags & TypeFlags.Interface;
    }

    function genericRoot(t: Type) {
        if (t.flags & TypeFlags.Reference) {
            let r = t as TypeReference
            if (r.typeArguments && r.typeArguments.length)
                return r.target
        }
        return null
    }

    function isClassType(t: Type) {
        // check if we like the class?
        return !!(t.flags & TypeFlags.Class) || !!(t.flags & TypeFlags.ThisType)
    }

    function isPossiblyGenericClassType(t: Type) {
        let g = genericRoot(t)
        if (g) return isClassType(g)
        return isClassType(t)
    }

    function arrayElementType(t: Type): Type {
        if (isArrayType(t))
            return checkType((<TypeReference>t).typeArguments[0])
        return null;
    }

    function deconstructFunctionType(t: Type) {
        let sigs = checker.getSignaturesOfType(t, SignatureKind.Call)
        if (sigs && sigs.length == 1)
            return sigs[0]
        return null
    }

    function lookupTypeParameter(t: Type) {
        if (!(t.flags & TypeFlags.TypeParameter)) return null
        for (let i = typeBindings.length - 1; i >= 0; --i)
            if (typeBindings[i].tp == t) return typeBindings[i]
        return null
    }


    function checkType(t: Type) {
        let ok = TypeFlags.String | TypeFlags.Number | TypeFlags.Boolean |
            TypeFlags.Void | TypeFlags.Enum | TypeFlags.Null | TypeFlags.Undefined
        if ((t.flags & ok) == 0) {
            if (isArrayType(t)) return t;
            if (isClassType(t)) return t;
            if (isInterfaceType(t)) return t;
            if (deconstructFunctionType(t)) return t;
            if (lookupTypeParameter(t)) return t;

            let g = genericRoot(t)
            if (g) {
                checkType(g);
                (t as TypeReference).typeArguments.forEach(checkType)
                return t
            }
            return null
        }
        return t
    }

    function checkProgram(program: Program) {
        checker = program.getTypeChecker();
    }
}
*/