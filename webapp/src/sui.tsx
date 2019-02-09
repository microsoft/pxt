import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactModal from 'react-modal';
import * as ReactTooltip from 'react-tooltip';

import * as data from "./data";
import * as core from "./core";

export const appElement = document.getElementById('content');

export interface UiProps {
    icon?: string;
    iconClass?: string;
    text?: string;
    textClass?: string;
    children?: any;
    className?: string;
    role?: string;
    title?: string;
    ariaLabel?: string;
    tabIndex?: number;
    rightIcon?: boolean;
}

export type SIZES = 'mini' | 'tiny' | 'small' | 'medium' | 'large' | 'big' | 'huge' | 'massive';

export interface SidebarProps extends UiProps {
    visible?: boolean;
}

export function cx(classes: string[]): string {
    return classes.filter((c) => !!c && c.trim() != '').join(' ');
}

function genericClassName(cls: string, props: UiProps, ignoreIcon: boolean = false): string {
    return `${cls} ${ignoreIcon ? '' : props.icon && props.text ? 'icon icon-and-text' : props.icon ? 'icon' : ""} ${props.className || ""}`;
}

function genericContent(props: UiProps) {
    let retVal = [
        props.icon ? (<Icon key='iconkey' icon={props.icon + (props.text ? " icon-and-text " : "") + (props.iconClass ? " " + props.iconClass : '')} />) : null,
        props.text ? (<span key='textkey' className={'ui text' + (props.textClass ? ' ' + props.textClass : '')}>{props.text}</span>) : null,
    ]
    if (props.icon && props.rightIcon) retVal = retVal.reverse();
    return retVal;
}

function removeClass(el: HTMLElement, cls: string) {
    if (el.classList) el.classList.remove(cls);
    else if (el.className.indexOf(cls) >= 0) el.className.replace(new RegExp(`(?:^|\\s)${cls}(?:\\s|$)`), ' ');
}

export function fireClickOnEnter(e: React.KeyboardEvent<HTMLElement>): void {
    const charCode = core.keyCodeFromEvent(e);
    if (charCode === core.ENTER_KEY || charCode === core.SPACE_KEY) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).click();
    }
}

export class UIElement<T, S> extends data.Component<T, S> {
}

export class StatelessUIElement<T> extends data.PureComponent<T, {}> {
}

///////////////////////////////////////////////////////////
////////////           Dropdowns              /////////////
///////////////////////////////////////////////////////////

export interface DropdownProps extends UiProps {
    disabled?: boolean;
    tabIndex?: number;
    value?: string;
    title?: string;
    onChange?: (v: string) => void;

}

export interface DropdownState {
    open?: boolean;
    focus?: boolean;
}

export class DropdownMenu extends UIElement<DropdownProps, DropdownState> {

    show() {
        this.setState({ open: true, focus: true });
    }

    hide() {
        this.setState({ open: false });
    }

    toggle() {
        if (this.state.open) {
            this.hide();
        } else {
            this.show();
        }
    }

    private focus(el: HTMLElement) {
        this.setActive(el);
        el.focus();
    }

    private blur(el: HTMLElement) {
        if (this.isActive(el)) {
            el.classList.remove("active");
        }
    }

    private setActive(el: HTMLElement) {
        if (!this.isActive(el)) {
            el.classList.add("active");
        }
    }

    private isActive(el: HTMLElement) {
        return el && el.classList.contains("active");
    }

    getChildren() {
        const menu = this.refs["menu"] as HTMLElement;
        const children = [];
        for (let i = 0; i < menu.childNodes.length; i++) {
            const child = menu.childNodes[i] as HTMLElement;
            // Remove separators
            if (child.classList.contains("divider")) continue;
            // Check if item is intended for mobile only views
            if (child.classList.contains("mobile") && !pxt.BrowserUtils.isMobile()) continue;
            children.push(child);
        }
        return children;
    }

