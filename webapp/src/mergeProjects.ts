
/**
 * Takes an old version of a project with a new one and merges their assets together. The last
 * argument determines if the merged project uses the project code from the old project or the new one.
 *
 * @param previousProject The code from the "previous" project
 * @param newProject The code for the "new" project
 * @param carryoverCode True if the code from the previous project should be returned, false if the code from the new project should be used
 * @returns The merged project
 */
export function mergeProjectCode(previousProject: pxt.Map<string>, newProject: pxt.Map<string>, carryoverCode: boolean) {
    const configString = newProject[pxt.CONFIG_NAME];
    const config = pxt.U.jsonTryParse(configString) as pxt.PackageConfig;

    const tilemapJres = carryoverCode ?
        mergeJRES(newProject[pxt.TILEMAP_JRES], previousProject[pxt.TILEMAP_JRES]) :
        mergeJRES(previousProject[pxt.TILEMAP_JRES], newProject[pxt.TILEMAP_JRES]);
    const imageJres = carryoverCode ?
        mergeJRES(newProject[pxt.IMAGES_JRES], previousProject[pxt.IMAGES_JRES]) :
        mergeJRES(appendTemporaryAssets(previousProject[pxt.MAIN_BLOCKS], previousProject[pxt.IMAGES_JRES]), newProject[pxt.IMAGES_JRES]);

    if (tilemapJres && config?.files?.indexOf(pxt.TILEMAP_JRES) < 0) config.files.push(pxt.TILEMAP_JRES)
    if (imageJres && config?.files?.indexOf(pxt.IMAGES_JRES) < 0) config.files.push(pxt.IMAGES_JRES)

    return {
        ...newProject,
        [pxt.MAIN_TS]: carryoverCode ? previousProject[pxt.MAIN_TS] : newProject[pxt.MAIN_TS],
        [pxt.MAIN_PY]: carryoverCode ? previousProject[pxt.MAIN_PY] : newProject[pxt.MAIN_PY],
        [pxt.MAIN_BLOCKS]: carryoverCode ? previousProject[pxt.MAIN_BLOCKS] : newProject[pxt.MAIN_BLOCKS],
        [pxt.TILEMAP_JRES]: tilemapJres,
        [pxt.IMAGES_JRES]: imageJres,
        [pxt.CONFIG_NAME]: JSON.stringify(config)
    };
}

function mergeJRES(previous: string, next: string) {
    if (!previous) return next;
    if (!next) return previous;

    const previousParsed = JSON.parse(previous) as pxt.Map<pxt.JRes | string>;
    const nextParsed = JSON.parse(next) as pxt.Map<pxt.JRes | string>;

    const valueMap: pxt.Map<string> = {};
    const nameMap: pxt.Map<boolean> = {}
    const idMap: pxt.Map<boolean> = {};
    const tileMapping: pxt.Map<string> = {};
    const tilemapEntries: pxt.Map<pxt.JRes> = {};

    const defaultMime = (nextParsed["*"] as pxt.JRes).mimeType;

    // Loop over the base jres so that we can keep track of what ids, names,
    // and values are already present in the project
    for (const key of Object.keys(nextParsed)) {
        if (key === "*") continue;

        const current = nextParsed[key];
        idMap[key] = true;

        let valueString: string;
        let mimeType = defaultMime;
        let isTile = false;

        if (typeof current === "string") {
            valueString = current;
        }
        else {
            valueString = current.data;
            mimeType = current.mimeType;
            isTile = !!current.tilemapTile;

            if (current.displayName) nameMap[current.displayName] = true;
        }

        if (mimeType !== pxt.TILEMAP_MIME_TYPE) {
            const valueKey = mimeType + isTile + valueString;
            valueMap[valueKey] = key;
        }
    }


    for (const key of Object.keys(previousParsed)) {
        if (key === "*") continue;

        const current = previousParsed[key];

        let valueString: string;
        let displayName: string | undefined;
        let mimeType = defaultMime;
        let isTile = false;
        let isString = false;

        if (typeof current === "string") {
            valueString = current;
            isString = true;
        }
        else {
            valueString = current.data;
            displayName = current.displayName;
            mimeType = current.mimeType;
            isTile = !!current.tilemapTile;
        }

        // Skip duplicate images, tiles, and animations
        const valueKey = mimeType + isTile + valueString;
        if (valueMap[valueKey])  {
            if (isTile) tileMapping[pxt.sprite.TILE_NAMESPACE + "." + key] = pxt.sprite.TILE_NAMESPACE + "." + valueMap[valueKey];
            continue;
        }

        if (!displayName) {
            // The assets will disappear if they don't have a display name because they are
            // not referenced anywhere in the blocks project. We need to generate new names
            // for them to prevent that from happening

            switch (mimeType) {
                case pxt.IMAGE_MIME_TYPE:
                    displayName = isTile ? `${pxt.sprite.TILE_NAMESPACE}.${pxt.sprite.TILE_PREFIX}` :
                        `${pxt.sprite.IMAGES_NAMESPACE}.${pxt.sprite.IMAGE_PREFIX}` ;
                    break;
                case pxt.TILEMAP_MIME_TYPE:
                    displayName = "tilemap";
                    break;
                case pxt.ANIMATION_MIME_TYPE:
                    displayName = `${pxt.sprite.ANIMATION_NAMESPACE}.${pxt.sprite.ANIMATION_PREFIX}` ;
                    break;

            }
        }

        // Display names need to be unique
        if (displayName && nameMap[displayName]) {
            let index = 0;
            while (nameMap[displayName + index]) {
                index++;
            }
            displayName = displayName + index;
            nameMap[displayName] = true;
        }

        // Ids also need to be unique
        let id = key;
        if (idMap[id]) {
            let index = 0;
            while (idMap[id + index]) {
                index++;
            }
            id = id + index;
            idMap[id] = true;
            if (isTile) tileMapping[pxt.sprite.TILE_NAMESPACE + "." + key] = pxt.sprite.TILE_NAMESPACE + "." + id;
        }

        if (mimeType !== pxt.TILEMAP_MIME_TYPE) {
            valueMap[valueKey] = key;
        }

        const entry = {
            ...(isString ? {} : previousParsed[key] as pxt.JRes),
            data: valueString,
            displayName,
            mimeType
        } as any;

        // Only tilemap entries specify an id, other mimes just use the namespace + key
        if (entry.id) entry.id = id;

        if (mimeType === pxt.TILEMAP_MIME_TYPE) {
            tilemapEntries[id] = entry
        }
        else {
            nextParsed[id] = entry
        }
    }

    // If any tiles changed ids, we need to fix the tilemaps' tilesets to point to the new ids
    for (const key of Object.keys(tilemapEntries)) {
        const entry = tilemapEntries[key];
        entry.tileset = entry.tileset?.map(id => tileMapping[id] || id);
        nextParsed[key] = entry;
    }

    return JSON.stringify(nextParsed);
}

