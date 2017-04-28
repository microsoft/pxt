
declare namespace goog {
    function require(name: string): void;
    function provide(name: string): void;
    function isFunction(f: any): boolean;
    function isString(s: any): boolean;

    class Disposable {
        dispose(): void;
    }

    namespace string {
        let caseInsensitiveCompare: (a: string, b: string) => number;
    }

    namespace array {
        function remove(ar: string[], v: string): void;
    }

    namespace dom {
        function createDom(tagName: string, opt_attributes?: Object, ...var_args: Object[]): Element;
        function createDom(name: string, ns?: string, children?: any): HTMLElement;
        function removeChildren(el: Element): void;
        function getViewportSize(): any;
    }

    namespace math {
        class Box {
            top: number;
            right: number;
            bottom: number;
            left: number;
            constructor(top: number, right: number, bottom: number, left: number);
        }
        class Coordinate {
            x: number;
            y: number;
            constructor(x: number, y: number);
            clone(): Coordinate;

            static difference(a: Coordinate, b: Coordinate): Coordinate;
            static sum(a: Coordinate, b: Coordinate): Coordinate;
            static magnitude(a: Coordinate): number;
        }
        class Size {
            width: number;
            height: number;
            constructor(width: number, height: number);
        }
        function clamp(n: number, min: number, max: number): void;
    }

    namespace ui {
        class Control extends Component {
            getChildCount(): number;
            getContent(): string | Node | Array<Node>;
            getContentElement(): Element;
            setChecked(checked: boolean): void;
            setContent(content: string | Node | Array<Node>): void;
            setVisible(visible: boolean, opt_force?: boolean): boolean;
        }
        class Component {
            static EventType: {
                BEFORE_SHOW: string;
                SHOW: string;
                HIDE: string;
                DISABLE: string;
                ENABLE: string;
                HIGHLIGHT: string;
                UNHIGHLIGHT: string;
                ACTIVATE: string;
                DEACTIVATE: string;
                SELECT: string;
                UNSELECT: string;
                CHECK: string;
                UNCHECK: string;
                FOCUS: string;
                BLUR: string;
                OPEN: string;
                CLOSE: string;
                ENTER: string;
                LEAVE: string;
                ACTION: string;
                CHANGE: string;
            };
            getHandler<T>(): events.EventHandler<T>;
            getElement(): Element;
            render(opt_parentElement?: Element): void;
            setId(id: string): void;
            setRightToLeft(rightToLeft: boolean): void;
            addChild(child: Component, opt_render?: boolean): void;
            getChildAt(index: number): Component;
        }
        class CustomButton extends Control {
            title: string;
        }
        class Container extends Component {
        }
        class Menu extends Container implements events.Listenable {
            listen: () => events.ListenableKey;
            setAllowAutoFocus(allow: boolean): void;
        }
        class MenuItem extends Control {
            constructor(content: (string | Node));
            setCheckable(checkable: boolean): void;
            setValue(value: any): void;
            getValue(): any;
            addClassName(className: string): void;
        }
        class Popup extends PopupBase {
            setPosition(position: positioning.ClientPosition): void;
        }
        class PopupBase extends events.EventTarget {
        }
        class Tooltip extends Popup {
            className: string;
            cursorPosition: math.Coordinate;
            constructor(opt_el?: Node | string, opt_str?: string);
            onShow(): void;
            setShowDelayMs(ms: number): void;
        }
        class Slider extends Component {
            setMoveToPointEnabled(val: boolean): void;
            setMinimum(min: number): void;
            setMaximum(max: number): void;
            setRightToLeft(rightToLeft: boolean): void;
            setValue(value: number): void;
        }
    }

    namespace style {
        let backgroundColor: number;
        function getBorderBox(element: Element): math.Box;
        function getMarginBox(element: Element): math.Box;
        function getPaddingBox(element: Element): math.Box;
        function getSize(element: Element): math.Size;
        function getViewportPageOffset(doc: Document): math.Coordinate;
        function scrollIntoContainerView(element: Element, opt_container?: Element, opt_center?: boolean): void;
        function setHeight(element: Element, height: number | string): void;
        function setWidth(element: Element, width: number | string): void;
    }

