/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Checkbox } from "react-common/components/controls/Checkbox";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
import { addCriteriaToRubric } from "../transforms/addCriteriaToRubric";
import { CatalogCriteria } from "../types/criteria";

interface IProps {}

const CatalogModal: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [ checkedCriteriaIds, setCheckedCriteria ] = useState<Set<string>>(new Set<string>());

    function handleCriteriaSelectedChange(criteria: CatalogCriteria, newValue: boolean) {
        const newSet = new Set(checkedCriteriaIds);
        if (newValue) {
            newSet.add(criteria.id);
        } else {
            newSet.delete(criteria.id); // Returns false if criteria.id is not in the set, can be safely ignored.
        }
        setCheckedCriteria(newSet);
    }

    function isCriteriaSelected(criteriaId: string): boolean {
        return checkedCriteriaIds.has(criteriaId);
    }

    function handleAddSelectedClicked() {
        addCriteriaToRubric([...checkedCriteriaIds]);
        closeModal();
    }

    function closeModal() {
        hideModal("catalog-display");

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
            onClick: handleAddSelectedClicked,
        },
    ]

    return teacherTool.modal === "catalog-display" ? (
        <Modal className="catalog-modal" title={lf("Select the criteria you'd like to include")} onClose={closeModal} actions={modalActions}>
            {teacherTool.catalog?.map(criteria => {
                return criteria?.template && (
                        <Checkbox
                            id={`checkbox_${criteria.id}`}
                            key={criteria.id}
                            className="catalog-item"
                            label={criteria.template}
                            onChange={(newValue) => handleCriteriaSelectedChange(criteria, newValue)}
                            isChecked={isCriteriaSelected(criteria.id)} />
                );
            })}
        </Modal>
    ) : null;
};

export default CatalogModal;
