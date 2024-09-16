import { logError } from "../services/loggingService";
import { CatalogCriteria, CriteriaInstance } from "../types/criteria";
import { ErrorCode } from "../types/errorCode";
import { Checklist } from "../types/checklist";
import { stateAndDispatch } from "./appStateContext";
import { AppState } from "./state";
import { Strings } from "../constants";
import { CriteriaParameter } from "../types/criteriaParameters";

export function getCatalogCriteriaWithId(id: string): CatalogCriteria | undefined {
    const { state } = stateAndDispatch();
    return state.catalog?.find(c => c.id === id);
}

export function getCriteriaInstanceWithId(state: AppState, id: string): CriteriaInstance | undefined {
    return state.checklist.criteria.find(c => c.instanceId === id);
}

export function getParameterDefinition(catalogCriteriaId: string, paramName: string): CriteriaParameter | undefined {
    const catalogCriteria = getCatalogCriteriaWithId(catalogCriteriaId);
    return catalogCriteria?.params?.find(p => p.name === paramName);
}

export function getParameterValue(state: AppState, instanceId: string, paramName: string): string | undefined {
    const instance = getCriteriaInstanceWithId(state, instanceId);
    return instance?.params?.find(p => p.name === paramName)?.value;
}

export function verifyCriteriaInstanceIntegrity(instance: CriteriaInstance) {
    const catalogCriteria = getCatalogCriteriaWithId(instance.catalogCriteriaId);

    if (!catalogCriteria) {
        throw new Error("Unrecognized catalog id in criteria instance.");
    }

    for (const param of instance.params ?? []) {
        if (!catalogCriteria?.params?.find(p => p.name === param.name)) {
            throw new Error("Unrecognized parameter in criteria instance.");
        }
    }
}

export function verifyChecklistIntegrity(checklist: Checklist): {
    valid: boolean;
    validCriteria: CriteriaInstance[];
    invalidCriteria: CriteriaInstance[];
} {
    if (!checklist || !checklist.criteria) {
        return { valid: false, validCriteria: [], invalidCriteria: [] };
    }

    const validCriteria: CriteriaInstance[] = [];
    const invalidCriteria: CriteriaInstance[] = [];
    for (const criteria of checklist.criteria) {
        try {
            verifyCriteriaInstanceIntegrity(criteria);
            validCriteria.push(criteria);
        } catch (error) {
            logError(ErrorCode.unableToLoadCriteriaInstance, error);
            invalidCriteria.push(criteria);
        }
    }
    return { valid: invalidCriteria.length === 0, validCriteria, invalidCriteria };
}

export function isProjectLoaded(state: AppState): boolean {
    return !!state.projectMetadata;
}

export function isChecklistLoaded(state: AppState): boolean {
    return !!(state.checklist.criteria.length || state.checklist.name);
}

export function getSafeProjectName(state: AppState): string | undefined {
    if (state.projectMetadata) {
        return state.projectMetadata.name ?? Strings.UntitledProject;
    }
}

export function getSafeChecklistName(state: AppState): string | undefined {
    return state.checklist.name || Strings.UntitledChecklist;
}

export function getCatalogCriteria(state: AppState): CatalogCriteria[] {
    return state.catalog?.filter(c => !c.hideInCatalog) ?? [];
}
