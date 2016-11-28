///<reference path='../built/blockly.d.ts'/>
/// <reference path="../built/pxtlib.d.ts" />

namespace pxt.blocks {
    export function saveWorkspaceXml(ws: Blockly.Workspace): string {
        let xml = Blockly.Xml.workspaceToDom(ws);
        let text = Blockly.Xml.domToPrettyText(xml);
        return text;
    }

    /**
     * Loads the xml into a off-screen workspace (not suitable for size computations)
     */
    export function loadWorkspaceXml(xml: string) {
        let workspace = new Blockly.Workspace();
        try {
            Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(xml), workspace);
            return workspace;
        } catch (e) {
            pxt.reportException(e, { xml: xml });
            return null;
        }
    }


    export function importXml(info: pxtc.BlocksInfo, xml: string): string {
        try {
            let parser = new DOMParser();
            let doc = parser.parseFromString(xml, "application/xml");

            // build upgrade map
            let enums: Map<string> = {};
            for (let k in info.apis.byQName) {
                let api = info.apis.byQName[k];
                if (api.kind == pxtc.SymbolKind.EnumMember)
                    enums[api.namespace + '.' + (api.attributes.blockImportId || api.attributes.block || api.attributes.blockId || api.name)] = api.namespace + '.' + api.name;
            }

            // walk through blocks and patch enums
            let blocks = doc.getElementsByTagName("block");
            for (let i = 0; i < blocks.length; ++i)
                patchBlock(info, enums, blocks[i]);

            // serialize and return
            return new XMLSerializer().serializeToString(doc);
        }
        catch (e) {
            reportException(e, { xml: xml });
            return xml;
        }
    }

    function patchBlock(info: pxtc.BlocksInfo, enums: Map<string>, block: Element): void {
        let type = block.getAttribute("type");
        let b = Blockly.Blocks[type];
        let symbol = blockSymbol(type);
        if (!symbol || !b) return;

        let params = parameterNames(symbol);
        symbol.parameters.forEach((p, i) => {
            let ptype = info.apis.byQName[p.type];
            if (ptype && ptype.kind == pxtc.SymbolKind.Enum) {
                let field = block.querySelector(`field[name=${params[p.name].name}]`);
                if (field) {
                    let en = enums[ptype.name + '.' + field.textContent];
                    if (en) field.textContent = en;
                }
                /*
<block type="device_button_event" x="92" y="77">
    <field name="NAME">Button.AB</field>
  </block>
                  */
            }
        })
    }
}
