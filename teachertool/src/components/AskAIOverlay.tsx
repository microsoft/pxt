import * as React from "react";
import { useContext } from "react";

import { Button } from "react-common/components/controls/Button";
import { Checkbox } from "react-common/components/controls/Checkbox";
import { Textarea } from "react-common/components/controls/Textarea";
import { FocusTrap } from "react-common/components/controls/FocusTrap";

import { Strings } from "../constants";
import { setAskAiOpen } from "../transforms/setAskAiOpen";
import { addAiQuestionCriteriaToChecklist } from "../transforms/addAiQuestionCriteriaToChecklist";
import { AppStateContext } from "../state/appStateContext";

import { CatalogCriteria } from "../types/criteria";

import css from "./styling/AskAIOverlay.module.scss";

type PromptItem = {
    label: string;
    value: string;
};

type PromptCategory = {
    title: string;
    items: PromptItem[];
};

const CUSTOM_TEXTAREA_ID = "ask-ai-custom-textarea";
const CUSTOM_CHECKBOX_ID = "ask-ai-custom-enabled";

function toIdFragment(text: string) {
    return (text || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function getAiQuestionCatalogCriteria(catalog: CatalogCriteria[] | undefined): CatalogCriteria | undefined {
    return catalog?.find(c => c.use === "ai_question");
}

function getPromptCategoriesFromCatalog(aiCriteria: CatalogCriteria | undefined): PromptCategory[] {
    const questionParam = aiCriteria?.params?.find(p => p.name === "question");
    const options = questionParam?.options;
    if (!options) return [];

    if (Array.isArray(options)) {
        const items: PromptItem[] = (options as any[])
            .map(o => (typeof o?.value === "string" ? { label: o.value, value: o.value } : undefined))
            .filter((x): x is PromptItem => !!x);

        return items.length ? [{ title: lf("Prompts"), items }] : [];
    }

    const categories: PromptCategory[] = [];
    Object.keys(options).forEach(cat => {
        const values = (options as any)[cat] as string[] | undefined;
        if (!Array.isArray(values) || values.length === 0) return;

        categories.push({
            title: cat,
            items: values.map(v => ({ label: v, value: v })),
        });
    });

    // Keep order stable, but move "Custom" to UI top separately.
    return categories;
}

export const AskAIOverlay = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const catalog = teacherTool.catalog;

    const aiCriteria = React.useMemo(() => getAiQuestionCatalogCriteria(catalog), [catalog]);
    const promptCategories = React.useMemo(() => getPromptCategoriesFromCatalog(aiCriteria), [aiCriteria]);

    const [selected, setSelected] = React.useState<pxt.Map<boolean>>({});
    const [customEnabled, setCustomEnabled] = React.useState(false);
    const [customText, setCustomText] = React.useState("");

    const wasCustomEnabled = React.useRef(false);

    const close = React.useCallback(() => setAskAiOpen(false), []);

    const onToggle = React.useCallback((value: string) => {
        setSelected(prev => ({
            ...prev,
            [value]: !prev[value],
        }));
    }, []);

    const selectedQuestions = React.useMemo(() => {
        const values: string[] = [];

        if (customEnabled) {
            const trimmed = (customText || "").trim();
            if (trimmed) values.push(trimmed);
        }

        Object.keys(selected).forEach(k => {
            if (selected[k]) values.push(k);
        });

        // Remove dupes while keeping order.
        const seen: pxt.Map<boolean> = {};
        return values.filter(v => (seen[v] ? false : (seen[v] = true)));
    }, [selected, customEnabled, customText]);

    const addSelected = React.useCallback(() => {
        if (!selectedQuestions.length) return;
        addAiQuestionCriteriaToChecklist(selectedQuestions);
        close();
    }, [selectedQuestions, close]);

    React.useEffect(() => {
        if (customEnabled && !wasCustomEnabled.current) {
            const el = document.getElementById(CUSTOM_TEXTAREA_ID) as HTMLTextAreaElement | null;
            el?.focus();
        }
        wasCustomEnabled.current = customEnabled;
    }, [customEnabled]);

    const onCustomCheckChanged = React.useCallback((checked: boolean) => {
        setCustomEnabled(checked);
    }, []);

    const hasPrompts = promptCategories.some(c => c.items.length);

    if (!teacherTool.askAiOpen) return null;

    return (
        <FocusTrap onEscape={() => {}}>
            <div className={css["ask-ai-overlay"]} role="dialog" aria-modal="true" aria-label={Strings.AskAI}>
                <div className={css["ask-ai-content-container"]}>
                    <div className={css["header"]}>
                        <span className={css["title"]}>{Strings.AskAI}</span>
                        <Button
                            className={css["close-button"]}
                            rightIcon="fas fa-times-circle"
                            onClick={close}
                            title={Strings.Close}
                        />
                    </div>

                    <div className={css["content"]}>
                        <div className={css["section"]}>
                            <div className={css["section-title"]}>{Strings.Custom}</div>
                            <Checkbox
                                id={CUSTOM_CHECKBOX_ID}
                                className={css["checkbox"]}
                                label={pxt.Util.lf("Use custom prompt")}
                                isChecked={customEnabled}
                                onChange={onCustomCheckChanged}
                            />
                            {customEnabled && (
                                <Textarea
                                    id={CUSTOM_TEXTAREA_ID}
                                    className={css["textarea"]}
                                    placeholder={Strings.CustomPromptPlaceholder}
                                    initialValue={customText}
                                    onChange={setCustomText}
                                />
                            )}
                        </div>

                        {hasPrompts && (
                            <>
                                {promptCategories.map(cat => (
                                    <div key={cat.title} className={css["section"]}>
                                        <div className={css["section-title"]}>{cat.title}</div>
                                        <div className={css["prompt-list"]}>
                                            {cat.items.map((item, index) => (
                                                <Checkbox
                                                    id={`ask-ai-opt-${toIdFragment(cat.title)}-${index}`}
                                                    key={item.value}
                                                    className={css["checkbox"]}
                                                    label={item.label}
                                                    isChecked={!!selected[item.value]}
                                                    onChange={() => onToggle(item.value)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>

                    <div className={css["footer"]}>
                        <Button
                            className={css["secondary-button"]}
                            label={Strings.Cancel}
                            onClick={close}
                            title={Strings.Cancel}
                        />
                        <Button
                            className={css["primary-button"]}
                            label={Strings.AddSelected}
                            onClick={addSelected}
                            disabled={!selectedQuestions.length}
                            title={Strings.AddSelected}
                        />
                    </div>
                </div>
            </div>
        </FocusTrap>
    );
};
