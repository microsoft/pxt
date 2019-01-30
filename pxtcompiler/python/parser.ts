namespace pxt.py {
    let inParens = false
    let tokens: Token[]
    let source = ""
    let nextToken = 0

    const eof: Token = fakeToken(TokenType.EOF, "EOF")

    type Parse = () => AST

    function fakeToken(tp: TokenType, val: string): Token {
        return {
            type: tp,
            value: val,
            startPos: 0,
            endPos: 0
        }
    }

    function peekToken() {
        return tokens[nextToken] || eof
    }

    function shiftToken() {
            let t = tokens[++nextToken]
            if (!t)
                return
            if (inParens) {

            }
    }

    function error(msg: string) {
        U.userError(U.lf("Python parse error: {0}", msg))
    }

    function expect(tp: TokenType, val: string) {
        let t = peekToken()
        if (t.type != tp || t.value != val) {
            error(U.lf("expecting {0}", tokenToString(fakeToken(tp, val))))
        } else {
            shiftToken()
        }
    }

    function expectNewline() {
        expect(TokenType.NewLine, "")
    }

    function expectKw(kw: string) {
        expect(TokenType.Keyword, kw)
    }

    function expectOp(op: string) {
        expect(TokenType.Op, op)
    }

    function currentKw() {
        let t = peekToken()
        if (t.type == TokenType.Keyword)
            return t.value
        return ""
    }

    function currentOp() {
        let t = peekToken()
        if (t.type == TokenType.Op)
            return t.value
        return ""
    }

    const compound_stmt_map: Map<() => Stmt> = {
        "if": if_stmt,
        "while": while_stmt,
        "for": for_stmt,
        "try": try_stmt,
        "with": with_stmt,
        "def": funcdef,
        "class": classdef,
    }

    const small_stmt_map: Map<() => Stmt> = {
        "del": del_stmt,
        "pass": pass_stmt,
        "break": break_stmt,
        "continue": continue_stmt,
        "return": return_stmt,
        "raise": raise_stmt,
        "global": global_stmt,
        "nonlocal": nonlocal_stmt,
        "import": import_stmt,
        "assert": assert_stmt,
    }

    function notSupported() {
        U.userError(U.lf("not supported yet"))
    }

    function test(): Expr {
        throw notSupported()
    }

    function colon_suite(): Stmt[] {
        expectOp("Colon")
        return suite()
    }

    function suite(): Stmt[] {
        throw notSupported()
    }

    function mkAST(kind: string): AST {
        let t = peekToken()
        return {
            startPos: t.startPos,
            endPos: t.endPos,
            lineno: null,
            col_offset: null,
            kind
        }
    }

    function finish<T extends AST>(v: T): T {
        v.endPos = peekToken().endPos
        return v
    }

    function orelse() {
        if (currentKw() == "else") {
            shiftToken()
            return colon_suite()
        }
        return []
    }

    function while_stmt() {
        let r = mkAST("While") as While
        expectKw("while")
        r.test = test()
        r.body = colon_suite()
        r.orelse = orelse()
        return finish(r)
    }

    function if_stmt(): Stmt { throw notSupported() }
    function for_stmt(): Stmt { throw notSupported() }
    function try_stmt(): Stmt { throw notSupported() }
    function with_stmt(): Stmt { throw notSupported() }
    function funcdef(): Stmt { throw notSupported() }
    function classdef(): Stmt { throw notSupported() }

    function del_stmt(): Stmt { throw notSupported() }
    function pass_stmt(): Stmt { throw notSupported() }
    function break_stmt(): Stmt { throw notSupported() }
    function continue_stmt(): Stmt { throw notSupported() }
    function return_stmt(): Stmt { throw notSupported() }
    function raise_stmt(): Stmt { throw notSupported() }
    function global_stmt(): Stmt { throw notSupported() }
    function nonlocal_stmt(): Stmt { throw notSupported() }
    function import_stmt(): Stmt { throw notSupported() }
    function assert_stmt(): Stmt { throw notSupported() }

    function expr_stmt(): Stmt { throw notSupported() }

    function small_stmt() {
        let fn = U.lookup(small_stmt_map, currentKw())
        if (fn) return fn()
        else return expr_stmt()
    }
    function simple_stmt() {
        let res = [small_stmt()]
        while (currentOp() == "Semicolon") {
            shiftToken()
            if (peekToken().type == TokenType.NewLine)
                break
            res.push(small_stmt())
        }
        expectNewline()
        return res
    }

    function stmt(): Stmt[] {
        let fn = U.lookup(compound_stmt_map, currentKw())
        if (fn) return [fn()]
        else return simple_stmt()
    }

    export function parse(_source: string, _tokens: Token[]) {
        source = _source
        tokens = _tokens
        inParens = false
        nextToken = 0

        let res = stmt()
        while (peekToken().type != TokenType.EOF)
            U.pushRange(res, stmt())

        return res
    }
}

