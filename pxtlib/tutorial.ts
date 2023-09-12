namespace pxt.tutorial {
    const _h2Regex = /^##[^#](.*)$([\s\S]*?)(?=^##[^#]|$(?![\r\n]))/gmi;
    const _h3Regex = /^###[^#](.*)$([\s\S]*?)(?=^###[^#]|$(?![\r\n]))/gmi;

    export function parseTutorial(tutorialmd: string): TutorialInfo {
        const { metadata, body } = parseTutorialMetadata(tutorialmd);
        const { steps, activities } = parseTutorialMarkdown(body, metadata);
        const title = parseTutorialTitle(body);
        if (!steps)
            return undefined; // error parsing steps

        // collect code and infer editor
        const {
            code,
            templateCode,
            editor,
            language,
            jres,
            assetJson,
            customTs,
            simThemeJson
        } = computeBodyMetadata(body);

        // noDiffs legacy
        if (metadata.diffs === true // enabled in tutorial
            || (metadata.diffs !== false && metadata.noDiffs !== true // not disabled
                && (
                    (editor == pxt.BLOCKS_PROJECT_NAME && pxt.appTarget.appTheme.tutorialBlocksDiff)  //blocks enabled always
                    || (editor != pxt.BLOCKS_PROJECT_NAME && pxt.appTarget.appTheme.tutorialTextDiff) // text enabled always
                ))
        ) {
            diffify(steps, activities);
        }

        const assetFiles = parseAssetJson(assetJson);
        const simTheme = parseSimThemeJson(simThemeJson);
        const globalBlockConfig = parseTutorialBlockConfig("global", tutorialmd);
        const globalValidationConfig = parseTutorialValidationConfig("global", tutorialmd);

        // strip hidden snippets
        steps.forEach(step => {
            step.contentMd = stripHiddenSnippets(step.contentMd)
            step.headerContentMd = stripHiddenSnippets(step.headerContentMd)
            step.hintContentMd = stripHiddenSnippets(step.hintContentMd);
        });

        return {
            editor,
            title,
            steps,
            activities,
            code,
            templateCode,
            metadata,
            language,
            jres,
            assetFiles,
            customTs,
            globalBlockConfig,
            globalValidationConfig,
            simTheme
        };
    }

    export function getMetadataRegex(): RegExp {
        return /``` *(sim|block|blocks|filterblocks|spy|ghost|typescript|ts|js|javascript|template|python|jres|assetjson|customts|simtheme)\s*\n([\s\S]*?)\n```/gmi;
    }

    function computeBodyMetadata(body: string) {
        // collect code and infer editor
        let editor: string = undefined;
        const regex = getMetadataRegex();

        let jres: string;
        let code: string[] = [];
        let templateCode: string;
        let language: string;
        let idx = 0;
        let assetJson: string;
        let customTs: string;
        let simThemeJson: string;
        // Concatenate all blocks in separate code blocks and decompile so we can detect what blocks are used (for the toolbox)
        body
            .replace(/((?!.)\s)+/g, "\n")
            .replace(regex, function (m0, m1, m2) {
                switch (m1) {
                    case "block":
                    case "blocks":
                    case "blockconfig.local":
                    case "blockconfig.global":
                    case "filterblocks":
                        if (!checkTutorialEditor(pxt.BLOCKS_PROJECT_NAME))
                            return undefined;
                        break;
                    case "spy":
                    case "python":
                        if (!checkTutorialEditor(pxt.PYTHON_PROJECT_NAME))
                            return undefined;
                        if (m1 == "python")
                            language = m1;
                        break;
                    case "typescript":
                    case "ts":
                    case "javascript":
                    case "js":
                        if (!checkTutorialEditor(pxt.JAVASCRIPT_PROJECT_NAME))
                            return undefined;
                        break;
                    case "template":
                        templateCode = m2;
                        break;
                    case "jres":
                        jres = m2;
                        break;
                    case "assetjson":
                        assetJson = m2;
                        break;
                    case "simtheme":
                        simThemeJson = m2;
                        break;
                    case "customts":
                        customTs = m2;
                        m2 = "";
                        break;
                }
                code.push(m1 == "python" ? `\n${m2}\n` : `{\n${m2}\n}`);
                idx++
                return "";
            });
        // default to blocks
        editor = editor || pxt.BLOCKS_PROJECT_NAME;
        return {
            code,
            templateCode,
            editor,
            language,
            jres,
            assetJson,
            customTs,
            simThemeJson
        };

        function checkTutorialEditor(expected: string) {
            if (editor && editor != expected) {
                pxt.debug(`tutorial ambiguous: contains snippets of different types`);
                return false;
            } else {
                editor = expected;
                return true;
            }
        }
    }

    function diffify(steps: TutorialStepInfo[], activities: TutorialActivityInfo[]) {
        // convert typescript snippets into diff snippets
        let lastSrc: string = undefined;
        steps.forEach((step, stepi) => {
            // reset diff on each activity or when requested
            if (step.resetDiff
                || (activities && activities.find(activity => activity.step == stepi)))
                lastSrc = undefined;
            // extract typescript snippet from hint or content
            if (step.hintContentMd) {
                const s = convertSnippetToDiff(step.hintContentMd);
                if (s && s != step.hintContentMd) {
                    step.hintContentMd = s;
                    return;
                }
            }
            if (step.headerContentMd) {
                const s = convertSnippetToDiff(step.headerContentMd);
                if (s && s != step.headerContentMd) {
                    step.headerContentMd = s;
                    return;
                }
            }
        })

        function convertSnippetToDiff(src: string): string {
            const diffClasses: pxt.Map<string> = {
                "typescript": "diff",
                "spy": "diffspy",
                "blocks": "diffblocks",
                "python": "diff"
            }
            const highlightRx = /\s*(\/\/|#)\s*@highlight/gm;

            if (!src) return src;
            return src
                .replace(/```(typescript|spy|python|blocks|ghost|template)((?:.|[\r\n])+)```/, function (m, type, code) {
                    const fileA = lastSrc;

                    const hidden = /^(template|ghost)$/.test(type);
                    const hasHighlight = highlightRx.test(code);
                    code = code.replace(/^\n+/, '').replace(/\n+$/, ''); // always trim lines
                    if (hasHighlight) code = code.replace(highlightRx, '');

                    lastSrc = code;
                    if (!fileA || hasHighlight || hidden)
                        return m; // leave unchanged or reuse highlight info
                    else
                        return `\`\`\`${diffClasses[type]}
${fileA}
----------
${code}
\`\`\``
                })
        }
    }

    function parseTutorialTitle(tutorialmd: string): string {
        let title = tutorialmd.match(/^#[^#](.*)$/mi);
        return title && title.length > 1 ? title[1].trim() : null;
    }

    function parseTutorialMarkdown(tutorialmd: string, metadata: TutorialMetadata): { steps: TutorialStepInfo[], activities: TutorialActivityInfo[] } {
        if (metadata && metadata.activities) {
            // tutorial with "## ACTIVITY", "### STEP" syntax
            return parseTutorialActivities(tutorialmd, metadata);
        } else {
            // tutorial with "## STEP" syntax
            let steps = parseTutorialSteps(tutorialmd, null, metadata);

            // old: "### STEP" syntax (no activity header guaranteed)
            if (!steps || steps.length < 1) steps = parseTutorialSteps(tutorialmd, _h3Regex, metadata);

            return { steps: steps, activities: null };
        }
    }

    function parseTutorialActivities(markdown: string, metadata: TutorialMetadata): { steps: TutorialStepInfo[], activities: TutorialActivityInfo[] } {
        let stepInfo: TutorialStepInfo[] = [];
        let activityInfo: TutorialActivityInfo[] = [];

        markdown.replace(_h2Regex, function (match, name, activity) {
            let i = activityInfo.length;
            activityInfo.push({
                name: name || lf("Activity {0}", i),
                step: stepInfo.length
            })

            let steps = parseTutorialSteps(activity, _h3Regex, metadata);
            steps = steps.map(step => {
                step.activity = i;
                return step;
            })
            stepInfo = stepInfo.concat(steps);

            return "";
        })

        return { steps: stepInfo, activities: activityInfo };
    }

    function parseTutorialSteps(markdown: string, regex?: RegExp, metadata?: TutorialMetadata): TutorialStepInfo[] {
        // use regex override if present
        let stepRegex = regex || _h2Regex;

        let stepInfo: TutorialStepInfo[] = [];
        markdown.replace(stepRegex, function (match, flags, step) {
            step = step.trim();
            let { header, hint } = parseTutorialHint(step, metadata && metadata.explicitHints);
            const blockConfig = parseTutorialBlockConfig("local", step);
            const validationConfig = parseTutorialValidationConfig("local", step);

            // if title is not hidden ("{TITLE HERE}"), strip flags
            const title = !flags.match(/^\{.*\}$/)
                ? flags.replace(/@(fullscreen|unplugged|showdialog|showhint|tutorialCompleted|resetDiff)/gi, "").trim()
                : undefined;

            let info: TutorialStepInfo = {
                title,
                contentMd: step,
                headerContentMd: header,
                localBlockConfig: blockConfig,
                localValidationConfig: validationConfig
            }
            if (/@(fullscreen|unplugged|showdialog|showhint)/i.test(flags))
                info.showHint = true;
            if (/@(unplugged|showdialog)/i.test(flags))
                info.showDialog = true;
            if (/@tutorialCompleted/.test(flags))
                info.tutorialCompleted = true;
            if (/@resetDiff/.test(flags))
                info.resetDiff = true;
            if (hint)
                info.hintContentMd = hint;
            stepInfo.push(info);
            return "";
        });

        if (markdown.indexOf("# Not found") == 0) {
            pxt.debug(`tutorial not found`);
            return undefined;
        }

        return stepInfo;
    }

    function parseTutorialHint(step: string, explicitHints?: boolean): { header: string, hint: string } {
        // remove hidden code sections
        step = stripHiddenSnippets(step);

        let header = step, hint;

        if (explicitHints) {
            // hint is explicitly set with hint syntax "#### ~ tutorialhint" and terminates at the next heading
            const hintTextRegex = /#+ ~ tutorialhint([\s\S]*)/i;
            header = step.replace(hintTextRegex, function (f, m) {
                hint = m;
                return "";
            });
        } else {
            // everything after the first ``` section OR the first image is treated as a "hint"
            const hintTextRegex = /(^[\s\S]*?\S)\s*((```|\[?\!\[[\s\S]+?\]\(\S+?\)\]?)[\s\S]*)/mi;
            let hintText = step.match(hintTextRegex);
            if (hintText && hintText.length > 2) {
                header = hintText[1].trim();
                hint = hintText[2].trim();
            }
        }
        return { header, hint };
    }

    function parseTutorialBlockConfig(scope: "local" | "global", content: string): TutorialBlockConfig {
        let blockConfig: pxt.tutorial.TutorialBlockConfig = {
            md: "",
            blocks: [],
        };
        const regex = new RegExp(`\`\`\`\\s*blockconfig\\.${scope}\\s*\\n([\\s\\S]*?)\\n\`\`\``, "gmi");
        content.replace(regex, (m0, m1) => {
            blockConfig.md += `${m1}\n`;
            return "";
        });
        return blockConfig;
    }

    function parseTutorialValidationConfig(scope: "local" | "global", content: string): CodeValidationConfig {
        let markdown: string;
        const regex = new RegExp(`\`\`\`\\s*validation\\.${scope}\\s*\\n([\\s\\S]*?)\\n\`\`\``, "gmi");
        content.replace(regex, (m0, m1) => {
            markdown = m1;
            return "";
        });

        if(!markdown || markdown == "") {
            return null;
        }

        const validationSections = pxt.getSectionsFromMarkdownMetadata(markdown);
        const sectionedMetadata = validationSections.map((v) => {
          return {
            validatorType: v.header,
            properties: v.attributes,
          };
        });

        return { validatorsMetadata: sectionedMetadata };
    }

    /* Remove hidden snippets from text */
    function stripHiddenSnippets(str: string): string {
        if (!str) return str;
        const hiddenSnippetRegex = /```(filterblocks|package|ghost|config|template|jres|assetjson|simtheme|customts|blockconfig\.local|blockconfig\.global|validation\.local|validation\.global)\s*\n([\s\S]*?)\n```/gmi;
        return str.replace(hiddenSnippetRegex, '').trim();
    }

    /*
        Parses metadata at the beginning of tutorial markown. Metadata is a key-value
        pair in the format: `### @KEY VALUE`
    */
    function parseTutorialMetadata(tutorialmd: string): { metadata: TutorialMetadata, body: string } {
        const metadataRegex = /### @(\S+) ([ \S]+)/gi;
        const m: pxt.Map<any> = {};

        const body = tutorialmd.replace(metadataRegex, function (f, k, v) {
            try {
                m[k] = JSON.parse(v);
            } catch {
                m[k] = v;
            }

            return "";
        });
        const metadata = (m as TutorialMetadata);
        if (metadata.explicitHints !== undefined
            && pxt.appTarget.appTheme
            && pxt.appTarget.appTheme.tutorialExplicitHints)
            metadata.explicitHints = true;

        return { metadata, body };
    }

    export function highlight(pre: HTMLElement): void {
        let text = pre.textContent;

        // collapse image python/js literales
        text = text.replace(/img\s*\(\s*"{3}[\s\da-f.#tngrpoyw]*"{3}\s*\)/g, `img(""" """)`);
        text = text.replace(/img\s*`[\s\da-f.#tngrpoyw]*`\s*/g, "img` `");

        if (!/@highlight/.test(text)) { // shortcut, nothing to do
            pre.textContent = text;
            return;
        }

        // render lines
        pre.textContent = ""; // clear up and rebuild
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; ++i) {
            if (i > 0 && i < lines.length)
                pre.appendChild(document.createTextNode("\n"))
            let line = lines[i];
            if (/@highlight/.test(line)) {
                // highlight next line
                line = lines[++i];
                if (line !== undefined) {
                    const span = document.createElement("span");
                    span.className = "highlight-line";
                    span.textContent = line;
                    pre.appendChild(span);
                }
            } else {
                pre.appendChild(document.createTextNode(line));
            }
        }
    }

    export function getTutorialOptions(md: string, tutorialId: string, filename: string, reportId: string, recipe: boolean): { options: pxt.tutorial.TutorialOptions, editor: string } {
        const tutorialInfo = pxt.tutorial.parseTutorial(md);
        if (!tutorialInfo)
            throw new Error(lf("Invalid tutorial format"));

        const tutorialOptions: pxt.tutorial.TutorialOptions = {
            tutorial: tutorialId,
            tutorialName: tutorialInfo.title || filename,
            tutorialReportId: reportId,
            tutorialStep: 0,
            tutorialReady: true,
            tutorialHintCounter: 0,
            tutorialStepInfo: tutorialInfo.steps,
            tutorialActivityInfo: tutorialInfo.activities,
            tutorialMd: md,
            tutorialCode: tutorialInfo.code,
            tutorialRecipe: !!recipe,
            templateCode: tutorialInfo.templateCode,
            autoexpandStep: tutorialInfo.metadata?.autoexpandOff ? false : true,
            metadata: tutorialInfo.metadata,
            language: tutorialInfo.language,
            jres: tutorialInfo.jres,
            assetFiles: tutorialInfo.assetFiles,
            customTs: tutorialInfo.customTs,
            globalBlockConfig: tutorialInfo.globalBlockConfig,
            globalValidationConfig: tutorialInfo.globalValidationConfig,
            simTheme: tutorialInfo.simTheme,
        };

        return { options: tutorialOptions, editor: tutorialInfo.editor };
    }


    export function parseCachedTutorialInfo(json: string, id?: string) {
        let cachedInfo = pxt.Util.jsonTryParse(json) as pxt.Map<pxt.BuiltTutorialInfo>;
        if (!cachedInfo) return Promise.resolve();

        return pxt.BrowserUtils.tutorialInfoDbAsync()
            .then(db => {
                if (id && cachedInfo[id]) {
                    const info = cachedInfo[id];
                    if (info.usedBlocks && info.hash) db.setWithHashAsync(id, info.snippetBlocks, info.hash, info.highlightBlocks, info.validateBlocks);
                } else {
                    for (let key of Object.keys(cachedInfo)) {
                        const info = cachedInfo[key];
                        if (info.usedBlocks && info.hash) db.setWithHashAsync(key, info.snippetBlocks, info.hash, info.highlightBlocks, info.validateBlocks);
                    }
                }
            }).catch((err) => { })
    }

    export function resolveLocalizedMarkdown(ghid: pxt.github.ParsedRepo, files: pxt.Map<string>, fileName?: string): string {
        // if non-default language, find localized file if any
        const mfn = (fileName || ghid.fileName || "README") + ".md";

        let md: string = undefined;
        const [initialLang, baseLang, initialLangLowerCase] = pxt.Util.normalizeLanguageCode(pxt.Util.userLanguage());
        if (initialLang && baseLang && initialLangLowerCase) {
            //We need to first search base lang and then intial Lang
            //Example: normalizeLanguageCode en-IN  will return ["en-IN", "en", "en-in"] and nb will be returned as ["nb"]
            md = files[`_locales/${initialLang}/${mfn}`]
                || files[`_locales/${initialLangLowerCase}/${mfn}`]
                || files[`_locales/${baseLang}/${mfn}`]

        } else {
            md = files[`_locales/${initialLang}/${mfn}`];
        }
        md = md || files[mfn];
        return md;
    }


    export function parseAssetJson(json: string): pxt.Map<string> {
        if (!json) return undefined;

        const files: pxt.Map<string> = JSON.parse(json);

        return {
            [pxt.TILEMAP_JRES]: files[pxt.TILEMAP_JRES],
            [pxt.TILEMAP_CODE]: files[pxt.TILEMAP_CODE],
            [pxt.IMAGES_JRES]: files[pxt.IMAGES_JRES],
            [pxt.IMAGES_CODE]: files[pxt.IMAGES_CODE]
        }
    }

    export function parseSimThemeJson(json: string): Partial<pxt.PackageConfig> {
        const pxtJson = pxt.Util.jsonTryParse(json);
        if (!pxtJson) return undefined;

        const res: Partial<pxt.PackageConfig> = {};
        if (pxtJson.theme) {
            res.theme = pxtJson.theme;
        }
        if (pxtJson.palette) {
            res.palette = pxtJson.palette;
        }
        return res;
    }

    export async function getTutorialHighlightedBlocks(tutorial: TutorialOptions): Promise<pxt.Map<pxt.Map<number>> | undefined> {
        const db = await pxt.BrowserUtils.tutorialInfoDbAsync();
        const entry = await db.getAsync(tutorial.tutorial, tutorial.tutorialCode);
        return entry?.highlightBlocks;
    }

    export async function getTutorialValidateBlocks(tutorial: TutorialOptions): Promise<pxt.Map<pxt.Map<string[]>> | undefined> {
        const db = await pxt.BrowserUtils.tutorialInfoDbAsync();
        const entry = await db.getAsync(tutorial.tutorial, tutorial.tutorialCode);
        return entry?.validateBlocks;
    }

    export function getRequiredBlockCounts(stepBlocks: pxt.Map<string[]>): pxt.Map<number> {
        if (!stepBlocks) return undefined;
        const requiredBlocks: pxt.Map<number> = {};
        const blocks = stepBlocks["validate-exists"];
        if (blocks) {
            blocks.forEach(block => {
                requiredBlocks[block] = (requiredBlocks[block] || 0) + 1;
            });
        }
        return requiredBlocks;
    }

    export function getTutorialStepHash(tutorial: TutorialOptions): string {
        const { tutorialStepInfo, tutorialStep } = tutorial;
        const body = tutorialStepInfo[tutorialStep].hintContentMd;
        const codeSnippets = getBlockSnippetCode(body);
        return pxt.BrowserUtils.getTutorialCodeHash(codeSnippets);
    }

    /** TODO: if this gets exported, we probably want to consider generalizing to 'parseMarkdownSnippets'
     * that returns { snippetName: string[] }; e.g.
     * { "blocks": ["block snippet 1", "block snippet 2"], "package": ["deplist 1"] }
     * need to cover getMetadataRegex + stripHiddenSnippets types, maybe more if any happen to be around.
     **/
    function getBlockSnippetCode(mdSnippet: string): string[] {
        let hintCode: string[] = [];

        mdSnippet?.replace(/((?!.)\s)+/g, "\n")
            .replace(
                /``` *(block|blocks)\s*\n([\s\S]*?)\n```/gim,
                function (m0, m1, m2) {
                    hintCode.push(`{\n${m2}\n}`);
                    return "";
                }
            );

        return hintCode;
    }
}
