/// <reference path="..\..\built\pxtlib.d.ts" />

describe("comment attribute parser", () => {
    describe("default values for parameters", () => {
        it("should handle the eg. syntax", () => {
            const res = pxtc.parseCommentString(`
                /**
                 * Configures the Pulse-width modulation (PWM) of the analog output to the
                 * @param micros period in micro seconds. eg:20000
                 */
            `);

            chai.expect(res.paramDefl["micros"]).to.equal("20000");
        });

        it("should handle parameters using the .defl syntax", () => {
            const res = pxtc.parseCommentString(`
                //% micros.defl=20000
            `);

            chai.expect(res.paramDefl["micros"]).to.equal("20000");
        });

        it("should handle multiple parameters", () => {
            const res = pxtc.parseCommentString(`
                /**
                 * Configures the Pulse-width modulation (PWM) of the analog output to the
                 * @param micros period in micro seconds. eg:20000
                 * @param whatever period in milli seconds. eg:okay
                 * @param sure period in milli seconds. eg:true
                 */
                //% yep.defl=20000 hello.defl=18
            `);

            chai.expect(res.paramDefl["micros"]).to.equal("20000");
            chai.expect(res.paramDefl["whatever"]).to.equal("okay");
            chai.expect(res.paramDefl["sure"]).to.equal("true");
            chai.expect(res.paramDefl["yep"]).to.equal("20000");
            chai.expect(res.paramDefl["hello"]).to.equal("18");
        });


        it("should override the eg. syntax with the .defl syntax", () => {
            const res = pxtc.parseCommentString(`
                /**
                 * Configures the Pulse-width modulation (PWM) of the analog output to the
                 * @param micros period in micro seconds. eg:20000
                 */
                //% micros.defl=42
            `);

            chai.expect(res.paramDefl["micros"]).to.equal("42");
        });

        it("should allow quotes with the eg. syntax", () => {
            const res = pxtc.parseCommentString(`
                /**
                 * Configures the Pulse-width modulation (PWM) of the analog output to the
                 * @param micros period in micro seconds. eg:"20000"
                 * @param micros2 period in micro seconds. eg:''
                 * @param micros3 period in micro seconds. eg:"okay yes"
                 * @param micros4 period in micro seconds. eg:'okay yes'
                 */
            `);

            chai.expect(res.paramDefl["micros"]).to.equal("20000");
            chai.expect(res.paramDefl["micros2"]).to.equal("");
            chai.expect(res.paramDefl["micros3"]).to.equal(`"okay yes"`);
            chai.expect(res.paramDefl["micros4"]).to.equal(`"okay yes"`);
        });

        it("should allow quotes with the .defl syntax", () => {
            const res = pxtc.parseCommentString(`
                //% micros.defl="20000" micros2.defl=''
                //% micros3.defl="okay yes" micros4.defl='okay yes'
            `);

            chai.expect(res.paramDefl["micros"]).to.equal("20000");
            chai.expect(res.paramDefl["micros2"]).to.equal("");
            chai.expect(res.paramDefl["micros3"]).to.equal(`"okay yes"`);
            chai.expect(res.paramDefl["micros4"]).to.equal(`"okay yes"`);
        });
    });


    describe("min and max for parameters", () => {
        it("should not define the min and max objects if they are not set on any of the parameters", () => {
            const res = pxtc.parseCommentString(`
                //% micros.defl="20000" micros2.defl=''
                //% micros3.defl="okay yes" micros4.defl='okay yes'
            `);

            chai.expect(res.paramMin).to.be.undefined;
            chai.expect(res.paramMax).to.be.undefined;
        });

        it("should handle the min values set on parameters", () => {
            const res = pxtc.parseCommentString(`
                //% micros.min="20000" micros2.defl=''
                //% micros3.defl="okay yes" micros4.defl='okay yes'
            `);

            chai.expect(res.paramMin["micros"]).to.equal("20000");
            chai.expect(res.paramMax).to.be.undefined;
        });

        it("should handle the max values set on parameters", () => {
            const res = pxtc.parseCommentString(`
                //% micros.max="20000" micros2.defl=''
                //% micros3.defl="okay yes" micros4.defl='okay yes'
            `);

            chai.expect(res.paramMax["micros"]).to.equal("20000");
            chai.expect(res.paramMin).to.be.undefined;
        });
    });


    describe("field editor options", () => {
        it("should handle the .fieldeditor attribute", () => {
            const res = pxtc.parseCommentString(`
                //% micros.max="20000" micros2.fieldEditor='gridpicker'
                //% micros3.fieldEditor="whatever"
            `);

            chai.expect(res.paramFieldEditor["micros"]).to.be.undefined;
            chai.expect(res.paramFieldEditor["micros2"]).to.equal("gridpicker");
            chai.expect(res.paramFieldEditor["micros3"]).to.equal("whatever");
        });


        it("should handle .fieldoptions attributes", () => {
            const res = pxtc.parseCommentString(`
                //% micros.max="20000" micros2.fieldeditor='gridpicker' micros2.fieldOptions.field=9
                //% micros3.fieldOptions.something="whatever" micros2.fieldOptions.otherfield=okay
            `);

            chai.expect(res.paramFieldEditorOptions["micros"]).to.be.undefined;
            chai.expect(res.paramFieldEditorOptions["micros2"]["field"]).to.equal("9");
            chai.expect(res.paramFieldEditorOptions["micros2"]["otherfield"]).to.equal("okay");
            chai.expect(res.paramFieldEditorOptions["micros3"]["something"]).to.equal("whatever");
        });

        it("should handle .shadowoptions attributes", () => {
            const res = pxtc.parseCommentString(`
                //% micros.max="20000" micros2.fieldeditor='gridpicker' micros2.shadowOptions.field=9
                //% micros3.shadowOptions.something="whatever" micros2.shadowOptions.otherfield=okay
            `);

            chai.expect(res.paramShadowOptions["micros"]).to.be.undefined;
            chai.expect(res.paramShadowOptions["micros2"]["field"]).to.equal("9");
            chai.expect(res.paramShadowOptions["micros2"]["otherfield"]).to.equal("okay");
            chai.expect(res.paramShadowOptions["micros3"]["something"]).to.equal("whatever");
        });
    });


    describe("non-string attributes", () => {
        it("should parse 1 as true for boolean attributes", () => {
            const res = pxtc.parseCommentString(`
                //% advanced=1
            `);

            chai.expect(res.advanced).to.equal(true);
        });

        it("should parse 'true' as true for boolean attributes", () => {
            const res = pxtc.parseCommentString(`
                //% advanced=true
            `);

            chai.expect(res.advanced).to.equal(true);
        });

        it("should parse anything other than 1 or 'true' as false for boolean attributes", () => {
            const res = pxtc.parseCommentString(`
                //% advanced=TRUE
            `);

            chai.expect(res.advanced).to.equal(false);
        });

        it("should parse number attributes", () => {
            const res = pxtc.parseCommentString(`
                //% weight=97 imageLiteral="1234"
            `);

            chai.expect(res.weight).to.equal(97)
            chai.expect(res.imageLiteral).to.equal(1234);
        });

        it("should parse calling conventions", () => {
            const res = pxtc.parseCommentString(`
                //% weight=97 imageLiteral="1234"
            `);

            chai.expect(res.callingConvention).to.equal(pxtc.ir.CallingConvention.Plain);

            const res2 = pxtc.parseCommentString(`
                //% weight=97 imageLiteral="1234" async
            `);

            chai.expect(res2.callingConvention).to.equal(pxtc.ir.CallingConvention.Async);

            const res3 = pxtc.parseCommentString(`
                //% weight=97 imageLiteral="1234" promise
            `);

            chai.expect(res3.callingConvention).to.equal(pxtc.ir.CallingConvention.Promise);
        })
    });

    it("should grab parameter jsdoc", () =>  {
        const res = pxtc.parseCommentString(`
            /**
             * Configures the Pulse-width modulation (PWM) of the analog output to the
             * @param micros period in micro seconds. eg:20000
             * @param whatever period in milli seconds.
             */
            //% yep.defl=20000 hello.defl=18
        `);

        chai.expect(res.paramHelp["micros"]).to.equal("period in micro seconds. eg:20000");
        chai.expect(res.paramHelp["whatever"]).to.equal("period in milli seconds.");
    });

    it("should grab method jsdoc", () =>  {
        const res = pxtc.parseCommentString(`
            /**
             * Configures the Pulse-width modulation (PWM) of the analog
             * output to the
             * @param micros period in micro seconds. eg:20000
             * @param whatever period in milli seconds.
             */
            //% yep.defl=20000 hello.defl=18
        `);

        chai.expect(res.jsDoc).to.equal("Configures the Pulse-width modulation (PWM) of the analog\noutput to the");
    });

    describe("parsing block definition string", () => {
        it("should handle simple text", () => {
            parseDef("hello", `hello`);
        });

        it("should cut out pipes", () => {
            parseDef("hello|world|its|2018", `hello`, brk(), `world`, brk(), `its`, brk(), `2018`);
        });

        describe("style", () => {
            it("should handle italics", () => {
                parseDef("*hello* _world_", i`hello`, ` `, i`world`);
            });

            it("should handle bold", () => {
                parseDef("**hello** __world__", b`hello`, ` `, b`world`);
            });

            it("should handle nested italics", () => {
                parseDef("*hello_ _world*", i`hello`, i` `, i`world`);
                parseDef("*_hello world_*", i`hello world`);
            });

            it("should handle nested bold", () => {
                parseDef("**hello__ __world**", b`hello`, b` `, b`world`);
                parseDef("**__hello world__**", b`hello world`);
            });

            it("should handle overlapping styles", () => {
                parseDef("*hello** **world*", i`hello`, ib` `, i`world`);
                parseDef("**_hello_ world**", ib`hello`, b` world`);
                parseDef("*__hello__ __world__*", ib`hello`, i` `, ib`world`);
            });

            it("should handle triple style marks", () => {
                parseDef("***good***___morning_everyone__", ib`good`, ib`morning`, b`everyone`);
            });

            describe("errors", () => {
                it("should not allow orphaned style tags", () => {
                    parseDef("hello_world %arg", `hello_world `, param`arg`);
                });

                it("should not allow mismatched style tags", () => {
                    parseDef("*hello_", `*hello_`);
                    parseDef("***hello_", `***hello_`);
                    parseDef("_hello***", `_hello***`)
                });

                it("should not allow style tags around pipes", () => {
                    parseDef("*hello|world*", `*hello`, brk(), `world*`);
                    parseDef("***hello|world***", `***hello`, brk(), `world***`);
                });

                it("should not allow style tags around parameters", () => {
                    parseDef("*hello %the world*", `*hello `, param`the`, ` world*`);
                    parseDef("hello *%the* world", `hello *`, param`the`, `* world`);
                });
            })
        });

        describe("images", () => {
            it("should handle simple images", () => {
                parseDef("`image`text", img`image`, `text`)
            });

            it("should handle images that include special characters", () => {
                parseDef("`*|= _`", img`*|= _`)
            });

            it("should allow images within style marks", () => {
                parseDef("*`image`*", img`image`);
                parseDef("**text`image`text**", b`text`, img`image`, b`text`);
            });

            describe("errors", () => {
                it("should not allow unterminated image markup", () => {
                    parseDef("`I forgot to close it", "`I forgot to close it");
                });
            });
        });

        describe("tagged text", () => {
            it("should allow you to add custom CSS classes", () => {
                parseDef("[some text](custom)", tag`some text`);
            });

            it("should not parse anything inside the brackets", () => {
                parseDef("[`!@#$%^&*()_](custom)", tag`\`!@#$%^&*()_`);
            });

            it("should not break up styles", () => {
                parseDef("*hello [there](custom)*", i`hello `, tag`there`);
            });

            describe("errors", () => {
                it("should not allow unclosed brackets", () => {
                    parseDef("[some text(custom)", `[some text(custom)`)
                });

                it("should not allow unclosed parens", () => {
                    parseDef("[some text](custom", `[some text](custom`)
                });

                it("should not allow brackets that are not followed by parens", () => {
                    parseDef("[some text] (custom)", `[some text] (custom)`)
                });
            });
        });

        describe("escape sequences", () => {
            it("should handle escaped special characters", () => {
                parseDef("\\\\ \\* \\_ \\` \\|", `\\ * _ \` |`);
                parseDef("\\", `\\`);
            });

            it("should handle an escape at the end of a string", () => {
                parseDef("\\", `\\`);
            });

            it("should handle escapes within styles", () => {
                parseDef("*hello\\*world*", i`hello*world`);
            });
        });

        describe("parameters", () => {
            it("should handle just a parameter", () => {
                parseDef("%hello", param`hello`);
            });

            it("should handle parameters with shadow types", () => {
                parseDef("%hello=world", param`hello=world`);
            });

            it("should allow parameters with underscores", () => {
                parseDef("%hello_world=its_2018", param`hello_world=its_2018`);
            });

            it("should allow parameters mixed with text", () => {
                parseDef("text %hello=world %cool", `text `, param`hello=world`, ` `, param`cool`);
            });

            it("should terminate parameters with non-identifier characters", () => {
                parseDef("%hello|world", param`hello`, brk(), `world`);
                parseDef("%hello world", param`hello`, ` world`);
                parseDef("%hello*world*", param`hello`, i`world`);
                parseDef("%hello\\world", param`hello`, `world`);
            });

            it("should mark parameters starting with $ as refs", () => {
                parseDef("$hello|world", paramRef`hello`, brk(), `world`);
            });

            it("should allow parameter names to be specified using parens", () => {
                parseDef(`$hello=variables_get(someName)`, paramVar`hello=someName`);
                parseDef(`$hello=variables_get(  `, paramRef`hello=variables_get`, `(  `);
            });

            describe("errors", () => {
                it("should not allow parameters with too many equals", () => {
                    parseDef("%no=good=", `%no=good=`)
                    parseDef("%still=no=good", `%still=no=good`)
                });
            })
        });
    });

    it("should allow overrides of shadow values in the block string", () => {
        const parsed = pxtc.parseCommentString(`
            /**
             * Configures the Pulse-width modulation (PWM) of the analog
             * output to the
             * @param micros period in micro seconds. eg:20000
             * @param whatever period in milli seconds.
             */
            //% block="$micros $whatever=oldShadowBlock"
            //% micros.shadow="shadowBlock1"
            //% whatever.shadow="shadowBlock2"
        `)._def;

        checkParam("micros", "shadowBlock1");
        checkParam("whatever", "shadowBlock2")

        function checkParam(name: string, shadow: string) {
            chai.assert(parsed.parameters.filter(p => p.name === name && p.shadowBlockId == shadow).length == 1);
            chai.assert(parsed.parts.filter(p => p.kind === "param" && p.name === name && p.shadowBlockId == shadow).length === 1);
        }
    });

    it("should allow shadow values in the block string to be unset", () => {
        const parsed = pxtc.parseCommentString(`
            /**
             * Configures the Pulse-width modulation (PWM) of the analog
             * output to the
             * @param micros period in micro seconds. eg:20000
             * @param whatever period in milli seconds.
             */
            //% block="$micros $whatever=oldShadowBlock"
            //% whatever.shadow="unset"
            //% micros.shadow="unset"
        `)._def;

        checkParam("micros", undefined);
        checkParam("whatever", undefined);

        function checkParam(name: string, shadow: string) {
            chai.assert(parsed.parameters.filter(p => p.name === name && p.shadowBlockId == shadow).length == 1);
            chai.assert(parsed.parts.filter(p => p.kind === "param" && p.name === name && p.shadowBlockId == shadow).length === 1);
        }
    });
});

