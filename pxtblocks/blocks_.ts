// Add to cacheBlockDefinitions() in pxtlib/blocks.ts
'geometry_area': {
    name: Util.lf("area operation"),
    tooltip: {
        "square": Util.lf("area of a square"),
        "circle": Util.lf("area of a circle"),
        "triangle": Util.lf("area of a triangle")
    },
    url: '/blocks/geometry',
    operators: {
        "OP": ["square", "circle", "triangle"]
    },
    category: 'math',
    block: {
        "square": Util.blf("{id:op}square"),
        "circle": Util.blf("{id:op}circle"),
        "triangle": Util.blf("{id:op}triangle")
    }
},
