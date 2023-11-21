    import * as Blockly from "blockly";

    // Get rid of bumping behavior
    Blockly.Extensions.unregister("logic_compare");
    Blockly.Extensions.register("logic_compare", function () {})