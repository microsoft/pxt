import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as core from "./core";

export interface UiProps {
    icon?: string;
    iconClass?: string;
    text?: string;
    textClass?: string;
    children?: any;
    class?: string;
    role?: string;
    title?: string;
    ariaLabel?: string;
    tabIndex?: number;
    rightIcon?: boolean;
}

export interface WithPopupProps extends UiProps {
    popup?: string;
}

export interface DropdownProps extends WithPopupProps {
    tabIndex?: number;
    value?: string;
    title?: string;
    onChange?: (v: string) => void;
}

export interface SidebarProps extends UiProps {
    visible?: boolean;
}

export function cx(classes: string[]): string {
    return classes.filter((c) => c && c.length !== 0 && c.trim() != '').join(' ');
}

function genericClassName(cls: string, props: UiProps, ignoreIcon: boolean = false): string {
    return `${cls} ${ignoreIcon ? '' : props.icon && props.text ? 'icon icon-and-text' : props.icon ? 'icon' : ""} ${props.class || ""}`;
}

function genericContent(props: UiProps) {
    let retVal = [
        props.icon ? (<Icon key='iconkey' icon={props.icon + (props.text ? " icon-and-text " : "") + (props.iconClass ? " " + props.iconClass : '') } />) : null,
        props.text ? (<span key='textkey' className={'ui text' + (props.textClass ? ' ' + props.textClass : '') }>{props.text}</span>) : null,
    ]
    if (props.icon && props.rightIcon) retVal = retVal.reverse();
    return retVal;
}

export function popupWindow(url: string, title: string, width: number, height: number) {
    return window.open(url, title, `resizable=no, copyhistory=no, ` +
        `width=${width}, height=${height}, top=${(screen.height / 2) - (height / 2)}, left=${(screen.width / 2) - (width / 2)}`);
}

function removeClass(el: HTMLElement, cls: string) {
    if (el.classList) el.classList.remove(cls);
    else if (el.className.indexOf(cls) >= 0) el.className.replace(new RegExp(`(?:^|\\s)${cls}(?:\\s|$)`), ' ');
}

export function fireClickOnEnter(e: React.KeyboardEvent): void {
    let charCode = (typeof e.which == "number") ? e.which : e.keyCode
    if (charCode === core.ENTER_KEY || charCode === core.SPACE_KEY) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).click();
    }
}

export class UiElement<T extends WithPopupProps> extends data.Component<T, {}> {
    popup() {
        if (this.props.popup) {
            let ch = this.child("")
            ch.popup({
                content: this.props.popup
            });
            if (!ch.data("hasPopupHide")) {
                ch.data("hasPopupHide", "yes")
                ch.on("click", () => {
                    ch.popup("hide")
                })
            }
        }
    }

    componentDidMount() {
        this.popup()
    }

    componentDidUpdate() {
        this.popup()
    }

}

export class DropdownMenuItem extends UiElement<DropdownProps> {
    private isOpened = false
    private preventHide = false

    private menuItemKeyDown = (e: KeyboardEvent) => {
        let charCode = (typeof e.which == "number") ? e.which : e.keyCode
        if (charCode === core.TAB_KEY) {
            this.close()
        } else if (charCode === core.ENTER_KEY || charCode === core.SPACE_KEY) {
            /* give the focus back to the dropdown menu, so if the menuitem opens a modal,
               the focus will not be reset once the modal is closed. */
            this.child("").focus()
        }
    }

    private dropDownKeyDown = (e: JQueryKeyEventObject) => {
        let charCode = (typeof e.which == "number") ? e.which : e.keyCode
        if (charCode === core.ENTER_KEY || charCode === core.SPACE_KEY) {
            if (this.isOpened) {
                this.child("").dropdown("hide")
            } else {
                this.child("").dropdown("show")
            }
        }
    }

    private close() {
        this.preventHide = false
        this.child("").dropdown("hide")
    }

