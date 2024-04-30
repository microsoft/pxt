/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from "blockly";

import { DUPLICATE_ON_DRAG_MUTATION_KEY } from "./duplicateOnDrag";
import eventUtils = Blockly.Events;
import Coordinate = Blockly.utils.Coordinate;
import dom = Blockly.utils.dom;

const BLOCK_LAYER = 50; // not exported by blockly

/** Represents a nearby valid connection. */
interface ConnectionCandidate {
    /** A connection on the dragging stack that is compatible with neighbour. */
    local: Blockly.RenderedConnection;

    /** A nearby connection that is compatible with local. */
    neighbour: Blockly.RenderedConnection;

    /** The distance between the local connection and the neighbour connection. */
    distance: number;
}

export class DuplicateOnDragStrategy implements Blockly.IDragStrategy {
    private workspace: Blockly.WorkspaceSvg;

    /** The parent block at the start of the drag. */
    private startParentConn: Blockly.RenderedConnection | null = null;

    /**
     * The child block at the start of the drag. Only gets set if
     * `healStack` is true.
     */
    private startChildConn: Blockly.RenderedConnection | null = null;

    private startLoc: Coordinate | null = null;

    private connectionCandidate: ConnectionCandidate | null = null;

    private connectionPreviewer: Blockly.IConnectionPreviewer | null = null;

    private dragging = false;

    /**
     * If this is a shadow block, the offset between this block and the parent
     * block, to add to the drag location. In workspace units.
     */
    private dragOffset = new Coordinate(0, 0);

    constructor(private block: Blockly.BlockSvg) {
        this.workspace = block.workspace;
    }

    /** Returns true if the block is currently movable. False otherwise. */
    isMovable(): boolean {
        if (this.block.isShadow()) {
            return this.block.getParent()?.isMovable() ?? false;
        }

        return (
            this.block.isOwnMovable() &&
            !this.block.isDeadOrDying() &&
            !this.workspace.options.readOnly &&
            // We never drag blocks in the flyout, only create new blocks that are
            // dragged.
            !this.block.isInFlyout
        );
    }

    /**
     * Handles any setup for starting the drag, including disconnecting the block
     * from any parent blocks.
     */
    startDrag(e?: PointerEvent): void {
        if (this.block.isShadow()) {
            this.startDraggingShadow(e);
            return;
        }

        this.dragging = true;
        if (!eventUtils.getGroup()) {
            eventUtils.setGroup(true);
        }
        this.fireDragStartEvent();

        this.startLoc = this.block.getRelativeToSurfaceXY();

        const previewerConstructor = Blockly.registry.getClassFromOptions(
            Blockly.registry.Type.CONNECTION_PREVIEWER,
            this.workspace.options,
        );
        this.connectionPreviewer = new previewerConstructor!(this.block);

        // During a drag there may be a lot of rerenders, but not field changes.
        // Turn the cache on so we don't do spurious remeasures during the drag.
        dom.startTextWidthCache();
        this.workspace.setResizesEnabled(false);
        Blockly.blockAnimations.disconnectUiStop();

        const healStack = !!e && (e.altKey || e.ctrlKey || e.metaKey);

        if (this.shouldDisconnect(healStack)) {
            this.disconnectBlock(healStack);
        }
        this.block.setDragging(true);
        this.workspace.getLayerManager()?.moveToDragLayer(this.block);
    }

    /** Starts a drag on a shadow, recording the drag offset. */
    private startDraggingShadow(e?: PointerEvent) {
        const parent = this.block.getParent();
        if (!parent) {
            throw new Error(
                'Tried to drag a shadow block with no parent. ' +
                'Shadow blocks should always have parents.',
            );
        }
        this.dragOffset = Coordinate.difference(
            parent.getRelativeToSurfaceXY(),
            this.block.getRelativeToSurfaceXY(),
        );
        parent.startDrag(e);
    }

    /**
     * Whether or not we should disconnect the block when a drag is started.
     *
     * @param healStack Whether or not to heal the stack after disconnecting.
     * @returns True to disconnect the block, false otherwise.
     */
    private shouldDisconnect(healStack: boolean): boolean {
        return !!(
            this.block.getParent() ||
            (healStack &&
                this.block.nextConnection &&
                this.block.nextConnection.targetBlock())
        );
    }