    namespace events {
        function listen(eventSource: Element | Listenable, eventType: EventType, listener: any, capturePhase?: boolean, handler?: Object): void;
        function unlistenByKey(key: any): void;
        interface ListenableKey {
            key: number;
        }
        interface Listenable {
            listen: () => ListenableKey;
        }
        type EventType = string;
        let EventType: {
            CLICK: EventType;
            RIGHTCLICK: EventType;
            DBLCLICK: EventType;
            MOUSEDOWN: EventType;
            MOUSEUP: EventType;
            MOUSEOVER: EventType;
            MOUSEOUT: EventType;
            MOUSEMOVE: EventType;
            MOUSEENTER: EventType;
            MOUSELEAVE: EventType;
            SELECTSTART: EventType;
            WHEEL: EventType;
            KEYPRESS: EventType;
            KEYDOWN: EventType;
            KEYUP: EventType;
            BLUR: EventType;
            FOCUS: EventType;
            DEACTIVATE: EventType;
            FOCUSIN: EventType;
            FOCUSOUT: EventType;
            CHANGE: EventType;
            SELECT: EventType;
            SUBMIT: EventType;
            INPUT: EventType;
            PROPERTYCHANGE: EventType;
            DRAGSTART: EventType;
            DRAG: EventType;
            DRAGENTER: EventType;
            DRAGOVER: EventType;
            DRAGLEAVE: EventType;
            DROP: EventType;
            DRAGEND: EventType;
            TOUCHSTART: EventType;
            TOUCHMOVE: EventType;
            TOUCHEND: EventType;
            TOUCHCANCEL: EventType;
            BEFOREUNLOAD: EventType;
            CONSOLEMESSAGE: EventType;
            CONTEXTMENU: EventType;
            DOMCONTENTLOADED: EventType;
            ERROR: EventType;
            HELP: EventType;
            LOAD: EventType;
            LOSECAPTURE: EventType;
            ORIENTATIONCHANGE: EventType;
            READYSTATECHANGE: EventType;
            RESIZE: EventType;
            SCROLL: EventType;
            UNLOAD: EventType;
            HASHCHANGE: EventType;
            PAGEHIDE: EventType;
            PAGESHOW: EventType;
            POPSTATE: EventType;
            COPY: EventType;
            PASTE: EventType;
            CUT: EventType;
            BEFORECOPY: EventType;
            BEFORECUT: EventType;
            BEFOREPASTE: EventType;
            ONLINE: EventType;
            OFFLINE: EventType;
            MESSAGE: EventType;
            CONNECT: EventType;
            ANIMATIONSTART: EventType;
            ANIMATIONEND: EventType;
            ANIMATIONITERATION: EventType;
            TRANSITIONEND: EventType;
            POINTERDOWN: EventType;
            POINTERUP: EventType;
            POINTERCANCEL: EventType;
            POINTERMOVE: EventType;
            POINTEROVER: EventType;
            POINTEROUT: EventType;
            POINTERENTER: EventType;
            POINTERLEAVE: EventType;
            GOTPOINTERCAPTURE: EventType;
            LOSTPOINTERCAPTURE: EventType;
            MSGESTURECHANGE: EventType;
            MSGESTUREEND: EventType;
            MSGESTUREHOLD: EventType;
            MSGESTURESTART: EventType;
            MSGESTURETAP: EventType;
            MSGOTPOINTERCAPTURE: EventType;
            MSINERTIASTART: EventType;
            MSLOSTPOINTERCAPTURE: EventType;
            MSPOINTERCANCEL: EventType;
            MSPOINTERDOWN: EventType;
            MSPOINTERENTER: EventType;
            MSPOINTERHOVER: EventType;
            MSPOINTERLEAVE: EventType;
            MSPOINTERMOVE: EventType;
            MSPOINTEROUT: EventType;
            MSPOINTEROVER: EventType;
            MSPOINTERUP: EventType;
            TEXT: EventType;
            TEXTINPUT: EventType;
            COMPOSITIONSTART: EventType;
            COMPOSITIONUPDATE: EventType;
            COMPOSITIONEND: EventType;
            EXIT: EventType;
            LOADABORT: EventType;
            LOADCOMMIT: EventType;
            LOADREDIRECT: EventType;
            LOADSTART: EventType;
            LOADSTOP: EventType;
            RESPONSIVE: EventType;
            SIZECHANGED: EventType;
            UNRESPONSIVE: EventType;
            VISIBILITYCHANGE: EventType;
            STORAGE: EventType;
            DOMSUBTREEMODIFIED: EventType;
            DOMNODEINSERTED: EventType;
            DOMNODEREMOVED: EventType;
            DOMNODEREMOVEDFROMDOCUMENT: EventType;
            DOMNODEINSERTEDINTODOCUMENT: EventType;
            DOMATTRMODIFIED: EventType;
            DOMCHARACTERDATAMODIFIED: EventType;
        };
        class EventTarget extends Disposable {
        }
        class EventHandler<T> {
            handleEvent(e: any): void;
            listen(src: Element | Listenable, type: string, opt_fn?: any): EventHandler<T>;
        }
    }
    namespace userAgent {
        /**
         * Whether the user agent is running on a mobile device.
         *
         * TODO(nnaze): Consider deprecating MOBILE when labs.userAgent
         *   is promoted as the gecko/webkit logic is likely inaccurate.
         *
         * @type {boolean}
         */
        var MOBILE: boolean;

