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
        export const DefaultInstanceMutator = "defaultinstance";
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
                if (!info.parameters || info.parameters.length < 1) {
                    console.error("Destructuring mutations require at least one parameter")
                }
                else {
                    let found = false;
                    for (const param of info.parameters) {
                        if (param.type.indexOf("=>") !== -1) {
                            if (!param.properties || param.properties.length === 0) {
                                console.error("Destructuring mutations only supported for functions with an event parameter that has multiple properties");
                                return;
                            }
                            found = true;
                        }
                    }

                    if (!found) {
                        console.error("Destructuring mutations must have an event parameter");
                        return;
                    }
                }
                m = new DestructuringMutator(b, info);
                break;
            case MutatorTypes.RestParameterMutator:
                m = new ArrayMutator(b, info);
                break;
            case MutatorTypes.DefaultInstanceMutator:
                m = new DefaultInstanceMutator(b, info);
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
            case MutatorTypes.DefaultInstanceMutator:
                mutationElement.setAttribute(DefaultInstanceMutator.attributeName, mutation);
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
        public compose(topBlock: Blockly.BlockSvg): void {
            const allBlocks = topBlock.getDescendants(false).map(subBlock => {
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
        public decompose(workspace: Blockly.WorkspaceSvg): Blockly.Block {
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

        public compileMutation(e: Environment, comments: string[]): JsNode {
            return undefined;
        }

        public getDeclaredVariables(): pxt.Map<string> {
            return undefined;
        }

        public isDeclaredByMutation(varName: string): boolean {
            return false;
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

        // Avoid clashes by starting labels with a number
        private static prefixLabel = "0prefix_label_";

        private currentlyVisible: string[] = [];
        private parameters: string[];
        private parameterTypes: Map<string>;
        private parameterRenames: Map<string> = {};
        private paramIndex: number;

        private prefix: string;

        constructor(b: Blockly.Block, info: pxtc.SymbolInfo) {
            super(b, info);

            this.prefix = this.info.attributes.mutatePrefix;

            this.block.appendDummyInput(MutatorHelper.mutatedVariableInputName);
            this.block.appendStatementInput("HANDLER")
                .setCheck("null");
        }

        public getMutationType(): string {
            return MutatorTypes.ObjectDestructuringMutator;
        }

        public compileMutation(e: Environment, comments: string[]): JsNode {
            if (!this.info.attributes.mutatePropertyEnum && !this.parameters.length) {
                return undefined;
            }

            const declarationString =  this.parameters.map(param => {
                const varField = this.block.getField(param);
                const declaredName = varField && varField.getText();
                const escapedParam = escapeVarName(param, e);
                if (declaredName !== param) {
                    this.parameterRenames[param] = declaredName;
                    return `${param}: ${escapeVarName(declaredName, e)}`;
                }
                return escapedParam;
            }).join(", ");

            const functionString = `function ({ ${declarationString} })`;

            if (this.info.attributes.mutatePropertyEnum) {
                return mkText(` [${this.parameters.map(p => `${this.info.attributes.mutatePropertyEnum}.${p}`).join(", ")}],${functionString}`)
            }
            else {
                return mkText(functionString);
            }
        }

        public getDeclaredVariables(): pxt.Map<string> {
            const result: pxt.Map<string> = {};

            this.parameters.forEach(param => {
                result[this.getVarFieldValue(param)] = this.parameterTypes[param];
            });

            return result;
        }

        public isDeclaredByMutation(varName: string): boolean {
            return this.parameters.some(param => this.getVarFieldValue(param) === varName)
        }

        public mutationToDom(): Element {
            // Save the parameters that are currently visible to the DOM along with their names
            const mutation = document.createElement("mutation");
            const attr = this.parameters.map(param => {
                const varName = this.getVarFieldValue(param);
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

                if (this.paramIndex === undefined) {
                    this.paramIndex = this.getParameterIndex();
                }

                split.forEach(saved => {
                    // Parse the old way of storing renames to maintain backwards compatibility
                    const parts = saved.split(":");
                    if (this.info.parameters[this.paramIndex].properties.some(p => p.name === parts[0])) {
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
                        this.parameterRenames[prop.property] = prop.newName;
                    }
                });

                this.updateVisibleProperties();

                // Override any names that the user has changed
                properties.filter(p => !!p.newName).forEach(p => this.setVarFieldValue(p.property, p.newName));
            }
        }

        protected getVarFieldValue(fieldName: string): string {
            const varField = this.block.getField(fieldName);
            return varField && varField.getText();
        }

        protected setVarFieldValue(fieldName: string, newValue: string) {
            const varField = this.block.getField(fieldName);
            if (this.block.getField(fieldName)) {
                setVarFieldValue(this.block, fieldName, newValue);
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

            if (this.paramIndex === undefined) {
                this.paramIndex = this.getParameterIndex();
            }

            return this.info.parameters[this.paramIndex].properties.map(property => {
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

            if (this.prefix && this.currentlyVisible.length === 0) {
                dummyInput.appendField(this.prefix, DestructuringMutator.prefixLabel);
            }

            this.currentlyVisible.forEach(param => {
                if (this.parameters.indexOf(param) === -1) {
                    const name = this.getVarFieldValue(param);

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

            if (this.prefix && this.parameters.length === 0) {
                dummyInput.removeField(DestructuringMutator.prefixLabel);
            }

            this.currentlyVisible = this.parameters;
        }

        private propertyId(property: string) {
            return this.block.type + "_" + property;
        }

        private getParameterIndex() {
            for (let i = 0; i < this.info.parameters.length; i++) {
                if (this.info.parameters[i].type.indexOf("=>") !== -1) {
                    return i;
                }
            }
            return undefined;
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

        public mutationToDom(): Element {
            const mutation = document.createElement("mutation");
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
                const valueBlock = this.block.workspace.newBlock("math_number") as Blockly.BlockSvg;
                valueBlock.initSvg();
                valueBlock.setShadow(true);
                input.connection.connect(valueBlock.outputConnection);
                (this.block.workspace as Blockly.WorkspaceSvg).render();
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

    class DefaultInstanceMutator extends MutatorHelper {
        public static attributeName = "showing";
        public static instanceInputName = "__instance__";
        private static instanceSubBlockType = "instance";

        private showing = false;

        public getMutationType(): string {
            return MutatorTypes.DefaultInstanceMutator;
        }

        public compileMutation(e: Environment, comments: string[]): JsNode {
            if (this.showing) {
                const target = this.block.getInputTargetBlock(DefaultInstanceMutator.instanceInputName);
                if (target) {
                    return compileExpression(e, target, comments);
                }
            }
            return undefined;
        }

        public mutationToDom(): Element {
            const mutation = document.createElement("mutation");
            mutation.setAttribute(DefaultInstanceMutator.attributeName, this.showing ? "true" : "false");
            return mutation;
        }

        public domToMutation(xmlElement: Element): void {
            const attribute = xmlElement.getAttribute(DefaultInstanceMutator.attributeName);
             if (attribute) {
                 this.updateShape(attribute === "true");
             }
             else {
                 this.updateShape(false);
             }
        }

        protected updateBlock(subBlocks: BlockName[]) {
            this.updateShape(!!(subBlocks && subBlocks.length));
        }

        protected getSubBlockNames(): BlockName[] {
            return [{
                name: "Instance",
                type: DefaultInstanceMutator.instanceSubBlockType
            }];
        }

        protected getVisibleBlockTypes(): string[] {
            const result: string[] = [];
            if (this.showing) {
                result.push(DefaultInstanceMutator.instanceSubBlockType);
            }
            return result;
        }

        private updateShape(show: boolean) {
            if (this.showing !== show) {
                if (show && !this.block.getInputTargetBlock(DefaultInstanceMutator.instanceInputName)) {
                    this.block.appendValueInput(DefaultInstanceMutator.instanceInputName);
                }
                else {
                    this.block.removeInput(DefaultInstanceMutator.instanceInputName);
                }
                this.showing = show;
            }
        }
    }
}