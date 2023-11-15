// /// <reference path="../../built/pxtlib.d.ts" />

// import * as Blockly from "blockly";

// // common time options -- do not remove
// // lf("100 ms")
// // lf("200 ms")
// // lf("500 ms")
// // lf("1 second")
// // lf("2 seconds")
// // lf("5 seconds")
// // lf("1 minute")
// // lf("1 hour")

// namespace pxtblockly {

//     export interface FieldNumberDropdownOptions extends Blockly.FieldCustomDropdownOptions {
//         min?: number;
//         max?: number;
//         precision?: any;
//     }

//     export class FieldNumberDropdown extends Blockly.FieldNumberDropdown implements Blockly.FieldCustom {
//         public isFieldCustom_ = true;

//         private menuGenerator_: any;

//         constructor(value: number | string, options: FieldNumberDropdownOptions, opt_validator?: Function) {
//             super(value, options.data, options.min, options.max, options.precision, opt_validator);
//         }

//         getOptions() {
//             let newOptions: string[][];
//             if (this.menuGenerator_) {
//                 newOptions = JSON.parse(this.menuGenerator_).map((x: number | string[]) => {
//                     if (typeof x == 'object') {
//                         return [pxt.Util.rlf(x[0]), x[1]]
//                     } else {
//                         return [String(x), String(x)]
//                     }
//                 });
//             }
//             return newOptions;
//         }
//     }
// }