        /**
         * Whether the user agent is running on Android.
         * @type {boolean}
         */
        var ANDROID: boolean;

        /**
         * Whether the user agent is running on an iPhone.
         * @type {boolean}
         */
        var IPHONE: boolean;

        /**
         * Whether the user agent is running on an iPad.
         * @type {boolean}
         */
        var IPAD: boolean;
    }
    namespace positioning {
        class ClientPosition {
            constructor(x: number, y: number);
        }
    }
}

declare namespace Blockly {
    let selected: any;
    function bindEvent_(node: any, eventName: string, target: any, fn: (e: any) => void): void;
    function terminateDrag_(): void;
    function svgResize(workspace: Blockly.Workspace): void;
    function hueToRgb(hue: number): string;

    function alert(message: string, opt_callback?: () => void): void;
    function confirm(message: string, callback: (response: boolean) => void): void;
    function prompt(message: string, defaultValue: string, callback: (response: string) => void): void;

    let ALIGN_LEFT: number;
    let ALIGN_RIGHT: number;
    
    const OUTPUT_SHAPE_HEXAGONAL: number;
    const OUTPUT_SHAPE_ROUND: number;
    const OUTPUT_SHAPE_SQUARE: number;

    namespace utils {
        function wrap(tip: string, limit: number): string;
        function genUid(): string;
        function mouseToSvg(e: Event, svg: Element): any;
    }

    class FieldImage {
        constructor(url: string, width: number, height: number, def: string);
    }

    interface BlockDefinition {
        codeCard?: any;
        init: () => void;
        getVars?: () => any[];
        renameVar?: (oldName: string, newName: string) => void;
        customContextMenu?: any;
    }

    const Blocks: {
        [index: string]: BlockDefinition;
    }

    class Field {
        name: string;
        EDITABLE: boolean;
        borderRect_: any;
        sourceBlock_: Block;
        init(block: Block): void;
        static superClass_: Field;
        constructor(text: string, opt_validator?: Function);
        callValidator(text: string): string;
        getText(): string;
        setText(newText: any): void;
        updateEditable(): void;
        dispose(): void;
        showEditor_(): void;
        getAbsoluteXY_(): goog.math.Coordinate;
        getScaledBBox_(): goog.math.Size;
        setValue(newValue: string): void;
        getValue(): string;
    }

