
namespace pxt.gallery {
    export interface Gallery {
        name: string;
        cards: pxt.CodeCard[];
    }

    export interface GalleryProject {
        name: string;
        filesOverride: pxt.Map<string>;
        dependencies: pxt.Map<string>;
        features?: string[];
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

    export function parseExampleMarkdown(name: string, md: string): GalleryProject {
        if (!md) return undefined;

        const m = /```(blocks?|typescript)\s+((.|\s)+?)\s*```/i.exec(md);
        if (!m) return undefined;

        const dependencies = parsePackagesFromMarkdown(md);
        const src = m[2];
        const features = parseFeaturesFromMarkdown(md);
        return {
            name,
            filesOverride: {
                "main.blocks": `<xml xmlns="http://www.w3.org/1999/xhtml"></xml>`,
                "main.ts": src
            },
            dependencies,
            features
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
        return pxt.Cloud.markdownAsync(name, pxt.Util.userLanguage(), pxt.Util.localizeLive)
            .then(md => parseGalleryMardown(md))
    }

    export function loadExampleAsync(name: string, path: string): Promise<GalleryProject> {
        return pxt.Cloud.markdownAsync(path, pxt.Util.userLanguage(), pxt.Util.localizeLive)
            .then(md => parseExampleMarkdown(name, md))
    }
}