// The current version of this file can be retrieved by:
// GET /api/language/webast

declare module TDev.AST.Json
{
    // This module describes an AST for TouchDevelop scripts. The documentation
    // is severely lacking, so the best way to figure things out is to write a
    // TouchDevelop script, and type (in the console):
    //
    //   "TDev.AST.Json.dump(TDev.Script)"
    //
    // which will dump the currently-edited script in this representation. The
    // converse operation is:
    //
    //   "TDev.AST.Json.serialize(yourJsonAst)"
    //
    // Beware: the composition of these two operations is *not* the
    // identity. In particular, [dump] will resolve implicit optional arguments,
    // while [serialize] expects them to be left out.

    // These two interfaces are never used. Actually, whenever a field has type
    // [JNodeRef], this is a lie, and its type is [string].
    export interface JNodeRef { dummyNodeRef: number; }
    export interface JTypeRef { dummyTypeRef: number; }

    // the JTypeRef may be either a simple string, or if it starts with '{',
    // it is JSON-encoded and conforms to one of these interfaces or is just a string (API type)
    export interface JGenericTypeInstance extends JTypeRef {
        g: string;
        a?: JTypeRef[];
    }
    export interface JUserType extends JTypeRef {
        o: string;
    }
    export interface JLibraryType extends JUserType {
        l: JNodeRef;
    }


    /*abstract*/ export interface JNode
    {
        nodeType:string; // name of interface without leading J and with lower-case first letter
        id:string; // do not depend on the particular format of these strings
    }

    /*abstract*/ export interface JDecl extends JNode
    {
        name: string;
        unused?: boolean;
    }

    /*abstract*/ export interface JToken extends JNode { }
    /*abstract*/ export interface JExpr extends JToken { }

    // This corresponds to the [operator] syntactic class defined in the
    // OOPSLA'15 submission. When adopting the "hybrid AST" point of view,
    // an expression is decomposed as a series of tokens. The [JOperator]
    // interface covers operators (assignment, comparison, boolean and
    // arithmetic operators), but also *digits*.
    //
    // For instance, "1 + 10 = 11" will generate:
    //   [JOperator 1; JOperator +; JOperator 0; JOperator =; JOperator 1; JOperator 1]
    export interface JOperator extends JToken { op:string; }

    // A reference to a "property", i.e. something defined for an object of that
    // type. There is no good way of figuring out what should the [parent] be
    // when generating such properties; probably the best way is to dump a
    // TouchDevelop AST.
    export interface JPropertyRef extends JToken
    {
        name:string;
        parent: JTypeRef; // if used as token this is ignored when building
                          // if used as JCall it's needed for operators
        declId?: JNodeRef; // filled when the property is user-defined
    }

    export interface JStringLiteral extends JExpr {
        value:string;
        enumValue?:string;
    }
    export interface JBooleanLiteral extends JExpr { value:boolean; }

    // A number literal is only used when adopting the "tree" view for
    // expressions (see comment on [JExprHolder]).
    export interface JNumberLiteral extends JExpr {
        value:number;
        // If parsing 'stringForm' yields 'value', 'stringForm' is used
        // Otherwise stringified form of 'value' is used
        stringForm?:string;
    }

    // when building expressions of these three types you can provide localId/type or name;
    // if you provide both, name is ignored
    export interface JLocalRef extends JExpr
    {
        name:string;
        localId:JNodeRef;
    }

    export interface JPlaceholder extends JExpr
    {
        name:string;
        type:JTypeRef;
    }

    // A singleton (probably) references one of the top-level categories such as
    // libraries or data. When trying to call "♻ l →  foo(x1, x2)", one may
    // understand that the following call takes place:
    //   ♻ -> l -> foo(x1, x2)
    // and the following AST is generated:
    //   JCall { name: foo, parent: l, args: [
    //     JCall { name: l, parent: ♻, args: [ JSingletonRef ♻ ] },
    //     x1,
    //     x2
    //  ]}
    // this is surprising, because when calling "1 + 2", we generate a call that
    // has two arguments only.
    export interface JSingletonRef extends JExpr
    {
        name:string;
        // type is ignored when building
        type:JTypeRef;
        libraryName?:string; // if this is a reference to a namespace in a library, this gives the name of library
    }

