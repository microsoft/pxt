/// <reference path="../localtypings/blockly.d.ts" />
/// <reference path="../built/pxtlib.d.ts" />

namespace pxt.blocks {
    export function findRootBlocks(xmlDOM: Element, type?: string): Element[] {
        let blocks: Element[] = []
        for (const child in xmlDOM.children) {
            const xmlChild = xmlDOM.children[child];

            if (xmlChild.tagName === 'block') {
                if (type) {
                    const childType = xmlChild.getAttribute('type');

                    if (childType && childType === type) {
                        blocks.push(xmlChild)
                    }
                } else {
                    blocks.push(xmlChild)
                }
            } else {
                const childChildren = findRootBlock(xmlChild);
                if (childChildren) {
                    blocks = blocks.concat(childChildren)
                }
            }
        }
        return blocks;
    }

    export function findRootBlock(xmlDOM: Element, type?: string): Element {
        let blks = findRootBlocks(xmlDOM, type)
        if (blks.length)
            return blks[0]
        return null
    }
}
