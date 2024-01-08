namespace pxt.blocks {
    export class Rubric {
        criteria: RubricCriteria[];

        constructor(criteria: RubricCriteria[]) {
            this.criteria = criteria;
        }
    }

    export function parseRubric(rubric: string): Rubric {
        let rubricObj;
        try {
            rubricObj = JSON.parse(rubric);
        } catch (e) {
            console.error(`Error parsing rubric! ${e}`);
            return null;
        }

        if (!rubricObj.criteria) {
            console.error(`No criteria found in rubric`);
            return null;
        }

        const criteria: RubricCriteria[] = rubricObj.criteria.map((c: CriteriaData) => {
            return getCriteria(c);
        }).filter((r: RubricCriteria) => !!r);

        return new Rubric(criteria);
    }
}