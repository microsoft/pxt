import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui";
import * as core from "./core";
import { ProgressBar } from "../../react-common/components/controls/ProgressBar";

interface CoreDialogState {
    visible?: boolean;
    inputValue?: string;
    inputError?: string;
    confirmationText?: string;
    confirmationGranted?: boolean;
}

export class CoreDialog extends React.Component<core.PromptOptions, CoreDialogState> {

    public promise: Promise<any>;

    private resolve: any;
    private reject: any;

    private okButton: sui.ModalButton;

    constructor(props: core.PromptOptions) {
        super(props);
        this.state = {
            inputValue: props.initialValue,
            inputError: undefined,
            confirmationGranted: (props.confirmationText || props.confirmationCheckbox) ? false : undefined
        }

        this.hide = this.hide.bind(this);
        this.modalDidOpen = this.modalDidOpen.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleConfirmationTextChange = this.handleConfirmationTextChange.bind(this);
        this.handleConfirmationCheckboxChange = this.handleConfirmationCheckboxChange.bind(this);
        if (props.forceUpdate) props.forceUpdate(() => this.forceUpdate());
    }

    hide() {
        this.close();
    }

    close(result?: any) {
        this.setState({ visible: false });
        this.resolve(result);
        if (this.props.onClose) this.props.onClose();
    }

    componentDidMount() {
        this.promise = new Promise(
            (res, rej) => {
                this.resolve = res;
                this.reject = rej;
            }
        );
    }

    modalDidOpen(ref: HTMLElement) {
        const options = this.props;
        const dialogInput = this.refs['promptInput'] as HTMLInputElement;
        if (dialogInput) {
            dialogInput.setSelectionRange(0, 9999);
            const that = this;
            dialogInput.onkeydown = (e: KeyboardEvent) => {
                const charCode = core.keyCodeFromEvent(e);
                if (charCode === core.ENTER_KEY && that.okButton && dialogInput.value) {
                    that.okButton.onclick();
                    e.preventDefault();
                }
            }
        }
        if (options.onLoaded) {
            options.onLoaded(ref);
        }
    }

    handleInputChange(v: React.ChangeEvent<any>) {
        const options = this.props;
        if (options.onInputChanged)
            options.onInputChanged(v.target.value);
        let inputError: string;
        if (options.onInputValidation) {
            inputError = options.onInputValidation(v.target.value);
        }
        this.setState({ inputValue: v.target.value, inputError });
    }

    handleConfirmationTextChange(v: string) {
        this.setState({
            confirmationText: v,
            confirmationGranted: this.state.confirmationText === this.props.confirmationText

        })
    }

    handleConfirmationCheckboxChange(b: boolean) {
        this.setState({
            confirmationGranted: b
        });
    }

