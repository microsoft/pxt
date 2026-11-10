# Tagged Grid Pickers

A grid picker is the dropdown of image tiles that appears when a block lets you
choose from many options, such as a Minecraft block or mob.
When the list gets long, a flat grid becomes hard to scan. A **catalog** adds
tabs, collapsible groups, and search so that people can quickly find the choice
they want.

Catalogs are optional. A grid picker without a catalog works exactly as before.
Adding a catalog never changes the code a block generates or the value it saves.

## Key terms

| Term | What it means |
| --- | --- |
| **Choice** | One selectable option in the picker, such as `Block.Stone` or `MonsterMob.Zombie`. |
| **Tag** | A short label attached to a choice, such as `undead` or `group-swords`. Tags are how catalogs, tabs, groups, and filters decide which choices they include. |
| **Catalog** | A description of how to organize a picker: its tabs, its groups, and their display names. It lives in a JRES file and can be shared by many blocks. |
| **Tab** | A page across the top of the picker, such as *Construction* or *Animals*. A tab shows the choices that have all of its tags. |
| **All tab** | A final tab marked `flat: true` that lists every allowed choice, without grouping. Nothing can hide a choice from it. |
| **Group** | A set of related choices, such as *Swords* or *Planks*, shown as one tile that expands to reveal its members. This keeps big tabs short. |
| **Filter** | A restriction set on a block, not in the catalog. For example, a "choose a rider" block can allow only choices tagged `rider`. Tabs, groups, and search never show choices outside the block's filter. |
| **Weight** | An optional number that controls display order. Higher weights appear first. |

## Tagging choices

**Use case:** you want a mob picker to know that a Zombie is a monster, is
undead, and can ride other mobs, so that tabs and filters can find it.

Add tags to the API declaration:

```typescript
//% fixedInstance jres tags="character hero playable"
export const hero: Image = img`
    . 2 .
    2 2 2
    . 2 .
`;
```

Or add them to the choice's entry in its JRES file:

```json
{
    "Zombie": {
        "tags": ["category-monsters", "group-zombies", "rider", "mount"],
        "weight": 70
    }
}
```

Tags from both places are combined, so you can use whichever is more convenient.

## Using a catalog in a block

**Use case:** a Minecraft block that should only offer mobs that can ride, while
still letting players browse them by tab and search.

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

| Field option | Purpose |
| --- | --- |
| `catalog` | The JRES ID of the catalog to use. |
| `filter` | Space-separated tags that every choice must have. Prefix a tag with `!` to exclude it, for example `rider !undead`. |
| `columns` | How many tiles to show per row. |
| `width` | The picker's preferred width in pixels. |
| `enumNames` | Comma-separated enums to draw choices from, for parameters that are not tied to a single enum. |
| `fixedInstances` | Set to `true` to draw choices from fixed-instance variables (declared with `//% fixedInstance`) instead of an enum. |

**Use case:** a "choose mount" block that accepts both animals and monsters. The
parameter is a `number`, so `enumNames` tells the picker which enums to show:

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

## Defining a catalog

**Use case:** an extension that has many game images and wants to show them in
*Characters* and *Terrain* tabs, with heroes and enemies collapsed into groups.

