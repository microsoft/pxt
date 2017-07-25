/// <reference path="..\..\typings\globals\mocha\index.d.ts" />
/// <reference path="..\..\localtypings\chai.d.ts" />
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
});