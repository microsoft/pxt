import { useContext, useMemo, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Checkbox } from "react-common/components/controls/Checkbox";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
import { addCriteriaToRubric } from "../transforms/addCriteriaToRubric";
import { CatalogCriteria } from "../types/criteria";
import { getSelectableCatalogCriteria } from "../state/helpers";
import { ReadOnlyCriteriaDisplay } from "./ReadonlyCriteriaDisplay";
import { Strings } from "../constants";
import css from "./styling/CatalogModal.module.scss";

interface CatalogOverlayProps {}
export const CatalogOverlay: React.FC<CatalogOverlayProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [checkedCriteriaIds, setCheckedCriteria] = useState<Set<string>>(new Set<string>());

    const selectableCriteria = useMemo<CatalogCriteria[]>(
        () => getSelectableCatalogCriteria(teacherTool),
        [teacherTool.catalog, teacherTool.rubric]
    );

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
        hideModal();

        // Clear for next open.
        setCheckedCriteria(new Set<string>());
    }

    const modalActions = [
        {
            label: Strings.Cancel,
            className: "secondary",
            onClick: closeModal,
        },
        {
            label: Strings.AddSelected,
            className: "primary",
            onClick: handleAddSelectedClicked,
        },
    ];

    return teacherTool.modalOptions?.modal === "catalog-display" ? (
        <Modal
            className={css["catalog-modal"]}
            title={lf("Select the criteria you'd like to include")}
            onClose={closeModal}
            actions={modalActions}
        >
            {selectableCriteria.map(criteria => {
                return (
                    criteria?.template && (
                        <Checkbox
                            id={`checkbox_${criteria.id}`}
                            key={criteria.id}
                            className={css["catalog-item"]}
                            label={<ReadOnlyCriteriaDisplay catalogCriteria={criteria} showDescription={true} />}
                            onChange={newValue => handleCriteriaSelectedChange(criteria, newValue)}
                            isChecked={isCriteriaSelected(criteria.id)}
                        />
                    )
                );
            })}
        </Modal>
    ) : null;
};
