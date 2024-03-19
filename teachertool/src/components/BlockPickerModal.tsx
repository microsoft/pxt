import { useContext, useMemo, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
import css from "./styling/BlockPickerModal.module.scss";
import { loadAllBlocksAsync } from "../transforms/loadAllBlocksAsync";

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

    if (!teacherTool.allBlocks) {
        loadAllBlocksAsync();
    }
    return teacherTool.modal === "block-picker" ? (
        <Modal
            className={css["block-picker-modal"]}
            title={lf("Select block")}
            onClose={closeModal}
            actions={modalActions}
        >
            {teacherTool.allBlocks && Object.keys(teacherTool.allBlocks).map(category => {
                const blocksInCategory = teacherTool.allBlocks![category];
                return blocksInCategory && blocksInCategory.length > 0 ? `${category}: ${blocksInCategory.length}` : null;
            })}
            {!teacherTool.allBlocks && <div className="common-spinner" />}
        </Modal>
    ) : null;
}