    componentDidMount() {
        this.popup()
        let dropdowmtag = this.child("")
        dropdowmtag.on("keydown", this.dropDownKeyDown)
        dropdowmtag.dropdown({
            action: (text: string, value: any, element: JQuery) => {
                this.close()

                // When we use the keyboard, it is not an HTMLElement that we receive, but a JQuery.
                if (typeof element.get === "function") {
                    if (element.get(0).tagName.toLowerCase() === 'a') {
                        window.open((element.get(0) as HTMLLinkElement).href, '_blank')
                    }
                }
            },
            fullTextSearch: true,
            onChange: (v: string, text: string, item: JQuery) => {
                this.preventHide = true
                item.get(0).focus()

                if (this.props.onChange && v != this.props.value) {
                    this.props.onChange(v)
                }
            },
            onShow: () => {
                this.isOpened = true
                this.forceUpdate()

                let menuItems = this.child(".item")
                menuItems.each((index: number, elem: HTMLElement) => {
                    elem.onkeydown = this.menuItemKeyDown
                })
            },
            onHide: () => {
                if (this.preventHide) {
                    this.preventHide = false
                    return false
                }

                this.isOpened = false
                this.forceUpdate()
                return true
            }
        });
    }

    componentDidUpdate() {
        this.child("").dropdown("refresh")
        this.popup()
    }

    renderCore() {
        return (
            <div className={genericClassName("ui dropdown item", this.props) }
                role="menuitem"
                title={this.props.title}
                tabIndex={this.props.tabIndex}
                aria-haspopup="true">
                {genericContent(this.props) }
                <div className="menu"
                    role="menu"
                    aria-expanded={this.isOpened}
                    aria-label={lf("Dropdown menu {0}", this.props.title) }
                    aria-hidden={!this.isOpened}>
                    {this.props.children}
                </div>
            </div>);
    }
}

export interface IconProps extends UiProps {
    icon?: string;
    onClick?: () => void;
}

export class Icon extends data.Component<IconProps, {}> {
    renderCore() {
        return <i className={`icon ${this.props.icon}`}
            onClick={this.props.onClick}
            aria-hidden={true} role="presentation">
                {this.props.children}
            </i>
    }
}

export interface ItemProps extends UiProps {
    active?: boolean;
    value?: string;
    onClick?: () => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
}

export class Item extends data.Component<ItemProps, {}> {
    renderCore() {
        const {
            text,
            title,
            ariaLabel
        } = this.props;

        return (
            <div className={genericClassName("ui item link", this.props, true) + ` ${this.props.active ? 'active' : ''}`}
                role={this.props.role}
                aria-label={ariaLabel || title || text}
                title={title || text}
                tabIndex={this.props.tabIndex || 0}
                key={this.props.value}
                data-value={this.props.value}
                onClick={this.props.onClick}
                onKeyDown={this.props.onKeyDown || fireClickOnEnter}>
                {genericContent(this.props) }
                {this.props.children}
            </div>);
    }
}

export class ButtonMenuItem extends UiElement<ItemProps> {
    renderCore() {
        return (
            <div className={genericClassName("ui item link", this.props, true) + ` ${this.props.active ? 'active' : ''}`}
                role={this.props.role}
                title={this.props.title || this.props.text}
                tabIndex={this.props.tabIndex || 0}
                key={this.props.value}
                data-value={this.props.value}
                onClick={this.props.onClick}
                onKeyDown={this.props.onKeyDown || fireClickOnEnter}>
                <div className={genericClassName("ui button", this.props) }>
                    {genericContent(this.props) }
                    {this.props.children}
                </div>
            </div>);
    }
}

export interface ButtonProps extends WithPopupProps {
    id?: string;
    title?: string;
    ariaLabel?: string;
    ariaExpanded?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    disabled?: boolean;
    onKeyDown?: (e: React.KeyboardEvent) => void;
}

export class Button extends UiElement<ButtonProps> {
    renderCore() {
        return (
            <button className={genericClassName("ui button", this.props) + " " + (this.props.disabled ? "disabled" : "") }
                id={this.props.id}
                role={this.props.role}
                title={this.props.title}
                tabIndex={this.props.tabIndex || 0}
                aria-label={this.props.ariaLabel}
                aria-expanded={this.props.ariaExpanded}
                onClick={this.props.onClick}
                onKeyDown={this.props.onKeyDown}>
                {genericContent(this.props) }
                {this.props.children}
            </button>
        );
    }
}

