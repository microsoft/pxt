export interface GalleryItem {
    qName: string;
    src: string;
    alt: string;
    tags: string[];
}

export function getBitmap(blocksInfo: pxtc.BlocksInfo, qName: string) {
    const sym = blocksInfo.apis.byQName[qName];
    const jresURL = sym.attributes.jresURL;
    let data = atob(jresURL.slice(jresURL.indexOf(",") + 1))
    let magic = data.charCodeAt(0);
    let w = data.charCodeAt(1);
    let h = data.charCodeAt(2);

    if (magic === 0x87) {
        magic = 0xe0 | data.charCodeAt(1);
        w = data.charCodeAt(2) | (data.charCodeAt(3) << 8);
        h = data.charCodeAt(4) | (data.charCodeAt(5) << 8);
        data = data.slice(4);
    }

    const out = new pxt.sprite.Bitmap(w, h);

    let index = 4
    if (magic === 0xe1) {
        // Monochrome
        let mask = 0x01
        let v = data.charCodeAt(index++)
        for (let x = 0; x < w; ++x) {
            for (let y = 0; y < h; ++y) {
                out.set(x, y, (v & mask) ? 1 : 0);
                mask <<= 1
                if (mask == 0x100) {
                    mask = 0x01
                    v = data.charCodeAt(index++)
                }
            }
        }
    }
    else {
        // Color
        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y += 2) {
                let v = data.charCodeAt(index++)
                out.set(x, y, v & 0xf);
                if (y != h - 1) {
                    out.set(x, y + 1, (v >> 4) & 0xf);
                }
            }
            while (index & 3) index++
        }
    }

    return out;
}

export function filterItems(target: GalleryItem[], tags: string[]) {
    tags = tags
        .filter(el => !!el)
        .map(el => el.toLowerCase());
    const includeTags = tags
        .filter(tag => tag.indexOf("!") !== 0);
    const excludeTags = tags
        .filter(tag => tag.indexOf("!") === 0 && tag.length > 1)
        .map(tag => tag.substring(1));

    return target.filter(el => checkInclude(el) && checkExclude(el));

    function checkInclude(item: GalleryItem) {
        return includeTags.every(filterTag => {
            const optFilterTag = `?${filterTag}`;
            return item.tags.some(tag =>
                tag === filterTag || tag === optFilterTag
            )
        });
    }

    function checkExclude(item: GalleryItem) {
        return excludeTags.every(filterTag =>
            !item.tags.some(tag => tag === filterTag)
        );
    }
}

export function getGalleryItems(blocksInfo: pxtc.BlocksInfo, qName: string): GalleryItem[] {
    const syms = getFixedInstanceDropdownValues(blocksInfo.apis, qName);
    generateIcons(syms);

    return syms.map(sym => {
        const splitTags = (sym.attributes.tags || "")
            .toLowerCase()
            .split(" ")
            .filter(el => !!el);

        return {
            qName: sym.qName,
            src: sym.attributes.iconURL,
            alt: sym.qName,
            tags: splitTags
        };
    });
}

function getFixedInstanceDropdownValues(apis: pxtc.ApisInfo, qName: string) {
    return pxt.Util.values(apis.byQName).filter(sym => sym.kind === pxtc.SymbolKind.Variable
        && sym.attributes.fixedInstance
        && isSubtype(apis, sym.retType, qName));
}

function isSubtype(apis: pxtc.ApisInfo, specific: string, general: string) {
    if (specific == general) return true
    let inf = apis.byQName[specific]
    if (inf && inf.extendsTypes)
        return inf.extendsTypes.indexOf(general) >= 0
    return false
}

function generateIcons(instanceSymbols: pxtc.SymbolInfo[]) {
    const imgConv = new pxt.ImageConverter();
    instanceSymbols.forEach(v => {
        if (v.attributes.jresURL && !v.attributes.iconURL && v.attributes.jresURL.indexOf("data:image/x-mkcd-f") == 0) {
            v.attributes.iconURL = imgConv.convert(v.attributes.jresURL)
        }
    });
}