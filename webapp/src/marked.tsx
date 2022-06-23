/// <reference path='../../localtypings/dompurify.d.ts' />

import * as React from "react";
import * as data from "./data";
import * as marked from "marked";
import * as compiler from "./compiler"

type ISettingsProps = pxt.editor.ISettingsProps;

interface MarkedContentProps extends ISettingsProps {
    markdown: string;
    className?: string;
    tabIndex?: number;
    // do not emit segment around snippets
    unboxSnippets?: boolean;
    blocksDiffOptions?: pxt.blocks.DiffOptions;
    textDiffOptions?: pxt.diff.RenderOptions;
    onDidRender?: () => void;
}

interface MarkedContentState {
}

export class MarkedContent extends data.Component<MarkedContentProps, MarkedContentState> {
    protected readonly semanticIconNames = ["flipped", "horizontally", "vertically", "rotated", "counterclockwise", "access", "accessible", "accusoft", "add", "address", "adjust", "adn", "adversal", "affiliatetheme", "aid", "alarm", "ald", "algolia", "alien", "align", "all", "alphabet", "als", "alt", "alternate", "alternative", "amazon", "ambulance", "american", "amex", "amilia", "amount", "anchor", "and", "android", "angellist", "angle", "angrycreative", "angular", "announcement", "app", "apper", "apple", "archive", "area", "arrow", "arrows", "ascending", "asexual", "asl", "assistive", "asterisk", "asymmetrik", "at", "attach", "attention", "audible", "audio", "autoprefixer", "avianex", "aviato", "awesome", "aws", "backward", "badge", "bag", "balance", "ball", "ban", "band", "bandcamp", "bar", "barcode", "bars", "baseball", "basket", "basketball", "bath", "bathtub", "battery", "bed", "beer", "beginner", "behance", "bell", "bicycle", "bill", "bimobject", "binary", "binoculars", "birthday", "bishop", "bitbucket", "bitcoin", "bity", "black", "blackberry", "blind", "block", "blogger", "bluetooth", "board", "bold", "bolt", "bomb", "book", "bookmark", "bowling", "box", "boxes", "braille", "branch", "briefcase", "broken", "browser", "brush", "btc", "bug", "building", "bullhorn", "bullseye", "bureau", "buromobelexperte", "bus", "buysellads", "cake", "calculator", "calendar", "call", "camera", "camp", "cancel", "cap", "captioning", "car", "card", "caret", "cart", "cc", "center", "centercode", "certificate", "chain", "chart", "chat", "check", "checked", "checkered", "checkmark", "chess", "chevron", "child", "chrome", "circle", "clipboard", "clock", "clone", "close", "closed", "cloud", "cloudscale", "cloudsmith", "cloudversify", "club", "cny", "cocktail", "code", "codepen", "codiepie", "coffee", "cog", "cogs", "columns", "combinator", "comment", "commenting", "comments", "commons", "compass", "compose", "compress", "computer", "configure", "connectdevelop", "contao", "content", "control", "conversation", "copy", "copyright", "cord", "cpanel", "creative", "credit", "crop", "crosshairs", "css3", "cube", "cubes", "currency", "cursor", "cut", "cuttlefish", "dashboard", "dashcube", "database", "deaf", "deafness", "delete", "delicious", "deploydog", "descending", "description", "deskpro", "desktop", "detective", "deviantart", "devices", "diamond", "digg", "digital", "diners", "discord", "discourse", "discover", "discussions", "disk", "dna", "dochub", "docker", "doctor", "dollar", "dolly", "dont", "dot", "double", "down", "download", "draft2digital", "dribbble", "dribble", "drive", "drivers", "dropbox", "dropdown", "dropper", "drupal", "dyalog", "earlybirds", "edge", "edit", "eercast", "eject", "elementor", "ellipsis", "ember", "emergency", "empire", "empty", "end", "envelope", "envira", "erase", "eraser", "erlang", "ethereum", "etsy", "eur", "euro", "excel", "exchange", "exclamation", "expand", "expeditedssl", "explorer", "express", "external", "extinguisher", "eye", "eyedropper", "facebook", "factory", "fast", "favorite", "fax", "feed", "female", "fi", "fighter", "file", "film", "filter", "find", "fire", "firefox", "first", "firstdraft", "five", "flag", "flask", "flatbed", "flickr", "flipboard", "fly", "folder", "font", "fonticons", "food", "football", "fork", "forms", "fort", "forumbee", "forward", "four", "foursquare", "framework", "free", "freebsd", "from", "frown", "full", "futbol", "gallery", "game", "gavel", "gay", "gbp", "gem", "gender", "genderless", "get", "gg", "ghost", "gift", "git", "github", "gitkraken", "gitlab", "gitter", "gittip", "glass", "glide", "globe", "gofore", "golf", "goodreads", "google", "grab", "graduation", "graph", "gratipay", "grav", "grid", "gripfire", "group", "grunt", "gulp", "hacker", "half", "hand", "handicap", "handshake", "hard", "hash", "hashtag", "hat", "hdd", "header", "heading", "headphones", "hearing", "heart", "heartbeat", "height", "help", "helper", "heterosexual", "hide", "high", "hips", "hire", "history", "hockey", "home", "homosexual", "hooli", "horizontal", "hospital", "hotel", "hotjar", "hourglass", "houzz", "html5", "hubspot", "hundred", "hunt", "id", "idea", "ils", "image", "images", "imdb", "in", "in-cart", "inbox", "indent", "industry", "info", "inr", "instagram", "intergender", "international", "internet", "interpreting", "intersex", "ios", "ioxhost", "isle", "italic", "itunes", "japan", "jcb", "jenkins", "jet", "joget", "joomla", "jpy", "js", "jsfiddle", "justify", "key", "keyboard", "keycdn", "kickstarter", "king", "knight", "korvue", "krw", "lab", "language", "laptop", "laravel", "large", "lastfm", "law", "layout", "leaf", "leanpub", "left", "legal", "lemon", "lesbian", "less", "level", "license", "life", "lightbulb", "lightning", "like", "line", "linechat", "linkedin", "linkify", "linode", "linux", "lira", "list", "listening", "lizard", "location", "lock", "log", "logout", "long", "low", "lyft", "magento", "magic", "magnet", "magnify", "mail", "male", "man", "map", "marker", "mars", "martini", "mastercard", "maxcdn", "maximize", "md", "meanpath", "medapps", "medium", "medkit", "medrt", "meetup", "meh", "mercury", "messenger", "microchip", "microphone", "microsoft", "military", "minimize", "minus", "mix", "mixcloud", "mizuni", "mobile", "modx", "monero", "money", "monster", "moon", "motorcycle", "mouse", "move", "ms", "mule", "music", "mute", "napster", "neuter", "new", "news", "newspaper", "nintendo", "node", "non", "notch", "notched", "note", "npm", "ns8", "numbered", "numeric", "nutritionix", "object", "ocean", "odnoklassniki", "of", "off", "official", "ol", "on", "one", "open", "opencart", "openid", "opera", "optin", "optinmonster", "options", "order", "ordered", "osi", "other", "out", "outdent", "outline", "overflow", "page4", "pagelines", "paint", "palfed", "pallet", "paper", "paperclip", "paragraph", "paste", "patreon", "pause", "paw", "pawn", "pay", "payment", "paypal", "pdf", "peace", "pen", "pencil", "percent", "periscope", "phabricator", "phoenix", "phone", "photo", "php", "picture", "pie", "piece", "pied", "pills", "pin", "pinterest", "piper", "pixels", "plane", "play", "playstation", "play", "plug", "plus", "pocket", "podcast", "point", "pointer", "pointing", "pound", "power", "powerpoint", "pp", "print", "privacy", "product", "protect", "puck", "pushed", "puzzle", "python", "qq", "qrcode", "quarter", "quarters", "queen", "question", "quidditch", "quinscape", "quora", "quote", "radio", "rain", "random", "ravelry", "react", "rebel", "record", "rectangle", "recycle", "reddit", "redo", "redriver", "refresh", "registered", "remove", "rendact", "renren", "repeat", "reply", "replyd", "resize", "resolving", "restore", "retro", "retweet", "right", "ring", "rmb", "road", "rock", "rocket", "rocketchat", "rockrms", "rook", "rouble", "rss", "rub", "ruble", "rupee", "s15", "safari", "sass", "save", "scale", "schlix", "scissors", "scribd", "search", "searchengin", "secret", "selected", "sellcast", "sellsy", "send", "server", "servicestack", "setting", "settings", "share", "shekel", "sheqel", "shield", "ship", "shipping", "shirtsinbulk", "shop", "shopping", "shower", "shuffle", "shutdown", "shuttle", "sidebar", "sign", "sign-in", "sign-out", "signal", "signing", "signs", "signup", "simple", "simplybuilt", "sistrix", "sitemap", "skyatlas", "skype", "slack", "slash", "sliders", "slideshare", "smile", "snapchat", "snowflake", "soccer", "sort", "sound", "soundcloud", "space", "speakap", "spinner", "spock", "spoon", "spotify", "spy", "square", "stack", "star", "start", "staylinked", "steam", "step", "stethoscope", "sticker", "sticky", "stop", "stopwatch", "store", "strava", "street", "strikethrough", "stripe", "stroke", "student", "studiovinari", "stumbleupon", "subscript", "subway", "suitcase", "sun", "superpowers", "superscript", "supple", "switch", "symbol", "sync", "syringe", "systems", "table", "tablet", "tachometer", "tack", "tag", "tags", "talk", "target", "tasks", "taxi", "telegram", "telephone", "teletype", "television", "tencent", "tennis", "terminal", "text", "th", "theme", "themeisle", "thermometer", "thin", "three", "thumb", "thumbs", "thumbtack", "ticket", "tie", "time", "times", "tint", "tm", "to", "toggle", "trademark", "train", "transgender", "translate", "trash", "travel", "treatment", "tree", "trello", "triangle", "tripadvisor", "trophy", "truck", "try", "tumblr", "tv", "twitch", "twitter", "two", "uber", "uikit", "ul", "umbrella", "underline", "undo", "ungroup", "unhide", "uniregistry", "universal", "university", "unlink", "unlinkify", "unlock", "unmute", "unordered", "untappd", "up", "upload", "usb", "usd", "user", "users", "ussunnah", "utensil", "utensils", "vaadin", "vcard", "venus", "vertical", "viacoin", "viadeo", "viber", "victory", "video", "view", "vimeo", "vine", "visa", "vision", "vk", "vnv", "volleyball", "volume", "vuejs", "wait", "wallet", "warehouse", "warning", "wechat", "weibo", "weight", "weixin", "whatsapp", "wheelchair", "whmcs", "wi-fi", "width", "wifi", "wikipedia", "window", "windows", "winner", "wizard", "woman", "won", "word", "wordpress", "world", "wpbeginner", "wpexplorer", "wpforms", "wrench", "write", "xbox", "xing", "yahoo", "yandex", "yc", "ycombinator", "yelp", "yen", "yoast", "youtube", "zero", "zip", "zoom", "zoom-in", "zoom-out"];
    protected readonly customIconNames = ["blocks", "js", "python", "toolbox", "book-reader", "photo-video", "gamepad", "function"];

