# Tagged Grid Pickers

The `gridpicker` field editor supports optional catalogs for browsing large sets of
assets. A catalog adds category tabs, collapsible families and materials,
tag filters, and search. Without a catalog, the existing flat picker is unchanged.

The picker stores the original qualified symbol name. Categories, tags, expanded
families, and search terms do not change the block's generated code or saved value.

## Tags

Choices can use the existing API `tags` annotation or their JRES resource's `tags`
array. Both are combined, case-insensitively. JRES references and aliases work the
same way as their icons.

```typescript
//% fixedInstance jres tags="character hero playable"
export const hero: Image = img`
    . 2 .
    2 2 2
    . 2 .
`;
```

```json
{
    "Zombie": {
        "tags": ["category-monsters", "family-zombies", "rider", "mount"],
        "weight": 70
    }
}
```

Keep the resource's existing icon/data properties when adding tags.

## Field Options

```typescript
//% block="choose $mob"
//% mob.fieldEditor="gridpicker"
//% mob.fieldOptions.catalog=minecraft.pickers.mobs
//% mob.fieldOptions.filter=rider
//% mob.fieldOptions.width=544 mob.fieldOptions.columns=8
//% mob.defl=MonsterMob.Zombie
export function chooseRider(mob: MonsterMob): number {
    return mob;
}
```

`filter` is a hard restriction, including on the All tab. It uses the same
semantics as Arcade image-gallery tags: space-separated positive tags must all
match, and `!tag` excludes that tag. Untagged choices do not match a positive
filter. A UI filter can narrow a hard filter further, but cannot widen it.
Without an explicit default, new blocks start with a matching choice. Explicit
defaults and saved values remain restorable even if they fall outside the field's
current filter.
Generated TypeScript and Python snippets use the same source choices and hard
filter as new blocks, including the toolbox weight ordering for fixed instances.

For a numeric field that draws from existing enums, use `enumNames` instead of
declaring another enum:

```typescript
//% block="choose mount $mob"
//% mob.fieldEditor="gridpicker"
//% mob.fieldOptions.enumNames="AnimalMob,MonsterMob"
//% mob.fieldOptions.catalog=minecraft.pickers.mobs
//% mob.fieldOptions.filter=mount
//% mob.defl=AnimalMob.Chicken
export function chooseMount(mob: number): number {
    return mob;
}
```

Existing APIs do not need to change their enum types. When migrating an older
extension, retain its old enum declarations and block IDs for saved projects.
New selector blocks can use the standard enum sources and tag filters.
Configured enum choices survive TypeScript-to-Blocks round trips. Field-option
keys may use either the TypeScript parameter name or its name in the block
definition.

## Library Catalogs

Libraries and extensions define catalogs in a JRES file listed in their
`pxt.json` files array. No target configuration is required. The normal JRES
namespace rules give each catalog a qualified resource ID; use that ID as the
field's `catalog` option.

For example, an extension can add `pickers.jres`:

```json
{
    "*": {
        "namespace": "myExtension.pickers",
        "mimeType": "application/x-makecode-grid-picker"
    },
    "gameImages": {
        "gridPickerCatalog": {
            "name": "Images",
            "tabs": [
                { "id": "characters", "name": "Characters", "tags": ["character"] },
                { "id": "terrain", "name": "Terrain", "tags": ["terrain"] },
                { "id": "search", "name": "All", "flat": true }
            ],
            "families": [
                { "id": "heroes", "name": "Heroes", "tags": ["hero"], "weight": 80 },
                { "id": "enemies", "name": "Enemies", "tags": ["enemy"], "weight": 60 }
            ],
            "filters": [
                { "id": "playable", "name": "Playable", "tags": ["playable"] }
            ]
        }
    }
}
```

The field then uses `catalog=myExtension.pickers.gameImages`. Multiple installed
packages can contribute independent catalogs; choose an extension-specific
namespace to avoid resource-ID collisions. A catalog can be shared by multiple
fields: source enums and each parent block's hard filter still determine which
choices and tabs are available.

