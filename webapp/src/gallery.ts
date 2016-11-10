import * as core from "./core";

function parseMardown(md: string): { name: string; cards: pxt.CodeCard[] }[] {
    if (!md) return [];

    // second level titles are categories
    // ## foo bar
    // fenced code ```cards are sections of cards
    let galleries: { name: string; cards: pxt.CodeCard[] }[] = [];
    let incard = false;
    let cards: string = undefined;
    md.split('\n').forEach(line => {
        // new category
        if (/^##/.test(line)) {
            galleries.push({ name: line.substr(2).trim(), cards: undefined });
        } else if (/^```cards$/.test(line)) {
            incard = true;
        } else if (/^```$/.test(line)) {
            incard = false;
            if (cards) {
                galleries[galleries.length - 1].cards = JSON.parse(cards);
                cards = undefined;
            }
        } else if (incard)
            cards += line + '\n';
    })
    return galleries;
}

export function showGalleryAsync(name: string): Promise<void> {
    return pxt.Cloud.downloadMarkdownAsync(name, pxt.Util.userLanguage(), pxt.Util.localizeLive)
        .then(md => {
            const galleries = parseMardown(md);

        })
}