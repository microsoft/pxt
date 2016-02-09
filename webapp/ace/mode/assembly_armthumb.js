/* Custom mode for ARM Thumb assembly as implemented in embedded/thumb.ts; based on ACE's assembly_x86 mode.
 */
ace.define("ace/mode/assembly_armthumb_highlight_rules",["require","exports","module", "ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;



var AssemblyArmThumbHighlightRules = function() {

    this.$rules = { start: 
       [ { token: 'keyword.control.assembly',
           regex: '\\b(?:adcs|add|adds|adr|ands|asrs|b|bal|bcc|bcs|beq|bge|bgt|bhi|bhs|bics|bkpt|bl|ble|blo|bls|blt|blx|bmi|bne|bpl|bvc|bvs|bx|cmn|cmp|eors|ldmia|ldr|ldrb|ldrh|ldrsb|ldrsh|lsls|lsrs|mov|movs|muls|mvns|negs|nop|orrs|pop|push|rev|rev16|revsh|rors|sbcs|sev|stmia|str|strb|strh|sub|subs|svc|sxtb|sxth|tst|udf|uxtb|uxth|wfe|wfi|yield|cpsid|cpsie)\\b',
           caseInsensitive: true },
         { token: 'variable.parameter.register.assembly',
           regex: '\\b(?:r[0-9]|r1[0-5]|pc|lr|sp)\\b',
           caseInsensitive: true },
         { token: 'constant.character.decimal.assembly',
           regex: '\\b[0-9]+\\b' },
         { token: 'constant.character.hexadecimal.assembly',
           regex: '\\b0x[A-F0-9]+\\b',
           caseInsensitive: true },
         { token: 'string.assembly', regex: /"([^\\"]|\\.)*"/ },
         { token: 'support.function.directive.assembly',
           regex: '^\\s*\\.(?:ascii|asciz|string|align|balign|hword|short|2bytes|word|4bytes|skip|space|section|global)\\b' },
         { token: 'support.function.directive.assembly',
           regex: '^\\s*\\@(?:stackmark|stackempty)\\b' },
         { token: 'entity.name.function.assembly', regex: '^[\\w.]+?:' },
         { token: 'comment.assembly', regex: ';.*$' } ] 
    }
    
    this.normalizeRules();
};

AssemblyArmThumbHighlightRules.metaData = { fileTypes: [ 'asm' ],
      name: 'Assembly ARM Thumb',
      scopeName: 'source.assembly' }


oop.inherits(AssemblyArmThumbHighlightRules, TextHighlightRules);

exports.AssemblyArmThumbHighlightRules = AssemblyArmThumbHighlightRules;
});


ace.define("ace/mode/assembly_armthumb",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/assembly_armthumb_highlight_rules","ace/mode/folding/coffee"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var AssemblyArmThumbHighlightRules = acequire("./assembly_armthumb_highlight_rules").AssemblyArmThumbHighlightRules;

var Mode = function() {
    this.HighlightRules = AssemblyArmThumbHighlightRules;
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = ";";
    this.$id = "ace/mode/assembly_armthumb";
}).call(Mode.prototype);

exports.Mode = Mode;
});