    // Local cache for images, cleared when we create a new project.
    // Stores code => data-uri image of decompiled result
    private static blockSnippetCache: pxt.Map<string | HTMLElement> = {};
    public static clearBlockSnippetCache() {
        this.blockSnippetCache = {};
    }

    private getBuiltinMacros() {
        const params: pxt.Map<string> = {};
        const theme = pxt.appTarget.appTheme;
        if (theme.boardName)
            params["boardname"] = pxt.Util.htmlEscape(theme.boardName);
        if (theme.boardNickname)
            params["boardnickname"] = pxt.Util.htmlEscape(theme.boardNickname);
        if (theme.driveDisplayName)
            params["drivename"] = pxt.Util.htmlEscape(theme.driveDisplayName);
        if (theme.homeUrl)
            params["homeurl"] = pxt.Util.htmlEscape(theme.homeUrl);
        params["targetid"] = theme.id || "???";
        params["targetname"] = theme.name || "Microsoft MakeCode";
        params["targetlogo"] = theme.docsLogo ? `<img aria-hidden="true" role="presentation" class="ui mini image" src="${theme.docsLogo}" />` : "";
        return params;
    }

    private startRenderLangSnippet(langBlock: HTMLElement): HTMLDivElement {
        const { unboxSnippets } = this.props;
        const preBlock = langBlock.parentElement as HTMLPreElement; // pre parent of the code
        const parentBlock = preBlock.parentElement as HTMLDivElement; // parent containing all text

        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = `ui ${unboxSnippets ? "" : "segment raised "}loading codewidget`;
        parentBlock.insertBefore(wrapperDiv, preBlock);
        parentBlock.removeChild(preBlock);

        return wrapperDiv;
    }

