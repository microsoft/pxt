import * as pxtblockly from "../built/pxtblocks/index";
import * as Blockly from "blockly";
type pxtblockly_ = typeof pxtblockly;
type Blockly_ = typeof Blockly;

declare global {
    namespace pxt.blocks {
        interface PxtBlockly extends pxtblockly_ {

        }

        interface BlocklyModule extends Blockly_ {

        }
    }
}