function brk(): pxtc.BlockBreak {
    return { kind: "break" };
}

function lbl(text: string, style: string[]): pxtc.BlockLabel {
    return { kind: "label", text, style };
}

function i(parts: TemplateStringsArray): pxtc.BlockLabel {
    return lbl(parts[0], ["italics"]);
}

function b(parts: TemplateStringsArray): pxtc.BlockLabel {
    return lbl(parts[0], ["bold"]);
}

function ib(parts: TemplateStringsArray): pxtc.BlockLabel {
    return lbl(parts[0], ["bold", "italics"]);
}

function img(parts: TemplateStringsArray): pxtc.BlockImage {
    return { kind: "image", uri: parts[0] };
}

function tag(parts: TemplateStringsArray): pxtc.BlockLabel {
    return { kind: "label", text: parts[0], cssClass: "custom" };
}

function param(parts: TemplateStringsArray): pxtc.BlockParameter {
    const split = parts[0].split("=");

    return { kind: "param", name: split[0], shadowBlockId: split[1], ref: false } as pxtc.BlockParameter;
}

function paramRef(parts: TemplateStringsArray): pxtc.BlockParameter {
    const res = param(parts);
    res.ref = true;
    return res;
}

function paramVar(parts: TemplateStringsArray): pxtc.BlockParameter {
    const split = parts[0].split("=");

    return { kind: "param", name: split[0], shadowBlockId: "variables_get", ref: true, varName: split[1] } as pxtc.BlockParameter;
}

function parseDef(def: string, ...expected: (string | pxtc.BlockPart)[]) {
    const res = pxtc.parseBlockDefinition(def);

    if (expected && expected.length) {
        chai.expect(res).to.not.be.undefined;

        const expectedParts: pxtc.BlockPart[] = [];
        const expectedParams: pxtc.BlockParameter[] = [];
        expected.forEach(v => {
            if (typeof v === "string") {
                expectedParts.push({ kind: "label", text: v, style: [] })
            }
            else {
                expectedParts.push(v)
                if ((v as pxtc.BlockParameter).name) {
                    expectedParams.push(v as pxtc.BlockParameter);
                }
            }
        });

        chai.expect(res.parts).to.deep.equal(expectedParts, JSON.stringify(res.parts, null, 4) + " != " + JSON.stringify(expectedParts, null, 4));
        chai.expect(res.parameters).to.deep.equal(expectedParams, JSON.stringify(res.parameters, null, 4) + " != " + JSON.stringify(expectedParams, null, 4));
    }
    else {
        chai.expect(res).to.equal(undefined, "Expected `" + def + "` to error");
    }
}