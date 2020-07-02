(async function () {
    const body = document.body;
    const container = document.getElementById("container");
    const editor = document.getElementById("editor");
    const editor2 = document.getElementById("editor2");
    const selectapp = document.getElementById("selectapp");
    const facecamcontainer = document.getElementById("facecam");
    const facecam = document.getElementById("facecamvideo");
    const facecamlabel = document.getElementById("facecamlabel");
    const hardwarecam = document.getElementById("hardwarecamvideo");
    const hardwarecamlabel = document.getElementById("hardwarecamlabel");
    const chat = document.getElementById("chat");
    const settings = document.getElementById("settings");
    const editorStyle = document.getElementById("editorstyle");
    const toolbox = document.getElementById("toolbox");
    const paintbox = document.getElementById("paintbox");
    const paint = document.getElementById('paint');
    const paintCtx = paint.getContext('2d');
    const painttool = document.getElementById('painttool');
    const painttoolCtx = painttool.getContext('2d');
    const recorder = document.getElementById('recorder')
    const countdown = document.getElementById('countdown')
    const titleEl = document.getElementById('title')
    const subtitles = document.getElementById('subtitles')
    const startvideo = document.getElementById('startvideo');
    const endvideo = document.getElementById('endvideo');
    const backgroundvideo = document.getElementById('backgroundvideo')

    const frames = [editor, editor2];
    const paintColors = ["#ffe135", "#00d9ff", "#cf1fdb", "#ee0000"];

    const scenes = ["leftscene", "rightscene", "chatscene", "countdownscene"];
    const LEFT_SCENE_INDEX = scenes.indexOf("leftscene")
    const RIGHT_SCENE_INDEX = scenes.indexOf("rightscene")
    const CHAT_SCENE_INDEX = scenes.indexOf("chatscene")
    const COUNTDOWN_SCENE_INDEX = scenes.indexOf("countdownscene")
    const DISPLAY_DEVICE_ID = "display"
    const STREAMER_ID = "streamer"
    const state = {
        sceneIndex: -1,
        left: false,
        chat: false,
        hardware: false,
        painttool: undefined,
        recording: undefined,
        timerEnd: undefined,
        thumbnail: false,
        paintColor: paintColors[0]
    }
    let editorConfigs;

    try {
        tickEvent("streamer.load.start")
        body.classList.add("loading");
        console.log(`loading...`)
        editorConfigs = await fetchJSON("editors.json");
        console.log(`found ${Object.keys(editorConfigs).length} editors`)

        initMessages();
        initResize();
        initVideos();
        initSubtitles();
        initAccessibility();
        loadPaint();
        loadEditor()
        loadToolbox()
        loadChat()
        loadSocial()
        await firstLoadFaceCam()
        await loadHardwareCam()
        await loadSettings()
        loadVideos()
        setScene("right")
        render()
        handleHashChange();
        tickEvent("streamer.load.ok")
    } catch (e) {
        tickEvent("streamer.load.error")
        trackException(e);
        console.error(e)
    }

    function saveConfig(config) {
        if (!config) throw "missing config"
        localStorage["streamer.config"] = JSON.stringify(config)
    }

    async function showSettings() {
        await loadSettings()
        settings.classList.remove("hidden")
    }

    async function hideSettings() {
        settings.classList.add("hidden")
    }

    function toggleSettings() {
        if (/hidden/.test(settings.className))
            showSettings();
        else
            hideSettings();
    }

    function readConfig() {
        try {
            const cfg = JSON.parse(localStorage["streamer.config"]);
            if (cfg) {
                return cfg;
            }
        } catch (e) {
            console.log(e)
        }

        const cfg = {
            editor: "microbit",
            multiEditor: false,
            faceCamLabel: "",
            hardwareCamLabel: "",
            emojis: "😄🤔😭👀",
            micDelay: 300,
            title: "STARTING SOON"
        }
        saveConfig(cfg)
        return cfg;
    }

    async function fetchJSON(url) {
        const resp = await fetch(url)
        const json = await resp.json();
        return json;
    }

    function render() {
        loadToolbox();

        const config = readConfig();

        body.className = [
            scenes[state.sceneIndex],
            state.hardware && "hardware",
            state.chat && "chat",
            config.multiEditor && "multi",
            state.paint && "paint",
            state.micError && "micerror",
            state.recording && "recording",
            state.screenshoting && "screenshoting",
            (config.faceCamGreenScreen || config.hardwareCamGreenScreen) && state.thumbnail && "thumbnail",
            config.micDelay === undefined && "micdelayerror",
            !navigator.mediaDevices.getDisplayMedia && "displaymediaerror",
            config.faceCamLabel && !config.faceCamCircular && "facecamlabel",
            config.hardwareCamLabel && !config.hardwareCamCircular && "hardwarecamlabel",
            config.faceCamCircular && "facecamcircular",
            config.hardwareCamCircular && "hardwarecamcircular",
            config.faceCamId === DISPLAY_DEVICE_ID && "facecamdisplay",
            config.hardwareCamId === DISPLAY_DEVICE_ID && "hardwarecamdisplay",
            config.greenScreen && "greenscreen",
            config.backgroundVideo ? "backgroundvideo" : config.backgroundImage && "parallax",
            config.countdownEditor && "countdowneditor",
            config.countdownEditorBlur && "countdowneditorblur",
            config.fullScreenEditor && !config.multiEditor && "slim"
        ].filter(cls => !!cls).join(' ');
        if (!config.faceCamId || state.faceCamError)
            showSettings();
        facecamlabel.innerText = config.faceCamLabel || ""
        hardwarecamlabel.innerText = config.hardwareCamLabel || ""
    }

    function loadToolbox() {
        const config = readConfig();
        toolbox.innerHTML = "";
        paintbox.innerHTML = "";

        // paint
        const emojis = [];
        if (config.emojis)
            for (let i = 0; i < config.emojis.length; i += 2)
                emojis[i >> 1] = config.emojis.substr(i, 2);
        addPaintButton("ArrowTallUpLeft", "Draw arrow (Alt+Shift+A)", "arrow")
        addPaintButton("RectangleShape", "Draw rectangle (Alt+Shift+R)", "rect")
        addPaintButton("PenWorkspace", "Draw freeform", "pen")
        addPaintButton("Highlight", "Highligh", "highlight")
        addSep(paintbox)
        paintColors.forEach(addColorButton);
        addSep(paintbox)
        emojis.forEach(addEmojiButton);
        addSep(paintbox)
        addWhiteboardButton(paintbox)
        addButton(paintbox, "EraseTool", "Undo last drawing", popPaintEvent)
        addSep(paintbox)
        addButton(paintbox, "ChromeClose", "Exit paint mode", stopPaint)

        // tools
        const currentScene = scenes[state.sceneIndex];
        if (currentScene == "countdownscene") {
            addButton(toolbox, "Add", "Add 1 minute to countdown", () => updateCountdown(60))
            addButton(toolbox, "Remove", "Remove 1 minute from countdown", () => updateCountdown(-60))
            addSep(toolbox)
        }

        addSceneButton("OpenPane", "Move webcam left (Alt+Shift+2)", "left")
        addSceneButton("OpenPaneMirrored", "Move webcam right (Alt+Shift+3)", "right")
        addSceneButton("Contact", "Webcam large (Alt+Shift+4)", "chat")
        addSceneButton("Timer", "Show countdown (Alt+Shift+5)", "countdown")
        if (config.hardwareCamId || config.twitch || config.faceCamGreenScreen || config.hardwareCamGreenScreen) {
            addSep(toolbox)
            if (config.faceCamGreenScreen || config.hardwareCamGreenScreen)
                addButton(toolbox, "PictureCenter", "Toggle thumbnail mode (Alt+Shift+6)", toggleThumbnail, state.thumbnail)
            if (config.hardwareCamId)
                addButton(toolbox, "Robot", "Hardware webcam (Alt+Shift+7)", toggleHardware, state.hardware)
            if (config.twitch)
                addButton(toolbox, "OfficeChat", "Chat  (Alt+Shift+8)", toggleChat, state.chat)
        }

        if (config.extraSites && config.extraSites.length) {
            addSep(toolbox);
            config.extraSites.forEach(addSiteButton)
            addButton(toolbox, "Code", "Reload MakeCode editor", loadEditor)
        }

        addSep(toolbox)
        if (state.speech)
            addButton(toolbox, "ClosedCaption", "Captions", toggleSpeech, state.speechRunning)
        if (!!navigator.mediaDevices.getDisplayMedia) {
            addButton(toolbox, "BrowserScreenShot", "Take screenshot", takeScreenshot);
            if (state.recording)
                addButton(toolbox, "Stop", "Stop recording", stopRecording)
            else
                addButton(toolbox, "Record2", "Start recording", startRecording)
        }

        addButton(toolbox, "Settings", "Show settings", toggleSettings);

        function addSep(container) {
            const sep = document.createElement("div")
            sep.className = "sep"
            container.append(sep)
        }

        function addButton(container, icon, title, handler, active) {
            const btn = document.createElement("button")
            accessify(btn);
            btn.title = title
            btn.addEventListener("click", function (e) {
                tickEvent("streamer.button", { button: icon }, { interactiveConsent: true })
                container.classList.remove("opaque")
                handler(e)
            }, false)
            const i = document.createElement("i")
            btn.append(i)
            if (active)
                btn.classList.add("active")
            i.className = `ms-Icon ms-Icon--${icon}`
            container.append(btn)
            return btn;
        }

        function addColorButton(color) {
            const btn = addButton(paintbox, "CircleShapeSolid", color, function () {
                tickEvent("streamer.color", { color }, { interactiveConsent: true })
                state.paintColor = color;
                loadToolbox();
            }, state.paintColor === color);
            btn.style.color = color;
        }

        function addEmojiButton(emoji) {
            const btn = document.createElement("button")
            accessify(btn);
            btn.className = "emoji"
            if (emoji === state.emoji)
                btn.classList.add("active")
            btn.innerText = emoji;
            btn.addEventListener("click", function (e) {
                tickEvent("streamer.emoji", { emoji }, { interactiveConsent: true })
                state.emoji = emoji;
                setPaintTool("emoji")
            }, false)
            paintbox.append(btn)
        }

        function addSiteButton(url) {
            addButton(toolbox, "SingleBookmark", url, () => setSite(url), false)
        }

        function addPaintButton(icon, title, tool) {
            addButton(paintbox, icon, title, () => setPaintTool(tool), state.paint && state.painttool == tool);
        }

        function addSceneButton(icon, title, scene) {
            const sceneIndex = scenes.indexOf(`${scene}scene`)
            addButton(toolbox, icon, title, () => setScene(scene), state.sceneIndex == sceneIndex)
        }

        function addWhiteboardButton(paintbox) {
            addButton(paintbox, "WhiteBoardApp32", "Paint screen in white", () => {
                if(!state.paint)
                    setPaintTool("pen")
                pushPaintEvent("whiteboard")
            })
        }
    }

    function setSite(url) {
        const config = readConfig();
        if (config.multiEditor && state.sceneIndex == LEFT_SCENE_INDEX)
            editor2.src = url;
        else
            editor.src = url;
    }

    function setScene(scene) {
        tickEvent("streamer.scene", { scene: scene });
        const config = readConfig();
        const lastScene = state.sceneIndex;
        const sceneIndex = scenes.indexOf(`${scene}scene`);
        if (state.sceneIndex !== sceneIndex) {
            state.sceneIndex = scenes.indexOf(`${scene}scene`);
            resetTransition(facecamlabel, "fadeout")
            resetTransition(hardwarecamlabel, "fadeout")
        }
        if (scene === "countdown") {
            startCountdown(300000);
            if (config.endVideo) {
                endvideo.classList.remove("hidden");
                endvideo.onended = () => {
                    endvideo.classList.add("hidden");
                }
                endvideo.play();
            }
        } else {
            stopCountdown();
            if (lastScene == COUNTDOWN_SCENE_INDEX && config.startVideo) {
                startvideo.classList.remove("hidden");
                startvideo.onended = () => {
                    startvideo.classList.add("hidden");
                }
                startvideo.play();
            }
        }
        render();
    }

    function resetTransition(el, name) {
        el.classList.remove(name)
        const x = el.offsetWidth; // reflow
        el.classList.add(name)
    }

    function updateCountdown(seconds) {
        // comput timer end
        const timerEnd = state.timerEnd || (Date.now() + 300000);
        // add seconds
        let remaining = Math.max(0, timerEnd - Date.now()) + seconds * 1000;
        // round to a multiple 30 seconds
        remaining = ((Math.round(remaining / 60000) * 60000) + 1000) | 0;
        state.timerEnd = Date.now() + remaining;
        renderCountdown();
        startCountdown();
    }

    function startCountdown(duration, callback) {
        if (duration !== undefined)
            state.timerEnd = Date.now() + duration;
        if (!state.timerInterval) {
            if (state.timerEnd === undefined)
                state.timerEnd = Date.now() + 300000;
            state.timerInterval = setInterval(renderCountdown, 100);
        }
        state.timerCallback = callback;
    }

    function stopCountdown() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = undefined;
            if (state.timerCallback)
                state.timerCallback();
            state.timerCallback = undefined;
        }
    }

    function renderCountdown() {
        if (state.timerEnd !== undefined) {
            let remaining = Math.floor((state.timerEnd - Date.now()) / 1000) // seconds;
            if (remaining < 0) {
                remaining = 0;
                stopCountdown();
                // go to chat view
                if (state.sceneIndex === COUNTDOWN_SCENE_INDEX)
                    setScene("chat");
            }
            if (remaining) {
                const minutes = Math.floor(remaining / 60);
                const seconds = remaining % 60;
                countdown.innerText = (minutes || seconds > 10) ? `${minutes}:${pad(seconds)}` : seconds;
            } else {
                countdown.innerText = "";
            }
        } else {
            countdown.innerText = ""
        }

        function pad(num) {
            var s = "00" + num;
            return s.substr(s.length - 2);
        }
    }

    function startPaint() {
        if (state.paint) return;
        state.paint = [];
        clearPaint();
        updatePaintSize();
        render();
    }

    function stopPaint() {
        state.paint = undefined;
        clearPaint();
        loadToolbox();
        render();
    }

    function togglePaint() {
        if (state.paint) stopPaint();
        else startPaint();
    }

    function toggleThumbnail() {
        state.thumbnail = !state.thumbnail;
        render();
    }

    function setPaintTool(tool) {
        startPaint();
        state.painttool = tool;
        loadToolbox();
    }

    function commitPaint() {
        paintCtx.drawImage(painttool, 0, 0)
        painttoolCtx.clearRect(0, 0, painttool.width, painttool.height)
    }

    function clearPaint() {
        painttoolCtx.clearRect(0, 0, painttool.width, painttool.height);
        paintCtx.clearRect(0, 0, paint.width, paint.height);
    }

    function updatePaintSize() {
        const size = container.getBoundingClientRect();
        paint.width = size.width;
        paint.height = size.height;
        painttool.width = size.width;
        painttool.height = size.height;
    }

    function loadPaint() {
        const mouse = { x: 0, y: 0 };
        let head = { x: 0, y: 0 }

        painttool.addEventListener('pointerdown', function (e) {
            head.x = e.pageX - this.offsetLeft;
            head.y = e.pageY - this.offsetTop;
            mouse.x = head.x;
            mouse.y = head.y;
            pushPaintEvent("down", mouse, head);
            painttool.addEventListener('pointermove', onMove, false);
        }, false);

        painttool.addEventListener('pointerup', function () {
            pushPaintEvent("up", mouse, head);
            painttool.removeEventListener('pointermove', onMove, false);
        }, false);

        function onMove(e) {
            mouse.x = e.pageX - this.offsetLeft;
            mouse.y = e.pageY - this.offsetTop;
            pushPaintEvent("move", mouse, head);
        }

        clearPaint();
    }

    function pushPaintEvent(ev, mouse, head) {
        const r = {
            type: ev,
            tool: state.painttool,
            emoji: state.emoji,
            color: state.paintColor,
        };
        if (mouse)
            r.mouse = { x: mouse.x, y: mouse.y };
        if (head)
            r.head = { x: head.x, y: head.y }
        state.paint.push(r)
        applyPaintEvents([r]);
    }
    function popPaintEvent() {
        const evs = state.paint;
        if (!evs) return;
        while (ev = evs.pop()) {
            if (ev.type == "down" || ev.type == "whiteboard") {
                clearPaint();
                applyPaintEvents(evs)
                break;
            }
        }
    }

    function applyPaintEvents(events) {
        events.forEach(ev => {
            switch (ev.type) {
                case "move": move(ev); break; // skip
                case "down": down(ev); break;
                case "up": commitPaint(); break;
                case "whiteboard": whiteboard(); break;
            }
        })

        function whiteboard() {
            paintCtx.save()
            paintCtx.beginPath();
            paintCtx.fillStyle = "rgba(255, 255, 255, 0.95)"
            paintCtx.rect(0, 0, paint.width, paint.height)
            paintCtx.fill()
            paintCtx.restore()
        }

        function down(ev) {
            const mouse = ev.mouse;
            const tool = ev.tool;
            const color = ev.color;

            painttoolCtx.lineWidth = Math.max(10, (paint.width / 100) | 0);
            painttoolCtx.lineJoin = 'round';
            painttoolCtx.lineCap = 'round';
            painttoolCtx.strokeStyle = color;
            painttoolCtx.globalAlpha = 1;
            if (tool == 'pen' || tool == 'highlight') {
                if (tool == 'highlight') {
                    painttoolCtx.globalAlpha = 0.5;
                    painttoolCtx.lineWidth = Math.max(20, (paint.width / 50) | 0);
                }
                painttoolCtx.beginPath();
                painttoolCtx.moveTo(mouse.x, mouse.y);
            } else if (tool == 'arrow') {
                painttoolCtx.lineWidth = 42;
            }
        }

        function move(ev) {
            const mouse = ev.mouse;
            const head = ev.head;
            const tool = ev.tool;
            const outline = 0.7

            const ctx = painttoolCtx
            ctx.clearRect(0, 0, painttool.width, painttool.height)
            ctx.save();
            if (tool == 'arrow') {
                const p1 = mouse, p2 = head;
                const size = ctx.lineWidth * 3;
                // Rotate the context to point along the path
                const dx = p2.x - p1.x
                const dy = p2.y - p1.y
                const len = Math.sqrt(dx * dx + dy * dy);
                ctx.translate(p2.x, p2.y);
                ctx.rotate(Math.atan2(dy, dx));

                const strokeStyle = ctx.strokeStyle;
                ctx.strokeStyle = '#ffffff'
                for (let l = 0; l < 2; ++l) {
                    // line
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(-len, 0);
                    ctx.closePath();
                    ctx.stroke();

                    // arrowhead
                    ctx.beginPath();
                    ctx.moveTo(-len, 0);
                    ctx.lineTo(size - len, size / 1.61);
                    ctx.moveTo(-len, 0);
                    ctx.lineTo(size - len, -size / 1.61);
                    ctx.stroke();
                    ctx.lineWidth *= outline;
                    ctx.strokeStyle = strokeStyle;
                }
            } else if (tool == 'rect') {
                // out white contour
                ctx.beginPath();
                const lineWidth = ctx.lineWidth
                const strokeStyle = ctx.strokeStyle;
                ctx.lineWidth *= 1/outline;
                ctx.strokeStyle = '#ffffff'
                ctx.rect(head.x, head.y, mouse.x - head.x, mouse.y - head.y)
                ctx.stroke()
                ctx.lineWidth = lineWidth
                ctx.strokeStyle = strokeStyle
                // inside
                ctx.beginPath();
                ctx.rect(head.x, head.y, mouse.x - head.x, mouse.y - head.y)
                ctx.stroke()
            } else if (tool == 'pen' || tool == 'highlight') {
                const lineWidth = ctx.lineWidth
                const strokeStyle = ctx.strokeStyle;
                ctx.lineWidth *= 1/outline;
                ctx.strokeStyle = '#ffffff'
                ctx.lineTo(mouse.x, mouse.y);
                ctx.stroke()
                ctx.lineWidth = lineWidth
                ctx.strokeStyle = strokeStyle
                ctx.lineTo(mouse.x, mouse.y);
                ctx.stroke();
            } else if (tool == 'emoji') {
                const emoji = ev.emoji;
                const p1 = head, p2 = mouse;
                const dx = p2.x - p1.x
                const dy = p2.y - p1.y
                const len = Math.max(32, (Math.sqrt(dx * dx + dy * dy) * 1.8) | 0);
                ctx.translate(p1.x, p1.y);
                ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
                ctx.translate(0, len / 6)

                ctx.font = `${len}px serif`;
                ctx.textBaseline = 'middle'
                ctx.textAlign = 'center'
                ctx.fillText(emoji, 0, 0);
            }
            ctx.restore();
        }
    }

    function loadEditor() {
        const config = readConfig();
        // update first editor
        const editorConfig = editorConfigs[config.editor];
        if (!editorConfig) {
            showSettings();
            loadStyle();
            return;
        }

        let url = `${editorConfig.url}?editorLayout=ide&nosandbox=1`;
        if (config.multiEditor)
            url += `&nestededitorsim=1`;
        editor.src = url;
        if (config.multiEditor) {
            if (!editor2.parentElement)
                container.insertBefore(editor2, editor);
            editor2.src = url;
        } else {
            // remove from DOM
            editor2.remove();
        }

        loadStyle();
    }

    function loadVideos() {
        const config = readConfig();
        startvideo.src = config.startVideo;
        endvideo.src = config.endVideo;
    }

    function loadStyle() {
        const config = readConfig();
        const editorConfig = editorConfigs[config.editor];
        // update page style
        let css = "";
        const styles = editorConfig && editorConfig.styles || {};

        let primary = config.stylePrimary || styles.primary || "#615fc7"
        let menu = config.styleBorder || styles.menu || "#615fc7"
        let background = config.styleBackground || styles.background || "rgb(99, 93, 198)";

        css =
            `body {
background: ${background};
}
.box {
border-color: ${menu};
}
.videolabel {
background: ${primary};
border-top-color: ${menu};
border-right-color: ${menu};
border-left-color: ${menu};
color: white;
}
#title {
background: ${primary};
}
`
        const faceCamFilter = camFilter(config.faceCamFilter)
        if (faceCamFilter)
            css += `#facecam { filter: ${faceCamFilter}; }
`
        const hardwareCamFilter = camFilter(config.hardwareCamFilter)
        if (hardwareCamFilter)
            css += `#hardwarecam { filter: ${hardwareCamFilter}; }
        `

        if (config.backgroundVideo) {
            backgroundvideo.src = config.backgroundVideo;
        } else {
            backgroundvideo.src = undefined;
            if (config.backgroundImage) {
                css += `body.parallax {
background-image: url(${config.backgroundImage});
}
`
            }
        }

        editorStyle.innerText = ""
        editorStyle.append(document.createTextNode(css));
    }

    function camFilter(filter) {
        filter = filter || {};
        return ["contrast", "brightness", "saturate"]
            .filter(k => filter[k] !== undefined)
            .map(k => `${k}(${filter[k] * 2}%)`)
            .join(" ");
    }

    function stopEvent(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function toggleChat(e) {
        tickEvent("streamer.togglechat", undefined, { interactiveConsent: true });
        if (e)
            stopEvent(e)
        const config = readConfig();
        state.chat = !state.chat && config.twitch;
        render();
    }

    function toggleHardware(e) {
        tickEvent("streamer.togglehardware", undefined, { interactiveConsent: true });
        if (e)
            stopEvent(e)
        const config = readConfig();
        state.hardware = !state.hardware && config.hardwareCamId;
        render();
    }

    function loadSocial() {
        const config = readConfig();

        if (!config.twitch)
            state.chat = false;

        const editorConfig = editorConfigs[config.editor]
        titleEl.innerText = config.title || (editorConfig && `MakeCode for ${editorConfig.name}`) || "";
    }

    function loadChat() {
        const config = readConfig();
        if (config.twitch) {
            chat.src = `https://www.twitch.tv/embed/${config.twitch}/chat?parent=makecode.com`;
            if (!chat.parentElement)
                container.insertBefore(chat, facecamcontainer)
        }
        else { // remove from dom
            chat.remove();
        }
    }

    async function listCameras() {
        let cams = await navigator.mediaDevices.enumerateDevices()
        cams = cams.filter(d => d.kind == "videoinput")
        return cams;
    }

    async function listMicrophones() {
        let cams = await navigator.mediaDevices.enumerateDevices()
        cams = cams.filter(d => d.kind == "audioinput")
        return cams;
    }

    async function firstLoadFaceCam() {
        await loadFaceCam()
        const config = readConfig();
        if (!config.faceCamId) {
            const cams = await listCameras();
            if (cams && cams[0] && cams[0].deviceId) {
                config.faceCamId = cams[0].deviceId;
                saveConfig(config);
                await loadFaceCam();
            }
        }
    }

    async function loadFaceCam() {
        // load previous webcam
        const config = readConfig();
        try {
            state.faceCamError = false;
            body.classList.add("loading");
            facecam.classList.remove("error");
            await startStream(facecam, config.faceCamId, config.faceCamRotate, config.faceCamGreenScreen, config.faceCamClipBlack, config.faceCamContour);
            console.log(`face cam started`)
            if (!config.faceCamId)
                stopStream(facecam.srcObject); // request permission only
            return; // success!
        }
        catch (e) {
            tickEvent("streamer.facecam.error")
            stopStream(facecam.srcObject);
            facecam.classList.add("error");
            state.faceCamError = true;
            saveConfig(config)
            console.log(`could not start face cam`, e)
            render()
        }
        finally {
            body.classList.remove("loading");
        }
    }

    async function loadHardwareCam() {
        // load previous webcam
        const config = readConfig();
        if (config.hardwareCamId) {
            try {
                state.hardwareCamError = false;
                hardwarecam.parentElement.classList.remove("hidden");
                await startStream(hardwarecam, config.hardwareCamId, config.hardwareCamRotate, config.hardwareCamGreenScreen, config.hardwareCamClipBlack, config.hardwareCamContour);
                console.log(`hardware cam started`)
                return; // success!
            }
            catch (e) {
                tickEvent("streamer.hardwarecam.error")
                stopStream(hardwarecam.srcObject)
                state.hardwareCamError = true;
                saveConfig(config)
                console.log(`could not start web cam`, e)
                render()
            }
        } else {
            state.hardwareCamError = false
            hardwarecam.parentElement.classList.add("hidden");
            stopStream(hardwarecam.srcObject)
        }
    }

    async function startMicrophone() {
        console.log("opening audio stream")
        const config = readConfig();
        try {
            state.micError = false;
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            }
            if (config.micId)
                constraints.audio.deviceId = config.micId;
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log("audio stream ready")
            return stream;
        }
        catch (e) {
            tickEvent("streamer.mic.error")
            state.micError = true;
            saveConfig(config)
            console.log(`could not start microphonem`, e)
            render()
            return undefined
        }
    }

    function stopStream(stream) {
        try {
            if (stream && stream.active) {
                (stream.getVideoTracks() || [])
                    .filter(track => track.stop)
                    .forEach(track => track.stop());
                (stream.getAudioTracks() || [])
                    .filter(track => track.stop)
                    .forEach(track => track.stop());
            }
        } catch (e) {
            console.log(e)
        }
    }

    function initVideos() {
        accessify(facecam.parentElement)
        accessify(hardwarecam.parentElement)
        facecam.parentElement.onclick = () => onClick(facecam.parentElement);
        hardwarecam.parentElement.onclick = () => onClick(hardwarecam.parentElement);

        function swapLeftRight(e) {
            tickEvent("streamer.swap.leftright", undefined, { interactiveConsent: true })
            if (state.sceneIndex == LEFT_SCENE_INDEX)
                setScene("right")
            else if (state.sceneIndex == RIGHT_SCENE_INDEX)
                setScene("left")
            else if (state.sceneIndex == CHAT_SCENE_INDEX) {
                swapVideos();
                updateSwap();
            }
        }

        function swapVideos() {
            if (!state.hardware) return;
            tickEvent("streamer.swap.videos", undefined, { interactiveConsent: true })
            const fp = facecam.parentElement;
            const hp = hardwarecam.parentElement;
            if (fp.classList.contains("facecam")) {
                fp.classList.remove("facecam")
                fp.classList.add("hardwarecam")
                hp.classList.remove("hardwarecam")
                hp.classList.add("facecam")
            } else {
                fp.classList.remove("hardwarecam")
                fp.classList.add("facecam")
                hp.classList.remove("facecam")
                hp.classList.add("hardwarecam")
            }
        }

        function onClick(el) {
            const isfacecam = el.classList.contains("facecam");
            if (!isfacecam && state.hardware)
                swapVideos();
            else
                swapLeftRight();
        }

        const introvideo = document.getElementById("introvideo");
        introvideo.onclick = function (e) {
            tickEvent("streamer.introvideo", undefined, { interactiveConsent: true })
            stopEvent(e)
            loadSettings()
            hideSettings()
            introvideo.requestPictureInPicture()
                .then(() => introvideo.play())
        }
    }

    function initResize() {
        function update() {
            const text =  `(${window.innerWidth}x${window.innerHeight})`
            const els = document.getElementsByClassName("screensize")
            for(let i = 0; i < els.length; ++i)
                els[i].innerText = text
        }
        window.onresize = update
        update()
    }

    function initMessages() {
        window.onmessage = function (msg) {
            const data = msg.data;
            const source = msg.source;
            if (!!data.broadcast) {
                data.outer = true;
                frames
                    .filter(ifrm => ifrm.contentWindow !== source)
                    .forEach((ifrm) => ifrm.contentWindow.postMessage(data, "*"));
            }
        };

        window.onhashchange = handleHashChange;
        window.addEventListener("error", function (message, source, lineno, colno, error) {
            trackException(error, "error");
        });
        window.addEventListener("unhandledrejection", function (ev) {
            trackException(ev.reason, "promise");
        });
    }

    function handleHashChange() {
        const hash = window.location.hash;
        const parts = (hash || "").replace(/^#/, '').split('|');
        parts.forEach(part => {
            const m = /^([^:]+):(.+)$/.exec(part);
            if (m) {
                const action = m[1];
                const arg = m[2];
                switch (action) {
                    case "editor": setEditor(arg); break;
                    case "doc": {
                        // only same domain as editor
                        const config = readConfig();
                        const editorConfig = editorConfigs[config.editor]
                        config.multiEditor = true;
                        const doc = editorConfig.url.trim(/\/\w+$/) + "/" + arg.trim(/^\//);
                        editor2.src = doc;
                        render();
                        break;
                    }
                }
            }
        })
        window.history.replaceState('', '', '#')
    }

    async function startStream(el, deviceId, rotate, greenscreen, clipBlack, contourColor) {
        stopStream(el.srcObject)
        console.log(`trying device ${deviceId}`)
        if (deviceId === DISPLAY_DEVICE_ID) {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: "application",
                    cursor: "never"
                }
            });
            el.srcObject = stream;
        } else {
            const constraints = {
                audio: false,
                video: {
                    aspectRatio: 4 / 3,
                    width: { ideal: 1080 },
                    height: { ideal: 720 }
                }
            }
            if (deviceId)
                constraints.video.deviceId = deviceId;
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            el.srcObject = stream;
        }

        el.muted = true;
        el.volume = 0; // don't use sound!
        el.onloadedmetadata = (e) => {
            el.play();
            toggleGreenScreen();
        }
        if (rotate)
            el.classList.add("rotate")
        else
            el.classList.remove("rotate");

        function toggleGreenScreen() {
            // time to get serious
            if (greenscreen) {
                el.style.opacity = 0;
                el.parentElement.classList.add("greenscreen")
                // https://github.com/brianchirls/Seriously.js/
                const canvas = document.getElementById(el.id + "serious");
                if (rotate)
                    canvas.classList.add("rotate")
                else
                    canvas.classList.remove("rotate");
                canvas.width = el.videoWidth;
                canvas.height = el.videoHeight;
                const seriously = new Seriously();
                let source = seriously.source(el);

                // source -> chroma key
                const chroma = seriously.effect("chroma");
                chroma.clipBlack = clipBlack || 0.6;
                const screenColor = toSeriousColor(greenscreen);
                if (screenColor) chroma.screen = screenColor
                chroma.source = source;
                seriously.chroma = chroma;
                source = chroma;

                // optional chroma -> contour
                if (contourColor) {
                    const contour = seriously.effect("contour");
                    contour.source = source;
                    seriously.contour = contour;
                    seriously.contour.color = toSeriousColor(contourColor);
                    source = contour;
                }

                // pipe to canvas
                const target = seriously.target(canvas);
                target.source = source;

                seriously.go();

                el.seriously = seriously;
            } else {
                el.style.opacity = 1;
                el.parentElement.classList.remove("greenscreen")

                if (el.seriously) {
                    el.seriously.stop();
                    el.seriously = undefined;
                }
            }
        }
    }

    function toSeriousColor(color) {
        const c = parseColor(color);
        if (!c) return undefined;
        const cf = c.map(v => v / 0xff);
        cf.push(1);
        return cf;
    }

    function parseColor(c) {
        if (!c) return undefined;
        let m = /^#([a-f0-9]{3})$/i.exec(c);
        if (m) {
            return [
                parseInt(m[1].charAt(0), 16) * 0x11,
                parseInt(m[1].charAt(1), 16) * 0x11,
                parseInt(m[1].charAt(2), 16) * 0x11
            ];
        }
        m = /^#([a-f0-9]{6})$/i.exec(c);
        if (m) {
            return [
                parseInt(m[1].substr(0, 2), 16),
                parseInt(m[1].substr(2, 2), 16),
                parseInt(m[1].substr(4, 2), 16)
            ];
        }
        return undefined;
    }
    function stopRecording() {
        const stop = state.recording;
        state.recording = undefined;
        if (stop) stop();
        render();
    }

    function initSubtitles() {
        // not supported in Edge
        if (typeof webkitSpeechRecognition === "undefined" || /Edg\//.test(navigator.userAgent)) return;

        let hideInterval;
        const speech = state.speech = new webkitSpeechRecognition();
        speech.continuous = true;
        speech.confidence = 0.7;
        speech.maxAlternatives = 1;
        speech.interimResults = true;
        let nextInterimResult = 0
        speech.onstart = () => {
            console.log("speech: started")
            state.speechRunning = true;
            loadToolbox();
        }
        speech.onend = () => {
            console.log("speech: stopped")
            state.speechRunning = false;
            hide();
        }
        speech.onerror = (ev) => {
            console.log("speech: error")
            console.log(ev)
            hide();
        }
        speech.onnomatch = (ev) => {
            console.log("speech: no match")
            console.log(ev)
            hide();
        }
        speech.onresult = (ev) => {
            const results = ev.results;
            const lastResult = results[ev.resultIndex];
            //console.log(`lastResult`, lastResult)
            if (lastResult.isFinal) {
                //console.log(`final`)
                subtitles.innerText = lastResult[0].transcript;
                nextInterimResult = ev.resultIndex + 1
            } else {
                //console.log(`not final`, results)
                // collect the intermediate results with good quality
                let text = ""
                for(let i = nextInterimResult; i < results.length; ++i) {
                    if (!results[i].isFinal) {
                        const alt = results[i][0]
                        if (alt.confidence < 0.8) {
                            //console.log(alt)
                            // poor quality detection, stop
                            break;
                        } else {
                            text += alt.transcript
                        }
                    }
                }
                if (text)
                    subtitles.innerText = text
            }
            show();
            if (hideInterval) clearTimeout(hideInterval)
            hideInterval = setTimeout(hide, 10000);
        }
        function show() {
            subtitles.classList.remove("hidden")
        }
        function hide() {
            hideInterval = undefined;
            subtitles.classList.add("hidden")
            loadToolbox();
        }
    }

    function toggleSpeech() {
        const speech = state.speech;
        if (!speech) return;
        if (state.speechRunning) {
            tickEvent("streamer.speech.stop", undefined, { interactiveConsent: true })
            speech.stop();
        } else {
            tickEvent("streamer.speech.start", undefined, { interactiveConsent: true })
            speech.start();
        }
    }

    async function getDisplayStream(cursor) {
        try {
            selectapp.classList.remove("hidden");
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: "browser",
                    cursor: cursor ? "always" : "never"
                }
            });
            return stream;
        }
        finally {
            selectapp.classList.add("hidden");
        }
    }

    async function takeScreenshot() {
        if (state.screenshoting || state.recording) return;

        let stream = state.screenshotStream;
        if (!stream) {
            stream = state.screenshotStream = await getDisplayStream(false);
            stream.onerror = clean;
            stream.oninactive = clean;
            stream.onended = clean;
            const video = state.screenshotVideo = document.createElement("video");
            video.oncanplay = () => {
                video.play();
            }
            video.onabort = clean;
            video.onerror = clean;
            video.srcObject = stream;
        }

        state.screenshoting = true;
        startCountdown(6000, screenshotVideo);
        render();

        function clean() {
            state.screenshoting = false;
            state.screenshotVideo = undefined;
            stopStream(state.screenshotStream);
            state.screenshotStream = undefined;
            state.timerCallback = undefined;
            stopCountdown();
            render();
        }
    }

    function screenshotVideo() {
        if (!state.screenshoting) return;
        const video = state.screenshotVideo;
        if (!video) return;

        state.screenshoting = false;
        countdown.style.display = "none"
        toolbox.style.display = "none"
        render();
        setTimeout(function () {
            const cvs = document.createElement("canvas");
            cvs.width = video.videoWidth;
            cvs.height = video.videoHeight;
            const ctx = cvs.getContext("2d");
            ctx.drawImage(video, 0, 0);
            cvs.toBlob(img => downloadBlob(img, "screenshot.png", "image/png"));
            countdown.style.display = "block"
            toolbox.style.display = "block"
        }, 200) // let browser hide countdown
    }

    async function startRecording() {
        tickEvent('recorder.prepare')
        const config = readConfig();
        state.recording = undefined;
        let audioCtx;
        const stream = await getDisplayStream(true);
        try {
            state.micError = false;
            const audioStream = await startMicrophone();
            audioCtx = new AudioContext();
            const audioSource = audioCtx.createMediaStreamSource(audioStream);
            const delay = audioCtx.createDelay(2);
            delay.delayTime.value = (config.micDelay || 0) / 1000;
            audioSource.connect(delay);
            const audioDestination = audioCtx.createMediaStreamDestination();
            delay.connect(audioDestination);
            stream.addTrack(audioDestination.stream.getAudioTracks()[0])
        } catch (e) {
            console.log(e)
            state.micError = true;
        }
        const chunks = [];
        const options = {
            mimeType: 'video/webm;codecs=H264'
        };
        const mediaRecorder = new MediaRecorder(stream, options)
        mediaRecorder.ondataavailable = (e) => event.data.size && chunks.push(e.data);
        mediaRecorder.onstop = (e) => download();
        mediaRecorder.onerror = (e) => download();

        recorder.classList.remove('hidden')
        recorder.onclick = () => {
            tickEvent('recorder.start')
            recorder.classList.add('hidden')
            mediaRecorder.start();
        }
        state.recording = () => {
            try {
                stopStream(mediaRecorder.stream);
            } catch (e) {
                console.log(e)
            }
        }
        render();

        function download() {
            tickEvent('recorder.download')
            console.load(`downloading recorded video`)
            // makesure to close all streams
            recorder.classList.add('hidden')
            try {
                if (audioCtx)
                audioCtx.close();
                stream.getVideoTracks().forEach(track => track.stop())
                stream.getAudioTracks().forEach(track => track.stop())
            } catch (e) { 
                console.log(e)
            }

            state.recording = undefined;

            const blob = new Blob(chunks, {
                type: "video/webm"
            });
            downloadBlob(blob, "recording.webm");
            render();
        }
    }

    function downloadBlob(blob, name) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        a.href = url;
        a.download = name;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    async function loadSettings() {
        const config = readConfig();
        const cams = await listCameras()
        const mics = await listMicrophones()

        const sections = document.querySelectorAll("div.section>h3")
        for(let i =0; i < sections.length; ++i) {
            const section = sections[i];
            section.onclick = (evt) => evt.target.parentElement.classList.toggle("expanded")
        }

        const settingsclose = document.getElementById("settingsclose")
        settingsclose.onclick = function (e) {
            tickEvent("streamer.settingsclose", undefined, { interactiveConsent: true })
            stopEvent(e)
            hideSettings()
        }
        const editorselect = document.getElementById("editorselect");
        editorselect.innerHTML = "" // remove all web cams
        Object.keys(editorConfigs).forEach(editorid => {
            const editor = editorConfigs[editorid];
            if (!editor.unsupported || editor.unsupported.indexOf(STREAMER_ID) < 0) {
                const option = document.createElement("option")
                option.value = editorid
                option.text = editor.name;
                editorselect.add(option)
                if (config.editor == editorid)
                    option.selected = true;
            }
        })
        editorselect.onchange = function () {
            const selected = editorselect.options[editorselect.selectedIndex];
            setEditor(selected.value);
        }

        const fullscreeneditorcheckbox = document.getElementById("fullscreeneditorcheckbox")
        fullscreeneditorcheckbox.checked = !!config.fullScreenEditor
        fullscreeneditorcheckbox.onchange = function () {
            config.fullScreenEditor = !!fullscreeneditorcheckbox.checked
            saveConfig(config)
            render()
        }

        const multicheckbox = document.getElementById("multicheckbox")
        multicheckbox.checked = !!config.multiEditor
        multicheckbox.onchange = function () {
            config.multiEditor = !!multicheckbox.checked
            saveConfig(config)
            render()
            loadEditor()
        }

        const extrasitesarea = document.getElementById("extrasitesarea")
        extrasitesarea.value = (config.extraSites || []).join('\n');
        extrasitesarea.onchange = function (e) {
            config.extraSites = (extrasitesarea.value || "").split('\n')
                .filter(line => /^https:\/\//.test(line))
                .map(line => line.trim());
            saveConfig(config);
            loadToolbox();
            render()
        }
        const facecamselect = document.getElementById("facecamselect");
        facecamselect.innerHTML = "" // remove all web cams
        // no Off option
        cams.forEach(cam => {
            const option = document.createElement("option")
            option.value = cam.deviceId
            option.text = cam.label || `camera ${cam.deviceId}`
            facecamselect.add(option)
            if (config.faceCamId == cam.deviceId && cam.deviceId)
                option.selected = true;
        })
        if (!!navigator.mediaDevices.getDisplayMedia) {
            const option = document.createElement("option")
            option.value = DISPLAY_DEVICE_ID
            option.text = "Application"
            if (config.faceCamId === option.value)
                option.selected = true
            facecamselect.add(option)
        }
        facecamselect.onchange = function () {
            const selected = facecamselect.options[facecamselect.selectedIndex];
            config.faceCamId = selected.value;
            if (config.hardwareCamId == config.faceCamId)
                config.hardwareCamId = undefined; // priority to face cam
            saveConfig(config)
            loadFaceCam().then(() => loadSettings())
        }
        const facerotatecheckbox = document.getElementById("facerotatecameracheckbox")
        facerotatecheckbox.checked = !!config.faceCamRotate
        facerotatecheckbox.onchange = function () {
            config.faceCamRotate = !!facerotatecheckbox.checked
            saveConfig(config)
            render()
            loadFaceCam().then(() => loadSettings())
        }
        const facecamcircularcheckbox = document.getElementById("facecamcircularcheckbox")
        facecamcircularcheckbox.checked = !!config.faceCamCircular
        facecamcircularcheckbox.onchange = function () {
            config.faceCamCircular = !!facecamcircularcheckbox.checked
            saveConfig(config)
            render()
            loadFaceCam().then(() => loadSettings())
        }

        const facecamscreeninput = document.getElementById("facecamscreeninput")
        facecamscreeninput.value = config.faceCamGreenScreen || ""
        facecamscreeninput.onchange = function (e) {
            config.faceCamGreenScreen = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(facecamscreeninput.value))
                config.faceCamGreenScreen = facecamscreeninput.value
            saveConfig(config);
            // already running?
            if (config.faceCamGreenScreen && facecam.seriously && facecam.seriously.chroma)
                facecam.seriously.chroma.screen = toSeriousColor(config.faceCamGreenScreen);
            else
                loadFaceCam().then(() => loadSettings())
        }
        const facecamscreenclear = document.getElementById("facecamscreenclear");
        facecamscreenclear.onclick = function (e) {
            config.faceCamGreenScreen = undefined;
            saveConfig(config);
            loadFaceCam().then(() => loadSettings())
        }
        const facecamscreencanvas = document.getElementById("facecamscreencanvas");
        facecamscreencanvas.width = 320;
        facecamscreencanvas.height = facecamscreencanvas.width / facecam.videoWidth * facecam.videoHeight;
        const facecamscreenctx = facecamscreencanvas.getContext('2d');
        facecamscreenctx.drawImage(facecam, 0, 0, facecam.videoWidth, facecam.videoHeight, 0, 0, facecamscreencanvas.width, facecamscreencanvas.height);
        facecamscreencanvas.onclick = (e) => {
            const x = e.offsetX;
            const y = e.offsetY;
            const rgb = facecamscreenctx.getImageData(x, y, 1, 1).data;
            config.faceCamGreenScreen = "#" +
                ("0" + rgb[0].toString(16)).slice(-2) +
                ("0" + rgb[1].toString(16)).slice(-2) +
                ("0" + rgb[2].toString(16)).slice(-2);
            saveConfig(config);
            // already running?
            if (config.faceCamGreenScreen && facecam.seriously && facecam.seriously.chroma) {
                facecam.seriously.chroma.screen = toSeriousColor(config.faceCamGreenScreen);
                loadSettings()
            }
            else
                loadFaceCam().then(() => loadSettings())
        }
        const facecamgreenclipblack = document.getElementById("facecamgreenclipblack")
        facecamgreenclipblack.value = config.faceCamClipBlack || 0.6;
        facecamgreenclipblack.onchange = function (e) {
            config.faceCamClipBlack = facecamgreenclipblack.value;
            saveConfig(config);
            // already running?
            if (facecam.seriously && facecam.seriously.chroma)
                facecam.seriously.chroma.clipBlack = config.faceCamClipBlack;
            else
                loadFaceCam().then(() => loadSettings())
        }
        const facecamcontourinput = document.getElementById("facecamcontourinput")
        facecamcontourinput.value = config.faceCamContour || ""
        facecamcontourinput.onchange = function (e) {
            config.faceCamContour = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(facecamcontourinput.value))
                config.faceCamContour = facecamcontourinput.value
            saveConfig(config);
            // already running?
            if (config.faceCamContour && facecam.seriously && facecam.seriously.contour)
                facecam.seriously.contour.color = toSeriousColor(config.faceCamContour);
            else
                loadFaceCam().then(() => loadSettings())
        }
        const facecamcontourclear = document.getElementById("facecamcontourclear");
        facecamcontourclear.onclick = function (e) {
            config.faceCamContour = undefined;
            saveConfig(config);
            loadFaceCam().then(() => loadSettings())
        }

        config.faceCamFilter = config.faceCamFilter || {};
        ["contrast", "brightness", "saturate"].forEach(function (k) {
            const elid = "facecam" + k;
            const el = document.getElementById(elid);
            el.valueAsNumber = config.faceCamFilter[k];
            el.onchange = function () {
                config.faceCamFilter[k] = el.valueAsNumber;
                saveConfig(config);
                loadStyle();
            }
        })
        const facecamerror = document.getElementById("facecamerror")
        if (state.faceCamError)
            facecamerror.classList.remove("hidden")
        else
            facecamerror.classList.add("hidden")

        const hardwarecamselect = document.getElementById("hardwarecamselect");
        hardwarecamselect.innerHTML = "" // remove all web cams
        {
            const option = document.createElement("option")
            option.value = ""
            option.text = "Off"
            if (!config.hardwareCamId)
                option.selected = true;
            hardwarecamselect.add(option)
        }
        cams.forEach(cam => {
            const option = document.createElement("option")
            option.value = cam.deviceId
            option.text = cam.label || `camera ${cam.deviceId}`
            hardwarecamselect.add(option)
            if (config.hardwareCamId == cam.deviceId && cam.deviceId)
                option.selected = true;
        })
        if (!!navigator.mediaDevices.getDisplayMedia) {
            const option = document.createElement("option")
            option.value = DISPLAY_DEVICE_ID
            option.text = "Application"
            if (config.hardwareCamId === option.value)
                option.selected = true
            hardwarecamselect.add(option)
        }
        hardwarecamselect.onchange = function () {
            const selected = hardwarecamselect.options[hardwarecamselect.selectedIndex];
            config.hardwareCamId = selected.value;
            saveConfig(config)
            state.hardware = !!config.hardwareCamId
            render()
            loadHardwareCam().then(() => loadSettings())
        }
        const hardwarerotatecheckbox = document.getElementById("hardwarerotatecameracheckbox")
        hardwarerotatecheckbox.checked = !!config.hardwareCamRotate
        hardwarerotatecheckbox.onchange = function () {
            config.hardwareCamRotate = !!hardwarerotatecheckbox.checked
            saveConfig(config)
            loadHardwareCam().then(() => loadSettings())
        }
        const hardwarecamcircularcheckbox = document.getElementById("hardwarecamcircularcheckbox")
        hardwarecamcircularcheckbox.checked = !!config.hardwareCamCircular
        hardwarecamcircularcheckbox.onchange = function () {
            config.hardwareCamCircular = !!hardwarecamcircularcheckbox.checked
            saveConfig(config)
            render()
            loadFaceCam().then(() => loadSettings())
        }

        const hardwarecamscreeninput = document.getElementById("hardwarecamscreeninput")
        hardwarecamscreeninput.value = config.hardwareCamGreenScreen || ""
        hardwarecamscreeninput.onchange = function (e) {
            config.hardwareCamGreenScreen = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(hardwarecamscreeninput.value))
                config.hardwareCamGreenScreen = hardwarecamscreeninput.value
            saveConfig(config);
            // already running?
            if (config.hardwareCamGreenScreen && hardwarecam.seriously && hardwarecam.seriously.chroma)
                hardwarecam.seriously.chroma.screen = toSeriousColor(config.hardwareCamGreenScreen);
            else
                loadHardwareCam().then(() => loadSettings())
        }

        const hardwarecamscreencanvas = document.getElementById("hardwarecamscreencanvas");
        hardwarecamscreencanvas.width = 320;
        hardwarecamscreencanvas.height = hardwarecamscreencanvas.width / hardwarecam.videoWidth * hardwarecam.videoHeight;
        const hardwarecamscreenctx = hardwarecamscreencanvas.getContext('2d');
        hardwarecamscreenctx.drawImage(hardwarecam, 0, 0, hardwarecam.videoWidth, hardwarecam.videoHeight, 0, 0, hardwarecamscreencanvas.width, hardwarecamscreencanvas.height);
        hardwarecamscreencanvas.onclick = (e) => {
            const x = e.offsetX;
            const y = e.offsetY;
            const rgb = hardwarecamscreenctx.getImageData(x, y, 1, 1).data;
            config.hardwareCamGreenScreen = "#" +
                ("0" + rgb[0].toString(16)).slice(-2) +
                ("0" + rgb[1].toString(16)).slice(-2) +
                ("0" + rgb[2].toString(16)).slice(-2);
            saveConfig(config);
            // already running?
            if (config.hardwareCamGreenScreen && hardwarecam.seriously && hardwarecam.seriously.chroma) {
                hardwarecam.seriously.chroma.screen = toSeriousColor(config.hardwareCamGreenScreen);
                loadSettings()
            }
            else
                loadHardwareCam().then(() => loadSettings())
        }
        const hardwarecamscreenclear = document.getElementById("hardwarecamscreenclear");
        hardwarecamscreenclear.onclick = function (e) {
            config.hardwareCamGreenScreen = undefined;
            saveConfig(config);
            loadHardwareCam().then(() => loadSettings())
        }
        const hardwarecamgreenclipblack = document.getElementById("hardwarecamgreenclipblack")
        hardwarecamgreenclipblack.value = config.hardwareCamClipBlack || 0.6;
        hardwarecamgreenclipblack.onchange = function (e) {
            config.hardwareCamClipBlack = hardwarecamgreenclipblack.value;
            saveConfig(config);
            // already running?
            if (hardwarecam.seriously && hardwarecam.seriously.chroma)
            hardwarecam.seriously.chroma.clipBlack = config.hardwareCamClipBlack;
            else
                loadHardwareCam().then(() => loadSettings())
        }
        const hardwarecamcontourinput = document.getElementById("hardwarecamcontourinput")
        hardwarecamcontourinput.value = config.hardwareCamContour || ""
        hardwarecamcontourinput.onchange = function (e) {
            config.hardwareCamContour = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(hardwarecamcontourinput.value))
                config.hardwareCamContour = hardwarecamcontourinput.value
            saveConfig(config);
            // already running?
            if (config.hardwareCamContour && hardwarecam.seriously && hardwarecam.seriously.contour)
                hardwarecam.seriously.contour.color = toSeriousColor(config.hardwareCamContour);
            else
                loadHardwareCam().then(() => loadSettings())
        }
        const hardwarecamcontourclear = document.getElementById("hardwarecamcontourclear");
        hardwarecamcontourclear.onclick = function (e) {
            config.hardwareCamContour = undefined;
            saveConfig(config);
            loadHardwareCam().then(() => loadSettings())
        }

        config.hardwareCamFilter = config.hardwareCamFilter || {};
        ["contrast", "brightness", "saturate"].forEach(function (k) {
            const elid = "hardwarecam" + k;
            const el = document.getElementById(elid);
            el.valueAsNumber = config.hardwareCamFilter[k];
            el.onchange = function () {
                config.hardwareCamFilter[k] = el.valueAsNumber;
                saveConfig(config);
                loadStyle();
            }
        })
        const hardwarecamerror = document.getElementById("hardwarecamerror")
        if (config.hardwareCamId && state.hardwareCamError)
            hardwarecamerror.classList.remove("hidden")
        else
            hardwarecamerror.classList.add("hidden")

        const facecamlabelinput = document.getElementById("facecamlabelinput")
        facecamlabelinput.value = config.faceCamLabel || ""
        facecamlabelinput.onchange = function (e) {
            config.faceCamLabel = (facecamlabelinput.value || "").trim()
            facecamlabelinput.value = config.faceCamLabel
            saveConfig(config);
            loadSocial()
            render()
        }

        const hardwarecamlabelinput = document.getElementById("hardwarecamlabelinput")
        hardwarecamlabelinput.value = config.hardwareCamLabel || ""
        hardwarecamlabelinput.onchange = function (e) {
            config.hardwareCamLabel = (hardwarecamlabelinput.value || "").trim()
            hardwarecamlabelinput.value = config.hardwareCamLabel
            saveConfig(config);
            loadSocial()
            render()
        }

        const titleinput = document.getElementById("titleinput")
        titleinput.value = config.title || ""
        titleinput.onchange = function (e) {
            config.title = (titleinput.value || "");
            titleinput.value = config.title
            saveConfig(config);
            loadSocial();
            render()
        }

        const backgroundimageinput = document.getElementById("backgroundimageinput")
        backgroundimageinput.value = config.backgroundImage || ""
        backgroundimageinput.onchange = function (e) {
            config.backgroundImage = undefined;
            if (/^https:\/\//.test(backgroundimageinput.value))
                config.backgroundImage = backgroundimageinput.value
            saveConfig(config);
            loadStyle();
            render()
        }

        const backgroundvideoinput = document.getElementById("backgroundvideoinput")
        backgroundvideoinput.value = config.backgroundVideo || ""
        backgroundvideoinput.onchange = function (e) {
            config.backgroundVideo = undefined;
            if (/^https:\/\//.test(backgroundvideoinput.value))
                config.backgroundVideo = backgroundvideoinput.value
            saveConfig(config);
            loadStyle();
            render()
        }

        const startvideoinput = document.getElementById("startvideoinput")
        startvideoinput.value = config.startVideo || ""
        startvideoinput.onchange = function (e) {
            config.startVideo = undefined;
            if (/^https:\/\//.test(startvideoinput.value))
                config.startVideo = startvideoinput.value
            saveConfig(config);
            loadVideos();
            render()
        }

        const endvideoinput = document.getElementById("endvideoinput")
        endvideoinput.value = config.endVideo || ""
        endvideoinput.onchange = function (e) {
            config.endVideo = undefined;
            if (/^https:\/\//.test(endvideoinput.value))
                config.endVideo = endvideoinput.value
            saveConfig(config);
            loadVideos();
            render()
        }

        const backgroundcolorinput = document.getElementById("backgroundcolorinput")
        backgroundcolorinput.value = config.styleBackground || ""
        backgroundcolorinput.onchange = function (e) {
            config.styleBackground = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(backgroundcolorinput.value))
                config.styleBackground = backgroundcolorinput.value
            saveConfig(config);
            loadStyle();
        }
        const backgroundcolorclear = document.getElementById("backgroundcolorclear");
        backgroundcolorclear.onclick = function (e) {
            config.styleBackground = undefined;
            saveConfig(config);
            loadStyle();
            loadSettings();
        }

        const bordercolorinput = document.getElementById("bordercolorinput")
        bordercolorinput.value = config.styleBorder || ""
        bordercolorinput.onchange = function (e) {
            config.styleBorder = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(bordercolorinput.value))
                config.styleBorder = bordercolorinput.value
            saveConfig(config);
            loadStyle();
        }
        const bordercolorclear = document.getElementById("bordercolorclear");
        bordercolorclear.onclick = function (e) {
            config.styleBorder = undefined;
            saveConfig(config);
            loadStyle();
            loadSettings();
        }

        const borderbackgroundinput = document.getElementById("borderbackgroundinput")
        borderbackgroundinput.value = config.stylePrimary || ""
        borderbackgroundinput.onchange = function (e) {
            config.stylePrimary = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(borderbackgroundinput.value))
                config.stylePrimary = borderbackgroundinput.value
            saveConfig(config);
            loadStyle();
        }
        const borderbackgroundclear = document.getElementById("borderbackgroundclear");
        borderbackgroundclear.onclick = function (e) {
            config.stylePrimary = undefined;
            saveConfig(config);
            loadStyle();
            loadSettings();
        }

        const countdowneditorcheckbox = document.getElementById("countdowneditorcheckbox")
        countdowneditorcheckbox.checked = !!config.countdownEditor
        countdowneditorcheckbox.onchange = function () {
            config.countdownEditor = !!countdowneditorcheckbox.checked
            saveConfig(config)
            render()
        }

        const countdownblureditorcheckbox = document.getElementById("countdownblureditorcheckbox")
        countdownblureditorcheckbox.checked = !!config.countdownEditorBlur
        countdownblureditorcheckbox.onchange = function () {
            config.countdownEditorBlur = !!countdownblureditorcheckbox.checked
            saveConfig(config)
            render()
        }

        const twitchinput = document.getElementById("twitchinput")
        twitchinput.value = config.twitch || ""
        twitchinput.onchange = function (e) {
            config.twitch = (twitchinput.value || "").replace(/^https:\/\/twitch.tv\//, '').replace(/^\//, '').trim()
            twitchinput.value = config.twitch
            saveConfig(config);
            state.chat = !!config.twitch;
            loadSocial();
            loadChat();
            render()
        }

        const greenscreencheckbox = document.getElementById("greenscreencheckbox")
        greenscreencheckbox.checked = !!config.greenScreen
        greenscreencheckbox.onchange = function () {
            config.greenScreen = !!greenscreencheckbox.checked
            saveConfig(config)
            render()
        }

        const emojisinput = document.getElementById("emojisinput")
        emojisinput.value = config.emojis || ""
        emojisinput.onchange = function (e) {
            config.emojis = emojisinput.value.replace(/\s*/g, '');
            emojisinput.value = config.emojis
            saveConfig(config);
            loadSocial()
            render()
        }

        const micselect = document.getElementById("micselect");
        micselect.innerHTML = "" // remove all web cams
        {
            const option = document.createElement("option")
            option.value = ""
            option.text = "Off"
            if (!config.hardwareCamId)
                option.selected = true;
            micselect.add(option)
        }
        mics.forEach(cam => {
            const option = document.createElement("option")
            option.value = cam.deviceId
            option.text = cam.label || `audio ${cam.deviceId}`
            micselect.add(option)
            if (config.micId == cam.deviceId && cam.deviceId)
                option.selected = true;
        })
        micselect.onchange = function () {
            const selected = micselect.options[micselect.selectedIndex];
            config.micId = selected.value;
            saveConfig(config)
            render()
        }
        const micdelayinput = document.getElementById("micdelayinput")
        micdelayinput.value = config.micDelay || ""
        micdelayinput.onchange = function (e) {
            const i = parseInt(micdelayinput.value || "0");
            config.micDelay = isNaN(i) ? 0 : i;
            micdelayinput.value = config.micDelay
            saveConfig(config);
        }

    }

    function setEditor(editor) {
        const editorConfig = editorConfigs[editor];
        if (!editorConfig) return;

        const config = readConfig();
        config.editor = editor;
        if (editorConfig)
            config.title = editorConfig.title || `MakeCode ${editorConfig.name}`
        saveConfig(config);
        loadEditor();
        loadSettings();
        loadSocial();
        render()
    }

    document.onkeyup = function (ev) {
        // always active
        if (ev.shiftKey && ev.altKey) {
            switch (ev.keyCode) {
                // scenes
                case 49: // 1
                    togglePaint(ev);
                    break;
                case 50: // 2
                    ev.preventDefault();
                    setScene("left");
                    break;
                case 51: // 3
                    ev.preventDefault();
                    setScene("right");
                    break;
                case 52: // 4
                    ev.preventDefault();
                    setScene("chat");
                    break;
                case 53: // 5
                    ev.preventDefault();
                    setScene("countdown");
                    break;
                case 54: // 6
                    ev.preventDefault();
                    toggleThumbnail();
                    break;
                case 55: // 7
                    toggleHardware(ev);
                    break;
                case 56: // 8
                    toggleChat(ev);
                    break;

                // paint tools
                case 65: // a
                    setPaintTool(ev, "arrow"); break;
                case 82: // r
                    setPaintTool(ev, "rect"); break;
            }
        }
        // special keys
        if (state.sceneIndex == COUNTDOWN_SCENE_INDEX) {
            switch (ev.keyCode) {
                case 38: // arrow up
                    updateCountdown(60); break;
                case 40: // arrow down
                    updateCountdown(-60); break;
            }
        }

        function setPaintTool(ev, name) {
            state.painttool = name
            if (!state.paint)
                togglePaint(ev);
            render()
        }
    };

    function accessify(el) {
        el.tabIndex = 0;
        el.role = "button";
        el.onkeypress = e => {
            const charCode = (typeof e.which == "number") ? e.which : e.keyCode;
            if (charCode === 13 /* enter */ || charCode === 32 /* space */) {
                e.preventDefault();
                e.currentTarget.click();
            }
        }
    }

    function initAccessibility() {
        const clickeable = document.getElementsByClassName("clickeable");
        for (let i = 0; i < clickeable.length; ++i) {
            const c = clickeable[i];
            accessify(c);
        }

    }

    function tickEvent(id, data, opts) {
        if (typeof pxt === "undefined" || !pxt.aiTrackException || !pxt.aiTrackEvent) return;
        if (opts && opts.interactiveConsent && typeof mscc !== "undefined" && !mscc.hasConsent()) {
            mscc.setConsent();
        }
        const args = tickProps(data);
        pxt.aiTrackEvent(id, args[0], args[1]);
    }

    function trackException(err, id, data) {
        const args = tickProps(data);
        pxt.aiTrackException(err, id, args[0]);
    }

    function tickProps(data) {
        const config = readConfig();
        const props = {
            target: "streamer",
            editor: config.editor,
        };
        const measures = {
            hardwareCam: config.hardwareCamId ? 1 : 0,
            multiEditor: config.multiEditor ? 1 : 0,
            twitch: config.twitch ? 1 : 0
        };
        if (data)
            Object.keys(data).forEach(k => {
                if (typeof data[k] == "string") props[k] = data[k];
                else if (typeof data[k] == "number") measures[k] = data[k];
                else props[k] = JSON.stringify(data[k] || '');
            });
        return [props, measures];
    }
})()