    render() {
        const options = this.props;
        const { inputValue, inputError } = this.state;
        const size = options.size === undefined ? 'small' : options.size;
        const isEscapable = !options.nonEscapable && (options.hasCloseIcon || !options.hideCancel);

        const buttons = options.buttonsFn
            ? options.buttonsFn().filter(b => !!b)
            : options.buttons
                ? options.buttons.filter(b => !!b)
                : [];

        buttons.forEach(btn => {
            const onclick = btn.onclick;
            btn.onclick = () => {
                if (!btn.noCloseOnClick) {
                    this.close(onclick ? onclick() : 0);
                } else {
                    onclick?.();
                }
            }
            if (!btn.className) btn.className = "approve positive";
            if (btn.approveButton) this.okButton = btn;
        })
        if (options.type == 'prompt' && this.okButton) this.okButton.disabled = !inputValue || !!inputError;

        const classes = sui.cx([
            'coredialog',
            options.className
        ])

        const mobile = pxt.BrowserUtils.isMobile();

        // if we have confirmation text (e.g. enter your name), disable the approve button until the
        //  text matches
        options.buttons?.forEach(b => {
            if (b.approveButton && this.state.confirmationGranted !== undefined) {
                const disabledClass = " disabled"
                if (this.state.confirmationGranted)
                    b.className = b.className.replace(disabledClass, "")
                else
                    b.className += b.className.indexOf(disabledClass) >= 0 ? "" : disabledClass
            }
        });

        return (
            <sui.Modal isOpen={true} ref="modal" className={classes}
                onClose={this.hide} size={size}
                defaultOpen={true} buttons={buttons}
                dimmer={true} closeIcon={options.hasCloseIcon}
                header={options.header}
                headerFn={options.headerFn}
                headerIcon={options.headerIcon}
                closeOnDimmerClick={isEscapable}
                closeOnDocumentClick={isEscapable}
                closeOnEscape={isEscapable}
                modalDidOpen={this.modalDidOpen}
            >
                {options.type == 'prompt' && <div className="ui">
                    <div className="ui fluid icon input">
                        <input
                            autoFocus
                            className={`ui input ${inputError ? "error" : ""}`}
                            type="text"
                            ref="promptInput"
                            onChange={this.handleInputChange}
                            value={inputValue}
                            placeholder={options.placeholder}
                            aria-label={options.placeholder}
                        />
                    </div>
                    {!!inputError && <div className="ui error message" role="alert">{inputError}</div>}
                </div>}
                {options.jsx}
                {!!options.jsxd && options.jsxd()}
                {!!options.body && <p>{options.body}</p>}
                {!!options.copyable && <sui.Input copy={true} readOnly={true} value={options.copyable} selectOnClick={true} autoComplete={false} />}
                {!!options.confirmationText &&
                    <>
                        <p>Type '{options.confirmationText}' to confirm:</p>
                        <sui.Input ref="confirmationInput" id="confirmationInput"
                            ariaLabel={lf("Type your name to confirm")} autoComplete={false}
                            value={this.state.confirmationText || ''} onChange={this.handleConfirmationTextChange}
                            selectOnMount={!mobile} autoFocus={!mobile} />
                    </>
                }
                {!!options.confirmationCheckbox &&
                    <sui.PlainCheckbox label={options.confirmationCheckbox} isChecked={this.state.confirmationGranted} onChange={this.handleConfirmationCheckboxChange} />
                }
            </sui.Modal >)
    }
}

let currentDialog: CoreDialog;

export function dialogIsShowing() {
    return !!currentDialog;
}

export function forceUpdate() {
    if (currentDialog)
        currentDialog.forceUpdate();
}

export function renderConfirmDialogAsync(options: core.PromptOptions): Promise<void> {
    return pxt.Util.delay(10)
        .then(() => {
            const wrapper = document.body.appendChild(document.createElement('div'));
            const newDialog = ReactDOM.render(React.createElement(CoreDialog, options), wrapper);
            currentDialog = newDialog;

            function cleanup() {
                ReactDOM.unmountComponentAtNode(wrapper);
                setTimeout(() => {
                    wrapper.parentElement.removeChild(wrapper);
                    if (newDialog === currentDialog) currentDialog = undefined;
                })
            }
            return newDialog.promise.finally(() => cleanup());
        });
}

export function hideDialog() {
    if (currentDialog) {
        currentDialog.hide();
        currentDialog = undefined;
    }
}

export interface LoadingDimmerProps {
}

export interface LoadingDimmerState {
    visible?: boolean;
    content?: string;
    loadedId?: string;
    loadedPercentage?: number;
}

export class LoadingDimmer extends React.Component<LoadingDimmerProps, LoadingDimmerState> {

    constructor(props: LoadingDimmerProps) {
        super(props);
        this.state = {
            visible: true
        }
    }

    hide() {
        this.setState({
            visible: false,
            loadedId: undefined,
            content: undefined,
            loadedPercentage: undefined,
        });
    }

    show(id: string, content: string, percentComplete?: number) {
        this.setState({
            visible: true,
            loadedId: id,
            content: content,
            loadedPercentage: percentComplete,
        });
    }

    setPercentLoaded(percentage: number) {
        this.setState({
            loadedPercentage: percentage,
        });
    }

    currentlyLoading() {
        return this.state.loadedId;
    }

    isVisible() {
        return this.state.visible;
    }

    render() {
        const { visible, content, loadedPercentage } = this.state;
        if (!visible) return <div />;
        const hc = core.getHighContrastOnce();
        return <sui.Dimmer isOpen={true} active={visible} closable={false}>
            <sui.Loader className={`large main msg no-select ${hc ? "hc" : ""}`} aria-live="assertive">
                {content}
                {loadedPercentage !== undefined && <ProgressBar value={loadedPercentage} />}
            </sui.Loader>
        </sui.Dimmer>;
    }
}
