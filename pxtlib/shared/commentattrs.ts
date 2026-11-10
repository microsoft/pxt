/// <reference path="../commonutil.ts"/>

namespace ts.pxtc {
    import U = pxtc.Util;

    /* @internal */
    const enum TokenKind {
        SingleAsterisk = 1,
        DoubleAsterisk = 1 << 1,
        SingleUnderscore = 1 << 2,
        DoubleUnderscore = 1 << 3,
        Escape = 1 << 4,
        Pipe = 1 << 5,
        Parameter = 1 << 6,
        Word = 1 << 7,
        Image = 1 << 8,
        TaggedText = 1 << 9,
        ParamRef = 1 << 10,

        TripleUnderscore = SingleUnderscore | DoubleUnderscore,
        TripleAsterisk = SingleAsterisk | DoubleAsterisk,
        StyleMarks = TripleAsterisk | TripleUnderscore,
        Bold = DoubleUnderscore | DoubleAsterisk,
        Italics = SingleUnderscore | SingleAsterisk,

        Unstylable = Parameter | Pipe | ParamRef,
        Text = Word | Escape
    }

    interface Token {
        kind: TokenKind;
        content?: string;
        type?: string;
        name?: string;
    }

    interface Label {
        content: string;
        styles: number;
        endingToken?: string;
    }

    const numberAttributes: (keyof CommentAttrs)[] = [
        "weight",
        "imageLiteral",
        "gridLiteral",
        "colorGridLiteral",
        "topblockWeight",
        "inlineInputModeLimit",
        "gridLiteralVerticalSpacing",
        "gridLiteralHorizontalSpacing",
        "gridLiteralBorderRadius",
    ];

    const booleanAttributes: (keyof CommentAttrs)[] = [
        "advanced",
        "handlerStatement",
        "forceStatement",
        "afterOnStart",
        "optionalVariableArgs",
        "blockHidden",
        "constantShim",
        "blockCombine",
        "enumIsBitMask",
        "enumIsHash",
        "decompileIndirectFixedInstances",
        "topblock",
        "callInDebugger",
        "duplicateShadowOnDrag",
        "argsNullable",
        "compileHiddenArguments",
        "expandArgumentsInToolbox",
        "gridLiteralUseProjectPalette"
    ];

