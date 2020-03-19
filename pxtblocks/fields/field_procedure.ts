/// <reference path="../../localtypings/pxtblockly.d.ts" />

namespace pxtblockly {

    export class FieldProcedure extends Blockly.FieldDropdown {

        constructor(funcname: string, opt_validator?: Function) {
            super([["Temp", "Temp"]], opt_validator);

            this.setValue(funcname || '');
        }

        getOptions() {
            return this.dropdownCreate();
        };

        init() {
            if (this.fieldGroup_) {
                // Dropdown has already been initialized once.
                return;
            }
            super.init.call(this);
        };

        setSourceBlock(block: Blockly.Block) {
            (goog as any).asserts.assert(!(block as any).isShadow(),
                'Procedure fields are not allowed to exist on shadow blocks.');
            super.setSourceBlock.call(this, block);
        };

        /**
         * Return a sorted list of variable names for procedure dropdown menus.
         * Include a special option at the end for creating a new function name.
         * @return {!Array.<string>} Array of procedure names.
         * @this {pxtblockly.FieldProcedure}
         */
        public dropdownCreate() {
            let functionList: string[] = [];
            if (this.sourceBlock_ && this.sourceBlock_.workspace) {
                let blocks = this.sourceBlock_.workspace.getAllBlocks();
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
            functionList.sort(goog.string.caseInsensitiveCompare);


            if (!functionList.length) {
                // Add temporary list item so the dropdown doesn't break
                functionList.push("Temp");
            }

            // Variables are not language-specific, use the name as both the user-facing
            // text and the internal representation.
            let options: string[][] = [];
            for (let i = 0; i < functionList.length; i++) {
                options[i] = [functionList[i], functionList[i]];
            }
            return options;
        }

        onItemSelected(menu: any, menuItem: any) {
            let itemText = menuItem.getValue();
            if (this.sourceBlock_) {
                // Call any validation function, and allow it to override.
                itemText = this.callValidator(itemText);
            }
            if (itemText !== null) {
                this.setValue(itemText);
            }
        }
    }
}