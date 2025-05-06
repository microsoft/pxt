import * as React from "react";
import * as pkg from "../package";
import { ErrorDisplayInfo } from "../errorList";
import { Button } from "../../../react-common/components/controls/Button";
import { classList } from "../../../react-common/components/util";
import { Editor } from "../blocks";


// TODO thsparks - there is probably a better way to do this.
export interface ErrorHelpResponse {
    explanationAsText: string;
    explanationAsTour: pxt.tour.BubbleStep[];
}

export interface ErrorHelpButtonProps {
    parent: pxt.editor.IProjectView;
    errors: ErrorDisplayInfo[];
    onHelpResponse?: (response: ErrorHelpResponse) => void;
}

interface ErrorHelpButtonState {
    explanation?: ErrorHelpResponse;
    loadingHelp?: boolean;
}

export class ErrorHelpButton extends React.Component<
    ErrorHelpButtonProps,
    ErrorHelpButtonState
> {
    constructor(props: ErrorHelpButtonProps) {
        super(props);
        this.state = {
            explanation: undefined,
            loadingHelp: false,
        };

        this.handleHelpClick = this.handleHelpClick.bind(this);
        this.aiErrorExplainRequest = this.aiErrorExplainRequest.bind(this);
        this.parseResponse = this.parseResponse.bind(this);
        this.getErrorsAsText = this.getErrorsAsText.bind(this);
        this.cleanBlocksCode = this.cleanBlocksCode.bind(this);
    }

    async aiErrorExplainRequest(
        code: string,
        errors: string,
        lang: string,
        target: string,
        outputFormat: string
    ): Promise<string | undefined> {
        const url = `/api/copilot/explainerror`;
        const data = { lang, code, errors, target, outputFormat };
        let result: string = "";

        const request = await pxt.auth.AuthClient.staticApiAsync(url, data, "POST");
        if (!request.success) {
            throw new Error(
                request.err ||
                lf(
                    "Unable to reach AI. Error: {0}.\n{1}",
                    request.statusCode,
                    request.err
                )
            );
        }
        result = await request.resp;

        return result;
    }

    parseResponse(response: string): ErrorHelpResponse {
        // We ask the AI to provide an ordered JSON list with blockIds tied to explanations for each block.
        // For example:
        // [
        //     {
        //         "blockId": "sampleblockid",
        //         "message": "Here is a helpful message walking you through the error. This one will be displayed first."
        //     },
        //     {
        //         "blockId": "sampleblockid2",
        //         "message": "Here is another helpful message walking you through the error. This one will be displayed second."
        //     }
        // ]
        interface AiResponseJsonFormat {
            blockId: string;
            message: string;
        }

        let explanationAsText = "";
        let explanationAsTour: pxt.tour.BubbleStep[] = [];

        console.log("AI response", response);

        // If the response contains markdown code "fencing" (i.e. ```json <my json> ```), remove it
        response = response.trim().replace(/^`{3,}(?:\w+)?\s*|`{3,}$/g, "");

        const parsedResponse = pxt.Util.jsonTryParse(
            response
        ) as AiResponseJsonFormat[];
        if (parsedResponse) {
            const validBlockIds = this.props.parent.getBlocks().map((b) => b.id);
            for (const item of parsedResponse) {
                const tourStep = {
                    title: lf("Error Explanation"),
                    description: item.message,
                    location: pxt.tour.BubbleLocation.Center
                } as pxt.tour.BubbleStep;

                // Check each blockId is specified & valid, and if so, add a tour step for it
                const blockId = item.blockId;
                if (blockId) {
                    if (validBlockIds.includes(blockId)) {
                        tourStep.targetQuery = `g[data-id="${blockId}"]`;
                        tourStep.location = pxt.tour.BubbleLocation.Right;
                        tourStep.onStepBegin = () => {
                            (this.props.parent.editor as Editor).editor.centerOnBlock(blockId);
                        }
                    } else {
                        // TODO - handle this case
                        console.error("Invalid blockId in AI response", blockId, parsedResponse, response);
                    }
                }

                explanationAsTour.push(tourStep);
            }
        } else {
            explanationAsText = response; // TODO - handle this case better
        }

        return {
            explanationAsText,
            explanationAsTour:
                explanationAsTour.length > 0 ? explanationAsTour : undefined,
        };
    }

    async handleHelpClick() {
        this.setState({
            loadingHelp: true,
        });
;
        const lang = this.props.parent.isBlocksActive() ? "blocks" : "typescript";
        const target = pxt.appTarget.nickname || pxt.appTarget.name;
        const mainPkg = pkg.mainEditorPkg();
        const code = (this.props.parent.isBlocksActive() ? this.cleanBlocksCode((this.props.parent.editor as Editor).getWorkspaceXmlWithIds()) : mainPkg.files[pxt.MAIN_TS]?.content) ?? "";
        const outputFormat = this.props.parent.isBlocksActive() ? "tour_json" : "text";
        console.log("Code", code);

        const errors = this.getErrorsAsText();
        console.log("Errors", errors);

        // Call to backend API with code and errors, then set the explanation state
        // to the response from the backend
        const response = await this.aiErrorExplainRequest(
            code,
            errors,
            lang,
            target,
            outputFormat
        );

        const parsedResponse = this.parseResponse(response);

        this.props.onHelpResponse?.(parsedResponse);
    }

    cleanBlocksCode(code: string): string {
        // Remove any image content (it's bulky and not useful for the AI)
        const updatedCode = code.replace(/img`[^`]*`/g, "img`[trimmed for brevity]`");
        return updatedCode;
    }

    /**
     * Converts the list of errors into a string format for the AI to reference.
     * Adds block ids to the error message if they exist.
     */
    getErrorsAsText(): string {
        return JSON.stringify(this.props.errors);
    }

    render() {
        const { loadingHelp } = this.state;

        // if (loadingHelp) {
        //     return <div className="common-spinner" />;
        // }

        return (
            <Button
                id="error-help-button"
                onClick={this.handleHelpClick}
                title={lf("Help me understand")}
                className={classList("secondary", "error-help-button")}
                label={lf("Help me understand")}
                leftIcon="fas fa-robot"
            />
        );
    }
}