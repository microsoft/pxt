import * as Blockly from "blockly";
import type { CommonFunctionBlock, FunctionDefinitionExtraState } from "./plugins/functions/commonFunctionMixin";
import {
    FUNCTION_CALL_BLOCK_TYPE,
    FUNCTION_CALL_OUTPUT_BLOCK_TYPE,
    FUNCTION_DEFINITION_BLOCK_TYPE,
} from "./plugins/functions/constants";

export interface BackpackCode {
    /** Dependency definitions first; the saved container is always last. */
    blocks: Blockly.serialization.blocks.State[];
}

export interface BackpackWorkspaceOptions {
    isEnabled: () => boolean;
    save: (block: Blockly.BlockSvg) => void;
    /** Open without moving focus (including when invoked by a dwell timer). */
    open: () => void;
}

type State = Blockly.serialization.blocks.State;
type JsonObject = { [key: string]: unknown };
const MAX_CODE_LENGTH = 100000;
const MAX_BLOCKS = 500;
const MAX_DEPTH = 100;
const forbiddenKeys = new Set(["__proto__", "constructor", "prototype"]);
const stateKeys = new Set([
    "type", "id", "x", "y", "collapsed", "deletable", "movable", "editable", "enabled",
    "disabledReasons", "inline", "data", "extraState", "icons", "fields", "inputs", "next",
]);

function invalidCode(): never {
    throw new Error(lf("This Backpack item contains invalid or unsupported blocks."));
}

