# Multi-stage code review

## Verdict

**COMMENT** — No verified Critical or High issues were found, but two Medium correctness gaps remain. The implementation is directionally sound, and `npx gulp build && npx gulp karma` passed 149 tests, but decompiler fallback configuration and color normalization should be corrected before approval.

## Verified findings

### 1. Medium · High confidence — `pxtcompiler/emitter/decompiler.ts:688-695,790-824`

Named contributed color pickers lose their configuration when decompiling a variable or other non-picker expression. The fallback becomes an empty `<shadow type="makecode_color_picker"/>`, omitting format, default channels, HSV/color state, and `duplicateondrag`.

**Impact:** Removing the overriding expression can reveal an RGB black picker with incorrect drag behavior, breaking text-to-block round trips.

**Remediation:** Construct decompiler fallbacks using the same complete picker configuration as toolbox generation. Add a variable-expression decompiler baseline.

### 2. Medium · High confidence — `pxtblocks/toolbox.ts:619-650`, `pxtblocks/plugins/colorpicker/colorPickerBlock.ts:260-278`

Picker previews and generated values use inconsistent numeric normalization. For example, converting the documented `0x7f3fbf` default through HSV produces fractional RGB channels; the preview rounds them to `#7F3FBF`, while `colorHelpers.rgb` truncates them to `0x7e3ebf`. Out-of-range standard number blocks similarly wrap in the preview but clamp at runtime.

**Impact:** The color shown in the editor can differ from the color executed by the program.

**Remediation:** Preserve exact RGB defaults where possible and centralize clamping/integer conversion across preview, generated literals, and runtime helpers. Assert compiled values instead of rounded editor fields.

### 3. Low · High confidence — `pxtblocks/plugins/colorpicker/colorPickerBlock.ts:36-45,228-278`

Ordinary `math_number` and `text` blocks are accepted for preview calculation, but preview activation only handles custom picker children. Numeric synchronization also ignores ordinary number blocks.

**Impact:** “Choose color” can silently do nothing, and changing formats can use stale HSV state rather than the displayed literal.

**Remediation:** Support ordinary literals consistently during activation and synchronization, or render the preview as non-actionable for unsupported children.

## Architecture

The branch turns the color picker into a configurable contributed builtin. Annotation metadata flows through block information into toolbox XML, where the picker’s format, channels, HSV state, color, and drag mutation are initialized. The picker treats HSV as its editing state and derives previews from literal inputs.

Duplicate-on-drag eligibility is now stored per block instance, serialized through mutation XML, and captured before a shadow is converted into a normal block. Webapp guards avoid promoting internal picker shadows during format changes, while Monaco now honors `blockHidden`.

Optional mutations preserve older workspace compatibility. The main architectural weakness is duplicated picker construction between toolbox and decompiler paths, which caused the fallback discrepancy.

## Examples

```ts
//% block="set color $color"
//% color.shadow=makecode_color_picker
//% color.fieldOptions.format=hex
//% color.defl=0x7f3fbf
export function setColor(color: number): void {}
```

The toolbox now creates a Hex picker displaying `#7F3FBF`, rather than a hard-coded RGB picker.

A named contributor can produce configured XML such as:

```xml
<shadow type="makecode_color_picker">
  <mutation color="#6554C0" duplicateondrag="true" />
  <field name="FORMAT">hex</field>
</shadow>
```

That configuration is preserved when the connected expression is itself a picker, but currently not when the expression is a variable.

## Validation gaps

- Add a decompiler case with a named picker receiving a variable; verify the complete fallback shadow.
- Compile and evaluate defaults in every format, particularly `0x7f3fbf`.
- Cover fractional and out-of-range standard number inputs.
- Test preview activation and format switching with ordinary `math_number` and `text` children.

## Discarded concerns

- Raw builtin contributor selection is potentially ambiguous, but no defined selection contract or demonstrated failure justified a finding.
- Moving color-picker XML construction out of generic toolbox code would improve ownership but is not a correctness requirement.
- Duplicate-on-drag state handling and the new `blockHidden` behavior were verified as coherent.