    // It seems like TouchDevelop has an extra invariant that a [JCall] must
    // *always* be wrapped in a [JExprHolder].
    export interface JCall extends JPropertyRef, JExpr
    {
        args:JExpr[];
        // If we are calling a *type* T on an expression (e.g. create ->
        // Collection of -> T), then T will be in there.
        typeArgs?: JTypeRef[];
        // The field below, if present, determines without ambiguity the nature
        // of the call.
        // - extension (the new special syntax)
        // - field (reading a record field)
        // Other types of calls can be determined by careful inspection of the
        // receiver. See the C++ code emitter.
        callType?: string;
    }

    // Expressions can be represented in two different manners.
    // - The first one is as a series of tokens. This would correspond to the
    //   "hybrid AST" described in the OOPSLA'15 submission. In that
    //   representation, the [tree] field is null and the [tokens] field
    //   contains the list of tokens.
    // - The second one is as an actual AST, with a proper tree structure. In
    //   that case, the [tokens] field is null and [tree] must contain a proper
    //   tree.
    //
    // TouchDevelop conflates variable binding and expressions. This means that
    // every expression is flagged with the variables that are introduced at
    // this stage. For instance, "var x = 1" will be translated as a
    // [JExprHolder] where [locals] contains a [JLocalDef x], and either:
    // - [tokens] is [JLocalRef x; JOperator :=; JOperator 1], or
    // - [tree] is [JCall { name: ":=", parent: "Unknown", args: [JLocalRef x, JNumberLiteral 1] }]
    //
    // This is not the traditional notion of binding! The variable's scope is
    // not limited to the tokens, but rather extends until the end of the parent
    // block.
    export interface JExprHolder extends JNode
    {
        // if tokens is unset, will try to use tree
        tokens:JToken[];
        tree:JExpr;
        locals:JLocalDef[]; // locals variables defined in this expression
    }

    /*abstract*/ export interface JStmt extends JNode
    {
        // this is available when using the short form
        locals?: JLocalDef[];
    }

    export interface JComment extends JStmt { text: string; }
    export interface JFor extends JStmt
    {
        index:JLocalDef;
        bound:JExprHolder;
        body:JStmt[];
    }
    export interface JForeach extends JStmt
    {
        iterator:JLocalDef;
        collection:JExprHolder;
        conditions:JCondition[];
        body:JStmt[];
    }
    /*abstract*/ export interface JCondition extends JNode {
        // this is available when using the short form
        locals?: JLocalDef[];
    }
    export interface JWhere extends JCondition { condition: JExprHolder; }
    export interface JWhile extends JStmt
    {
        condition:JExprHolder;
        body:JStmt[];
    }

    export interface JContinue extends JStmt {}
    export interface JBreak extends JStmt {}
    export interface JReturn extends JExprStmt {}
    export interface JShow extends JExprStmt {}

    // Sequences of if / else if / else statements are not represented the usual
    // way. That is, instead of having a structured AST:
    //
    // if
    // |- condition1
    // |- then-branch1 = ...
    // |- else-branch = if
    //                  |- condition2
    //                  |- then-branch2
    //                  |- else-branch2
    //
    // the TouchDevelop AST adopts the following (unusual) representation.
    //
    // if
    // |- condition1
    // |- then-branch1 = ...
    // |- else-branch = null
    // if
    // |- condition2
    // |- then-branch2
    // |- else-branch2
    // |- isElseIf = true
    //
    // This is NOT equivalent to the representation above (condition2 may
    // subsume condition1), so the extra flag "isElseIf" is set and (I suppose)
    // gets some special treatment when it comes to running / compiling the
    // program.
    export interface JIf extends JStmt
    {
        condition:JExprHolder;
        thenBody:JStmt[];
        elseBody:JStmt[];
        isElseIf:boolean;
    }

    export interface JBoxed extends JStmt { body:JStmt[]; }
    export interface JExprStmt extends JStmt { expr:JExprHolder; }
    export interface JInlineActions extends JExprStmt { actions:JInlineAction[]; }
    export interface JInlineAction extends JNode
    {
        reference:JLocalDef;
        inParameters:JLocalDef[];
        outParameters:JLocalDef[];
        body:JStmt[];
        locals?:JLocalDef[]; // this contains the reference in short mode; it never contains anything else
        isImplicit:boolean;
        isOptional:boolean;
        allLocals: JLocalDef[];
        capturedLocals: JLocalDef[];
    }

