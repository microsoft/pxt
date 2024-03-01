/// <reference path="..\..\localtypings\pxteditor.d.ts" />
/// <reference path="..\..\built\pxtcompiler.d.ts" />

import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";

pxt.blocks.requireBlockly = () => Blockly;
pxt.blocks.requirePxtBlockly = () => pxtblockly;