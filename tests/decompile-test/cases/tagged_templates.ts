/// <reference path="./testBlocks/templateStrings.ts" />


let template_test = template.create(img`0123`)


let template_test2 = template.create(img`
0


1
2
3`)

let bad_template = template.create(badt`0123`)