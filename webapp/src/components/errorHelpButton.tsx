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
    }

    async aiErrorExplainRequest(
        code: string,
        errors: string[],
        lang: string,
        target: string
    ): Promise<string | undefined> {
        const url = `/api/copilot/explainerror`;
        const data = { code, errors, lang, target };
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

        // If the response contains any leading or trailing ` characters, remove them
        response = response.trim().replace(/^`+|`+$/g, "");

        const parsedResponse = pxt.Util.jsonTryParse(
            response
        ) as AiResponseJsonFormat[];
        if (parsedResponse) {
            const validBlockIds = this.props.parent.getBlocks().map((b) => b.id);
            for (const item of parsedResponse) {
                // Check each blockId is valid, and if so, add a tour step for it
                const blockId = item.blockId;
                if (validBlockIds.includes(blockId)) {
                    const tourStep = {
                        title: lf("Error Explanation"),
                        description: item.message,
                        targetQuery: `g[data-id="${blockId}"]`,
                        location: pxt.tour.BubbleLocation.Right,
                        onStepBegin: () => {
                            (this.props.parent.editor as Editor).editor.centerOnBlock(blockId);
                        }
                        // sansQuery?: string; // Use this to exclude an element from the cutout
                        // sansLocation?: BubbleLocation; // relative location of element to exclude
                    } as pxt.tour.BubbleStep;

                    explanationAsTour.push(tourStep);
                } else {
                    // TODO - handle this case
                    console.error("Invalid blockId in AI response", blockId, parsedResponse, response);
                }
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

        const mainFileName = this.props.parent.isBlocksActive()
            ? pxt.MAIN_BLOCKS
            : pxt.MAIN_TS;
        const lang = this.props.parent.isBlocksActive() ? "blocks" : "typescript";
        const target = pxt.appTarget.nickname || pxt.appTarget.name;
        const mainPkg = pkg.mainEditorPkg();
        const code = (this.props.parent.isBlocksActive() ? (this.props.parent.editor as Editor).getWorkspaceXmlWithIds() : mainPkg.files[mainFileName]?.content) ?? "";
        console.log("Code", code);

        const errors = this.getErrorsAsText();
        console.log("Errors", errors);

        // Call to backend API with code and errors, then set the explanation state
        // to the response from the backend
        const response = await this.aiErrorExplainRequest(
            code,
            errors,
            lang,
            target
        );

        const parsedResponse = this.parseResponse(response);

        this.props.onHelpResponse?.(parsedResponse);
    }

    getErrorsAsText(): string[] {
        return this.props.errors.map((error) => error.message);
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