    private finishRenderLangSnippet(wrapperDiv: HTMLDivElement, code: string | HTMLElement) {
        if (typeof code === "string") {
            let codeDiv = document.createElement('code') as HTMLElement
            codeDiv.className = "hljs"
            codeDiv.textContent = code;
            pxt.tutorial.highlight(codeDiv);
            code = codeDiv;
        }
        wrapperDiv.appendChild(code);
        pxsim.U.removeClass(wrapperDiv, 'loading');
    }

    private cachedRenderLangSnippetAsync(langBlock: HTMLElement, renderer: (code: string) => Promise<string | HTMLElement>): Promise<void> {
        const code = langBlock.textContent;
        const lang = langBlock.className;
        const wrapperDiv = this.startRenderLangSnippet(langBlock);
        if (MarkedContent.blockSnippetCache[lang + code]) {
            this.finishRenderLangSnippet(wrapperDiv, MarkedContent.blockSnippetCache[lang + code]);
            return undefined;
        } else {
            return renderer(code)
                .then(renderedCode => {
                    MarkedContent.blockSnippetCache[lang + code] = renderedCode;
                    this.finishRenderLangSnippet(wrapperDiv, MarkedContent.blockSnippetCache[lang + code]);
                }).catch(e => {
                    pxt.reportException(e);
                    this.finishRenderLangSnippet(wrapperDiv, lf("Something changed."))
                })
        }
    }

