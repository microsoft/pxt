
namespace pxt.gallery {
    export interface Gallery {
        name: string;
        cards: pxt.CodeCard[];
    }

    export interface GalleryProject {
        name: string;
        snippetType: string;
        source: string;
        filesOverride: pxt.Map<string>;
        dependencies: pxt.Map<string>;
        features?: string[];
        simTheme?: Partial<pxt.PackageConfig>;
    }

    export function parsePackagesFromMarkdown(md: string): pxt.Map<string> {
        const pm = /```package\s+((.|\s)+?)\s*```/i.exec(md);
        let dependencies: pxt.Map<string> = undefined;
        if (pm) {
            dependencies = {};
            pm[1].split('\n').map(s => s.replace(/\s*/g, '')).filter(s => !!s)
                .map(l => l.split('='))
                .forEach(kv => dependencies[kv[0]] = kv[1] || "*");
        }
        return dependencies;
    }

    export function parseFeaturesFromMarkdown(md: string): string[] {
        const pm = /```config\s+((.|\s)+?)\s*```/i.exec(md);
        let features: string[] = [];
        if (pm) {
            pm[1].split('\n').map(s => s.replace(/\s*/g, '')).filter(s => !!s)
                .map(l => l.split('='))
                .filter(kv => kv[0] == "feature" && !!kv[1])
                .forEach(kv => features.push(kv[1]));
        }
        return features.length ? features : undefined;
    }

    export function parseJResFromMarkdown(md: string): { jres: string, ts: string } {
        const pm = /```jres\s+((.|\s)+?)\s*```/i.exec(md);

        if (pm) {
            const jres = pm[1];
            const parsed = JSON.parse(jres);

            return {
                jres,
                ts: pxt.emitTilemapsFromJRes(parsed)
            };
        }

        return undefined;
    }

    export function parseTemplateProjectJSON(md: string): pxt.Map<string> {
        const pm = /```assetjson\s+((.|\s)+?)\s*```/i.exec(md);

        if (pm) {
            return pxt.tutorial.parseAssetJson(pm[1]);
        }

        return {};
    }
    export function parseSimThemeJSON(md: string): Partial<pxt.PackageConfig> {
        const pm = /```simtheme\s+([\s\S]*?)```/i.exec(md);

        if (pm) {
            return pxt.tutorial.parseSimThemeJson(pm[1]);
        }

        return {};
    }

    export function parseExampleMarkdown(name: string, md: string): GalleryProject {
        if (!md) return undefined;

        const m = /```(blocks?|typescript|python|spy|sim)\s+((.|\s)+?)\s*```/i.exec(md);
        if (!m) return undefined;

        const dependencies = parsePackagesFromMarkdown(md);
        const snippetType = m[1];
        const source = m[2];
        const features = parseFeaturesFromMarkdown(md);
        const jres = parseJResFromMarkdown(md);
        const simTheme = parseSimThemeJSON(md);

        const prj: GalleryProject = {
            name,
            filesOverride: {
                [pxt.MAIN_BLOCKS]: `<xml xmlns="http://www.w3.org/1999/xhtml"></xml>`,
                [m[1] === "python" ? pxt.MAIN_PY : pxt.MAIN_TS]: source
            },
            dependencies,
            features,
            snippetType,
            source,
            simTheme
        };

        prj.filesOverride = {
            ...prj.filesOverride,
            ...parseTemplateProjectJSON(md)
        }

        if (jres) {
            prj.filesOverride[pxt.TILEMAP_JRES] = jres.jres;
            prj.filesOverride[pxt.TILEMAP_CODE] = jres.ts;
        }

        return prj;
    }