export function appendTemporaryAssets(blocks: string, assets: string) {
    if (!blocks) return assets;

    let jres = pxt.U.jsonTryParse(assets) as pxt.Map<Partial<pxt.JRes> | string> || {};
    if (!jres["*"]) {
        (jres as any)["*"] = {
            "mimeType": "image/x-mkcd-f4",
            "dataEncoding": "base64",
            "namespace": pxt.sprite.IMAGES_NAMESPACE
        };
    }

    // Regex image literals from blocks, append to existing JRes
    let index = 0;
    getImages(blocks)
        .forEach(data => {
            const id = pxt.Util.guidGen();
            while (jres[`${pxt.sprite.IMAGES_NAMESPACE}.${pxt.sprite.IMAGE_PREFIX}${index}`]) {
                index++;
            }
            jres[id] = {
                data: pxt.sprite.base64EncodeBitmap(data),
                mimeType: pxt.IMAGE_MIME_TYPE,
                displayName: `${pxt.sprite.IMAGES_NAMESPACE}.${pxt.sprite.IMAGE_PREFIX}${index}`
            }
            index++;
        });

    // Regex animations (array of image literals) from blocks, append to existing JRes
    index = 0;
    getAnimations(blocks)
        .forEach(anim => {
            const id = pxt.Util.guidGen();
            while (jres[`${pxt.sprite.ANIMATION_NAMESPACE}.${pxt.sprite.ANIMATION_NAMESPACE}${index}`]) {
                index++;
            }
            jres[id] = {
                data: pxt.sprite.encodeAnimationString(anim.frames, anim.interval),
                mimeType: pxt.ANIMATION_MIME_TYPE,
                displayName: `${pxt.sprite.ANIMATION_NAMESPACE}.${pxt.sprite.ANIMATION_PREFIX}${index}`
            }
            index++;
        });

    return JSON.stringify(jres)
}

/**
 *  <field name="FIELDNAME">img`
 *      . .
 *      . .
 *  `</field>
 */
function getImages(text: string): pxt.sprite.BitmapData[] {
    const imgRegex = /<field name=\"[\da-zA-Z]+\">\s*(img`[\s\da-f.#tngrpoyw]+`)\s*<\/field>/gim;
    const images: pxt.sprite.BitmapData[] = [];

    text.replace(imgRegex, (m, literal) => {
        const data = pxt.sprite.imageLiteralToBitmap(literal)?.data();
        if (data) images.push(data);
        return m;
    })

    return images;
}

/**
 *  <field name="FIELDNAME">[img`
 *      . .
 *      . .
 *  `,img`
 *      . .
 *      . .
 *  `]</field>
 */
function getAnimations(text: string): { frames: pxt.sprite.BitmapData[], interval: number}[] {
    const animRegex = /<field name=\"[\da-zA-Z]+\">\s*\[((?:img`[\s\da-f.#tngrpoyw]+`,?)+)\]\s*<\/field>(?:.*<shadow type=\"timePicker\"><field name=\"ms\">(\d+)<\/field><\/shadow>)?/gim;
    const literals: { frames: pxt.sprite.BitmapData[], interval: number}[] = [];

    text.replace(animRegex, (m, f, i) => {
        const frames: pxt.sprite.BitmapData[] = f.split(",")
            .map((el: string) => pxt.sprite.imageLiteralToBitmap(el)?.data());
        literals.push({
            frames: frames.filter(frame => !!frame),
            interval: i || 500
        });
        return m;
    })

    return literals;
}