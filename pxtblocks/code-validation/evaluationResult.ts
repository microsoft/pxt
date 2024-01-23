namespace pxt.blocks {

  export interface CriteriaResult {
    passed: boolean;
    message: string;
  }

  export interface EvaluationResult {
    criteriaResults: pxt.Map<CriteriaResult>;
  }
}