    export function parseCodeCards(md: string): pxt.CodeCard[] {
        // try to parse code cards as JSON
        let cards = Util.jsonTryParse(md) as pxt.CodeCard[];
        if (cards && !Array.isArray(cards))
            cards = [cards];
        if (cards?.length)
            return cards;

        // not json, try parsing as sequence of key,value pairs, with line splits
        cards = md.split(/^---$/gm)
            .filter(cmd => !!cmd)
            .map(cmd => {
                let cc: any = {};
                cmd.replace(/^\s*(?:-|\*)\s+(\w+)\s*:\s*(.*)$/gm, (m, n, v) => {
                    if (n == "flags")
                        cc[n] = v.split(',')
                    else if (n === "otherAction") {
                        const parts: string[] = v.split(',').map((p: string) => p?.trim())
                        const oas = (cc["otherActions"] || (cc["otherActions"] = []));
                        oas.push({
                            url: parts[0],
                            editor: parts[1],
                            cardType: parts[2]
                        })
                    }
                    else
                        cc[n] = v
                    return ''
                })
                return !!Object.keys(cc).length && cc as pxt.CodeCard;
            })
            .filter(cc => !!cc);
        if (cards?.length)
            return cards;

        return undefined;
    }

    export function parseCodeCardsHtml(el: HTMLElement) {
        let cards: pxt.CodeCard[] = []

        // if there are UL/OL elements under el, it's the new format
        let card: any;
        Array.from(el.children)
            .forEach(child => {
                if (child.tagName === "UL" || child.tagName === "OL") {
                    if (!card)
                        card = {};
                    // read fields into card
                    Array.from(child.querySelectorAll("li"))
                        .forEach(field => {
                            const text = field.innerText;
                            const m = /^\s*(\w+)\s*:\s*(.*)$/.exec(text);
                            if (m) {
                                const k = m[1]
                                card[k] = m[2].trim();
                                if (k === "flags")
                                    card[k] = card[k].split(/,\s*/);
                            }
                        });
                } else if (child.tagName == "HR") {
                    // flush current card
                    if (card)
                        cards.push(card)
                    card = undefined;
                }
            })
        // flush last card
        if (card)
            cards.push(card);

        // try older format
        if (cards.length === 0 && el.tagName === "CODE") {
            // legacy JSON format
            cards = pxt.Util.jsonTryParse(el.textContent);
        }

        return !!cards?.length && cards;
    }

    export function parseGalleryMarkdown(md: string): Gallery[] {
        if (!md) return [];

        // second level titles are categories
        // ## foo bar
        // fenced code ```cards are sections of cards
        const galleries: { name: string; cards: pxt.CodeCard[] }[] = [];
        let incard = false;
        let name: string = undefined;
        let cardsSource: string = "";
        md.split(/\r?\n/).forEach(line => {
            // new category
            if (/^## /.test(line)) {
                name = line.substr(2).trim();
            } else if (/^(### ~ |```)codecard$/.test(line)) {
                incard = true;
            } else if (/^(### ~|```)$/.test(line)) {
                incard = false;
                if (name && cardsSource) {
                    const cards = parseCodeCards(cardsSource);
                    if (cards?.length)
                        galleries.push({ name, cards });
                    else
                        pxt.log(`invalid gallery format`)
                }
                cardsSource = "";
                name = undefined;
            } else if (incard)
                cardsSource += line + '\n';
        })
        // apply transformations
        galleries.forEach(gallery => gallery.cards.forEach(card => {
            if (card.otherActions && !card.otherActions.length
                && (card.cardType == "tutorial" || card.cardType == "example")) {
                const editors = ["js"];
                if (pxt.appTarget.appTheme.python) editors.unshift("py");
                card.otherActions = editors.map((editor: CodeCardEditorType) => (<CodeCardAction>{
                    url: card.url,
                    cardType: card.cardType,
                    editor
                }));
            }
        }))

        return galleries;
    }

    export function loadGalleryAsync(name: string): Promise<Gallery[]> {
        return pxt.Cloud.markdownAsync(name)
            .then(md => parseGalleryMarkdown(md))
    }

    export function codeCardsToMarkdown(cards: pxt.CodeCard[]) {
        const md = `### ~ codecard

${(cards || []).map(
            card => Object.keys(card)
                .filter(k => !!(<any>card)[k])
                .map(k => k === "otherActions"
                    ? otherActionsToMd((<any>card)[k])
                    : `* ${k}: ${(<any>card)[k]}`
                ).join('\n')
        )
                .join(
                    `

---

`)}

### ~
`
        return md;

        function otherActionsToMd(oas: pxt.CodeCardAction[]): string {
            return oas.map(oa => `* otherAction: ${oa.url}, ${oa.editor || ""}, ${oa.cardType || ""}`)
                .join('\n');
        }
    }
}
