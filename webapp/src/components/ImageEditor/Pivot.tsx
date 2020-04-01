import * as React from 'react';

export interface PivotOption {
    text: string;
    id: string;
}

export interface PivotProps {
    options: PivotOption[];
    selected: number;
    onChange: (selected: PivotOption, index: number) => void;
}

export interface PivotState {
}

export class Pivot extends React.Component<PivotProps, PivotState> {
    protected handlers: (() => void)[] = [];

    constructor(props: PivotProps) {
        super(props);

        this.state = {
            open: false
        };
    }

    componentWillUnmount() {
        this.handlers = null;
    }

    render() {
        const { options, selected } = this.props;

        const selectedOption = options[selected];

        return <div className="image-editor-pivot-outer">
            { options.map((option, index) =>
                <div
                    role="tab"
                    key={option.id}
                    className={`image-editor-pivot-option ${option === selectedOption ? "selected" : ""}`}
                    onClick={this.clickHandler(index)}>
                    { option.text }
                </div>
            ) }
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
}