Add a JRES file, such as `pickers.jres`, to the extension's `pxt.json` `files`
list:

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
            "groups": [
                { "id": "heroes", "name": "Heroes", "tags": ["hero"], "weight": 80 },
                { "id": "enemies", "name": "Enemies", "tags": ["enemy"], "weight": 60 }
            ]
        }
    }
}
```

Blocks then use `catalog=myExtension.pickers.gameImages`. No target
configuration is needed, and several extensions can each provide their own
catalogs. Use a namespace specific to your extension so that IDs don't collide.

Tabs and groups share the same shape:

| Property | Purpose |
| --- | --- |
| `id` | A stable identifier. |
| `name` | The display name. It is translated like other extension strings. |
| `tags` | The tags a choice needs to belong to this tab or group. |
| `icon` | Optional. A JRES ID or qualified symbol whose image is used as the icon. |
| `weight` | Optional. Controls display order. |
| `flat` | Tabs only. Shows every allowed choice without groups. Use it for the last tab. |

### How groups appear

Inside a tab, each group with two or more matching choices appears as a single
tile with a count badge. Selecting the tile expands the group's choices in a
tinted area below it. Choices that don't belong to any group appear as ordinary
tiles alongside the groups.

When someone searches, groups are expanded so that every match is visible.

## Ordering with weights

**Use case:** in the *Equipment* tab, show helmets before boots and put the most
common items at the front.

Set `weight` on tabs and groups in the catalog, or on individual choices in their
JRES entries. Higher weights appear first, and the default is `50`. Choices
without weights keep their original order.

```json
"groups": [
    { "id": "helmets", "name": "Helmets", "tags": ["group-helmets"], "weight": 100 },
    { "id": "boots", "name": "Boots", "tags": ["group-boots"], "weight": 97 }
]
```

## Translating catalog names

Catalog, tab, and group names are extracted into the extension's strings file
during localization, using keys like
`myExtension.pickers.gameImages|gridPicker|Heroes`. Include the translated
strings files in `pxt.json` as you would for other extension translations; see
[Add the translation files to the extension configuration](/extensions/localization#4-add-the-translation-files-to-the-extension-configuration)
in the extension localization guide.

## Picking fixed-instance images

**Use case:** an extension block that lets students pick one of the extension's
playable character images, without creating a separate enum.

With the catalog above and images tagged like `hero` in
[Tagging choices](#tagging-choices):

```typescript
namespace characterSelectors {
    //% block="spawn character $picture"
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

## Testing

After building the framework and webapp, run the picker, keyboard,
accessibility, and gallery-tag tests:

```sh
npx gulp cli
npx gulp webapp
npx gulp karma
node node_modules/typescript/bin/tsc -p pxtblocks --noEmit
```

`npx gulp karma` runs in Chrome and is part of the framework's full test chain.

## Agent Notes

Detailed behavior and edge cases, mainly for contributors and automated agents.

### Tags

- API `tags` and JRES `tags` are merged case-insensitively. JRES references and
  aliases resolve tags the same way they resolve icons.
- When adding tags to an existing JRES entry, keep its icon and data properties.

### Filters and values

- `filter` uses the same semantics as the image editor's gallery tag filter:
  every positive tag must match, and `!tag` excludes that tag. Untagged choices
  don't match a positive filter.
- The block's filter is a hard restriction, including on the All tab. A tab or
  search can narrow it further but never widen it.
- Without an explicit default, new blocks start with a choice that matches the
  filter. Explicit defaults and saved values are still restored even if they fall
  outside the field's current filter.
- Generated TypeScript and Python snippets use the same source choices and hard
  filter as new blocks, including toolbox weight ordering for fixed instances.
- Configured enum choices survive TypeScript-to-Blocks round trips. Field-option
  keys may use either the TypeScript parameter name or its name in the block
  definition.
- When migrating an older extension, keep its old enum declarations and block IDs
  for saved projects. New selector blocks can use the standard enum sources with
  tag filters.
- The stored value is always the original qualified symbol name. Tabs, groups,
  expanded state, and search terms never affect it.

### Catalog resolution

- The `catalog` option is the catalog's qualified JRES resource ID, formed by
  normal JRES namespace rules.
- A catalog can be shared by many fields. Each field's source enums and hard
  filter still determine which choices and tabs are available.
- Catalog `filters` entries are named metadata that is only used for
  localization. They don't add a UI control; blocks apply constraints through
  `fieldOptions.filter`.
- Catalog resources are not treated as image or JSON gallery assets.
- Missing or invalid catalogs are reported once per catalog, not once per field,
  and the field falls back to the plain filtered picker. It also falls back when
  no catalog tab is eligible.
- When the picker opens, it shows the first non-flat tab that contains the
  current value, or the first tab otherwise.

### Groups

- Each choice belongs to at most one group within a tab. The first matching group
  in the catalog's source order claims it, before weights are applied.
- A group with only one matching choice in a tab is shown as a loose tile, not a
  collapsible tile. Empty groups are not rendered.
- Group definitions are optional. Without them, choices are ungrouped.
- Only one group can be expanded at a time. Expanded choices are rendered in
  rows below the tile's row, without moving other tiles sideways, and they scroll
  with the rest of the picker.
- A group tile uses the group's `icon`. Without one, it shows the currently
  selected member, or else its first member.
- Keyboard navigation is scoped to the expanded group's rows, in both LTR and RTL.
- Choices are unique in search results, the All tab, and the result count.

### Search

- Every tab has search. Search matches a choice's label, value, and tags, and
  every word in the query must match.
- Hyphens and underscores are treated like spaces in both queries and indexed
  names and tags.
- Searching a grouped tab flattens its groups, so matches are never hidden inside
  collapsed tiles.

### Icons

- Ordinary MakeCode image resources can be used as icons without a separate PNG.
- For symbol references, an explicit API `iconURL` takes precedence over the
  resource's icon.

### Weights

- Larger weights appear first, and the default is `50`, like toolbox priorities.
  Zero and negative weights are supported. Equal or unspecified weights keep
  their source order, so no list of option IDs is needed.
- A choice's JRES weight takes precedence over its API `//% weight` annotation.
- Choice weights apply within expanded groups and to flat or search results.
  Group weights order group tiles independently of their members' weights. Loose
  choices can appear between group tiles according to their own weights.
- Weights affect presentation only, not tag matching, group membership,
  localization, or the stored value. Pickers without a catalog keep their
  original order.

### Localization

- Keys include the full resource ID, so different extensions can translate the
  same source title independently.
- Catalog labels use the package translation dictionary loaded for APIs. There is
  no separate catalog translation loader, and the JRES is never mutated.
- Bundled catalogs also contribute their source titles to target strings.
  Existing target-title translations remain a fallback, and missing translations
  use the original names.
- Localization never changes catalog IDs, tags, or stored choices.
