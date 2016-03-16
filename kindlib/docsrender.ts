/// <reference path='../typings/marked/marked.d.ts' />
/// <reference path="emitter/util.ts"/>

namespace ks.docs {    
    declare var require:any;
    var marked:MarkedStatic;
    

    var boxes: U.Map<string> = {
        hide: "<div style='display:none'>@BODY@</div>",
        avatar: `
<div class='avatar @ARGS@'>
  <div class='avatar-image'></div>
  <div class='ui message'>
    @BODY@
  </div>
</div>`,
        hint: `
<div class="ui icon green message">
  <i class="help checkmark icon"></i>
  <div class="content">
    <div class="header">Hint</div>
    @BODY@
  </div>
</div>`,
        column: `
<!-- COLUMN -->
<div class='column'>
  @BODY@
</div>
<!-- ENDCOLUMN -->
`,
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

    export function renderMarkdown(src: string): U.Map<string> {
        let res: U.Map<string> = {}
        
        if (!marked)
            marked = require("marked");

        let html = marked(src, {
            sanitize: true,
            smartypants: true,
        })

        let endBox = ""

        let error = (s: string) =>
            `<div class='ui negative message'>${s}</div>`
        html = html.replace(/<h\d[^>]+>\s*([~@])\s*(.*?)<\/h\d>/g, (f, tp, body) => {
            let m = /^(\w+)\s+(.*)/.exec(body)
            let cmd = m ? m[1] : body
            let args = m ? m[2] : ""
            let rawArgs = args
            args = htmlQuote(args)
            cmd = htmlQuote(cmd)
            if (tp == "@") {
                if (cmd == "parent" || cmd == "short") {
                    res[cmd] = args
                    return ""
                } else if (cmd == "video") {
                    return `<div class="ui embed" 
                            data-url="https://www.microbit.co.uk/embed/${args}" 
                            data-placeholder="https://www.microbit.co.uk/${args}/thumb" 
                            data-icon="video play">
                        </div>`
                } else if (cmd == "section") {
                    return `<!-- section ${args} -->`
                } else {
                    return error(`Unknown command: @${cmd}`)
                }
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

        let columns = ""
        html = html.replace(/<!-- COLUMN -->[^]*?<!-- ENDCOLUMN -->/g, f => {
            columns += f
            return "<!-- col -->"
        })

        html = `<div class="ui text container">${html}</div>\n`

        if (columns)
            html += `
            <div class="ui three column stackable grid text container">
                ${columns}
            </div>`

        res["body"] = html
        return res
    }

    export function injectHtml(template: string, vars: U.Map<string>) {
        return template.replace(/@(\w+)@/g, (f, key) => {
            let result1 = U.lookup(vars, key) || "";
            if (! /^(body)$/.test(key)) {
                result1 = htmlQuote(result1);
            }
            return result1;
        });
    }
}