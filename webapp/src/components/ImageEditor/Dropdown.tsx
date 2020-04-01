import * as React from 'react';

export interface DropdownOption {
    text: string;
    id: string;
}

export interface DropdownProps {
    options: DropdownOption[];
    selected: number;
    onChange: (selected: DropdownOption, index: number) => void;
}

export interface DropdownState {
    open: boolean;
}

export class Dropdown extends React.Component<DropdownProps, DropdownState> {
    protected handlers: (() => void)[] = [];

    constructor(props: DropdownProps) {
        super(props);

        this.state = {
            open: false
        };
    }

    componentDidUpdate() {
        this.handlers = [];
    }

    componentWillUnmount() {
        this.handlers = null;
    }

    render() {
        const { options, selected } = this.props;
        const { open } = this.state;

        const selectedOption = options[selected];

        return <div className="image-editor-dropdown-outer">
            <button className="image-editor-dropdown" aria-haspopup="listbox" onClick={this.handleDropdownClick}>
                { selectedOption.text }
                <span className="image-editor-dropdown-chevron ms-Icon ms-Icon--ChevronDown">
                </span>
            </button>
            <ul tabIndex={-1} role="listbox" aria-activedescendant={selectedOption.id} className={open ? "" : "hidden"}>
                {
                    options.map((option, index) =>
                        <li key={option.id}
                            role="option"
                            aria-selected={index === selected}
                            className={index === selected ? "selected" : ""}
                            onClick={this.clickHandler(index)}>
                            {option.text}
                        </li>
                    )
                }
            </ul>
        </div>
    }

    protected clickHandler(index: number): () => void {
        if (!this.handlers[index]) {
            const { onChange, options } = this.props;

            this.handlers[index] = () => {
                this.setState({ open: false });
                onChange(options[index], index);
            };
        }

        return this.handlers[index];
    }

    protected handleDropdownClick = () => {
        this.setState({ open: !this.state.open });
    }
}