export interface LinkProps extends ButtonProps {
    href?: string;
    target?: string;
}

export class Link extends UiElement<LinkProps> {
    renderCore() {
        return (
            <a className={genericClassName("ui", this.props) + " " + (this.props.disabled ? "disabled" : "") }
                id={this.props.id}
                href={this.props.href}
                target={this.props.target}
                role={this.props.role}
                title={this.props.title}
                tabIndex={this.props.tabIndex || 0}
                aria-label={this.props.ariaLabel}
                aria-expanded={this.props.ariaExpanded}
                onClick={this.props.onClick}
                onKeyDown={this.props.onKeyDown}>
                {genericContent(this.props) }
                {this.props.children}
            </a>
        );
    }
}

export class Popup extends data.Component<UiProps, {}> {
    componentDidMount() {
        this.child(".popup-button").popup({
            position: "bottom right",
            on: "click",
            hoverable: true,
            delay: {
                show: 50,
                hide: 1000
            }
        });
    }

    componentDidUpdate() {
        this.child(".popup-button").popup('refresh');
    }

    renderCore() {
        return (
            <div role={this.props.role}>
                <div className={genericClassName("ui button popup-button", this.props) }>
                    {genericContent(this.props) }
                </div>
                <div className="ui popup transition hidden">
                    {this.props.children}
                </div>
            </div>
        );
    }
}

export class Field extends data.Component<{
    label?: string;
    children?: any;
    ariaLabel?: string;
    htmlFor?: string;
}, {}> {
    renderCore() {
        return (
            <div className="field">
                {this.props.label ? <label htmlFor={!this.props.ariaLabel ? this.props.htmlFor : undefined}>{this.props.label}</label> : null}
                {this.props.ariaLabel && this.props.htmlFor ? (<label htmlFor={this.props.htmlFor} className="accessible-hidden">{this.props.ariaLabel}</label>) : ""}
                {this.props.children}
            </div>
        );
    }
}

export class Input extends data.Component<{
    label?: string;
    inputLabel?: string;
    class?: string;
    value?: string;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    onChange?: (v: string) => void;
    lines?: number;
    readOnly?: boolean;
    copy?: boolean;
    selectOnClick?: boolean;
    id?: string;
    ariaLabel?: string;
}, { value: string }> {

    copy() {
        const p = this.props
        const el = ReactDOM.findDOMNode(this);

        if (!p.lines || p.lines == 1) {
            const inp = el.getElementsByTagName("input")[0] as HTMLInputElement;
            inp.focus();
            inp.setSelectionRange(0, 9999);
        } else {
            const inp = el.getElementsByTagName("textarea")[0] as HTMLTextAreaElement;
            inp.focus();
            inp.setSelectionRange(0, 9999);
        }

        try {
            const success = document.execCommand("copy");
            pxt.debug('copy: ' + success);
        } catch (e) {
        }
    }

    renderCore() {
        let p = this.props
        let copyBtn = p.copy && document.queryCommandSupported('copy')
            ? <Button class="ui right labeled primary icon button" text={lf("Copy") } icon="copy" onClick={() => this.copy() } />
            : null;

        let value = (this.state && this.state.value !== undefined) ? this.state.value : p.value;

        const onChange = (newValue: string) => {
            if (!p.readOnly && (!this.state || this.state.value !== newValue)) {
                this.setState({ value: newValue })
            }
            if (p.onChange) {
                p.onChange(newValue);
            }
        };

        return (
            <Field ariaLabel={p.ariaLabel} htmlFor={p.id} label={p.label}>
                <div className={"ui input" + (p.inputLabel ? " labelled" : "") + (p.copy ? " action fluid" : "") + (p.disabled ? " disabled" : "") }>
                    {p.inputLabel ? (<div className="ui label">{p.inputLabel}</div>) : ""}
                    {!p.lines || p.lines == 1 ? <input
                        id={p.id}
                        className={p.class || ""}
                        type={p.type || "text"}
                        placeholder={p.placeholder} value={value}
                        readOnly={!!p.readOnly}
                        onClick={(e) => p.selectOnClick ? (e.target as any).setSelectionRange(0, 9999) : undefined}
                        onChange={v => onChange((v.target as any).value) } />
                        : <textarea
                            id={p.id}
                            className={"ui input " + (p.class || "") + (p.inputLabel ? " labelled" : "") }
                            rows={p.lines}
                            placeholder={p.placeholder}
                            value={value}
                            readOnly={!!p.readOnly}
                            onClick={(e) => p.selectOnClick ? (e.target as any).setSelectionRange(0, 9999) : undefined}
                            onChange={v => onChange((v.target as any).value) }>
                        </textarea>}
                    {copyBtn}
                </div>
            </Field>
        );
    }
}

