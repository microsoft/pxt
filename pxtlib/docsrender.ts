/// <reference path='../typings/marked/marked.d.ts' />
/// <reference path="emitter/util.ts"/>

namespace pxt {
    export interface AppTheme {
        id?: string;
        name?: string;
        title?: string;
        logoUrl?: string;
        logo?: string;
        portraitLogo?: string;
        rightLogo?: string;
        docsLogo?: string;
        organizationLogo?: string;
        homeUrl?: string;
        embedUrl?: string;
        docMenu?: DocMenuEntry[];
        sideDoc?: string;
        boardName?: string;
        privacyUrl?: string;
        termsOfUseUrl?: string;
        contactUrl?: string;
        accentColor?: string;
        locales?: ts.pxt.Util.Map<AppTheme>;
        cardLogo?: string;
        appLogo?: string;
        htmlDocIncludes?: ts.pxt.Util.Map<string>;
    }

    export interface DocMenuEntry {
        name: string;
        // needs to have one of `path` or `subitems` 
        path?: string;
        subitems?: DocMenuEntry[];
    }
}

namespace pxt.docs {
    declare var require: any;
    let marked: MarkedStatic;
    import U = ts.pxt.Util;

    let stdboxes: U.Map<string> = {
    }

    let stdmacros: U.Map<string> = {
    }

    const stdSetting = "<!-- @CMD@ @ARGS@ -->"

