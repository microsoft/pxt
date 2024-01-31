/// <reference path="../built/pxtlib.d.ts" />

export function getBlocksWithType(parent: Document | Element, type: string) {
    return getChildrenWithAttr(parent, "block", "type", type).concat(getChildrenWithAttr(parent, "shadow", "type", type));
}

export function getChildrenWithAttr(parent: Document | Element, tag: string, attr: string, value: string) {
    return pxt.Util.toArray(parent.getElementsByTagName(tag)).filter(b => b.getAttribute(attr) === value);
}

export function getFirstChildWithAttr(parent: Document | Element, tag: string, attr: string, value: string) {
    const res = getChildrenWithAttr(parent, tag, attr, value);
    return res.length ? res[0] : undefined;
}

export function getDirectChildren(parent: Element, tag: string) {
    const res: Element[] = [];
    for (let i = 0; i < parent.childNodes.length; i++) {
        const n = parent.childNodes.item(i) as Element;
        if (n.tagName === tag) {
            res.push(n);
        }
    }
    return res;
}

export function cleanOuterHTML(el: HTMLElement): string {
    // remove IE11 junk
    return el.outerHTML.replace(/^<\?[^>]*>/, '');
}