export class Checkbox extends data.Component<{
    label?: string;
    inputLabel?: string;
    class?: string;
    checked?: boolean;
    onChange: (v: string) => void;
}, {}> {

    renderCore() {
        const p = this.props;
        return <Field label={p.label}>
            <div className={"ui toggle checkbox"}>
                <input type="checkbox" checked={p.checked}
                    onChange={v => p.onChange((v.target as any).value) } />
                {p.inputLabel ? <label>{p.inputLabel}</label> : undefined}
            </div>
        </Field>;
    }
}

// Segment, Menu, Modal and Portal sui elements have been implemented using some of the workings of Semantic UI React (MIT)
// https://github.com/Semantic-Org/Semantic-UI-React

export interface SegmentProps {
    attached?: boolean | 'top' | 'bottom';
    basic?: boolean;
    children?: React.ReactNode;
    circular?: boolean;
    className?: string;
    clearing?: boolean;
    color?: string;
    compact?: boolean;
    disabled?: boolean;
    floated?: string;
    inverted?: boolean;
    loading?: boolean;
    padded?: boolean | 'very';
    piled?: boolean;
    raised?: boolean;
    secondary?: boolean;
    size?: string;
    stacked?: boolean;
    tertiary?: boolean;
    textAlign?: string;
    vertical?: boolean;
}

export interface SegmentState {
}

export class Segment extends data.Component<SegmentProps, SegmentState> {
    renderCore() {
        const {
            attached,
            basic,
            children,
            circular,
            className,
            clearing,
            color,
            compact,
            disabled,
            floated,
            inverted,
            loading,
            padded,
            piled,
            raised,
            secondary,
            size,
            stacked,
            tertiary,
            textAlign,
            vertical,
        } = this.props;

        const classes = cx([
            'ui',
            color,
            size,
            basic ? 'basic' : '',
            circular ? 'circular' : '',
            clearing ? 'clearing' : '',
            compact ? 'compact' : '',
            disabled ? 'disabled' : '',
            inverted ? 'inverted' : '',
            loading ? 'loading' : '',
            piled ? 'piled' : '',
            raised ? 'raised' : '',
            secondary ? 'secondary' : '',
            stacked ? 'stacked' : '',
            tertiary ? 'tertiary' : '',
            vertical ? 'vertical' : '',
            attached ? `${attached} attached` : '',
            padded ? `${padded} padded` : '',
            textAlign ? (textAlign == 'justified' ? 'justified' : `${textAlign} aligned`) : '',
            floated ? `${floated} floated` : '',
            'segment',
            className,
        ]);

        return (
            <div className={classes}>
                {children}
            </div>
        )
    }
}

export interface MenuProps {
    activeIndex?: number;
    attached?: boolean | 'bottom' | 'top';
    borderless?: boolean;
    children?: React.ReactNode;
    className?: string;
    color?: string;
    compact?: boolean;
    defaultActiveIndex?: number;
    fixed?: 'left' | 'right' | 'bottom' | 'top';
    floated?: boolean | 'right';
    fluid?: boolean;
    icon?: boolean | 'labeled';
    inverted?: boolean;
    pagination?: boolean;
    pointing?: boolean;
    secondary?: boolean;
    size?: 'mini' | 'tiny' | 'small' | 'large' | 'huge' | 'massive';
    stackable?: boolean;
    tabular?: boolean | 'right';
    text?: boolean;
    vertical?: boolean;
}

