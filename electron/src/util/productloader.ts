"use strict";

import * as path from "path";
import { ProductInformation } from "../typings/interfaces"

const productJsonPath = path.join(__dirname, "..", "product.json");
let product = require(productJsonPath) as ProductInformation;
const targetPkgJsonPath = path.join(__dirname, "..", "node_modules", product.targetId, "package.json");

try {
    const pkgJson = require(targetPkgJsonPath);
    product.version = pkgJson.version;
} catch (e) {
    console.log("Error setting product version: " + e);
}

export default product;