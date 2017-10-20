const defaultToolboxString = `<xml id="blocklyToolboxDefinition" style="display: none">
    <category name="Loops" nameid="loops" colour="#107c10" category="50" web-icon="\uf01e" iconclass="blocklyTreeIconloops" expandedclass="blocklyTreeIconloops">    
        <block type="controls_repeat_ext">
            <value name="TIMES">
                <shadow type="math_number">
                    <field name="NUM">4</field>
                </shadow>
            </value>
        </block>
        <block type="device_while">
            <value name="COND">
                <shadow type="logic_boolean"></shadow>
            </value>
        </block>
        <block type="controls_simple_for">
            <value name="TO">
                <shadow type="math_number">
                    <field name="NUM">4</field>
                </shadow>
            </value>
        </block>
        <block type="controls_for_of">
            <value name="LIST">
                <shadow type="variables_get">
                    <field name="VAR">list</field>
                </shadow>
            </value>
        </block>
    </category>
    <category name="Logic" nameid="logic" colour="#006970" category="49" web-icon="\uf074" iconclass="blocklyTreeIconlogic" expandedclass="blocklyTreeIconlogic">    
        <label text="Conditionals" web-class="blocklyFlyoutGroup" web-line="1.5"/>
        <block type="controls_if" gap="8">
            <value name="IF0">
                <shadow type="logic_boolean">
                    <field name="BOOL">TRUE</field>
                </shadow>
            </value>
        </block>
        <block type="controls_if" gap="8">
            <mutation else="1"></mutation>
            <value name="IF0">
                <shadow type="logic_boolean">
                    <field name="BOOL">TRUE</field>
                </shadow>
            </value>
        </block>
        <label text="Comparison" web-class="blocklyFlyoutGroup" web-line="1.5"/>
        <block type="logic_compare" gap="8">
            <value name="A">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
            <value name="B">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
        </block>
        <block type="logic_compare">
            <field name="OP">LT</field>
            <value name="A">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
            <value name="B">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
        </block>
        <label text="Boolean" web-class="blocklyFlyoutGroup" web-line="1.5"/>
        <block type="logic_operation" gap="8"></block>
        <block type="logic_operation" gap="8">
            <field name="OP">OR</field>
        </block>
        <block type="logic_negate"></block>
        <block type="logic_boolean" gap="8"></block>
        <block type="logic_boolean">
            <field name="BOOL">FALSE</field>
        </block>
    </category>
    <category name="Variables" nameid="variables" colour="#A80000" custom="VARIABLE" category="48" iconclass="blocklyTreeIconvariables" expandedclass="blocklyTreeIconvariables">
    </category>
    <category name="Math" nameid="math" colour="#712672" category="47" web-icon="\uf1ec" iconclass="blocklyTreeIconmath" expandedclass="blocklyTreeIconmath">    
        <block type="math_arithmetic" gap="8">
            <value name="A">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
            <value name="B">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
        </block>
        <block type="math_arithmetic" gap="8">
            <value name="A">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
            <value name="B">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
            <field name="OP">MINUS</field>
        </block>
        <block type="math_arithmetic" gap="8">
            <value name="A">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
            <value name="B">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
            <field name="OP">MULTIPLY</field>
        </block>
        <block type="math_arithmetic" gap="8">
            <value name="A">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
            <value name="B">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
            <field name="OP">DIVIDE</field>
        </block>
        <block type="math_number" gap="8">
            <field name="NUM">0</field>
        </block>
        <block type="math_modulo">
            <value name="DIVIDEND">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
            <value name="DIVISOR">
                <shadow type="math_number">
                    <field name="NUM">1</field>
                </shadow>
            </value>
        </block>
        <block type="math_op2" gap="8">
            <value name="x">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
            <value name="y">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
        </block>
        <block type="math_op2" gap="8">
            <value name="x">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
            <value name="y">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
            <field name="op">max</field>
        </block>
        <block type="math_op3">
            <value name="x">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
        </block>
    </category>
    <category name="Functions" nameid="functions" colour="#005a9e" custom="PROCEDURE" category="46" iconclass="blocklyTreeIconfunctions" expandedclass="blocklyTreeIconfunctions" advanced="true">
    </category>
    <category colour="#66672C" name="Arrays" nameid="arrays" category="45" web-icon="\uf0cb" iconclass="blocklyTreeIconarrays" expandedclass="blocklyTreeIconarrays" advanced="true">
        <block type="lists_create_with">
            <mutation items="1"></mutation>
            <value name="ADD0">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
        </block>
        <block type="lists_create_with">
            <mutation items="2"></mutation>
            <value name="ADD0">
                <shadow type="text">
                    <field name="TEXT"></field>
                </shadow>
            </value>
            <value name="ADD1">
                <shadow type="text">
                    <field name="TEXT"></field>
                </shadow>
            </value>
        </block>
        <block type="lists_length"></block>
        <block type="lists_index_get">
            <value name="LIST">
                <block type="variables_get">
                    <field name="VAR">${lf("{id:var}list")}</field>
                </block>
            </value>
            <value name="INDEX">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
        </block>
        <block type="lists_index_set">
            <value name="LIST">
                <block type="variables_get">
                    <field name="VAR">${lf("{id:var}list")}</field>
                </block>
            </value>
            <value name="INDEX">
                <shadow type="math_number">
                    <field name="NUM">0</field>
                </shadow>
            </value>
        </block>
    </category>
    <category colour="#996600" name="Text" nameid="text" category="46" web-icon="\uf035" iconclass="blocklyTreeIcontext" expandedclass="blocklyTreeIcontext" advanced="true">
        <block type="text"></block>
        <block type="text_length">
            <value name="VALUE">
                <shadow type="text">
                    <field name="TEXT">${lf("Hello")}</field>
                </shadow>
            </value>
        </block>
        <block type="text_join">
            <mutation items="2"></mutation>
            <value name="ADD0">
                <shadow type="text">
                    <field name="TEXT">${lf("Hello")}</field>
                </shadow>
            </value>
            <value name="ADD1">
                <shadow type="text">
                    <field name="TEXT">${lf("World")}</field>
                </shadow>
            </value>
        </block>
    </category>
</xml>`;

let cachedToolboxDom: Document;

export function getBaseToolboxDom() {
    if (!cachedToolboxDom) {
        overrideBaseToolbox(defaultToolboxString);
    }
    return cachedToolboxDom;
}

export function overrideBaseToolbox(xml: string) {
    cachedToolboxDom = new DOMParser().parseFromString(xml, 'text/xml');
}