    let stdsettings: U.Map<string> = {
        "parent": stdSetting,
        "short": stdSetting,
        "description": "<!-- desc -->"
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

    // the input already should be HTML-quoted but we want to make sure, and also quote quotes
    export function html2Quote(s: string) {
        return htmlQuote(s.replace(/\&([#a-z0-9A-Z]+);/g, (f, ent) => {
            switch (ent) {
                case "amp": return "&";
                case "lt": return "<";
                case "gt": return ">";
                case "quot": return "\"";
                default:
                    if (ent[0] == "#")
                        return String.fromCharCode(parseInt(ent.slice(1)));
                    else return f
            }
        }))
    }

    interface CmdLink {
        rx: RegExp;
        cmd: string;
    }

    //The extra YouTube macros are in case there is a timestamp on the YouTube URL.
    //TODO: Add equivalent support for youtu.be links
    let links: CmdLink[] = [
        {
            rx: /^vimeo\.com\/(\d+)/,
            cmd: "### @vimeo $1"
        },
        {
            rx: /^(www\.youtube\.com\/watch\?v=|youtu.be\/)(\w+(\#t=([0-9]+m[0-9]+s|[0-9]+m|[0-9]+s))?)/,
            cmd: "### @youtube $2"
        }
    ]

    export interface BreadcrumbEntry {
        name: string;
        href: string;
    }

    export var requireMarked = () => require("marked");

    export function renderMarkdown(template: string, src: string, theme: AppTheme = {}, pubinfo: U.Map<string> = null, breadcrumb: BreadcrumbEntry[] = []): string {
        let params: U.Map<string> = pubinfo || {}

        let boxes = U.clone(stdboxes)
        let macros = U.clone(stdmacros)
        let settings = U.clone(stdsettings)
        let menus: U.Map<string> = {}

        function parseHtmlAttrs(s: string) {
            let attrs: U.Map<string> = {};
            while (s.trim()) {
                let m = /\s*([^=\s]+)=("([^"]*)"|'([^']*)'|(\S*))/.exec(s)
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
            `<div class='ui negative message'>${htmlQuote(s)}</div>`

        template = template
            .replace(/<!--\s*@include\s+(\S+)\s*-->/g,
            (full, fn) => {
                let cont = (theme.htmlDocIncludes || {})[fn] || ""
                return "<!-- include " + fn + " -->\n" + cont + "\n<!-- end include -->\n"
            })

        template = template.replace(/<aside\s+([^<>]+)>([^]*?)<\/aside>/g, (full, attrsStr, body) => {
            let attrs = parseHtmlAttrs(attrsStr)
            let name = attrs["data-name"] || attrs["id"]
            console.log(`Compiling box ${name}`);
            if (!name)
                return error("id or data-name missing on macro")
            if (/box/.test(attrs["class"])) {
                boxes[name] = body
            } else if (/aside/.test(attrs["class"])) {
                boxes[name] = `<!-- BEGIN-ASIDE ${name} -->${body}<!-- END-ASIDE -->`
            } else if (/setting/.test(attrs["class"])) {
                settings[name] = body
            } else if (/menu/.test(attrs["class"])) {
                menus[name] = body
            } else {
                macros[name] = body
            }
            return `<!-- macro ${name} -->`
        })

        if (!marked) {
            marked = requireMarked();
            let renderer = new marked.Renderer()
            renderer.image = function (href: string, title: string, text: string) {
                let out = '<img class="ui image" src="' + href + '" alt="' + text + '"';
                if (title) {
                    out += ' title="' + title + '"';
                }
                out += this.options.xhtml ? '/>' : '>';
                return out;
            }
            marked.setOptions({
                renderer: renderer,
                gfm: true,
                tables: true,
                breaks: false,
                pedantic: false,
                sanitize: true,
                smartLists: true,
                smartypants: true,
                highlight: function(code, lang) {
                    return require('highlight.js').highlightAuto(code, [lang]).value;
                }
            })
        };

        //Uses the CmdLink definitions to replace links to YouTube and Vimeo (limited at the moment)
        src = src.replace(/^\s*https?:\/\/(\S+)\s*$/mg, (f, lnk) => {
            for (let ent of links) {
                let m = ent.rx.exec(lnk)
                if (m) {
                    return ent.cmd.replace(/\$(\d+)/g, (f, k) => {
                        return m[parseInt(k)] || ""
                    }) + "\n"
                }
            }
            return f
        })

        let html = marked(src)

        // support for breaks which somehow don't work out of the box
        html = html.replace(/&lt;br\s*\/&gt;/ig, "<br/>");

        let endBox = ""

        html = html.replace(/<h\d[^>]+>\s*([~@])\s*(.*?)<\/h\d>/g, (f, tp, body) => {
            let m = /^(\w+)\s+(.*)/.exec(body)
            let cmd = m ? m[1] : body
            let args = m ? m[2] : ""
            let rawArgs = args
            args = html2Quote(args)
            cmd = html2Quote(cmd)
            if (tp == "@") {
                let expansion = U.lookup(settings, cmd)
                if (expansion != null) {
                    params[cmd] = args
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

        if (!params["title"]) {
            let titleM = /<h1[^<>]*>([^<>]+)<\/h1>/.exec(html)
            if (titleM)
                params["title"] = html2Quote(titleM[1])
        }

        if (!params["description"]) {
            let descM = /<p>(.+?)<\/p>/.exec(html)
            if (descM)
                params["description"] = html2Quote(descM[1])
        }

        let breadcrumbHtml = '';
        if (breadcrumb && breadcrumb.length > 1) {
            breadcrumbHtml = `
            <div class="ui breadcrumb">
                ${breadcrumb.map((b, i) =>
                    `<a class="${i == breadcrumb.length - 1 ? "active" : ""} section" 
                        href="${html2Quote(b.href)}">${html2Quote(b.name)}</a>`)
                    .join('<i class="right chevron icon divider"></i>')}
            </div>`;
        }

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

        let recMenu = (m: DocMenuEntry, lev: number) => {
            let templ = menus["item"]
            let mparams: U.Map<string> = {
                NAME: m.name,
            }
            if (m.subitems) {
                if (lev == 0) templ = menus["top-dropdown"]
                else templ = menus["inner-dropdown"]
                mparams["ITEMS"] = m.subitems.map(e => recMenu(e, lev + 1)).join("\n")
            } else {
                if (/^-+$/.test(m.name)) {
                    templ = menus["divider"]
                }
                if (m.path && !/^(https?:|\/)/.test(m.path))
                    return error("Invalid link: " + m.path)
                mparams["LINK"] = m.path
            }
            return injectHtml(templ, mparams, ["ITEMS"])
        }

        params["body"] = html
        params["menu"] = (theme.docMenu || []).map(e => recMenu(e, 0)).join("\n")
        params["breadcrumb"] = breadcrumbHtml;
        params["targetname"] = theme.name || "PXT"
        params["targetlogo"] = theme.docsLogo ? `<img class="ui mini image" src="${U.toDataUri(theme.docsLogo)}" />` : ""
        params["name"] = params["title"] + " - " + params["targetname"]

        let style = '';
        if (theme.accentColor) style += `
.ui.accent { color: ${theme.accentColor}; }
.ui.inverted.accent { background: ${theme.accentColor}; }
`
        params["targetstyle"] = style;

        return injectHtml(template, params, ["body", "menu", "breadcrumb", "targetlogo"])
    }

    function injectHtml(template: string, vars: U.Map<string>, quoted: string[] = []) {
        if (!template) return '';

        return template.replace(/@(\w+)@/g, (f, key) => {
            let res = U.lookup(vars, key) || "";
            res += ""; // make sure it's a string
            if (quoted.indexOf(key) < 0) {
                res = html2Quote(res);
            }
            return res;
        });
    }
}
