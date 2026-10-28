import * as Blockly from "blockly";
import type { FieldCustom } from "./fields/field_utils";
import type { CommonFunctionBlock, FunctionDefinitionExtraState } from "./plugins/functions/commonFunctionMixin";
import { blockCopyData, copyBlock, pasteClipboardData, visitBlockStates } from "./clipboard";
import {
    FUNCTION_CALL_BLOCK_TYPE,
    FUNCTION_CALL_OUTPUT_BLOCK_TYPE,
    FUNCTION_DEFINITION_BLOCK_TYPE,
} from "./plugins/functions/constants";

export interface BackpackCode {
    version: 1;
    /** Dependency definitions first; the selected block is always last. */
    blocks: Blockly.serialization.blocks.State[];
}

type State = Blockly.serialization.blocks.State;
const MAX_CODE_LENGTH = 100000;
const MAX_BLOCKS = 500;
const legacyProcedures = new Set([
    "procedures_defnoreturn",
    "procedures_callnoreturn",
    "procedures_defreturn",
    "procedures_callreturn"
]);

function invalidCode(): never {
    throw new Error("This Backpack item contains invalid or unsupported blocks.");
}

function checkCodeSize(length: number): void {
    if (length > MAX_CODE_LENGTH) {
        pxt.U.userError(lf("This snippet is too large for Backpack ({0} characters; limit {1}). This includes its supporting functions and assets. Try saving a smaller block container.", length, MAX_CODE_LENGTH));
    }
}

function tooManyBlocks(): never {
    return pxt.U.userError(lf("This snippet contains too many blocks for Backpack. The limit is {0} blocks, including supporting functions. Try saving a smaller block container.", MAX_BLOCKS));
}

function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function isEditableBackpackBlock(block: Blockly.Block): boolean {
    return !!block && !block.isDisposed() && !block.isInsertionMarker()
        && !block.isInFlyout && !block.workspace.isFlyout && !block.workspace.isMutator
        && !block.workspace.options.readOnly && block.isEditable()
        && !legacyProcedures.has(block.type);
}

export function isBackpackContainer(block: Blockly.Block): boolean {
    return isEditableBackpackBlock(block) && !block.isShadow() && block.isMovable()
        && block.inputList.some(input => input.type === Blockly.inputs.inputTypes.STATEMENT);
}

export function getBackpackAssetField(block: Blockly.Block): Blockly.Field | undefined {
    if (!block || block.isDisposed() || !block.outputConnection || block.previousConnection || block.nextConnection
        || block.inputList.some(input => !!input.connection))
        return undefined;

    const fields = block.inputList.reduce<Blockly.Field[]>((all, input) => all.concat(input.fieldRow), [])
        .filter(field => field.EDITABLE && field.SERIALIZABLE);
    return fields.length === 1 && (fields[0] as Blockly.Field & Partial<FieldCustom>).isBackpackAsset ? fields[0] : undefined;
}

export function getBackpackAssetFields(block: Blockly.Block): Blockly.Field[] {
    if (!block || block.isDisposed()) return [];
    return block.inputList.reduce<Blockly.Field[]>((fields, input) => fields.concat(input.fieldRow), [])
        .filter(field => field.EDITABLE && field.SERIALIZABLE
            && !!(field as Blockly.Field & Partial<FieldCustom>).isBackpackAsset);
}

export function getBackpackCaptureKind(block: Blockly.Block): pxt.auth.BackpackKind {
    return isBackpackContainer(block) ? "code" : getBackpackAssetFields(block).length ? "asset" : "code";
}

/** Asset shadows can be copied without detaching them from their owning statement. */
export function isBackpackBlock(block: Blockly.Block): boolean {
    return isEditableBackpackBlock(block) && (isBackpackContainer(block)
        || !!getBackpackAssetFields(block).length && (block.isShadow() || block.isMovable()));
}

export interface BackpackAssetCapture {
    code: string;
    blockText: string;
    name: string;
}

/** Save a field in its matching standalone asset block, without copying its parent. */
export function captureBackpackAsset(field: Blockly.Field, info: pxtc.BlocksInfo): BackpackAssetCapture {
    const block = field.getSourceBlock();
    if (!isBackpackBlock(block) || !getBackpackAssetFields(block).includes(field)) invalidCode();

    const symbol = info.blocksById[block.type];
    const parameter = symbol && pxt.blocks.compileInfo(symbol).definitionNameToParam[field.name];
    if (!parameter?.fieldEditor) {
        return pxt.U.userError(lf("This asset cannot be saved separately in this editor."));
    }

    const candidates = info.blocks
        .filter(candidate => candidate.attributes.shim === "TD_ID"
            && candidate.retType === parameter.type && !candidate.attributes.deprecated
            && !!Blockly.Blocks[candidate.attributes.blockId])
        .map(candidate => ({ symbol: candidate, parameters: pxt.blocks.compileInfo(candidate).parameters }))
        .filter(candidate => candidate.parameters.length === 1
            && candidate.parameters[0].fieldEditor === parameter.fieldEditor)
        .sort((left, right) => Number(!!left.symbol.attributes.blockHidden) - Number(!!right.symbol.attributes.blockHidden)
            || (right.symbol.attributes.weight || 50) - (left.symbol.attributes.weight || 50));
    const standalone = candidates[0];
    if (!standalone) {
        return pxt.U.userError(lf("This asset cannot be saved separately in this editor."));
    }

    const label = (parameter.labelLocalizationKey && pxtc.getBlockTranslationsCacheKey(parameter.labelLocalizationKey))
        || parameter.label || parameter.actualName;
    const description = (field as Blockly.Field & Partial<FieldCustom>).getFieldDescription?.() || field.getText();
    const state: State = {
        type: standalone.symbol.attributes.blockId,
        fields: { [standalone.parameters[0].definitionName]: field.saveState(true) }
    };
    const code = JSON.stringify({ version: 1, blocks: [state] });
    parseBackpackCode(code);

    return {
        code,
        blockText: [label, description].filter(text => !!text).join(" "),
        name: description || label
    };
}

