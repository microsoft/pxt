/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from "blockly";
import { isAllowlistedShadow, shouldDuplicateOnDrag, updateDuplicateOnDragState } from "./duplicateOnDrag";

interface DragStrategyInternals {
  block: Blockly.BlockSvg;
  startChildConn: Blockly.Connection | null;
}

// @ts-expect-error overriding private method
export class DuplicateOnDragStrategy extends Blockly.dragging.BlockDragStrategy {
  protected getTargetBlock(): Blockly.BlockSvg {
    const self = this as unknown as DragStrategyInternals;
    // Keep the drag on an allowlisted shadow so disconnectBlock can extract
    // it; otherwise Blockly's default would delegate the drag to the parent.
    if (self.block.isShadow() && isAllowlistedShadow(self.block)) {
        return self.block;
    }
    return super.getTargetBlock();
  }

  override drag(newLoc: Blockly.utils.Coordinate, e?: PointerEvent | KeyboardEvent): void {
    super.drag(newLoc, e);
    // Workaround for https://github.com/RaspberryPiFoundation/blockly/issues/9898
    if (!e || e instanceof PointerEvent) {
        const self = this as unknown as DragStrategyInternals;
        self.block.moveDuringDrag(newLoc);
    }
  }

  private disconnectBlock(healStack: boolean) {
    const self = this as unknown as DragStrategyInternals;

    let clone: Blockly.Block;
    let target: Blockly.Connection;
    let xml: Element;
    const isShadow = self.block.isShadow();

    if (isShadow) {
        self.block.setShadow(false);
    }

    if (shouldDuplicateOnDrag(self.block)) {
        const output = self.block.outputConnection;

        if (!output?.targetConnection) return;

        xml = Blockly.Xml.blockToDom(self.block, true) as Element;

        if (!isShadow) {
            clone = Blockly.Xml.domToBlock(xml, self.block.workspace);
        }
        target = output.targetConnection;
    }

    // Store startChildConn so revertDrag can rebuild [parent → block → next];
    // the base class only stores it when the block has no parent.
    if (healStack) {
        self.startChildConn = self.block.nextConnection?.targetConnection;
    }

    if (target && isShadow) {
        target.setShadowDom(xml)
    }
    self.block.unplug(healStack);
    Blockly.blockAnimations.disconnectUiEffect(self.block);
    updateDuplicateOnDragState(self.block);

    if (target && clone) {
        target.connect(clone.outputConnection);
    }
  }
}

export function setDuplicateOnDragStrategy(block: Blockly.Block | Blockly.BlockSvg) {
    (block as Blockly.BlockSvg).setDragStrategy?.(new DuplicateOnDragStrategy(block as Blockly.BlockSvg));
}
