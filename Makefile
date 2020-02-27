all:
	gulp

test:
	gulp test

clean:
	gulp clean

TSC = node ../node_modules/typescript/bin/tsc

.PHONY: cli

built/%.d.ts: %/*.ts %/*/*.ts
	@echo "[tsc] $@"
	@cd $*; $(TSC)

built/%.md5: built/%.d.ts
	@md5sum < $< > built/md5-tmp
	@cmp -s built/md5-tmp $@ || cp built/md5-tmp $@

CLI_DEPS = \
	pxtcompiler/ext-typescript/lib/typescript.js \
	built/pxtlib.js \
	built/pxtcompiler.js \
	built/pxtpy.js \
	built/pxtsim.js \
	built/cli.js

JS_HEADER = '"use strict"; global.savedModuleExports = module.exports; module.exports = null;'

built/pxtpy.d.ts: built/pxtlib.md5 built/pxtcompiler.md5
built/pxteditor.d.ts: built/pxtlib.md5 built/pxtblocks.md5
built/pxtblocks.d.ts: built/pxtlib.md5
built/pxtrunner.d.ts: built/pxtlib.md5 built/pxtsim.md5 built/pxtcompiler.md5 built/pxteditor.md5 built/pxtblocks.md5
built/cli.d.ts: built/pxtlib.md5 built/pxtcompiler.md5 built/pxtpy.md5 built/pxtsim.md5

built/pxt.js: built/cli.d.ts $(CLI_DEPS) Makefile
	@echo "[cat] $@"
	@(echo $(JS_HEADER); cat $(CLI_DEPS)) > $@

cli:
	@$(MAKE) -j8 built/pxt.js
	@$(MAKE) built/pxt.js
