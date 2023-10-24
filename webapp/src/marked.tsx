/// <reference path='../../localtypings/dompurify.d.ts' />

import * as React from "react";
import * as data from "./data";
import * as marked from "marked";
import * as compiler from "./compiler"
import { MediaPlayer } from "dashjs"
import dashjs = require("dashjs");
import { fireClickOnEnter } from "../../react-common/components/util";

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
    contentRef?: (el: HTMLDivElement) => void;
}

interface MarkedContentState {
}

export class MarkedContent extends data.Component<MarkedContentProps, MarkedContentState> {
    protected readonly semanticIconNames = ["flipped", "horizontally", "vertically", "rotated", "counterclockwise", "access", "accessible", "accusoft", "add", "address", "adjust", "adn", "adversal", "affiliatetheme", "aid", "alarm", "ald", "algolia", "alien", "align", "all", "alphabet", "als", "alt", "alternate", "alternative", "amazon", "ambulance", "american", "amex", "amilia", "amount", "anchor", "and", "android", "angellist", "angle", "angrycreative", "angular", "announcement", "app", "apper", "apple", "archive", "area", "arrow", "arrows", "ascending", "asexual", "asl", "assistive", "asterisk", "asymmetrik", "at", "attach", "attention", "audible", "audio", "autoprefixer", "avianex", "aviato", "awesome", "aws", "backward", "badge", "bag", "balance", "ball", "ban", "band", "bandcamp", "bar", "barcode", "bars", "baseball", "basket", "basketball", "bath", "bathtub", "battery", "bed", "beer", "beginner", "behance", "bell", "bicycle", "bill", "bimobject", "binary", "binoculars", "birthday", "bishop", "bitbucket", "bitcoin", "bity", "black", "blackberry", "blind", "block", "blogger", "bluetooth", "board", "bold", "bolt", "bomb", "book", "bookmark", "bowling", "box", "boxes", "braille", "branch", "briefcase", "broken", "browser", "brush", "btc", "bug", "building", "bullhorn", "bullseye", "bureau", "buromobelexperte", "bus", "buysellads", "cake", "calculator", "calendar", "call", "camera", "camp", "cancel", "cap", "captioning", "car", "card", "caret", "cart", "cc", "center", "centercode", "certificate", "chain", "chart", "chat", "check", "checked", "checkered", "checkmark", "chess", "chevron", "child", "chrome", "circle", "clipboard", "clock", "clone", "close", "closed", "cloud", "cloudscale", "cloudsmith", "cloudversify", "club", "cny", "cocktail", "code", "codepen", "codiepie", "coffee", "cog", "cogs", "columns", "combinator", "comment", "commenting", "comments", "commons", "compass", "compose", "compress", "computer", "configure", "connectdevelop", "contao", "content", "control", "conversation", "copy", "copyright", "cord", "cpanel", "creative", "credit", "crop", "crosshairs", "css3", "cube", "cubes", "currency", "cursor", "cut", "cuttlefish", "dashboard", "dashcube", "database", "deaf", "deafness", "delete", "delicious", "deploydog", "descending", "description", "deskpro", "desktop", "detective", "deviantart", "devices", "diamond", "digg", "digital", "diners", "discord", "discourse", "discover", "discussions", "disk", "dna", "dochub", "docker", "doctor", "dollar", "dolly", "dont", "dot", "double", "down", "download", "draft2digital", "dribbble", "dribble", "drive", "drivers", "dropbox", "dropdown", "dropper", "drupal", "dyalog", "earlybirds", "edge", "edit", "eercast", "eject", "elementor", "ellipsis", "ember", "emergency", "empire", "empty", "end", "envelope", "envira", "erase", "eraser", "erlang", "ethereum", "etsy", "eur", "euro", "excel", "exchange", "exclamation", "expand", "expeditedssl", "explorer", "express", "external", "extinguisher", "eye", "eyedropper", "facebook", "factory", "fast", "favorite", "fax", "feed", "female", "fi", "fighter", "file", "film", "filter", "find", "fire", "firefox", "first", "firstdraft", "five", "flag", "flask", "flatbed", "flickr", "flipboard", "fly", "folder", "font", "fonticons", "food", "football", "fork", "forms", "fort", "forumbee", "forward", "four", "foursquare", "framework", "free", "freebsd", "from", "frown", "full", "futbol", "gallery", "game", "gavel", "gay", "gbp", "gem", "gender", "genderless", "get", "gg", "ghost", "gift", "git", "github", "gitkraken", "gitlab", "gitter", "gittip", "glass", "glide", "globe", "gofore", "golf", "goodreads", "google", "grab", "graduation", "graph", "gratipay", "grav", "grid", "gripfire", "group", "grunt", "gulp", "hacker", "half", "hand", "handicap", "handshake", "hard", "hash", "hashtag", "hat", "hdd", "header", "heading", "headphones", "hearing", "heart", "heartbeat", "height", "help", "helper", "heterosexual", "hide", "high", "hips", "hire", "history", "hockey", "home", "homosexual", "hooli", "horizontal", "hospital", "hotel", "hotjar", "hourglass", "houzz", "html5", "hubspot", "hundred", "hunt", "id", "idea", "ils", "image", "images", "imdb", "in", "in-cart", "inbox", "indent", "industry", "info", "inr", "instagram", "intergender", "international", "internet", "interpreting", "intersex", "ios", "ioxhost", "isle", "italic", "itunes", "japan", "jcb", "jenkins", "jet", "joget", "joomla", "jpy", "js", "jsfiddle", "justify", "key", "keyboard", "keycdn", "kickstarter", "king", "knight", "korvue", "krw", "lab", "language", "laptop", "laravel", "large", "lastfm", "law", "layout", "leaf", "leanpub", "left", "legal", "lemon", "lesbian", "less", "level", "license", "life", "lightbulb", "lightning", "like", "line", "linechat", "linkedin", "linkify", "linode", "linux", "lira", "list", "listening", "lizard", "location", "lock", "log", "logout", "long", "low", "lyft", "magento", "magic", "magnet", "magnify", "mail", "male", "man", "map", "marker", "mars", "martini", "mastercard", "maxcdn", "maximize", "md", "meanpath", "medapps", "medium", "medkit", "medrt", "meetup", "meh", "mercury", "messenger", "microchip", "microphone", "microsoft", "military", "minimize", "minus", "mix", "mixcloud", "mizuni", "mobile", "modx", "monero", "money", "monster", "moon", "motorcycle", "mouse", "move", "ms", "mule", "music", "mute", "napster", "neuter", "new", "news", "newspaper", "nintendo", "node", "non", "notch", "notched", "note", "npm", "ns8", "numbered", "numeric", "nutritionix", "object", "ocean", "odnoklassniki", "of", "off", "official", "ol", "on", "one", "open", "opencart", "openid", "opera", "optin", "optinmonster", "options", "order", "ordered", "osi", "other", "out", "outdent", "outline", "overflow", "page4", "pagelines", "paint", "palfed", "pallet", "paper", "paperclip", "paragraph", "paste", "patreon", "pause", "paw", "pawn", "pay", "payment", "paypal", "pdf", "peace", "pen", "pencil", "percent", "periscope", "phabricator", "phoenix", "phone", "photo", "php", "picture", "pie", "piece", "pied", "pills", "pin", "pinterest", "piper", "pixels", "plane", "play", "playstation", "play", "plug", "plus", "pocket", "podcast", "point", "pointer", "pointing", "pound", "power", "powerpoint", "pp", "print", "privacy", "product", "protect", "puck", "pushed", "puzzle", "python", "qq", "qrcode", "quarter", "quarters", "queen", "question", "quidditch", "quinscape", "quora", "quote", "radio", "rain", "random", "ravelry", "react", "rebel", "record", "rectangle", "recycle", "reddit", "redo", "redriver", "refresh", "registered", "remove", "rendact", "renren", "repeat", "reply", "replyd", "resize", "resolving", "restore", "retro", "retweet", "right", "ring", "rmb", "road", "rock", "rocket", "rocketchat", "rockrms", "rook", "rouble", "rss", "rub", "ruble", "rupee", "s15", "safari", "sass", "save", "scale", "schlix", "scissors", "scribd", "search", "searchengin", "secret", "selected", "sellcast", "sellsy", "send", "server", "servicestack", "setting", "settings", "share", "shekel", "sheqel", "shield", "ship", "shipping", "shirtsinbulk", "shop", "shopping", "shower", "shuffle", "shutdown", "shuttle", "sidebar", "sign", "sign-in", "sign-out", "signal", "signing", "signs", "signup", "simple", "simplybuilt", "sistrix", "sitemap", "skyatlas", "skype", "slack", "slash", "sliders", "slideshare", "smile", "snapchat", "snowflake", "soccer", "sort", "sound", "soundcloud", "space", "speakap", "spinner", "spock", "spoon", "spotify", "spy", "square", "stack", "star", "start", "staylinked", "steam", "step", "stethoscope", "sticker", "sticky", "stop", "stopwatch", "store", "strava", "street", "strikethrough", "stripe", "stroke", "student", "studiovinari", "stumbleupon", "subscript", "subway", "suitcase", "sun", "superpowers", "superscript", "supple", "switch", "symbol", "sync", "syringe", "systems", "table", "tablet", "tachometer", "tack", "tag", "tags", "talk", "target", "tasks", "taxi", "telegram", "telephone", "teletype", "television", "tencent", "tennis", "terminal", "text", "th", "theme", "themeisle", "thermometer", "thin", "three", "thumb", "thumbs", "thumbtack", "ticket", "tie", "time", "times", "tint", "tm", "to", "toggle", "trademark", "train", "transgender", "translate", "trash", "travel", "treatment", "tree", "trello", "triangle", "tripadvisor", "trophy", "truck", "try", "tumblr", "tv", "twitch", "twitter", "two", "uber", "uikit", "ul", "umbrella", "underline", "undo", "ungroup", "unhide", "uniregistry", "universal", "university", "unlink", "unlinkify", "unlock", "unmute", "unordered", "untappd", "up", "upload", "usb", "usd", "user", "users", "ussunnah", "utensil", "utensils", "vaadin", "vcard", "venus", "vertical", "viacoin", "viadeo", "viber", "victory", "video", "view", "vimeo", "vine", "visa", "vision", "vk", "vnv", "volleyball", "volume", "vuejs", "wait", "wallet", "warehouse", "warning", "wechat", "weibo", "weight", "weixin", "whatsapp", "wheelchair", "whmcs", "wi-fi", "width", "wifi", "wikipedia", "window", "windows", "winner", "wizard", "woman", "won", "word", "wordpress", "world", "wpbeginner", "wpexplorer", "wpforms", "wrench", "write", "xbox", "xing", "yahoo", "yandex", "yc", "ycombinator", "yelp", "yen", "yoast", "youtube", "zero", "zip", "zoom", "zoom-in", "zoom-out"];
    protected readonly customIconNames = ["blocks", "js", "python", "toolbox", "book-reader", "photo-video", "gamepad", "function"];
    protected contentRef: HTMLDivElement;

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


