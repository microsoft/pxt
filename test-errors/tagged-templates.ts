let place = 'world'
let str = tag `Hello ${place}` // TS9202 tagged templates

function tag(literals: string[], placeholders: string) {
    return literals[0]
}
