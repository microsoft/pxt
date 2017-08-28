
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
        function removeNode(node: Node): void;
        function getViewportSize(): any;

        namespace classlist {
            function add(el: Element, className: string): void;
        }
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
            removeChildren(opt_unrender: boolean): void;
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
        class ColorPicker extends Component {
            static SIMPLE_GRID_COLORS: Array<string>;
            setSize(value: goog.math.Size | number): void;
            setColors(colurs: Array<string>): void;
            setSelectedColor(color: string): void;
        }
        class ColorPalette extends Control {
            constructor(opt_colors?: Array<string>);
            setSize(value: goog.math.Size | number): void;
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
        function getPageOffset(element: Element): math.Coordinate;
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
    function bindEventWithChecks_(node: any, eventName: string, target: any, fn: (e: any) => void, nocapture?: boolean): void;
    function unbindEvent_(bindData: any): Function;
    function svgResize(workspace: Blockly.Workspace): void;
    function hueToRgb(hue: number): string;

    function alert(message: string, opt_callback?: () => void): void;
    function confirm(message: string, callback: (response: boolean) => void): void;
    function prompt(message: string, defaultValue: string, callback: (response: string) => void): void;

    function hideChaff(): void;

    let ALIGN_LEFT: number;
    let ALIGN_RIGHT: number;
    let ALIGN_CENTRE: number;

    const OUTPUT_SHAPE_HEXAGONAL: number;
    const OUTPUT_SHAPE_ROUND: number;
    const OUTPUT_SHAPE_SQUARE: number;
    
    let VARIABLE_CATEGORY_NAME: string;
    let PROCEDURE_CATEGORY_NAME: string;

    namespace utils {
        function wrap(tip: string, limit: number): string;
        function genUid(): string;
        function mouseToSvg(e: Event, svg: Element): any;
        function isRightButton(e: Event): boolean;
        function createSvgElement(tag: string, options: any, fg?: any): any;
        function noEvent(e: Event): void;
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

    class Field {
        static NBSP: string;
        name: string;
        EDITABLE: boolean;
        sourceBlock_: Block;
        fieldGroup_: Element;
        textElement_: Element;
        arrowWidth_: number;
        maxDisplayLength: number;
        visible_: boolean;
        text_: string;
        size_: goog.math.Size;
        init(): void;
        static superClass_: Field;
        constructor(text: string, opt_validator?: Function);
        callValidator(text: string): string;
        getText(): string;
        setText(newText: any): void;
        updateEditable(): void;
        dispose(): void;
        render_(): void;
        showEditor_(): void;
        getAbsoluteXY_(): goog.math.Coordinate;
        getScaledBBox_(): goog.math.Size;
        setValue(newValue: string): void;
        getValue(): string;
        isCurrentlyEditable(): boolean;
        setSourceBlock(block: Block): void;
        static getCachedWidth(textElement: Element): number;
        addArgType(argType: string): void;
    }

    class FieldVariable extends Field {
        constructor(d: any);
    }

    class FieldProcedure extends Field {
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
        validate_(): void;
        resizeEditor_(): void;
    }

    class FieldDropdown extends Field {
        box_: Element;
        arrow_: Element;
        arrowY_: number;
        imageElement_: Element;
        imageJson_: any;
        constructor(val: ({ src: string; alt: string; width: number; height: number; } | string)[][] | (() => ({ src: string; alt: string; width: number; height: number; } | string)[][]), opt_validator?: Function);

        static CHECKMARK_OVERHANG: number;
        protected value_: any;
        constructor(val: (string[] | Object)[]);
        protected getOptions(): (string[] | Object)[];
        onItemSelected(menu: goog.ui.Menu, menuItem: goog.ui.MenuItem): void;
        positionArrow(x: number): number;
        shouldShowRect_(): boolean;
    }

    class FieldNumber extends FieldTextInput {
        constructor(value: string | number, opt_min?: any, opt_max?: any, opt_precision?: any, opt_validator?: Function);
        setConstraints(min: any, max: any, precision?: any): void;
    }

    class FieldTextDropdown extends FieldDropdown {
        constructor(text: string, menuGenerator: ({ src: string; alt: string; width: number; height: number; } | string)[][], opt_validator?: Function, opt_restrictor?: any);
    }

    class FieldNumberDropdown extends FieldDropdown {
        constructor(value: string | number, menuGenerator: ({ src: string; alt: string; width: number; height: number; } | string)[][], opt_min?: any, opt_max?: any, opt_precision?: any, opt_validator?: Function);        
    }

    class FieldIconMenu extends FieldDropdown {
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
        isInFlyout: boolean;
        rendered: boolean;
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
        getColourSecondary(): string;
        getColourTertiary(): string;
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
        setDeletable(deletable: boolean): void;
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
        isEditable(): boolean;
        isInsertionMarker(): boolean;
        isShadow(): boolean;

        render(): void;
        bumpNeighbours_(): void;
        select(): void;
        getRelativeToSurfaceXY(): goog.math.Coordinate;
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
        scale: number;
        svgGroup_: any;
        scrollbar: ScrollbarPair;
        svgBlockCanvas_: SVGGElement;

        scrollX: number;
        scrollY: number;

        undoStack_: Blockly.Events.Abstract[];
        redoStack_: Blockly.Events.Abstract[];

        newBlock(prototypeName: string, opt_id?: string): Block;
        addTopBlock(block: Block): void;
        getAllBlocks(): Block[];
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
        glowBlock(id: string, state: boolean): void;
        glowStack(id: string, state: boolean): void;
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
        getVariable(name: string): number;
        getVariablesOfType(type: string): VariableModel[];
        getAudioManager(): WorkspaceAudio;

        registerButtonCallback(key: string, func: (button: Blockly.FlyoutButton) => void): void;
        registerToolboxCategoryCallback(a: string, b: Function): void;

        resizeContents(): void;
    }

    class WorkspaceAudio {
        play(audio: string): void;
    }

    class WorkspaceSvg {
        moveDrag(e: Event): goog.math.Coordinate;
        showContextMenu_(e: Event): void;
    }

    namespace Xml {
        function domToText(dom: Element): string;
        function domToPrettyText(dom: Element): string;
        function domToWorkspace(dom: Element, workspace: Workspace): string[];
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
            startScale?: number;
        };
        enableRealTime?: boolean;
        rtl?: boolean;
    }

    interface ToolboxOptions {
        colour?: boolean;
        border?: boolean;
        inverted?: boolean;
        invertedMultiplier?: number;
        disabledOpacity?: number;
    }

    interface ExtendedOptions extends Options {
        toolboxOptions?: ToolboxOptions;
    }

    // tslint:disable-next-line
    interface callbackHandler { }

    function inject(elt: Element, options?: Options): Workspace;

    namespace Names {
        function equals(old: string, n: any): boolean;
    }

    namespace Variables {
        function generateVariableFieldXml_(variableModel: VariableModel): void;
        function allVariables(wp: Workspace): string[];
        let flyoutCategory: (wp: Workspace) => HTMLElement[];
        let flyoutCategoryBlocks: (wp: Workspace) => HTMLElement[];
        function createVariable(wp: Workspace, opt_callback?: ((e: any) => void)): void;
    }

    class VariableModel {
        name: string;
        type: string;
        static compareByName: any;
        constructor(wp: Workspace, name: string, type?: string, id?: string);
        getId(): string;
    }

    namespace Procedures {
        function allProcedures(wp: Workspace): [any, any][];
        function getDefinition(name: string, wp: Workspace): Block;
        let flyoutCategory: (wp: Workspace) => HTMLElement[];
        function isLegalName_(name: string, workspace: Workspace, opt_exclude?: Blockly.Block): boolean;
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
        let SEP_SPACE_X: number;
        let MIN_BLOCK_Y: number;
        let FIELD_Y_OFFSET: number;
        let EDITABLE_FIELD_PADDING: number;
        let BOX_FIELD_PADDING: number;
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
            onKeyDown(e: any): void;
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

    namespace DropDownDiv {
        let content_: HTMLElement;
        function hide(): void;
        function hideIfOwner(owner: any): void;
        function hideWithoutAnimation(): void;
        function showPositionedByBlock(owner: any, block: Blockly.Block, opt_onHide?: Function, opt_secondaryYOffset?: number): void;
        function clearContent(): void;
        function getContentDiv(): HTMLElement;
        function setColour(backgroundColour: string, borderColour: string): void;
    }

    var Tooltip: any;

    class PXTUtils {
        static fadeColour(hex: string, luminosity: number, lighten: boolean): string;
    }

    interface Colours {
        textField: string;
        insertionMarker: string;
        insertionMarkerOpacity: string;
    }
}