    isChildFocused() {
        const children = this.getChildren();
        for (let i = 0; i < children.length; i++) {
            if (document.activeElement === children[i]) return true;
        }
        return false;
    }

    private navigateToNextElement = (e: KeyboardEvent, prev: HTMLElement, next: HTMLElement) => {
        const dropdown = this.refs["dropdown"] as HTMLElement;
        const charCode = core.keyCodeFromEvent(e);
        const current = e.currentTarget as HTMLElement;
        if (charCode === 40 /* Down arrow */) {
            e.preventDefault();
            e.stopPropagation();
            if (next) {
                this.focus(next);
            }
        } else if (charCode === 38 /* Up arrow */) {
            e.preventDefault();
            e.stopPropagation();
            if (prev) {
                this.focus(prev);
            } else {
                // Prev is undefined, go to dropdown
                dropdown.focus();
                this.setState({ open: false });
            }
        } else if (charCode === core.SPACE_KEY || charCode === core.ENTER_KEY) {
            // Trigger click
            e.preventDefault();
            e.stopPropagation();
            current.click();
        }
    }

    componentDidMount() {
        const children = this.getChildren();
        for (let i = 0; i < children.length; i++) {
            const prev = i > 0 ? children[i - 1] as HTMLElement : undefined;
            const child = children[i] as HTMLElement;
            const next = i < children.length ? children[i + 1] as HTMLElement : undefined;

            child.addEventListener('keydown', (e) => {
                this.navigateToNextElement(e, prev, next);
            })

            child.addEventListener('focus', (e: FocusEvent) => {
                this.setActive(child);
            })
            child.addEventListener('blur', (e: FocusEvent) => {
                this.blur(child);
            })

            if (i == children.length - 1) {
                // set tab on last child to clear focus
                child.addEventListener('keydown', (e) => {
                    const charCode = core.keyCodeFromEvent(e);
                    if (!e.shiftKey && charCode === core.TAB_KEY) {
                        this.hide();
                    }
                })
            }
        }
    }

    componentDidUpdate(prevProps: DropdownProps, prevState: DropdownState) {
        // Remove active from all menu items on any update
        const children = this.getChildren();
        for (let i = 0; i < children.length; i++) {
            const child = children[i] as HTMLElement;
            // On allow tabbing to valid child nodes (ie: no separators or mobile only items)
            child.tabIndex = this.state.open ? 0 : -1;
        }

        // Check if dropdown width exceeds the bounds, add the left class to the menu
        if (prevState.open != this.state.open && this.state.open) {
            const dropdown = this.refs["dropdown"] as HTMLElement;
            const menu = this.refs["menu"] as HTMLElement;
            if (dropdown.offsetLeft + menu.offsetWidth > window.innerWidth) {
                // Add left class to the menu
                pxsim.U.addClass(menu, 'left');
            }
        }

        if (!prevState.focus && this.state.focus) {
            // Dropdown focused
        } else if (prevState.focus && !this.state.focus) {
            // Dropdown blurred
            if (!this.isMouseDown) {
                this.hide()
            }
        }

        if (!prevState.open && this.state.open) {
            // Dropdown opened
            document.addEventListener('keydown', this.closeOnEscape);
        } else if (prevState.open && !this.state.open) {
            // Dropdown closed
            document.removeEventListener('keydown', this.closeOnEscape);
            this.handleClose()
        }
        if (this.focusFirst && children.length > 0) {
            // Focus the first child
            this.focus(children[0]);
            this.focusFirst = false;
        }
    }

    private closeOnEscape = (e: KeyboardEvent) => {
        const charCode = core.keyCodeFromEvent(e);
        if (charCode === core.ESC_KEY) {
            e.preventDefault();
            const dropdown = this.refs["dropdown"] as HTMLElement;
            dropdown.focus();
            // Reset the focus handlers
            this.isMouseDown = true;
            this.hide();
        }
    }

