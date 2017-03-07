export default new DOMParser().parseFromString(`<xml id="blocklyToolboxDefinition" style="display: none">
        <category name="Loops" nameid="loops" colour="#107c10" category="50" iconclass="blocklyTreeIconloops">
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
        </category>
        <category name="Logic" nameid="logic" colour="#006970" category="49" iconclass="blocklyTreeIconlogic">
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
        <category name="Variables" nameid="variables" colour="#A80000" custom="VARIABLE" category="48" iconclass="blocklyTreeIconvariables">
        </category>
        <category name="Math" nameid="math" colour="#712672" category="47" iconclass="blocklyTreeIconmath" expandedclass="blocklyTreeIconmath">
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
            <block type="device_random" gap="8">
                <value name="limit">
                    <shadow type="math_number">
                        <field name="NUM">4</field>
                    </shadow>
                </value>
            </block>
            <category colour="#712672" name="More" nameid="more" iconclass="blocklyTreeIconmore" expandedclass="blocklyTreeIconmore">
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
        </category>
        <category name="Advanced" nameid="advanced" colour="#3c3c3c" weight="1" iconclass="blocklyTreeIconadvanced" expandedclass="blocklyTreeIconadvanced">
            <category colour="#D83B01" name="Lists" nameid="lists" category="45" iconclass="blocklyTreeIconlists">
                <block type="lists_create_with">
                    <mutation items="1"></mutation>
                    <value name="ADD0">
                        <shadow type="math_number">
                            <field name="NUM">0</field>
                        </shadow>
                    </value>
                </block>
                <block type="lists_length"></block>
            </category>
            <category colour="#996600" name="Text" nameid="text" category="46" iconclass="blocklyTreeIcontext">
                <block type="text"></block>
                <block type="text_length">
                    <value name="VALUE">
                        <shadow type="text">
                            <field name="TEXT">abc</field>
                        </shadow>
                    </value>
                </block>
                <block type="text_join">
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
            </category>
        </category>
    </xml>`, "text/xml");