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
    if (!driver) {
        return undefined; // TODO thsparks : how to handle this? Have caller retry? Wait for driver to get set?
    }

    const response = await driver.getToolboxCategories(advanced);
    return response;
}

export async function getBlockImageUriFromXmlAsync(xml: string) {
    if (!driver) {
        return undefined; // TODO thsparks : how to handle this? Have caller retry? Wait for driver to get set?
    }

    const response = (await driver.renderXml(xml)) as any;
    return response;
}

export async function getBlockImageUriFromBlockIdAsync(qName: string) {
    if (!driver) {
        return undefined; // TODO thsparks : how to handle this? Have caller retry? Wait for driver to get set?
    }

    const response = (await driver.renderByBlockId(qName)) as any;
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
