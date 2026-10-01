import * as Blockly from "blockly";

type BlockState = Blockly.serialization.blocks.State;
const MAX_BLOCK_DEPTH = 100;
const MAX_BLOCK_COUNT = 500;

/** Visit connected blocks, including shadows hidden by another block. */
export function visitBlockStates(
    states: BlockState[],
    visit: (state: BlockState) => void,
    includeObscuredShadows = true
): void {
    const seen = new Set<BlockState>();
    const walk = (state: BlockState, depth: number): void => {
        if (!state || typeof state !== "object" || Array.isArray(state) || typeof state.type !== "string"
            || !state.type || ["__proto__", "constructor", "prototype"].includes(state.type)
            || seen.has(state)) {
            throw new Error("Invalid serialized block.");
        }
        if (depth > MAX_BLOCK_DEPTH || seen.size >= MAX_BLOCK_COUNT) {
            pxt.U.userError(lf("This snippet contains too many blocks or is nested too deeply. Try copying a smaller block container."));
        }

        seen.add(state);
        visit(state);
        for (const input of Object.values(state.inputs || {})) {
            if (input.shadow && (includeObscuredShadows || !input.block)) walk(input.shadow, depth + 1);
            if (input.block) walk(input.block, depth + 1);
        }
        if (state.next?.shadow && (includeObscuredShadows || !state.next.block)) walk(state.next.shadow, depth + 1);
        if (state.next?.block) walk(state.next.block, depth + 1);
    };

    for (const state of states) walk(state, 0);
}

/** Excludes hidden shadows from Blockly's block-type counts. */
export function blockCopyData(blockState: BlockState): Blockly.clipboard.BlockCopyData {
    const typeCounts: { [type: string]: number } = Object.create(null);
    visitBlockStates([blockState], state => {
        typeCounts[state.type] = (typeCounts[state.type] || 0) + 1;
    }, false);
    return { paster: Blockly.clipboard.BlockPaster.TYPE, blockState, typeCounts };
}

/** Copy a live block or a block in a headless asset editor. */
export function copyBlock(block: Blockly.Block): Blockly.clipboard.BlockCopyData {
    const data = block instanceof Blockly.BlockSvg
        ? block.toCopyData()
        : blockCopyData(Blockly.serialization.blocks.save(block, { addNextBlocks: false, saveIds: false }));
    if (!data) throw new Error("The block could not be copied.");

    return data;
}

export interface ClipboardPasteOptions {
    originalPosition?: Blockly.utils.Coordinate;
    screenPosition?: { x: number; y: number };
    workspacePosition?: Blockly.utils.Coordinate;
}

/** Use the supplied position, keep an in-view original position, or center the paste. */
export function pasteClipboardData(
    data: Blockly.ICopyData,
    workspace: Blockly.WorkspaceSvg,
    options: ClipboardPasteOptions = {}
): Blockly.ICopyable<Blockly.ICopyData> | null {
    const metrics = workspace.getMetricsManager();
    const { left, top, width, height } = metrics.getViewMetrics(true);
    let position = options.workspacePosition;

    if (!position && options.screenPosition) {
        const bounds = workspace.getInjectionDiv().getBoundingClientRect();
        const viewport = metrics.getViewMetrics();
        const offset = metrics.getAbsoluteMetrics();
        position = new Blockly.utils.Coordinate(
            left + (options.screenPosition.x - bounds.left - offset.left) / viewport.width * width,
            top + (options.screenPosition.y - bounds.top - offset.top) / viewport.height * height
        );
    }

    if (!position) {
        const original = options.originalPosition;
        const viewport = new Blockly.utils.Rect(top, top + height, left, left + width);
        if (!original || !viewport.contains(original.x, original.y)) {
            position = new Blockly.utils.Coordinate(left + width / 2, top + height / 2);
        }
    }

    return Blockly.clipboard.paste(data, workspace, position);
}