    export interface JOptionalParameter extends JNode
    {
        name:string;
        declId:JNodeRef;
        expr:JExprHolder;
    }

    /*abstract*/ export interface JActionBase extends JDecl
    {
        inParameters:JLocalDef[];
        outParameters:JLocalDef[];
        // note that events should be always treated as private, but for historical reasons this field can be true or false
        isPrivate:boolean;
        isOffline: boolean;
        isQuery: boolean;
        isTest: boolean;
        isAsync:boolean;
        description: string;
    }

    export interface JActionType extends JActionBase
    {
    }

    export interface JAction extends JActionBase { body: JStmt[]; }
    export interface JPage extends JActionBase
    {
        initBody:JStmt[];
        displayBody:JStmt[];
        initBodyId?:string;
        displayBodyId?:string;
        hasModelParameter?:boolean;
    }
    export interface JEvent extends JActionBase
    {
        // when building provide name or both eventName and eventVariableId (which take precedence over name)
        eventName:string;
        eventVariableId:JNodeRef;
        body:JStmt[];
    }

    export interface JLibAction extends JActionBase
    {
        parentLibId:JNodeRef; // this can be empty - it means "current script"
    }

    export interface JLibAbstractType extends JDecl
    {
    }

    export interface JLibActionType extends JActionBase
    {
    }


    /*abstract*/ export interface JGlobalDef extends JDecl
    {
        comment:string;
        type:JTypeRef;
        isReadonly:boolean;
        isTransient:boolean;
        isCloudEnabled:boolean;
    }

    export interface JArt extends JGlobalDef {
        url: string;
        // If it's a string art, contains its value.
        value: string;
    }
    export interface JData extends JGlobalDef { }

    export interface JLibrary extends JDecl
    {
        libIdentifier: string;
        libIsPublished: boolean;
        scriptName: string; // name of the script to which the library resolves
        exportedTypes: string; // space separated; obsolete, use exportedTypeDefs
        exportedTypeDefs: JDecl[]; // JLibAbstractType or JLibActionType
        exportedActions: JLibAction[];
        resolveClauses: JResolveClause[];
    }

    /*abstract*/ export interface JBinding extends JNode
    {
        name:string; // name of the formal argument
        isExplicit:boolean; // was it explicitly specified by the user
        // implicit bindings are ignored when building expressions
    }

    export interface JTypeBinding extends JBinding { type:JTypeRef; }
    export interface JActionBinding extends JBinding { actionId:JNodeRef; }

    export interface JResolveClause extends JNode
    {
        name:string;
        // points to a JLibrary (not publish-id);
        // it may be null for binding to the current script
        defaultLibId:JNodeRef;
        withTypes: JTypeBinding[];
        withActions: JActionBinding[];
    }
    export interface JRecord extends JDecl
    {
        comment: string;
        category: string; // "object", "table", "index", or "decorator"
        isCloudEnabled: boolean;
        isCloudPartiallyEnabled: boolean;
        isPersistent: boolean;
        isExported: boolean;
        keys: JRecordKey[];
        fields: JRecordField[];
    }

    export interface JRecordField extends JNode
    {
        name:string;
        type:JTypeRef;
    }
    export interface JRecordKey extends JRecordField {}

    // local variable or a parameter
    export interface JLocalDef extends JNode
    {
        name:string;
        type:JTypeRef;
        isByRef: boolean;
    }

    // Response to:
    // GET /api/<script-id>/webast
    export interface JApp extends JNode
    {
        // both versions are comma-separated list of tokens/features
        textVersion: string;
        jsonVersion: string;

        name: string;
        comment: string;
        // The name and icon are only given here if they are explicitly specified by the user.
        icon?: string; // name of the icon, e.g., "Bolt"
        color?: string; // e.g., #ff00ff
        // These two are always present. They are ignored when building new scripts.
        autoIcon:string;
        autoColor:string;

        platform: string; // comma-separated
        isLibrary: boolean;
        useCppCompiler?: boolean;
        showAd: boolean;
        hasIds: boolean; // does it have stable, persistent ids for every stmt
        rootId: string;
        decls: JDecl[];
        deletedDecls: JDecl[]; // these are present when a node was deleted but is still referenced from somewhere

        libraryName?: string; // when used in reflection info
        libraryId?: string; // when used in reflection info
    }


