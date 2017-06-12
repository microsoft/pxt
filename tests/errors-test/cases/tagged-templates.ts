let place = 'world'
let str = tag `Hello ${place}` // TS9265 tagged templates

function tag(literals: string[], placeholders: string) {
    return literals[0]
}
