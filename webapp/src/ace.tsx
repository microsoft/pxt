/// <reference path="../../typings/ace/ace.d.ts" />
/// <reference path="fuse.d.ts" />

import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as compiler from "./compiler"
import * as sui from "./sui";
import * as data from "./data";
import * as codecard from "./codecard";

declare var require: any;
var ace: AceAjax.Ace = require("brace");

let SK = ts.ks.SymbolKind;

import Util = ks.Util;
var lf = Util.lf

require('brace/mode/typescript');
require('brace/mode/javascript');
require('brace/mode/json');
require('brace/mode/c_cpp');
require('brace/mode/text');
require('brace/mode/xml');
require('brace/mode/markdown');
require('brace/mode/assembly_armthumb');

require('brace/theme/sqlserver');
require('brace/theme/tomorrow_night_bright');

require("brace/ext/language_tools");
require("brace/ext/keybinding_menu");
require("brace/ext/searchbox");



var acequire = (ace as any).acequire;
var Range = acequire("ace/range").Range;
var HashHandler = acequire("ace/keyboard/hash_handler").HashHandler;

export const cursorMarker = "\uE108"
var maxCompleteItems = 20;

export interface CompletionEntry {
    name: string;
    symbolInfo: ts.ks.SymbolInfo;
    lastScore: number;
    searchName: string;
    searchDesc: string;
    block?: string;
    snippet?: string;
}

export interface CompletionCache {
    apisInfo: ts.ks.ApisInfo;
    completionInfo: ts.ks.CompletionInfo;
    entries: CompletionEntry[];
    fuseEntries: Fuse;
    posTxt: string;
}

function fixupSearch(e: CompletionEntry) {
    e.searchName = (e.searchName || "").replace(/\s+/g, "").toLowerCase() + " ";
    e.searchDesc = " " + (e.searchDesc || "").toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ";
    e.block = e.block ? e.block.replace(/\s/g, '').toLowerCase() : '';
    return e
}

function mkSyntheticEntry(name: string, desc: string) {
    return fixupSearch({
        name: name,
        symbolInfo: {
            attributes: {
                jsDoc: desc,
                paramDefl: {}
            },
            name: name,
            namespace: "",
            kind: SK.None,
            parameters: null,
            retType: "",
        },
        lastScore: 0,
        searchName: name,
        searchDesc: desc
    })
}

function mkSnippet(name: string, desc: string, code: string) {
    let e = mkSyntheticEntry(name, desc)
    e.snippet = code
    return e
}

let block = `{\n ${cursorMarker}\n}`
// TODO auto-rename of locals
let snippets = [
    mkSnippet("if", "Do something depending on condition", `if (${cursorMarker}) ${block}`),
    mkSnippet("if else", "Do something or something else depending on condition", `if (${cursorMarker}) ${block} else ${block}`),
    mkSnippet("else", "What to do if the condition is not satisfied", `else ${block}`),
    mkSnippet("else if", "Check the alternative condition", `else if (${cursorMarker}) ${block}`),
    mkSnippet("while", "Loop while condition is true", `while (true) {\n ${cursorMarker}\nbasic.pause(20)\n}`),
    mkSnippet("for", "Repeat a given number of times", `for (let i = 0; i < 5; i++) ${block}`),
    mkSnippet("function", "Define a new procedure", `function doSomething() ${block}`),
    mkSnippet("class", "Define a new object type", `class Thing ${block}`),
    mkSnippet("let", "Define a new variable", `let x = ${cursorMarker}`),
    // TODO proper text formatting for switch missing
    mkSnippet("switch", "Branch on a number or enum", `switch (${cursorMarker}) {\ncase 0:\nbreak\n}`),
    mkSnippet("true", "True boolean value", `true`),
    mkSnippet("false", "False boolean value", `false`),
    // for each not supported at the moment in the compiler
    //mkSnippet("for each", "Do something for all elements of an array", `for (let e of ${placeholderChar}) ${block}`),
]

