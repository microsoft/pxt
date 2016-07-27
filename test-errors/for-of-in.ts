let xs = [13, 42, 73]

for (let x in xs) {} // TS9202 0, 1, 2
for (let x of xs) {} // Now supported!