    private renderSnippets(content: HTMLElement) {
        const { parent, unboxSnippets, onDidRender, blocksDiffOptions, textDiffOptions } = this.props;

        let promises: Promise<void>[] = [];

        pxt.Util.toArray(content.querySelectorAll(`img`))
            .forEach((imgBlock: HTMLImageElement) => {
                promises.push(new Promise<void>((resolve, reject) => {
                    imgBlock.addEventListener("load", () => resolve(), false);
                    imgBlock.addEventListener("error", () => resolve(), false);
                }))
            });

        pxt.Util.toArray(content.querySelectorAll(`code.lang-typescript,code.lang-python`))
            .forEach((langBlock: HTMLElement) => {
                const code = langBlock.textContent;
                const wrapperDiv = this.startRenderLangSnippet(langBlock);
                this.finishRenderLangSnippet(wrapperDiv, code);
            });

        pxt.Util.toArray(content.querySelectorAll(`code.lang-spy`))
            .forEach((langBlock: HTMLElement) => {
                promises.push(this.cachedRenderLangSnippetAsync(langBlock, code =>
                    parent.renderPythonAsync({
                        type: "pxteditor",
                        action: "renderpython", ts: code
                    }).then(resp => resp.python)
                ));
            });

        pxt.Util.toArray(content.querySelectorAll(`code.lang-diffspy`))
            .forEach((langBlock: HTMLElement) => {
                promises.push(this.cachedRenderLangSnippetAsync(langBlock, code => {
                    const { fileA, fileB } = pxt.diff.split(code);
                    return pxt.Util.promiseMapAllSeries([fileA, fileB],
                        src => parent.renderPythonAsync({
                            type: "pxteditor",
                            action: "renderpython", ts: src
                        }).then(resp => resp.python))
                        .then(parts => {
                            const el = pxt.diff.render(parts[0], parts[1], textDiffOptions || {
                                hideLineNumbers: true,
                                hideMarkerLine: true,
                                hideMarker: true,
                                hideRemoved: true,
                                update: true,
                                ignoreWhitespace: true
                            });
                            return el;
                        });
                }));
            });

        pxt.Util.toArray(content.querySelectorAll(`code.lang-diff,code.lang-diffpython`))
            .forEach((langBlock: HTMLElement) => {
                promises.push(this.cachedRenderLangSnippetAsync(langBlock, code => {
                    const { fileA, fileB } = pxt.diff.split(code);
                    const el = pxt.diff.render(fileA, fileB, textDiffOptions || {
                        hideLineNumbers: true,
                        hideMarkerLine: true,
                        hideMarker: true,
                        hideRemoved: true,
                        update: true,
                        ignoreWhitespace: true
                    });
                    return Promise.resolve(el);
                }))
            });

        pxt.Util.toArray(content.querySelectorAll(`code.lang-blocks`))
            .forEach((langBlock: HTMLElement) => renderBlock(langBlock, false));
        pxt.Util.toArray(content.querySelectorAll(`code.lang-block`)) // snippet mode
            .forEach((langBlock: HTMLElement) => renderBlock(langBlock, true));

        pxt.Util.toArray(content.querySelectorAll(`code.lang-diffblocksxml`))
            .forEach((langBlock: HTMLElement) => {
                // Can't use innerHTML here because it escapes certain characters (e.g. < and >)
                // Also can't use innerText because IE strips out the newlines from the code
                // textContent seems to work in all browsers and return the "pure" text
                const code = langBlock.textContent;
                const { fileA: oldXml, fileB: newXml } = pxt.diff.split(code);

                promises.push(this.cachedRenderLangSnippetAsync(langBlock, code =>
                    pxt.BrowserUtils.loadBlocklyAsync()
                        .then(() => {
                            const diff = pxt.blocks.diffXml(oldXml, newXml, blocksDiffOptions);
                            return wrapBlockDiff(diff);
                        })));
            });

        pxt.Util.toArray(content.querySelectorAll(`code.lang-diffblocks`))
            .forEach((langBlock: HTMLElement) => {
                // Can't use innerHTML here because it escapes certain characters (e.g. < and >)
                // Also can't use innerText because IE strips out the newlines from the code
                // textContent seems to work in all browsers and return the "pure" text
                const code = langBlock.textContent;
                const { fileA: oldSrc, fileB: newSrc } = pxt.diff.split(code);


                promises.push(this.cachedRenderLangSnippetAsync(langBlock, code =>
                    pxt.BrowserUtils.loadBlocklyAsync()
                        .then(() => compiler.getBlocksAsync())
                        .then(blocksInfo => pxt.Util.promiseMapAllSeries([oldSrc, newSrc], src =>
                            compiler.decompileBlocksSnippetAsync(src, blocksInfo))
                        )
                        .then((resps) => pxt.blocks.decompiledDiffAsync(oldSrc, resps[0], newSrc, resps[1], blocksDiffOptions || {
                            hideDeletedTopBlocks: true,
                            hideDeletedBlocks: true
                        }))
                        .then(diff => wrapBlockDiff(diff))
                ));
            });

        promises = promises.filter(p => !!p);
        if (promises.length && onDidRender)
            Promise.all(promises)
                .then(() => {
                    pxt.log(`markdowcontent: forcing update after async rendering`)
                    onDidRender();
                });

        function wrapBlockDiff(diff: pxt.blocks.DiffResult): HTMLElement {
            const svg = diff.svg;
            if (svg) {
                if (svg.tagName == "SVG") { // splitsvg
                    const viewBox = svg.getAttribute('viewBox').split(' ').map(parseFloat);
                    const width = viewBox[2];
                    let height = viewBox[3];
                    if (width > 480 || height > 128)
                        height = (height * 0.8) | 0;
                    svg.setAttribute('height', `${height}px`);
                }
                return svg as HTMLElement;
            } else {
                // An error occured, show alternate message
                const textDiv = document.createElement('div');
                textDiv.className = "ui basic segment";
                textDiv.textContent = diff.message || lf("No changes.");
                return textDiv;
            }
        }

        function renderBlock(langBlock: HTMLElement, snippetMode: boolean) {
            // Can't use innerHTML here because it escapes certain characters (e.g. < and >)
            // Also can't use innerText because IE strips out the newlines from the code
            // textContent seems to work in all browsers and return the "pure" text
            const code = langBlock.textContent;

            const wrapperDiv = document.createElement('div');
            pxsim.U.clear(langBlock);
            langBlock.appendChild(wrapperDiv);
            wrapperDiv.className = `ui ${unboxSnippets ? "" : "segment raised "} loading`;
            const req: pxt.editor.EditorMessageRenderBlocksRequest = {
                type: "pxteditor",
                action: "renderblocks",
                ts: code,
                snippetMode
            };
            const reqid = JSON.stringify(req);
            if (MarkedContent.blockSnippetCache[reqid]) {
                // Use cache
                const workspaceXml = MarkedContent.blockSnippetCache[reqid] as string;
                const doc = Blockly.utils.xml.textToDomDocument(pxt.blocks.layout.serializeSvgString(workspaceXml));
                wrapperDiv.appendChild(doc.documentElement);
                pxsim.U.removeClass(wrapperDiv, 'loading');
            } else {
                promises.push(parent.renderBlocksAsync(req).then(resp => {
                    const svg = resp.svg;
                    if (svg) {
                        const viewBox = svg.getAttribute('viewBox').split(' ').map(parseFloat);
                        const width = viewBox[2];
                        let height = viewBox[3];
                        if (width > 480 || height > 128)
                            height = (height * 0.8) | 0;
                        svg.setAttribute('height', `${height}px`);
                        // SVG serialization is broken on IE (SVG namespace issue), don't cache on IE
                        if (!pxt.BrowserUtils.isIE()) MarkedContent.blockSnippetCache[reqid] = Blockly.Xml.domToText(svg);
                        wrapperDiv.appendChild(svg);
                        pxsim.U.removeClass(wrapperDiv, 'loading');
                    } else {
                        // An error occured, show alternate message
                        const textDiv = document.createElement('span');
                        textDiv.textContent = lf("Oops, something went wrong trying to render this block snippet.");
                        wrapperDiv.appendChild(textDiv);
                        pxsim.U.removeClass(wrapperDiv, 'loading');
                    }
                }));
            }
        }
    }