export class AceCompleter extends data.Component<{ parent: Editor; }, {
    visible?: boolean;
    cache?: CompletionCache;
    selectedEntry?: string;
}> {
    queryingFor: string;
    firstTime = true;
    completionRange: AceAjax.Range;
    keyHandler: any;
    entries: CompletionEntry[] = [];

    // ACE interface
    get activated() { return !!this.state.visible }
    showPopup() {
        this.setState({ visible: true })
    }
    detach() {
        this.entries = []
        if (this.state.visible) {
            this.setState({
                visible: false,
                selectedEntry: null
            })
            this.props.parent.parent.typecheckNow();
        }
    }
    cancelContextMenu() { }

    queryCompletionAsync(pos: AceAjax.Position, posTxt: string) {
        if (this.queryingFor == posTxt) return Promise.resolve()

        this.queryingFor = posTxt
        let textAndPos = this.props.parent.textAndPosition(pos)

        let cache: CompletionCache = {
            apisInfo: null,
            completionInfo: null,
            posTxt: posTxt,
            entries: null,
            fuseEntries: null
        }

        return compiler.getApisInfoAsync()
            .then(info => {
                cache.apisInfo = info;
                console.log(info)
            })
            .then(() => compiler.workerOpAsync("getCompletions", {
                fileName: this.props.parent.currFile.getTypeScriptName(),
                fileContent: textAndPos.programText,
                position: textAndPos.charNo
            }))
            .then(compl => {
                cache.completionInfo = compl;
                if (!cache.completionInfo || !cache.completionInfo.entries) {
                    cache.completionInfo = null
                    return
                }
                // console.log(compl)
                let mkEntry = (q: string, si: ts.ks.SymbolInfo) => fixupSearch({
                    name: si.isContextual ? si.name : q,
                    symbolInfo: si,
                    lastScore: 0,
                    searchDesc: q + " " + (si.attributes.jsDoc || ""),
                    searchName: si.name,
                    block: si.attributes.block
                })
                cache.entries = []
                cache.fuseEntries = undefined;
                if (!cache.completionInfo.isMemberCompletion) {
                    Util.iterStringMap(cache.apisInfo.byQName, (k, v) => {
                        if (v.kind == SK.Method || v.kind == SK.Property) {
                            // don't know how to insert these yet
                        } else {
                            cache.entries.push(mkEntry(k, v))
                        }
                    })
                    // TODO only do it at the beginning of a line
                    Util.pushRange(cache.entries, snippets)
                }
                Util.iterStringMap(cache.completionInfo.entries, (k, v) => {
                    cache.entries.push(mkEntry(k, v))
                })
            })
            .then(() => this.setState({ cache: cache }))
    }

    computeMatch(pref: string): { item: CompletionEntry; score: number; }[] {
        let cache = this.state.cache

        if (!pref) return cache.entries.map(entry => { return { item: entry, score: 0 } });

        let fu = cache.fuseEntries;
        if (!fu) fu = cache.fuseEntries = new Fuse(cache.entries, {
            include: ["score", "matches"],
            shouldSort: false,
            keys: [{
                name: "name",
                weight: 0.4
            }, {
                    name: "searchName",
                    weight: 0.3
                }, {
                    name: "block",
                    weight: 0.2
                }, {
                    name: "searchDesc",
                    weight: 0.1
                }],
            threshold: 0.65
        })
        let fures: { item: CompletionEntry; score: number; matches: any; }[] = fu.search(pref);
        return fures;
    }

    fetchCompletionInfo(textPos: AceAjax.Position, pref: string, isTopLevel: boolean) {
        let posTxt = this.props.parent.currFile.getName() + ":" + textPos.row + ":" + textPos.column
        let cache = this.state.cache
        if (!cache || cache.posTxt != posTxt) {
            this.queryCompletionAsync(textPos, posTxt).done();
            return null;
        }

        if (cache.entries) {
            let fures = this.computeMatch(pref);
            cache.entries.forEach(ce => ce.lastScore = 0);
            for (let fue of fures) {
                let e = fue.item as CompletionEntry;
                e.lastScore = (1 - fue.score) * 100;

                let k = e.symbolInfo.kind
                if (isTopLevel) {
                    if (k == SK.Enum || k == SK.EnumMember)
                        e.lastScore *= 1e-5;
                }

                if (!e.symbolInfo.isContextual && (k == SK.Method || k == SK.Property))
                    e.lastScore *= 1e-3;

                if (e.symbolInfo.isContextual)
                    e.lastScore *= 1.1;
            }
            let res = cache.entries.filter(e => e.lastScore > 0);
            res.sort((a, b) => (b.lastScore - a.lastScore) || Util.strcmp(a.searchName, b.searchName))
            return res
        }

        return null
    }

    selectedIndex() {
        let idx = Util.indexOfMatching(this.entries, e => e.name == this.state.selectedEntry);
        if (idx < 0 && this.entries.length > 0)
            return 0;
        else
            return idx;
    }

    moveCursor(delta: number) {
        let pos = this.selectedIndex()
        pos += delta
        if (pos < 0) {
            this.detach()
        } else if (pos >= this.entries.length) {
            // do nothing
        } else {
            this.setState({ selectedEntry: this.entries[pos].name })
        }
    }

    initFirst() {
        let editor = this.props.parent.editor
        this.firstTime = false;
        editor.on("mousedown", () => this.detach())
        editor.on("mousewheel", () => this.detach())
        editor.on("change", e => {
            var cursor = (editor.selection as any).lead;
            if (this.completionRange) {
                let basePos = this.completionRange.start
                if (cursor.row != basePos.row || cursor.column < basePos.column) {
                    this.detach();
                }
            } else this.detach();
        });

        this.keyHandler = new HashHandler();
        this.keyHandler.bindKeys({
            "Up": () => this.moveCursor(-1),
            "Down": () => this.moveCursor(1),
            "Esc": () => this.detach(),
            "Return": () => this.commitAtCursorOrInsert("\n"),
            "Tab": () => this.commitAtCursorOrInsert("\t"),
        })
    }

    commitAtCursorOrInsert(s: string) {
        let editor = this.props.parent.editor
        let idx = this.selectedIndex()
        if (idx < 0) {
            editor.insert(s)
            this.detach()
        } else {
            this.commit(this.entries[idx])
        }
    }

    commit(e: CompletionEntry) {
        let editor = this.props.parent.editor
        if (!editor || !this.completionRange) return

        let text = e.name
        let si = e.symbolInfo

        if (e.snippet) {
            text = e.snippet
        } else {
            if (si.kind == SK.None) return
        }

        text += ts.ks.renderParameters(this.state.cache.apisInfo, si, cursorMarker);

        editor.session.replace(this.completionRange, text);
        this.detach()
        if (/\n/.test(text))
            this.props.parent.formatCode();
    }


    // React interface
    componentDidMount() {
        this.props.parent.completer = this;
    }

    componentDidUpdate() {
        core.scrollIntoView(this.child(".item.active"))
    }

    renderCore() {
        let editor = this.props.parent.editor
        if (!editor) return null

        if (this.keyHandler)
            (editor as any).keyBinding.removeKeyboardHandler(this.keyHandler);

        if (!this.state.visible) return null

        let mode = editor.session.getMode();
        if (mode.$id != "ace/mode/typescript") return null;

        if (this.firstTime)
            this.initFirst();

        (editor as any).keyBinding.addKeyboardHandler(this.keyHandler);
        let renderer: any = editor.renderer

        let textPos = editor.getCursorPosition();
        let line = editor.session.getLine(textPos.row);
        let linepref = line.slice(0, textPos.column)
        let m = /((\w+\s*)*)$/.exec(linepref)
        let pref = (m ? m[1] : "")
        let before = linepref.slice(0, linepref.length - pref.length).trim()
        let isTopLevel = !before || Util.endsWith(before, "{")  // }

        textPos.column -= pref.length

        let pos = renderer.$cursorLayer.getPixelPosition(textPos, false);
        pos.top -= renderer.scrollTop;
        pos.left -= renderer.scrollLeft;
        pos.top += renderer.layerConfig.lineHeight;
        pos.left += renderer.gutterWidth;

        let info = this.fetchCompletionInfo(textPos, pref, isTopLevel);

        if (!info) return null; // or Loading... ?

        let hasMore = false

        if (info.length > maxCompleteItems) {
            info = info.slice(0, maxCompleteItems)
            info.push(mkSyntheticEntry(lf("There's more!"), lf("Keep typing to explore functionality")))
            hasMore = true
        }

        this.entries = info;

        this.completionRange = new Range(textPos.row, textPos.column, textPos.row, textPos.column + pref.length);
        let idx = this.selectedIndex();

        let getArgs = (e: CompletionEntry) => {
            let si = e.symbolInfo
            let args = ""
            if (si.parameters) {
                args = "(" + si.parameters.map(p => p.name + ":" + friendlyTypeName(p.type)).join(", ") + ")"
            } else if (e.snippet) {
                let snip = e.snippet
                if (Util.startsWith(snip, e.name)) snip = snip.slice(e.name.length)
                else snip = " " + snip
                snip = Util.replaceAll(snip, cursorMarker, "")
                return snip.replace(/\s+/g, " ")
            }
            if (si.retType && si.retType != "void")
                args += " : " + friendlyTypeName(si.retType)
            return args
        }

        return (
            <div className='ui vertical menu inverted completer' style={{ left: pos.left + "px", top: pos.top + "px" }}>
                {info.map((e, i) =>
                    <sui.Item class={'link ' + (i == idx ? "active" : "") }
                        key={e.name}
                        onClick={() => this.commit(e) }
                        >
                        <div className="name">
                            <span className="funname">{highlight(e.name, pref) }</span>
                            <span className="args">{getArgs(e) }</span>
                        </div>
                        <div className="doc">
                            {highlight(e.symbolInfo.attributes.jsDoc || "", pref) }
                        </div>
                    </sui.Item>
                ) }
            </div>
        )
    }
}

