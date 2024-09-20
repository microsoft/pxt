/// <reference path="../../../localtypings/validatorPlan.d.ts" />

import { ErrorCode } from "../types/errorCode";
import { logDebug, logError } from "./loggingService";
import { EditorDriver } from "pxtservices/editorDriver";
import { loadToolboxCategoriesAsync } from "../transforms/loadToolboxCategoriesAsync";
import { stateAndDispatch } from "../state";
import { runEvaluateAsync } from "../transforms/runEvaluateAsync";

let driver: EditorDriver | undefined;
let highContrast: boolean = false;

export function setEditorRef(ref: HTMLIFrameElement | undefined, forceReload: () => void) {
    if (driver) {
        if (driver.iframe === ref) return;

        driver.dispose();
        driver = undefined;
    }

    if (ref) {
        driver = new EditorDriver(ref);

        driver.addEventListener("message", ev => {
            logDebug(`Message received from iframe. ID: ${ev?.id}`, ev);
        });
        driver.addEventListener("sent", ev => {
            logDebug(`Sent message to iframe. ID: ${ev?.id}`, ev);
        });
        driver.addEventListener("serviceworkerregistered", ev => {
            logDebug(`Service worker registered. Reloading iframe.`);
            forceReload();
        });
        driver.addEventListener("editorcontentloaded", ev => {
            const { state } = stateAndDispatch();
            const { runOnLoad, projectMetadata } = state;

            if (runOnLoad && !!projectMetadata) {
                runEvaluateAsync(true); // cause a switch to checklist tab on run
            }

            // Reload all blocks in the background, no need to await.
            /* await */ loadToolboxCategoriesAsync();
        });

        driver.setHighContrast(highContrast);
    }
}

//  an example of events that we want to/can send to the editor
export async function setHighContrastAsync(on: boolean) {
    highContrast = on;

    if (driver) {
        await driver.setHighContrast(on);
    }
}

export async function getToolboxCategoriesAsync(
    advanced?: boolean
): Promise<pxt.editor.ToolboxCategoryDefinition[] | undefined> {
    const response = driver ? await driver.getToolboxCategories(advanced) : undefined;
    return response;
}

export async function getReadableBlockName(blockId: string): Promise<pxt.editor.ReadableBlockName | undefined> {
    const response = driver ? await driver.getReadableBlockName(blockId) : undefined;
    return response;
}

export async function getBlockImageUriFromXmlAsync(xml: string): Promise<string | undefined> {
    const response = driver ? await driver.renderXml(xml) : undefined;
    return response;
}

export async function getBlockImageUriFromBlockIdAsync(qName: string): Promise<string | undefined> {
    const response = driver ? await driver.renderByBlockId(qName) : undefined;
    return response;
}

export async function runValidatorPlanAsync(
    validatorPlan: pxt.blocks.ValidatorPlan,
    planLib: pxt.blocks.ValidatorPlan[]
): Promise<pxt.blocks.EvaluationResult | undefined> {
    let evalResults = undefined;

    try {
        evalResults = await driver!.runValidatorPlan(validatorPlan, planLib);

        if (!evalResults) {
            throw new Error(`Missing response data.`);
        }
    } catch (e: any) {
        logError(ErrorCode.runEval, e);
    }

    return evalResults;
}
