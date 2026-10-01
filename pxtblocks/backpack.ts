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

export interface BackpackDragTargetOptions {
    /** Resolve the host's current visible element, or omit this target. */
    getElement: () => HTMLElement | undefined;
    openOnHover?: boolean;
}

export interface BackpackWorkspaceOptions {
    isEnabled: () => boolean;
    canSave?: (block: Blockly.Block) => boolean;
    save: (block: Blockly.BlockSvg) => void;
    /** Open Backpack without taking keyboard focus away from the block being dragged. */
    open: () => void;
    dragTargets: BackpackDragTargetOptions[];
    hoverClass: string;
}

type State = Blockly.serialization.blocks.State;
const MAX_CODE_LENGTH = 100000;
const MAX_BLOCKS = 500;
const legacyProcedures = new Set(["procedures_defnoreturn", "procedures_callnoreturn", "procedures_defreturn", "procedures_callreturn"]);

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

/** Whether this editable block has a statement input that can be copied to Backpack. */
export function isBackpackContainer(block: Blockly.Block): boolean {
    return isEditableBackpackBlock(block) && !block.isShadow() && block.isMovable()
        && block.inputList.some(input => input.type === Blockly.inputs.inputTypes.STATEMENT);
}

/** Find the asset field on an output block, including blocks defined by extensions. */
export function getBackpackAssetField(block: Blockly.Block): Blockly.Field | undefined {
    if (!block || block.isDisposed() || !block.outputConnection || block.previousConnection || block.nextConnection
        || block.inputList.some(input => !!input.connection)) return undefined;
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
    return { code, blockText: [label, description].filter(text => !!text).join(" "), name: description || label };
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
    // The first experimental captures had no version. Their block states are unchanged.
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

/** Capture a container or asset literal, its dependencies, and displayed text. */
export function captureBackpackBlock(block: Blockly.Block): { code: string; blockText: string } {
    if (!isBackpackBlock(block)) {
        pxt.U.userError(lf("Choose an editable block container or an image, animation, tilemap or music asset to save to Backpack."));
    }
    const save = (source: Blockly.Block): State => copyBlock(source).blockState;
    const root = save(block);
    const states = [root];
    const included = new Set<Blockly.Block>([block]);
    for (let i = 0; i < states.length; i++) {
        // A bounded parse is performed below; guard expansion before following dependencies too.
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

    // Read the existing live fields, never load saved snippets or their mutation hooks for search.
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

/** All required types, including obscured shadows and nested next chains. */
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
    const replacements = new Map<string, { name: string; id: string; args: Map<string, string> }>();
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
        // Block IDs are never reusable, even for externally supplied valid items.
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
            if (state.fields && Object.prototype.hasOwnProperty.call(state.fields, "function_name")) state.fields.function_name = replacement.name;
            if (state.inputs) {
                const inputs: State["inputs"] = Object.create(null);
                for (const key of Object.keys(state.inputs)) inputs[replacement.args.get(key) || key] = state.inputs[key];
                state.inputs = inputs;
            }
        }
    });
}