    // Renders inline blocks, such as "||controller: Controller||"
    private renderInlineBlocks(content: HTMLElement) {
        pxt.Util.toArray(content.querySelectorAll(`:not(pre) > code`))
            .forEach((inlineBlock: HTMLElement) => {
                const text = inlineBlock.innerText;
                const mbtn = /^(\|+)([^\|]+)\|+$/.exec(text);
                if (mbtn) {
                    const mtxt = /^(([^\:\.]*?)[\:\.])?(.*)$/.exec(mbtn[2]);
                    const ns = mtxt[2] ? mtxt[2].trim().toLowerCase() : '';
                    const txt = mtxt[3].trim();
                    const lev = mbtn[1].length == 1 ?
                        `docs inlinebutton ui button ${pxt.Util.htmlEscape(txt.toLowerCase())}-button`
                        : `docs inlineblock ${pxt.Util.htmlEscape(ns)}`;

                    const inlineBlockDiv = document.createElement('span');
                    pxsim.U.clear(inlineBlock);
                    inlineBlock.appendChild(inlineBlockDiv);
                    inlineBlockDiv.className = lev;
                    inlineBlockDiv.textContent = pxt.U.rlf(txt);
                }
            })
    }

    // Renders icon bullets, such as ":mouse pointer:" and ":paint brush:"
    private renderBullets(content: HTMLElement) {
        const bulletRegex = /^:([^:]+):/i;
        pxt.Util.toArray(content.querySelectorAll("li"))
            .forEach((li: HTMLElement) => {
                const match = li.innerHTML.match(bulletRegex);
                if (match?.[1]) {
                    const p = document.createElement("p");
                    pxt.Util.toArray(li.childNodes).forEach(n => p.appendChild(n));
                    li.appendChild(p);
                }
            })

        pxt.Util.toArray(content.querySelectorAll("li > p"))
            .forEach((p: HTMLElement) => {
                const match = p.innerText.match(bulletRegex);
                if (match?.[1]) {
                    const firstTextChild = pxt.Util.toArray(p.childNodes).find(n => n.nodeName === "#text");
                    if (firstTextChild?.nodeValue) firstTextChild.nodeValue = firstTextChild.nodeValue.replace(bulletRegex, "");

                    const li = p.parentElement;
                    li.className += " formatted-bullet-li";
                    const ul = li.parentElement;
                    if (!ul.classList.contains("formatted-bullet-ul")) ul.className += " formatted-bullet-ul";

                    const bullet = document.createElement("div");
                    bullet.className = "formatted-bullet";
                    const icon = document.createElement("i");
                    let iconNames = match[1].split(" ");

                    // Filter out icon names that don't match our allowlist
                    let iconClasses = iconNames.filter(el => this.semanticIconNames.indexOf(el) >= 0);
                    if (iconClasses.length) {
                        icon.className = `ui icon ${iconClasses.join(" ")}`;
                    } else {
                        iconClasses = iconNames.filter(el => this.customIconNames.indexOf(el) >= 0);
                        icon.className = `ui xicon ${iconClasses.join(" ")}`;
                    }

                    bullet.appendChild(icon);
                    li.insertBefore(bullet, p);
                }
            })
    }