    class FieldVariable extends Field {
        constructor(d: any);
    }

    class FieldCheckbox extends Field {
        constructor(val: string);
        static CHECK_CHAR: string;
    }

    class FieldTextInput extends Field {
        text_: string;
        constructor(text: string, validator: any);
        static numberValidator: any;
        static htmlInput_: HTMLInputElement;

        onHtmlInputChange_(e: any): void;
    }

    class FieldDropdown extends Field {
        constructor(val: ({ src: string; alt: string; width: number; height: number; } | string)[][] | (() => ({ src: string; alt: string; width: number; height: number; } | string)[][]));

        static CHECKMARK_OVERHANG: number;
        protected value_: any;
        constructor(val: (string[] | Object)[]);
        protected getOptions_(): (string[] | Object)[];
        onItemSelected(menu: goog.ui.Menu, menuItem: goog.ui.MenuItem): void;
    }

    class FieldNumber extends FieldTextInput {
        constructor(value: string | number, opt_min?: any, opt_max?: any, opt_precision?: any, opt_validator?: any);
        setConstraints(min: any, max: any, precision?: any): void;
    }

    class FieldGridPicker extends FieldDropdown {
        constructor(menuGenerator: ({ src: string; alt: string; width: number; height: number; } | string)[][], colour?: string | number, params?: pxt.Map<string> ); 
    }
    class FieldIconDropdown extends FieldDropdown {
        constructor(menuGenerator: ({ src: string; alt: string; width: number; height: number; } | string)[][], params?: pxt.Map<string> ); 
    }
    
    class FieldSlider extends FieldNumber {
    }

    interface FieldCustomOptions {
        colour?: string | number;
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

    class Block {
        static obtain(workspace: Workspace, prototypeName?: string): Block;

        // May allow downcasting (see below).
        type: string;
        id: string;
        isShadow_: boolean;
        nextConnection: Connection;
        outputConnection: Connection;
        previousConnection: Connection;
        workspace: Workspace;

        RTL: boolean;

        // private
        xy_: goog.math.Coordinate;


        // Returns null if the field does not exist on the specified block.
        getFieldValue(field: string): string;
        // Returns null if the input does not exist on the specified block, or
        // is disconnected.
        getInputTargetBlock(field: string): Block;
        getInputsInline(): boolean;
        // Returns null if no next block or is disconnected.
        getNextBlock(): Block;
        // Unplug this block from its superior block.  If this block is a statement, optionally reconnect the block underneath with the block on top.
        unplug(): void;

        moveBy(x: number, y: number): void;
        getHeightWidth(): { width: number; height: number; };
        getBoundingRectangle(): {
            topLeft: goog.math.Coordinate;
            bottomRight: goog.math.Coordinate;
        }

        getSurroundParent(): Block;

        svgGroup_: SVGElement;
        parentBlock_: Block;
        inputList: Input[];
        disabled: boolean;
        comment: string | Comment;

        appendDummyInput(opt_name?: string): Input;
        appendStatementInput(name: string): Input;
        appendValueInput(name: string): Input;
        getChildren(): Block[];
        getColour(): string;
        getDescendants(): Block[];
        initSvg(): void;
        removeInput(name: string, opt_quiet?: boolean): void;
        dispose(healGap: boolean): void;
        setCollapsed(collapsed: boolean): void;
        setColour(colour: number | string, secondaryColour?: string, tertiaryColour?: string): void;
        setOutputShape(shape: number): void;
        setCommentText(text: string): void;
        setConnectionsHidden(hidden: boolean): void;
        setDisabled(disabled: boolean): void;
        setEditable(editable: boolean): void;
        setFieldValue(newValue: string, name: string): void;
        setHelpUrl(url: string | Function): void;
        setInputsInline(newBoolean: boolean): void;
        setMovable(movable: boolean): void;
        setMutator(mutator: Mutator): void;
        setNextStatement(newBoolean: boolean, opt_check?: string | string[]): void;
        setOutput(newBoolean: boolean, opt_check?: string | string[]): void;
        setParent(newParent: Block): void;
        setPreviousStatement(newBoolean: boolean, opt_check?: string | string[]): void;
        setShadow(shadow: boolean): void;
        setTitleValue(newValue: string, name: string): void;
        setTooltip(newTip: string | (() => void)): void;
        // Passing null will delete current text
        setWarningText(text: string): void;
    }