function isFunction(type: string): boolean {
    return type === FUNCTION_DEFINITION_BLOCK_TYPE || type === FUNCTION_CALL_BLOCK_TYPE
        || type === FUNCTION_CALL_OUTPUT_BLOCK_TYPE;
}

function isDefinition(state: State): boolean {
    return state.type === FUNCTION_DEFINITION_BLOCK_TYPE;
}

function functionName(state: State): string | undefined {
    if (isFunction(state.type)) return state.extraState?.name;
    return undefined;
}

export function parseBackpackCode(code: string): BackpackCode {
    if (typeof code !== "string") invalidCode();
    checkCodeSize(code.length);

    let payload: unknown;
    try {
        payload = JSON.parse(code);
    } catch {
        invalidCode();
    }

    if (!isObject(payload)
        || !Array.isArray(payload.blocks) || !payload.blocks.length) invalidCode();

    // Accept unversioned captures as version 1.
    if (payload.version !== undefined && payload.version !== 1) {
        return pxt.U.userError(lf("This saved item uses an unsupported Backpack format. Update the editor or save a new copy from your project."));
    }

    const result: BackpackCode = { version: 1, blocks: payload.blocks };
    const definitions = new Map<string, State>();
    result.blocks.forEach((state, index) => {
        if (!state) invalidCode();
        if (state.next || (index < result.blocks.length - 1 && !isDefinition(state))) invalidCode();
        if (isDefinition(state)) {
            const key = functionName(state);
            if (definitions.has(key)) invalidCode();
            definitions.set(key, state);
        }
    });

    visitBlockStates(result.blocks, state => {
        if (legacyProcedures.has(state.type)) {
            pxt.U.userError(lf("Legacy procedure blocks are not supported by Backpack. Recreate them with Functions blocks before saving."));
        }
        if (isDefinition(state) && !result.blocks.includes(state)) invalidCode();
        if (state.type === FUNCTION_CALL_BLOCK_TYPE || state.type === FUNCTION_CALL_OUTPUT_BLOCK_TYPE) {
            const definition = definitions.get(functionName(state));
            if (!definition) {
                throw new Error(`The function '${functionName(state)}' is missing from this snippet.`);
            }
        }
    });
    return result;
}

/** Include referenced function definitions, but not statements following the selected block. */
export function captureBackpackBlock(block: Blockly.Block): { code: string; blockText: string } {
    if (!isBackpackBlock(block)) {
        pxt.U.userError(lf("Choose an editable block container or an image, animation, tilemap or music asset to save to Backpack."));
    }

    const save = (source: Blockly.Block): State => copyBlock(source).blockState;
    const root = save(block);
    const states = [root];
    const included = new Set<Blockly.Block>([block]);

    for (let i = 0; i < states.length; i++) {
        // Enforce size limits while collecting dependencies, before the final parse.
        if (states.length > MAX_BLOCKS) tooManyBlocks();
        checkCodeSize(JSON.stringify({ version: 1, blocks: states }).length);
        visitBlockStates([states[i]], state => {
            if (state.type !== FUNCTION_CALL_BLOCK_TYPE && state.type !== FUNCTION_CALL_OUTPUT_BLOCK_TYPE) return;
            const definition = block.workspace.getTopBlocks(false).find(candidate =>
                candidate.type === FUNCTION_DEFINITION_BLOCK_TYPE
                && (candidate as CommonFunctionBlock).getName() === functionName(state));
            if (!definition) {
                throw new Error(`The function '${functionName(state)}' is missing from this project.`);
            }
            if (!included.has(definition)) {
                included.add(definition);
                states.push(save(definition));
            }
        });
    }

    const code = JSON.stringify({ version: 1, blocks: [...states.slice(1), root] });
    parseBackpackCode(code);

    // Capture text from live fields so searching never needs to deserialize blocks.
    const text = new Set<string>();
    const seen = new Set<Blockly.Block>();
    const pending = Array.from(included);
    while (pending.length) {
        const current = pending.pop();
        if (seen.has(current)) continue;
        seen.add(current);
        for (const input of current.inputList) {
            for (const field of input.fieldRow) {
                const custom = field as Blockly.Field & { getFieldDescription?: () => string };
                const value = (custom.getFieldDescription ? custom.getFieldDescription() : field.getText())
                    ?.replace(/\s+/g, " ").trim();
                if (value) text.add(value);
            }
            // Follow input bodies and their statement chains, but not a root's following siblings.
            for (let child = input.connection?.targetBlock(); child; child = child.getNextBlock()) {
                pending.push(child);
            }
        }
    }
    return { code, blockText: Array.from(text).join(" ").slice(0, MAX_CODE_LENGTH) };
}

