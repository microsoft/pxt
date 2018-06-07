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
            name: "Setting namespace color",
            id: "basic-ns-color",
            path: "basic/ns-color"
        },
        {
            chapter: "Basic",
            name: "Types of Blocks",
            id: "basic-types",
            path: "basic/types"
        },
        {
            chapter: "Basic",
            name: "Enumerations",
            id: "basic-enums",
            path: "basic/enums"
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
            name: "Dropdowns",
            id: "field-editors-dropdowns",
            path: "field-editors/dropdowns"
        },
        {
            chapter: "Field editors",
            name: "Grid picker",
            id: "field-editors-gridpicker",
            path: "field-editors/gridpicker"
        },
        {
            chapter: "Language",
            name: "Create Enums from Blocks",
            id: "language-create-enums",
            path: "language/create-enums"
        }
    ];

    if (typeof exports !== 'undefined') {
        exports.PLAY_SAMPLES = PLAY_SAMPLES
    } else {
        self.PLAY_SAMPLES = PLAY_SAMPLES;
    }

    })();