    class Comment extends Icon {
        constructor(b: Block);

        dispose(): void;
        getBubbleSize(): { width: number, height: number };
        getText(): string;
        setBubbleSize(width: number, height: number): void;
        setText(text: string): void;
    }

    class Warning extends Icon {
    }

    class Icon {
        constructor(block: Block);

        collapseHidden: boolean;

        computeIconLocation(): void;
        createIcon(): void;
        dispose(): void;
        getIconLocation(): goog.math.Coordinate;
        isVisible(): boolean;
        setVisible(visible: boolean): void;
        renderIcon(cursorX: number): number;
        setIconLocation(xy: goog.math.Coordinate): void;
        updateColour(): void;
        updateEditable(): void;
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
        fieldRow: Field[];

        appendField(field: Field | string, opt_name?: string): Input;
        appendTitle(field: any, opt_name?: string): Input;
        dispose(): void;
        init(): void;
        isVisible(): boolean;
        removeField(name: string): void;
        setAlign(align: number): Input;
        setCheck(check: string | string[]): Input;
        setVisible(visible: boolean): Block;
    }

    class Connection {
        constructor(b: Block, type: number);
        check_: string[];
        targetConnection: Connection;
        sourceBlock_: Block;
        targetBlock(): Block;
        connect(otherConnection: Connection): void;
    }

    // if type is one of "procedures_def{,no}return", or "procedures_call{,no}return"
    class DefOrCallBlock extends Block {
        arguments_: string[];
    }

    interface BlocklyEvent {
        type: string;
        blockId?: string;
        workspaceId: string;
        recordUndo: boolean;
        element?: string;
        oldValue?: string;
        newValue?: string;
        name?: string;
        xml?: any;
        group?: string;
    }

    class FlyoutButton {
        getTargetWorkspace(): Blockly.Workspace;
    }

    class Mutator extends Icon {
        /**
         * @param quarkNames: list of sub_blocks for toolbox in mutator workspace
         */
        constructor(quarkNames: string[]);

        reconnect(connectionChild: Connection, block: Block, inputName: string): boolean;
        dispose(): void;
    }

    class ScrollbarPair {
        hScroll: Scrollbar;
        vScroll: Scrollbar;
        resize(): void;
    }

    class Scrollbar {
        svgHandle_: Element;
        ratio_: number;
        set(x: number): void;
    }

    class Workspace {
        svgGroup_: any;
        scrollbar: ScrollbarPair;
        svgBlockCanvas_: SVGGElement;

        undoStack_: Blockly.Events.Abstract[];
        redoStack_: Blockly.Events.Abstract[];

        newBlock(prototypeName: string, opt_id?: string): Block;
        render(): void;
        clear(): void;
        dispose(): void;
        getTopBlocks(ordered: boolean): Block[];
        getBlockById(id: string): Block;
        getAllBlocks(): Block[];
        addChangeListener(f: (e: BlocklyEvent) => void): callbackHandler;
        removeChangeListener(h: callbackHandler): void;
        updateToolbox(newTree: Element | string): void;
        getCanvas(): any;
        getParentSvg(): Element;
        zoom(x: number, y: number, type: number): void;
        zoomCenter(type: number): void;
        scrollCenter(): void;
        highlightBlock(id: string): void;
        undo(redo?: boolean): void;
        redo(): void;
        clearUndo(): void;
        isDragging(): boolean;
        getMetrics(): {
            absoluteLeft: number;
            absoluteTop: number;
            contentHeight: number;
            contentLeft: number;
            contentTop: number;
            contentWidth: number;
            viewHeight: number;
            viewLeft: number;
            viewTop: number;
            viewWidth: number;
        }
        variableIndexOf(name: string): number;

