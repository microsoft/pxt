import { CatalogCriteria } from "../types/criteria";
import { stateAndDispatch } from "./appStateContext";

export function getCatalogCriteriaWithId(id: string): CatalogCriteria | undefined {
    const { state } = stateAndDispatch();
    return state.catalog?.find(c => c.id === id);
}