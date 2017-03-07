import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";

export interface UiProps {
    icon?: string;
    iconClass?: string;
    text?: string;
    textClass?: string;
    children?: any;
    class?: string;
    role?: string;
    title?: string;
}

export interface WithPopupProps extends UiProps {
    popup?: string;
}

export interface DropdownProps extends WithPopupProps {
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
    return `${cls} ${ignoreIcon ? '' : props.icon && props.text ? 'icon-and-text' : props.icon ? 'icon' : ""} ${props.class || ""}`;
}

function genericContent(props: UiProps) {
    return [
        props.icon ? (<i key='iconkey' className={props.icon + " icon " + (props.text ? " icon-and-text " : "") + (props.iconClass ? " " + props.iconClass : '') }></i>) : null,
        props.text ? (<span key='textkey' className={'ui text' + (props.textClass ? ' ' + props.textClass : '') }>{props.text}</span>) : null,
    ]
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
    componentDidMount() {
        this.popup()
        this.child("").dropdown({
            action: "hide",
            fullTextSearch: true,
            onChange: (v: string) => {
                if (this.props.onChange && v != this.props.value) {
                    this.props.onChange(v)
                }
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
                role={this.props.role}
                title={this.props.title}>
                {genericContent(this.props) }
                <div className="menu">
                    {this.props.children}
                </div>
            </div>);
    }
}

export interface ItemProps extends UiProps {
    active?: boolean;
    value?: string;
    onClick?: () => void;
}

export class Item extends data.Component<ItemProps, {}> {
    renderCore() {
        return (
            <div className={genericClassName("ui item link", this.props, true) + ` ${this.props.active ? 'active' : ''}` }
                role={this.props.role}
                title={this.props.title}
                key={this.props.value}
                data-value={this.props.value}
                onClick={this.props.onClick}>
                {genericContent(this.props) }
                {this.props.children}
            </div>);
    }
}

export interface ButtonProps extends WithPopupProps {
    title?: string;
    onClick?: (e: React.MouseEvent) => void;
    disabled?: boolean;
}

export class Button extends UiElement<ButtonProps> {
    renderCore() {
        return (
            <button className={genericClassName("ui button", this.props) + " " + (this.props.disabled ? "disabled" : "") }
                role={this.props.role}
                title={this.props.title}
                onClick={this.props.onClick}>
                {genericContent(this.props) }
                {this.props.children}
            </button>
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
}, {}> {
    renderCore() {
        return (
            <div className="field">
                {this.props.label ? <label>{this.props.label}</label> : null}
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
}, {}> {

    copy() {
        const p = this.props
        const el = ReactDOM.findDOMNode(this);

        if (!p.lines || p.lines == 1) {
            const inp = el.getElementsByTagName("input")[0] as HTMLInputElement;
            inp.select();
        } else {
            const inp = el.getElementsByTagName("textarea")[0] as HTMLTextAreaElement;
            inp.select();
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

        return (
            <Field label={p.label}>
                <div className={"ui input" + (p.inputLabel ? " labelled" : "") + (p.copy ? " action fluid" : "") + (p.disabled ? " disabled" : "") }>
                    {p.inputLabel ? (<div className="ui label">{p.inputLabel}</div>) : ""}
                    {!p.lines || p.lines == 1 ? <input
                        className={p.class || ""}
                        type={p.type || "text"}
                        placeholder={p.placeholder} value={p.value}
                        readOnly={!!p.readOnly}
                        onChange={v => p.onChange((v.target as any).value) }/>
                        : <textarea
                            className={"ui input " + (p.class || "") + (p.inputLabel ? " labelled" : "") }
                            rows={p.lines}
                            placeholder={p.placeholder}
                            value={p.value}
                            readOnly={!!p.readOnly}
                            onChange={v => p.onChange((v.target as any).value) }>
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
                {p.inputLabel ? <label>{p.inputLabel}</label> : undefined }
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
            <div className={classes} onClick={this.handleClick}>
                {icon ? <i className={`icon ${icon}`} ></i> : undefined}
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
            <div className={classes}>
                {children}
            </div>
        )
    }
}

export interface ModalProps {
    basic?: boolean;
    children?: any;
    className?: string;
    closeIcon?: any;
    closeOnDimmerClick?: boolean;
    closeOnDocumentClick?: boolean;
    dimmer?: boolean | 'blurring' | 'inverted';
    dimmerClassName?: string;

    onClose?: Function;
    onOpen?: Function;

    open?: boolean;
    mountNode?: any;
    size?: string;

    headerClass?: string;
    header?: string;
    helpUrl?: string;

    action?: string;
    actionClick?: () => void;
    actionLoading?: boolean;
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
            open: this.props.open
        }
    }

    componentWillUnmount() {
        this.handlePortalUnmount()
    }

    componentWillMount() {
        const { open } = this.props;
        this.state = {open: open}
    }

    componentWillReceiveProps(nextProps: ModalProps) {
        const newState: ModalState = {};
        if (nextProps.open != undefined) {
            newState.open = nextProps.open;
        }

        if (Object.keys(newState).length > 0) this.setState(newState)
    }

    getMountNode = () => this.props.mountNode || document.body;

    handleClose = (e: Event) => {
        const { onClose } = this.props;
        if (onClose) onClose(e, this.props);

        if (this.state.open != false)
            this.setState({open: false})
    }

    handleOpen = (e: Event) => {
        const { onOpen } = this.props;
        if (onOpen) onOpen(e, this.props);

        if (this.state.open != true)
            this.setState({open: true})
    }

    setPosition = () => {
        if (this.ref) {
            const mountNode = this.getMountNode();
            const { height } = this.ref.getBoundingClientRect();

            const marginTop = -Math.round(height / 2);
            const scrolling = height >= window.innerHeight;

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

            if (Object.keys(newState).length > 0) this.setState(newState);
        }

        this.animationId = requestAnimationFrame(this.setPosition);
    }

    handlePortalMount = () => {
        const { dimmer } = this.props;
        const mountNode = this.getMountNode();

        if (dimmer) {
            mountNode.classList.add('dimmable', 'dimmed');

            if (dimmer === 'blurring' && !pxt.options.light) {
                mountNode.classList.add('blurring');
            }
        }

        this.setPosition()
    }

    handleRef = (c: any) => (this.ref = c);

    handlePortalUnmount = () => {
        const mountNode = this.getMountNode();
        mountNode.classList.remove('blurring', 'dimmable', 'dimmed', 'scrollable');

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
            dimmer,
            dimmerClassName,
            size,
        } = this.props

        const { marginTop, scrolling } = this.state
        const classes = cx([
            'ui',
            size,
            basic ? 'basic' : '',
            scrolling ? 'scrolling' : '',
            'modal transition visible active',
            className,
        ]);

        const closeIconName = closeIcon === true ? 'close' : closeIcon;

        const modalJSX = (
            <div className={classes} style={{ marginTop }} ref={this.handleRef} role="dialog" aria-labelledby={this.id + 'title'} aria-describedby={this.id + 'desc'} >
                {this.props.header ? <div id={this.id + 'title'} className={"header " + (this.props.headerClass || "") }>
                    {this.props.header}
                    {this.props.closeIcon ? <Button
                        icon={closeIconName}
                        class="clear right floated"
                        onClick={() => this.handleClose(null) } /> : undefined }
                    {this.props.helpUrl ?
                        <a className="ui button icon-and-text right floated labeled" href={this.props.helpUrl} target="_docs">
                            <i className="help icon"></i>
                            {lf("Help") }</a>
                        : undefined}
                </div> : undefined }
                <div id={this.id + 'desc'} className="content">
                    {children}
                </div>
                {this.props.action && this.props.actionClick ?
                    <div className="actions">
                        <Button
                            text={this.props.action}
                            class={`approve primary ${this.props.actionLoading ? "loading" : ""}`}
                            onClick={() => {
                                this.props.actionClick();
                            } } />
                    </div> : undefined }
            </div>
        )

        const dimmerClasses = !dimmer
            ? null
            : cx([
                'ui',
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
                className={dimmerClasses}
                mountNode={this.getMountNode() }
                onMount={this.handlePortalMount}
                onUnmount={this.handlePortalUnmount}
                onClose={this.handleClose}
                onOpen={this.handleOpen}
                open={open}>
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
}

interface PortalState {
    open?: boolean;
}

export class Portal extends data.Component<PortalProps, PortalState> {
    rootNode: HTMLElement;
    portalNode: Element;
    constructor(props: PortalProps) {
        super(props);
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
        this.state = {open: open}
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

    close = (e: Event) => {
        const { onClose } = this.props;
        if (onClose) onClose(e);

        if (this.state.open != false)
            this.setState({open: false})
    }

    open = (e: Event) => {
        const { onOpen } = this.props;
        if (onOpen) onOpen(e);

        if (this.state.open != true)
            this.setState({open: true})
    }

    mountPortal = () => {
        if (this.rootNode) return;

        const { mountNode = document.body } = this.props;

        this.rootNode = document.createElement('div');
        mountNode.appendChild(this.rootNode);

        document.addEventListener('click', this.handleDocumentClick)

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

        const { onUnmount } = this.props;
        if (onUnmount) onUnmount();
    }

    renderPortal() {
        const { children, className, open} = this.props;

        this.mountPortal();

        this.rootNode.className = className || '';

        ReactDOM.unstable_renderSubtreeIntoContainer(
            this,
            React.Children.only(children),
            this.rootNode
        )

        this.portalNode = this.rootNode.firstElementChild;
    }

    renderCore() {
        return <div />;
    }

}