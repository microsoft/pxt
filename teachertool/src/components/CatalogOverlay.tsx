import React, { useContext, useMemo, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Checkbox } from "react-common/components/controls/Checkbox";
import { hideModal } from "../transforms/hideModal";
import { addCriteriaToRubric } from "../transforms/addCriteriaToRubric";
import { CatalogCriteria } from "../types/criteria";
import { getSelectableCatalogCriteria } from "../state/helpers";
import { ReadOnlyCriteriaDisplay } from "./ReadonlyCriteriaDisplay";
import { Strings } from "../constants";
import { Button } from "react-common/components/controls/Button";
import css from "./styling/CatalogOverlay.module.scss";
import { getReadableCriteriaTemplate } from "../utils";

interface CatalogOverlayProps {}
export const CatalogOverlay: React.FC<CatalogOverlayProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const selectableCriteria = useMemo<CatalogCriteria[]>(
        () => getSelectableCatalogCriteria(teacherTool),
        [teacherTool.catalog, teacherTool.rubric]
    );

    function handleCriteriaClick(criteria: CatalogCriteria) {
        addCriteriaToRubric([criteria.id]);
    }

    function closeOverlay() {
        // TODO thsparks - no longer modal.
        hideModal();
    }

    const CatalogHeader: React.FC = () => {
        return (
            <div className={css["header"]}>
                <span className={css["title"]}>{lf("Select the criteria you'd like to include")}</span>
                <Button
                    className={css["close-button"]}
                    rightIcon="fas fa-times-circle"
                    onClick={closeOverlay}
                    title={Strings.Close}
                />
            </div>
        );
    };

    const CatalogList: React.FC = () => {
        return (
            <div className={css["catalog-list"]}>
                {selectableCriteria.map(criteria => {
                    return (
                        criteria?.template && (
                            <Button
                                id={`criteria_${criteria.id}`}
                                title={getReadableCriteriaTemplate(criteria)}
                                key={criteria.id}
                                className={css["catalog-item"]}
                                label={<ReadOnlyCriteriaDisplay catalogCriteria={criteria} showDescription={true} />}
                                onClick={() => handleCriteriaClick(criteria)}
                            />
                        )
                    );
                })}
            </div>
        );
    };

    return teacherTool.modalOptions?.modal === "catalog-display" ? (
        <div className={css["catalog-overlay"]}>
            <div className={css["catalog-content-container"]}>
                <CatalogHeader />
                <CatalogList />
            </div>
        </div>
    ) : null;
};
