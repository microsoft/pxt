/// <reference path="../../../localtypings/validatorPlan.d.ts" />

import { ErrorCode } from "../types/errorCode";
import { logDebug, logError } from "./loggingService";
import * as AutorunService from "./autorunService";
import { IframeDriver } from "pxtservices/iframeDriver";
import { loadToolboxCategoriesAsync } from "../transforms/loadToolboxCategoriesAsync";

let driver: IframeDriver | undefined;
let highContrast: boolean = false;

export function setEditorRef(ref: HTMLIFrameElement | undefined) {
    if (driver) {
        if (driver.iframe === ref) return;

        driver.dispose();
        driver = undefined;
    }

    if (ref) {
        driver = new IframeDriver(ref);

        driver.addEventListener("message", ev => {
            logDebug(`Message received from iframe: ${JSON.stringify(ev)}`);
        });
        driver.addEventListener("sent", ev => {
            logDebug(`Sent message to iframe: ${JSON.stringify(ev)}`);
        });
        driver.addEventListener("editorcontentloaded", ev => {
            AutorunService.poke();
        });

        driver.setHighContrast(highContrast);

        // Reload all blocks.
        loadToolboxCategoriesAsync();
    }
}

//  an example of events that we want to/can send to the editor
export async function setHighContrastAsync(on: boolean) {
    highContrast = on;

    if (driver) {
        await driver.setHighContrast(on);
    }
}

export async function getToolboxCategories(
    advanced?: boolean
): Promise<pxt.editor.ToolboxCategoryDefinition[] | undefined> {
    const response = driver ? await driver.getToolboxCategories(advanced) : undefined;
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
