import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";

export interface UiProps {
    icon?: string;
    iconClass?:string;
    text?: string;
    textClass?:string;
    children?: any;
    class?: string;
}

export interface WithPopupProps extends UiProps {
    popup?: string;
}

export interface DropdownProps extends WithPopupProps {
    value?: string;
    onChange?: (v: string) => void;
}

function genericClassName(cls: string, props: UiProps) {
    return cls + " " + (props.icon ? " icon" : "") + " " + (props.class || "")
}

function genericContent(props: UiProps) {
    return [
        props.icon ? (<i key='iconkey' className={props.icon + " icon " + (props.text ? " icon-and-text " : "") + (props.iconClass ? " " + props.iconClass : '')}></i>) : null,
        props.text ? (<span key='textkey' className={'text' + (props.textClass ? ' ' + props.textClass : '')}>{props.text}</span>) : null
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

export class DropdownMenu extends UiElement<DropdownProps> {
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
            <div className={genericClassName("ui dropdown", this.props) }>
                {genericContent(this.props) }                
                <div className="menu">
                    {this.props.children}
                </div>
            </div>);
    }
}

export class DropdownList extends DropdownMenu {

    componentDidUpdate() {
        this.child("").dropdown('set selected', this.props.value)
        super.componentDidUpdate()
    }

    renderCore() {
        return (
            <div className={genericClassName("ui dropdown", this.props) }>
                <input type="hidden" name="mydropdown"/>
                {this.props.icon ? null : (<i className="dropdown icon"></i>)}
                {genericContent(this.props) }
                <div className="default text"></div>
                <div className="menu">
                    {this.props.children}
                </div>
            </div>);
    }
}

export interface ItemProps extends UiProps {
    value?: string;
    onClick?: () => void;
}

export class Item extends data.Component<ItemProps, {}> {
    renderCore() {
        return (
            <div className={genericClassName("ui item", this.props) }
                key={this.props.value}
                data-value={this.props.value}
                onClick={this.props.onClick}>
                {genericContent(this.props) }
                {this.props.children}
            </div>);
    }
}

export interface ButtonProps extends WithPopupProps {
    onClick?: () => void;
}

export class Button extends UiElement<ButtonProps> {
    renderCore() {
        return (
            <button className={genericClassName("ui button", this.props) }
                title={this.props.text}
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
            <div>
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
    onChange?: (v: string) => void;
    lines?: number;
}, {}> {
    renderCore() {
        let p = this.props
        return (
            <Field label={p.label}>
                {!p.lines || p.lines == 1 ?
                    <div className={"ui input" + (p.inputLabel ? " labelled" : "")}>
                        {p.inputLabel ? (<div className="ui label">{p.inputLabel}</div>) : ""}
                        <input type={p.type || "text"} value={p.value} onChange={v => p.onChange((v.target as any).value) }/>
                    </div>
                    :
                    <textarea value={p.value} onChange={v => p.onChange((v.target as any).value) }>
                    </textarea>
                }
            </Field>
        );
    }
}

export class Modal extends data.Component<{
    children?: any;
    addClass?: string;
    headerClass?: string;
    header: string;
}, {
        visible?: boolean;
    }> {
    show() {
        this.setState({ visible: true })
    }

    hide() {
        this.setState({ visible: false })
    }

    renderCore() {
        if (!this.state.visible) return null;
        return (
            <div className="ui mydimmer dimmer modals page transition visible active" onClick={ev => {
                if (/mydimmer/.test((ev.target as HTMLElement).className))
                    this.hide()
            } }>
                <div className={"ui modal transition visible active " + (this.props.addClass || "") }>
                    <div className={"ui top attached label " + (this.props.headerClass || "teal") }>
                        {this.props.header}
                        <i className='cancel link icon' onClick={() => this.hide() }/>
                    </div>
                    {this.props.children}
                </div>
            </div>
        );
    }
}