/** Includes hidden shadows and nested statement chains. */
export function getBackpackBlockTypes(code: string): string[] {
    const types = new Set<string>();
    visitBlockStates(parseBackpackCode(code).blocks, state => types.add(state.type));
    return Array.from(types);
}

function remapFunctions(states: State[], workspace: Blockly.Workspace): void {
    const names = new Set(workspace.getVariableMap().getAllVariables().map(variable => variable.getName().toLowerCase()));
    for (const block of workspace.getAllBlocks(false)) {
        const name = isFunction(block.type) ? (block as CommonFunctionBlock).getName() : undefined;
        if (name) names.add(name.toLowerCase());
    }

    const replacements = new Map<string, {
        name: string;
        id: string;
        args: Map<string, string>
    }>();
    for (const state of states.filter(isDefinition)) {
        const original = functionName(state);
        let name = original;
        let suffix = 2;
        while (names.has(name.toLowerCase())) name = original + suffix++;
        names.add(name.toLowerCase());
        const args = new Map<string, string>();
        for (const arg of (state.extraState as FunctionDefinitionExtraState).arguments) {
            args.set(arg.id, Blockly.utils.idGenerator.genUid());
        }
        replacements.set(functionName(state), { name, id: Blockly.utils.idGenerator.genUid(), args });
    }

    visitBlockStates(states, state => {
        // Discard saved IDs to avoid collisions in the destination workspace.
        delete state.id;
        delete state.x;
        delete state.y;
        const replacement = replacements.get(functionName(state));
        if (!replacement) return;
        if (isFunction(state.type)) {
            const extra = state.extraState as FunctionDefinitionExtraState;
            extra.name = replacement.name;
            extra.functionid = replacement.id;
            extra.arguments = extra.arguments.map(arg => ({ ...arg, id: replacement.args.get(arg.id) }));
            if (state.fields && Object.prototype.hasOwnProperty.call(state.fields, "function_name"))
                state.fields.function_name = replacement.name;
            if (state.inputs) {
                const inputs: State["inputs"] = Object.create(null);
                for (const key of Object.keys(state.inputs))
                    inputs[replacement.args.get(key) || key] = state.inputs[key];
                state.inputs = inputs;
            }
        }
    });
}

/** Append dependencies and the selection in one undo group, at the drop point or viewport center. */
export function pasteBackpackBlock(
    code: string,
    workspace: Blockly.WorkspaceSvg,
    coordinates?: Blockly.utils.Coordinate,
    kind?: pxt.auth.BackpackKind
): Blockly.BlockSvg {
    const { blocks } = parseBackpackCode(code);
    visitBlockStates(blocks, state => {
        if (!Object.prototype.hasOwnProperty.call(Blockly.Blocks, state.type)) {
            pxt.U.userError(lf("The block '{0}' is not available in this project. Add its extension before using this Backpack item.", state.type));
        }
    });
    if (workspace.options.readOnly || workspace.isFlyout || workspace.isMutator) invalidCode();
    remapFunctions(blocks, workspace);

    const group = Blockly.Events.getGroup();
    const existing = new Set(workspace.getAllBlocks(false));
    if (!group) Blockly.Events.setGroup(true);
    try {
        let root: Blockly.BlockSvg;
        const view = workspace.getMetricsManager().getViewMetrics(true);
        const center = coordinates || new Blockly.utils.Coordinate(
            view.left + view.width / 2,
            view.top + view.height / 2
        );
        for (const [index, state] of blocks.entries()) {
            const offset = index === blocks.length - 1 ? 0 : (index + 1) * 40;
            const appended = pasteClipboardData(blockCopyData(state), workspace, {
                workspacePosition: new Blockly.utils.Coordinate(center.x + offset, center.y + offset)
            });
            if (!(appended instanceof Blockly.BlockSvg)) {
                return pxt.U.userError(lf("There is not enough room in this workspace for these blocks."));
            }
            root = appended;
        }

        // Check the asset kind against the loaded field, which may come from an extension.
        if (kind && (kind === "asset") !== !!getBackpackAssetField(root)) invalidCode();
        return root;
    } catch (error) {
        // Custom mutation/field loaders can throw after creating a partial block.
        for (const block of workspace.getTopBlocks(false)) {
            if (!existing.has(block)) block.dispose(false);
        }
        throw error;
    } finally {
        Blockly.Events.setGroup(group);
    }
}
