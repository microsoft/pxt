import * as React from "react";

import IProjectView = pxt.editor.IProjectView;
import { classList } from "../../../../react-common/components/util";
import { Button } from "../../../../react-common/components/controls/Button";
import { Input } from "../../../../react-common/components/controls/Input";
import { Modal } from "../../../../react-common/components/controls/Modal";

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

interface AnswerFormat {
    blocks: string[];
    reason: string;
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
                <div className="block-preview">
                    {Object.keys(idXmlMap).map((id) => (
                        <img src={idXmlMap[id]} alt={id} key={`block_preview_${id}`} />
                    ))}
                </div>
            )}
            <div className="reasoning">{reasoning}</div>
            <div className="footer">
                <span className="ai-warning">{lf("AI-generated content may be incorrect")}</span>
                <div className="rate-buttons">
                    <Button className="thumb-up secondary" title={lf("I like this suggestion")} leftIcon="far fa-thumbs-up" onClick={() => {}}/>
                    <Button className="thumb-down secondary" title={lf("I dislike this suggestion")} leftIcon="far fa-thumbs-down" onClick={() => {}}/>
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
    const [ idXmlMap, setIdXmlMap ] = React.useState<pxt.Map<string> | undefined>(undefined);
    const [ reasoning, setReasoning ] = React.useState<string | undefined>(undefined);

    async function updateIdXmlMapAsync(blockIds: string[]) {
        const xml: pxt.Map<string> = {};
        for (const blockId of blockIds) {
            const renderedBlock = await parent.renderByBlockIdAsync({
                blockId,
                snippetMode: true,
                layout: pxt.editor.BlockLayout.Align,
                action: "renderbyblockid",
                type: "pxthost"
            });
            const resultXml = await renderedBlock.resultXml;
            xml[blockId] = resultXml.xml;
        }
        setIdXmlMap(xml);
    }

    async function processResponseAsync(response: string) {
        // block is at the start of the message surrounded in back ticks.
        const blockId = response.match(/`([^`]*)`/)?.[1];
        const reason = response.replace(/`([^`]*)`/, "")?.trim();

        await updateIdXmlMapAsync([blockId]);
        setReasoning(reason);
        setCurrentState("answer");
    }

    async function onAskQuestionAsync(question: string) {
        if (!question) closeCallout();

        setCurrentState("loading");
        const response = await parent.runCodeHelperAsync(question);

        if (!response) {
            setCurrentState("error");
        } else {
            processResponseAsync(response);
        }
    }

    return (
        <Modal className={classList("code-helper-callout", className)} title={lf("Ask Copilot")} onClose={closeCallout}>
            { currentState == "ask" && <AskQuestionContent parent={props.parent} onAskQuestion={onAskQuestionAsync} /> }
            { currentState == "loading" && <div className="common-spinner" />}
            { currentState == "answer" && <AnswerContent idXmlMap={idXmlMap} reasoning={reasoning} /> }
            { currentState == "error" && <div className="error-message">Something went wrong!</div> }
        </Modal>
    );
}