/*
# Grammar for Python

# NOTE WELL: You should also follow all the steps listed at
# https://devguide.python.org/grammar/

# Start symbols for the grammar:
#       single_input is a single interactive statement;
#       file_input is a module or sequence of commands read from an input file;
#       eval_input is the input for the eval() functions.
# NB: compound_stmt in single_input is followed by extra NEWLINE!
single_input: NEWLINE | simple_stmt | compound_stmt NEWLINE
file_input: (NEWLINE | stmt)* ENDMARKER
eval_input: testlist NEWLINE* ENDMARKER

decorator: '@' dotted_name [ '(' [arglist] ')' ] NEWLINE
decorators: decorator+
decorated: decorators (classdef | funcdef | async_funcdef)

async_funcdef: 'async' funcdef
funcdef: 'def' NAME parameters ['->' test] ':' suite

parameters: '(' [typedargslist] ')'
typedargslist: (tfpdef ['=' test] (',' tfpdef ['=' test])* [',' [
        '*' [tfpdef] (',' tfpdef ['=' test])* [',' ['**' tfpdef [',']]]
      | '**' tfpdef [',']]]
  | '*' [tfpdef] (',' tfpdef ['=' test])* [',' ['**' tfpdef [',']]]
  | '**' tfpdef [','])
tfpdef: NAME [':' test]
varargslist: (vfpdef ['=' test] (',' vfpdef ['=' test])* [',' [
        '*' [vfpdef] (',' vfpdef ['=' test])* [',' ['**' vfpdef [',']]]
      | '**' vfpdef [',']]]
  | '*' [vfpdef] (',' vfpdef ['=' test])* [',' ['**' vfpdef [',']]]
  | '**' vfpdef [',']
)
vfpdef: NAME

stmt: simple_stmt | compound_stmt
simple_stmt: small_stmt (';' small_stmt)* [';'] NEWLINE
small_stmt: (expr_stmt | del_stmt | pass_stmt | flow_stmt |
             import_stmt | global_stmt | nonlocal_stmt | assert_stmt)
expr_stmt: testlist_star_expr (annassign | augassign (yield_expr|testlist) |
                     ('=' (yield_expr|testlist_star_expr))*)
annassign: ':' test ['=' test]
testlist_star_expr: (test|star_expr) (',' (test|star_expr))* [',']
augassign: ('+=' | '-=' | '*=' | '@=' | '/=' | '%=' | '&=' | '|=' | '^=' |
            '<<=' | '>>=' | '**=' | '//=')
# For normal and annotated assignments, additional restrictions enforced by the interpreter
del_stmt: 'del' exprlist
pass_stmt: 'pass'
flow_stmt: break_stmt | continue_stmt | return_stmt | raise_stmt | yield_stmt
break_stmt: 'break'
continue_stmt: 'continue'
return_stmt: 'return' [testlist]
yield_stmt: yield_expr
raise_stmt: 'raise' [test ['from' test]]
import_stmt: import_name | import_from
import_name: 'import' dotted_as_names
# note below: the ('.' | '...') is necessary because '...' is tokenized as ELLIPSIS
import_from: ('from' (('.' | '...')* dotted_name | ('.' | '...')+)
              'import' ('*' | '(' import_as_names ')' | import_as_names))
import_as_name: NAME ['as' NAME]
dotted_as_name: dotted_name ['as' NAME]
import_as_names: import_as_name (',' import_as_name)* [',']
dotted_as_names: dotted_as_name (',' dotted_as_name)*
dotted_name: NAME ('.' NAME)*
global_stmt: 'global' NAME (',' NAME)*
nonlocal_stmt: 'nonlocal' NAME (',' NAME)*
assert_stmt: 'assert' test [',' test]

compound_stmt: if_stmt | while_stmt | for_stmt | try_stmt | with_stmt | funcdef | classdef | decorated | async_stmt
async_stmt: 'async' (funcdef | with_stmt | for_stmt)
if_stmt: 'if' test ':' suite ('elif' test ':' suite)* ['else' ':' suite]
while_stmt: 'while' test ':' suite ['else' ':' suite]
for_stmt: 'for' exprlist 'in' testlist ':' suite ['else' ':' suite]
try_stmt: ('try' ':' suite
           ((except_clause ':' suite)+
            ['else' ':' suite]
            ['finally' ':' suite] |
           'finally' ':' suite))
with_stmt: 'with' with_item (',' with_item)*  ':' suite
with_item: test ['as' expr]
# NB compile.c makes sure that the default except clause is last
except_clause: 'except' [test ['as' NAME]]
suite: simple_stmt | NEWLINE INDENT stmt+ DEDENT

test: or_test ['if' or_test 'else' test] | lambdef
test_nocond: or_test | lambdef_nocond
lambdef: 'lambda' [varargslist] ':' test
lambdef_nocond: 'lambda' [varargslist] ':' test_nocond
or_test: and_test ('or' and_test)*
and_test: not_test ('and' not_test)*
not_test: 'not' not_test | comparison
comparison: expr (comp_op expr)*
# <> isn't actually a valid comparison operator in Python. It's here for the
# sake of a __future__ import described in PEP 401 (which really works :-)
comp_op: '<'|'>'|'=='|'>='|'<='|'<>'|'!='|'in'|'not' 'in'|'is'|'is' 'not'
star_expr: '*' expr
expr: xor_expr ('|' xor_expr)*
xor_expr: and_expr ('^' and_expr)*
and_expr: shift_expr ('&' shift_expr)*
shift_expr: arith_expr (('<<'|'>>') arith_expr)*
arith_expr: term (('+'|'-') term)*
term: factor (('*'|'@'|'/'|'%'|'//') factor)*
factor: ('+'|'-'|'~') factor | power
power: atom_expr ['**' factor]
atom_expr: ['await'] atom trailer*
atom: ('(' [yield_expr|testlist_comp] ')' |
       '[' [testlist_comp] ']' |
       '{' [dictorsetmaker] '}' |
       NAME | NUMBER | STRING+ | '...' | 'None' | 'True' | 'False')
testlist_comp: (test|star_expr) ( comp_for | (',' (test|star_expr))* [','] )
trailer: '(' [arglist] ')' | '[' subscriptlist ']' | '.' NAME
subscriptlist: subscript (',' subscript)* [',']
subscript: test | [test] ':' [test] [sliceop]
sliceop: ':' [test]
exprlist: (expr|star_expr) (',' (expr|star_expr))* [',']
testlist: test (',' test)* [',']
dictorsetmaker: ( ((test ':' test | '**' expr)
                   (comp_for | (',' (test ':' test | '**' expr))* [','])) |
                  ((test | star_expr)
                   (comp_for | (',' (test | star_expr))* [','])) )

classdef: 'class' NAME ['(' [arglist] ')'] ':' suite

arglist: argument (',' argument)*  [',']

# The reason that keywords are test nodes instead of NAME is that using NAME
# results in an ambiguity. ast.c makes sure it's a NAME.
# "test '=' test" is really "keyword '=' test", but we have no such token.
# These need to be in a single rule to avoid grammar that is ambiguous
# to our LL(1) parser. Even though 'test' includes '*expr' in star_expr,
# we explicitly match '*' here, too, to give it proper precedence.
# Illegal combinations and orderings are blocked in ast.c:
# multiple (test comp_for) arguments are blocked; keyword unpackings
# that precede iterable unpackings are blocked; etc.
argument: ( test [comp_for] |
            test '=' test |
            '**' test |
            '*' test )

comp_iter: comp_for | comp_if
sync_comp_for: 'for' exprlist 'in' or_test [comp_iter]
comp_for: ['async'] sync_comp_for
comp_if: 'if' test_nocond [comp_iter]

# not used in grammar, but may appear in "node" passed from Parser to Compiler
encoding_decl: NAME

yield_expr: 'yield' [yield_arg]
yield_arg: 'from' test | testlist
*/
