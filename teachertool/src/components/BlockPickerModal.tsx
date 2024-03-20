import React, { useContext, useMemo, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
import { loadAllBlocksAsync } from "../transforms/loadAllBlocksAsync";
import { LazyImage } from "react-common/components/controls/LazyImage";
import { loadBlockImagesAsync } from "../transforms/loadBlockImagesAsync";
import { FocusList } from "react-common/components/controls/FocusList";
import { Button } from "react-common/components/controls/Button";
import css from "./styling/BlockPickerModal.module.scss";
import { classList } from "react-common/components/util";

interface BlockPickerCategoryProps {
    category: pxt.editor.ToolboxCategoryDefinition;
    onBlockSelected: (blockId: pxt.editor.ToolboxBlockDefinition) => void;
}
const BlockPickerCategory: React.FC<BlockPickerCategoryProps> = ({ category, onBlockSelected }) => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [expanded, setExpanded] = useState(false);

    function blockSelected(block: pxt.editor.ToolboxBlockDefinition) {
        onBlockSelected?.(block);
    }

    function getBlockButton(block: pxt.editor.ToolboxBlockDefinition) {
        const imageUri = block.blockId ? teacherTool.blockImageCache[block.blockId] : undefined;

        return (
            <Button
                className={css["block-button"]}
                title={block.name}
                label={imageUri ? <LazyImage src={imageUri} alt={block.name} /> : block.name}
                onClick={() => blockSelected(block)}
            />
        );
    }

    function handleClick() {
        if (!expanded) {
            // We do not need to block on this.
            /* await */ loadBlockImagesAsync(category);
        }

        setExpanded(!expanded);
    }

    // TODO thsparks : aria roles?

    const categoryColorsStyle = category.color ? { color: category.color, borderLeftColor: category.color } : {};
    return category.name && category.blocks && category.blocks.length > 0 ? (
        // Need bottom-border div to keep the bottom border from intersecting with the left border on category-container.
        <div className={css["bottom-border"]}>
            <div className={css["category-container"]} style={categoryColorsStyle}>
                <Button
                    className={classList(css["category-button"], expanded ? css["bottom-border"] : undefined)}
                    title={category.name}
                    label={pxt.Util.capitalize(category.name)}
                    onClick={handleClick}
                    style={categoryColorsStyle}
                />
                {expanded && (
                    <FocusList role={"listbox"} className={css["category-block-list"]}>
                        {category.blocks.map(getBlockButton)}
                    </FocusList>
                )}
            </div>
        </div>
    ) : null;
};

export interface BlockPickerModalProps {}
export const BlockPickerModal: React.FC<BlockPickerModalProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [selectedBlockId, setSelectedBlockId] = useState<string | undefined>(undefined);

    // TODO thsparks : need to store target instance id and parameter in state?
    function closeModal() {
        hideModal();

        // Clear for next open.
        setSelectedBlockId(undefined);
    }

    function handleConfirmClicked() {
        if (selectedBlockId) {
            // onSelectionConfirmed(selectedBlockId);
        }

        closeModal();
    }

    const modalActions = [
        {
            label: lf("Cancel"),
            className: "secondary",
            onClick: closeModal,
        },
        {
            label: lf("Confirm"),
            className: "primary",
            onClick: handleConfirmClicked,
        },
    ];

    if (!teacherTool.toolboxCategories) {
        loadAllBlocksAsync();
    }
    return teacherTool.modal === "block-picker" ? (
        <Modal
            className={css["block-picker-modal"]}
            title={lf("Select block")}
            onClose={closeModal}
            actions={modalActions}
        >
            {teacherTool.toolboxCategories &&
                Object.values(teacherTool.toolboxCategories).map(category => {
                    return (
                        <BlockPickerCategory
                            category={category}
                            onBlockSelected={block => setSelectedBlockId(block.blockId)}
                        />
                    );
                })}
            {!teacherTool.toolboxCategories && <div className="common-spinner" />}
        </Modal>
    ) : null;
};
