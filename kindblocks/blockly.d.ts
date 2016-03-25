declare module goog {
    function require(name:string) : void;
    function provide(name:string): void;
    function isFunction(f: any): boolean;
    
    module string {
        var caseInsensitiveCompare : (a:string,b:string) =>number;
    }
        
    module array {
        function remove(ar:string[], v:string) : void;    
    }
    
    module dom {
        function createDom(name:string, ns?: string, children?: any) : HTMLElement;
    }
}
declare module Blockly {
    var selected: any;
    function bindEvent_(node: any, eventName: string, target: any, fn : () => void): void;
    function fireUiEvent(node: any, eventName: string) : void;
    
    var ALIGN_RIGHT : number;
    
    class FieldImage {
        constructor(url:string, width:number, height:number, def:string);
    }
    
    interface BlockDefinition {
        codeCard?: any;
        init: () => void;
        getVars?: () => any[];
        renameVar?: (oldName:string, newName:string) => void;
        customContextMenu?: any;        
    }
    
    var Blocks : ks.Util.StringMap<BlockDefinition>;    
    
    class Field {
        init(block:Block): void;        
        static superClass_: Field;
    }
    
    class FieldVariable extends Field {
        constructor(d:any);
    }
    
    class FieldCheckbox extends Field {
        constructor(val:string);
    }
    
    class FieldTextInput extends Field {
        constructor(text:string, validator:any);
        static numberValidator : any;
    }
    
    class FieldDropdown extends Field {
        constructor(val: string[][]);
    }
    
    class Block {
        static obtain(workspace: Workspace, prototypeName?: string): Block;

        // May allow downcasting (see below).
        type: string;
        id: string;

        // Returns null if the field does not exist on the specified block.
        getFieldValue(field: string): string;
        setFieldValue(newValue: string, field: string): void;
        setWarningText(text: string) : void;
        // Returns null if the input does not exist on the specified block, or
        // is disconnected.
        getInputTargetBlock(field: string): Block;
        // Returns null if no next block or is disconnected.
        getNextBlock(): Block;

        moveBy(x : number, y: number) : void;
        getHeightWidth() : { width: number; height: number;};

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
    
    interface BlocklyEvent {
        type : string;
    }

    class Workspace {
        clear(): void;
        dispose(): void;
        getTopBlocks(ordered: boolean): Block[];
        getBlockById(id:string): Block;
        getAllBlocks(): Block[];
        addChangeListener(f: (e : BlocklyEvent) => void): callbackHandler;
        removeChangeListener(h: callbackHandler): void;
        updateToolbox(newTree: Element | string) : void;
        getCanvas() : any;
        highlightBlock(id:string):void;
        getMetrics(): {            
            absoluteLeft: number;
            absoluteTop: number;
            contentHeight:number;
            contentLeft:number;
            contentTop: number;
            contentWidth: number;
            viewHeight: number;
            viewLeft: number;
            viewTop: number;
            viewWidth: number;       
        }
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

    function inject(elt: Element, options?: Options): Workspace;
   
    function createSvgElement(tag:string, options:any, fg:any) : any;
   
    module Names {
        function equals(old : string, n : any) : boolean;
    }
   
    module Variables {
        function allVariables(wp : Workspace) : string[];
        var flyoutCategory : (wp : Workspace) => HTMLElement[];
    }
    
    module ContextMenu {
        function callbackFactory(block: Block, xml : HTMLElement):void;
    }
    
    module Msg {
        var VARIABLES_DEFAULT_NAME : string;
        var VARIABLES_SET_CREATE_GET: string;
        var CONTROLS_FOR_INPUT_DO: string;
        var CONTROLS_FOR_TOOLTIP: string;
    }
    
    module BlockSvg {
        var START_HAT : boolean;
    }
    
    module Events {
        var DELETE : string;
    }
}