    /**
     * Disconnects the block from any parents. If `healStack` is true and this is
     * a stack block, we also disconnect from any next blocks and attempt to
     * attach them to any parent.
     *
     * @param healStack Whether or not to heal the stack after disconnecting.
     */
    private disconnectBlock(healStack: boolean) {
        let clone: Blockly.Block;
        let target: Blockly.Connection;

        const mutation = this.block.mutationToDom?.();

        if (mutation?.getAttribute(DUPLICATE_ON_DRAG_MUTATION_KEY)?.toLowerCase() === "true") {
            const output = this.block.outputConnection;

            if (!output?.targetConnection) return;

            clone = Blockly.Xml.domToBlock(Blockly.Xml.blockToDom(this.block, true) as Element, this.block.workspace);
            target = output.targetConnection;
        }

        this.startParentConn =
            this.block.outputConnection?.targetConnection ??
            this.block.previousConnection?.targetConnection;
        if (healStack) {
            this.startChildConn = this.block.nextConnection?.targetConnection;
        }

        this.block.unplug(healStack);
        Blockly.blockAnimations.disconnectUiEffect(this.block);

        if (clone && target) {
            target.connect(clone.outputConnection);

            mutation.setAttribute(DUPLICATE_ON_DRAG_MUTATION_KEY, "false");
            this.block.domToMutation?.(mutation);
        }
    }

    /** Fire a UI event at the start of a block drag. */
    private fireDragStartEvent() {
        const event = new (eventUtils.get(eventUtils.BLOCK_DRAG))(
            this.block,
            true,
            this.block.getDescendants(false),
        );
        eventUtils.fire(event);
    }

    /** Fire a UI event at the end of a block drag. */
    private fireDragEndEvent() {
        const event = new (eventUtils.get(eventUtils.BLOCK_DRAG))(
            this.block,
            false,
            this.block.getDescendants(false),
        );
        eventUtils.fire(event);
    }

    /** Fire a move event at the end of a block drag. */
    private fireMoveEvent() {
        if (this.block.isDeadOrDying()) return;
        const event = new (eventUtils.get(eventUtils.BLOCK_MOVE))(
            this.block,
        ) as Blockly.Events.BlockMove;
        event.setReason(['drag']);
        event.oldCoordinate = this.startLoc!;
        event.recordNew();
        eventUtils.fire(event);
    }

    /** Moves the block and updates any connection previews. */
    drag(newLoc: Coordinate): void {
        if (this.block.isShadow()) {
            this.block.getParent()?.drag(Coordinate.sum(newLoc, this.dragOffset));
            return;
        }

        this.block.moveDuringDrag(newLoc);
        this.updateConnectionPreview(
            this.block,
            Coordinate.difference(newLoc, this.startLoc!),
        );
    }

    /**
     * @param draggingBlock The block being dragged.
     * @param delta How far the pointer has moved from the position
     *     at the start of the drag, in workspace units.
     */
    private updateConnectionPreview(draggingBlock: Blockly.BlockSvg, delta: Coordinate) {
        const currCandidate = this.connectionCandidate;
        const newCandidate = this.getConnectionCandidate(draggingBlock, delta);
        if (!newCandidate) {
            this.connectionPreviewer!.hidePreview();
            this.connectionCandidate = null;
            return;
        }
        const candidate =
            currCandidate &&
                this.currCandidateIsBetter(currCandidate, delta, newCandidate)
                ? currCandidate
                : newCandidate;
        this.connectionCandidate = candidate;

        const { local, neighbour } = candidate;
        const localIsOutputOrPrevious =
            local.type === Blockly.ConnectionType.OUTPUT_VALUE ||
            local.type === Blockly.ConnectionType.PREVIOUS_STATEMENT;
        const neighbourIsConnectedToRealBlock =
            neighbour.isConnected() && !neighbour.targetBlock()!.isInsertionMarker();
        if (
            localIsOutputOrPrevious &&
            neighbourIsConnectedToRealBlock &&
            !this.orphanCanConnectAtEnd(
                draggingBlock,
                neighbour.targetBlock()!,
                local.type,
            )
        ) {
            this.connectionPreviewer!.previewReplacement(
                local,
                neighbour,
                neighbour.targetBlock()!,
            );
            return;
        }
        this.connectionPreviewer!.previewConnection(local, neighbour);
    }

    /**
     * Returns true if the given orphan block can connect at the end of the
     * top block's stack or row, false otherwise.
     */
    private orphanCanConnectAtEnd(
        topBlock: Blockly.BlockSvg,
        orphanBlock: Blockly.BlockSvg,
        localType: number,
    ): boolean {
        const orphanConnection =
            localType === Blockly.ConnectionType.OUTPUT_VALUE
                ? orphanBlock.outputConnection
                : orphanBlock.previousConnection;
        return !!Blockly.Connection.getConnectionForOrphanedConnection(
            topBlock as Blockly.Block,
            orphanConnection as Blockly.Connection,
        );
    }

    /**
     * Returns true if the current candidate is better than the new candidate.
     *
     * We slightly prefer the current candidate even if it is farther away.
     */
    private currCandidateIsBetter(
        currCandiate: ConnectionCandidate,
        delta: Coordinate,
        newCandidate: ConnectionCandidate,
    ): boolean {
        const { local: currLocal, neighbour: currNeighbour } = currCandiate;
        const localPos = new Coordinate(currLocal.x, currLocal.y);
        const neighbourPos = new Coordinate(currNeighbour.x, currNeighbour.y);
        const currDistance = Coordinate.distance(
            Coordinate.sum(localPos, delta),
            neighbourPos,
        );
        return (
            newCandidate.distance > currDistance - Blockly.config.currentConnectionPreference
        );
    }