    export function parseCommentString(cmt: string): CommentAttrs {
        let res: CommentAttrs = {
            paramDefl: {},
            callingConvention: ir.CallingConvention.Plain,
            _source: cmt
        }
        let didSomething = true
        while (didSomething) {
            didSomething = false
            cmt = cmt.replace(/\/\/%[ \t]*([\w\.-]+)(=(("[^"\n]*")|'([^'\n]*)'|([^\s]*)))?/,
                (f: string, n: string, d0: string, d1: string,
                    v0: string, v1: string, v2: string) => {
                    let v = v0 ? JSON.parse(v0) : (d0 ? (v0 || v1 || v2) : "true");
                    if (!v) v = "";
                    if (U.startsWith(n, "block.loc.")) {
                        if (!res.locs) res.locs = {};
                        res.locs[n.slice("block.loc.".length).toLowerCase() + "|block"] = v;
                    } else if (U.startsWith(n, "jsdoc.loc.")) {
                        if (!res.locs) res.locs = {};
                        res.locs[n.slice("jsdoc.loc.".length).toLowerCase() + "|jsdoc"] = v;
                    } else if (U.startsWith(n, "ariaLabel.loc.")) {
                        if (!res.locs) res.locs = {};
                        res.locs[n.slice("ariaLabel.loc.".length).toLowerCase() + "|ariaLabel"] = v;
                    } else if (U.contains(n, ".loc.")) {
                        if (!res.locs) res.locs = {};
                        const p = n.slice(0, n.indexOf('.loc.'));
                        const l = n.slice(n.indexOf('.loc.') + '.loc.'.length);
                        res.locs[l + "|param|" + p] = v;
                    } else if (U.endsWith(n, ".defl")) {
                        if (v.indexOf(" ") > -1) {
                            res.paramDefl[n.slice(0, n.length - 5)] = `"${v}"`
                        } else {
                            res.paramDefl[n.slice(0, n.length - 5)] = v
                        }
                        if (!res.explicitDefaults) res.explicitDefaults = []
                        res.explicitDefaults.push(n.slice(0, n.length - 5))
                    } else if (U.endsWith(n, ".shadow")) {
                        if (!res._shadowOverrides) res._shadowOverrides = {};
                        res._shadowOverrides[n.slice(0, n.length - 7)] = v;
                    } else if (U.endsWith(n, ".snippet")) {
                        if (!res.paramSnippets) res.paramSnippets = {};
                        const paramName = n.slice(0, n.length - 8);
                        if (!res.paramSnippets[paramName]) res.paramSnippets[paramName] = {};
                        res.paramSnippets[paramName].ts = v;
                    } else if (U.endsWith(n, ".pySnippet")) {
                        if (!res.paramSnippets) res.paramSnippets = {};
                        const paramName = n.slice(0, n.length - 10);
                        if (!res.paramSnippets[paramName]) res.paramSnippets[paramName] = {};
                        res.paramSnippets[paramName].python = v;
                    } else if (U.endsWith(n, ".fieldEditor")) {
                        if (!res.paramFieldEditor) res.paramFieldEditor = {}
                        res.paramFieldEditor[n.slice(0, n.length - 12)] = v
                    } else if (U.contains(n, ".fieldOptions.")) {
                        if (!res.paramFieldEditorOptions) res.paramFieldEditorOptions = {}
                        const field = n.slice(0, n.indexOf('.fieldOptions.'));
                        const key = n.slice(n.indexOf('.fieldOptions.') + 14, n.length);
                        if (!res.paramFieldEditorOptions[field]) res.paramFieldEditorOptions[field] = {};
                        res.paramFieldEditorOptions[field][key] = v
                    } else if (U.contains(n, ".shadowOptions.")) {
                        if (!res.paramShadowOptions) res.paramShadowOptions = {}
                        const field = n.slice(0, n.indexOf('.shadowOptions.'));
                        const key = n.slice(n.indexOf('.shadowOptions.') + 15, n.length);
                        if (!res.paramShadowOptions[field]) res.paramShadowOptions[field] = {};
                        res.paramShadowOptions[field][key] = v
                    } else if (U.endsWith(n, ".label")) {
                        if (!res.paramLabels) res.paramLabels = {};
                        res.paramLabels[n.slice(0, n.length - 6)] = v;
                    } else if (U.endsWith(n, ".min")) {
                        if (!res.paramMin) res.paramMin = {}
                        res.paramMin[n.slice(0, n.length - 4)] = v
                    } else if (U.endsWith(n, ".max")) {
                        if (!res.paramMax) res.paramMax = {}
                        res.paramMax[n.slice(0, n.length - 4)] = v
                    } else {
                        (<any>res)[n] = v;
                    }
                    didSomething = true
                    return "//% "
                })
        }

        for (let n of numberAttributes) {
            if (typeof (res as any)[n] == "string")
                (res as any)[n] = parseInt((res as any)[n])
        }

        for (let n of booleanAttributes) {
            if (typeof (res as any)[n] == "string")
                (res as any)[n] = (res as any)[n] == 'true' || (res as any)[n] == '1' ? true : false;
        }

        if (res.trackArgs) {
            res.trackArgs = ((res.trackArgs as any) as string).split(/[ ,]+/).map(s => parseInt(s) || 0)
        }

        if (res.enumInitialMembers) {
            res.enumInitialMembers = ((res.enumInitialMembers as any) as string).split(/[ ,]+/);
        }

        if (res.blockExternalInputs && !res.inlineInputMode) {
            res.inlineInputMode = "external";
        }

        res.paramHelp = {}
        res.jsDoc = ""
        cmt = cmt.replace(/\/\*\*([^]*?)\*\//g, (full: string, doccmt: string) => {
            doccmt = doccmt.replace(/\n\s*(\*\s*)?/g, "\n")
            doccmt = doccmt.replace(/^\s*@param\s+(\w+)\s+(.*)$/mg, (full: string, name: string, desc: string) => {
                res.paramHelp[name] = desc
                if (!res.paramDefl[name]) {
                    // these don't add to res.explicitDefaults
                    let m = /\beg\.?:\s*(.+)/.exec(desc);
                    if (m && m[1]) {
                        let defaultValue = /(?:"([^"]*)")|(?:'([^']*)')|(?:([^\s,]+))/g.exec(m[1]);
                        if (defaultValue) {
                            let val = defaultValue[1] || defaultValue[2] || defaultValue[3];
                            if (!val) val = "";
                            // If there are spaces in the value, it means the value was surrounded with quotes, so add them back
                            if (val.indexOf(" ") > -1) {
                                res.paramDefl[name] = `"${val}"`;
                            }
                            else {
                                res.paramDefl[name] = val;
                            }
                        }
                    }
                }
                return ""
            })
            res.jsDoc += doccmt
            return ""
        })

        res.jsDoc = res.jsDoc.trim()

        if (res.async)
            res.callingConvention = ir.CallingConvention.Async
        if (res.promise)
            res.callingConvention = ir.CallingConvention.Promise
        if (res.jres)
            res.whenUsed = true
        if (res.subcategories) {
            try {
                res.subcategories = JSON.parse(res.subcategories as any);
            }
            catch (e) {
                res.subcategories = undefined;
            }
        }
        if (res.groups) {
            try {
                res.groups = JSON.parse(res.groups as any);
            }
            catch (e) {
                res.groups = undefined;
            }
        }
        if (res.groupIcons) {
            try {
                res.groupIcons = JSON.parse(res.groupIcons as any);
            }
            catch (e) {
                res.groupIcons = undefined;
            }
        }
        if (res.groupHelp) {
            try {
                res.groupHelp = JSON.parse(res.groupHelp as any);
            }
            catch (e) {
                res.groupHelp = undefined;
            }
        }
        updateBlockDef(res);

        return res
    }

