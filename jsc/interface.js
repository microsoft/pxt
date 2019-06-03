var compileResult = undefined
var compileStatus = 0

function startCompile(files) {
  compileStatus = 0
  compileResult = undefined
  pxt.setAppTarget(pxtTargetBundle)
  pxt.setHwVariant("vm")
  print("start compile")
  pxt.simpleCompileAsync(JSON.parse(files), true)
    .then(r => {
      print("compile finished; success=" + r.success)
      if (!r.success) {
        compileResult = r.diagnostics.map(ts.pxtc.getDiagnosticString).join("\n")
          || "Unknown error."
        compileStatus = 2
      } else {
        compileResult = ts.pxtc.decodeBase64(r.outfiles[ts.pxtc.BINARY_PXT64])
        compileStatus = 1
      }
    }).then(v => { }, err => {
      compileResult = err.stack || err.message || "Exception."
      compileStatus = 2
    })
}
