import { useContext, useMemo } from "react";
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
import css from "./styling/CatalogOverlay.module.scss";

interface CatalogOverlayProps {}
export const CatalogOverlay: React.FC<CatalogOverlayProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const criteria = useMemo<CatalogCriteria[]>(
        () => getCatalogCriteria(teacherTool),
        [teacherTool.catalog, teacherTool.rubric]
    );

    function closeOverlay() {
        setCatalogOpen(false);
    }

    const CatalogHeader: React.FC = () => {
        return (
            <div className={css["header"]}>
                <span className={css["title"]}>{Strings.SelectCriteriaDescription}</span>
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
        existingInstanceCount: number;
    }
    const CatalogItemLabel: React.FC<CatalogItemLabelProps> = ({
        catalogCriteria,
        allowsMultiple,
        existingInstanceCount,
    }) => {
        const canAddMore = allowsMultiple || existingInstanceCount === 0;
        return (
            <div className={css["catalog-item-label"]}>
                <div className={css["action-indicator"]}>
                    {canAddMore ? (
                        <i className={classList("fas fa-plus")} title={Strings.AddToChecklist} />
                    ) : (
                        <span className={css["max-label"]}>{Strings.Max}</span>
                    )}
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
                    const existingInstanceCount = teacherTool.rubric.criteria.filter(
                        i => i.catalogCriteriaId === c.id
                    ).length;
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
                                        existingInstanceCount={existingInstanceCount}
                                    />
                                }
                                onClick={() => addCriteriaToRubric([c.id])}
                                disabled={!allowsMultiple && existingInstanceCount > 0}
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
