/// <reference path="../../localtypings/monacoTypeScript.d.ts"/>

/**
 * This file is passed to the monaco-typescript worker in pxteditor/monaco.ts
 * It isn't used directly in the webapp.
 *
 * It doesn't have access to any other code, so it can't use any functions defined in the
 * pxt, pxtc, or ts namespaces (but can use types). The tsc that is passed in here is a reference
 * to the TypeScript compiler and should have all of the methods that are defined on the ts namespace
 * as well as the ones from pxtcompiler/typescriptInternal.d.ts
 */
const worker: monaco.languages.typescript.CustomTSWebWorkerFactory = (TSWorkerClass, tsc, libs) => {
    return class PxtWorker extends TSWorkerClass {
        protected service: ts.LanguageService;
        protected weightCache: pxt.Map<pxt.Map<string>> = {};

        constructor(ctx: monaco.worker.IWorkerContext, createData: monaco.languages.typescript.ICreateData) {
            super(ctx, createData);

            // FIXME: It would be nice to not create a whole second language service and just use
            // the one from the parent class, but they keep it private
            this.service = tsc.createLanguageService(this);
        }
        async getCompletionsAtPosition(
            fileName: string,
            position: number
        ) {
            const res: ts.CompletionInfo = await super.getCompletionsAtPosition(fileName, position);

            if (!res) return res;

            // Filter out all entries that start with _
            res.entries = res.entries.filter(ent => !ent.name.startsWith("_"));

            const program = this.service.getProgram();
            const source = program.getSourceFile(fileName);
            const text = source.getFullText();

            // Try to find the position of the "." if this is a property access
            let pos = position - 1;
            while (pos > 0 && tsc.isIdentifierPart(text.charCodeAt(position), tsc.ScriptTarget.ES5)) {
                pos--;
            }

            // If we found the ".", then sort the properties/exports by weight if available
            if (text.charAt(pos) !== ".") pos = -1;
            if (pos > 0) {
                const node = findInnerMostNodeAtPosition(source, pos - 1, tsc);
                const checker = program.getTypeChecker();

                // If this is a class/interface, we need to get the symbol for the type
                const type = checker.getTypeAtLocation(node);

                // Otherwise it's a module
                const sym = type?.symbol || checker.getSymbolAtLocation(node);

                if (sym) {
                    const qName = checker.getFullyQualifiedName(sym);

                    // Cache the weights so that we don't need to reparse each time a completion is requested
                    if (!this.weightCache[qName]) {
                        this.weightCache[qName] = {};
                        const tables: ts.SymbolTable[] = [];
                        if (sym.members) tables.push(sym.members);
                        if (sym.exports) tables.push(sym.exports);

                        const symbolAttributes = parseCommentString(getComments(sym, tsc));
                        let groups: string[] = [];
                        if (symbolAttributes.groups) {
                            try {
                                const parsedGroups = JSON.parse(symbolAttributes.groups);
                                if (Array.isArray(groups) && !groups.some(val => typeof val !== "string")) groups = parsedGroups;
                            }
                            catch (e) {
                                // ignore invalid comment attrinbutes
                            }
                        }

                        // The sorting rules for our blocks go something like this
                        //    APIs without the "group" attribute go first
                        //    APIs with "group" get sorted according to the order of the "groups" entry on the namespace
                        //    If an API has a "group" that is not within "groups", arbitrarily tack them onto the end
                        //    APIs with "advanced" always appear after all of the APIs without it
                        //    APIs within each group are sorted by the weight attribute
                        //    APIs without weight are assumed to have a weight of 0 (FIXME: in the toolbox, it's actually 50)
                        const advanced: {[index: string]: [string, number][]} = {};
                        const nonAdvanced: {[index: string]: [string, number][]} = {};
                        for (const table of tables) {
                            table.forEach(entry => {
                                const comments = getComments(entry, tsc);
                                const parsed = parseCommentString(comments);
                                let weight = 0;

                                if (parsed.shim === "TD_ID") {
                                    // These entries are filtered out below
                                    this.weightCache[qName][entry.name] = "hidden";
                                    return;
                                }
                                else if (parsed.weight) {
                                    weight = parseInt(parsed.weight);
                                }

                                // Put APIs with no blocks at the very end of the list with the unsorted groups
                                const entries = (parsed.advanced || !parsed.block) ? advanced : nonAdvanced;
                                const group = parsed.block ? (parsed.group || "*") : "ts-only";

                                if (!entries[group]) entries[group] = [];
                                entries[group].push([entry.name, weight])
                            });
                        }

                        const allGroups = ["*"].concat(groups);
                        for (const group of Object.keys(advanced).concat(Object.keys(nonAdvanced))) {
                            if (allGroups.indexOf(group) === -1) allGroups.push(group);
                        }

                        const entries: string[] = [];
                        for (const group of allGroups) {
                            if (nonAdvanced[group]) entries.push(...nonAdvanced[group].sort((a, b) => b[1] - a[1]).map(e => e[0]))
                        }
                        for (const group of allGroups) {
                            if (advanced[group]) entries.push(...advanced[group].sort((a, b) => b[1] - a[1]).map(e => e[0]))
                        }

                        for (let i = 0; i < entries.length; i++) {
                            this.weightCache[qName][entries[i]] = weightToSortText(entries.length - i);
                        }
                    }

                    res.entries = res.entries.filter(entry => this.weightCache[qName][entry.name] !== "hidden")

                    // We sort the entries by replacing the sortText with a string that starts
                    // with a number
                    for (const entry of res.entries) {
                        const id = this.weightCache[qName][entry.name] || weightToSortText(0);
                        entry.sortText = id + entry.name;
                    }
                }
            }

            return res;
        }
    }
}

