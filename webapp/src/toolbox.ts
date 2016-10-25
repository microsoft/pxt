export default new DOMParser().parseFromString(`<xml id="blocklyToolboxDefinition" style="display: none">
        <category name="Loops" colour="120" category="50">
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
        <category name="Logic" colour="210" category="49">
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
            <block type="controls_if">
                <mutation else="1" elseif="1"></mutation>
                <value name="IF0">
                    <shadow type="logic_boolean">
                        <field name="BOOL">TRUE</field>
                    </shadow>
                </value>
                <value name="IF1">
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
        <category name="Variables" colour="330" custom="VARIABLE" category="48">
        </category>
        <category name="Math" colour="230" category="47">
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
            <category colour="230" name="More\u2026">
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
        <category colour="160" name="Text" category="46">
            <block type="text"></block>
            <block type="text_length">
                <value name="VALUE">
                    <shadow type="text">
                        <field name="TEXT">abc</field>
                    </shadow>
                </value>
            </block>
        </category>
        <category colour="260" name="Lists" category="45">
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
    </xml>`, "text/xml");