function isObject(value: unknown): value is JsonObject {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function isName(value: unknown): value is string {
    return typeof value === "string" && !!value.length && !forbiddenKeys.has(value);
}

/** Only real, user-editable containers are eligible; following siblings are not part of the item. */
export function isBackpackContainer(block: Blockly.Block): boolean {
    return !!block && !block.isDisposed() && !block.isShadow() && !block.isInsertionMarker()
        && !block.isInFlyout && !block.workspace.isFlyout && !block.workspace.isMutator
        && !block.workspace.options.readOnly && block.isEditable() && block.isMovable()
        && block.inputList.some(input => input.type === Blockly.inputs.inputTypes.STATEMENT);
}

function isFunction(type: string): boolean {
    return type === FUNCTION_DEFINITION_BLOCK_TYPE || type === FUNCTION_CALL_BLOCK_TYPE
        || type === FUNCTION_CALL_OUTPUT_BLOCK_TYPE;
}

function isLegacyDefinition(type: string): boolean {
    return type === "procedures_defnoreturn";
}

function isLegacyCall(type: string): boolean {
    return type === "procedures_callnoreturn";
}

function legacyCallMutation(extra: unknown): Element {
    if (typeof extra !== "string") invalidCode();
    let mutation: Element;
    try {
        mutation = Blockly.utils.xml.textToDom(extra);
    } catch {
        invalidCode();
    }
    // PXT's registered call uses Blockly's XML fallback, not stock procedure JSON.
    if (mutation.tagName !== "mutation" || mutation.children.length || mutation.textContent.trim()
        || Array.from(mutation.attributes).some(attr => attr.name !== "name" && attr.name !== "xmlns")
        || !isName(mutation.getAttribute("name"))) invalidCode();
    return mutation;
}

function isDefinition(state: State): boolean {
    return state.type === FUNCTION_DEFINITION_BLOCK_TYPE || isLegacyDefinition(state.type);
}

function functionName(state: State): string | undefined {
    if (isFunction(state.type)) return state.extraState?.name;
    if (isLegacyDefinition(state.type) || isLegacyCall(state.type)) return state.fields?.NAME;
    return undefined;
}

function functionKey(state: State): string {
    return `${isFunction(state.type) ? "function" : "procedure"}:${functionName(state)}`;
}

function visitStates(states: State[], visit: (state: State) => void): void {
    for (const state of states) {
        visit(state);
        for (const input of Object.values(state.inputs || {})) {
            if (input.shadow) visitStates([input.shadow], visit);
            if (input.block) visitStates([input.block], visit);
        }
        if (state.next?.shadow) visitStates([state.next.shadow], visit);
        if (state.next?.block) visitStates([state.next.block], visit);
    }
}

/** Parse untrusted storage before calling any Blockly loaders or field/mutation hooks. */
export function parseBackpackCode(code: string): BackpackCode {
    if (typeof code !== "string" || code.length > MAX_CODE_LENGTH) invalidCode();
    let payload: unknown;
    try {
        payload = JSON.parse(code);
    } catch {
        invalidCode();
    }

    // Bound arbitrary field/asset/mutation JSON too, without imposing a schema on custom fields.
    const pending: { value: unknown; depth: number }[] = [{ value: payload, depth: 0 }];
    while (pending.length) {
        const { value, depth } = pending.pop();
        if (depth > MAX_DEPTH) invalidCode();
        if (value && typeof value === "object") {
            for (const key of Object.keys(value)) {
                if (forbiddenKeys.has(key)) invalidCode();
                pending.push({ value: (value as JsonObject)[key], depth: depth + 1 });
            }
        } else if (typeof value === "number" && !Number.isFinite(value)) invalidCode();
    }
    if (!isObject(payload) || Object.keys(payload).length !== 1
        || !Array.isArray(payload.blocks) || !payload.blocks.length) invalidCode();

    let count = 0;
    const checkConnection = (value: unknown, depth: number): void => {
        if (!isObject(value) || !Object.keys(value).length
            || Object.keys(value).some(key => key !== "block" && key !== "shadow")) invalidCode();
        if ("block" in value) checkState(value.block, depth);
        if ("shadow" in value) checkState(value.shadow, depth);
    };
    const checkState = (value: unknown, depth: number): void => {
        if (++count > MAX_BLOCKS || depth > MAX_DEPTH || !isObject(value) || !isName(value.type)
            || Object.keys(value).some(key => !stateKeys.has(key))) invalidCode();
        // These stock Blockly blocks are not supported by the PXT compiler.
        if (value.type === "procedures_defreturn" || value.type === "procedures_callreturn") invalidCode();
        for (const key of ["id", "data"]) {
            if (key in value && typeof value[key] !== "string") invalidCode();
        }
        for (const key of ["x", "y"]) {
            if (key in value && (typeof value[key] !== "number" || !Number.isFinite(value[key]))) invalidCode();
        }
        for (const key of ["collapsed", "deletable", "movable", "editable", "enabled", "inline"]) {
            if (key in value && typeof value[key] !== "boolean") invalidCode();
        }
        if ("disabledReasons" in value && (!Array.isArray(value.disabledReasons)
            || value.disabledReasons.some(reason => typeof reason !== "string"))) invalidCode();
        for (const key of ["fields", "icons", "inputs"]) {
            if (key in value && !isObject(value[key])) invalidCode();
        }
        if ("inputs" in value) {
            for (const input of Object.values(value.inputs as JsonObject)) checkConnection(input, depth + 1);
        }
        if ("next" in value) checkConnection(value.next, depth + 1);
        if ("extraState" in value && value.extraState !== null
            && typeof value.extraState !== "string" && !isObject(value.extraState)) invalidCode();

        if (isFunction(value.type)) {
            const extra = value.extraState;
            if (!isObject(extra) || !isName(extra.name) || !isName(extra.functionid)
                || !Array.isArray(extra.arguments)) invalidCode();
            const ids = new Set<string>();
            for (const arg of extra.arguments) {
                if (!isObject(arg) || !isName(arg.id) || !isName(arg.name) || !isName(arg.type)
                    || ids.has(arg.id)) invalidCode();
                ids.add(arg.id);
            }
        } else if (isLegacyCall(value.type)) {
            const mutation = legacyCallMutation(value.extraState);
            if (!isObject(value.fields) || !isName(value.fields.NAME)
                || value.fields.NAME !== mutation.getAttribute("name")) invalidCode();
        } else if (isLegacyDefinition(value.type)) {
            if (!isObject(value.fields) || !isName(value.fields.NAME)) invalidCode();
            const extra = value.extraState;
            if (extra != null && (!isObject(extra)
                || ("hasStatements" in extra && typeof extra.hasStatements !== "boolean")
                || ("params" in extra && (!Array.isArray(extra.params) || extra.params.some(param =>
                    !isObject(param) || !isName(param.name) || !isName(param.id)))))) invalidCode();
        }
    };
    for (const state of payload.blocks) checkState(state, 0);
    const result = payload as unknown as BackpackCode;
    const definitions = new Map<string, State>();
    result.blocks.forEach((state, index) => {
        if (state.next || (index < result.blocks.length - 1 && !isDefinition(state))) invalidCode();
        if (isDefinition(state)) {
            const key = functionKey(state);
            if (definitions.has(key)) invalidCode();
            definitions.set(key, state);
        }
    });
    visitStates(result.blocks, state => {
        if (isDefinition(state) && !result.blocks.includes(state)) invalidCode();
        if (state.type === FUNCTION_CALL_BLOCK_TYPE || state.type === FUNCTION_CALL_OUTPUT_BLOCK_TYPE
            || isLegacyCall(state.type)) {
            const definition = definitions.get(functionKey(state));
            if (!definition) invalidCode(); // Never silently create an empty function body.
            if (isFunction(state.type)) {
                if (JSON.stringify(state.extraState.arguments) !== JSON.stringify(definition.extraState.arguments)
                    || state.extraState.functionid !== definition.extraState.functionid) invalidCode();
            } else if (definition.extraState?.params?.length) {
                // PXT's legacy calls have no parameters; parameterized functions use the plugin.
                invalidCode();
            }
        }
    });
    return result;
}

/** Serialize just this container and its input bodies, plus transitive external function definitions. */
export function serializeBackpackBlock(block: Blockly.Block): string {
    if (!isBackpackContainer(block)) invalidCode();
    const save = (source: Blockly.Block): State => {
        const state = Blockly.serialization.blocks.save(source, {
            addCoordinates: false, addNextBlocks: false, doFullSerialization: true, saveIds: false,
        });
        if (!state) invalidCode();
        return state;
    };
    const root = save(block);
    const states = [root];
    const included = new Set<Blockly.Block>([block]);
    for (let i = 0; i < states.length; i++) {
        // A bounded parse is performed below; guard expansion before following dependencies too.
        if (states.length > MAX_BLOCKS || JSON.stringify({ blocks: states }).length > MAX_CODE_LENGTH) invalidCode();
        visitStates([states[i]], state => {
            if (state.type !== FUNCTION_CALL_BLOCK_TYPE && state.type !== FUNCTION_CALL_OUTPUT_BLOCK_TYPE
                && !isLegacyCall(state.type)) return;
            const definition = block.workspace.getTopBlocks(false).find(candidate => {
                if (isFunction(state.type)) {
                    return candidate.type === FUNCTION_DEFINITION_BLOCK_TYPE
                        && (candidate as CommonFunctionBlock).getName() === functionName(state);
                }
                // Only support the legacy project blocks actually installed in this target.
                return !!Blockly.Blocks[candidate.type] && isLegacyDefinition(candidate.type)
                    && candidate.getFieldValue("NAME") === functionName(state);
            });
            if (!definition) invalidCode();
            if (!included.has(definition)) {
                included.add(definition);
                states.push(save(definition));
            }
        });
    }
    const code = JSON.stringify({ blocks: [...states.slice(1), root] });
    parseBackpackCode(code);
    return code;
}

/** All required types, including obscured shadows and nested next chains. */
export function getBackpackBlockTypes(code: string): string[] {
    const types = new Set<string>();
    visitStates(parseBackpackCode(code).blocks, state => types.add(state.type));
    return Array.from(types);
}

function remapFunctions(states: State[], workspace: Blockly.Workspace): void {
    const names = new Set(workspace.getVariableMap().getAllVariables().map(variable => variable.getName().toLowerCase()));
    for (const block of workspace.getAllBlocks(false)) {
        const name = isFunction(block.type) ? (block as CommonFunctionBlock).getName()
            : isLegacyDefinition(block.type) ? block.getFieldValue("NAME")
            : isLegacyCall(block.type) ? (block as Blockly.Block & { getProcedureCall(): string }).getProcedureCall() : undefined;
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
        if (isFunction(state.type)) {
            for (const arg of (state.extraState as FunctionDefinitionExtraState).arguments) {
                args.set(arg.id, Blockly.utils.idGenerator.genUid());
            }
        }
        replacements.set(functionKey(state), { name, id: Blockly.utils.idGenerator.genUid(), args });
    }
    visitStates(states, state => {
        // Block IDs are never reusable, even for externally supplied valid items.
        delete state.id;
        delete state.x;
        delete state.y;
        const replacement = replacements.get(functionKey(state));
        if (!replacement) return;
        if (isFunction(state.type)) {
            const extra = state.extraState as FunctionDefinitionExtraState;
            extra.name = replacement.name;
            extra.functionid = replacement.id;
            extra.arguments = extra.arguments.map(arg => ({ ...arg, id: replacement.args.get(arg.id) }));
            if (state.fields && "function_name" in state.fields) state.fields.function_name = replacement.name;
            if (state.inputs) {
                const inputs: State["inputs"] = {};
                for (const key of Object.keys(state.inputs)) inputs[replacement.args.get(key) || key] = state.inputs[key];
                state.inputs = inputs;
            }
        } else if (isLegacyDefinition(state.type)) state.fields.NAME = replacement.name;
        else if (isLegacyCall(state.type)) {
            const mutation = legacyCallMutation(state.extraState);
            mutation.setAttribute("name", replacement.name);
            state.extraState = Blockly.utils.xml.domToText(mutation);
            // Blockly loads fields after extraState; both names must agree.
            state.fields.NAME = replacement.name;
        }
    });
}

/** Append dependency definitions before the container in one undo group, centered in the visible workspace. */
export function pasteBackpackBlock(code: string, workspace: Blockly.WorkspaceSvg): Blockly.BlockSvg {
    const { blocks } = parseBackpackCode(code); // A fresh object; never mutate the stored item.
    visitStates(blocks, state => {
        if (!Object.prototype.hasOwnProperty.call(Blockly.Blocks, state.type)) {
            throw new Error(lf("The block '{0}' is not available in this project. Add its extension before using this Backpack item.", state.type));
        }
    });
    if (workspace.options.readOnly || workspace.isFlyout || workspace.isMutator) invalidCode();
    remapFunctions(blocks, workspace);
    const group = Blockly.Events.getGroup();
    const existing = new Set(workspace.getAllBlocks(false));
    if (!group) Blockly.Events.setGroup(true);
    try {
        let root: Blockly.BlockSvg;
        const view = workspace.rendered ? workspace.getMetricsManager().getViewMetrics(true) : undefined;
        blocks.forEach((state, index) => {
            const appended = Blockly.serialization.blocks.append(state, workspace, { recordUndo: true });
            if (workspace.rendered) {
                const svg = appended as Blockly.BlockSvg;
                const size = svg.getHeightWidth();
                const position = svg.getRelativeToSurfaceXY();
                const offset = index === blocks.length - 1 ? 0 : (index + 1) * 40;
                svg.moveBy(view.left + view.width / 2 + (workspace.RTL ? size.width / 2 : -size.width / 2)
                    + offset - position.x, view.top + view.height / 2 - size.height / 2 + offset - position.y);
            }
            root = appended as Blockly.BlockSvg;
        });
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
const hoverClass = "project-backpack--drag-over";
const tabId = "project-tools-tab-backpack";
const panelId = "project-tools-backpack";
const launcherId = "project-tools-launcher";

function visibleElement(id: string): HTMLElement | undefined {
    const element = document.getElementById(id);
    if (!element || !element.isConnected || !element.getClientRects().length) return undefined;
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    if (style.visibility === "hidden" || style.visibility === "collapse" || style.display === "none") return undefined;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? element : undefined;
}

class BackpackDragTarget extends Blockly.DragTarget {
    private hovered: HTMLElement;
    private timer: ReturnType<typeof setTimeout>;
    private frame: number;

    constructor(private workspace: Blockly.WorkspaceSvg, private options: BackpackWorkspaceOptions, private elementId: string) {
        super();
        this.id = Blockly.utils.idGenerator.genUid();
    }

    private element(): HTMLElement | undefined {
        if (!this.options.isEnabled() || (this.elementId === launcherId && visibleElement(tabId))) return undefined;
        return visibleElement(this.elementId);
    }

    private accepts(draggable: Blockly.IDraggable): draggable is Blockly.BlockSvg {
        return draggable instanceof Blockly.BlockSvg && draggable.workspace === this.workspace
            && isBackpackContainer(draggable);
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
        element.classList.add(hoverClass);
        if (this.elementId !== panelId) {
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
        this.hovered?.classList.remove(hoverClass);
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
                return isBackpackContainer(scope.block) ? "enabled" : "disabled";
            },
            callback: (scope: Blockly.ContextMenuRegistry.Scope) => {
                const registration = registrations.get(scope.block?.workspace);
                if (registration?.options.isEnabled() && isBackpackContainer(scope.block)) {
                    registration.options.save(scope.block);
                }
            },
        });
    }
    const manager = workspace.getComponentManager();
    const targets = [tabId, panelId, launcherId].map(id => new BackpackDragTarget(workspace, options, id));
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