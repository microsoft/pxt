/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldCustom, getBlockDataForField, setBlockDataForField } from "./field_utils";

export abstract class FieldBase<U> extends Blockly.Field implements FieldCustom {
    // todo: this was removed in blockly v12
    static CHECKMARK_OVERHANG = 25;

    isFieldCustom_: true;
    SERIALIZABLE = true;
    options: U;
    protected valueText: string;
    protected loaded: boolean;
    protected workspace: Blockly.Workspace;

    constructor(text: string, params: U, validator?: Blockly.FieldValidator) {
        super(text, validator);
        this.options = params;
        if (text && !this.valueText) this.valueText = text;
    }

    protected abstract onInit(): void;
    protected abstract onDispose(): void;
    protected abstract onValueChanged(newValue: string): string;

    static pendingInit: FieldBase<any>[] = [];
    static pendingTimeout: any;

    static enqueueInit(field: FieldBase<any>) {
        FieldBase.pendingInit.push(field);

        if (!this.pendingTimeout) {
            FieldBase.pendingTimeout = setTimeout(() => FieldBase.flushInitQueue());
        }
    }

    static flushInitQueue() {
        for (const field of FieldBase.pendingInit) {
            field.onLoadedIntoWorkspace();
        }
        FieldBase.pendingTimeout = undefined;
        FieldBase.pendingInit = [];
    }

    init() {
        super.init();
        this.onInit();

        // This hack makes sure we run this code only after domToBlock
        // has finished running and this field has its actual value set
        FieldBase.enqueueInit(this);
   }

    dispose() {
        this.onDispose();
    }

    getValue() {
        return this.valueText;
    }

    doValueUpdate_(newValue: string) {
        if (newValue === null) return;

        this.valueText = this.loaded ? this.onValueChanged(newValue) : newValue;
    }

    getDisplayText_() {
        return this.valueText;
    }

    onLoadedIntoWorkspace() {
        if (this.loaded) return;
        this.loaded = true;
        this.valueText = this.onValueChanged(this.valueText);
    }

    protected getAnchorDimensions() {
        const boundingBox = this.getScaledBBox() as any;
        if (this.sourceBlock_.RTL) {
            boundingBox.right += FieldBase.CHECKMARK_OVERHANG;
        } else {
            boundingBox.left -= FieldBase.CHECKMARK_OVERHANG;
        }
        return boundingBox;
    };

    protected isInitialized() {
        return !!this.fieldGroup_;
    }

    protected getBlockData() {
        return getBlockDataForField(this.sourceBlock_, this.name);
    }

    protected setBlockData(value: string) {
        setBlockDataForField(this.sourceBlock_, this.name, value);
    }

    protected getSiblingBlock(inputName: string, useGrandparent = false) {
        const block = useGrandparent ? this.sourceBlock_.getParent() : this.sourceBlock_;

        if (!block || !block.inputList) return undefined;

        for (const input of block.inputList) {
            if (input.name === inputName) {
                return input.connection.targetBlock();
            }
        }

        return undefined;
    }

    protected getSiblingField(fieldName: string, useGrandparent = false) {
        const block = useGrandparent ? this.sourceBlock_.getParent() : this.sourceBlock_;
        if (!block) return undefined;
        return block.getField(fieldName);
    }
}