function friendlyTypeName(tp: string) {
    if (tp == "() => void") return "Action"
    return tp.replace(/.*\./, "")
}

function highlight(text: string, str: string, limit = 100) {
    let tmp = text.toLowerCase();
    let spl: JSX.Element[] = []
    let written = 0
    while (true) {
        let idx = str ? tmp.indexOf(str) : -1
        let len = idx == 0 ? str.length :
            idx < 0 ? tmp.length : idx
        spl.push(<span key={spl.length} className={idx == 0 ? "highlight" : ""}>{text.slice(0, len) }</span>)
        text = text.slice(len)
        tmp = tmp.slice(len)
        written += len
        if (!tmp || written > limit)
            break;
    }
    return spl;
}

export class Editor extends srceditor.Editor {
    editor: AceAjax.Editor;
    currFile: pkg.File;
    completer: AceCompleter;
    isTypescript = false;

    openBlocks() {
        // might be undefined
        let mainPkg = pkg.mainEditorPkg();
        let blockFile = this.currFile.getVirtualFileName();

        this.parent.saveFileAsync()
            .then(() => compiler.decompileAsync(this.currFile.name))
            .then(resp => {
                if (!resp.success) {
                    this.forceDiagnosticsUpdate();
                    let bf = pkg.mainEditorPkg().files[blockFile];
                    return core.confirmAsync({
                        header: lf("Oops, there is a program converting your code."),
                        body: lf("We are unable to convert your JavaScript code back to blocks. You can try to fix the errors in javaScript or discard your changes and go back to the previous Blocks version."),
                        agreeLbl: lf("Fix my JavaScript"),
                        hideCancel: !bf,
                        disagreeLbl: lf("Discard and go to Blocks")
                    }).then(b => {
                        // discard
                        if (!b) this.parent.setFile(bf);
                    })
                }
                let xml = resp.outfiles[blockFile];
                Util.assert(!!xml);
                return mainPkg.setContentAsync(blockFile, xml).then(() => this.parent.setFile(mainPkg.files[blockFile]))
            }).catch(e => {
                ks.reportException(e, { js: this.currFile.content });
                core.errorNotification(lf("Oops, something went wrong trying to convert your code."));
            }).done()
    }

