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
    value: string;
    onChange?: (v: string) => void;
}

function genericClassName(cls: string, props: UiProps) {
    return cls + " " + (props.icon ? " icon" : "") + " " + (props.class || "")
}

function genericContent(props: UiProps) {
    return [
        props.icon ? (<i className={props.icon + " icon"}></i>) : null,
        props.text ? (<div className='text'>{props.text}</div>) : null
    ]
}

export class Dropdown extends data.Component<DropdownProps, {}> {
    componentDidMount() {
        this.child("").dropdown({
            onChange: (v: string) => {
                if (this.props.onChange)
                    this.props.onChange(v)
            }
        });
    }

    componentDidUpdate() {
        this.child("")
            .dropdown('set selected', this.props.value)
            .dropdown("refresh")
    }

    renderCore() {
        return (
            <div className={genericClassName("ui dropdown", this.props) }>
                <input type="hidden" name="mydropdown"/>
                {genericContent(this.props) }
                <div className="default text"></div>
                <div className="menu">
                    {this.props.children}
                </div>
            </div>);
    }
}

export interface ItemProps extends UiProps {
    value: string;
    onClick?: () => void;
}

export class Item extends data.Component<ItemProps, {}> {
    renderCore() {
        return (
            <div className={genericClassName("item", this.props) } key={this.props.value} data-value={this.props.value}>
                {genericContent(this.props) }
                {this.props.children}
            </div>);
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