    private handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        this.toggle();
        e.stopPropagation()
    }

    private handleClose = () => {
        this.isMouseDown = false
        const hasFocus = document.activeElement === this.refs['dropdown'];
        this.setState({ focus: hasFocus })
    }

    private isMouseDown: boolean;
    private handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        this.isMouseDown = true
        document.addEventListener(pxsim.pointerEvents.up, this.handleDocumentMouseUp)
    }

    private handleDocumentMouseUp = (e: MouseEvent) => {
        this.isMouseDown = false
        document.removeEventListener(pxsim.pointerEvents.up, this.handleDocumentMouseUp)
    }

    private handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
        const { focus } = this.state;
        if (focus) return;

        this.setState({ focus: true });
    }

    private handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
        if (this.isMouseDown) return;
        // Use timeout to delay examination of activeElement until after blur/focus 
        // events have been processed.
        setTimeout(() => {
            let open = this.isChildFocused();
            this.setState({ focus: open });
        }, 1);
    }

    private focusFirst: boolean;
    private handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const charCode = core.keyCodeFromEvent(e);
        if (charCode === 40 /* Down arrow key */) {
            e.preventDefault();
            this.focusFirst = true;
            this.show();
        } else if (charCode === core.SPACE_KEY || charCode === core.ENTER_KEY) {
            e.preventDefault();
            this.toggle();
        }
    }

    renderCore() {
        const { disabled, title, role, icon, className, children } = this.props;
        const { open } = this.state;

        const aria = {
            'role': role || 'combobox',
            'aria-disabled': disabled,
            'aria-haspopup': !!disabled,
            'aria-expanded': open
        }
        const menuAria = {
            'role': 'menu',
            'aria-label': lf("Dropdown menu {0}", title),
            'aria-hidden': !!open
        }
        const classes = cx([
            'ui',
            open ? 'active visible' : '',
            'dropdown',
            icon ? 'icon' : '',
            className || '',
        ]);
        const menuClasses = cx([
            'menu',
            open ? 'visible transition' : ''
        ])
        return (
            <div role="listbox" ref="dropdown" title={title} {...aria}
                className={classes}
                onMouseDown={this.handleMouseDown}
                onClick={this.handleClick}
                onKeyDown={this.handleKeyDown}
                onFocus={this.handleFocus}
                onBlur={this.handleBlur}
                tabIndex={0}
            >
                {genericContent(this.props)}
                <div ref="menu" {...menuAria} className={menuClasses}
                    role="menu">
                    {children}
                </div>
            </div>);
    }
}

///////////////////////////////////////////////////////////
////////////             Items                /////////////
///////////////////////////////////////////////////////////

export interface ItemProps extends UiProps {
    active?: boolean;
    value?: string;
    onClick?: () => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
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
                {genericContent(this.props)}
                {this.props.children}
            </div>);
    }
}

export class ButtonMenuItem extends UIElement<ItemProps, {}> {
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
                <div className={genericClassName("ui button", this.props)}>
                    {genericContent(this.props)}
                    {this.props.children}
                </div>
            </div>);
    }
}

///////////////////////////////////////////////////////////
////////////            Buttons               /////////////
///////////////////////////////////////////////////////////

export interface ButtonProps extends UiProps, TooltipUIProps {
    id?: string;
    title?: string;
    ariaLabel?: string;
    ariaExpanded?: boolean;
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
    disabled?: boolean;
    loading?: boolean;
    onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
    labelPosition?: "left" | "right";
    color?: string;
    size?: SIZES;
}

