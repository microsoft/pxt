/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Checkbox } from "react-common/components/controls/Checkbox";
import { Modal } from "react-common/components/controls/Modal";
import { hideCatalogModal } from "../transforms/hideCatalogModal";
import { addCriteriaToRubric } from "../transforms/addCriteriaToRubric";

interface IProps {}

const CatalogModal: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [ checkedCriteriaIds, setCheckedCriteria ] = useState<Set<string>>(new Set<string>());

    function handleCheckboxChange(criteria: pxt.blocks.CatalogCriteria, newValue: boolean) {
        const newSet = new Set(checkedCriteriaIds);
        if (newValue) {
            newSet.add(criteria.id);
        } else {
            newSet.delete(criteria.id); // Returns false if criteria.id is not in the set, can be safely ignored.
        }
        setCheckedCriteria(newSet);
    }

    function isCheckboxChecked(criteriaId: string): boolean {
        return checkedCriteriaIds.has(criteriaId);
    }

    function handleDoneClicked() {
        addCriteriaToRubric([...checkedCriteriaIds])
        closeModal();
    }

    function closeModal() {
        hideCatalogModal();

        // Clear for next open.
        setCheckedCriteria(new Set<string>());
    }

    const modalActions = [
        {
            label: lf("Cancel"),
            className: "secondary",
            onClick: closeModal,
        },
        {
            label: lf("Add Selected"),
            className: "primary",
            onClick: handleDoneClicked,
        },
    ]

    return teacherTool.modal ? (
        <Modal className="catalog-modal" title={lf("Select the criteria you'd like to include")} onClose={closeModal} actions={modalActions}>
            <div className="catalog-container" title={lf("Select the criteria you'd like to include")}>
                {teacherTool.catalog?.map(criteria => {
                    return criteria?.template && (
                            <Checkbox
                                id={`chk${criteria.id}`}
                                className="catalog-item"
                                label={criteria.template}
                                onChange={(newValue) => handleCheckboxChange(criteria, newValue)}
                                isChecked={isCheckboxChecked(criteria.id)} />
                    );
                })}
            </div>
        </Modal>
    ) : null;
};

export default CatalogModal;