    //
    // API description
    //

    export interface JPropertyParameter
    {
        name: string;
        type: JTypeRef;
        writesMutable?: boolean; // are fields of the object referenced by this paramter being written to
        readsMutable?: boolean;  // .... read from
        defaultValue?: JToken[];
        stringValues?: string[]; // these show up in intelli buttons; they are usually all allowed values for a parameter
    }

    export interface JProperty
    {
        name: string;
        help: string;
        usage_count: number;       // this is used for syntax autocompletion priority
        runOnInvalid?: boolean;       // should the property by run even if one of the arguments is 'invalid'
        isHidden?: boolean;           // doesn't show in autocompletion
        isAsync?: boolean;
        isObsolete?: boolean;         // generates a warning
        isDbgOnly?: boolean;          // an experimental feature; not visible in regular builds
        isBetaOnly?: boolean;         // a feature in testing; visible in /app/beta
        jsName: string;            // how is the property refered to from JavaScript
        infixPriority?: number;    // when present, this is an infix operator with given priority
                                   // higher number is higher priority; even assosiates left, odd - right
        pausesInterpreter?: boolean;  // is this a potentially-async operation
        usesStackFrame?: boolean;     // is the implementation passed IStackFrame object
        missingWeb?: boolean;         // is the implementation missing from the general web version
        capabilities?: string;     // comma-separated list of required platform capabilities (if any)
        result: JPropertyParameter;
        parameters: JPropertyParameter[];
    }

    export interface JTypeDef
    {
        name: string;
        help: string;
        icon: string;               // a name of the icon representing this type
        isAction?: boolean;            // is it a function type; look for 'run' property for the signature
        isData: boolean;               // false for singleton types
        stemName: string;           // used when auto-naming variables of this type
        jsName: string;            // how is the type refered to from JavaScript
        isDbgOnly?: boolean;           // an experimental feature; not visible in regular builds
        isBetaOnly?: boolean;          // a feature in testing; visible in /app/beta
        isSerializable: boolean;       // do we support automatic serialization of this type
        isBuiltin?: boolean;           // true for number, boolean, string; the JS calling convention is different for these
        ctxLocal?: boolean;            // can it be used as local variable
        ctxGlobal?: boolean;           // .... as global variable
        ctxField?: boolean;            // .... as field of a record
        ctxLocalKey?: boolean;         // .... as key in a local index
        ctxGcKey?: boolean;            // can it have decorators
        ctxCloudKey?: boolean;
        ctxRowKey?: boolean;
        ctxCloudField?: boolean;
        ctxWallTap?: boolean;          // do global variables of this type get 'wall tap' events
        ctxEnumerable?: boolean;       // can it be used with foreach construct
        ctxJson?: boolean;             // can it be json exported/imported
        properties: JProperty[];
    }

