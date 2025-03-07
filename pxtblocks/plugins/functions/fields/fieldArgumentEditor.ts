import * as Blockly from "blockly";
import { FunctionManager } from "../functionManager";
import { ArgumentEditorBlock } from "../blocks/argumentEditorBlocks";

export interface FieldArgumentEditorConfig extends Blockly.FieldTextInputConfig {
}

export class FieldArgumentEditor extends Blockly.FieldTextInput {
    static REMOVE_ARG_URI =
        "data:image/svg+xml;charset=UTF-8,%3c?xml version='1.0' encoding='UTF-8' standalone='no'?%3e%3csvg width='20px' height='20px' viewBox='0 0 20 20' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'%3e%3c!-- Generator: Sketch 48.1 (47250) - http://www.bohemiancoding.com/sketch --%3e%3ctitle%3edelete-argument v2%3c/title%3e%3cdesc%3eCreated with Sketch.%3c/desc%3e%3cdefs%3e%3c/defs%3e%3cg id='Page-1' stroke='none' stroke-width='1' fill='none' fill-rule='evenodd'%3e%3cg id='delete-argument-v2' stroke='%23FF661A'%3e%3cg id='Group' transform='translate(3.000000, 2.500000)'%3e%3cpath d='M1,3 L13,3 L11.8900496,14.0995037 C11.8389294,14.6107055 11.4087639,15 10.8950124,15 L3.10498756,15 C2.59123611,15 2.16107055,14.6107055 2.10995037,14.0995037 L1,3 Z' id='Rectangle' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3e%3c/path%3e%3cpath d='M7,11 L7,6' id='Line' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3e%3c/path%3e%3cpath d='M9.5,11 L9.5,6' id='Line-Copy' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3e%3c/path%3e%3cpath d='M4.5,11 L4.5,6' id='Line-Copy-2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3e%3c/path%3e%3crect id='Rectangle-2' fill='%23FF661A' x='0' y='2.5' width='14' height='1' rx='0.5'%3e%3c/rect%3e%3cpath d='M6,0 L8,0 C8.55228475,-1.01453063e-16 9,0.44771525 9,1 L9,3 L5,3 L5,1 C5,0.44771525 5.44771525,1.01453063e-16 6,0 Z' id='Rectangle-3' stroke-width='1.5'%3e%3c/path%3e%3c/g%3e%3c/g%3e%3c/g%3e%3c/svg%3e";

    protected removeButtonMouseWrapper_?: Blockly.browserEvents.Data;

    constructor(text: string, opt_validator: Blockly.FieldValidator, config: FieldArgumentEditorConfig) {
        super(text, opt_validator, config);
    }

    showEditor(e?: Event | undefined): void {
        super.showEditor(e);

        const div = Blockly.WidgetDiv.getDiv()!;
        div.className += " argumentEditorInput";
        const removeButton = document.createElement("img");
        removeButton.setAttribute("class", "argumentEditorRemoveIcon");
        removeButton.setAttribute("src", FieldArgumentEditor.REMOVE_ARG_URI);

        this.removeButtonMouseWrapper_ = Blockly.browserEvents.conditionalBind(
            removeButton,
            "mousedown",
            this,
            this.removeCallback
        );
        div.appendChild(removeButton);
        const typeName = (this.sourceBlock_ as ArgumentEditorBlock)?.getTypeName();
        if (typeName && this.sourceBlock_?.workspace) {
            const iconClass = FunctionManager.getInstance().getIconForType(
                typeName
            );

            if (iconClass) {
                const className = iconClass + " icon argumentEditorTypeIcon";
                const typeIcon = document.createElement("i");
                typeIcon.className = className;
                div.appendChild(typeIcon);
            }
        }
    }

    protected removeCallback() {
        const parent = this.sourceBlock_?.getParent();

        if (!parent) return;

        let inputNameToRemove: string | undefined;

        for (const input of parent.inputList) {
            const target = input.connection?.targetBlock();

            if (target === this.sourceBlock_) {
                inputNameToRemove = input.name;
                break;
            }
        }

        if (!inputNameToRemove) return;

        Blockly.WidgetDiv.hide();
        parent.removeInput(inputNameToRemove);
    }
}

Blockly.fieldRegistry.register("field_argument_editor", FieldArgumentEditor);

Blockly.Css.register(`

.argumentEditorInput {
    overflow: visible;
}

.functioneditor i.argumentEditorTypeIcon {
    color: var(--pxt-primary-foreground);
    position: absolute;
    width: 24px;
    height: 24px;
    top: 40px;
    left: 50%;
    margin-left: -12px;
}

.argumentEditorRemoveIcon {
    position: absolute;
    width: 24px;
    height: 24px;
    top: -40px;
    left: 50%;
    margin-left: -12px;
    cursor: pointer;
}

`)