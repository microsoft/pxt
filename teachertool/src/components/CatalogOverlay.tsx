import React, { useContext, useMemo, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { addCriteriaToRubric } from "../transforms/addCriteriaToRubric";
import { CatalogCriteria } from "../types/criteria";
import { criteriaIsSelectable, getCatalogCriteria } from "../state/helpers";
import { ReadOnlyCriteriaDisplay } from "./ReadonlyCriteriaDisplay";
import { Strings } from "../constants";
import { Button } from "react-common/components/controls/Button";
import { getReadableCriteriaTemplate } from "../utils";
import { setCatalogOpen } from "../transforms/setCatalogOpen";
import css from "./styling/CatalogOverlay.module.scss";

interface CatalogOverlayProps {}
export const CatalogOverlay: React.FC<CatalogOverlayProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const criteria = useMemo<CatalogCriteria[]>(
        () => getCatalogCriteria(teacherTool),
        [teacherTool.catalog, teacherTool.rubric]
    );

    function handleCriteriaClick(criteria: CatalogCriteria) {
        addCriteriaToRubric([criteria.id]);
    }

    function closeOverlay() {
        setCatalogOpen(false);
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
                {criteria.map(c => {
                    return (
                        c.template && (
                            <Button
                                id={`criteria_${c.id}`}
                                title={getReadableCriteriaTemplate(c)}
                                key={c.id}
                                className={css["catalog-item"]}
                                label={<ReadOnlyCriteriaDisplay catalogCriteria={c} showDescription={true} />}
                                onClick={() => handleCriteriaClick(c)}
                                disabled={!criteriaIsSelectable(teacherTool, c)}
                            />
                        )
                    );
                })}
            </div>
        );
    };

    return teacherTool.catalogOpen ? (
        <div className={css["catalog-overlay"]}>
            <div className={css["catalog-content-container"]}>
                <CatalogHeader />
                <CatalogList />
            </div>
        </div>
    ) : null;
};
