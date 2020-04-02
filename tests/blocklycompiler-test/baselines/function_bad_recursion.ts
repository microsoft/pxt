function bad_recursion (): any {
    return bad_recursion()
}
function bad_indirect_recursion1 (): any {
    return bad_indirect_recursion2()
}
function bad_indirect_recursion2 (): any {
    return bad_indirect_recursion1()
}
