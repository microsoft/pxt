# Tagged Grid Pickers

The `gridpicker` field editor supports optional catalogs for browsing large sets of
assets. A catalog adds category tabs, collapsible families, material selection,
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
        "tags": ["category-monsters", "family-zombies", "rider", "mount"]
    }
}
```

Keep the resource's existing icon/data properties when adding tags.

## Field Options

```typescript
//% block="choose $mob"
//% mob.fieldEditor="gridpicker"
//% mob.fieldOptions.catalog=minecraftMobs
//% mob.fieldOptions.filter=rider
//% mob.fieldOptions.width=544 mob.fieldOptions.columns=8
//% mob.defl=MonsterMob.Zombie
export function chooseRider(mob: MonsterMob): number {
    return mob;
}
```

`filter` is a hard restriction, including on the Search tab. It uses the same
semantics as Arcade image-gallery tags: space-separated positive tags must all
match, and `!tag` excludes that tag. Untagged choices do not match a positive
filter. A UI filter can narrow a hard filter further, but cannot widen it.

For a numeric field that draws from existing enums, use `enumNames` instead of
declaring another enum:

```typescript
//% block="choose mount $mob"
//% mob.fieldEditor="gridpicker"
//% mob.fieldOptions.enumNames="AnimalMob,MonsterMob"
//% mob.fieldOptions.catalog=minecraftMobs
//% mob.fieldOptions.filter=mount
//% mob.defl=AnimalMob.Chicken
export function chooseMount(mob: number): number {
    return mob;
}
```

Existing APIs do not need to change their enum types. When migrating an older
extension, retain its old enum declarations and block IDs for saved projects.
New selector blocks can use the standard enum sources and tag filters.

## Target Catalogs

Targets configure catalogs under `runtime.gridPickerCatalogs` in their target
configuration. The catalog key is the field's `catalog` option.

```json
{
    "runtime": {
        "gridPickerCatalogs": {
            "gameImages": {
                "name": "Images",
                "tabs": [
                    { "id": "characters", "name": "Characters", "tags": ["character"] },
                    { "id": "terrain", "name": "Terrain", "tags": ["terrain"] },
                    { "id": "search", "name": "Search", "flat": true }
                ],
                "families": [
                    { "id": "heroes", "name": "Heroes", "tags": ["hero"] },
                    { "id": "enemies", "name": "Enemies", "tags": ["enemy"] }
                ],
                "filters": [
                    { "id": "playable", "name": "Playable", "tags": ["playable"] }
                ]
            }
        }
    }
}
```

Every tab has search. Searching a grouped tab expands the matching results rather
than concealing them inside collapsed families. The final tab should use
`flat: true`; it shows all choices allowed by the field's source types and hard
filter, without family compression. Unmatched families remain individually
available, so classification never removes assets from Search.

A tab may set `icon` to a JRES ID or qualified symbol with an icon. Use
`materials: true` to show the catalog's `materials` choices. Materials use the
same category shape (`id`, `name`, `tags`). The first material is selected
initially; Minecraft lists Copper first. Material selection only affects the
Materials tab.

## Arcade Example

With the `gameImages` target catalog above and tagged fixed-instance images, this
ordinary Arcade block can select existing gallery images:

```typescript
namespace gallerySelectors {
    //% block="spawn gallery character $picture"
    //% picture.fieldEditor="gridpicker"
    //% picture.fieldOptions.fixedInstances=true
    //% picture.fieldOptions.catalog=gameImages
    //% picture.fieldOptions.filter="character playable"
    //% picture.fieldOptions.columns=6 picture.fieldOptions.width=420
    export function spawnCharacter(picture: Image): Sprite {
        return sprites.create(picture, SpriteKind.Player);
    }
}
```

Use the existing image variables' tags or JRES metadata; no parallel enum is
needed. This opt-in setting does not replace Arcade's existing sprite editor.

## Minecraft Metadata

Run `npm run gridpicker` in the Minecraft target to refresh its category,
family, material, and capability tags. The normal enum generator also refreshes
this metadata after rebuilding JRES files. The tool preserves custom tags,
existing numeric values, runtime mappings, and icon data.

Rider and mount capability tags match the Riding extension's supported lists,
including its experimental zombified-piglin rider. They are picker capabilities,
not a guarantee that every rider/mount combination is supported by the game.

Minecraft layout, pixel rendering, fonts, borders, and inventory icons live in
the target. Core styling uses the target's existing semantic color variables,
including High Contrast, and remains reusable by other targets.

## Focused Checks

```sh
node tests/blocks-test/gridpicker.test.js
node node_modules/typescript/bin/tsc -p pxtblocks --noEmit
```

In the Minecraft target:

```sh
npm run gridpicker
node tools/new_enum_generator/tests/content.test.js HEAD
```

The local Minecraft browser checks cover family expansion without committing a
value, original enum-value selection and XML round trips, all 385 item choices
in flat Search, Copper-first Materials, empty-result keyboard navigation, four
tag-filtered riders, twenty combined-source mounts, the legacy no-catalog path,
pane bounds at 1280/640/390/320px widths, and High Contrast foreground/background
colors. The shipped Arcade and micro:bit editors are not modified by these checks.

Review the Minecraft category assignments and inventory appearance with the
Minecraft team before release. The Arcade block above is a target-configuration
example; it is not enabled automatically in the shipped Arcade editor.