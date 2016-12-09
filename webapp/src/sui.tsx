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
        let p = this.props
        let el = ReactDOM.findDOMNode(this);

        if (!p.lines || p.lines == 1) {
            let inp = el.getElementsByTagName("input")[0] as HTMLInputElement;
            inp.setSelectionRange(0, inp.value.length);
        } else {
            let inp = el.getElementsByTagName("textarea")[0] as HTMLTextAreaElement;
            inp.setSelectionRange(0, inp.value.length);
        }

        let btn = $(el.getElementsByTagName("button")[0]);
        try {
            document.execCommand("copy");
        } catch (e) {
        }
    }

    renderCore() {
        let p = this.props
        let copyBtn = p.copy && document.queryCommandSupported('copy')
            ? <Button class="ui right labeled teal icon button" text={lf("Copy") } icon="copy" onClick={() => this.copy() } />
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

export interface ModalProps {
    children?: any;
    addClass?: string;
    headerClass?: string;
    header: string;
    onHide: () => void;
    visible?: boolean;
}

export interface ModalState {
}

export class Modal extends data.Component<ModalProps, ModalState> {
    id: string;
    constructor(props: ModalProps) {
        super(props)
        this.id = Util.guidGen();
    }

    hide() {
        this.props.onHide();
    }

    renderCore() {
        if (!this.props.visible) return null;
        return (
            <div id={this.id} className={`ui mydimmer dimmer modals page ${pxt.options.light ? "" : "transition"} visible active`} onClick={ev => {
                if (/mydimmer/.test((ev.target as HTMLElement).className))
                    this.hide()
            } }>
                <div role="dialog" aria-labelledby={this.id + 'title'} aria-describedby={this.id + 'desc'} className={"ui modal transition visible active " + (this.props.addClass || "") }>
                    <div id={this.id + 'title'} className={"header " + (this.props.headerClass || "") }>
                        {this.props.header}
                    </div>
                    <div id={this.id + 'desc'} className="content">
                        {this.props.children}
                    </div>
                    <div className="actions">
                        <Button
                            icon="close"
                            text={lf("Close") }
                            class="cancel right labeled"
                            onClick={() => this.hide() } />
                    </div>
                </div>
            </div>
        );
    }
}