export interface MenuItemProps {
    active?: boolean;
    children?: React.ReactNode;
    className?: string;
    color?: string;
    content?: React.ReactNode;
    fitted?: boolean | 'horizontally' | 'vertically';
    header?: boolean;
    icon?: any | boolean;
    index?: number;
    link?: boolean;
    name?: string;
    onClick?: (event: React.MouseEvent, data: MenuItemProps) => void;
    position?: 'right';
    ariaControls?: string;
    id?: string;
}

export class MenuItem extends data.Component<MenuItemProps, {}> {
    constructor(props: MenuItemProps) {
        super(props);
    }

    handleClick = (e: React.MouseEvent) => {
        const { onClick } = this.props;
        if (onClick) onClick(e, this.props);
    }

    renderCore() {
        const {
            active,
            children,
            className,
            color,
            content,
            fitted,
            header,
            icon,
            link,
            name,
            onClick,
            position,
            ariaControls,
            id
        } = this.props;

        const classes = cx([
            color,
            position,
            active ? 'active' : '',
            icon === true || icon && !(name || content) ? 'icon' : '',
            header ? 'header' : '',
            link || onClick ? 'link' : '',
            fitted ? (fitted == true ? `${fitted}` : `fitted ${fitted}`) : '',
            'item',
            className
        ]);

        if (children) {
            return <div className={classes} onClick={this.handleClick}>{children}</div>
        }

        return (
            <div id={id} tabIndex={active ? 0 : -1} className={classes} onClick={this.handleClick} role="tab" aria-controls={ariaControls} aria-selected={active} aria-label={content || name}>
                {icon ? <Icon icon={icon} /> : undefined}
                {content || name}
            </div>
        )
    }
}

export interface MenuState {
    activeIndex?: number;
}

export class Menu extends data.Component<MenuProps, MenuState> {
    constructor(props: MenuProps) {
        super(props);
    }

    private handleKeyboardNavigation = (e: KeyboardEvent) => {
        let charCode = (typeof e.which == "number") ? e.which : e.keyCode
        let leftOrUpKey = charCode === 37 || charCode === 38
        let rightorBottomKey = charCode === 39 || charCode === 40

        if (!leftOrUpKey && !rightorBottomKey) {
            return
        }

        let menuItems = this.child(".link")
        let activeNodeIndex = -1
        let i = 0

        while (activeNodeIndex === -1 && i < menuItems.length) {
            if (menuItems.get(i).classList.contains("active")) {
                activeNodeIndex = i
            }

            i++
        }

        if (activeNodeIndex === -1) {
            return
        }

        let selectedTab: HTMLElement;
        if ((leftOrUpKey && !Util.isUserLanguageRtl()) || (rightorBottomKey && Util.isUserLanguageRtl())) {
            if (activeNodeIndex === 0) {
                selectedTab = menuItems.get(menuItems.length - 1) as HTMLElement
            } else {
                selectedTab = menuItems.get(activeNodeIndex - 1) as HTMLElement
            }
        } else if ((rightorBottomKey && !Util.isUserLanguageRtl()) || (leftOrUpKey && Util.isUserLanguageRtl())) {
            if (activeNodeIndex === menuItems.length - 1) {
                selectedTab = menuItems.get(0) as HTMLElement
            } else {
                selectedTab = menuItems.get(activeNodeIndex + 1) as HTMLElement
            }
        }

        if (selectedTab !== undefined) {
            selectedTab.click()
            selectedTab.focus()
        }
    }


    componentDidMount() {
        let menuItems = this.child(".link")
        menuItems.each((index: number, elem: HTMLElement) => {
            elem.onkeydown = this.handleKeyboardNavigation
        })
    }

