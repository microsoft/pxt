SEMJS = behaviors/api.js behaviors/colorize.js behaviors/form.js behaviors/state.js behaviors/visibility.js behaviors/visit.js \
    modules/accordion.js modules/checkbox.js modules/dimmer.js modules/dropdown.js modules/embed.js modules/modal.js modules/nag.js \
    modules/popup.js modules/progress.js modules/rating.js modules/search.js modules/shape.js modules/sidebar.js modules/sticky.js \
    modules/tab.js modules/transition.js modules/video.js \
    globals/site.js

all: built/style.css built/semantic.js built/themes
	cp node_modules/jquery/dist/jquery.js built/
	cp ../built/yelmlib.js built/
	cp ../node_modules/typescript/lib/typescript.js built/
	node node_modules/typescript/lib/tsc
	node node_modules/browserify/bin/cmd built/src/app.js -o built/main.js

built/themes:
	cp -r node_modules/semantic-ui-less/themes built/

built/style.css:
	mkdir -p built
	node node_modules/less/bin/lessc style.less built/style.css --include-path=node_modules/semantic-ui-less


built/semantic.js:
	for f in $(SEMJS) ; do cat node_modules/semantic-ui-less/definitions/$$f ; echo ; done > built/semantic.js