    // Renders collapsable hints
    private renderAccordianHints(content: HTMLElement) {
        const hintBeginRegex = /^\s*~hint\s*(.+)/i;
        const hintEndRegex = /^\s*hint~.*/i;
        
        // Processing a hint modifies the node order and count of 'content.childnodes'. 
        // Keep reprocessing content.childnodes until all hints have been processing.
        let hintFound:boolean = false; 

        do { 
            hintFound = false;
            // The hint summary element (i.e. <summary>text</summary>).
            let hintSummary:HTMLElement = null; 
            // The element that signifies the beginning of the hint (i.e. <p>~hint (hint summary)</p>).
            let hintBeginElement:HTMLElement = null;
            // Inner-nodes of the hint.
            let hintChildNodes:Node[] = new Array(); 
            
            for (let node of content.childNodes) {
                if (node instanceof HTMLElement) {
                    const element = node; 
                    if (hintBeginElement == null) {
                        // Look for hint begin signifiers in 'p' elements.
                        if (element.tagName.toLocaleLowerCase() === "p") { 
                            // Look for a match of the hint-begin signifier (i.e. ~hint).
                            const match = element.innerHTML.match(hintBeginRegex); 
                            if (match) {
                                // Any characters after the hint-begin signifier are considered part of the summary.
                                const summary = match[1]; 
                                hintSummary = document.createElement('summary');
                                hintSummary.append(summary);
                                
                                // Store the beginning element so we know what to replace when we close the hint.
                                hintBeginElement = element; 
                            }
                        }
                    // We have already found a hint-begin signifier element, now capture inner-nodes and look for hint-end signifier.
                    } else { 
                        if (element.tagName.toLocaleLowerCase() === "p") { 
                            // Look for a match of the hint-end signifier (i.e. hint~).
                            const match = element.innerHTML.match(hintEndRegex); 
                            if (match) {
                                // Create the 'details' element...
                                const hintDetails = document.createElement('details'); 
                                // ...add the summary element...
                                hintDetails.append(hintSummary); 
                                // ...and move the hint's child nodes into the 'details' element.
                                hintChildNodes.forEach((hintChildNode) => { 
                                    hintDetails.appendChild(hintChildNode);
                                });
                                
                                // Replace the hintBegin element with the new details element.
                                hintBeginElement.parentNode.replaceChild(hintDetails, hintBeginElement); 
                                // Remove hint-end signifier node.
                                element.parentNode.removeChild(node); 
                                // Mark that we found a complete hint this time around.
                                hintFound = true; 
                                // Processing a hint modifies the node order and count of 'content.childnodes'.
                                // Break the forloop here so we can reprocess the new state of the child nodes. 
                                break; 
                            }
                            else {
                                // We have a hint-begin node and this node is not a hint-end node, add it to hint's child nodes.
                                hintChildNodes.push(node);
                            }
                        }
                        else {
                            // We have a hint-begin node and this node is not a hint-end node, add it to hint's child nodes.
                            hintChildNodes.push(node); 
                        }
                    }
                }
                else if (hintBeginElement != null) {
                    // If we have started capturing hint nodes and this node is not an HTMLElement, add it to hint's child nodes.
                    hintChildNodes.push(node);
                }
            }
        
        // Processing a hint modifies the node order and count of 'content.childnodes'.
        // Rescan the nodes starting from the beginning to look for additional hints.
        } while (hintFound); 
    }