    menu(): JSX.Element {
        let vf : string;
        return this.currFile && (vf = this.currFile.getVirtualFileName()) && pkg.mainEditorPkg().files[vf]
            ? <sui.Button class="ui floating" textClass="ui landscape only" text={lf("Show Blocks") } icon="puzzle" onClick={() => this.openBlocks() } />
            : undefined
    }

    undo() {
        this.editor.undo()
    }

    display() {
        return (
            <div>
                <div className='full-abs' id='aceEditorInner' />
                <AceCompleter parent={this} />
            </div>
        )
    }

    textAndPosition(pos: AceAjax.Position) {
        let programText = this.editor.session.getValue()
        let lines = pos.row
        let chars = pos.column
        let charNo = 0;
        for (; charNo < programText.length; ++charNo) {
            if (lines == 0) {
                if (chars-- == 0)
                    break;
            } else if (programText[charNo] == '\n') lines--;
        }

        return { programText, charNo }

    }

    beforeCompile() {
        this.formatCode()
    }

    formatCode(isAutomatic = false) {
        function spliceStr(big: string, idx: number, deleteCount: number, injection: string = "") {
            return big.slice(0, idx) + injection + big.slice(idx + deleteCount)
        }

        let data = this.textAndPosition(this.editor.getCursorPosition())
        let cursorOverride = data.programText.indexOf(cursorMarker)
        if (cursorOverride >= 0) {
            isAutomatic = false
            data.programText = Util.replaceAll(data.programText, cursorMarker, "")
            data.charNo = cursorOverride
        }
        let tmp = ts.ks.format(data.programText, data.charNo)
        if (isAutomatic && tmp.formatted == data.programText)
            return;
        let formatted = tmp.formatted
        let line = 1
        let col = 0
        //console.log(data.charNo, tmp.pos)
        for (let i = 0; i < formatted.length; ++i) {
            let c = formatted.charCodeAt(i)
            col++
            if (i >= tmp.pos)
                break;
            if (c == 10) { line++; col = 0 }
        }
        this.editor.setValue(formatted, -1)
        this.editor.gotoLine(line, col - 1, false)
    }

