import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";
import * as pkg from "./package";
import * as core from "./core";
import { BackpackImportPosition, validateBackpackItem, validateBackpackRequirements } from "./backpack";
import { BlockSnippetProjectHost, ensureBlockSnippetAsync, getBlockSnippetRequirements, getBlockSnippetTypes } from "./blockSnippet";

export interface BackpackProjectHost extends BlockSnippetProjectHost {
    getWorkspace: () => Blockly.WorkspaceSvg;
}

/** Backpack saves retain the stricter portable-reference policy, unlike native clipboard copies. */
export function getBackpackRequirements(code: string, info: pxtc.BlocksInfo, main: pxt.MainPackage): {
    dependencies: pxt.Map<string>; projectBlocks: pxt.Map<string>;
} {
    const requirements = getBlockSnippetRequirements(pxtblockly.parseBackpackCode(code).blocks, info, main);
    for (const name of Object.keys(requirements.dependencies)) {
        try {
            validateBackpackRequirements({ dependencies: { [name]: requirements.dependencies[name] } });
        } catch {
            throw new Error(lf("The extension '{0}' cannot be copied to another project. Publish it and install the published extension before saving this snippet to your Backpack.", name));
        }
    }
    return { dependencies: requirements.dependencies, projectBlocks: requirements.projectBlocks || {} };
}

/** Prepare using the shared pipeline, then let Backpack own insertion, rendering, and final save. */
export async function addBackpackToProjectAsync(item: pxt.auth.BackpackItem, host: BackpackProjectHost,
    position?: BackpackImportPosition): Promise<boolean> {
    const saved = validateBackpackItem(item);
    const types = getBlockSnippetTypes(pxtblockly.parseBackpackCode(saved.code).blocks);
    const assertCurrent = (): void => {
        if (!host.isCurrent() || !host.headerId || pkg.mainEditorPkg().header?.id !== host.headerId) {
            throw new Error(lf("Your project or account changed. Please retry the operation."));
        }
    };
    const wait = async <T>(action: () => Promise<T>): Promise<T> => {
        assertCurrent();
        try { return await action(); }
        finally { assertCurrent(); }
    };
    if (saved.versions.target !== pxt.appTarget.versions.target || saved.versions.pxt !== pxt.appTarget.versions.pxt) {
        const confirmed = await wait(() => core.confirmAsync({
            header: lf("Different editor version"),
            body: lf("This item was saved with MakeCode {0} (PXT {1}). You are using {2} (PXT {3}). Items from another release or beta may not work here. Add it anyway?",
                saved.versions.target, saved.versions.pxt, pxt.appTarget.versions.target, pxt.appTarget.versions.pxt),
            agreeLbl: lf("Add anyway")
        }));
        if (!confirmed) return false;
    }
    if (!await ensureBlockSnippetAsync({ dependencies: saved.dependencies, projectBlocks: saved.projectBlocks }, types, host)) return false;
    assertCurrent();
    const workspace = host.getWorkspace();
    const coordinates = position && Blockly.utils.svgMath.screenToWsCoordinates(workspace,
        new Blockly.utils.Coordinate(position.x, position.y));
    pxtblockly.pasteBackpackBlock(saved.code, workspace, coordinates); // Owns the single undo group and asset remapping.
    await wait(() => Blockly.renderManagement.finishQueuedRenders());
    await wait(host.saveAsync);
    assertCurrent();
    return true;
}