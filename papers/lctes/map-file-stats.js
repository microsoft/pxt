let fs = require("fs")
let sums = { TOTAL: 0, "RAM.TOTAL": 0 }
let inprog = false
let inram = false
for (let line of fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/)) {
  if (/\*fill\*/.test(line)) continue
  if (/^r[oa]m\s/.test(line)) continue
  let m = /^ \.(\w+)/.exec(line)
  if (m) {
    if (m[1] == "text" || m[1] == "binmeta" || m[1] == "rodata" || m[1] == "data")
      inprog = true
    else
      inprog = false
    if (m[1] == "data" || m[1] == "bss")
      inram = true
    else
      inram = false
  }
  if (!inprog && !inram) continue
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

  let pref = inram ? "RAM." : ""

  // if (inram&&size > 500) console.log(line)

  name = pref + name

  //console.log(name, size, line)

  if (!sums[name]) sums[name] = 0
  sums[name] += size
  sums[pref + "TOTAL"] += size
}

for (let k of Object.keys(sums)) {
  console.log(k, Math.round(sums[k]/1024*1000)/1000)
}