export class Button extends StatelessUIElement<ButtonProps> {
    renderCore() {
        const { labelPosition, color, size, disabled, loading } = this.props;
        const classes = cx([
            color,
            size,
            (disabled || loading) ? 'disabled' : '',
            loading ? 'loading' : '',
            genericClassName("ui button", this.props)
        ])
        const button = <button className={classes}
            id={this.props.id}
            role={this.props.role}
            title={this.props.title}
            tabIndex={this.props.tabIndex || 0}
            aria-label={this.props.ariaLabel}
            aria-expanded={this.props.ariaExpanded}
            onClick={this.props.onClick}
            onKeyDown={this.props.onKeyDown}>
            {genericContent(this.props)}
            {this.props.children}
        </button>;
        // Tooltips don't work great on IOS, disabling them
        return this.props.tooltipId && !pxt.BrowserUtils.isIOS() ? <Tooltip id={this.props.tooltipId} content={this.props.tooltip || this.props.title}
            place={this.props.tooltipPlace} delayShow={this.props.tooltipDelayShow}>{button}</Tooltip> : button;
    }
}

///////////////////////////////////////////////////////////
////////////             Links                /////////////
///////////////////////////////////////////////////////////

export interface LinkProps extends ButtonProps {
    href?: string;
    download?: string;
    target?: string;
}

export class Link extends StatelessUIElement<LinkProps> {
    renderCore() {
        return (
            <a className={genericClassName("ui", this.props) + " " + (this.props.disabled ? "disabled" : "")}
                id={this.props.id}
                href={this.props.href}
                target={this.props.target}
                download={this.props.download}
                role={this.props.role}
                title={this.props.title}
                tabIndex={this.props.tabIndex || 0}
                aria-label={this.props.ariaLabel}
                aria-expanded={this.props.ariaExpanded}
                onClick={this.props.onClick}
                onKeyDown={this.props.onKeyDown || fireClickOnEnter}>
                {genericContent(this.props)}
                {this.props.children}
            </a>
        );
    }
}

///////////////////////////////////////////////////////////
////////////           FormField              /////////////
///////////////////////////////////////////////////////////

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

///////////////////////////////////////////////////////////
////////////             Input                /////////////
///////////////////////////////////////////////////////////

export interface InputProps {
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
    autoFocus?: boolean;
    autoComplete?: boolean
}

export class Input extends data.Component<InputProps, { value: string }> {
    constructor(props: InputProps) {
        super(props);
        this.state = {
            value: props.value
        }

        this.copy = this.copy.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleChange = this.handleChange.bind(this);
    }

    componentWillReceiveProps(newProps: InputProps) {
        this.setState({ value: newProps.value });
    }

    clearValue() {
        this.setState({ value: undefined });
    }

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

    handleClick(e: React.MouseEvent<any>) {
        if (this.props.selectOnClick) {
            (e.target as any).setSelectionRange(0, 9999);
        }
    }

    handleChange(e: React.ChangeEvent<any>) {
        const newValue = (e.target as any).value;
        if (!this.props.readOnly && (!this.state || this.state.value !== newValue)) {
            this.setState({ value: newValue })
        }
        if (this.props.onChange) {
            this.props.onChange(newValue);
        }
    }

    renderCore() {
        let p = this.props
        let copyBtn = p.copy && document.queryCommandSupported('copy')
            ? <Button className="ui right labeled primary icon button" text={lf("Copy")} icon="copy" onClick={this.copy} />
            : null;
        const { value } = this.state;

        return (
            <Field ariaLabel={p.ariaLabel} htmlFor={p.id} label={p.label}>
                <div className={"ui input" + (p.inputLabel ? " labelled" : "") + (p.copy ? " action fluid" : "") + (p.disabled ? " disabled" : "")}>
                    {p.inputLabel ? (<div className="ui label">{p.inputLabel}</div>) : ""}
                    {!p.lines || p.lines == 1 ? <input
                        autoFocus={p.autoFocus}
                        id={p.id}
                        className={p.class || ""}
                        type={p.type || "text"}
                        placeholder={p.placeholder} value={value || ''}
                        readOnly={!!p.readOnly}
                        onClick={this.handleClick}
                        onChange={this.handleChange}
                        autoComplete={p.autoComplete ? "" : "off"}
                        autoCorrect={p.autoComplete ? "" : "off"}
                        autoCapitalize={p.autoComplete ? "" : "off"}
                        spellCheck={p.autoComplete} />
                        : <textarea
                            id={p.id}
                            className={"ui input " + (p.class || "") + (p.inputLabel ? " labelled" : "")}
                            rows={p.lines}
                            placeholder={p.placeholder}
                            value={value || ''}
                            readOnly={!!p.readOnly}
                            onClick={this.handleClick}
                            onChange={this.handleChange}>
                        </textarea>}
                    {copyBtn}
                </div>
            </Field>
        );
    }
}

