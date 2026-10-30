/// <reference path="..\..\built\pxtlib.d.ts" />

import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";

describe("localized identifier display fields", () => {
    afterEach(() => pxtblockly.setVariableFieldLocalizeFunction(undefined));

    it("localizes a default variable display without changing its model, id, XML, or dropdown value", () => {
        const workspace = new Blockly.Workspace();
        const variable = workspace.getVariableMap().createVariable("myTile", "", "variable-id");
        Blockly.Blocks["localized_variable_test"] = { init() { } };
        const block = workspace.newBlock("localized_variable_test");
        const field = new pxtblockly.FieldVariable("myTile");
        block.appendDummyInput().appendField(field, "VAR");
        field.initModel();
        field.setValue(variable.getId());

        chai.expect((field as any).getDisplayText_()).to.equal("myTile");
        chai.expect(field.getAriaValue()).to.equal("Variable 'myTile'");

        pxtblockly.setVariableFieldLocalizeFunction((_field, model) =>
            model.getName() === "myTile" ? "minFlise" : undefined);

        chai.expect((field as any).getDisplayText_()).to.equal("minFlise");
        chai.expect(field.getAriaValue()).to.equal("minFlise");
        chai.expect(field.getText()).to.equal("myTile");
        chai.expect(field.getValue()).to.equal("variable-id");

        const xmlField = document.createElement("field");
        field.toXml(xmlField);
        chai.expect(xmlField.textContent).to.equal("myTile");
        chai.expect(xmlField.getAttribute("id")).to.equal("variable-id");

        const serialized = Blockly.Xml.workspaceToDom(workspace);
        chai.expect(Blockly.Xml.domToText(serialized)).to.contain(">myTile</field>");
        chai.expect(Blockly.Xml.domToText(serialized)).not.to.contain("minFlise");
        const restoredWorkspace = new Blockly.Workspace();
        Blockly.Xml.domToWorkspace(serialized, restoredWorkspace);
        const restoredVariable = restoredWorkspace.getVariableMap().getVariableById("variable-id");
        chai.expect(restoredVariable.getName()).to.equal("myTile");
        restoredWorkspace.dispose();

        const option = field.getOptions(false).filter(option =>
            option !== Blockly.FieldDropdown.SEPARATOR && option[1] === "variable-id")[0] as Blockly.MenuOption;
        chai.expect(option[0]).to.equal("minFlise");
        chai.expect(option[1]).to.equal("variable-id");

        let rerenders = 0;
        (field as any).forceRerender = () => rerenders++;
        (field as any).onWorkspaceChange({
            type: Blockly.Events.BLOCK_MOVE,
            blockId: "moved-block",
            oldParentId: block.id,
            newParentId: undefined
        } as Blockly.Events.BlockMove);
        chai.expect(rerenders).to.equal(1);

        workspace.getVariableMap().renameVariable(variable, "renamedTile");
        field.refreshVariableName();
        chai.expect(field.getText()).to.equal("renamedTile");
        chai.expect((field as any).getDisplayText_()).to.equal("renamedTile");
        workspace.dispose();
    });

    it("only identifies names in generated/default API contexts", () => {
        const factory = testSymbol("sprites.create", "create sprite", "Sprite", `
            //% blockSetVariable="myTile"
            //% blockSetVariableLocalizable
        `);
        const blockInfo = testBlocksInfo([factory]);
        const variable = { getName: () => "myTile" } as Blockly.IVariableModel<Blockly.IVariableState>;

        const generatedSet = {
            type: "variables_set",
            getInputTargetBlock: () => ({ type: factory.attributes.blockId })
        } as unknown as Blockly.Block;
        const generatedField = { getSourceBlock: () => generatedSet } as pxtblockly.FieldVariable;
        chai.expect(pxtblockly.getVariableFieldLocalizationInfo(generatedField, variable, blockInfo)).to.deep.equal({
            localizationKey: "{id:var}myTile",
            suffix: ""
        });

        const generatedSecond = { getName: () => "myTile2" } as Blockly.IVariableModel<Blockly.IVariableState>;
        chai.expect(pxtblockly.getVariableFieldLocalizationInfo(generatedField, generatedSecond, blockInfo)).to.deep.equal({
            localizationKey: "{id:var}myTile",
            suffix: "2"
        });

        const generatedTenth = { getName: () => "myTile10" } as Blockly.IVariableModel<Blockly.IVariableState>;
        chai.expect(pxtblockly.getVariableFieldLocalizationInfo(generatedField, generatedTenth, blockInfo)).to.deep.equal({
            localizationKey: "{id:var}myTile",
            suffix: "10"
        });

        const unlocalizedFactory = testSymbol("sprites.createUnlocalized", "create sprite", "Sprite", `
            //% blockSetVariable="myTile"
        `);
        const unlocalizedBlockInfo = testBlocksInfo([unlocalizedFactory]);
        const unlocalizedSet = {
            type: "variables_set",
            getInputTargetBlock: () => ({ type: unlocalizedFactory.attributes.blockId })
        } as unknown as Blockly.Block;
        const unlocalizedField = { getSourceBlock: () => unlocalizedSet } as pxtblockly.FieldVariable;
        chai.expect(pxtblockly.getVariableFieldLocalizationInfo(unlocalizedField, variable, unlocalizedBlockInfo)).to.equal(undefined);

        const userGet = {
            type: "variables_get",
            getParent: (): any => null
        } as unknown as Blockly.Block;
        const userField = { getSourceBlock: () => userGet } as pxtblockly.FieldVariable;
        chai.expect(pxtblockly.getVariableFieldLocalizationInfo(userField, variable, blockInfo)).to.equal(undefined);

        const nested = testSymbol("sprites.overlaps", "overlaps $other=variables_get", "boolean", `
            //% other.defl=otherSprite
            //% other.fieldOptions.localizeVariable=true
        `);
        nested.parameters = [{ name: "other", description: "", type: "Sprite", properties: [], default: "otherSprite" }];
        const nestedBlockInfo = testBlocksInfo([nested]);
        const sourceGet = { type: "variables_get" } as Blockly.Block;
        const parent = {
            type: nested.attributes.blockId,
            inputList: [{ name: "other", connection: { targetBlock: () => sourceGet } }]
        } as unknown as Blockly.Block;
        (sourceGet as any).getParent = () => parent;
        const nestedField = { getSourceBlock: () => sourceGet } as pxtblockly.FieldVariable;
        const nestedVariable = { getName: () => "otherSprite" } as Blockly.IVariableModel<Blockly.IVariableState>;
        chai.expect(pxtblockly.getVariableFieldLocalizationInfo(nestedField, nestedVariable, nestedBlockInfo)).to.deep.equal({
            localizationKey: "{id:var}otherSprite",
            suffix: ""
        });

        const nestedSecond = { getName: () => "otherSprite2" } as Blockly.IVariableModel<Blockly.IVariableState>;
        chai.expect(pxtblockly.getVariableFieldLocalizationInfo(nestedField, nestedSecond, nestedBlockInfo)).to.deep.equal({
            localizationKey: "{id:var}otherSprite",
            suffix: "2"
        });

        const unlocalizedNested = testSymbol("sprites.overlapsUnlocalized", "overlaps $other=variables_get", "boolean", `
            //% other.defl=otherSprite
        `);
        unlocalizedNested.parameters = [{ name: "other", description: "", type: "Sprite", properties: [], default: "otherSprite" }];
        const unlocalizedNestedInfo = testBlocksInfo([unlocalizedNested]);
        const unlocalizedParent = {
            type: unlocalizedNested.attributes.blockId,
            inputList: [{ name: "other", connection: { targetBlock: () => sourceGet } }]
        } as unknown as Blockly.Block;
        (sourceGet as any).getParent = () => unlocalizedParent;
        chai.expect(pxtblockly.getVariableFieldLocalizationInfo(nestedField, nestedVariable, unlocalizedNestedInfo)).to.equal(undefined);
    });

    it("uses localized SpriteKind labels with raw stored values and leaves custom kinds unchanged", () => {
        const opts: pxtc.KindInfo = {
            name: "SpriteKind",
            memberName: "kind",
            createFunctionName: "create",
            blockId: "spritekind",
            promptHint: "",
            initialMembers: ["Player", "Projectile", "Food", "Enemy"],
            initialMemberDisplayNames: {
                Player: "Spiller",
                Projectile: "Projektil",
                Food: "Mad",
                Enemy: "Fjende"
            }
        };
        const workspace = new Blockly.Workspace();
        workspace.getVariableMap().createVariable("CustomKind", "KIND_SpriteKind", "custom-kind-id");
        workspace.getVariableMap().createVariable("toString", "KIND_SpriteKind", "prototype-kind-id");
        Blockly.Blocks["spritekind_field_test"] = { init() { } };
        const block = workspace.newBlock("spritekind_field_test");
        const field = new pxtblockly.FieldKind(opts);
        block.appendDummyInput().appendField(field, "MEMBER");

        const options = field.getOptions(false).filter(option => option !== Blockly.FieldDropdown.SEPARATOR) as Blockly.MenuOption[];
        for (const [display, raw] of [["Spiller", "Player"], ["Projektil", "Projectile"], ["Mad", "Food"], ["Fjende", "Enemy"]]) {
            chai.expect(options.some(option => option[0] === display && option[1] === raw)).to.equal(true);
            field.setValue(raw);
            chai.expect(field.getValue()).to.equal(raw);
            const xmlField = document.createElement("field");
            field.toXml(xmlField);
            chai.expect(xmlField.textContent).to.equal(raw);
        }
        chai.expect(options.some(option => option[0] === "CustomKind" && option[1] === "CustomKind")).to.equal(true);
        chai.expect(options.some(option => option[0] === "toString" && option[1] === "toString")).to.equal(true);
        workspace.dispose();
    });
});

function testSymbol(qName: string, block: string, retType: string, attributes = ""): pxtc.SymbolInfo {
    const qNameParts = qName.split(".");
    const attrs = pxtc.parseCommentString(`
        //% block="${block}"
        //% blockId="${qName.replace(/\./g, "_")}"
        ${attributes}
    `);
    return {
        attributes: attrs,
        name: qNameParts[qNameParts.length - 1],
        namespace: qNameParts.slice(0, -1).join("."),
        fileName: "test.ts",
        kind: pxtc.SymbolKind.Function,
        parameters: [],
        retType,
        qName
    } as pxtc.SymbolInfo;
}

function testBlocksInfo(symbols: pxtc.SymbolInfo[]): pxtc.BlocksInfo {
    const byQName: pxt.Map<pxtc.SymbolInfo> = {};
    const blocksById: pxt.Map<pxtc.SymbolInfo> = {};
    symbols.forEach(symbol => {
        byQName[symbol.qName] = symbol;
        blocksById[symbol.attributes.blockId] = symbol;
    });
    return { apis: { byQName, jres: {} }, blocks: symbols, blocksById, enumsByName: {}, kindsByName: {} } as pxtc.BlocksInfo;
}
