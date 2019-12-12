import * as React from 'react';

export interface ToggleProps {
    initialValue?: boolean;
    label?: string;
    onChange?: (on: boolean) => void;
}

export class Toggle extends React.Component<ToggleProps, {}> {
    protected checked = false;
    constructor(props: ToggleProps) {
        super(props);
        this.checked = props.initialValue;
    }

    render() {
        const { initialValue, label } = this.props;
        return  <div className="image-editor-toggle-container" >
            {label && <span>{label}</span>}
            <label className="image-editor-toggle">
                <input type="checkbox" onClick={this.handleToggleClick}
                    defaultChecked={initialValue} aria-checked={this.checked} />
                <span className="image-editor-toggle-switch" />
            </label>
        </div>
    }

    protected handleToggleClick = (evt: any) => {
        this.checked = !this.checked;
        if (this.props.onChange) this.props.onChange(evt.target.checked);
    }
}