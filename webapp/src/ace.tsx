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

declare let require: any;
const ace: AceAjax.Ace = require("brace");

const SK = ts.pxt.SymbolKind;

import Util = pxt.Util;
const lf = Util.lf

require('brace/mode/typescript');
require('brace/mode/javascript');
require('brace/mode/json');
require('brace/mode/c_cpp');
require('brace/mode/text');
require('brace/mode/xml');
require('brace/mode/markdown');
require('brace/mode/assembly_armthumb');

require('brace/theme/textmate');
require('brace/theme/tomorrow_night_bright');

require("brace/ext/language_tools");
require("brace/ext/keybinding_menu");
require("brace/ext/searchbox");



let acequire = (ace as any).acequire;
let Range = acequire("ace/range").Range;
let HashHandler = acequire("ace/keyboard/hash_handler").HashHandler;

export const cursorMarker = "\uE108"
let maxCompleteItems = 20;

export interface CompletionEntry {
    name: string;
    symbolInfo: ts.pxt.SymbolInfo;
    lastScore: number;
    searchName: string;
    searchDesc: string;
    desc: string;
    block?: string;
    snippet?: string;
    matches?: Util.Map<number[][]>;
}

export interface CompletionCache {
    apisInfo: ts.pxt.ApisInfo;
    completionInfo: ts.pxt.CompletionInfo;
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
                paramDefl: {},
                callingConvention: ts.pxt.ir.CallingConvention.Plain
            },
            name: name,
            namespace: "",
            kind: SK.None,
            parameters: null,
            retType: "",
        },
        lastScore: 0,
        searchName: name,
        searchDesc: desc,
        desc: desc
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
                let mkEntry = (q: string, si: ts.pxt.SymbolInfo) => fixupSearch({
                    name: si.isContextual ? si.name : q,
                    symbolInfo: si,
                    lastScore: 0,
                    searchDesc: q + " " + (si.attributes.jsDoc || ""),
                    desc: si.attributes.jsDoc || "",
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

                cache.entries = cache.entries.filter(e => {
                    if (e.symbolInfo.attributes.hidden)
                        return false
                    return true
                })
            })
            .then(() => this.setState({ cache: cache }))
    }

    computeMatch(pref: string): CompletionEntry[] {
        let cache = this.state.cache

        if (!pref) return cache.entries;

        pref = pref.toLowerCase()
        let spcPref = " " + pref;
        for (let e of cache.entries) {
            e.lastScore = 0
            e.matches = undefined;
            let idx = e.searchName.indexOf(pref)
            if (idx == 0)
                e.lastScore += 100
            else if (idx > 0)
                e.lastScore += 50
            else {
                idx = e.searchDesc.indexOf(spcPref)
                if (idx >= 0)
                    e.lastScore += 10;
            }
        }

        return cache.entries.filter(e => e.lastScore > 0);
    }

    computeFuzzyMatch(pref: string): CompletionEntry[] {
        let cache = this.state.cache
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
                    name: "desc",
                    weight: 0.1
                }],
            threshold: 0.7
        })

        let fures: {
            item: CompletionEntry;
            score: number;
            matches: {
                key: string;
                indices: number[][];
            }[];
        }[] = fu.search(pref);
        cache.entries.forEach(ce => ce.lastScore = 0);
        fures.forEach(fue => {
            let e = fue.item as CompletionEntry;
            e.lastScore = (1 - fue.score) * 100;
            e.matches = {}
            fue.matches
                .filter(match => match.indices && match.indices.length > 0)
                .forEach(match => e.matches[match.key] = match.indices)
        });
        return fures.filter(e => e.score > 0).map(e => e.item);
    }

    fetchCompletionInfo(textPos: AceAjax.Position, pref: string, isTopLevel: boolean) {
        let posTxt = this.props.parent.currFile.getName() + ":" + textPos.row + ":" + textPos.column
        let cache = this.state.cache
        if (!cache || cache.posTxt != posTxt) {
            this.queryCompletionAsync(textPos, posTxt).done();
            return null;
        }

        if (cache.entries) {
            let matches = this.computeMatch(pref);
            if (!matches.length && pref.length > 5)
                matches = this.computeFuzzyMatch(pref);
            for (let e of matches) {
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
            matches.sort((a, b) => (b.lastScore - a.lastScore) || Util.strcmp(a.searchName, b.searchName))
            return matches
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
            let cursor = (editor.selection as any).lead;
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

        text += ts.pxt.renderParameters(this.state.cache.apisInfo, si, cursorMarker);

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

        let info = this.fetchCompletionInfo(textPos, pref, isTopLevel);
        if (!info) return null; // or Loading... ?

        let hasMore = false
        if (info.length > maxCompleteItems) {
            info = info.slice(0, maxCompleteItems)
            info.push(mkSyntheticEntry(lf("There's more!"), lf("Keep typing to explore functionality")))
            hasMore = true
        }

        this.entries = info;

        const lineHeight = renderer.layerConfig.lineHeight;
        let pos = renderer.$cursorLayer.getPixelPosition(textPos, false) as { top?: number; bottom?: number; left: number; };
        pos.top -= renderer.scrollTop;
        pos.left -= renderer.scrollLeft;
        pos.top += lineHeight;
        pos.left += renderer.gutterWidth;

        // rebase the complition dialog when the cursor is low on the screen.
        if (pos.top > renderer.$size.height * 0.66 && pos.top + 2.1 * lineHeight * (Math.min(info.length, 10) + 1) > renderer.$size.height) {
            pos.bottom = renderer.$size.height - pos.top + lineHeight * 1.5;
            delete pos.top;
        }

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
        let style: any = { left: pos.left + "px" };
        if (pos.top) style.top = pos.top + "px";
        if (pos.bottom) {
            style.bottom = pos.bottom + "px";
            style.maxHeight = "22em";
        }
        return (
            <div className='ui vertical menu inverted completer' style={style}>
                {info.map((e, i) =>
                    <sui.Item class={'link ' + (i == idx ? "active" : "") }
                        key={e.name}
                        onClick={() => this.commit(e) }
                        >
                        <div className="name">
                            <span className="funname">{highlightCompletionEntry(e, "name", e.name, pref) }</span>
                            <span className="args">{getArgs(e) }</span>
                        </div>
                        <div className="doc">
                            {highlightCompletionEntry(e, "desc", e.desc, pref) }
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

function highlightCompletionEntry(entry: CompletionEntry, key: string, text: string, str: string, limit = 100) {
    let match = entry.matches ? entry.matches[key] : undefined;
    if (!match) return highlight(text, str, limit);

    let spl: JSX.Element[] = []
    let cur = 0;
    match.forEach(interval => {
        spl.push(<span key={spl.length}>{text.slice(cur, interval[0]) }</span>)
        spl.push(<span key={spl.length} className="highlight">{text.slice(interval[0], interval[1]) }</span>)
        cur = interval[1];
    });
    spl.push(<span key={spl.length}>{text.slice(match[match.length - 1][1]) }</span>);
    return spl;
}

function highlight(text: string, str: string, limit = 100): JSX.Element[] {
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

    hasBlocks() {
        if (!this.currFile) return true
        let blockFile = this.currFile.getVirtualFileName();
        return (blockFile && pkg.mainEditorPkg().files[blockFile] != null)
    }

    openBlocks() {
        pxt.tickEvent("typescript.showBlocks");

        let blockFile = this.currFile.getVirtualFileName();
        if (!blockFile) {
            let mainPkg = pkg.mainEditorPkg();
            if (mainPkg)
                this.parent.setFile(mainPkg.files["main.blocks"] || mainPkg.files["main.ts"]);
            return;
        }

        // needed to test roundtrip
        this.formatCode();

        if (!this.hasBlocks())
            return

        // might be undefined
        let mainPkg = pkg.mainEditorPkg();
        let js = this.currFile.content;
        let xml: string;

        const failedAsync = () => {
            this.forceDiagnosticsUpdate();
            let bf = pkg.mainEditorPkg().files[blockFile];
            return core.confirmAsync({
                header: lf("Oops, there is a problem converting your code."),
                body: lf("We are unable to convert your JavaScript code back to blocks. You can keep working in JavaScript or discard your changes and go back to the previous Blocks version."),
                agreeLbl: lf("Stay in JavaScript"),
                hideCancel: !bf,
                disagreeLbl: lf("Discard and go to Blocks")
            }).then(b => {
                // discard                
                if (!b) {
                    pxt.tickEvent("typescript.discardText");
                    this.parent.setFile(bf);
                } else {
                    pxt.tickEvent("typescript.keepText");
                }
            })
        }

        // it's a bit for a wild round trip:
        // 1) convert blocks to js to see if any changes happened, otherwise, just reload blocks
        // 2) decompile js -> blocks then take the decompiled blocks -> js
        // 3) check that decompiled js == current js % white space
        let blocksInfo: ts.pxt.BlocksInfo;
        this.parent.saveFileAsync()
            .then(() => compiler.getBlocksAsync())
            .then((bi) => {
                blocksInfo = bi;
                pxt.blocks.initBlocks(blocksInfo);
                let oldWorkspace = pxt.blocks.loadWorkspaceXml(mainPkg.files[blockFile].content);
                if (oldWorkspace) {
                    let oldJs = pxt.blocks.compile(oldWorkspace, blocksInfo).source;
                    if (oldJs == js) {
                        console.log('js not changed, skipping decompile');
                        pxt.tickEvent("typescript.noChanges")
                        return this.parent.setFile(mainPkg.files[blockFile]);
                    }
                }
                return compiler.decompileAsync(this.currFile.name)
                    .then(resp => {
                        if (!resp.success) return failedAsync();
                        xml = resp.outfiles[blockFile];
                        Util.assert(!!xml);
                        // try to convert back to typescript
                        let workspace = pxt.blocks.loadWorkspaceXml(xml);
                        if (!workspace) return failedAsync();

                        let b2jsr = pxt.blocks.compile(workspace, blocksInfo);

                        const cleanRx = /[\s;]/g;
                        if (b2jsr.source.replace(cleanRx, '') != js.replace(cleanRx, '')) {
                            pxt.tickEvent("typescript.conversionFailed");
                            console.log('js roundtrip failed:')
                            console.log('-- original:');
                            console.log(js.replace(cleanRx, ''));
                            console.log('-- roundtrip:');
                            console.log(b2jsr.source.replace(cleanRx, ''));
                            pxt.reportError('decompilation failure', {
                                js: js,
                                blockly: xml,
                                jsroundtrip: b2jsr.source
                            })
                            return failedAsync();
                        }

                        return mainPkg.setContentAsync(blockFile, xml)
                            .then(() => this.parent.setFile(mainPkg.files[blockFile]));
                    })
            }).catch(e => {
                pxt.reportException(e, { js: this.currFile.content });
                core.errorNotification(lf("Oops, something went wrong trying to convert your code."));
            }).done()
    }

    menu(): JSX.Element {
        if (!this.hasBlocks()) return null
        return <sui.Button class="ui floating" textClass="ui landscape only" text={lf("Blocks") } icon="puzzle" onClick={() => this.openBlocks() } />
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
        if (!this.isTypescript) return;

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
        let tmp = ts.pxt.format(data.programText, data.charNo)
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
        this.editor.setShowPrintMargin(false);

        let langTools = acequire("ace/ext/language_tools");

        this.editor.commands.on("exec", (e: any) => {
            pxt.debug("beforeExec", e.command.name)
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
            pxt.debug("afterExec", e.command.name)
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

        if (pxt.appTarget.compile && pxt.appTarget.compile.hasHex) {
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

        this.editor.setTheme("ace/theme/textmate")

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

    overrideFile(content: string) {
        this.editor.session.setValue(content);
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

    highlightStatement(brk: ts.pxt.LocationInfo) {
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
            this.parent.setErrorCard(undefined);
            return undefined;
        }

        this.parent.setErrorCard({
            header: lf("line {0}", annotation.row + 1),
            name: lf("error"),
            description: annotation.text,
            color: 'red'
        }, (e) => {
            this.setViewState(annotation);
            this.editor.setHighlightActiveLine(true);
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