    renderCore() {
        const {
            attached,
            borderless,
            children,
            className,
            color,
            compact,
            fixed,
            floated,
            fluid,
            icon,
            inverted,
            pagination,
            pointing,
            secondary,
            size,
            stackable,
            tabular,
            text,
            vertical
        } = this.props;

        const classes = cx([
            'ui',
            color,
            size,
            borderless ? 'borderless' : '',
            compact ? 'compact' : '',
            fluid ? 'fluid' : '',
            inverted ? 'inverted' : '',
            pagination ? 'pagination' : '',
            pointing ? 'pointing' : '',
            secondary ? 'secondary' : '',
            stackable ? 'stackable' : '',
            text ? 'text' : '',
            vertical ? 'vertical' : '',
            attached ? (attached == true ? 'attached' : `${attached} attached `) : '',
            floated ? (floated == true ? 'floated' : `${floated} floated`) : '',
            icon ? (icon == true ? 'icon' : `${icon} icon`) : '',
            tabular ? (tabular == true ? 'tabular' : `${tabular} tabular`) : '',
            fixed ? `tabular ${tabular}` : '',
            className,
            'menu'
        ]);

        return (
            <div className={classes} role="tablist">
                {children}
            </div>
        )
    }
}

export interface ModalAction {
    label: string;
    onClick: () => void;
    className?: string;
    loading?: boolean;
    icon?: string;
}

export interface ModalProps {
    basic?: boolean;
    children?: any;
    className?: string;
    closeIcon?: any;
    closeOnDimmerClick?: boolean;
    closeOnDocumentClick?: boolean;
    closeOnEscape?: boolean;
    dimmer?: boolean | 'blurring' | 'inverted';
    dimmerClassName?: string;
    description?: string;

    onClose?: Function;
    onOpen?: Function;
    onPositionChanged?: Function;

    open?: boolean;
    mountNode?: any;
    size?: string;
    longer?: boolean;
    allowResetFocus?: boolean;

    headerClass?: string;
    header?: string;
    helpUrl?: string;

    actions?: ModalAction[];
}

export interface ModalState {
    open?: boolean;
    marginTop?: number;
    scrolling?: boolean;
}

export class Modal extends data.Component<ModalProps, ModalState> {
    ref: any;
    id: string;
    animationId: number;
    constructor(props: ModalProps) {
        super(props)
        this.id = Util.guidGen();
        this.state = {
            open: this.props.open,
            scrolling: false
        }
    }

    componentWillUnmount() {
        this.handlePortalUnmount()
    }

    componentWillMount() {
        const { open } = this.props;
        this.setState({ open: open });
    }

    componentWillReceiveProps(nextProps: ModalProps) {
        const newState: ModalState = {};
        if (nextProps.open != undefined) {
            newState.open = nextProps.open;
            newState.scrolling = false;
        }

        if (Object.keys(newState).length > 0) this.setState(newState)
    }

    getMountNode = () => this.props.mountNode || document.body;

    handleClose = (e: Event) => {
        if (this.state.open != false)
            this.setState({ open: false })

        const { onClose } = this.props;
        if (onClose) onClose(e, this.props);
    }

    handleOpen = (e: Event) => {
        const { onOpen } = this.props;
        if (onOpen) onOpen(e, this.props);

        if (this.state.open != true)
            this.setState({ open: true, scrolling: false })
    }

    setPosition = () => {
        if (this.ref) {
            const { dimmer } = this.props;
            const mountNode = this.getMountNode();
            let height: number;

            // Check to make sure the ref is actually in the DOM or else IE11 throws an exception
            if (this.ref.parentElement) {
                height = this.ref.getBoundingClientRect().height;
            }
            else {
                height = 0;
            }

            if (dimmer) {
                mountNode.classList.add('dimmable')
                mountNode.classList.add('dimmed')
            }

            const marginTop = -Math.round(height / 2);
            const scrolling = this.props.size == 'home' || height >= window.innerHeight;

            const newState: ModalState = {};

            if (this.state.marginTop !== marginTop) {
                newState.marginTop = marginTop;
            }

            if (this.state.scrolling !== scrolling) {
                newState.scrolling = scrolling;

                if (scrolling) {
                    mountNode.classList.add('scrolling');
                } else {
                    mountNode.classList.remove('scrolling');
                }
            }

            if (Object.keys(newState).length > 0) {
                this.setState(newState);
                if (this.props.onPositionChanged) this.props.onPositionChanged(this.props);
            }
        }

        this.animationId = requestAnimationFrame(this.setPosition);
    }