    export function updateBlockDef(attrs: CommentAttrs) {
        if (attrs.block) {
            const parts = attrs.block.split("||");
            attrs._def = applyOverrides(parseBlockDefinition(parts[0]));
            if (!attrs._def) pxt.debug("Unable to parse block def for id: " + attrs.blockId);
            if (parts[1]) attrs._expandedDef = applyOverrides(parseBlockDefinition(parts[1]));
            if (parts[1] && !attrs._expandedDef) pxt.debug("Unable to parse expanded block def for id: " + attrs.blockId);
        }

        function applyOverrides(def: ParsedBlockDef) {
            if (attrs._shadowOverrides) {
                def.parameters.forEach(p => {
                    const shadow = attrs._shadowOverrides[p.name];
                    if (shadow === "unset") delete p.shadowBlockId;
                    else if (shadow != null) p.shadowBlockId = shadow;
                });
            }
            return def;
        }
    }

    export function parseBlockDefinition(def: string): ParsedBlockDef {
        const tokens: Token[] = [];
        let currentWord: string;

        let strIndex = 0;
        for (; strIndex < def.length; strIndex++) {
            const char = def[strIndex];
            const restoreIndex = strIndex;
            let newToken: Token;
            switch (char) {
                case "*":
                case "_":
                    const tk = eatToken(c => c == char);
                    const offset = char === "_" ? 2 : 0;
                    if (tk.length === 1) newToken = { kind: TokenKind.SingleAsterisk << offset, content: tk }
                    else if (tk.length === 2) newToken = { kind: TokenKind.DoubleAsterisk << offset, content: tk };
                    else if (tk.length === 3) newToken = { kind: TokenKind.TripleAsterisk << offset, content: tk };
                    else strIndex = restoreIndex; // error: no more than three style marks
                    break;
                case "`":
                    const image = eatEnclosure("`");
                    if (image === undefined) {
                        strIndex = restoreIndex; // error: not terminated
                        break;
                    }
                    newToken = { kind: TokenKind.Image, content: image };
                    break;
                case "|":
                    newToken = { kind: TokenKind.Pipe };
                    break;
                case "\\":
                    if (strIndex < (def.length - 1)) newToken = { kind: TokenKind.Escape, content: def[1 + (strIndex++)] };
                    break;
                case "[":
                    const contentText = eatEnclosure("]");
                    if (contentText !== undefined && def[strIndex++ + 1] === "(") {
                        const contentClass = eatEnclosure(")");
                        if (contentClass !== undefined) {
                            newToken = { kind: TokenKind.TaggedText, content: contentText, type: contentClass };
                            break;
                        }
                    }
                    strIndex = restoreIndex; // error: format should be [text](class)
                    break;
                case "$":
                case "%":
                    const param = eatToken(c => /[a-zA-Z0-9_=]/.test(c), true).split("=");
                    if (param.length > 2) {
                        strIndex = restoreIndex; // error: too many equals signs
                        break;
                    }

                    let varName: string;
                    if (def[strIndex + 1] === "(") {
                        const oldIndex = strIndex;
                        ++strIndex;
                        varName = eatEnclosure(")");
                        if (!varName) strIndex = oldIndex;
                    }
                    newToken = { kind: (char === "$") ? TokenKind.ParamRef : TokenKind.Parameter, content: param[0], type: param[1], name: varName };
                    break;
            }

            if (newToken) {
                if (currentWord)
                    tokens.push({ kind: TokenKind.Word, content: currentWord });
                currentWord = undefined;
                tokens.push(newToken);
            }
            else if (!currentWord) {
                currentWord = char;
            }
            else {
                currentWord += char;
            }
        }

        if (currentWord)
            tokens.push({ kind: TokenKind.Word, content: currentWord });

        const parts: BlockPart[] = [];
        const parameters: BlockParameter[] = [];

        let stack: TokenKind[] = [];
        let open = 0;
        let currentLabel = ""

        let labelStack: (Label | BlockPart)[] = [];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i].kind;
            const top = stack[stack.length - 1];
            if (token & TokenKind.StyleMarks) {
                pushCurrentLabel(tokens[i].content);

                if (token & open) {
                    if (top & token) {
                        stack.pop();
                        open ^= token;

                        // Handle triple tokens
                        const remainder = (top & open) | (token & open);
                        if (remainder) {
                            stack.push(remainder);
                        }
                    }
                    else {
                        // We encountered a mismatched mark, so clear previous styles
                        collapseLabels();
                    }
                }
                else {
                    open |= token;
                    stack.push(token);
                }
            }
            else if (token & TokenKind.Text) {
                currentLabel += tokens[i].content;
            }
            else if (token & TokenKind.Unstylable) {
                pushLabels();
            }