///////////////////////////////////////////////////////////
////////////           Checkbox               /////////////
///////////////////////////////////////////////////////////

export interface CheckBoxProps {
    label?: string;
    inputLabel?: string;
    class?: string;
    checked?: boolean;
    onChange: (v: string) => void;
}

export class Checkbox extends data.Component<CheckBoxProps, {}> {
    constructor(props: CheckBoxProps) {
        super(props);
        this.state = {
        }

        this.handleChange = this.handleChange.bind(this);
    }

    handleChange(v: React.ChangeEvent<any>) {
        this.props.onChange(v.target.value)
    }

    renderCore() {
        const p = this.props;
        return <Field label={p.label}>
            <div className={"ui toggle checkbox"}>
                <input type="checkbox" checked={p.checked} aria-checked={p.checked}
                    onChange={this.handleChange} />
                {p.inputLabel ? <label>{p.inputLabel}</label> : undefined}
            </div>
        </Field>;
    }
}

///////////////////////////////////////////////////////////
////////////             Icons                /////////////
///////////////////////////////////////////////////////////

export interface IconProps extends UiProps {
    icon?: string;
    onClick?: () => void;
    onKeyDown?: () => void;
}

export const Icon: React.StatelessComponent<IconProps> = (props: IconProps) => {
    const { icon, className, onClick, onKeyDown, children, ...rest } = props;
    return <i className={`icon ${icon} ${className ? className : ''}`}
        onClick={onClick}
        onKeyDown={onKeyDown || fireClickOnEnter}
        aria-hidden={true} role="presentation" {...rest}>
        {children}
    </i>
}

///////////////////////////////////////////////////////////
////////////             Menu                 /////////////
///////////////////////////////////////////////////////////

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
    onClick?: (event: React.MouseEvent<HTMLElement>, data: MenuItemProps) => void;
    position?: 'right';
    ariaControls?: string;
    id?: string;
}

export class MenuItem extends data.Component<MenuItemProps, {}> {
    constructor(props: MenuItemProps) {
        super(props);
    }

    handleClick = (e: React.MouseEvent<HTMLElement>) => {
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
            return <div role="menuitem" className={classes} onClick={this.handleClick}>{children}</div>
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
        const charCode = core.keyCodeFromEvent(e);
        let leftOrUpKey = charCode === 37 || charCode === 38
        let rightorBottomKey = charCode === 39 || charCode === 40

        if (!leftOrUpKey && !rightorBottomKey) {
            return
        }

        let menuItems = this.child(".item");
        let activeNodeIndex = -1
        let i = 0

        while (activeNodeIndex === -1 && i < menuItems.length) {
            if ((menuItems[i] as HTMLElement).classList.contains("active")) {
                activeNodeIndex = i
            }

            i++
        }

        if (activeNodeIndex === -1) {
            return
        }

        let selectedTab: HTMLElement;
        if ((leftOrUpKey && !pxt.Util.isUserLanguageRtl()) || (rightorBottomKey && pxt.Util.isUserLanguageRtl())) {
            if (activeNodeIndex === 0) {
                selectedTab = menuItems[menuItems.length - 1] as HTMLElement
            } else {
                selectedTab = menuItems[activeNodeIndex - 1] as HTMLElement
            }
        } else if ((rightorBottomKey && !pxt.Util.isUserLanguageRtl()) || (leftOrUpKey && pxt.Util.isUserLanguageRtl())) {
            if (activeNodeIndex === menuItems.length - 1) {
                selectedTab = menuItems[0] as HTMLElement
            } else {
                selectedTab = menuItems[activeNodeIndex + 1] as HTMLElement
            }
        }

        if (selectedTab !== undefined) {
            selectedTab.click()
            selectedTab.focus()
        }
    }

