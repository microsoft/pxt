import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as compiler from "./compiler"
import * as sui from "./sui";
import * as data from "./data";

declare var require: any;
var ace: AceAjax.Ace = require("brace");

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


type CompletionEntry = ts.mbit.service.MbitCompletionEntry;

export interface CompletionCache {
    apisInfo: ts.mbit.ApisInfo;
    completionInfo: ts.mbit.service.MbitCompletionInfo;
    posTxt: string;
}

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
        if (this.state.visible)
            this.setState({
                visible: false,
                selectedEntry: null
            })
    }
    cancelContextMenu() { }

    queryCompletionAsync(pos: AceAjax.Position, posTxt: string) {
        if (this.queryingFor == posTxt) return Promise.resolve()

        this.queryingFor = posTxt
        let editor = this.props.parent.editor
        let str = editor.session.getValue()
        let lines = pos.row
        let chars = pos.column
        let i = 0;
        for (; i < str.length; ++i) {
            if (lines == 0) {
                if (chars-- == 0)
                    break;
            } else if (str[i] == '\n') lines--;
        }

        let cache: CompletionCache = {
            apisInfo: null,
            completionInfo: null,
            posTxt: posTxt,
        }

        return compiler.workerOpAsync("getCompletions", {
            fileName: this.props.parent.currFile.getTypeScriptName(),
            fileContent: str,
            position: i
        })
            .then(compl => {
                cache.completionInfo = compl;
                console.log(compl)
            })
            .then(() => compiler.getApisInfoAsync())
            .then(info => { cache.apisInfo = info })
            .then(() => this.setState({ cache: cache }))
    }

    fetchCompletionInfo(textPos: AceAjax.Position) {
        let posTxt = this.props.parent.currFile.getName() + ":" + textPos.row + ":" + textPos.column
        let cache = this.state.cache
        if (!cache || cache.posTxt != posTxt) {
            this.queryCompletionAsync(textPos, posTxt).done();
            return null;
        }

        return cache.completionInfo.entries;
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
        editor.session.replace(this.completionRange, e.name);
        this.detach()
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
        let pref = line.slice(0, textPos.column)
        let m = /(\w*)$/.exec(pref)
        pref = m ? m[1].toLowerCase() : ""

        textPos.column -= pref.length

        let pos = renderer.$cursorLayer.getPixelPosition(textPos, false);
        pos.top -= renderer.scrollTop;
        pos.left -= renderer.scrollLeft;
        pos.top += renderer.layerConfig.lineHeight;
        pos.left += renderer.gutterWidth;

        let info = this.fetchCompletionInfo(textPos);

        if (!info) return null; // or Loading... ?

        info = info.filter(e => Util.startsWith(e.name.toLowerCase(), pref))
        this.entries = info;

        this.completionRange = new Range(textPos.row, textPos.column, textPos.row, textPos.column + pref.length);
        let idx = this.selectedIndex();

        return (
            <div className='ui vertical menu completer' style={{ left: pos.left + "px", top: pos.top + "px" }}>
                {info.map((e, i) =>
                    <sui.Item class={'link ' + (i == idx ? "active" : "") }
                        key={e.name} text={e.name + " " + e.kind} value={e.name}
                        onClick={() => this.commit(e) }
                        />
                ) }
            </div>
        )
    }
}

export class Editor extends srceditor.Editor {
    editor: AceAjax.Editor;
    currFile: pkg.File;
    completer: AceCompleter;
    isTypescript = false;

    menu() {
        return (
            <div className="item">
                <sui.DropdownMenu class="button floating" text={lf("Edit") } icon="edit">
                    <sui.Item icon="find" text={lf("Find") } onClick={() => this.editor.execCommand("find") } />
                    <sui.Item icon="wizard" text={lf("Replace") } onClick={() => this.editor.execCommand("replace") } />
                    <sui.Item icon="help circle" text={lf("Keyboard shortcuts") } onClick={() => this.editor.execCommand("showKeyboardShortcuts") } />
                </sui.DropdownMenu>
            </div>
        )
    }

    display() {
        return (
            <div>
                <div className='full-abs' id='aceEditorInner' />
                <AceCompleter parent={this} />
            </div>
        )
    }

    prepare() {
        this.editor = ace.edit("aceEditorInner");
        let langTools = acequire("ace/ext/language_tools");

        this.editor.commands.on("exec", (e: any) => {
            console.info("beforeExec", e.command.name)
        });

        let approvedCommands = {
            insertstring: 1,
            backspace: 1,
            Down: 1,
            Up: 1,
        }

        this.editor.commands.on("afterExec", (e: any) => {
            console.info("afterExec", e.command.name)
            if (this.isTypescript) {
                if (this.completer.activated) {
                    if (e.command.name == "insertstring" && !/^[\w]$/.test(e.args)) {
                        this.completer.detach();
                    } else if (!approvedCommands.hasOwnProperty(e.command.name)) {
                        this.completer.detach();
                    } else {
                        this.completer.forceUpdate();
                    }
                } else {
                    if (e.command.name == "insertstring" && /^[a-zA-Z\.]$/.test(e.args)) {
                        this.completer.showPopup();
                    }
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

        let sess = this.editor.getSession()
        sess.setNewLineMode("unix");
        sess.setTabSize(4);
        sess.setUseSoftTabs(true);
        this.editor.$blockScrolling = Infinity;

        sess.on("change", () => {
            if (this.lastSet != null) {
                this.lastSet = null
            } else {
                this.changeCallback();
            }
        })

        this.isReady = true
    }

    getId() {
        return "aceEditor"
    }

    setTheme(theme: srceditor.Theme) {
        let th = theme.inverted ? 'ace/theme/tomorrow_night_bright' : 'ace/theme/sqlserver'
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
        this.editor.setValue(v, -1)
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
        this.setDiagnostics(file)
    }

    setDiagnostics(file: pkg.File) {
        let sess = this.editor.getSession();
        Object.keys(sess.getMarkers(true) || {}).forEach(m => sess.removeMarker(parseInt(m)))
        sess.clearAnnotations()
        let ann: AceAjax.Annotation[] = []
        if (file.diagnostics)
            for (let diagnostic of file.diagnostics) {
                const p0 = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
                const p1 = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start + diagnostic.length)
                ann.push({
                    row: p0.line,
                    column: p0.character,
                    text: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
                    type: "error"
                })
                sess.addMarker(new Range(p0.line, p0.character, p1.line, p1.character),
                    "ace_error-marker", "ts-error", true)
            }
        sess.setAnnotations(ann)
    }

    setViewState(pos: AceAjax.Position) {
        this.editor.moveCursorToPosition(pos)
        this.editor.scrollToLine(pos.row - 1, true, false, () => { })
    }
}