/** Append dependencies and the selection in one undo group, at the drop point or viewport center. */
export function pasteBackpackBlock(code: string, workspace: Blockly.WorkspaceSvg, coordinates?: Blockly.utils.Coordinate,
    kind?: pxt.auth.BackpackKind): Blockly.BlockSvg {
    const { blocks } = parseBackpackCode(code); // A fresh object; never mutate the stored item.
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
        const center = coordinates || new Blockly.utils.Coordinate(view.left + view.width / 2, view.top + view.height / 2);
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
        // Dependencies have been installed before import; now the actual field is available.
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

interface WorkspaceRegistration {
    options: BackpackWorkspaceOptions;
    targets: BackpackDragTarget[];
    dispose: () => void;
}

const registrations = new Map<Blockly.Workspace, WorkspaceRegistration>();

class BackpackDragTarget extends Blockly.DragTarget {
    private hovered: HTMLElement;
    private timer: ReturnType<typeof setTimeout>;
    private frame: number;

    constructor(
        private workspace: Blockly.WorkspaceSvg,
        private options: BackpackWorkspaceOptions,
        private target: BackpackDragTargetOptions
    ) {
        super();
        this.id = Blockly.utils.idGenerator.genUid();
    }

    private element(): HTMLElement | undefined {
        return this.options.isEnabled() ? this.target.getElement() : undefined;
    }

    private accepts(draggable: Blockly.IDraggable): draggable is Blockly.BlockSvg {
        return draggable instanceof Blockly.BlockSvg && draggable.workspace === this.workspace
            && isBackpackBlock(draggable) && (!this.options.canSave || this.options.canSave(draggable));
    }

    getClientRect(): Blockly.utils.Rect | null {
        const rect = this.element()?.getBoundingClientRect();
        return rect ? new Blockly.utils.Rect(rect.top, rect.bottom, rect.left, rect.right) : null;
    }

    onDragEnter(draggable: Blockly.IDraggable): void {
        this.clear();
        if (!this.accepts(draggable)) return;
        const element = this.element();
        if (!element) return;
        this.hovered = element;
        element.classList.add(this.options.hoverClass);
        if (this.target.openOnHover) {
            this.timer = setTimeout(() => {
                this.timer = undefined;
                if (this.hovered !== element || this.element() !== element || !this.accepts(draggable)) {
                    this.clear();
                    return;
                }
                try {
                    this.options.open();
                } catch (error) {
                    pxt.reportException(error);
                }
                // Opening can change the layout even if the pointer remains stationary.
                this.frame = requestAnimationFrame(() => {
                    this.frame = undefined;
                    refreshBackpackDragTargets(this.workspace);
                });
            }, 500);
        }
    }

    onDragOver(draggable: Blockly.IDraggable): void {
        if (!this.accepts(draggable) || this.hovered !== this.element()) this.clear();
    }

    onDragExit(_draggable: Blockly.IDraggable): void {
        this.clear();
    }

    onDrop(draggable: Blockly.IDraggable): void {
        try {
            if (this.options.isEnabled() && this.accepts(draggable)) this.options.save(draggable);
        } catch (error) {
            // Do not interrupt native revertDrag if storage or the host callback fails.
            pxt.reportException(error);
        } finally {
            this.clear();
        }
    }

    shouldPreventMove(draggable: Blockly.IDraggable): boolean {
        // A save callback may disable the feature. The original must still be restored.
        return this.accepts(draggable);
    }

    clear(): void {
        if (this.timer !== undefined) clearTimeout(this.timer);
        if (this.frame !== undefined) cancelAnimationFrame(this.frame);
        this.timer = undefined;
        this.frame = undefined;
        this.hovered?.classList.remove(this.options.hoverClass);
        this.hovered = undefined;
    }
}

/** Internal dragger hook: do not record rectangles for workspaces that do not use the backpack. */
export function refreshBackpackDragTargets(workspace: Blockly.WorkspaceSvg): boolean {
    if (!registrations.has(workspace)) return false;
    workspace.recordDragTargets();
    return true;
}

/** Internal dragger hook, including keyboard cancellation and end paths without a target exit. */
export function clearBackpackDragState(workspace: Blockly.WorkspaceSvg): void {
    registrations.get(workspace)?.targets.forEach(target => target.clear());
}

/** Register workspace-scoped context actions and native, non-deleting drop targets. */
export function registerBackpackWorkspace(workspace: Blockly.WorkspaceSvg, options: BackpackWorkspaceOptions): () => void {
    registrations.get(workspace)?.dispose();
    const registry = Blockly.ContextMenuRegistry.registry;
    if (!registry.getItem("pxtBackpackSave")) {
        registry.register({
            id: "pxtBackpackSave",
            weight: 16,
            scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
            displayText: () => lf("Add to Backpack"),
            preconditionFn: scope => {
                const registration = registrations.get(scope.block?.workspace);
                if (!registration?.options.isEnabled()) return "hidden";
                if (registration.options.canSave && !registration.options.canSave(scope.block)) return "hidden";
                return isBackpackBlock(scope.block) ? "enabled" : "disabled";
            },
            callback: (scope: Blockly.ContextMenuRegistry.Scope) => {
                const registration = registrations.get(scope.block?.workspace);
                if (registration?.options.isEnabled() && isBackpackBlock(scope.block)
                    && (!registration.options.canSave || registration.options.canSave(scope.block))) {
                    registration.options.save(scope.block);
                }
            },
        });
    }
    const manager = workspace.getComponentManager();
    const targets = options.dragTargets.map(target => new BackpackDragTarget(workspace, options, target));
    for (const target of targets) {
        manager.addComponent({ component: target, capabilities: [Blockly.ComponentManager.Capability.DRAG_TARGET], weight: -1 });
    }
    const clear = (): void => targets.forEach(target => target.clear());
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === "Escape") clear(); };
    // Defer pointer-up cleanup until Blockly's synchronous drop processing has completed.
    const onPointerUp = (): void => { Promise.resolve().then(clear); };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointercancel", clear, true);
    document.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("blur", clear);
    let disposed = false;
    const dispose = (): void => {
        if (disposed) return;
        disposed = true;
        clear();
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("pointercancel", clear, true);
        document.removeEventListener("pointerup", onPointerUp, true);
        window.removeEventListener("blur", clear);
        targets.forEach(target => manager.removeComponent(target.id));
        registrations.delete(workspace);
        workspace.recordDragTargets();
    };
    registrations.set(workspace, { options, targets, dispose });
    workspace.recordDragTargets();
    return dispose;
}