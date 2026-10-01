import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";
import * as pkg from "./package";
import * as core from "./core";
import { BackpackUserError } from "./backpackErrors";
import { BackpackImportPosition, validateBackpackItem, validateBackpackRequirements } from "./backpack";
import { BlockSnippetProjectHost, ensureBlockSnippetAsync, getBlockSnippetRequirements, getBlockSnippetTypes } from "./blockSnippet";

export interface BackpackProjectHost extends BlockSnippetProjectHost {
    getWorkspace: () => Blockly.WorkspaceSvg;
}

/** Backpack dependencies must be installable in another project, unlike local clipboard references. */
export function getBackpackRequirements(
    code: string,
    info: pxtc.BlocksInfo,
    main: pxt.MainPackage
): {
    dependencies: pxt.Map<string>;
    projectBlocks: pxt.Map<string>;
} {
    const requirements = getBlockSnippetRequirements(pxtblockly.parseBackpackCode(code).blocks, info, main);
    const projectFiles = Array.from(new Set(Object.values(requirements.projectBlocks || {})));
    if (projectFiles.length) {
        throw new BackpackUserError(lf(
            "These blocks use code from {0}, which is not included in Backpack. Move that code into an extension, publish it, and add the extension to your project before saving these blocks.",
            projectFiles.join(", ")
        ));
    }

    for (const name of Object.keys(requirements.dependencies)) {
        try {
            validateBackpackRequirements({ dependencies: { [name]: requirements.dependencies[name] } });
        } catch {
            throw new BackpackUserError(lf("The extension '{0}' cannot be copied to another project. Publish it and install the published extension before saving this snippet to your Backpack.", name));
        }
    }
    return { dependencies: requirements.dependencies, projectBlocks: requirements.projectBlocks || {} };
}

/** Install required extensions before inserting the blocks and saving the project. */
export async function addBackpackToProjectAsync(
    item: pxt.auth.BackpackItem,
    host: BackpackProjectHost,
    position?: BackpackImportPosition
): Promise<boolean> {
    const saved = validateBackpackItem(item);
    const types = getBlockSnippetTypes(pxtblockly.parseBackpackCode(saved.code).blocks);

    const assertCurrent = (): void => {
        if (!host.isCurrent() || !host.headerId || pkg.mainEditorPkg().header?.id !== host.headerId) {
            throw new BackpackUserError(lf("Your project or account changed. Please retry the operation."));
        }
    };
    const wait = async <T>(action: () => Promise<T>): Promise<T> => {
        assertCurrent();
        try {
            return await action();
        } finally {
            assertCurrent();
        }
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
    if (!await ensureBlockSnippetAsync({
        dependencies: saved.dependencies,
        projectBlocks: saved.projectBlocks
    }, types, host)) return false;

    assertCurrent();
    const workspace = host.getWorkspace();
    const coordinates = position && Blockly.utils.svgMath.screenToWsCoordinates(
        workspace,
        new Blockly.utils.Coordinate(position.x, position.y)
    );
    pxtblockly.pasteBackpackBlock(saved.code, workspace, coordinates, saved.kind);
    await wait(() => Blockly.renderManagement.finishQueuedRenders());

    // The blocks are already inserted. Retry only the save, without adding
    // duplicate blocks or overwriting edits made while the save was pending.
    while (true) {
        try {
            await wait(host.saveAsync);
            break;
        } catch {
            assertCurrent();
            const retry = await wait(() => core.confirmAsync({
                header: lf("Blocks added, but project not saved"),
                body: lf("The blocks are already in your workspace. Do not add them again. Retry saving, or keep editing and save your project before leaving."),
                agreeLbl: lf("Retry save"),
                disagreeLbl: lf("Keep editing")
            }));
            if (!retry) break;
        }
    }

    assertCurrent();
    return true;
}