import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { Modal } from "../../../../react-common/components/controls/Modal";

export interface BackpackAssetChoice {
    fieldName: string;
    label: string;
    name?: string;
    previewURI?: string;
}

export interface BackpackAssetChooserProps {
    choices: BackpackAssetChoice[];
    onSelect: (fieldName: string) => void;
    onCancel: () => void;
}

export function BackpackAssetChooser(props: BackpackAssetChooserProps): JSX.Element {
    const { choices, onSelect, onCancel } = props;

    return (
        <Modal
            title={lf("Choose an asset")}
            className="backpack-asset-chooser"
            ariaDescribedBy="backpack-asset-chooser-description"
            onClose={onCancel}
            actions={[{
                label: lf("Cancel"),
                className: "neutral",
                onClick: onCancel
            }]}
        >
            <p id="backpack-asset-chooser-description">
                {lf("Choose which asset to save to Backpack. The block and its other assets will not be copied.")}
            </p>
            <ul className="backpack-asset-choices">
                {choices.map(choice => (
                    <li key={choice.fieldName}>
                        <Button
                            type="button"
                            className="backpack-asset-choice"
                            title={lf("Save {0} to Backpack", choice.label)}
                            ariaLabel={lf("Save {0} to Backpack", choice.label)}
                            onClick={() => onSelect(choice.fieldName)}
                        >
                            {choice.previewURI
                                ? <img
                                    src={choice.previewURI}
                                    alt=""
                                />
                                : <i
                                    className="icon image"
                                    aria-hidden="true"
                                />}
                            <span className="backpack-asset-choice-label">{choice.label}</span>
                            {choice.name && choice.name !== choice.label
                                && <span className="backpack-asset-choice-name">{choice.name}</span>}
                        </Button>
                    </li>
                ))}
            </ul>
        </Modal>
    );
}
