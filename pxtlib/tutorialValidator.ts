namespace pxt.tutorial {

    export interface TutorialRuleStatus {
        RuleName: string;
        RuleTurnOn: boolean;
        RuleStatus: boolean;
        RuleMessage: string;
    }

    /**
    * Check the user's code to the tutorial and returns a Tutorial status of the user's code
    * @param tutorial the tutorial 
    * @param workspaceBlocks Blockly blocks used of workspace
    * @param blockinfo Typescripts of the workspace
    * @return A TutorialRuleStatus
    */
    export async function validate(tutorial: TutorialOptions, workspaceBlocks: Blockly.Block[], blockinfo: pxtc.BlocksInfo): Promise<TutorialRuleStatus[]> {

        const listOfRules = tutorial.tutorialValidationRules;
        let TutorialRuleStatuses: TutorialRuleStatus[] = classifyRules(listOfRules);

        // Check to if there are rules to valdiate and to see if there are blocks are in the workspace to compare to
        if (TutorialRuleStatuses.length > 0 && workspaceBlocks.length > 0) {
            // User blocks
            const userBlockTypes = workspaceBlocks.map(b => b.type);
            const usersBlockUsed = blockCount(userBlockTypes);
            // Tutorial blocks
            const { tutorialStepInfo, tutorialStep } = tutorial;
            const step = tutorialStepInfo[tutorialStep];
            const indexdb = await tutorialBlockList(tutorial, step);
            const tutorialBlockUsed = extractBlockSnippet(tutorial, indexdb);
            for (let i = 0; i < TutorialRuleStatuses.length; i++) {
                let currRuleToValidate = TutorialRuleStatuses[i];
                const ruleName = TutorialRuleStatuses[i].RuleName;
                switch (ruleName) {
                    case "validateNumberOfBlocks":
                        const ruleStatus = validateNumberOfBlocks(usersBlockUsed, tutorialBlockUsed);
                        currRuleToValidate.RuleStatus = ruleStatus;
                        break;
                    case "placeholder":
                        break;
                }
            }
        }
        return TutorialRuleStatuses;
    }

    /**
    * Gives each rule from the mmarkdown file a TutorialRuleStatus
    * @param listOfRules a map of rules from makrdown file 
    * @return An array of TutorialRuleStatus
    */
    function classifyRules(listOfRules: pxt.Map<boolean>): TutorialRuleStatus[] {
        let listOfRuleStatuses: TutorialRuleStatus[] = [];
        const ruleNames: string[] = Object.keys(listOfRules);
        for (let i = 0; i < ruleNames.length; i++) {
            const currRule: string = ruleNames[i];
            const ruleVal: boolean = listOfRules[currRule];
            const currRuleStatus: TutorialRuleStatus = { RuleName: currRule, RuleTurnOn: ruleVal, RuleStatus: false, RuleMessage: ""};
            listOfRuleStatuses.push(currRuleStatus);
        }
        return listOfRuleStatuses;
    }

    /**
    * Loops through an array of blocks and returns a map of blocks and the count for that block
    * @param arr a string array of blocks
    * @return a map <Block type, frequency>
    */
    function blockCount(arr: string[]): pxt.Map<number> {
        let frequencyMap: pxt.Map<number> = {};
        for (let i: number = 0; i < arr.length; i++) {
            if (!frequencyMap[arr[i]]) {
                frequencyMap[arr[i]] = 0;
            }
            frequencyMap[arr[i]] = frequencyMap[arr[i]] + 1;
        }
        return frequencyMap;
    }

    /**
    * Returns information from index database
    * @param tutorial Typescripts of the workspace
    * @param step the current tutorial step
    * @return indexdb's tutorial code snippets
    */
    function tutorialBlockList(tutorial: TutorialOptions, step: TutorialStepInfo): Promise<pxt.Map<pxt.Map<number>> | undefined> {
        return pxt.BrowserUtils.tutorialInfoDbAsync()
            .then(db => db.getAsync(tutorial.tutorial, tutorial.tutorialCode)
                .then(entry => {
                    if (entry?.snippets) {
                        return Promise.resolve(entry.snippets);
                    }
                    else {
                        return Promise.resolve(undefined);
                    }
                })
            );
    }
    /**
    * Extract the tutorial blocks used from code snippet
    * @param tutorial tutorial info
    * @param indexdb database from index
    * @return the tutorial blocks used for the current step
    */
    function extractBlockSnippet(tutorial: TutorialOptions, indexdb: pxt.Map<pxt.Map<number>>) {
        const { tutorialStepInfo, tutorialStep } = tutorial;
        const body = tutorial.tutorialStepInfo[tutorialStep].hintContentMd;
        let hintCode = "";

        body.replace(/((?!.)\s)+/g, "\n").replace(/``` *(block|blocks)\s*\n([\s\S]*?)\n```/gmi, function (m0, m1, m2) {
            hintCode = `{\n${m2}\n}`;
            return "";
        });

        const snippetStepKey = pxt.BrowserUtils.getTutorialCodeHash([hintCode]);
        const blockMap = indexdb[snippetStepKey];

        return blockMap;
    }

    /**
    * Checks if the all required number of blocks for a tutorial step is used, returns a boolean
    * @param usersBlockUsed an array of strings
    * @param tutorialBlockUsed the next available index
    * @return true if all the required tutorial blocks were used, false otherwise
    */
    function validateNumberOfBlocks(usersBlockUsed: pxt.Map<number>, tutorialBlockUsed: pxt.Map<number>): boolean {
        const userBlockKeys = Object.keys(usersBlockUsed);
        const tutorialBlockKeys = Object.keys(tutorialBlockUsed);
        if (userBlockKeys.length < tutorialBlockKeys.length) { // user doesn't have enough blocks
            return false;
        }
        for (let i: number = 0; i < tutorialBlockKeys.length; i++) {
            let tutorialBlockKey = tutorialBlockKeys[i];
            if (!usersBlockUsed[tutorialBlockKey]) { // user did not use a specific block
                return false;
            }
            if (usersBlockUsed[tutorialBlockKey] < tutorialBlockUsed[tutorialBlockKey]) { // user did not use enough of a certain block
                return false;
            }
        }
        return true;
    }
}