var compileResult = null
function pollCompileResult() { return compileResult }
function startCompile(files) {
  pxt.setAppTarget(pxtTargetBundle)
  pxt.setHwVariant("vm")
  pxt.simpleCompileAsync(JSON.parse(files), true)
    .then(r => {
      compileResult = r
    }, err => {
      compileResult = { error: err.message, stack: err.stack }
    })
}