    handlePortalMount = () => {
        const { dimmer } = this.props;
        const mountNode = this.getMountNode();

        if (dimmer) {
            mountNode.classList.add('dimmable');
            mountNode.classList.add('dimmed');

            if (dimmer === 'blurring' && !pxt.options.light) {
                mountNode.classList.add('blurring');
            }
        }

        this.setPosition();
    }

    handleRef = (c: any) => (this.ref = c);

    handlePortalUnmount = () => {
        const mountNode = this.getMountNode();
        mountNode.classList.remove('blurring');
        mountNode.classList.remove('dimmable');
        mountNode.classList.remove('dimmed');
        mountNode.classList.remove('scrolling');

        if (this.animationId) cancelAnimationFrame(this.animationId);
    }

    renderCore() {
        const { open } = this.state
        const {
            basic,
            children,
            className,
            closeIcon,
            closeOnDimmerClick,
            closeOnDocumentClick,
            closeOnEscape,
            dimmer,
            dimmerClassName,
            size,
            longer,
            allowResetFocus
        } = this.props

        const { marginTop, scrolling } = this.state
        const classes = cx([
            'ui',
            size,
            longer ? 'longer' : '',
            basic ? 'basic' : '',
            scrolling ? 'scrolling' : '',
            'modal transition visible active',
            className,
        ]);

        const closeIconName = closeIcon === true ? 'close' : closeIcon;

        const modalJSX = (
            <div className={classes} style={{ marginTop }} ref={this.handleRef} role="dialog" aria-labelledby={this.props.header ? this.id + 'title' : undefined} aria-describedby={this.props.description ? this.id + 'description' : this.id + 'desc'} >
                {this.props.header ? <div id={this.id + 'title'} className={"header " + (this.props.headerClass || "") }>
                    {this.props.header}
                    {this.props.helpUrl ?
                        <a className={`ui huge icon clear focused`} href={this.props.helpUrl} target="_docs" role="button" aria-label={lf("Help on {0} dialog", this.props.header) }>
                            <Icon icon="help" />
                        </a>
                        : undefined}
                </div> : undefined}
                {this.props.description ? <label id={this.id + 'description'} className="accessible-hidden">{this.props.description}</label> : undefined}
                <div id={this.id + 'desc'} className={`${longer ? 'scrolling' : ''} content`}>
                    {children}
                </div>
                {this.props.actions && this.props.actions.length > 0 ?
                    <div className="actions">
                        {this.props.actions.map(action =>
                            <Button
                                key={`action_${action.label}`}
                                icon={action.icon}
                                text={action.label}
                                class={`approve ${action.icon ? 'icon right labeled' : ''} ${action.className || ''} ${action.loading ? "loading disabled" : ""} focused`}
                                onClick={() => {
                                    action.onClick();
                                } }
                                onKeyDown={fireClickOnEnter} />
                        ) }
                    </div> : undefined}
                {closeIcon ? <Button
                    icon={closeIconName}
                    class={`huge clear right floated closeIcon focused`}
                    onClick={() => this.handleClose(null) }
                    tabIndex={0}
                    ariaLabel={lf("Close dialog") } /> : undefined}
            </div>
        )

        const dimmerClasses = !dimmer
            ? null
            : cx([
                core.highContrast ? 'hc' : '',
                'ui',
                size,
                dimmer === 'inverted' ? 'inverted' : '',
                pxt.options.light ? '' : "transition",
                'page modals dimmer visible active',
                dimmerClassName
            ]);

        const blurring = dimmer === 'blurring';

        return (
            <Portal
                closeOnRootNodeClick={closeOnDimmerClick}
                closeOnDocumentClick={closeOnDocumentClick}
                closeOnEscape={closeOnEscape}
                className={dimmerClasses}
                mountNode={this.getMountNode() }
                onMount={this.handlePortalMount}
                onUnmount={this.handlePortalUnmount}
                onClose={this.handleClose}
                onOpen={this.handleOpen}
                open={open}
                allowResetFocus={allowResetFocus}>
                {modalJSX}
            </Portal>
        )
    }
}