    private renderVideo(content: HTMLElement) {

        pxt.Util.toArray(content.querySelectorAll('iframe.yt-embed'))
            .forEach((inlineVideo: HTMLElement) => {
                let lang = pxt.appTarget.appTheme?.defaultLocale ?? "en";
                const src = inlineVideo.getAttribute('src');
                let url = new URL(src);
                pxt.tickEvent("video.loaded", {
                    player: "youtube",
                    url: src
                })
                url.searchParams.append('hl', lang);
                inlineVideo.setAttribute('src', url.toString());
            });

        pxt.Util.toArray(content.querySelectorAll('Video.ams-embed'))
            .forEach((inlineVideo: HTMLMediaElement) => {

                let player = MediaPlayer().create()
                player.initialize(inlineVideo, inlineVideo.getAttribute("src"), /** autoPlay **/ false);
                const src = inlineVideo.getAttribute('src');
                let url = new URL(src);
                pxt.tickEvent("video.loaded", {
                    player: "azure",
                    url: src
                })

                const videoElement = player.getVideoElement();
                const startTime = parseInt(url.searchParams.get("startTime")) || 0;
                const endTime = parseInt(url.searchParams.get("endTime"));
                if (endTime) {
                    player.on(
                        dashjs.MediaPlayer.events.PLAYBACK_TIME_UPDATED,
                        (e: dashjs.PlaybackTimeUpdatedEvent) => {
                            if (endTime <= e.time) {
                                videoElement.currentTime = startTime;
                                player.pause();
                            }

                        }
                    )
                }

                if (videoElement?.requestPictureInPicture) {
                    videoElement.addEventListener("enterpictureinpicture", () => {
                        videoElement.setAttribute("data-pip-active", "true");
                    })
                    videoElement.addEventListener("leavepictureinpicture", () => {
                        videoElement.setAttribute("data-pip-active", undefined);
                        player.pause()
                    });
                    const pipButton = document.createElement("button");
                    inlineVideo.parentElement.appendChild(pipButton);
                    pipButton.addEventListener("click", () => {
                        pxt.tickEvent("video.pip.requested");
                        videoElement.requestPictureInPicture();
                    });
                    pipButton.addEventListener("keydown", e => fireClickOnEnter(e as any));
                    pipButton.className = "common-button";
                    pipButton.textContent = lf("Pop out video");
                    pipButton.ariaLabel = lf("Open video in picture-in-picture mode");
                    pipButton.title = pipButton.ariaLabel;
                } else if (pxt.BrowserUtils.isFirefox()) {
                    const pipInstructionButton = document.createElement("button");
                    inlineVideo.parentElement.appendChild(pipInstructionButton);
                    pipInstructionButton.addEventListener("click", () => {
                        pxt.tickEvent("video.pip.firefoxHelp");
                        window.open("/firefox-picture-in-picture", "_blank");
                    });
                    pipInstructionButton.addEventListener("keydown", e => fireClickOnEnter(e as any));
                    pipInstructionButton.className = "common-button";
                    pipInstructionButton.textContent = lf("Pop out video");
                    pipInstructionButton.ariaLabel = lf("Instructions on how to open video in picture-in-picture mode");
                    pipInstructionButton.title = pipInstructionButton.ariaLabel;
                }

                player.on(dashjs.MediaPlayer.events.PLAYBACK_STARTED,
                    (e: dashjs.PlaybackStartedEvent) => {
                        pxt.tickEvent('video.playback.started', {
                            player: "azure",
                            url: src,
                        });
                    })
            });

    }


