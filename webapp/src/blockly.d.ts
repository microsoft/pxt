declare module goog {
    function require(name:string) : void;
    function provide(name:string): void;
    function isFunction(f: any): boolean;
}
declare module Blockly {
    function fireUiEvent(node: any, eventName: string) : void;
    
    module JavaScript {
        function workspaceToCode(workspace : Workspace) : string;
    }
    
    class Block {
        static obtain(workspace: Workspace, prototypeName?: string): Block;

        // May allow downcasting (see below).
        type: string;
        id: string;

        // Returns null if the field does not exist on the specified block.
        getFieldValue(field: string): string;
        setFieldValue(newValue: string, field: string): void;
        // Returns null if the input does not exist on the specified block, or
        // is disconnected.
        getInputTargetBlock(field: string): Block;
        // Returns null if no next block or is disconnected.
        getNextBlock(): Block;

        outputConnection: Connection;

        svgGroup_: SVGElement;
        parentBlock_: Block;
        inputList: Input[];
        disabled: boolean;
    }

    // if type == controls_if
    class IfBlock extends Block {
        elseifCount_: number;
        elseCount_: number;
    }

    class Input {
        constructor(type: number, name: string, source: Block, target: Connection);
        name: string;
        connection: Connection;
        sourceBlock_: Block;
    }

    class Connection {
        constructor(b: Block, type: number);
        check_: string[];
        targetConnection: Connection;
        sourceBlock_: Block;
        targetBlock(): Block;
    }

    // if type is one of "procedures_def{,no}return", or "procedures_call{,no}return"
    class DefOrCallBlock extends Block {
        arguments_: string[];
    }

    class Workspace {
        clear(): void;
        dispose(): void;
        getTopBlocks(ordered: boolean): Block[];
        getAllBlocks(): Block[];
        addChangeListener(f: () => void): callbackHandler;
        removeChangeListener(h: callbackHandler): void;
        updateToolbox(newTree: Element | string) : void;
    }

    module Xml {
        function domToText(dom: Element): string;
        function domToPrettyText(dom: Element): string;
        function domToWorkspace(workspace: Workspace, dom: Element): void;
        function textToDom(text: string): Element;
        function workspaceToDom(workspace: Workspace): Element;
    }

    interface Options {
        readOnly?: boolean;
        toolbox?: Element | string;
        trashcan?: boolean;
        collapse?: boolean;
        comments?: boolean;
        disable?: boolean;
        scrollbars?: boolean;
        sound?: boolean;
        css?: boolean;
        media?: string;
        grid?: {
            spacing?: number;
            length?: number;
            colour?: string;
            snap?: boolean;
        };
        zoom?: {
            enabled?: boolean;
            controls?: boolean;
            wheel?: boolean;
            maxScale?: number;
            minScale?: number;
            scaleSpeed?: number;
        };
        enableRealTime?: boolean;
    }

    interface callbackHandler { }

    function inject(elt: Element, options?: Options): void;

    var mainWorkspace: Workspace;
}