    private renderOthers(content: HTMLElement) {
        // remove package blocks
        pxt.Util.toArray(content.querySelectorAll(`.lang-package,.lang-config,.lang-apis`))
            .forEach((langBlock: HTMLElement) => {
                langBlock.parentNode.removeChild(langBlock);
            });
    }

    renderMarkdown(markdown: string) {
        const content = this.refs["marked-content"] as HTMLDivElement;
        const pubinfo = this.getBuiltinMacros();

        if (!markdown) return;

        pxt.perf.measureStart("renderMarkdown");

        // replace pre-template in markdown
        markdown = markdown.replace(/@([a-z]+)@/ig, (m, param) => pubinfo[param] || 'unknown macro')

        // create a custom renderer
        let renderer = new marked.Renderer()
        pxt.docs.setupRenderer(renderer);

        // always popout external links
        const linkRenderer = renderer.link;
        renderer.link = function (href: string, title: string, text: string) {
            const relative = /^[\/#]/.test(href);
            const target = !relative ? '_blank' : '';
            const html = linkRenderer.call(renderer, href, title, text);
            return html.replace(/^<a /, `<a ${target ? `target="${target}"` : ''} rel="nofollow noopener" `);
        };

        // Set markdown options
        marked.setOptions({
            renderer: renderer,
            sanitize: false,
            sanitizer: pxt.docs.requireDOMSanitizer()
        })

        // preemptively remove script tags, although they'll be escaped anyway
        // prevents ugly <script ...> rendering in docs. This is not intended to sanitize
        // the markedown, that is done using DOMPurify (see setOptions above)
        markdown = markdown.replace(/<\s*script[^>]*>.*<\/\s*script[^>]*>/gi, '');

        // Render the markdown into a div outside of the DOM tree to prevent the page from reflowing
        // when we edit the HTML it produces. Then, add the finished result to the content div
        const tempDiv = document.createElement("div");

        // We pass DOMPurify to marked in the call to setOptions above. This should be safe
        /* eslint-disable @microsoft/sdl/no-inner-html */
        tempDiv.innerHTML = marked(markdown);
        /* eslint-enable @microsoft/sdl/no-inner-html */

        // We'll go through a series of adjustments here, rendering inline blocks, blocks and snippets as needed
        this.renderInlineBlocks(tempDiv);
        this.renderSnippets(tempDiv);
        this.renderBullets(tempDiv);
        this.renderAccordianHints(tempDiv);
        this.renderOthers(tempDiv);

        content.innerHTML = "";
        content.append(...tempDiv.childNodes);

        pxt.perf.measureEnd("renderMarkdown");
    }

    componentDidMount() {
        const { markdown } = this.props;
        this.renderMarkdown(markdown);
    }

    UNSAFE_componentWillReceiveProps(newProps: MarkedContentProps) {
        const { markdown } = newProps;
        if (this.props.markdown != newProps.markdown) {
            this.renderMarkdown(markdown);
        }
    }

    renderCore() {
        const { className, tabIndex } = this.props;
        return <div ref="marked-content" className={className || ""} tabIndex={tabIndex} />;
    }
}