    // Renders inline blocks, such as "||controller: Controller||".
    private renderInlineBlocks(content: HTMLElement) {
        const inlineBlocks = pxt.Util.toArray(content.querySelectorAll(`:not(pre) > code`))
            .map((inlineBlock: HTMLElement) => {
                const text = inlineBlock.innerText;
                const mbtn = /^(\|+)([^\|]+)\|+$/.exec(text);
                if (mbtn) {
                    const mtxt = /^(([^:.]*?)[:.])?(.*)$/.exec(mbtn[2]);
                    const txt = mtxt[3].trim();
                    const isInlineButton = mbtn[1].length == 1;
                    const ns = mtxt[2] ? mtxt[2].trim().toLowerCase() : '';
                    const nsSplit = /^([^()]+)\(([^()]+)\)$/.exec(ns);
                    const displayNs = pxt.Util.htmlEscape(nsSplit?.[1] || ns);
                    const behaviorNs = pxt.Util.htmlEscape(nsSplit?.[2] || ns);
                    const lev = isInlineButton ?
                        `docs inlinebutton ui button ${pxt.Util.htmlEscape(txt.toLowerCase())}-button`
                        : `docs inlineblock ${displayNs}`;

                    const inlineBlockDiv = document.createElement('span');
                    pxsim.U.clear(inlineBlock);
                    inlineBlock.appendChild(inlineBlockDiv);
                    inlineBlockDiv.className = lev;
                    inlineBlockDiv.textContent = pxt.U.rlf(txt);
                    inlineBlockDiv.setAttribute("data-ns", behaviorNs);
                    if (displayNs !== behaviorNs) {
                        inlineBlockDiv.setAttribute("data-norecolor", "true")
                    }
                    return !isInlineButton && inlineBlockDiv;
                }
                return undefined;
            }).filter(el => !!el);
        compiler.getBlocksAsync()
            .then(blocksInfo => {
                const namespaceNames = Object.keys(blocksInfo.apis.byQName)
                    .filter(qname => blocksInfo.apis.byQName[qname]?.kind === pxtc.SymbolKind.Module);
                for (const inlineBlock of inlineBlocks) {
                    let ns = inlineBlock.getAttribute("data-ns");
                    // fix capitalization issues, e.g. ``||math: instead of ``||Math:
                    const exactNamespaceName = namespaceNames.find(el => ns.toLowerCase() == el.toLowerCase());
                    if (exactNamespaceName && (ns !== exactNamespaceName)) {
                        ns = exactNamespaceName;
                    }
                    const bi = blocksInfo.apis.byQName[ns];
                    let color = bi?.attributes?.color;
                    if (/^logic$/i.test(ns)) {
                        ns = "logic";
                        color = pxt.toolbox.getNamespaceColor(ns);
                    } else if (/^functions?$/i.test(ns)) {
                        ns = "functions";
                        color = pxt.toolbox.getNamespaceColor(ns);
                    } else if (/^variables?$/i.test(ns)) {
                        ns = "variables";
                        color = pxt.toolbox.getNamespaceColor(ns);
                    } else if (/^arrays?$/i.test(ns)) {
                        ns = "arrays";
                        color = pxt.toolbox.getNamespaceColor(ns);
                    } else if (bi?.kind !== pxtc.SymbolKind.Module){
                        continue;
                    }

                    const isAdvanced = bi?.attributes?.advanced || ns === "arrays";
                    inlineBlock.classList.add("clickable");
                    inlineBlock.tabIndex = 0;
                    inlineBlock.ariaLabel = lf("Toggle the {0} category", ns);
                    inlineBlock.title = inlineBlock.ariaLabel;
                    if (color && !inlineBlock.getAttribute("data-norecolor")) {
                        inlineBlock.style.backgroundColor = color;
                        inlineBlock.style.borderColor = pxt.toolbox.fadeColor(color, 0.1, false);
                    }
                    inlineBlock.addEventListener("click", e => {
                        // need to filter out editors that are currently hidden as we leave toolboxes in dom
                        const editorSelector = `#maineditor > div:not([style*="display:none"]):not([style*="display: none"])`;

                        if (isAdvanced) {
                            // toggle advanced open first if it is collapsed.
                            const advancedSelector = `${editorSelector} .blocklyTreeRow[data-ns="advancedcollapsed"]`;
                            const advancedRow = document.querySelector<HTMLDivElement>(advancedSelector);
                            advancedRow?.click();
                        }

                        const toolboxSelector = `${editorSelector} .blocklyTreeRow[data-ns="${ns}"]`;
                        const toolboxRow = document.querySelector<HTMLDivElement>(toolboxSelector);
                        toolboxRow?.click();
                    });
                    inlineBlock.addEventListener("keydown", e => fireClickOnEnter(e as any))
                }
            });
    }

