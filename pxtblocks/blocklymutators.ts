namespace pxt.blocks {
    /**
     * This interface defines the optionally defined functions for mutations that Blockly
     * will call if they exist.
     */
    export interface MutatingBlock extends Blockly.Block {
        /* Internal properties */
        mutation: Mutation;

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

    /**
     * Represents a mutation of a block
     */
    export interface Mutation {
        /**
         * Get the unique identifier for this type of mutation
         */
        getMutationType(): string;

        /**
         * Compile the mutation of the block into a node representation
         */
        compileMutation(e: Environment, comments: string[]): JsNode;

        /**
         * Get a mapping of variables that were declared by this mutation and their types.
         */
        getDeclaredVariables(): pxt.Map<string>;

        /**
         * Returns true if a variable with the given name was declared in the mutation's compiled node
         */
        isDeclaredByMutation(varName: string): boolean;
    }


    export namespace MutatorTypes {
        export const ObjectDestructuringMutator = "objectdestructuring";
        export const RestParameterMutator = "restparameter";
    }

    interface BlockName {
        type: string;
        name: string;
    }

    interface NamedProperty {
        newName: string;
        property: string;
    }

    export function addMutation(b: MutatingBlock, info: pxtc.SymbolInfo, mutationType: string) {
        let m: MutatorHelper;

        switch (mutationType) {
            case MutatorTypes.ObjectDestructuringMutator:
                if (!info.parameters || info.parameters.length !== 1 || info.parameters[0].properties.length === 0) {
                    console.error("Mutating blocks only supported for functions with one parameter that has multiple properties");
                    return;
                }
                m = new DestructuringMutator(b, info);
                break;
            case MutatorTypes.RestParameterMutator:
                m = new ArrayMutator(b, info);
                break;
            default:
                console.warn("Ignoring unknown mutation type: " + mutationType);
                return;
        }

        b.mutationToDom = m.mutationToDom.bind(m);
        b.domToMutation = m.domToMutation.bind(m);
        b.compose = m.compose.bind(m);
        b.decompose = m.decompose.bind(m);
        b.mutation = m;
    }

    export function mutateToolboxBlock(block: Node, mutationType: string, mutation: string): void {
        const mutationElement = document.createElement("mutation");

        switch (mutationType) {
            case MutatorTypes.ObjectDestructuringMutator:
                mutationElement.setAttribute(DestructuringMutator.propertiesAttributeName, mutation);
                break;
            case MutatorTypes.RestParameterMutator:
                mutationElement.setAttribute(ArrayMutator.countAttributeName, mutation);
                break;
            default:
                console.warn("Ignoring unknown mutation type: " + mutationType);
                return;
        }

        block.appendChild(mutationElement)
    }

    abstract class MutatorHelper implements Mutation {
        protected static mutatorStatmentInput = "PROPERTIES";
        protected static mutatedVariableInputName = "properties";

        protected block: MutatingBlock;
        protected topBlockType: string;

        public abstract getMutationType(): string;
        public abstract compileMutation(e: Environment, comments: string[]): JsNode;
        public abstract getDeclaredVariables(): pxt.Map<string>;
        public abstract isDeclaredByMutation(varName: string): boolean;

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
                if (input.name === MutatorHelper.mutatorStatmentInput) {
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
                    top.appendStatementInput(MutatorHelper.mutatorStatmentInput);
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

    class DestructuringMutator extends MutatorHelper {
        public static propertiesAttributeName = "callbackproperties";
        public static renameAttributeName = "renamemap";
        private currentlyVisible: string[] = [];
        private parameters: string[];
        private parameterTypes: {[index: string]: string};
        private parameterRenames: {[index: string]: string} = {};

        constructor(b: Blockly.Block, info: pxtc.SymbolInfo) {
            super(b, info);
            this.block.appendDummyInput(MutatorHelper.mutatedVariableInputName);
            this.block.appendStatementInput("HANDLER")
                .setCheck("null");
        }

        public getMutationType(): string {
            return MutatorTypes.ObjectDestructuringMutator;
        }

        public compileMutation(e: Environment, comments: string[]): JsNode {
            if (!this.parameters.length) {
                return undefined;
            }

            const declarationString =  this.parameters.map(param => {
                const declaredName = this.block.getFieldValue(param);
                const escapedParam = escapeVarName(param);
                if (declaredName !== param) {
                    this.parameterRenames[param] = declaredName;
                    return `${param}: ${escapeVarName(declaredName)}`;
                }
                return escapedParam;
            }).join(", ");

            return mkText(`({ ${declarationString} }) => `);
        }

        public getDeclaredVariables(): pxt.Map<string> {
            const result: pxt.Map<string> = {};

            this.parameters.forEach(param => {
                result[this.block.getFieldValue(param)] = this.parameterTypes[param];
            });

            return result;
        }

        public isDeclaredByMutation(varName: string): boolean {
            return this.parameters.some(param => this.block.getFieldValue(param) === varName)
        }

        public mutationToDom(): Element {
            // Save the parameters that are currently visible to the DOM along with their names
            const mutation = document.createElement("mutation");
            const attr = this.parameters.map(param => {
                const varName = this.block.getFieldValue(param);
                if (varName !== param) {
                    this.parameterRenames[param] = Util.htmlEscape(varName);
                }
                return Util.htmlEscape(param);
            }).join(",");
            mutation.setAttribute(DestructuringMutator.propertiesAttributeName, attr);

            for (const parameter in this.parameterRenames) {
                if (parameter === this.parameterRenames[parameter]) {
                    delete this.parameterRenames[parameter];
                }
            }

            mutation.setAttribute(DestructuringMutator.renameAttributeName, JSON.stringify(this.parameterRenames));

            return mutation;
        }

        public domToMutation(xmlElement: Element): void {
            // Restore visible parameters based on saved DOM
            const savedParameters = xmlElement.getAttribute(DestructuringMutator.propertiesAttributeName);
            if (savedParameters) {
                const split = savedParameters.split(",");
                const properties: NamedProperty[] = [];
                split.forEach(saved => {
                    // Parse the old way of storing renames to maintain backwards compatibility
                    const parts = saved.split(":");
                    if (this.info.parameters[0].properties.some(p => p.name === parts[0])) {
                        properties.push({
                            property: parts[0],
                            newName: parts[1]
                        });
                    }
                });

                this.parameterRenames = undefined;

                if (xmlElement.hasAttribute(DestructuringMutator.renameAttributeName)) {
                    try {
                        this.parameterRenames = JSON.parse(xmlElement.getAttribute(DestructuringMutator.renameAttributeName));
                    }
                    catch (e) {
                        console.warn("Ignoring invalid rename map in saved block mutation");
                    }
                }

                this.parameterRenames = this.parameterRenames || {};

                // Create the fields for each property with default variable names
                this.parameters = [];
                properties.forEach(prop => {
                    this.parameters.push(prop.property);
                    if (prop.newName && prop.newName !== prop.property) {
                        this.parameterRenames[prop.property] === prop.newName;
                    }
                });

                this.updateVisibleProperties();

                // Override any names that the user has changed
                properties.filter(p => !!p.newName).forEach(p => this.block.setFieldValue(p.newName, p.property));
            }
        }

        protected updateBlock(subBlocks: BlockName[]) {
            this.parameters = [];

            // Ignore duplicate blocks
            subBlocks.forEach(p => {
                if (this.parameters.indexOf(p.name) === -1) {
                    this.parameters.push(p.name);
                }
            });

            this.updateVisibleProperties();
        }

        protected getSubBlockNames(): BlockName[] {
            this.parameters = [];
            this.parameterTypes = {};

            return this.info.parameters[0].properties.map(property => {
                // Used when compiling the destructured arguments
                this.parameterTypes[property.name] = property.type;

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
            if (Util.listsEqual(this.currentlyVisible, this.parameters)) {
                return;
            }

            const dummyInput = this.block.inputList.filter(i => i.name === MutatorHelper.mutatedVariableInputName)[0];
            this.currentlyVisible.forEach(param => {
                if (this.parameters.indexOf(param) === -1) {
                    const name = this.block.getFieldValue(param);

                    // Persist renames
                    if (name !== param) {
                        this.parameterRenames[param] = name;
                    }

                    dummyInput.removeField(param);
                }
            });

            this.parameters.forEach(param => {
                if (this.currentlyVisible.indexOf(param) === -1) {
                    const fieldValue = this.parameterRenames[param] || param;
                    dummyInput.appendField(new Blockly.FieldVariable(fieldValue), param);
                }
            });

            this.currentlyVisible = this.parameters;
        }

        private propertyId(property: string) {
            return this.block.type + "_" + property;
        }
    }


    class ArrayMutator extends MutatorHelper {
        public static countAttributeName = "count";
        private static entryTypeName = "entry";
        private static valueInputPrefix = "value_input_";

        private count: number = 0;

        public getMutationType(): string {
            return MutatorTypes.RestParameterMutator;
        }

        public compileMutation(e: Environment, comments: string[]): JsNode {
            const values: JsNode[] = [];

            this.forEachInput(block => values.push(compileExpression(e, block, comments)))

            return mkGroup(values);
        }

        public getDeclaredVariables(): pxt.Map<string> {
            return undefined;
        }

        public isDeclaredByMutation(varName: string): boolean {
            return false;
        }

        public mutationToDom(): Element {
            const mutation = document.createElement("mutation");+
            mutation.setAttribute(ArrayMutator.countAttributeName, this.count.toString());

            return mutation;
        }

        public domToMutation(xmlElement: Element): void {
            const attribute = xmlElement.getAttribute(ArrayMutator.countAttributeName);
             if (attribute) {
                 try {
                    this.count = parseInt(attribute)
                 }
                 catch (e) { return; }

                 for (let i = 0; i < this.count; i++) {
                     this.addNumberField(false, i);
                 }
             }
        }

        protected updateBlock(subBlocks: BlockName[]) {
            if (subBlocks) {
                const diff = Math.abs(this.count - subBlocks.length);
                if (this.count < subBlocks.length) {
                    for (let i = 0; i < diff; i++) this.addNumberField(true, this.count);
                }
                else if (this.count > subBlocks.length) {
                    for (let i = 0; i < diff; i++) this.removeNumberField();
                }
            }
        }

        protected getSubBlockNames(): BlockName[] {
            return [{
                name: "Value",
                type: ArrayMutator.entryTypeName
            }];
        }

        protected getVisibleBlockTypes(): string[] {
            const result: string[] = [];
            this.forEachInput(() => result.push(ArrayMutator.entryTypeName))
            return result;
        }

        private addNumberField(isNewField: boolean, index: number) {
            const input = this.block.appendValueInput(ArrayMutator.valueInputPrefix + index).setCheck("Number");

            if (isNewField) {
                const valueBlock = this.block.workspace.newBlock("math_number");
                valueBlock.initSvg();
                valueBlock.setShadow(true);
                input.connection.connect(valueBlock.outputConnection);
                this.block.workspace.render();
                this.count++;
            }
        }

        private removeNumberField() {
            if (this.count > 0) {
                this.block.removeInput(ArrayMutator.valueInputPrefix + (this.count - 1))
            }
            this.count--;
        }

        private forEachInput(cb: (v: Blockly.Block, i: number) => void) {
            for (let i = 0; i < this.count; i++) {
                cb(this.block.getInputTargetBlock(ArrayMutator.valueInputPrefix + i), i);
            }
        }
    }
}