    // GET /api/language/apis
    export interface JApis
    {
        textVersion:string;
        jsonVersion: string;
        types:JTypeDef[];
    }

/*

The short format
~~~~~~~~~~~~~~~~

The main difference between the full JSON format and the short JSON format is
representation of `JExprHolder` nodes. Whenever the full JSON format says node
`JBar` has a field `foo` of type `JExprHolder`, then in the short format `JBar`
has a field `foo` of type `string` and a field `locals` of type `JLocalDef[]`.
Additionally, the fields `index` in `JFor` and `iterator` in `JForeach` are
absent, and the loop-bound variable is instead stored as the first element of
`locals`.

The string placed instead of the `JExprHolder` node can be turned into sequence
of tokens using the following function:

    export function shortToTokens(shortForm:string)
    {
        function uq(s:string) {
            var r = ""
            for (var i = 0; i < s.length; ++i) {
                var c = s.charAt(i);
                if (c == "_") {
                    r += " ";
                } else if (c == "/") {
                    r += String.fromCharCode(parseInt(s.slice(i + 1, i + 5), 16))
                    i += 4
                } else {
                    r += c;
                }
            }
            return r;
        }

        function oneToken(s:string) {
            var v = s.slice(1)
            switch (s[0]) {
                case ",": return { nodeType: "operator", op: v }
                case "#": return { nodeType: "propertyRef", declId: v }
                case ".": return { nodeType: "propertyRef", name: uq(v) }
                case "'": return { nodeType: "stringLiteral", value: uq(v) }
                case "F":
                case "T": return { nodeType: "booleanLiteral", value: (s[0] == "T") }
                case "$": return { nodeType: "localRef", localId: v }
                case ":": return { nodeType: "singletonRef", name: uq(v) }
                case "?":
                    var cln = v.indexOf(':')
                    if (cln > 0)
                        return { nodeType: "placeholder", type: uq(v.slice(0, cln)), name: uq(v.slice(cln + 1)) }
                    else
                        return { nodeType: "placeholder", type: uq(v) }
                default:
                    throw new Error("wrong short form: " + s)
            }
        }

        if (!shortForm) return []; // handles "" and null; the code below is incorrect for ""

        return shortForm.split(" ").map(oneToken)
    }

In other words, it's space separated sequence of strings, where the first
character denotes the kind of token and remaining characters are the payload.
The string is quoted by replacing spaces with underscores and all other
non-alphanumeric characters with unicode sequences preceeded by a slash (not
backslash to avoid double quoting in JSON).



Short diff format
~~~~~~~~~~~~~~~~~

Every object node in the short JSON format has a field named `id`. This is used
when formulating diffs. The diff is set of updates to nodes of given ids. For
every id there is a set of `fieldName`, `value` pairs.

For example consider:

A = {
  "id": "01",
  "one": "one",
  "two": 2,
  "baz": [
    { "id": "02", "enabled": true },
    { "id": "03", "x": 0 }
  ]
}

B = {
  "id": "01",
  "one": "seven",
  "two": 2,
  "baz": [
    { "id": "02", "enabled": true },
    { "id": "05", "y": 7, "z": 13 }
  ]
}

diff(A, B) = {
  // new node, assignment given for all fields
  "05": { "y": 7, "z": 13 },
  // updated node
  "01": {
    "one": "seven", // the field "one" is now "seven"
    // the field "two" is not mentioned and thus unchanged
    // the field "baz" now contains two nodes, ids of which are given
    "baz": [ "02", "05" ]
  },
  // the node "03" is deleted
  "03": null
}

The JSON diff relies on the following properties of the short JSON format:

Fields of JNodes always contain either:
  1. a JSON primitive value (string, boolean, integer, null), or
  2. a sequence of JNodes

Every JNode has a unique 'id' field.

This is why JFor.bound and JForeach.collection fields are missing.  In the diff
format sequence of strings is always treated as a sequence of node ids.

The following function can be used to apply JSON diff:

    function indexIds(obj:any)
    {
        var oldById:any = {}

        function findIds(o:any) {
            if (!o) return;
            if (Array.isArray(o)) {
                for (var i = 0; i < o.length; ++i)
                    findIds(o[i])
            } else if (typeof o === "object") {
                if (!o.id) Util.oops("no id for " + JSON.stringify(o))
                if (oldById.hasOwnProperty(o.id)) Util.oops("duplicate id " + o.id)
                oldById[o.id] = o
                var k = Object.keys(o)
                for (var i = 0; i < k.length; ++i)
                    findIds(o[k[i]])
            }
        }
        findIds(obj)

        return oldById
    }

    export function applyJsonDiff(base:any, diff:any)
    {
        var byId = indexIds(base)

        var k = Object.keys(diff)
        for (var i = 0; i < k.length; ++i) {
            var id = k[i]
            var upd = diff[id]
            if (upd === undefined) continue;
            var trg = byId[id]
            if (upd === null) {
                if (!trg) Util.oops("apply diff: no target id " + id)
                trg.__deleted = true;
                continue;
            }
            if (!trg) {
                byId[id] = trg = { id: id }
            }
            var kk = Object.keys(upd)
            for (var j = 0; j < kk.length; ++j) {
                var f = kk[j]
                var v = upd[f]
                if (Array.isArray(v) && typeof v[0] === "string")
                    v = v.map(id => {
                        var r = byId[id]
                        if (!r) { r = byId[id] = { id: id } }
                        return r
                    })

                Util.assert(f != "nodeType" || !trg[f])
                trg[f] = v
            }
        }

        var newIds = indexIds(base)
        k = Object.keys(newIds)
        for (var i = 0; i < k.length; ++i) {
            var id = k[i]
            if (newIds[k[i]].__deleted)
                Util.oops("dangling id after diff " + id)
        }
    }

*/
}