    getCurrLinePrefix() {
        let pos = this.editor.getCursorPosition()
        let line = this.editor.getSession().getLine(pos.row)
        return line.slice(0, pos.row)
    }

    isIncomplete() {
        return this.completer.activated
    }

    prepare() {
        this.editor = ace.edit("aceEditorInner");
        let langTools = acequire("ace/ext/language_tools");

        this.editor.commands.on("exec", (e: any) => {
            console.info("beforeExec", e.command.name)
            if (!this.isTypescript) return;

            let insString: string = e.command.name == "insertstring" ? e.args : null

            //if (insString == "\n") needsFormat = true
            //if (insString && insString.trim() && insString.length == 1) {
            //    if (!this.getCurrLinePrefix().trim()) {}
            //}
        });

        let approvedCommands = {
            insertstring: 1,
            backspace: 1,
            Down: 1,
            Up: 1,
        }

        this.editor.commands.on("afterExec", (e: any) => {
            console.info("afterExec", e.command.name)
            if (!this.isTypescript) return;

            let insString: string = e.command.name == "insertstring" ? e.args : null
            if (this.completer.activated) {
                if (insString && !/^[\w]$/.test(insString)) {
                    this.completer.detach();
                    if (e.args == ".")
                        this.completer.showPopup();
                } else if (!approvedCommands.hasOwnProperty(e.command.name)) {
                    this.completer.detach();
                } else {
                    this.completer.forceUpdate();
                }
            } else {
                if (/^[a-zA-Z\.]$/.test(insString)) {
                    this.completer.showPopup();
                }
            }
        });

        this.editor.commands.addCommand({
            name: "showKeyboardShortcuts",
            bindKey: { win: "Ctrl-Alt-h", mac: "Command-Alt-h" },
            exec: () => {
                let module = acequire("ace/ext/keybinding_menu")
                module.init(this.editor);
                (this.editor as any).showKeyboardShortcuts()
            }
        })

        this.editor.commands.addCommand({
            name: "formatCode",
            bindKey: { win: "Alt-Shift-f", mac: "Alt-Shift-f" },
            exec: () => this.formatCode()
        })

        this.editor.commands.addCommand({
            name: "save",
            bindKey: { win: "Ctrl-S", mac: "Command-S" },
            exec: () => this.parent.saveFile()
        })

        this.editor.commands.addCommand({
            name: "runSimulator",
            bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" },
            exec: () => this.parent.runSimulator()
        })

        if (ks.appTarget.compile.hasHex) {
            this.editor.commands.addCommand({
                name: "compileHex",
                bindKey: { win: "Ctrl-Alt-Enter", mac: "Command-Alt-Enter" },
                exec: () => this.parent.compile()
            })
        }

        let sess = this.editor.getSession()
        sess.setNewLineMode("unix");
        sess.setTabSize(4);
        sess.setUseSoftTabs(true);
        this.editor.$blockScrolling = Infinity;

        sess.on("change", () => {
            if (this.lastSet != null) {
                this.lastSet = null
            } else {
                this.updateDiagnostics();
                this.changeCallback();
            }
        })

        this.isReady = true
    }

    getId() {
        return "aceEditor"
    }