    componentDidMount() {
        let menuItems = this.child(".item");
        menuItems.forEach((elem: HTMLElement, index: number) => {
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

///////////////////////////////////////////////////////////
////////////             Modal                /////////////
///////////////////////////////////////////////////////////

export interface ModalButton {
    label: string;
    icon?: string; // defaults to "checkmark"
    className?: string; // defaults "positive"
    onclick?: () => (Promise<void> | void);
    resolveVal?: number;
    url?: string;
    fileName?: string;
    loading?: boolean;
    disabled?: boolean;
    approveButton?: boolean;
}

export interface ModalProps extends ReactModal.Props {
    closeOnDimmerClick?: boolean;
    closeOnDocumentClick?: boolean;
    closeOnEscape?: boolean;

    onClose?: () => void;
    onKeyDown?: (ev: React.KeyboardEvent<any>) => void;
    defaultOpen?: boolean;
    closeIcon?: boolean | string;

    size?: '' | 'fullscreen' | 'large' | 'mini' | 'small' | 'tiny';
    className?: string;
    basic?: boolean;
    longer?: boolean;

    header?: string;
    headerClass?: string;
    description?: string;

    dimmer?: boolean | string;
    dimmerClassName?: string;

    helpUrl?: string;
    headerActions?: JSX.Element[];
    buttons?: ModalButton[];
    onPositionChanged?: Function;
    allowResetFocus?: boolean;
    modalDidOpen?: (ref: HTMLElement) => void;
}

interface ModalState {
    marginTop?: number;
    scrolling?: boolean;
    mountClasses?: string;
}

export class Modal extends React.Component<ModalProps, ModalState> {

    private id: string;
    private animationRequestId: any;

    constructor(props: ModalProps) {
        super(props);
        this.id = ts.pxtc.Util.guidGen();
        this.state = {
        }

        this.onRequestClose = this.onRequestClose.bind(this);
        this.afterOpen = this.afterOpen.bind(this);
    }

    private afterOpen() {
        const { modalDidOpen } = this.props;
        this.setState({ scrolling: false });
        this.setPositionAndClassNames();
        if (modalDidOpen) modalDidOpen(this.getRef());
    }

    private onClose() {
        cancelAnimationFrame(this.animationRequestId);
    }

    private getRef() {
        const modal = this.refs["modal"];
        const ref = modal && (modal as any).node
            && (modal as any).node.firstChild && (modal as any).node.firstChild.firstChild;
        return ref;
    }

    componentWillUnmount() {
        cancelAnimationFrame(this.animationRequestId);
    }

    setPositionAndClassNames = () => {
        const { dimmer } = this.props
        let classes;

        if (dimmer) {
            classes = 'dimmable dimmed';

            if (dimmer === 'blurring') {
                classes += ' blurring';
            }
        }

        const newState: ModalState = {}
        const ref = this.getRef();

        if (ref) {
            const { height } = ref.getBoundingClientRect();

            const marginTop = -Math.round(height / 2)
            const scrolling = height >= window.innerHeight;

            if (this.state.marginTop !== marginTop) {
                newState.marginTop = marginTop;
            }

            if (this.state.scrolling !== scrolling) {
                newState.scrolling = scrolling;
            }

            if (scrolling) classes += ' scrolling'
        }

        if (this.state.mountClasses !== classes) newState.mountClasses = classes;

        if (Object.keys(newState).length > 0) {
            this.setState(newState)
            if (this.props.onPositionChanged) this.props.onPositionChanged(this.props);
        }

        this.animationRequestId = requestAnimationFrame(this.setPositionAndClassNames);
    }

    private onRequestClose() {
        const { onClose } = this.props;
        this.onClose();
        onClose();
    }

    render() {
        const { isOpen, size, longer, basic, className,
            onClose, closeIcon, children, onKeyDown,
            header, headerClass, headerActions, helpUrl, description,
            closeOnDimmerClick, closeOnDocumentClick, closeOnEscape,
            shouldCloseOnEsc, shouldCloseOnOverlayClick, shouldFocusAfterRender, ...rest } = this.props;
        const { marginTop, scrolling, mountClasses } = this.state;
        const isFullscreen = size == 'fullscreen';
        const showBack = isFullscreen && !!closeIcon;

        const classes = cx([
            'ui',
            size,
            longer ? 'longer' : '',
            basic ? 'basic' : '',
            scrolling ? 'scrolling' : '',
            closeIcon ? 'closable' : '',
            'modal transition visible active',
            className
        ]);
        const portalClassName = cx([
            core.highContrast ? 'hc' : '',
            mountClasses
        ])
        const closeIconName = closeIcon === true ? 'close' : closeIcon as string;
        const aria = {
            labelledby: header ? this.id + 'title' : undefined,
            describedby: description ? this.id + 'description' : this.id + 'desc'
        }
        const customStyles = {
            content: {
                marginTop: marginTop
            }
        }

        return <ReactModal isOpen={isOpen} ref="modal" appElement={appElement}
            onRequestClose={this.onRequestClose} onAfterOpen={this.afterOpen}
            shouldReturnFocusAfterClose={true} shouldFocusAfterRender={shouldFocusAfterRender}
            shouldCloseOnEsc={shouldCloseOnEsc || closeOnEscape}
            shouldCloseOnOverlayClick={shouldCloseOnOverlayClick || (closeOnDocumentClick || closeOnDimmerClick)}
            portalClassName={portalClassName}
            overlayClassName={`ui page modals dimmer transition ${isOpen ? 'visible active' : ''}`}
            className={classes}
            style={customStyles}
            aria={aria} {...rest}>
            {header || showBack || helpUrl ? <div id={this.id + 'title'} className={"header " + (headerClass || "")}>
                <span className="header-title" style={{ margin: `0 ${helpUrl ? '-20rem' : '0'} 0 ${showBack ? '-20rem' : '0'}` }}>{header}</span>
                {showBack ? <div className="header-close">
                    <Button className="back-button large" title={lf("Go back")} onClick={onClose} tabIndex={0} onKeyDown={fireClickOnEnter}>
                        <Icon icon="arrow left" />
                        <span className="ui text landscape only">{lf("Go back")}</span>
                    </Button>
                </div> : undefined}
                {helpUrl ?
                    <div className="header-help">
                        <a className={`ui icon help-button`} href={helpUrl} target="_docs" role="button" aria-label={lf("Help on {0} dialog", header)}>
                            <Icon icon="help" />
                        </a>
                    </div>
                    : undefined}
            </div> : undefined}
            {isFullscreen && headerActions ? <div className="header-actions">{headerActions}</div> : undefined}
            {!isFullscreen && description ? <label id={this.id + 'description'} className="accessible-hidden">{description}</label> : undefined}
            <div id={this.id + 'desc'} className={`${longer ? 'scrolling' : ''} ${headerActions ? 'has-actions' : ''} content`}>
                {children}
            </div>
            {!isFullscreen && this.props.buttons && this.props.buttons.length > 0 ?
                <div className="actions">
                    {this.props.buttons.map(action =>
                        action.url ?
                            <Link
                                key={`action_${action.label}`}
                                icon={action.icon}
                                text={action.label}
                                className={`ui button approve ${action.icon ? 'icon right labeled' : ''} ${action.className || ''} ${action.loading ? "loading disabled" : ""} ${action.disabled ? "disabled" : ""}`}
                                href={action.url}
                                target={!action.fileName ? '_blank' : undefined}
                                download={action.fileName ? pxt.Util.htmlEscape(action.fileName) : undefined}
                            />
                            : <ModalButtonElement
                                key={`action_${action.label}`}
                                {...action} />
                    )}
                </div> : undefined}
            {!isFullscreen && closeIcon ? <div role="button" className="closeIcon" tabIndex={0}
                onClick={onClose}
                onKeyDown={fireClickOnEnter}
            ><Icon icon="close remove circle" /> </div> : undefined}
        </ReactModal>
    }
}

class ModalButtonElement extends data.PureComponent<ModalButton, {}> {
    constructor(props: ModalButton) {
        super(props);
        this.state = {
        }

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
        if (!this.props.disabled)
            this.props.onclick();
    }

    renderCore() {
        const action = this.props;
        return <Button
            icon={action.icon}
            text={action.label}
            className={`approve ${action.icon ? 'icon right labeled' : ''} ${action.className || ''} ${action.loading ? "loading disabled" : ""} ${action.disabled ? "disabled" : ""}`}
            onClick={this.handleClick}
            onKeyDown={fireClickOnEnter} />
    }
}

///////////////////////////////////////////////////////////
////////////             Dimmer               /////////////
///////////////////////////////////////////////////////////

export interface DimmerProps extends ReactModal.Props {
    className?: string;
    disabled?: boolean;
    inverted?: boolean;
    page?: boolean;
    simple?: boolean;
    active?: boolean;
    onClose?: () => void;
    closable?: boolean;
}

export interface DimmerState {
}

export class Dimmer extends UIElement<DimmerProps, DimmerState> {

    render() {
        const { disabled, inverted, page, simple,
            closable, onClose, active, children, ...rest } = this.props;
        const portalClasses = cx([
            'ui dimmer',
            active ? 'active transition visible' : '',
            disabled ? 'disabled' : '',
            inverted ? 'inverted' : '',
            page ? 'page' : '',
            simple ? 'simple' : ''
        ])
        const customStyles = {
            content: {
                background: 'none',
                border: '0'
            }
        }
        return <ReactModal
            appElement={appElement}
            style={customStyles}
            shouldCloseOnOverlayClick={closable}
            onRequestClose={onClose}
            overlayClassName={portalClasses}
            {...rest}>
            {children}
        </ReactModal>
    }
}

///////////////////////////////////////////////////////////
////////////             Loader               /////////////
///////////////////////////////////////////////////////////

export interface LoaderProps {
    active?: boolean;
    className?: string;
    disabled?: boolean;
    inverted?: boolean;
    size?: SIZES
}

export class Loader extends UIElement<LoaderProps, {}> {

    render() {
        const { active, children, disabled, inverted, size, className } = this.props;
        const classes = cx([
            'ui loader',
            size,
            active ? 'active' : '',
            disabled ? 'disabled' : '',
            inverted ? 'inverted' : '',
            children ? 'text' : '',
            className
        ])
        return <div
            className={classes}>
            {children}
        </div>
    }
}

///////////////////////////////////////////////////////////
////////////           Tooltip                /////////////
///////////////////////////////////////////////////////////

export interface TooltipUIProps {
    tooltip?: string;
    tooltipId?: string;
    tooltipDelayShow?: number;
    tooltipPlace?: "top" | "left" | "right" | "bottom";
}

export interface TooltipProps extends ReactTooltip.Props {
    content: string;
}

export class Tooltip extends React.Component<TooltipProps, {}> {

    constructor(props: TooltipProps) {
        super(props);
        this.state = {
        }
    }

    render() {
        const { id, content, className, ...rest } = this.props;

        return <div>
            <div data-tip='tooltip' data-for={id}>
                {this.props.children}
            </div>
            <ReactTooltip id={id} className={`pxt-tooltip ${className || ''}`} effect='solid' {...rest}>
                {content}
            </ReactTooltip>
        </div>
    }
}
