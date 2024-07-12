import * as React from "react";

import IProjectView = pxt.editor.IProjectView;
import { classList } from "../../../../react-common/components/util";
import { Button } from "../../../../react-common/components/controls/Button";
import { Input } from "../../../../react-common/components/controls/Input";
import { Modal } from "../../../../react-common/components/controls/Modal";

interface AnswerFormat {
    blocks: string[];
    reason: string;
}

interface AskQuestionContentProps {
    parent: IProjectView;
    onAskQuestion: (question: string) => void;
}
function AskQuestionContent(props: AskQuestionContentProps) {
    const [question, setQuestion] = React.useState("")

    function onAskQuestion() {
        props.onAskQuestion(question);
    }

    const buttonText = lf("Ask Copilot")
    return (
        <div className="ask-question-content">
            <div>{lf("What are you trying to do?")}</div>
            <Input initialValue={question} onChange={setQuestion} placeholder="Make my character jump" />
            <Button className="ask-button primary" onClick={onAskQuestion} title={buttonText} label={buttonText} leftIcon="fas fa-hat-wizard" disabled={!question} />
        </div>
    );
}

function LoadingContent() {
    return (
        <div className="loading-content">
            <div className="common-spinner" />
        </div>
    );
}

interface AnswerContentProps {
    idXmlMap: pxt.Map<string>;
    reasoning: string | undefined;
}
function AnswerContent(props: AnswerContentProps) {
    const { idXmlMap, reasoning } = props;

    const hasBlocks = Object.keys(idXmlMap).length > 0;
    return (
        <div className="answer-content">
            {hasBlocks && <span className="starter-text">{lf("Consider using:")}</span>}
            {hasBlocks && (
                <div className="block-display">
                    {Object.keys(idXmlMap).map((id) => (
                        <img src={idXmlMap[id]} alt={id} key={`block-display-${id}`} />
                    ))}
                </div>
            )}
            <div className="reasoning">{reasoning}</div>
            <div className="footer">
                <span className="ai-warning">{lf("AI-generated content may be incorrect")}</span>
                <div className="rate-buttons">
                    <Button title={lf("I dislike this suggestion")} leftIcon="far fa-thumbs-down" onClick={() => {}}/>
                    <Button title={lf("I like this suggestion")} leftIcon="far fa-thumbs-up" onClick={() => {}}/>
                </div>
            </div>
        </div>
    );
}

interface CodeHelperCalloutProps {
    parent: IProjectView;
    className?: string;
    closeCallout: () => void;
}

export function CodeHelperCallout(props: CodeHelperCalloutProps) {
    const { parent, className, closeCallout } = props;

    type questionState = "ask" | "answer" | "loading" | "error";
    const [ currentState, setCurrentState ] = React.useState<questionState>("ask");
    const [ allowedBlocks, setAllowedBlocks ] = React.useState<pxt.Map<pxt.editor.ToolboxBlockDefinition> | undefined>(undefined); // Maps id to blocks xml that can be used to get an svg
    const [ idToSvgMap, setIdToSvgMap ] = React.useState<pxt.Map<string> | undefined>(undefined); // Maps id to svg src
    const [ reasoning, setReasoning ] = React.useState<string | undefined>(undefined);

    React.useEffect(() => {
        loadAllowedBlocksAsync();
    }, []);

    async function loadAllowedBlocksAsync() {
        const categories = parent.getToolboxCategories();

        const blockMap: pxt.Map<pxt.editor.ToolboxBlockDefinition> = {};
        for (const category of categories.categories) {
            if (!category.blocks) continue;

            for (const block of category.blocks) {
                if (block.blockId) {
                    blockMap[block.blockId] = block;
                }
            }
        }
        setAllowedBlocks(blockMap);
    }

    async function updateIdXmlMapAsync(blockIds: string[]) {
        const xml: pxt.Map<string> = {};
        for (const blockId of blockIds) {
            try {
                const renderedBlock = allowedBlocks[blockId].blockXml
                    ? parent.renderXml({
                          xml: allowedBlocks[blockId].blockXml,
                          snippetMode: true,
                          layout: pxt.editor.BlockLayout.Align,
                          action: "renderxml",
                          type: "pxthost",
                      })
                    : await parent.renderByBlockIdAsync({
                          blockId,
                          snippetMode: true,
                          layout: pxt.editor.BlockLayout.Align,
                          action: "renderbyblockid",
                          type: "pxthost",
                      });
                const resultXml = await renderedBlock.resultXml;
                xml[blockId] = resultXml.xml;
            } catch (e) {
                console.error(`Error rendering block ${blockId}: ${e}`);
            }
        }
        setIdToSvgMap(xml);
    }

    async function processResponseAsync(response: string) {
        const parsedResponse: AnswerFormat = JSON.parse(response) as AnswerFormat;

        await updateIdXmlMapAsync(parsedResponse.blocks);
        setReasoning(parsedResponse.reason);
        setCurrentState("answer");
    }

    async function onAskQuestionAsync(question: string) {
        if (!question) closeCallout();

        setCurrentState("loading");
        if (!allowedBlocks || Object.keys(allowedBlocks).length == 0) {
            await loadAllowedBlocksAsync();
        };
        const response = await parent.runCodeHelperAsync(question, Object.keys(allowedBlocks));

        if (!response) {
            setCurrentState("error");
        } else {
            processResponseAsync(response);
        }
    }

    return (
        <Modal className={classList("code-helper-callout", className)} title={lf("Ask Copilot")} onClose={closeCallout}>
            { currentState == "ask" && <AskQuestionContent parent={props.parent} onAskQuestion={onAskQuestionAsync} /> }
            { currentState == "loading" && <LoadingContent />}
            { currentState == "answer" && <AnswerContent idXmlMap={idToSvgMap} reasoning={reasoning} /> }
            { currentState == "error" && <div className="error-message">Something went wrong!</div> }
        </Modal>
    );
}
