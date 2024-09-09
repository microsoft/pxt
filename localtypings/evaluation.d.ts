namespace pxt.blocks {
    export interface EvaluationResult {
        result?: boolean;
        notes?: string;
        executionSuccess: boolean;
        executionErrorMsg?: string;
    }
}