Catalog `filters` entries describe named filter metadata. They do not add a
user-pickable control; the parent block applies its constraint through
`fieldOptions.filter`.

### Localization

The package localization generator extracts catalog, tab, family, material, and
filter names into the owning package's strings file. Keys include the full
resource ID, such as
`myExtension.pickers.gameImages|gridPicker|Heroes`, so different extensions may
translate the same source title independently. Include the translated strings
files in `pxt.json` as for other extension translations.
Catalog labels use the package translation dictionary loaded for APIs; there is
no separate catalog translation loader or mutable localized copy of the JRES.

Bundled catalogs also contribute their source titles to target strings. Existing
target-title translations remain a fallback, and missing translations use the
original names. Localization never changes catalog IDs, tags, or stored choices.

Every tab has search. Searching a grouped tab expands the matching results rather
than concealing them inside collapsed families. The final tab should use
`flat: true`; it shows all choices allowed by the field's source types and hard
filter, without family compression. Unmatched families remain individually
available, so classification never removes assets from All.
Hyphens and underscores are treated like spaces in both search queries and
indexed names and tags.

A tab may set `icon` to a JRES ID or qualified symbol with an icon. Use
`materials: true` to show the catalog's `materials` choices. Materials use the
same category shape (`id`, `name`, `tags`, optional `icon`). The Materials tab
shows a tile for every material represented by the field's allowed choices.
Expanding a tile reveals its choices in tinted rows below the tile's row, without
moving other tiles sideways. Only one group can be open at a time; its choices
scroll with the rest of the picker. Tiles follow the configured material order. Untagged choices remain
available under an expandable Other materials tile and in the flat All view.
Normal MakeCode image resources can be used as icons without a separate PNG.
For symbol references, an explicit API `iconURL` takes precedence over the
resource's icon.
Family and material definitions are optional: omitted families leave choices
ungrouped, and missing material definitions use Other materials. Empty groups
are not rendered.

Material groups may overlap intentionally, such as Wood and a specific wood
species. Choices remain unique in search results, the final All tab, and the
result count.

### Weights

Tabs, families, and materials may set an optional numeric `weight`. Individual
choices may set `weight` on their JRES resource entry, alongside `tags` and
`icon`. Larger weights appear first, with a default of `50`, like toolbox
priorities. Zero and negative weights are supported. Equal or unspecified
weights retain source order; no list of option IDs is needed.

A choice's JRES weight takes precedence over its API `//% weight` annotation.
Choice weights apply within expanded groups and to flat/search results. Group
weights order their parent tiles independently of their children's weights.
Loose choices can appear between group tiles according to their own weights.
Weight changes presentation, not tag matching, group membership, localization,
or the stored option value. Pickers without a catalog keep their legacy order.

## Framework tests

After building the framework and webapp, run `npx gulp karma` for the picker,
keyboard, accessibility, and shared gallery-tag regressions in Chrome. These
tests are included in the framework's full test chain and use its existing
browser runner.

## Arcade Example

With the library catalog above and tagged fixed-instance images, this
ordinary Arcade block can select existing gallery images:

```typescript
namespace gallerySelectors {
    //% block="spawn gallery character $picture"
    //% picture.fieldEditor="gridpicker"
    //% picture.fieldOptions.fixedInstances=true
    //% picture.fieldOptions.catalog=myExtension.pickers.gameImages
    //% picture.fieldOptions.filter="character playable"
    //% picture.fieldOptions.columns=6 picture.fieldOptions.width=420
    export function spawnCharacter(picture: Image): Sprite {
        return sprites.create(picture, SpriteKind.Player);
    }
}
```

Use the existing image variables' tags or JRES metadata; no parallel enum is
needed. This opt-in setting does not replace Arcade's existing sprite editor.

## Focused Checks

```sh
npx gulp cli
npx gulp webapp
npx gulp karma
node node_modules/typescript/bin/tsc -p pxtblocks --noEmit
```
