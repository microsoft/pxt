/// <reference path='../localtypings/pxtarget.d.ts' />
/// <reference path="commonutil.ts"/>

namespace pxt.docs {
    declare var require: any;
    import U = pxtc.Util;

    let markedInstance: typeof marked;

    let stdboxes: Map<string> = {
    }

    let stdmacros: Map<string> = {
    }

    const stdSetting = "<!-- @CMD@ @ARGS@ -->"

    let stdsettings: Map<string> = {
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
        if (!s) return s;
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
    const links: CmdLink[] = [
        {
            rx: /^vimeo\.com\/(\d+)/i,
            cmd: "### @vimeo $1"
        },
        {
            rx: /^(www\.youtube\.com\/watch\?v=|youtu\.be\/)([\w\-]+(\#t=([0-9]+m[0-9]+s|[0-9]+m|[0-9]+s))?)/i,
            cmd: "### @youtube $2"
        }
    ]

    export interface BreadcrumbEntry {
        name: string;
        href: string;
    }

    export let requireMarked = () => {
        if (typeof marked !== "undefined") return marked;
        if (typeof require === "undefined") return undefined;
        return require("marked") as typeof marked;
    }

    export interface RenderData {
        html: string;
        theme: AppTheme;
        params: Map<string>;
        filepath?: string;
        versionPath?: string;
        ghEditURLs?: string[];

        finish?: () => string;
        boxes?: Map<string>;
        macros?: Map<string>;
        settings?: Map<string>;
        TOC?: TOCMenuEntry[];
    }

    function parseHtmlAttrs(s: string) {
        let attrs: Map<string> = {};
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

    const error = (s: string) =>
        `<div class='ui negative message'>${htmlQuote(s)}</div>`

    export function prepTemplate(d: RenderData) {
        let boxes = U.clone(stdboxes)
        let macros = U.clone(stdmacros)
        let settings = U.clone(stdsettings)
        let menus: Map<string> = {}
        let toc: Map<string> = {}
        let params = d.params
        let theme = d.theme

        d.boxes = boxes
        d.macros = macros
        d.settings = settings

        d.html = d.html.replace(/<aside\s+([^<>]+)>([^]*?)<\/aside>/g, (full, attrsStr, body) => {
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
            } else if (/menu/.test(attrs["class"])) {
                menus[name] = body
            } else if (/toc/.test(attrs["class"])) {
                toc[name] = body
            } else {
                macros[name] = body
            }
            return `<!-- macro ${name} -->`
        })

        let recMenu = (m: DocMenuEntry, lev: number) => {
            let templ = menus["item"]
            let mparams: Map<string> = {
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

        let breadcrumb: BreadcrumbEntry[] = [{
            name: lf("Docs"),
            href: "/docs"
        }]

        const TOC = d.TOC || theme.TOC || [];
        let tocPath: TOCMenuEntry[] = []
        let isCurrentTOC = (m: TOCMenuEntry) => {
            for (let c of m.subitems || []) {
                if (isCurrentTOC(c)) {
                    tocPath.push(m)
                    return true
                }
            }
            if (d.filepath && d.filepath.indexOf(m.path) == 0) {
                tocPath.push(m)
                return true
            }
            return false
        };
        TOC.forEach(isCurrentTOC)

        let currentTocEntry: TOCMenuEntry;
        let recTOC = (m: TOCMenuEntry, lev: number) => {
            let templ = toc["item"]
            let mparams: Map<string> = {
                NAME: m.name,
            }
            if (m.path && !/^(https?:|\/)/.test(m.path))
                return error("Invalid link: " + m.path)
            if (/^\//.test(m.path) && d.versionPath) m.path = `/${d.versionPath}${m.path}`;
            mparams["LINK"] = m.path
            if (tocPath.indexOf(m) >= 0) {
                mparams["ACTIVE"] = 'active';
                mparams["EXPANDED"] = 'true';
                currentTocEntry = m;
                breadcrumb.push({
                    name: m.name,
                    href: m.path
                })
            } else {
                mparams["EXPANDED"] = 'false';
            }
            if (m.subitems && m.subitems.length > 0) {
                if (lev == 0) {
                    if (m.name !== "") {
                        templ = toc["top-dropdown"]
                    } else {
                        templ = toc["top-dropdown-noHeading"]
                    }
                } else if (lev == 1) templ = toc["inner-dropdown"]
                else templ = toc["nested-dropdown"]
                mparams["ITEMS"] = m.subitems.map(e => recTOC(e, lev + 1)).join("\n")
            } else {
                if (/^-+$/.test(m.name)) {
                    templ = toc["divider"]
                }
            }
            return injectHtml(templ, mparams, ["ITEMS"])
        }

        params["menu"] = (theme.docMenu || []).map(e => recMenu(e, 0)).join("\n")
        params["TOC"] = TOC.map(e => recTOC(e, 0)).join("\n")

        if (theme.appStoreID)
            params["appstoremeta"] = `<meta name="apple-itunes-app" content="app-id=${U.htmlEscape(theme.appStoreID)}"/>`

        let breadcrumbHtml = '';
        if (breadcrumb.length > 1) {
            breadcrumbHtml = `
            <nav class="ui breadcrumb" aria-label="${lf("Breadcrumb")}">
                ${breadcrumb.map((b, i) =>
                `<a class="${i == breadcrumb.length - 1 ? "active" : ""} section"
                        href="${html2Quote(b.href)}" aria-current="${i == breadcrumb.length - 1 ? "page" : ""}">${html2Quote(b.name)}</a>`)
                    .join('<i class="right chevron icon divider"></i>')}
            </nav>`;
        }

        params["breadcrumb"] = breadcrumbHtml;

        if (theme.boardName)
            params["boardname"] = html2Quote(theme.boardName);
        if (theme.boardNickname)
            params["boardnickname"] = html2Quote(theme.boardNickname);
        if (theme.driveDisplayName)
            params["drivename"] = html2Quote(theme.driveDisplayName);
        if (theme.homeUrl)
            params["homeurl"] = html2Quote(theme.homeUrl);
        params["targetid"] = theme.id || "???";
        params["targetname"] = theme.name || "Microsoft MakeCode";
        params["targetlogo"] = theme.docsLogo ? `<img aria-hidden="true" role="presentation" class="ui ${theme.logoWide ? "small" : "mini"} image" src="${theme.docsLogo}" />` : ""
        let ghURLs = d.ghEditURLs || []
        if (ghURLs.length) {
            let ghText = `<p style="margin-top:1em">\n`
            let linkLabel = lf("Edit this page on GitHub")
            for (let u of ghURLs) {
                ghText += `<a href="${u}"><i class="write icon"></i>${linkLabel}</a><br>\n`;
                linkLabel = lf("Edit template of this page on GitHub")
            }
            ghText += `</p>\n`
            params["github"] = ghText
        } else {
            params["github"] = "";
        }

        // Add accessiblity menu
        const accMenuHtml = `
            <a href="#maincontent" class="ui item link" tabindex="0" role="menuitem">${lf("Skip to main content")}</a>
        `
        params['accMenu'] = accMenuHtml;

        // Add print button
        const printBtnHtml = `
            <button id="printbtn" class="circular ui icon right floated button hideprint" title="${lf("Print this page")}">
                <i class="icon print"></i>
            </button>
        `
        params['printBtn'] = printBtnHtml;

        // Add sidebar toggle
        const sidebarToggleHtml = `
            <a id="togglesidebar" class="launch icon item" tabindex="0" title="Side menu" aria-label="${lf("Side menu")}" role="menu" aria-expanded="false">
                <i class="content icon"></i>
            </a>
        `
        params['sidebarToggle'] = sidebarToggleHtml;

        // Add search bars
        const searchBarIds = ['tocsearch1', 'tocsearch2']
        const searchBarsHtml = searchBarIds.map((searchBarId) => {
            return `
                <input type="search" name="q" placeholder="${lf("Search...")}" aria-label="${lf("Search Documentation")}">
                <i onclick="document.getElementById('${searchBarId}').submit();" tabindex="0" class="search link icon" aria-label="${lf("Search")}" role="button"></i>
            `;
        })
        params["searchBar1"] = searchBarsHtml[0];
        params["searchBar2"] = searchBarsHtml[1];

        let style = '';
        if (theme.accentColor) style += `
.ui.accent { color: ${theme.accentColor}; }
.ui.inverted.accent { background: ${theme.accentColor}; }
`
        params["targetstyle"] = style;
        params["tocclass"] = theme.lightToc ? "lighttoc" : "inverted";

        for (let k of Object.keys(theme)) {
            let v = (theme as any)[k]
            if (params[k] === undefined && typeof v == "string")
                params[k] = v
        }

        d.finish = () => injectHtml(d.html, params, [
            "body",
            "menu",
            "accMenu",
            "TOC",
            "prev",
            "next",
            "printBtn",
            "breadcrumb",
            "targetlogo",
            "github",
            "JSON",
            "appstoremeta",
            "sidebarToggle",
            "searchBar1",
            "searchBar2"
        ])

        // Normalize any path URL with any version path in the current URL
        function normalizeUrl(href: string) {
            if (!href) return href;
            const relative = href.indexOf('/') == 0;
            if (relative && d.versionPath) href = `/${d.versionPath}${href}`;
            return href;
        }
    }

    export interface RenderOptions {
        template: string;
        markdown: string;
        theme?: AppTheme;
        pubinfo?: Map<string>;
        filepath?: string;
        versionPath?: string;
        locale?: Map<string>;
        ghEditURLs?: string[];
        repo?: { name: string; fullName: string; tag?: string };
        throwOnError?: boolean; // check for missing macros
        TOC?: TOCMenuEntry[]; // TOC parsed here
    }

    export function setupRenderer(renderer: marked.Renderer) {
        renderer.image = function (href: string, title: string, text: string) {
            let out = '<img class="ui centered image" src="' + href + '" alt="' + text + '"';
            if (title) {
                out += ' title="' + title + '"';
            }
            out += (this as any).options.xhtml ? '/>' : '>';
            return out;
        }
        renderer.listitem = function (text: string): string {
            const m = /^\s*\[( |x)\]/i.exec(text);
            if (m) return `<li class="${m[1] == ' ' ? 'unchecked' : 'checked'}">` + text.slice(m[0].length) + '</li>\n'
            return '<li>' + text + '</li>\n';
        }
        renderer.heading = function (text: string, level: number, raw: string) {
            let m = /(.*)#([\w\-]+)\s*$/.exec(text)
            let id = ""
            if (m) {
                text = m[1]
                id = m[2]
            } else {
                id = raw.toLowerCase().replace(/[^\w]+/g, '-')
            }
            // remove tutorial macros
            if (text)
                text = text.replace(/@(fullscreen|unplugged)/g, '');
            return `<h${level} id="${(this as any).options.headerPrefix}${id}">${text}</h${level}>`
        }
    }

    export function renderMarkdown(opts: RenderOptions): string {
        let hasPubInfo = true

        if (!opts.pubinfo) {
            hasPubInfo = false
            opts.pubinfo = {}
        }

        let pubinfo = opts.pubinfo

        if (!opts.theme) opts.theme = {}

        delete opts.pubinfo["private"] // just in case

        if (pubinfo["time"]) {
            let tm = parseInt(pubinfo["time"])
            if (!pubinfo["timems"])
                pubinfo["timems"] = 1000 * tm + ""
            if (!pubinfo["humantime"])
                pubinfo["humantime"] = U.isoTime(tm)
        }
        if (pubinfo["name"]) {
            pubinfo["dirname"] = pubinfo["name"].replace(/[^A-Za-z0-9_]/g, "-")
            pubinfo["title"] = pubinfo["name"]
        }

        if (hasPubInfo) {
            pubinfo["JSON"] = JSON.stringify(pubinfo, null, 4).replace(/</g, "\\u003c")
        }

        let template = opts.template
        template = template
            .replace(/<!--\s*@include\s+(\S+)\s*-->/g,
                (full, fn) => {
                    let cont = (opts.theme.htmlDocIncludes || {})[fn] || ""
                    return "<!-- include " + fn + " -->\n" + cont + "\n<!-- end include -->\n"
                })

        template = template
            .replace(/<!--\s*@(ifn?def)\s+(\w+)\s*-->([^]*?)<!--\s*@endif\s*-->/g,
                (full, cond, sym, inner) => {
                    if ((cond == "ifdef" && pubinfo[sym]) || (cond == "ifndef" && !pubinfo[sym]))
                        return `<!-- ${cond} ${sym} -->${inner}<!-- endif -->`
                    else
                        return `<!-- ${cond} ${sym} endif -->`
                })

        if (opts.locale)
            template = translate(template, opts.locale).text

        let d: RenderData = {
            html: template,
            theme: opts.theme,
            filepath: opts.filepath,
            versionPath: opts.versionPath,
            ghEditURLs: opts.ghEditURLs,
            params: pubinfo,
            TOC: opts.TOC
        }
        prepTemplate(d)

        if (!markedInstance) {
            markedInstance = requireMarked();
        }

        // We have to re-create the renderer every time to avoid the link() function's closure capturing the opts
        let renderer = new markedInstance.Renderer()
        setupRenderer(renderer);
        const linkRenderer = renderer.link;
        renderer.link = function (href: string, title: string, text: string) {
            const relative = new RegExp('^[/#]').test(href);
            const target = !relative ? '_blank' : '';
            if (relative && d.versionPath) href = `/${d.versionPath}${href}`;
            const html = linkRenderer.call(renderer, href, title, text);
            return html.replace(/^<a /, `<a ${target ? `target="${target}"` : ''} rel="nofollow noopener" `);
        };
        markedInstance.setOptions({
            renderer: renderer,
            gfm: true,
            tables: true,
            breaks: false,
            pedantic: false,
            sanitize: true,
            smartLists: true,
            smartypants: true
        });

        let markdown = opts.markdown

        // append repo info if any
        if (opts.repo)
            markdown += `
\`\`\`package
${opts.repo.name.replace(/^pxt-/, '')}=github:${opts.repo.fullName}#${opts.repo.tag || "master"}
\`\`\`
`;

        //Uses the CmdLink definitions to replace links to YouTube and Vimeo (limited at the moment)
        markdown = markdown.replace(/^\s*https?:\/\/(\S+)\s*$/mg, (f, lnk) => {
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

        // replace pre-template in markdown
        markdown = markdown.replace(/@([a-z]+)@/ig, (m, param) => {
            let macro = pubinfo[param];
            if (!macro && opts.throwOnError)
                U.userError(`unknown macro ${param}`);
            return macro || 'unknown macro'
        });

        let html = markedInstance(markdown)

        // support for breaks which somehow don't work out of the box
        html = html.replace(/&lt;br\s*\/&gt;/ig, "<br/>");

        // github will render images if referenced as ![](/docs/static/foo.png)
        // we require /static/foo.png
        html = html.replace(/(<img [^>]* src=")\/docs\/static\/([^">]+)"/g,
            (f, pref, addr) => pref + '/static/' + addr + '"')

        let endBox = ""

        html = html.replace(/<h\d[^>]+>\s*([~@])\s*(.*?)<\/h\d>/g, (f, tp, body) => {
            let m = /^(\w+)\s+(.*)/.exec(body)
            let cmd = m ? m[1] : body
            let args = m ? m[2] : ""
            let rawArgs = args
            args = html2Quote(args)
            cmd = html2Quote(cmd)
            if (tp == "@") {
                let expansion = U.lookup(d.settings, cmd)
                if (expansion != null) {
                    pubinfo[cmd] = args
                } else {
                    expansion = U.lookup(d.macros, cmd)
                    if (expansion == null) {
                        if (opts.throwOnError)
                            U.userError(`Unknown command: @${cmd}`);
                        return error(`Unknown command: @${cmd}`)
                    }
                }

                let ivars: Map<string> = {
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

                let box = U.lookup(d.boxes, cmd)
                if (box) {
                    let parts = box.split("@BODY@")
                    endBox = parts[1]
                    return parts[0].replace("@ARGS@", args)
                } else {
                    if (opts.throwOnError)
                        U.userError(`Unknown box: ~ ${cmd}`);
                    return error(`Unknown box: ~ ${cmd}`)
                }
            }
        })

        if (!pubinfo["title"]) {
            let titleM = /<h1[^<>]*>([^<>]+)<\/h1>/.exec(html)
            if (titleM)
                pubinfo["title"] = html2Quote(titleM[1])
        }

        if (!pubinfo["description"]) {
            let descM = /<p>([^]+?)<\/p>/.exec(html)
            if (descM)
                pubinfo["description"] = html2Quote(descM[1])
        }

        // try getting a better custom image for twitter
        const imgM = /<div class="ui embed mdvid"[^<>]+?data-placeholder="([^"]+)"[^>]*\/?>/i.exec(html)
            || /<img class="ui [^"]*image" src="([^"]+)"[^>]*\/?>/i.exec(html);
        if (imgM)
            pubinfo["cardLogo"] = html2Quote(imgM[1]);

        pubinfo["twitter"] = html2Quote(opts.theme.twitter || "@msmakecode");

        let registers: Map<string> = {}
        registers["main"] = "" // first

        html = html.replace(/<!-- BEGIN-ASIDE (\S+) -->([^]*?)<!-- END-ASIDE -->/g, (f, nam, cont) => {
            let s = U.lookup(registers, nam)
            registers[nam] = (s || "") + cont
            return "<!-- aside -->"
        })

        // fix up spourious newlines at the end of code blocks
        html = html.replace(/\n<\/code>/g, "</code>")

        registers["main"] = html

        let injectBody = (tmpl: string, body: string) =>
            injectHtml(d.boxes[tmpl] || "@BODY@", { BODY: body }, ["BODY"])

        html = ""

        for (let k of Object.keys(registers)) {
            html += injectBody(k + "-container", registers[k])
        }

        pubinfo["body"] = html
        // don't mangle target name in title, it is already in the sitename
        pubinfo["name"] = pubinfo["title"] || ""

        for (let k of Object.keys(opts.theme)) {
            let v = (opts.theme as any)[k]
            if (typeof v == "string")
                pubinfo["theme_" + k] = v
        }

        return d.finish()
    }

    function injectHtml(template: string, vars: Map<string>, quoted: string[] = []) {
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

    export function embedUrl(rootUrl: string, tag: string, id: string, height?: number): string {
        const url = `${rootUrl}#${tag}:${id}`;
        let padding = '70%';
        return `<div style="position:relative;height:0;padding-bottom:${padding};overflow:hidden;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="${url}" frameborder="0" sandbox="allow-popups allow-forms allow-scripts allow-same-origin"></iframe></div>`;
    }

    export function runUrl(url: string, padding: string, id: string): string {
        let embed = `<div style="position:relative;height:0;padding-bottom:${padding};overflow:hidden;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="${url}?id=${encodeURIComponent(id)}" allowfullscreen="allowfullscreen" sandbox="allow-popups allow-forms allow-scripts allow-same-origin" frameborder="0"></iframe></div>`;
        return embed;
    }

    export function codeEmbedUrl(rootUrl: string, id: string, height?: number): string {
        const docurl = `${rootUrl}---codeembed#pub:${id}`;
        height = Math.ceil(height || 300);
        return `<div style="position:relative;height:calc(${height}px + 5em);width:100%;overflow:hidden;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="${docurl}" allowfullscreen="allowfullscreen" frameborder="0" sandbox="allow-scripts allow-same-origin"></iframe></div>`
    }

    const inlineTags: Map<number> = {
        b: 1,
        strong: 1,
        em: 1,
    }

    export function translate(html: string, locale: Map<string>): { text: string; missing: Map<string> } {
        const missing: Map<string> = {}

        function translateOne(toTranslate: string): string {
            let spm = /^(\s*)([^]*?)(\s*)$/.exec(toTranslate)
            let text = spm[2].replace(/\s+/g, " ");
            if (text == "" || /^((IE=edge,.*|width=device-width.*|(https?:\/\/|\/)[\w@\/\.]+|@[\-\w]+@|\{[^\{\}]+\}|[^a-zA-Z]*|(&nbsp;)+)\s*)+$/.test(text))
                return null;
            let v = U.lookup(locale, text)
            if (v)
                text = v;
            else
                missing[text] = "";
            return spm[1] + text + spm[3];
        }

        html = html.replace(/<([\/\w]+)([^<>]*)>/g, (full: string, tagname: string, args: string) => {
            let key = tagname.replace(/^\//, "").toLowerCase();
            if (inlineTags[key] === 1)
                return "&llt;" + tagname + args + "&ggt;";
            return full;
        });

        function ungt(s: string) {
            return s.replace(/&llt;/g, "<").replace(/&ggt;/g, ">");
        }

        html = "<start>" + html;
        html = html.replace(/(<([\/\w]+)([^<>]*)>)([^<>]+)/g,
            (full: string, fullTag: string, tagname: string, args: string, str: string) => {
                if (tagname == "script" || tagname == "style")
                    return ungt(full)

                let tr = translateOne(ungt(str));
                if (tr == null)
                    return ungt(full);
                return fullTag + tr;
            });

        html = html.replace(/(<[^<>]*)(content|placeholder|alt|title)="([^"]+)"/g,
            (full: string, pref: string, attr: string, text: string) => {
                let tr = translateOne(text);
                if (tr == null) return full;
                return pref + attr + '="' + text.replace(/"/g, "''") + '"';
            });

        html = html.replace(/^<start>/g, "");
        return {
            text: html,
            missing: missing
        }
    }

    interface Section {
        level: number;
        title: string;
        id: string;
        start: number;
        text: string;
        children: Section[];
    }

    function lookupSection(template: Section, id: string): Section {
        if (template.id == id) return template
        for (let ch of template.children) {
            let r = lookupSection(ch, id)
            if (r) return r
        }
        return null
    }

    function splitMdSections(md: string, template: Section) {
        let lineNo = 0
        let openSections: Section[] = [{
            level: 0,
            id: "",
            title: "",
            start: lineNo,
            text: "",
            children: []
        }]
        md = md.replace(/\r/g, "")
        let lines = md.split(/\n/)
        let skipThese: pxt.Map<boolean> = {}
        for (let l of lines) {
            let m = /^\s*(#+)\s*(.*?)(#(\S+)\s*)?$/.exec(l)
            let templSect: Section = null
            if (template && m) {
                if (!m[4]) m = null
                else if (skipThese[m[4]]) m = null
                else {
                    templSect = lookupSection(template, m[4])
                    let skip = (s: Section) => {
                        if (s.id) skipThese[s.id] = true
                        s.children.forEach(skip)
                    }
                    if (templSect) skip(templSect)
                }
            }
            if (m) {
                let level = template ? 1 : m[1].length
                let s: Section = {
                    level: level,
                    title: m[2].trim(),
                    id: m[4] || "",
                    start: lineNo,
                    text: "",
                    children: []
                }
                if (templSect) {
                    l = ""
                    for (let i = 0; i < templSect.level; ++i)
                        l += "#"
                    l += " "
                    l += s.title || templSect.title
                    l += " #" + s.id
                }
                while (openSections[openSections.length - 1].level >= s.level)
                    openSections.pop()
                let parent = openSections[openSections.length - 1]
                parent.children.push(s)
                openSections.push(s)
            }
            openSections[openSections.length - 1].text += l + "\n"
            lineNo++
        }
        return openSections[0]
    }

    export function buildTOC(summaryMD: string): pxt.TOCMenuEntry[] {
        if (!summaryMD)
            return null

        const markedInstance = pxt.docs.requireMarked();
        const options = {
            renderer: new markedInstance.Renderer(),
            gfm: true,
            tables: false,
            breaks: false,
            pedantic: false,
            sanitize: false,
            smartLists: false,
            smartypants: false
        };

        let dummy: pxt.TOCMenuEntry = { name: 'dummy', subitems: [] };
        let currentStack: pxt.TOCMenuEntry[] = [];
        currentStack.push(dummy);

        let tokens = markedInstance.lexer(summaryMD, options);
        tokens.forEach((token: any) => {
            switch (token.type) {
                case "heading":
                    if (token.depth == 3) {
                        // heading
                    }
                    break;
                case "list_start":
                    break;
                case "list_item_start":
                case "loose_item_start":
                    let newItem: pxt.TOCMenuEntry = {
                        name: '',
                        subitems: []
                    };
                    currentStack.push(newItem);
                    break;
                case "text":
                    token.text.replace(/^\[(.*)\]\((.*)\)$/i, function (full: string, name: string, path: string) {
                        currentStack[currentStack.length - 1].name = name;
                        currentStack[currentStack.length - 1].path = path.replace('.md', '');
                    });
                    break;
                case "list_item_end":
                case "loose_item_end":
                    let docEntry = currentStack.pop();
                    currentStack[currentStack.length - 1].subitems.push(docEntry);
                    break;
                case "list_end":
                    break;
                default:
            }
        })

        let TOC = dummy.subitems
        if (!TOC || TOC.length == 0) return null
        return TOC
    }

    export function visitTOC(toc: TOCMenuEntry[], fn: (e: TOCMenuEntry) => void) {
        function visitEntry(entry: TOCMenuEntry) {
            fn(entry);
            if (entry.subitems) entry.subitems.forEach(fn);
        }
        toc.forEach(visitEntry);
    }

    let testedAugment = false
    export function augmentDocs(baseMd: string, childMd: string) {
        if (!testedAugment) testAugment()
        if (!childMd) return baseMd
        let templ = splitMdSections(baseMd, null)
        let repl = splitMdSections(childMd, templ)
        let lookup: pxt.Map<string> = {}
        let used: pxt.Map<boolean> = {}
        for (let ch of repl.children) {
            U.assert(ch.children.length == 0)
            U.assert(!!ch.id)
            lookup[ch.id] = ch.text
        }
        let replaceInTree = (s: Section) => {
            if (s.id && lookup[s.id] !== undefined) {
                used[s.id] = true
                s.text = lookup[s.id]
                s.children = []
            }
            s.children.forEach(replaceInTree)
        }
        replaceInTree(templ)
        let resMd = ""
        let flatten = (s: Section) => {
            resMd += s.text
            s.children.forEach(flatten)
        }
        flatten(templ)

        let leftover = ""
        let hd = repl.text
            .replace(/^\s*#+\s*@extends.*/mg, "")
            .replace(/^\s*\n/mg, "")
        if (hd.trim()) leftover += hd.trim() + "\n"
        for (let s of repl.children) {
            if (!used[s.id]) leftover += s.text
        }
        if (leftover) {
            resMd += "## Couldn't apply replacement logic to:\n" + leftover
        }
        return resMd
    }

    function testAugment() {
        function test(a: string, b: string, c: string) {
            let r = augmentDocs(a, b).trim()
            c = c.trim()
            if (r != c) {
                console.log(`*** Template:\n${a}\n*** Input:\n${b}\n*** Expected:\n${c}\n*** Output:\n${r}`)
                throw new Error("augment docs test fail")
            }
        }
        testedAugment = true
        let templ0 = `
# T0
## Examples #ex
### Example 1
TEx1
### Example 2 #ex2
TEx2
### Example 3
TEx3

## See also #also
TAlso
`
        let inp0 = `
# @extends
# #ex2
My example
## See Also These! #also
My links
`
        let outp0 = `
# T0
## Examples #ex
### Example 1
TEx1
### Example 2 #ex2
My example
### Example 3
TEx3

## See Also These! #also
My links
`
        let inp1 = `
# @extends
### #ex
Foo
#### Example 1
Ex1
#### Example 2x #ex2
Ex2
## See Also These! #also
My links
`
        let outp1 = `
# T0
## Examples #ex
Foo
#### Example 1
Ex1
#### Example 2x #ex2
Ex2
## See Also These! #also
My links
`
        test(templ0, "", templ0)
        test(templ0, " ", templ0)
        test(templ0, inp0, outp0)
        test(templ0, inp1, outp1)
    }
}