            if (token == TokenKind.Parameter) {
                const param: BlockParameter = { kind: "param", name: tokens[i].content, shadowBlockId: tokens[i].type, ref: false };
                if (tokens[i].name) param.varName = tokens[i].name;
                parts.push(param);
                parameters.push(param);
            }
            else if (token == TokenKind.ParamRef) {
                const param: BlockParameter = { kind: "param", name: tokens[i].content, shadowBlockId: tokens[i].type, ref: true };
                if (tokens[i].name) param.varName = tokens[i].name;
                parts.push(param);
                parameters.push(param);
            }
            else if (token == TokenKind.Image) {
                pushCurrentLabel();
                labelStack.push({ kind: "image", uri: tokens[i].content } as BlockImage);
            }
            else if (token == TokenKind.TaggedText) {
                pushCurrentLabel();
                labelStack.push({ kind: "label", text: tokens[i].content, cssClass: tokens[i].type } as BlockLabel)
            }
            else if (token == TokenKind.Pipe) {
                parts.push({ kind: "break" });
            }
        }

        pushLabels();

        return { parts, parameters };

        function eatToken(pred: (c: string) => boolean, skipCurrent = false) {
            let current = "";
            if (skipCurrent) strIndex++
            while (strIndex < def.length && pred(def[strIndex])) {
                current += def[strIndex];
                ++strIndex;
            }
            if (current) strIndex--;
            return current;
        }

        function eatEnclosure(endMark: string) {
            const content = eatToken(c => c !== endMark, true);
            if (def[strIndex + 1] !== endMark) return undefined;
            ++strIndex;
            return content;
        }

        function collapseLabels() {
            let combined = "";
            let newStack: (Label | BlockPart)[] = [];
            for (const item of labelStack) {
                if (isBlockPart(item)) {
                    newStack.push({
                        content: combined,
                        styles: 0
                    });
                    newStack.push(item);
                    combined = "";
                }
                else {
                    combined += item.content;
                    if (item.endingToken) {
                        combined += item.endingToken;
                    }
                }
            }

            labelStack = newStack;

            if (combined) {
                labelStack.push({
                    content: combined,
                    styles: 0
                });
            }

            // Clear the style state as well
            stack = [];
            open = 0;
        }

        function pushLabels() {
            pushCurrentLabel();

            if (open) {
                collapseLabels();
            }

            while (labelStack.length) {
                const label = labelStack.shift();

                if (isBlockPart(label)) {
                    parts.push(label);
                }
                else {
                    if (!label.content) continue;

                    const styles: string[] = [];

                    if (label.styles & TokenKind.Bold) styles.push("bold");
                    if (label.styles & TokenKind.Italics) styles.push("italics");

                    parts.push({ kind: "label", text: label.content, style: styles } as BlockLabel);
                }
            }
        }

        function pushCurrentLabel(endingToken?: string) {
            labelStack.push({
                content: currentLabel,
                styles: open,
                endingToken
            });
            currentLabel = "";
        }
    }

    function isBlockPart(p: Label | BlockPart): p is BlockPart {
        return !!((p as BlockPart).kind);
    }
}
