let fs = require("fs")
let sums = { TOTAL: 0 }
let inprog = false
for (let line of fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/)) {
  let m = /^ \.(\w+)/.exec(line)
  if (m) {
    if (m[1] == "text" || m[1] == "binmeta" || m[1] == "rodata" || m[1] == "data")
      inprog = true
    else
      inprog = false
  }
  if (!inprog) continue
  m = /\s+(0x00[a-f0-9]+)\s+(0x[a-f0-9]+)\s+(.*)/.exec(line)
  if (!m) continue
  let addr = parseInt(m[1])
  let size = parseInt(m[2])
  if (!addr || !size) continue
  let name = m[3] 
  if (/load address/.test(name)) continue
  name = name.replace(/.*\/lib/, "lib")
    .replace("CMakeFiles/CIRCUIT_PLAYGROUND.dir/", "")

    .replace(/\(.*/, "") // can remove
    .replace(/pxtapp\/.*/, "pxtapp")
    .replace(/libcodal-.*/, "codal")

  if (!sums[name]) sums[name] = 0
  sums[name] += size
  sums["TOTAL"] += size
}

for (let k of Object.keys(sums)) {
  console.log(k, Math.round(sums[k]/1024*100)/100)
}

