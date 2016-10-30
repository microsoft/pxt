namespace pxt.blocks {
    /**
     * This interface defines the optionally defined functions for mutations that Blockly
     * will call if they exist.
     */
    export interface MutatingBlock extends Blockly.Block {
        /* Internal properties */

        parameters: string[];
        parameterTypes: {[index: string]: string};

        /* Functions used by Blockly */

        // Set to save mutations. Should return an XML element
        mutationToDom(): Element;
        // Set to restore mutations from save
        domToMutation(xmlElement: Element): void;
        // Should be set to modify a block after a mutator dialog is updated
        compose(topBlock: Blockly.Block): void;
        // Should be set to initialize the workspace inside a mutator dialog and return the top block
        decompose(workspace: Blockly.Workspace): Blockly.Block;
    }

    export interface BlockName {
        type: string;
        name: string;
    }

    export function applyMutator(b: MutatingBlock, m: Mutator) {
        b.mutationToDom = m.mutationToDom.bind(m);
        b.domToMutation = m.domToMutation.bind(m);
        b.compose = m.compose.bind(m);
        b.decompose = m.decompose.bind(m);
    }

    export abstract class Mutator {
        protected static mutatorStatmentInput = "PROPERTIES";
        protected static mutatedVariableInputName = "properties";

        protected block: MutatingBlock;
        protected topBlockType: string;

        public abstract mutationToDom(): Element;
        public abstract domToMutation(xmlElement: Element): void;
        protected abstract getSubBlockNames(): BlockName[];
        protected abstract getVisibleBlockTypes(): string[];
        protected abstract updateBlock(visibleBlocks: BlockName[]): void;

        constructor(b: Blockly.Block, protected info: pxtc.SymbolInfo) {
            this.block = b as MutatingBlock;
            this.topBlockType = this.block.type + "_mutator";

            const subBlocks = this.getSubBlockNames();

            this.initializeMutatorTopBlock();
            this.initializeMutatorSubBlocks(subBlocks);

            const mutatorToolboxTypes = subBlocks.map(s => s.type);

            this.block.setMutator(new Blockly.Mutator(mutatorToolboxTypes));
        }

        // Should be set to modify a block after a mutator dialog is updated
        public compose(topBlock: Blockly.Block): void {
            const allBlocks = topBlock.getDescendants().map(subBlock => {
                return {
                    type: subBlock.type,
                    name: subBlock.inputList[0].name
                };
            });
            // Toss the top block
            allBlocks.shift();
            this.updateBlock(allBlocks)
        }

        // Should be set to initialize the workspace inside a mutator dialog and return the top block
        public decompose(workspace: Blockly.Workspace): Blockly.Block {
            // Initialize flyout workspace's top block and add sub-blocks based on visible parameters
            const topBlock = workspace.newBlock(this.topBlockType);
            topBlock.initSvg();

            for (const input of topBlock.inputList) {
                if (input.name === Mutator.mutatorStatmentInput) {
                    let currentConnection = input.connection;

                    this.getVisibleBlockTypes().forEach(sub => {
                        const subBlock = workspace.newBlock(sub);
                        subBlock.initSvg();
                        currentConnection.connect(subBlock.previousConnection);
                        currentConnection = subBlock.nextConnection;
                    });
                    break;
                }
            }

            return topBlock;
        }

        protected initializeMutatorSubBlock(sub: Blockly.Block, parameter: string, colour: string) {
            sub.appendDummyInput(parameter)
                .appendField(parameter);
            sub.setColour(colour);
            sub.setNextStatement(true);
            sub.setPreviousStatement(true);
        }

        protected initializeMutatorTopBlock() {
            const topBlockTitle = this.info.attributes.mutateText;
            const colour = this.block.getColour();

            Blockly.Blocks[this.topBlockType] = Blockly.Blocks[this.topBlockType] || {
                init: function() {
                    const top = this as Blockly.Block;
                    top.appendDummyInput()
                        .appendField(topBlockTitle);
                    top.setColour(colour);
                    top.appendStatementInput(Mutator.mutatorStatmentInput);
                }
            };
        }

        private initializeMutatorSubBlocks(subBlocks: BlockName[]) {
            const colour = this.block.getColour();
            const initializer = this.initializeMutatorSubBlock.bind(this);

            subBlocks.forEach(blockName => {
                Blockly.Blocks[blockName.type] = Blockly.Blocks[blockName.type] || {
                    init: function() { initializer(this as Blockly.Block, blockName.name, colour) }
                };
            });
        }
    }

    export class DestructuringMutator extends Mutator {
        public static savedMutationAttribute = "callbackproperties";
        private currentlyVisible: string[] = [];

        constructor(b: Blockly.Block, info: pxtc.SymbolInfo) {
            super(b, info);
            this.block.appendDummyInput(Mutator.mutatedVariableInputName);
            this.block.appendStatementInput("HANDLER")
                .setCheck("null");
        }

        public mutationToDom(): Element {
            // Save the parameters that are currently visible to the DOM along with their names
            const mutation = document.createElement("mutation");
            const attr = this.block.parameters.map(param => {
                const varName = this.block.getFieldValue(param);
                return varName !== param ? `${Util.htmlEscape(param)}:${Util.htmlEscape(varName)}` : Util.htmlEscape(param);
            }).join(",");
            mutation.setAttribute(DestructuringMutator.savedMutationAttribute, attr);

            return mutation;
        }

        public domToMutation(xmlElement: Element): void {
            // Restore visible parameters based on saved DOM
            const savedParameters = xmlElement.getAttribute(DestructuringMutator.savedMutationAttribute);
            if (savedParameters) {
                const split = savedParameters.split(",");
                const properties: NamedProperty[] = [];
                split.forEach(saved => {
                    const parts = saved.split(":");
                    if (this.info.parameters[0].properties.some(p => p.name === parts[0])) {
                        properties.push({
                            property: parts[0],
                            newName: parts[1]
                        });
                    }
                })
                // Create the fields for each property with default variable names
                this.block.parameters = properties.map(p => p.property);
                this.updateVisibleProperties();

                // Override any names that the user has changed
                properties.filter(p => !!p.newName).forEach(p => this.block.setFieldValue(p.newName, p.property));
            }
        }

        protected updateBlock(subBlocks: BlockName[]) {
            this.block.parameters = [];

            // Ignore duplicate blocks
            subBlocks.forEach(p => {
                if (this.block.parameters.indexOf(p.name) === -1) {
                    this.block.parameters.push(p.name);
                }
            });

            this.updateVisibleProperties();
        }

        protected getSubBlockNames(): BlockName[] {
            this.block.parameters = [];
            this.block.parameterTypes = {};

            return this.info.parameters[0].properties.map(property => {
                // Used when compiling the destructured arguments
                this.block.parameterTypes[property.name] = property.type;

                return {
                    type: this.propertyId(property.name),
                    name: property.name
                };
            });
        }

        protected getVisibleBlockTypes(): string[] {
            return this.currentlyVisible.map(p => this.propertyId(p));
        }

        private updateVisibleProperties() {
            if (Util.listsEqual(this.currentlyVisible, this.block.parameters)) {
                return;
            }

            const dummyInput = this.block.inputList.filter(i => i.name === Mutator.mutatedVariableInputName)[0];
            this.currentlyVisible.forEach(param => {
                if (this.block.parameters.indexOf(param) === -1) {
                    dummyInput.removeField(param);
                }
            });

            this.block.parameters.forEach(param => {
                if (this.currentlyVisible.indexOf(param) === -1) {
                    dummyInput.appendField(new Blockly.FieldVariable(param), param);
                }
            });

            this.currentlyVisible = this.block.parameters;
        }

        private propertyId(property: string) {
            return this.block.type + "_" + property;
        }
    }

    export class ArrayMutator extends Mutator {
        public static savedArrayMutation = "arrayvalues";

        private static entryType = "entry";
        private static valueInputPrefix = "value_input_";
        private static valueFieldPrefix = "value_field_";

        private count: number = 0;

        public mutationToDom(): Element {
            const mutation = document.createElement("mutation");
            const values: number[] = [];

            this.forEachEntry(value => {
                values.push(parseFloat(value));
            });

            mutation.setAttribute(DestructuringMutator.savedMutationAttribute, values.join(","));

            return mutation;
        }

        public domToMutation(xmlElement: Element): void {
            const attribute = xmlElement.getAttribute(ArrayMutator.savedArrayMutation);
             if (attribute) attribute.split(",").forEach(value => {
                let parsed = 0;
                try {
                    parsed = parseFloat(value);
                }
                catch(e) {}
                this.addNumberField(parsed);
            });
        }

        protected updateBlock(subBlocks: BlockName[]) {
            if (subBlocks) {
                const diff = Math.abs(this.count - subBlocks.length);
                if (this.count < subBlocks.length) {
                    for (let i = 0; i < diff; i++) this.addNumberField();
                }
                else if (this.count > subBlocks.length) {
                    for (let i = 0; i < diff; i++) this.removeNumberField();
                }
            }
        }

        protected getSubBlockNames(): BlockName[] {
            return [{
                name: "Value",
                type: ArrayMutator.entryType
            }];
        }

        protected getVisibleBlockTypes(): string[] {
            const result: string[] = [];
            this.forEachEntry(() => result.push(ArrayMutator.entryType))
            return result;
        }

        private addNumberField(value = 5) {
            const input = this.block.appendValueInput(ArrayMutator.valueInputPrefix + this.count).setCheck("Number");

            const valueBlock = this.block.workspace.newBlock("math_number");
            valueBlock.setOutput(true, "Number");
            valueBlock.setFieldValue(value.toString(), "NUM");
            input.connection.connect(valueBlock.outputConnection);

            this.count++;
        }

        private removeNumberField() {
            if (this.count > 0) {
                this.block.removeInput(ArrayMutator.valueInputPrefix + (this.count - 1))
            }
            this.count--;
        }

        private forEachEntry(cb: (v: string, i: number) => void) {
            for (let i = 0; i < this.count; i++) {
                cb(this.block.getFieldValue(ArrayMutator.entryType + i), i);
            }
        }
    }
}