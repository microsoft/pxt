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
            name: "Color",
            id: "field-editors-color",
            path: "field-editors/color"
        },
        {
            chapter: "Field editors",
            name: "Dropdowns",
            id: "field-editors-dropdowns",
            path: "field-editors/dropdowns"
        }
    ];
    
    if (typeof exports !== 'undefined') {
        exports.PLAY_SAMPLES = PLAY_SAMPLES
    } else {
        self.PLAY_SAMPLES = PLAY_SAMPLES;
    }
    
    })();