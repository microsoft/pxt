import * as React from 'react';

export interface ToggleProps {
    initialValue?: boolean;
    label?: string;
    onChange?: (on: boolean) => void;
}

export interface ToggleState {
    on?: boolean
}

export class Toggle extends React.Component<ToggleProps, ToggleState> {
    constructor(props: ToggleProps) {
        super(props);

        this.state = {
            on: props.initialValue
        };
    }

    render() {
        const { initialValue, label } = this.props;
        return  <div className="image-editor-toggle-container" >
            {label && <span>{label}</span>}
            <label className="image-editor-toggle">
                <input type="checkbox" onClick={this.handleToggleClick} defaultChecked={initialValue} />
                <span className="image-editor-toggle-switch" />
            </label>
        </div>
    }

    protected handleToggleClick = (evt: any) => {
        if (this.props.onChange) this.props.onChange(evt.target.checked);
    }
}