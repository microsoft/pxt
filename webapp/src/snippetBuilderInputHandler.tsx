import * as React from 'react';
import * as data from './data';
import { ImageEditor } from './components/ImageEditor/ImageEditor';
import * as sui from './sui';
import { PositionPicker } from './snippetBuilderPositionPicker';
import * as Snippet from './snippetBuilder'

type MultiOnChange = (answerToken: string) => (v: string) => void;

interface InputHandlerProps {
    input: pxt.SnippetQuestionInput;
    onChange: ((v: string) => void) | MultiOnChange;
    value: string;
    onEnter?: () => void;
}

interface InputHandlerState {
    isFocused?: boolean;
}

export class InputHandler extends data.Component<InputHandlerProps, InputHandlerState> {
    constructor(props: InputHandlerProps) {
        super(props);
        this.state = {
            isFocused: false
        };
    }

    // Strip all non alphanumeric characters other than _
    textOnChange = (v: string) => this.props.onChange(v);
    variableNameOnChange = (v: string) => this.props.onChange(ts.pxtc.escapeIdentifier(v));

    renderInput() {
        const { value, input, onChange } = this.props;

        switch (input.type) {
            case 'dropdown':
                return (
                    <DropdownInput
                        input={input}
                        value={value}
                        onChange={onChange}
                    />
                )
            case 'yesno':
                return (
                    <YesNoInput
                        input={input}
                        onChange={onChange}
                    />
                )
            case 'spriteEditor':
                if (Snippet.isSnippetInputAnswerTypeOther(input)) {
                    return (
                        <ImageEditor
                            singleFrame={true}
                            initialValue={value}
                            onChange={onChange}
                        />
                    );
                }
            case 'number':
                return (
                    <RangeInput
                        input={input}
                        value={value}
                        onChange={onChange}
                        autoFocus={true}
                    />
                )
            case 'positionPicker':
                if (!Snippet.isSnippetInputAnswerSingular(input)) {
                    return (
                        <PositionPicker
                            defaultX={parseInt(input.defaultAnswers[0])}
                            defaultY={parseInt(input.defaultAnswers[1])}
                            input={input}
                            onChange={onChange as MultiOnChange}
                        />
                    )
                }
            case 'text':
            case 'variableName':
            default:
                if (Snippet.isSnippetInputAnswerTypeOther(input)) {
                    return (
                        <sui.Input
                            label={input.label && input.label}
                            value={value || ''}
                            onChange={input.type == 'variableName' ? this.variableNameOnChange : this.textOnChange}
                            autoFocus={true}
                            selectOnMount={true}
                        />
                    )
                }
        }

        return null;
    }

    renderCore() {
        return this.renderInput();
    }
}

/**
 * Dropdown input
 */

interface IDropdownInputProps {
    input?: pxt.SnippetQuestionInput;
    value?: string;
    onChange: (v: string) => void;
}

class DropdownInput extends data.Component<IDropdownInputProps, {}> {
    constructor(props: IDropdownInputProps) {
        super(props);

        this.onChange = this.onChange.bind(this);
    }

    onChange = (value: string) => () => {
        const { onChange } = this.props;
        onChange(value);
    }

    renderCore() {
        const { value, input } = this.props;
        if (Snippet.isSnippetInputAnswerTypeDropdown(input)) {

            return (
                <sui.DropdownMenu className='inline button' role="menuitem"
                    text={value.length ? pxt.Util.rlf(input.options[value]) : pxt.Util.rlf(input.options[Object.keys(input.options)[0]])}
                    icon={'dropdown'}>
                    {Object.keys(input.options).map((optionValue) =>
                        <sui.Item
                            role="menuitem"
                            value={optionValue}
                            key={input.options[optionValue]}
                            text={pxt.Util.rlf(input.options[optionValue])}
                            onClick={this.onChange(optionValue)}
                        />)}
                </sui.DropdownMenu>
            )
        }

        return null;
    }
}

/**
 * RangeInput/Number
 */

interface IRangeInputProps {
    value: string;
    onChange: (v: string) => void;
    input: pxt.SnippetQuestionInput;
    autoFocus?: boolean;
}

/**
 * TODO: Slider is not full width on Mozilla only
 */
class RangeInput extends data.Component<IRangeInputProps, {}> {
    constructor(props: IRangeInputProps) {
        super(props);

        this.onChange = this.onChange.bind(this);
    }

    private onChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { onChange } = this.props;

        onChange(e.target.value);
    }

    renderCore() {
        const { input, value, autoFocus } = this.props;
        if (Snippet.isSnippetInputAnswerTypeNumber(input)) {
            return (
                <div className="slider-outer">
                    <span>{input.label && input.label}</span>
                    <div>
                        <input
                            type='range'
                            autoFocus={autoFocus}
                            className={'slider blocklyMockSlider'}
                            role={'slider'}
                            max={input.max}
                            min={input.min}
                            value={value}
                            onChange={this.onChange}
                            aria-valuemin={input.min}
                            aria-valuemax={input.max}
                            aria-valuenow={+value}
                            style={{
                                marginLeft: 0
                            }}
                        />
                        <sui.Input
                            value={value}
                            onChange={this.props.onChange}
                            class='snippet slider-input'
                        />
                    </div>
                </div>
            )
        }

        return null;
    }
}


/**
 * YesNo input
 */

interface IYesNoInputProps {
    input?: pxt.SnippetQuestionInput;
    value?: string;
    onChange: (v: string) => void;
}

class YesNoInput extends data.Component<IYesNoInputProps, {}> {
    constructor(props: IYesNoInputProps) {
        super(props);

        this.onChange = this.onChange.bind(this);
    }

    onChange(value: string): () => void {
        const { onChange } = this.props;
        return () => onChange(value);
    }

    renderCore() {
        const { input } = this.props;
        if (Snippet.isSnippetInputAnswerTypeYesNo(input)) {
            return (
                <div>
                    {/* TODO: onChange shouldn't assume string */}
                    <sui.Button text="Yes" title="Yes" onClick={this.onChange("true")} />
                    <sui.Button text="No" title="No" onClick={this.onChange("false")} />
                </div>
            )
        }

        return null;
    }
}