        registerButtonCallback(key: string, func: (button: Blockly.FlyoutButton) => void): void;

    }

    class WorkspaceSvg {
        moveDrag(e: Event): goog.math.Coordinate;
        showContextMenu_(e: Event): void;
    }

    namespace Xml {
        function domToText(dom: Element): string;
        function domToPrettyText(dom: Element): string;
        function domToWorkspace(dom: Element, workspace: Workspace): void;
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
            startScale?: number;
            scaleSpeed?: number;
        };
        enableRealTime?: boolean;
        rtl?: boolean;
    }

    interface ToolboxOptions {
        colour?: boolean;
        colourIcons?: boolean;
        invertedIcons?: boolean;
        border?: boolean;
        inverted?: boolean;
        invertedMultiplier?: number;
    }

    interface ExtendedOptions extends Options {
        toolboxType?: string; // TODO Remove when removed from pxt blockly fork
        toolboxOptions?: ToolboxOptions;
    }

    // tslint:disable-next-line
    interface callbackHandler { }

    function inject(elt: Element, options?: Options): Workspace;

    function createSvgElement(tag: string, options: any, fg: any): any;

    namespace Names {
        function equals(old: string, n: any): boolean;
    }

    namespace Variables {
        function allVariables(wp: Workspace): string[];
        let flyoutCategory: (wp: Workspace) => HTMLElement[];
        function createVariable(wp: Workspace, opt_callback?: ((e: any) => void)): void;
    }

    namespace ContextMenu {
        interface MenuItem {
            enabled?: boolean;
            text?: string;
            callback?: () => void;
        }

        function callbackFactory(block: Block, xml: HTMLElement): void;
        function show(e: any, menu: MenuItem[], rtl: boolean): void;
    }

    namespace Msg {
        const VARIABLES_DEFAULT_NAME: string;
        const VARIABLES_SET_CREATE_GET: string;
        const CONTROLS_FOR_INPUT_DO: string;
        const CONTROLS_FOR_TOOLTIP: string;
        const UNDO: string;
        const REDO: string;
        const COLLAPSE_ALL: string;
        const EXPAND_ALL: string;
        const DELETE_BLOCK: string;
        const DELETE_X_BLOCKS: string;
        const DELETE_ALL_BLOCKS: string;
    }

    namespace BlockSvg {
        let START_HAT: boolean;
    }

    namespace Events {
        const CREATE: string;
        const DELETE: string;
        const CHANGE: string;
        const MOVE: string;
        const UI: string;
        function setGroup(group: any): void;
        function fire(ev: Abstract): void;
        function disableOrphans(ev: Abstract): void;
        function isEnabled(): boolean;
        class Abstract {
            type: string;
        }
        class Change extends Abstract {
            constructor(block: Block, element: String, name: String, oldValue: String, newValue: String);
        }
    }

    namespace Toolbox {
        class TreeNode {
            isUserCollapsible_: boolean;

            getChildCount(): number;
            getParent(): TreeNode;
            getTree(): TreeControl;
            hasChildren(): boolean;
            isSelected(): boolean;
            onMouseDown(e: Event): void;
            select(): void;
            setExpanded(expanded: boolean): void;
            toggle(): void;
            updateRow(): void;
        }

        class TreeControl {
            selectedItem_: TreeNode;

            getSelectedItem(): TreeNode;
            setSelectedItem(t: TreeNode): void;
        }
    }

    namespace WidgetDiv {
        let DIV: Element;
        function show(newOwner: any, rtl: boolean, dispose?: () => void): void;
        function hideIfOwner(oldOwner: any): void;
        function hide(): void;
        function position(anchorX: number, anchorY: number, windowSize: goog.math.Size,
            scrollOffset: goog.math.Coordinate, rtl: boolean): void;
    }

    var Tooltip: any;

    class PXTUtils {
        static fadeColour(hex: string, luminosity: number, lighten: boolean): string;
    }
}
