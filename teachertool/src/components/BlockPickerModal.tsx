import React, { useContext, useMemo, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
import { loadAllBlocksAsync } from "../transforms/loadAllBlocksAsync";
import { MenuDropdown, MenuItem } from "react-common/components/controls/MenuDropdown";
import { LazyImage } from "react-common/components/controls/LazyImage";
import { BlockData, CategoryData } from "../types";
import { loadBlockImagesAsync } from "../transforms/loadBlockImagesAsync";
import css from "./styling/BlockPickerModal.module.scss";

interface BlockPickerCategoryProps {
    category: CategoryData;
    onBlockSelected: (blockId: BlockData) => void;
}
const BlockPickerCategory: React.FC<BlockPickerCategoryProps> = ({ category, onBlockSelected }) => {
    function blockSelected(block: BlockData) {
        onBlockSelected?.(block);
    }

    function getMenuItemForBlock(block: BlockData) {
        return {
            title: block.id,
            label: block.imageUri ? <LazyImage src={block.imageUri} alt={block.id} /> : block.id,
            onClick: () => blockSelected(block),
        } as MenuItem;
    }

    function handleExpansionChanged(expanded: boolean) {
        if (expanded) {
            // We do not need to block on this.
            /* await */ loadBlockImagesAsync(category);
        }
    }

    // Set left border color based on category.color.
    const bkgStyle = category.color ? { color: category.color, borderLeftColor: category.color } : {};
    return category.blocks && category.blocks.length > 0 ? (
        <div style={bkgStyle} className={css["category-container"]}>
            <MenuDropdown
                title={category.name}
                label={pxt.Util.capitalize(category.name)}
                items={category.blocks.map(getMenuItemForBlock)}
                onExpansionChanged={handleExpansionChanged}
            />
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
                            onBlockSelected={block => setSelectedBlockId(block.id)}
                        />
                    );
                })}
            {!teacherTool.toolboxCategories && <div className="common-spinner" />}
        </Modal>
    ) : null;
};