    // Renders icon bullets, such as ":mouse pointer:" and ":paint brush:".
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

    // Renders collapsable hints starting with "~hint" and ending with "hint~".
    // Example input:
    // -------------------------------
    // ~hint This is the hint summary.
    //    This is the hint content
    // hint~
    // -------------------------------
    //
    // Example output:
    // -------------------------------
    // <details><summary>This is the hint summary</summary>
    //   This is the hint content
    // </details>
    // -------------------------------
    private renderAccordianHints(content: HTMLElement) {
        // Regex for detecting which node a hint begins.
        const hintBeginRegex = /^\s*~hint\s*(.+)\n?([\s\S]*)/i;

        // Regex for detecting which node a hint ends.
        const hintEndRegex = /([\s\S]*\n|^.*)hint~\s*/im;

        // This class tracks accordion hint elements as we find them in the DOM.
        // Once we find a hint-end signifier after a hint-begin signifier, we transform
        // these elements into a 'details' element heirarchy.
        class AccordianHint {
            beginElement: HTMLElement = null; // The hint-begin element
            summary: HTMLElement = null; // The accordion hint summary extracted from the hint-begin element
            childNodes: Node[] = []; // All nodes that should be considered within the accordion hint.
        }
        let accordionHints: AccordianHint[] = [];

        let candidateHint: AccordianHint = null;
        for (let node of content.childNodes) {
            if (node instanceof HTMLElement) {
                const element = node;
                // Only look at "p" elements for an accordion hint-begin signifier (i.e. ~hint)
                if (candidateHint == null && element.tagName.toLowerCase() === "p") {
                    const match = element.innerHTML.match(hintBeginRegex);
                    if (match) {
                        // We have found the start of a new accordion hint
                        candidateHint = new AccordianHint();
                        candidateHint.beginElement = element;
                        // Capture the accordion hint summary
                        candidateHint.summary = document.createElement('summary');
                        candidateHint.summary.append(match[1]);
                        // Anything after a newline in the summary should be considered a child 'p' element.
                        if (match[2].length != 0) {
                            const childElement = document.createElement('p');
                            // In some cases the hint-end signifier will end up in the summary, remove it.
                            childElement.append(match[2].replace("hint~", ""));
                            candidateHint.childNodes.push(childElement);
                        }
                    }
                }
                if (candidateHint != null) {
                    // If we have started tracking a new accordion hint, add any elements that are not the beginning element as a child.
                    if (candidateHint.beginElement != element) {
                        candidateHint.childNodes.push(element);
                    }

                    if (element.innerHTML.match(hintEndRegex)) {
                        // Simple text-only accordion hints will present in the DOM in a single node, so we check for the
                        // hint-end signifier in all elements after and including the hint-begin element.
                        // For example: <p>~hint This is the summary\nThis is some simple text\nhint~</p>

                        // Remove the hint-end signifier from the innerHTML since we don't want to render it.
                        // This is safe and does not effect sanitization.
                        element.innerHTML = element.innerHTML.replace("hint~", ""); // eslint-disable-line @microsoft/sdl/no-inner-html

                        accordionHints.push(candidateHint);
                        candidateHint = null;
                    }
                }
            }
            else if (candidateHint != null) {
                // We have a hint-begin node and this node is not a hint-end node, add it to the current hint's child nodes.
                candidateHint.childNodes.push(node);
            }
        }

        accordionHints.forEach((hint) => {
            // Create a 'details' element to replace the hint-begin element.
            const detailsElement = document.createElement('details');

            detailsElement.addEventListener("pointerdown", () => {
                const videoElements = detailsElement.querySelectorAll("video");
                for (const el of videoElements) {
                    if (!el.getAttribute("data-pip-active")) {
                        el.pause();
                    }
                }
            })
            detailsElement.addEventListener("keydown", fireClickOnEnter as any);
            // Append the summary element to the details element...
            detailsElement.append(hint.summary);
            // ...and any child nodes we detected along the way.
            hint.childNodes.forEach((accordianHintChildNode) => {
                detailsElement.appendChild(accordianHintChildNode);
            });

            hint.beginElement.parentNode.replaceChild(detailsElement, hint.beginElement);
        });
    }

    private renderOthers(content: HTMLElement) {
        // remove package blocks
        pxt.Util.toArray(content.querySelectorAll(`.lang-package,.lang-config,.lang-apis`))
            .forEach((langBlock: HTMLElement) => {
                langBlock.parentNode.removeChild(langBlock);
            });
    }

    renderMarkdown(markdown: string) {
        const content = this.contentRef;
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
            sanitize: true,
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
        this.renderVideo(tempDiv);

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

    handleContentRef = (ref: HTMLDivElement) => {
        if (!ref) return;

        this.contentRef = ref;
        if (this.props.contentRef) {
            this.props.contentRef(ref);
        }
    }

    renderCore() {
        const { className, tabIndex, } = this.props;

        return <div ref={this.handleContentRef} className={className || ""} tabIndex={tabIndex} />;
    }
}
