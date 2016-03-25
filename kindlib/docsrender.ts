/// <reference path='../typings/marked/marked.d.ts' />
/// <reference path="emitter/util.ts"/>

namespace ks.docs {
    declare var require: any;
    var marked: MarkedStatic;


    var stdboxes: U.Map<string> = {
    }

    var stdmacros: U.Map<string> = {
    }
    
    var stdSetting = "<!-- @CMD@ @ARGS@ -->"

    var stdsettings: U.Map<string> = {
        "parent": stdSetting,
        "short": stdSetting,
    }

    function replaceAll(replIn: string, x: string, y: string) {
        return replIn.split(x).join(y)
    }

    export function htmlQuote(s: string): string {
        s = replaceAll(s, "&", "&amp;")
        s = replaceAll(s, "<", "&lt;")
        s = replaceAll(s, ">", "&gt;")
        s = replaceAll(s, "\"", "&quot;")
        s = replaceAll(s, "\'", "&#39;")
        return s;
    }

    export function renderMarkdown(template: string, src: string): string {
        let vars: U.Map<string> = {}

        let boxes = U.clone(stdboxes)
        let macros = U.clone(stdmacros)
        let settings = U.clone(stdsettings)

        function parseHtmlAttrs(s: string) {
            let attrs: U.Map<string> = {};
            while (s.trim()) {
                let m = /^\s*([^=\s]+)=("([^"]*)"|'([^']*)'|(\S*))/.exec(s)
                if (m) {
                    let v = m[3] || m[4] || m[5] || ""
                    attrs[m[1].toLowerCase()] = v
                } else {
                    m = /^\s*(\S+)/.exec(s)
                    attrs[m[1]] = "true"
                }
                s = s.slice(m[0].length)
            }
            return attrs
        }

        let error = (s: string) =>
            `<div class='ui negative message'>${s}</div>`

        template = template.replace(/<aside\s+([^<>]+)>([^]*?)<\/aside>/g, (full, attrsStr, body) => {
            let attrs = parseHtmlAttrs(attrsStr)
            let name = attrs["data-name"] || attrs["id"]
            if (!name)
                return error("id or data-name missing on macro")
            if (/box/.test(attrs["class"])) {
                boxes[name] = body
            } else if (/aside/.test(attrs["class"])) {
                boxes[name] = `<!-- BEGIN-ASIDE ${name} -->${body}<!-- END-ASIDE -->`
            } else if (/setting/.test(attrs["class"])) {
                settings[name] = body
            } else {
                macros[name] = body
            }
            return `<!-- macro ${name} -->`
        })

        if (!marked)
            marked = require("marked");

        let html = marked(src, {
            sanitize: true,
            smartypants: true,
        })

        let endBox = ""

        html = html.replace(/<h\d[^>]+>\s*([~@])\s*(.*?)<\/h\d>/g, (f, tp, body) => {
            let m = /^(\w+)\s+(.*)/.exec(body)
            let cmd = m ? m[1] : body
            let args = m ? m[2] : ""
            let rawArgs = args
            args = htmlQuote(args)
            cmd = htmlQuote(cmd)
            if (tp == "@") {
                let expansion = U.lookup(settings, cmd)
                if (expansion != null) {
                    vars[cmd] = args
                } else {
                    expansion = U.lookup(macros, cmd)
                    if (expansion == null)
                        return error(`Unknown command: @${cmd}`)
                }

                let ivars: U.Map<string> = {
                    ARGS: args,
                    CMD: cmd
                }

                return injectHtml(expansion, ivars, ["ARGS", "CMD"])
            } else {
                if (!cmd) {
                    let r = endBox
                    endBox = ""
                    return r
                }

                let box = U.lookup(boxes, cmd)
                if (box) {
                    let parts = box.split("@BODY@")
                    endBox = parts[1]
                    return parts[0].replace("@ARGS@", args)
                } else {
                    return error(`Unknown box: ~${cmd}`)
                }
            }
        })

        let registers: U.Map<string> = {}
        registers["main"] = "" // first
        
        html = html.replace(/<!-- BEGIN-ASIDE (\S+) -->([^]*?)<!-- END-ASIDE -->/g, (f, nam, cont) => {
            let s = U.lookup(registers, nam)
            registers[nam] = (s || "") + cont
            return "<!-- aside -->"
        })
        
        registers["main"] = html

        let injectBody = (tmpl: string, body: string) =>
            injectHtml(boxes[tmpl] || "@BODY@", { BODY: body }, ["BODY"])

        html = ""

        for (let k of Object.keys(registers)) {
            html += injectBody(k + "-container", registers[k])
        }

        vars["body"] = html

        return injectHtml(template, vars, ["body"])
    }

    function injectHtml(template: string, vars: U.Map<string>, quoted: string[] = []) {
        return template.replace(/@(\w+)@/g, (f, key) => {
            let res = U.lookup(vars, key) || "";
            if (quoted.indexOf(key) < 0) {
                res = htmlQuote(res);
            }
            return res;
        });
    }
}