interface PortalProps {
    children?: any;
    className?: string;
    open?: boolean;
    onOpen?: Function;
    onClose?: Function;
    onMount?: Function;
    onUnmount?: Function;
    mountNode?: HTMLElement;
    closeOnRootNodeClick?: boolean;
    closeOnDocumentClick?: boolean;
    closeOnEscape?: boolean;
    allowResetFocus?: boolean;
}

interface PortalState {
    open?: boolean;
}

export class Portal extends data.Component<PortalProps, PortalState> {
    rootNode: HTMLElement;
    portalNode: Element;
    focusedNodeBeforeOpening: HTMLElement;
    constructor(props: PortalProps) {
        super(props);
        this.focusedNodeBeforeOpening = null;
    }

    componentDidMount() {
        if (this.state.open) {
            this.renderPortal();
        }
    }

    componentDidUpdate(prevProps: PortalProps, prevState: PortalState) {
        if (this.state.open) {
            this.renderPortal()
        }

        if (prevState.open && !this.state.open) {
            this.unmountPortal();
        }
    }

    componentWillUnmount() {
        this.unmountPortal();
    }

    componentWillMount() {
        const { open } = this.props;
        this.setState({ open: open });
    }

    componentWillReceiveProps(nextProps: ModalProps) {
        const newState: ModalState = {};
        if (nextProps.open != undefined) {
            newState.open = nextProps.open;
        }

        if (Object.keys(newState).length > 0) this.setState(newState)
    }

    handleDocumentClick = (e: MouseEvent) => {
        const { closeOnDocumentClick, closeOnRootNodeClick } = this.props;

        if (!this.rootNode || !this.portalNode || this.portalNode.contains(e.target as Node)) return;
        const didClickInRootNode = this.rootNode.contains(e.target as Node);

        if (closeOnDocumentClick && !didClickInRootNode || closeOnRootNodeClick && didClickInRootNode) {
            this.close(e);
        }
    }

    handleEscape = (e: KeyboardEvent) => {
        let charCode = (typeof e.which == "number") ? e.which : e.keyCode
        if (charCode !== 27) {
            return;
        }
        const { closeOnEscape } = this.props;
        if (closeOnEscape) {
            e.preventDefault();
            this.close(e);
        }
    }

    close = (e: Event) => {
        if (this.state.open != false)
            this.setState({ open: false })

        const { onClose } = this.props;
        if (onClose) onClose(e);
    }

    open = (e: Event) => {
        const { onOpen } = this.props;
        if (onOpen) onOpen(e);

        if (this.state.open != true)
            this.setState({ open: true })
    }

    mountPortal = () => {
        if (this.rootNode) return;

        const { mountNode = document.body } = this.props;

        this.rootNode = document.createElement('div');
        mountNode.appendChild(this.rootNode);

        document.addEventListener('click', this.handleDocumentClick)
        document.addEventListener('keydown', this.handleEscape, true)

        const { onMount } = this.props
        if (onMount) onMount()
    }

    unmountPortal = () => {
        if (!this.rootNode) return;

        ReactDOM.unmountComponentAtNode(this.rootNode);
        this.rootNode.parentNode.removeChild(this.rootNode);

        this.rootNode = null;
        this.portalNode = null;

        document.removeEventListener('click', this.handleDocumentClick);
        document.removeEventListener('keydown', this.handleEscape, true);

        const { onUnmount } = this.props;
        if (onUnmount) onUnmount();

        if (this.focusedNodeBeforeOpening !== null) {
            this.focusedNodeBeforeOpening.focus();
            this.focusedNodeBeforeOpening = null;
        }
    }

    renderPortal() {
        const { children, className, open, allowResetFocus } = this.props;

        this.mountPortal();

        this.rootNode.className = className || '';

        ReactDOM.unstable_renderSubtreeIntoContainer(
            this,
            React.Children.only(children),
            this.rootNode
        )

        if (this.focusedNodeBeforeOpening === null) {
            this.focusedNodeBeforeOpening = document.activeElement as HTMLElement;
        }

        this.portalNode = this.rootNode.firstElementChild;
        core.initializeFocusTabIndex(this.portalNode, allowResetFocus);
    }

    renderCore() {
        return <div />;
    }

}