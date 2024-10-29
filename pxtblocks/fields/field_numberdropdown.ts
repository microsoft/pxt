/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldCustom, FieldCustomDropdownOptions } from "./field_utils";
import { BaseFieldTextDropdown, FieldTextDropdown, FieldTextDropdownOptions } from "./field_textdropdown";

// common time options -- do not remove
// lf("100 ms")
// lf("200 ms")
// lf("500 ms")
// lf("1 second")
// lf("2 seconds")
// lf("5 seconds")
// lf("1 minute")
// lf("1 hour")

class BaseFieldNumberDropdown extends BaseFieldTextDropdown {
    min_: number;
    max_: number;
    precision_: number;
    decimalPlaces: number;

    constructor(value: number | string, menuGenerator: Blockly.MenuOption[], opt_min?: number, opt_max?: number, opt_precision?: number, opt_validator?: Blockly.FieldValidator) {
        super(value + "", menuGenerator, opt_validator);

        this.setConstraints(opt_min, opt_max, opt_precision);
    }


    setConstraints(
        min: number | string | undefined | null,
        max: number | string | undefined | null,
        precision: number | string | undefined | null,
    ) {
        this.setMinInternal(min);
        this.setMaxInternal(max);
        this.setPrecisionInternal(precision);
        this.setValue(this.getValue());
    }

    getValue(): string {
        return Number(super.getValue()) as any;
    }

    private setMinInternal(min: number | string | undefined | null) {
        if (min == null) {
            this.min_ = -Infinity;
        } else {
            min = Number(min);
            if (!isNaN(min)) {
                this.min_ = min;
            }
        }
    }

    private setMaxInternal(max: number | string | undefined | null) {
        if (max == null) {
            this.max_ = Infinity;
        } else {
            max = Number(max);
            if (!isNaN(max)) {
                this.max_ = max;
            }
        }
    }

    private setPrecisionInternal(precision: number | string | undefined | null) {
        this.precision_ = Number(precision) || 0;
        let precisionString = String(this.precision_);
        if (precisionString.indexOf('e') !== -1) {
            // String() is fast.  But it turns .0000001 into '1e-7'.
            // Use the much slower toLocaleString to access all the digits.
            precisionString = this.precision_.toLocaleString('en-US', {
                maximumFractionDigits: 20,
            });
        }
        const decimalIndex = precisionString.indexOf('.');
        if (decimalIndex === -1) {
            // If the precision is 0 (float) allow any number of decimals,
            // otherwise allow none.
            this.decimalPlaces = precision ? 0 : null;
        } else {
            this.decimalPlaces = precisionString.length - decimalIndex - 1;
        }
    }

    protected override doClassValidation_(
        newValue?: any,
    ) {
        if (newValue === null) {
            return null;
        }

        // Clean up text.
        newValue = `${newValue}`;
        // TODO: Handle cases like 'ten', '1.203,14', etc.
        // 'O' is sometimes mistaken for '0' by inexperienced users.
        newValue = newValue.replace(/O/gi, '0');
        // Strip out thousands separators.
        newValue = newValue.replace(/,/g, '');
        // Ignore case of 'Infinity'.
        newValue = newValue.replace(/infinity/i, 'Infinity');

        // Clean up number.
        let n = Number(newValue || 0);
        if (isNaN(n)) {
            // Invalid number.
            return null;
        }
        // Get the value in range.
        n = Math.min(Math.max(n, this.min_), this.max_);
        // Round to nearest multiple of precision.
        if (this.precision_ && isFinite(n)) {
            n = Math.round(n / this.precision_) * this.precision_;
        }
        // Clean up floating point errors.
        if (this.decimalPlaces !== null) {
            n = Number(n.toFixed(this.decimalPlaces));
        }
        return n + "";
    }
}

export interface FieldNumberDropdownOptions extends FieldTextDropdownOptions {
    min?: number;
    max?: number;
    precision?: any;
}

export class FieldNumberDropdown extends BaseFieldNumberDropdown implements FieldCustom {
    public isFieldCustom_ = true;

    constructor(value: number | string, options: FieldNumberDropdownOptions, opt_validator?: Blockly.FieldValidator) {
        super(value, parseDropdownOptions(options), options.min, options.max, options.precision, opt_validator);
    }

    getOptions() {
        let newOptions: [string, string][];
        if (this.menuGenerator_) {
            if (typeof this.menuGenerator_ === "string") {
                this.menuGenerator_ = JSON.parse(this.menuGenerator_);
            }
            newOptions = this.menuGenerator_.map((x: number | string[]) => {
                if (typeof x == 'object') {
                    return [pxt.Util.rlf(x[0]), x[1]]
                } else {
                    return [String(x), String(x)]
                }
            });
        }
        return newOptions;
    }
}

function parseDropdownOptions(options: FieldTextDropdownOptions): [string, any][] {
    let result: [string, number][];
    if (options.values) {
        const parsed: [string, number][] = [];
        const data = options.values.split(",");

        let foundError = false;
        for (const entry of data) {
            const parsedValue = parseFloat(entry);

            if (Number.isNaN(parsedValue)) {
                foundError = true;
                break;
            }
            parsed.push([entry, parsedValue]);
        }

        if (!foundError) {
            result = parsed;
        }
    }
    else if (options.data) {
        try {
            const data = JSON.parse(options.data);
            if (Array.isArray(data) && data.length) {
                if (isNumberArray(data)) {
                    return data.map(d => ["" + d, d]);
                }
                else {
                    let foundError = false;
                    for (const value of data) {
                        if (
                            !Array.isArray(value) ||
                            typeof value[0] !== "string" ||
                            typeof value[1] !== "number"
                        ) {
                            foundError = true;
                            break;
                        }
                    }

                    if (!foundError) {
                        result = data;
                    }
                }
            }
        }
        catch (e) {
            // parse error
        }
    }

    if (result) {
        return result;
    }
    else {
        pxt.warn("Could not parse numberdropdown data field");
    }

    return [];
}

function isNumberArray(arr: any[]): arr is number[] {
    for (const val of arr) {
        if (typeof val !== "number") {
            return false;
        }
    }
    return true;
}