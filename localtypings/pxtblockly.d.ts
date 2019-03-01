/// <reference path="blockly.d.ts" />
/// <reference path="pxtpackage.d.ts" />

declare namespace Blockly {

    /**
     * Block Definitions
     */ 

    interface BlockDefinition {
        codeCard?: any;
        init: () => void;
        getVars?: () => any[];
        renameVar?: (oldName: string, newName: string) => void;
        customContextMenu?: any;
        getProcedureCall?: () => string;
        renameProcedure?: (oldName: string, newName: string) => void;
        defType_?: string;
        onchange?: (event: any) => void;
        mutationToDom?: () => Element;
        domToMutation?: (xmlElement: Element) => void;
    }

    const Blocks: {
        [index: string]: BlockDefinition;
    }

    // if type == controls_if
    class IfBlock extends Block {
        elseifCount_: number;
        elseCount_: number;
    }

    /**
     * Custom Fields
     */ 

    interface FieldCustomOptions {
        blocksInfo: any;
        colour?: string | number;
        label?: string;
        type?: string;
    }

    interface FieldCustomDropdownOptions extends FieldCustomOptions {
        data?: any;
    }

    interface FieldCustom extends Field {
        isFieldCustom_: boolean;
        saveOptions?(): pxt.Map<string | number | boolean>;
        restoreOptions?(map: pxt.Map<string | number | boolean>): void;
    }

    interface FieldCustomConstructor {
        new(text: string, options: FieldCustomOptions, validator?: Function): FieldCustom;
    }

    /**
     * Functions
     */ 

    namespace PXTBlockly {
        namespace FunctionUtils {
            let argumentIcons: {[typeName: string]: string};
            let argumentDefaultNames: {[typeName: string]: string};
            function createCustomArgumentReporter(typeName: string, ws: Blockly.Workspace): Blockly.Block;
        }
    }

    namespace Functions {
        interface ArgumentInfo {
            type: string;
            name: string;
            id: string;
        }
        type ConfirmEditCallback = (mutation: Element) => void;
    }

    class FunctionBlockAbstract extends BlockSvg {
        getArguments: () => Functions.ArgumentInfo[];
    }

    class FunctionDeclarationBlock extends FunctionBlockAbstract {
        updateFunctionSignature: () => void;
        addBooleanExternal(): void;
        addStringExternal(): void;
        addNumberExternal(): void;
        addCustomExternal(typeName: string): void;
    }

    class FunctionDefinitionBlock extends FunctionBlockAbstract { }
    class FunctionCallBlock extends FunctionBlockAbstract { }
}