
namespace pxt.gallery {
    export interface Gallery {
        name: string;
        cards: pxt.CodeCard[];
    }

    export interface GalleryProject {
        name: string;
        filesOverride: pxt.Map<string>;
        dependencies: pxt.Map<string>;
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

    export function parseExampleMarkdown(name: string, md: string): GalleryProject {
        if (!md) return undefined;

        const m = /```(blocks?|typescript)\s+((.|\s)+?)\s*```/i.exec(md);
        if (!m) return undefined;

        const dependencies = parsePackagesFromMarkdown(md);
        let src = m[2];

        // extract text between first sample and title
//        let comment = md.substring(0, m.index)
//            .replace(/^(#+.*|\s*)$/igm, '')
//            .trim();
//        if (comment) {
//            src = `/**
//${comment.split('\n').map(line => '* ' + line).join('\n')}
//*/
//` + src;
//        }

        return {
            name,
            filesOverride: {
                "main.blocks": `<xml xmlns="http://www.w3.org/1999/xhtml"></xml>`,
                "main.ts": src
            },
            dependencies
        };
    }

    export function parseGalleryMardown(md: string): Gallery[] {
        if (!md) return [];

        // second level titles are categories
        // ## foo bar
        // fenced code ```cards are sections of cards
        const galleries: { name: string; cards: pxt.CodeCard[] }[] = [];
        let incard = false;
        let name: string = undefined;
        let cards: string = "";
        md.split(/\r?\n/).forEach(line => {
            // new category
            if (/^##/.test(line)) {
                name = line.substr(2).trim();
            } else if (/^```codecard$/.test(line)) {
                incard = true;
            } else if (/^```$/.test(line)) {
                incard = false;
                if (name && cards) {
                    try {
                        const cardsJSON = JSON.parse(cards) as pxt.CodeCard[];
                        if (cardsJSON && cardsJSON.length > 0)
                            galleries.push({ name, cards: cardsJSON });
                    } catch (e) {
                        pxt.log('invalid card format in gallery');
                    }
                }
                cards = "";
                name = undefined;
            } else if (incard)
                cards += line + '\n';
        })
        return galleries;
    }

    export function loadGalleryAsync(name: string): Promise<Gallery[]> {
        return pxt.Cloud.downloadMarkdownAsync(name, pxt.Util.userLanguage(), pxt.Util.localizeLive)
            .then(md => parseGalleryMardown(md))
    }

    export function loadExampleAsync(name: string, path: string): Promise<GalleryProject> {
        return pxt.Cloud.downloadMarkdownAsync(path, pxt.Util.userLanguage(), pxt.Util.localizeLive)
            .then(md => parseExampleMarkdown(name, md))
    }
}