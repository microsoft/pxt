/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldCustom, FieldCustomOptions, setBlockDataForField, getBlockDataForField } from "./field_utils";

interface FieldScopedValueSelectorOptions extends FieldCustomOptions {
    defl?: string;
    type?: string;
    types?: string; // comma separated list
}

export class FieldScopedValueSelector extends Blockly.FieldLabel implements FieldCustom {
    public isFieldCustom_ = true;
    defl: string | undefined;
    types: string[] = [];
    scopedValue: string | undefined;
    dragging = false;

    constructor(value: string, params: FieldScopedValueSelectorOptions) {
        super(value);
        this.defl = params.defl;
        if (params.types) this.types = params.types.split(",");
        else if (params.type) this.types = [params.type];
        this.types = this.types.map(t => t.trim().replace(/['"]+/g, ""));
    }

    init(): void {
        super.init();
        if (this.sourceBlock_) {
            this.scopedValue = getBlockDataForField(this.sourceBlock_, "scopedValue");
            this.sourceBlock_.workspace.addChangeListener(this.onWorkspaceChange);
        }
    }

    dispose(): void {
        if (this.sourceBlock_) {
            this.sourceBlock_.workspace.removeChangeListener(this.onWorkspaceChange);
        }
        super.dispose();
    }

    getValue(): string | null {
        // compiler emits into typescript
        if (this.sourceBlock_?.isInFlyout) {
            return lf("(dynamic)");
        } else if (this.dragging) {
            return lf("what will it be?");
        }
        if (this.sourceBlock_ && !this.scopedValue) {
            this.scopedValue = getBlockDataForField(this.sourceBlock_, "scopedValue");
        }
        return this.scopedValue || this.defl || lf("unknown");
    }

    setValue(newValue: any, fireChangeEvent?: boolean): void {
        this.scopedValue = newValue || this.defl || lf("unknown");
        if (this.sourceBlock_)
            setBlockDataForField(this.sourceBlock_, "scopedValue", this.scopedValue || "");
        super.setValue(this.scopedValue, fireChangeEvent);
        this.forceRerender();
    }

    onDragEvent = (ev: Blockly.Events.BlockDrag) => {
        // Make sure our block is in the event
        const block = ev.blocks.find(b => b.id === this.sourceBlock_.id);
        if (!block) return;

        this.dragging = ev.isStart;
        if (ev.isStart) {
            this.forceRerender();
            return;
        }

        // gather all scopes where we might find a compatible value
        const scopes: Blockly.Block[] = [];
        {
            let parent = this.sourceBlock_.getParent()?.getParent();
            while (parent) {
                scopes.push(parent);
                parent = parent.getParent();
            }
        }

        const getCodeCard = (block: Blockly.Block): pxt.CodeCard => {
            return (block as any).codeCard;
        }

        const apiInfos = pxt.getBundledApiInfo();
        const getSymbolInfo = (block: Blockly.Block): ts.pxtc.SymbolInfo | undefined => {
            const card = getCodeCard(block);
            if (!card || !card.name) return null;
            // check each entry in apiInfo
            for (const info of Object.values(apiInfos)) {
                if (info.apis.byQName[card.name]) {
                    return info.apis.byQName[card.name];
                }
            }
            return undefined;
        }

        // find the value in the scopes
        this.scopedValue = null;
        for (const scope of scopes) {
            if (scope.type === "variables_set") {
                const inputList = scope.inputList;
                const input = inputList.find(i => i.name === "VALUE");
                if (!input) continue;
                const fieldRow = input.fieldRow;
                if (!fieldRow) continue;
                const field = fieldRow.find(f => f.name === "VAR") as Blockly.FieldVariable;
                if (!field) continue;
                const variable = field.getVariable();
                if (!variable) continue;
                //if (this.types.includes(variable.type)) {
                {
                    return this.setValue(variable.getName());
                }
                continue;
            }
            const symbol = getSymbolInfo(scope);
            if (!symbol) continue;
            for (const parameter of symbol.parameters) {
                if (parameter.handlerParameters) {
                    for (const handlerParameter of parameter.handlerParameters) {
                        if (this.types.includes(handlerParameter.type)) {
                            return this.setValue(handlerParameter.name);
                        }
                    }
                }
            }
        }
        this.setValue(this.defl);
    }

    onWorkspaceChange = (ev: Blockly.Events.Abstract) => {
        if (!this.sourceBlock_ || !this.sourceBlock_.workspace || this.sourceBlock_.disposed) return;
        if (ev.type === Blockly.Events.BLOCK_DRAG) return this.onDragEvent(ev as Blockly.Events.BlockDrag);
    }

    getFieldDescription(): string {
        return this.scopedValue || this.defl || lf("value");
    }
}
