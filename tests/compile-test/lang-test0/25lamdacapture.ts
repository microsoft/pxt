function testInnerLambdaCapture() {
    msg("testInnerLambdaCapture");
    glb1 = 0
    let a = 7
    let g = () => {
        let h = () => {
            glb1 += a
        }
        h()
    }
    g()
    assert(glb1 == 7, "7")
}
testInnerLambdaCapture()
