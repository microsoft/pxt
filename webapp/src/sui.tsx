import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";

export interface UiProps {
    icon?: string;
    text?: string;
    children?: any;
    class?: string;
}

export interface DropdownProps extends UiProps {
    value?: string;
    onChange?: (v: string) => void;
    menu?: boolean;
}

function genericClassName(cls: string, props: UiProps) {
    return cls + " " + (props.icon ? " icon" : "") + " " + (props.class || "")
}

function genericContent(props: UiProps) {
    return [
        props.icon ? (<i key='iconkey' className={props.icon + " icon"}></i>) : null,
        props.text ? (<span key='textkey' className='text'>{props.text}</span>) : null
    ]
}

export class Dropdown extends data.Component<DropdownProps, {}> {
    componentDidMount() {
        this.child("").dropdown({
            action: this.props.menu ? "activate" : "hide",
            onChange: (v: string) => {
                if (this.props.onChange && v != this.props.value) {
                    this.props.onChange(v)
                }
            }
        });
    }

    componentDidUpdate() {
        if (!this.props.menu)
            this.child("").dropdown('set selected', this.props.value)
        this.child("").dropdown("refresh")
    }

    renderCore() {
        return (
            <div className={genericClassName("ui dropdown", this.props) }>
                {this.props.menu ? null : <input type="hidden" name="mydropdown"/>}
                {this.props.icon ? null : (<i className="dropdown icon"></i>) }
                {genericContent(this.props) }
                {this.props.menu ? null : <div className="default text"></div>}
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

export interface ButtonProps extends UiProps {
    onClick?: () => void;
    popup?: string;
}

export class Button extends data.Component<ButtonProps, {}> {
    componentDidMount() {
        if (this.props.popup)
            this.child("").popup();
    }

    componentDidUpdate() {
        if (this.props.popup)
            this.child("").popup();
    }
    renderCore() {
        return (
            <button className={genericClassName("ui button", this.props) }
                data-content={this.props.popup}
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