// Adapted from pxtcompiler/emitter/typescriptHelpers.ts
function findInnerMostNodeAtPosition(n: ts.Node, position: number, tsc: any): ts.Node | null {
    for (let child of n.getChildren()) {
        if (child.kind >= tsc.SyntaxKind.FirstPunctuation && child.kind <= tsc.SyntaxKind.LastPunctuation)
            continue;

        let s = child.getStart()
        let e = child.getEnd()
        if (s <= position && position < e)
            return findInnerMostNodeAtPosition(child, position, tsc)
    }
    return (n && n.kind === tsc.SyntaxKind.SourceFile) ? null : n;
}

// Adapted from pxtcompiler/emitter/emitter.ts
function getComments(symbol: ts.Symbol, tsc: any) {
    let cmtCore = (node: ts.Node) => {
        const src = node.getSourceFile();
        if (!src) return "";
        const doc = tsc.getLeadingCommentRangesOfNode(node, src) as ts.CommentRange[]
        if (!doc) return "";
        const cmt = doc.map(r => src.text.slice(r.pos, r.end)).join("\n")
        return cmt;
    }

    const decls = symbol.getDeclarations();
    if (decls) return symbol.getDeclarations().map(cmtCore).join("\n");
    else return "";
}

function parseCommentString(comment: string) {
    const out: pxt.Map<any> = {};
    if (!comment) return out;

    let didSomething = true;

    while (didSomething) {
        didSomething = false;
        // This doesn't support all of the magic we have in pxtlib/service.ts but it handles the basic
        // format of //% property="value"
        comment = comment.replace(/\/\/%[ \t]*([\w\.-]+)(=(("[^"\n]*")|'([^'\n]*)'|([^\s]*)))?/,
        (f: string, key: string, d0: string, d1: string,
            v0: string, v1: string, v2: string) => {
            const value = v0 ? JSON.parse(v0) : (d0 ? (v0 || v1 || v2) : "true");
            out[key] = value;
            didSomething = true;
            return "//% ";
        });
    }
    return out;
}

function weightToSortText(weight: string | number) {
    let numWeight: number;
    if (typeof weight === "string") {
        numWeight = parseInt(weight);
    }
    else {
        numWeight = weight;
    }
    numWeight = 9999 - numWeight;
    let outString = numWeight + "";
    while (outString.length < 4) {
        outString = "0" + outString;
    }
    return outString;
}

(self as any).customTSWorkerFactory = worker;