    /**
     * Returns the closest valid candidate connection, if one can be found.
     *
     * Valid neighbour connections are within the configured start radius, with a
     * compatible type (input, output, etc) and connection check.
     */
    private getConnectionCandidate(
        draggingBlock: Blockly.BlockSvg,
        delta: Coordinate,
    ): ConnectionCandidate | null {
        const localConns = this.getLocalConnections(draggingBlock);
        let radius = this.connectionCandidate
            ? Blockly.config.connectingSnapRadius
            : Blockly.config.snapRadius;
        let candidate = null;

        for (const conn of localConns) {
            const { connection: neighbour, radius: rad } = conn.closest(radius, delta);
            if (neighbour) {
                candidate = {
                    local: conn,
                    neighbour: neighbour,
                    distance: rad,
                };
                radius = rad;
            }
        }

        return candidate;
    }

    /**
     * Returns all of the connections we might connect to blocks on the workspace.
     *
     * Includes any connections on the dragging block, and any last next
     * connection on the stack (if one exists).
     */
    private getLocalConnections(draggingBlock: Blockly.BlockSvg): Blockly.RenderedConnection[] {
        const available = draggingBlock.getConnections_(false);
        const lastOnStack = draggingBlock.lastConnectionInStack(true);
        if (lastOnStack && lastOnStack !== draggingBlock.nextConnection) {
            available.push(lastOnStack);
        }
        return available;
    }

    /**
     * Cleans up any state at the end of the drag. Applies any pending
     * connections.
     */
    endDrag(e?: PointerEvent): void {
        if (this.block.isShadow()) {
            this.block.getParent()?.endDrag(e);
            return;
        }

        this.fireDragEndEvent();
        this.fireMoveEvent();

        dom.stopTextWidthCache();

        Blockly.blockAnimations.disconnectUiStop();
        this.connectionPreviewer!.hidePreview();

        if (!this.block.isDeadOrDying() && this.dragging) {
            // These are expensive and don't need to be done if we're deleting, or
            // if we've already stopped dragging because we moved back to the start.
            this.workspace
                .getLayerManager()
                ?.moveOffDragLayer(this.block, BLOCK_LAYER);
            this.block.setDragging(false);
        }

        if (this.connectionCandidate) {
            // Applying connections also rerenders the relevant blocks.
            this.applyConnections(this.connectionCandidate);
        } else {
            this.block.queueRender();
        }
        this.block.snapToGrid();

        // Must dispose after connections are applied to not break the dynamic
        // connections plugin. See #7859
        this.connectionPreviewer!.dispose();
        this.workspace.setResizesEnabled(true);

        eventUtils.setGroup(false);
    }

    /** Connects the given candidate connections. */
    private applyConnections(candidate: ConnectionCandidate) {
        const { local, neighbour } = candidate;
        local.connect(neighbour);

        const inferiorConnection = local.isSuperior() ? neighbour : local;
        const rootBlock = this.block.getRootBlock();

        Blockly.renderManagement.finishQueuedRenders().then(() => {
            Blockly.blockAnimations.connectionUiEffect(inferiorConnection.getSourceBlock());
            // bringToFront is incredibly expensive. Delay until the next frame.
            setTimeout(() => {
                rootBlock.bringToFront();
            }, 0);
        });
    }

    /**
     * Moves the block back to where it was at the beginning of the drag,
     * including reconnecting connections.
     */
    revertDrag(): void {
        if (this.block.isShadow()) {
            this.block.getParent()?.revertDrag();
            return;
        }

        this.startChildConn?.connect(this.block.nextConnection);
        if (this.startParentConn) {
            switch (this.startParentConn.type) {
                case Blockly.ConnectionType.INPUT_VALUE:
                    this.startParentConn.connect(this.block.outputConnection);
                    break;
                case Blockly.ConnectionType.NEXT_STATEMENT:
                    this.startParentConn.connect(this.block.previousConnection);
            }
        } else {
            this.block.moveTo(this.startLoc!, ['drag']);
            this.workspace
                .getLayerManager()
                ?.moveOffDragLayer(this.block, BLOCK_LAYER);
            // Blocks dragged directly from a flyout may need to be bumped into
            // bounds.
            Blockly.bumpObjects.bumpIntoBounds(
                this.workspace,
                this.workspace.getMetricsManager().getScrollMetrics(true),
                this.block,
            );
        }

        this.startChildConn = null;
        this.startParentConn = null;

        this.connectionPreviewer!.hidePreview();
        this.connectionCandidate = null;

        this.block.setDragging(false);
        this.dragging = false;
    }
}

function isDuplicateOnDragBlock(block: Blockly.Block) {
    return block.mutationToDom?.()?.getAttribute(DUPLICATE_ON_DRAG_MUTATION_KEY)?.toLowerCase() === "true";
}