    setTheme(theme: srceditor.Theme) {
        let th = 'ace/theme/sqlserver'
        if (this.editor.getTheme() != th) {
            this.editor.setTheme(th)
        }
        this.editor.setFontSize(theme.fontSize)
    }

    getViewState() {
        return this.editor.getCursorPosition()
    }

    getCurrentSource() {
        return this.editor.getValue()
    }

    acceptsFile(file: pkg.File) {
        return true
    }

    private lastSet: string;
    private setValue(v: string) {
        this.lastSet = v;
        this.editor.session.setValue(v);
    }

    loadFile(file: pkg.File) {
        let ext = file.getExtension()
        let modeMap: any = {
            "cpp": "c_cpp",
            "json": "json",
            "md": "markdown",
            "ts": "typescript",
            "js": "javascript",
            "blocks": "xml",
            "asm": "assembly_armthumb"
        }
        let mode = "text"
        if (modeMap.hasOwnProperty(ext)) mode = modeMap[ext]
        let sess = this.editor.getSession()
        sess.setMode('ace/mode/' + mode);
        this.editor.setReadOnly(file.isReadonly());
        this.isTypescript = mode == "typescript";

        let curr = (this.editor as any).completer as AceCompleter;
        if (curr) curr.detach();
        if (this.isTypescript) {
            (this.editor as any).completer = this.completer;
            this.editor.setOptions({
                enableBasicAutocompletion: false,
                enableLiveAutocompletion: false
            });
        } else {
            (this.editor as any).completer = null;
            this.editor.setOptions({
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true
            });
        }

        this.currFile = file;
        this.setValue(file.content)
        this.setDiagnostics(file, this.snapshotState())
    }

    snapshotState() {
        return this.editor.getSession().doc.getAllLines()
    }

    private diagSnapshot: string[];
    private annotationLines: number[];

    updateDiagnostics() {
        if (this.needsDiagUpdate())
            this.forceDiagnosticsUpdate();
    }

    private needsDiagUpdate() {
        if (!this.annotationLines) return false
        let lines: string[] = (this.editor.getSession().doc as any).$lines
        for (let line of this.annotationLines) {
            if (this.diagSnapshot[line] !== lines[line])
                return true;
        }
        return false;
    }

    highlightStatement(brk: ts.ks.LocationInfo) {
        this.forceDiagnosticsUpdate()
        if (!brk) return
        let sess = this.editor.getSession();
        sess.addMarker(new Range(brk.line, brk.character, brk.line, brk.character + brk.length),
            "ace_highlight-marker", "ts-highlight", true)
    }

    forceDiagnosticsUpdate() {
        let sess = this.editor.getSession();
        Object.keys(sess.getMarkers(true) || {}).forEach(m => sess.removeMarker(parseInt(m)))
        sess.clearAnnotations()
        let ann: AceAjax.Annotation[] = []
        let file = this.currFile

        let lines: string[] = (sess.doc as any).$lines
        this.annotationLines = []

        if (file && file.diagnostics)
            for (let d of file.diagnostics) {
                ann.push({
                    row: d.line,
                    column: d.character,
                    text: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
                    type: "error"
                })

                if (lines[d.line] === this.diagSnapshot[d.line]) {
                    this.annotationLines.push(d.line)
                    sess.addMarker(new Range(d.line, d.character, d.line, d.character + d.length),
                        "ace_error-marker", "ts-error", true)
                }
            }
        sess.setAnnotations(ann)
        this.setAnnotationHelpCard(ann[0]);
    }

    private setAnnotationHelpCard(annotation: AceAjax.Annotation): void {
        if (!annotation) {
            this.parent.setHelp(undefined);
            return undefined;
        }

        this.parent.setHelp({
            header: lf("line {0}", annotation.row + 1),
            name: lf("error"),
            description: annotation.text,
            color: 'red'
        }, (e) => {
            this.setViewState(annotation);
            e.preventDefault();
            return false;
        })
    }

    setDiagnostics(file: pkg.File, snapshot: string[]) {
        Util.assert(this.currFile == file)
        this.diagSnapshot = snapshot
        this.forceDiagnosticsUpdate()
    }

    setViewState(pos: AceAjax.Position) {
        this.editor.moveCursorToPosition(pos)
        this.editor.scrollToLine(pos.row - 1, true, false, () => { })
    }
}
