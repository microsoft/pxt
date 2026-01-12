import * as React from "react";
import { useContext } from "react";

import { Button } from "react-common/components/controls/Button";
import { Checkbox } from "react-common/components/controls/Checkbox";
import { Textarea } from "react-common/components/controls/Textarea";
import { FocusTrap } from "react-common/components/controls/FocusTrap";
import { Accordion } from "react-common/components/controls/Accordion";
import { classList } from "react-common/components/util";

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

type CustomPrompt = {
    id: number;
    text: string;
    checked: boolean;
};

const CUSTOM_ADD_BUTTON_ID = "ask-ai-custom-add";
const DEFAULT_CUSTOM_PROMPT_ID = 1;

function toIdFragment(text: string) {
    return (text || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function getAiQuestionCatalogCriteria(catalog: CatalogCriteria[] | undefined): CatalogCriteria | undefined {
    return catalog?.find(c => c.use === "ai_question");
}

function getAiQuestionMaxLength(aiCriteria: CatalogCriteria | undefined): number | undefined {
    const questionParam = aiCriteria?.params?.find(p => p.name === "question");
    const maxCharacters = (questionParam as any)?.maxCharacters;
    return typeof maxCharacters === "number" ? maxCharacters : undefined;
}

function getPromptCategoriesFromCatalog(aiCriteria: CatalogCriteria | undefined): PromptCategory[] {
    const questionParam = aiCriteria?.params?.find(p => p.name === "question");
    const options = questionParam?.options;
    if (!options || !Array.isArray(options) || options.length === 0) return [];

    const categories: PromptCategory[] = [];
    const categoriesByTitle: pxt.Map<PromptCategory> = {};

    options.forEach(o => {
        const value = typeof o.value === "string" ? o.value : undefined;
        if (!value) return;

        const title = typeof o.category === "string" && o.category.trim() ? o.category.trim() : lf("Prompts");
        const label = typeof o.label === "string" && o.label.trim() ? o.label : value;

        let cat = categoriesByTitle[title];
        if (!cat) {
            cat = { title, items: [] };
            categoriesByTitle[title] = cat;
            categories.push(cat);
        }

        cat.items.push({ label, value });
    });

    return categories.filter(c => c.items.length > 0);
}

export const AskAIOverlay = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const catalog = teacherTool.catalog;

    const aiCriteria = React.useMemo(() => getAiQuestionCatalogCriteria(catalog), [catalog]);
    const aiQuestionMaxLength = React.useMemo(() => getAiQuestionMaxLength(aiCriteria), [aiCriteria]);
    const promptCategories = React.useMemo(() => getPromptCategoriesFromCatalog(aiCriteria), [aiCriteria]);

    const [selected, setSelected] = React.useState<pxt.Map<boolean>>({});
    const [customPrompts, setCustomPrompts] = React.useState<CustomPrompt[]>([
        { id: DEFAULT_CUSTOM_PROMPT_ID, text: "", checked: true },
    ]);
    const nextCustomPromptId = React.useRef(DEFAULT_CUSTOM_PROMPT_ID + 1);
    const lastAddedCustomPromptId = React.useRef<number | undefined>(undefined);

    const close = React.useCallback(() => setAskAiOpen(false), []);

    const onToggle = React.useCallback((value: string) => {
        setSelected(prev => ({
            ...prev,
            [value]: !prev[value],
        }));
    }, []);

    const selectedQuestions = React.useMemo(() => {
        const values: string[] = [];

        customPrompts.forEach(p => {
            if (!p.checked) return;
            const trimmed = (p.text || "").trim();
            if (trimmed) values.push(trimmed);
        });

        Object.keys(selected).forEach(k => {
            if (selected[k]) values.push(k);
        });

        // Remove dupes while keeping order.
        const seen: pxt.Map<boolean> = {};
        return values.filter(v => (seen[v] ? false : (seen[v] = true)));
    }, [selected, customPrompts]);

    const addSelected = React.useCallback(() => {
        if (!selectedQuestions.length) return;
        addAiQuestionCriteriaToChecklist(selectedQuestions);

        // Clear state so reopening doesn't immediately duplicate.
        setSelected({});
        setCustomPrompts([{ id: DEFAULT_CUSTOM_PROMPT_ID, text: "", checked: true }]);
        nextCustomPromptId.current = DEFAULT_CUSTOM_PROMPT_ID + 1;
        lastAddedCustomPromptId.current = undefined;

        close();
    }, [selectedQuestions, close]);

    const addCustomPrompt = React.useCallback(() => {
        const id = nextCustomPromptId.current++;
        lastAddedCustomPromptId.current = id;
        setCustomPrompts(prev => prev.concat([{ id, text: "", checked: true }]));
    }, []);

    React.useEffect(() => {
        const id = lastAddedCustomPromptId.current;
        if (id === undefined) return;

        const el = document.getElementById(`ask-ai-custom-text-${id}`) as HTMLTextAreaElement | null;
        el?.focus();
        lastAddedCustomPromptId.current = undefined;
    }, [customPrompts.length]);

    const setCustomChecked = React.useCallback((id: number, checked: boolean) => {
        setCustomPrompts(prev => prev.map(p => (p.id === id ? { ...p, checked } : p)));
    }, []);

    const setCustomTextForId = React.useCallback((id: number, text: string) => {
        setCustomPrompts(prev => prev.map(p => (p.id === id ? { ...p, text } : p)));
    }, []);

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
                        <Accordion
                            className={css["ask-ai-accordion"]}
                            multiExpand={true}
                            defaultExpandedIds={[
                                "ask-ai-custom",
                                ...promptCategories.map(c => `ask-ai-cat-${toIdFragment(c.title)}`),
                            ]}
                        >
                            {[
                                (
                                    <Accordion.Item key="ask-ai-custom" itemId="ask-ai-custom">
                                        <Accordion.Header>{Strings.Custom}</Accordion.Header>
                                        <Accordion.Panel>
                                            {customPrompts.length > 0 && (
                                                <div className={css["custom-list"]}>
                                                    {customPrompts.map((p, index) => (
                                                        <div key={p.id} className={css["custom-item"]}>
                                                            <Checkbox
                                                                id={`ask-ai-custom-check-${p.id}`}
                                                                className={css["checkbox"]}
                                                                label={lf("Question {0}", index + 1)}
                                                                isChecked={p.checked}
                                                                onChange={checked => setCustomChecked(p.id, checked)}
                                                            />
                                                            <Textarea
                                                                id={`ask-ai-custom-text-${p.id}`}
                                                                className={css["textarea"]}
                                                                placeholder={Strings.CustomPromptPlaceholder}
                                                                initialValue={p.text}
                                                                maxLength={aiQuestionMaxLength}
                                                                onChange={text => setCustomTextForId(p.id, text)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className={css["custom-actions"]}>
                                                <Button
                                                    id={CUSTOM_ADD_BUTTON_ID}
                                                    className={css["custom-add-button"]}
                                                    label={lf("Add custom question")}
                                                    title={lf("Add custom question")}
                                                    onClick={addCustomPrompt}
                                                    rightIcon="fas fa-plus"
                                                />
                                            </div>
                                        </Accordion.Panel>
                                    </Accordion.Item>
                                ),
                                ...promptCategories.map(cat => (
                                    <Accordion.Item key={cat.title} itemId={`ask-ai-cat-${toIdFragment(cat.title)}`}>
                                        <Accordion.Header>{cat.title}</Accordion.Header>
                                        <Accordion.Panel>
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
                                        </Accordion.Panel>
                                    </Accordion.Item>
                                )),
                            ]}
                        </Accordion>
                    </div>

                    <div className={css["footer"]}>
                        <Button
                            className={classList("secondary", css["footer-button"])}
                            label={Strings.Cancel}
                            onClick={close}
                            title={Strings.Cancel}
                        />
                        <Button
                            className={classList(selectedQuestions.length ? "primary" : "secondary", css["footer-button"])}
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
