all:
	cd src; node ../node_modules/typescript/bin/tsc
	cat node_modules/typescript/lib/typescript.js built/tsmbit.js > built/tsm.js
	cd mbitsim; node ../node_modules/typescript/bin/tsc
	cd mbitprj; node ../built/tsm.js *.ts
	cd mbitprj; node ../built/sim.js
