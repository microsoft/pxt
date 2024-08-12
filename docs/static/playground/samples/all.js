(function() {

    var PLAY_SAMPLES = [
        {
            chapter: "Basic",
            name: "Hello world!",
            id: "basic-hello-world",
            path: "basic/hello-world"
        },
        {
            chapter: "Basic",
            name: "Formatting",
            id: "basic-formatting",
            path: "basic/formatting"
        },
        {
            chapter: "Basic",
            name: "Default values",
            id: "basic-default-values",
            path: "basic/default-values"
        },
        {
            chapter: "Basic",
            name: "Set namespace color",
            id: "basic-ns-color",
            path: "basic/ns-color"
        },
        {
            chapter: "Basic",
            name: "Groups",
            id: "basic-groups",
            path: "basic/groups"
        },
        {
            chapter: "Basic",
            name: "Ordering",
            id: "basic-ordering",
            path: "basic/ordering"
        },
        {
            chapter: "Basic",
            name: "Types of blocks",
            id: "basic-types",
            path: "basic/types"
        },
        {
            chapter: "Basic",
            name: "Input format",
            id: "basic-input-format",
            path: "basic/input-format"
        },
        {
            chapter: "Basic",
            name: "Enumerations",
            id: "basic-enums",
            path: "basic/enums"
        },
        {
            chapter: "Basic",
            name: "Set variable names",
            id: "basic-variable-names",
            path: "basic/variable-names"
        },
        {
            chapter: "Basic",
            name: "Array default values",
            id: "basic-array-default-values",
            path: "basic/array-default-values"
        },
        {
            chapter: "Field editors",
            name: "Range",
            id: "field-editors-range",
            path: "field-editors/range"
        },
        {
            chapter: "Field editors",
            name: "Color",
            id: "field-editors-color",
            path: "field-editors/color"
        },
        {
            chapter: "Field editors",
            name: "Grid picker",
            id: "field-editors-gridpicker",
            path: "field-editors/gridpicker"
        },
        {
            chapter: "Field editors",
            name: "Toggle",
            id: "field-editors-toggle",
            path: "field-editors/toggle"
        },
        {
            chapter: "Field editors",
            name: "Note",
            id: "field-editors-note",
            path: "field-editors/note"
        },
        {
            chapter: "Field editors",
            name: "Protractor",
            id: "field-editors-protractor",
            path: "field-editors/protractor"
        },
        {
            chapter: "Field editors",
            name: "Speed",
            id: "field-editors-speed",
            path: "field-editors/speed"
        },
        {
            chapter: "Field editors",
            name: "Turn ratio",
            id: "field-editors-turn-ratio",
            path: "field-editors/turnratio"
        },
        {
            chapter: "Language",
            name: "Functions",
            id: "functions",
            path: "language/functions"
        },
        {
            chapter: "Language",
            name: "Events",
            id: "events",
            path: "language/events"
        },
        {
            chapter: "Language",
            name: "Creating enums",
            id: "language-create-enums",
            path: "language/create-enums"
        },
        {
            chapter: "Language",
            name: "Classes",
            id: "classes",
            path: "language/classes"
        },
        {
            chapter: "Language",
            name: "Factories",
            id: "factories",
            path: "language/factories"
        },
        {
            chapter: "Language",
            name: "Fixed Instances",
            id: "fixed-instances",
            path: "language/fixed-instances"
        }
    ];

    if (typeof exports !== 'undefined') {
        exports.PLAY_SAMPLES = PLAY_SAMPLES
    } else {
        self.PLAY_SAMPLES = PLAY_SAMPLES;
    }

    })();