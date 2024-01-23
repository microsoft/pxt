/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Checkbox } from "react-common/components/controls/Checkbox";
import { Modal } from "react-common/components/controls/Modal";
import { hideCatalogModal } from "../transforms/hideCatalogModal";
import { addCriteriaToRubric } from "../transforms/addCriteriaToRubric";

interface IProps {}

const CatalogModal: React.FC<IProps> = ({}) => {
    const { state: teacherTool, dispatch } = useContext(AppStateContext);
    const [ checkedCriteriaIds, setCheckedCriteria ] = useState<string[]>([]);

    function handleCheckboxChange(criteria: pxt.blocks.CatalogCriteria, newValue: boolean) {
        if (newValue && !checkedCriteriaIds.includes(criteria.id)) {
            setCheckedCriteria(checkedCriteriaIds.concat(criteria.id));
        } else if (!newValue && checkedCriteriaIds.includes(criteria.id)) {
            setCheckedCriteria(checkedCriteriaIds.filter(id => id !== criteria.id));
        }
    }

    function isCheckboxChecked(criteriaId: string): boolean {
        return checkedCriteriaIds.includes(criteriaId);
    }

    function handleDoneClicked() {
        addCriteriaToRubric(checkedCriteriaIds)
        closeModal();
    }

    function closeModal() {
        hideCatalogModal();

        // Clear for next open.
        setCheckedCriteria([]);
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
