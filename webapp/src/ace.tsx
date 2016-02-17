import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as compiler from "./compiler"
import * as sui from "./sui";

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

export class Editor extends srceditor.Editor {
    editor: AceAjax.Editor;
    currFile: pkg.File;

    menu() {
        return (
            <sui.Dropdown class="button floating" icon="edit" menu={true} popup={lf("Text editor operations")}>
                <sui.Item icon="find" text={lf("Find") } onClick={() => this.editor.execCommand("find") } />
                <sui.Item icon="wizard" text={lf("Replace") } onClick={() => this.editor.execCommand("replace") } />
                <sui.Item icon="help" text={lf("Keyboard shortcuts") } onClick={() => this.editor.execCommand("showKeyboardShortcuts") } />
            </sui.Dropdown>
        )
    }

    prepare() {
        this.editor = ace.edit("aceEditor")

        let langTools = acequire("ace/ext/language_tools");

        let tsCompleter = {
            getCompletions: (editor: AceAjax.Editor, session: AceAjax.IEditSession, pos: AceAjax.Position, prefix: string, callback: any) => {
                let mode = session.getMode();
                if ((mode as any).$id == "ace/mode/typescript") {
                    let str = session.getValue()
                    let lines = pos.row
                    let chars = pos.column
                    let i = 0;
                    for (; i < str.length; ++i) {
                        if (lines == 0) {
                            if (chars-- == 0)
                                break;
                        } else if (str[i] == '\n') lines--;
                    }

                    compiler.workerOpAsync("getCompletions", {
                        fileName: this.currFile.getTypeScriptName(),
                        fileContent: str,
                        position: i
                    }).done((compl: ts.CompletionInfo) => {
                        let entries = compl.entries.map(e => {
                            return {
                                name: e.name,
                                value: e.name,
                                meta: e.kind
                            }
                        })
                        console.log(prefix, entries.length, compl.entries.length)
                        callback(null, entries)
                    })
                } else {
                    langTools.textCompleter(editor, session, pos, prefix, callback)
                }
            }
        }

        langTools.setCompleters([tsCompleter, langTools.keyWordCompleter]);

        this.editor.setOptions({
            enableBasicAutocompletion: true,
            // enableSnippets: true,
            enableLiveAutocompletion: true
        });


        (this.editor.commands as any).on("afterExec", function(e: any) {
            if (e.command.name == "insertstring" && e.args == ".") {
                //var all = e.editor.completers;
                //e.editor.completers = [completers];
                e.editor.execCommand("startAutocomplete");
                //e.editor.completers = all;
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
        this.editor.setReadOnly(file.isReadonly())
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
