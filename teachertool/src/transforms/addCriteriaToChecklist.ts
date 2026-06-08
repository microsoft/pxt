import { stateAndDispatch } from "../state";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { logDebug, logError } from "../services/loggingService";
import { CatalogCriteria, CriteriaInstance, CriteriaParameterValue } from "../types/criteria";
import { nanoid } from "nanoid";
import { ErrorCode } from "../types/errorCode";
import { setChecklist } from "./setChecklist";
import { Ticks } from "../constants";

function getAiQuestionCatalogCriteria(catalog: CatalogCriteria[] | undefined): CatalogCriteria | undefined {
    return catalog?.find(c => (c.use || "").toLocaleLowerCase() === "ai_question");
}

export function addCriteriaToChecklist(catalogCriteriaIds: string[]) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    // Create instances for each of the catalog criteria.
    const newChecklist = {
        ...teacherTool.checklist,
        criteria: [...(teacherTool.checklist.criteria ?? [])],
    };

    for (const catalogCriteriaId of catalogCriteriaIds) {
        const catalogCriteria = getCatalogCriteriaWithId(catalogCriteriaId);
        if (!catalogCriteria) {
            logError(ErrorCode.addingMissingCriteria, "Attempting to add criteria with unrecognized id", {
                id: catalogCriteriaId,
            });
            continue;
        }

        const params = catalogCriteria.params?.map(
            param =>
                ({
                    name: param.name,
                    value: param.default,
                } as CriteriaParameterValue)
        );

        const instanceId = nanoid();

        logDebug(`Adding criteria with Catalog ID '${catalogCriteriaId}' and Instance ID '${instanceId}'`);
        const criteriaInstance = {
            catalogCriteriaId,
            instanceId,
            params,
        } as CriteriaInstance;

        newChecklist.criteria.push(criteriaInstance);
    }

    setChecklist(newChecklist);

    pxt.tickEvent(Ticks.AddCriteria, {
        ids: JSON.stringify(catalogCriteriaIds),
    });
}

export function addAiQuestionCriteriaToChecklist(questions: string[]) {
    const { state: teacherTool } = stateAndDispatch();

    const aiCriteria = getAiQuestionCatalogCriteria(teacherTool.catalog);
    if (!aiCriteria) {
        logError(ErrorCode.addingMissingCriteria, "Attempting to add AI question criteria without catalog entry");
        return;
    }

    const remaining =
        aiCriteria.maxCount !== undefined
            ? aiCriteria.maxCount - teacherTool.checklist.criteria.filter(i => i.catalogCriteriaId === aiCriteria.id).length
            : undefined;

    if (remaining !== undefined && remaining <= 0) {
        return;
    }

    const normalizedQuestions = questions.map(q => q.trim()).filter(q => !!q);
    const uniqueQuestions = Array.from(new Set(normalizedQuestions));

    const toAdd = remaining !== undefined ? uniqueQuestions.slice(0, remaining) : uniqueQuestions;
    if (toAdd.length === 0) return;

    const newChecklist = {
        ...teacherTool.checklist,
        criteria: [...(teacherTool.checklist.criteria ?? [])],
    };

    for (const question of toAdd) {
        const params: CriteriaParameterValue[] | undefined = aiCriteria.params?.map(param => {
            const value = (param.name || "").toLocaleLowerCase() === "question" ? question : param.default;
            return {
                name: param.name,
                value,
            } as CriteriaParameterValue;
        });

        const instanceId = nanoid();

        logDebug(`Adding AI question criteria with Catalog ID '${aiCriteria.id}' and Instance ID '${instanceId}'`);
        const criteriaInstance: CriteriaInstance = {
            catalogCriteriaId: aiCriteria.id,
            instanceId,
            params,
        };

        newChecklist.criteria.push(criteriaInstance);
    }

    setChecklist(newChecklist);

    pxt.tickEvent(Ticks.AddCriteria, {
        ids: JSON.stringify([aiCriteria.id]),
    });
}
