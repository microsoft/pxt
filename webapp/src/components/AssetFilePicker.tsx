import * as React from "react";
import { Modal, ModalAction } from "../../../react-common/components/controls/Modal";
import { FieldEditorComponent } from "../blocklyFieldView";
import { errorNotification } from "../core";

interface AssetFilePickerProps {
}

export class AssetFilePicker extends React.Component<AssetFilePickerProps> implements FieldEditorComponent<pxt.JsonAsset> {
    protected asset: pxt.JsonAsset;
    protected closeCallback: () => void;

    init(value: pxt.JsonAsset, close: () => void, options?: any): void {
        this.asset = value;
        this.closeCallback = close;
    }

    getValue(): pxt.JsonAsset {
        return this.asset;
    }

    getPersistentData(): any {
        return undefined;
    }

    restorePersistentData(value: any): void {
    }

    onResize?: () => void;
    loadJres?: (jres: string) => void;
    getJres?: () => string;
    shouldPreventHide?: () => boolean;

    protected onFileSelected = async (file?: File) => {
        if (!file) {
            this.closeCallback?.();
            return;
        }

        const name = file.name;
        const text = await file.text();

        let data: any;

        try {
            data = JSON.parse(text);
        }
        catch (e) {
            errorNotification(lf("The file {0} is not a valid JSON file.", name));
        }

        if (data) {
            this.asset.fileName = name;
            this.asset.data = JSON.parse(text);
        }
        this.closeCallback?.();
    }

    render() {
        return (
            <AssetFilePickerView
                {...this.props}
                onDone={this.onFileSelected}
            />
        );
    }
}


interface AssetFilePickerViewProps extends AssetFilePickerProps {
    onDone: (file?: File) => void;
}

const AssetFilePickerView = (props: AssetFilePickerViewProps) => {
    const { onDone } = props;

    const [file, setFile] = React.useState<File | null>(null);

    const actions: ModalAction[] = [
        {
            label: lf("Import"),
            className: "primary",
            disabled: !file,
            onClick: () => {
                onDone(file);
            }
        },
        {
            label: lf("Cancel"),
            className: "secondary",
            onClick: () => onDone()
        }
    ]

    return (
        <Modal
            title={lf("Import File")}
            onClose={onDone}
            actions={actions}
        >
            <div>
                <p>{lf("Click the button below to import a .json file or drag and drop it here.")}</p>
                <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        setFile(file);
                    }}
                />
            </div>

        </Modal>
    );
}