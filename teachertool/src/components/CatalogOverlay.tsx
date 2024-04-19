import { useContext, useMemo, useState } from "react";
import css from "./styling/CatalogOverlay.module.scss";
import { AppStateContext } from "../state/appStateContext";
import { addCriteriaToRubric } from "../transforms/addCriteriaToRubric";
import { CatalogCriteria } from "../types/criteria";
import { getCatalogCriteria } from "../state/helpers";
import { ReadOnlyCriteriaDisplay } from "./ReadonlyCriteriaDisplay";
import { Strings } from "../constants";
import { Button } from "react-common/components/controls/Button";
import { getReadableCriteriaTemplate } from "../utils";
import { setCatalogOpen } from "../transforms/setCatalogOpen";
import { classList } from "react-common/components/util";
import { removeCriteriaFromRubric } from "../transforms/removeCriteriaFromRubric";
import { ErrorCode } from "../types/errorCode";
import { logError } from "../services/loggingService";

interface CatalogOverlayProps {}
export const CatalogOverlay: React.FC<CatalogOverlayProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const criteria = useMemo<CatalogCriteria[]>(
        () => getCatalogCriteria(teacherTool),
        [teacherTool.catalog, teacherTool.rubric]
    );

    function handleCriteriaClick(criteria: CatalogCriteria, isAdding: boolean) {
        if (isAdding) {
            addCriteriaToRubric([criteria.id]);
        } else {
            const instances = teacherTool.rubric.criteria.filter(c => c.catalogCriteriaId === criteria.id);
            if (instances.length !== 1) {
                logError(
                    ErrorCode.unexpectedInstanceCount,
                    `Unexpected number of instances with catalog criteria id ${criteria.id} when trying to remove`,
                    { actualCount: instances.length }
                );
            }
            removeCriteriaFromRubric(instances[0]);
        }
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

    interface CatalogItemLabelProps {
        catalogCriteria: CatalogCriteria;
        allowsMultiple: boolean;
        hasExistingInstances: boolean;
    }
    const CatalogItemLabel: React.FC<CatalogItemLabelProps> = ({
        catalogCriteria,
        allowsMultiple,
        hasExistingInstances,
    }) => {
        const canAddMore = allowsMultiple || !hasExistingInstances;
        return (
            <div className={css["catalog-item-label"]}>
                <div className={css["controls"]}>
                    <i
                        className={classList(
                            allowsMultiple
                                ? "fas fa-plus"
                                : hasExistingInstances
                                ? "fas fa-check-circle"
                                : "far fa-check-circle",
                            !canAddMore ? css["is-checked"] : undefined
                        )}
                        title={canAddMore ? lf("Add To Checklist") : lf("Already in checklist")}
                    />
                    {allowsMultiple && hasExistingInstances && <i className="fas fa-minus" /> /* TODO thsparks: no buttons inside buttons */ }
                </div>
                <ReadOnlyCriteriaDisplay catalogCriteria={catalogCriteria} showDescription={true} />
            </div>
        );
    };

    const CatalogList: React.FC = () => {
        return (
            <div className={css["catalog-list"]}>
                {criteria.map(c => {
                    const allowsMultiple = c.params !== undefined && c.params.length !== 0; // TODO add a json flag for this
                    const hasExistingInstances = teacherTool.rubric.criteria.some(i => i.catalogCriteriaId === c.id);
                    return (
                        c.template && (
                            <Button
                                id={`criteria_${c.id}`}
                                title={getReadableCriteriaTemplate(c)}
                                key={c.id}
                                className={css["catalog-item"]}
                                label={
                                    <CatalogItemLabel
                                        catalogCriteria={c}
                                        allowsMultiple={allowsMultiple}
                                        hasExistingInstances={hasExistingInstances}
                                    />
                                }
                                onClick={() => handleCriteriaClick(c, allowsMultiple || !hasExistingInstances)}
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
