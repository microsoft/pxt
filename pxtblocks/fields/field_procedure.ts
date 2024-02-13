/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldDropdown } from "./field_dropdown";

export class FieldProcedure extends FieldDropdown {
    protected rawValue: string;

    constructor(funcname: string, opt_validator?: Blockly.FieldValidator) {
        super(createMenuGenerator(), opt_validator);

        this.setValue(funcname || '');
    }

    getOptions(useCache?: boolean): Blockly.MenuOption[] {
        return (this.menuGenerator_ as () => Blockly.MenuOption[])();
    }

    protected override doClassValidation_(newValue?: string): string {
        if (newValue === undefined) {
            return null;
        }

        return newValue;
    }

    protected override doValueUpdate_(newValue: string): void {
        this.rawValue = newValue;
        super.doValueUpdate_(newValue);
    }

    override init() {
        if (this.fieldGroup_) {
            // Dropdown has already been initialized once.
            return;
        }
        super.init.call(this);
    };

    override setSourceBlock(block: Blockly.Block) {
        pxt.Util.assert(!block.isShadow(),
            'Procedure fields are not allowed to exist on shadow blocks.');
        super.setSourceBlock.call(this, block);
    };
}

function createMenuGenerator() {
    return function (this: FieldProcedure) {
        let functionList: string[] = [];
        if (this.sourceBlock_ && this.sourceBlock_.workspace) {
            let blocks = this.sourceBlock_.workspace.getAllBlocks(false);
            // Iterate through every block and check the name.
            for (let i = 0; i < blocks.length; i++) {
                if ((blocks[i] as any).getProcedureDef) {
                    let procName = (blocks[i] as any).getProcedureDef();
                    functionList.push(procName[0]);
                }
            }
        }
        // Ensure that the currently selected variable is an option.
        let name = this.getValue();
        if (name && functionList.indexOf(name) == -1) {
            functionList.push(name);
        }
        // case insensitive compare
        functionList.sort((a, b) => {
            const lowA = a.toLowerCase();
            const lowB = b.toLowerCase();
            if (lowA === lowB) return 0;
            if (lowA > lowB) return 1;
            return -1;
        });


        if (!functionList.length) {
            // Add temporary list item so the dropdown doesn't break
            functionList.push("Temp");
        }

        if (this.rawValue && functionList.indexOf(this.rawValue) === -1) {
            functionList.push(this.rawValue);
        }

        // Variables are not language-specific, use the name as both the user-facing
        // text and the internal representation.
        let options: [string, string][] = [];
        for (let i = 0; i < functionList.length; i++) {
            options[i] = [functionList[i], functionList[i]];
        }

        return options;
    }
}