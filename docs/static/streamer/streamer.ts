declare let pxt: any;
declare let Seriously: any;
declare let webkitSpeechRecognition: any;
declare let YT: any;

interface Coord {
    x: number;
    y: number;
}

interface PaintAction {
    type: string,
    tool: string,
    emoji?: string,
    color?: string,
    mouse?: Coord,
    head?: Coord
}

interface SeriouslyVideo {
    seriously: {
        chroma: any;
    }
}

interface StreamerState {
    sceneIndex: number,
    face?: boolean,
    chat?: boolean,
    hardware?: boolean,
    painttool?: string,
    thumbnail?: boolean,
    paint?: PaintAction[],
    paintColor?: string,
    micError?: boolean,
    screenshoting?: boolean,
    faceCamError?: boolean,
    hardwareCamError?: boolean,
    speech?: any,
    speechRunning?: boolean,
    emoji?: string,
    timerEnd?: number,
    timerInterval?: any,
    timerCallback?: () => void;
    screenshotStream?: MediaStream;
    screenshotVideo?: HTMLVideoElement;
    recording?: () => void;
    stingering?: boolean;
    addSite?: boolean;
    siteUrl: string
}

interface StreamerConfig {
    editor: string;
    multiEditor?: boolean;
    faceCamLabel?: string;
    hardwareCamLabel?: string;
    emojis: string;
    micDelay?: number;
    title?: string;
    backgroundImage?: string;
    backgroundVideo?: string;
    stingerVideo?: string;
    stingerVideoDelay?: number;
    stingerVideoGreenScreen?: string;
    camoverlayVideo?: string;
    faceCamGreenScreen?: string;
    hardwareCamGreenScreen?: string;
    faceCamClipBlack?: number;
    hardwareCamClipBlack?: number;
    faceCamCircular?: boolean;
    hardwareCamCircular?: boolean;
    faceCamId?: string;
    hardwareCamId?: string;
    micId?: string;
    faceCamFilter?: any;
    hardwareCamFilter?: any;
    faceCamContour?: string;
    hardwareCamContour?: string;
    faceCamRotate?: boolean;
    hardwareCamRotate?: boolean;
    greenScreen?: boolean;
    countdownEditor?: boolean;
    countdownEditorBlur?: boolean;
    fullScreenEditor?: boolean;
    twitch?: string;
    restream?: string;
    extraSites?: string[];
    startVideo?: string;
    endVideo?: string;
    stylePrimary?: string;
    styleBorder?: string;
    styleBackground?: string;
}

let youTubeReady = false
let stingerPlayer;
const stingerEvents = {
    start: () => { },
    end: () => { }
}
function onYouTubeIframeAPIReady() {
    youTubeReady = true;
    console.log(`youtube ready`)
    stingerPlayer = new YT.Player('stingeryoutube', {
        playerVars: {
            mute: 1,
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0
        },
        events: {
            onReady: () => {
                console.log(`stinger youtube ready`)
                const stingeryoutube = document.getElementById('stingeryoutube')
            },
            onError: () => {
                const stingeryoutube = document.getElementById('stingeryoutube')
                stingeryoutube.classList.add("hidden");
                stingerEvents.end()
            },
            onStateChange: (ev) => {
                const playerState = ev.data;
                console.log(`stinger youtube state`, playerState)
                const stingeryoutube = document.getElementById('stingeryoutube')
                switch (playerState) {
                    case YT.PlayerState.PLAYING: // playing
                        stingeryoutube.classList.remove("hidden");
                        stingerEvents.start()
                        break;
                    case YT.PlayerState.ENDED: // ended
                    case YT.PlayerState.PAUSEd: // pause
                        stingeryoutube.classList.add("hidden");
                        stingerEvents.end()
                        break;
                }
            }
        }
    });
}

(async function () {
    const body = document.body;
    const container = document.getElementById("container");
    const selectapp = document.getElementById("selectapp");
    const facecamcontainer = document.getElementById("facecam");
    const facecam = document.getElementById("facecamvideo") as HTMLVideoElement;
    const facecamoverlay = document.getElementById("facecamoverlay") as HTMLVideoElement;
    const facecamlabel = document.getElementById("facecamlabel");
    const hardwarecamcontainer = document.getElementById("hardwarecam");
    const hardwarecam = document.getElementById("hardwarecamvideo") as HTMLVideoElement;
    const hardwarecamoverlay = document.getElementById("hardwarecamoverlay") as HTMLVideoElement;
    const hardwarecamlabel = document.getElementById("hardwarecamlabel");
    const chat = document.getElementById("chat") as HTMLIFrameElement;
    const settings = document.getElementById("settings");
    const editorStyle = document.getElementById("editorstyle");
    const toolbox = document.getElementById("toolbox");
    const paintbox = document.getElementById("paintbox");
    const paint = document.getElementById('paint') as HTMLCanvasElement;
    const paintCtx = paint.getContext('2d');
    const painttool = document.getElementById('painttool') as HTMLCanvasElement;
    const painttoolCtx = painttool.getContext('2d');
    const recorder = document.getElementById('recorder')
    const countdown = document.getElementById('countdown') as HTMLDivElement
    const titleEl = document.getElementById('title')
    const subtitles = document.getElementById('subtitles')
    const stingervideo = document.getElementById('stingervideo') as HTMLVideoElement
    const stingervideoserious = document.getElementById('stingervideoserious') as HTMLVideoElement
    const backgroundvideo = document.getElementById('backgroundvideo') as HTMLVideoElement
    const backgroundyoutube = document.getElementById('backgroundyoutube') as HTMLIFrameElement
    const addsiteinput = document.getElementById('addsiteinput') as HTMLInputElement;
    const hasGetDisplayMedia = !!(<any>navigator)?.mediaDevices?.getDisplayMedia;

    const cachedFrames: { [url: string]: HTMLIFrameElement } = {}
    const cachedFrames2: { [url: string]: HTMLIFrameElement } = {}
    const paintColors = ["#ffe135", "#00d9ff", "#cf1fdb", "#ee0000"];

    const scenes = ["leftscene", "rightscene", "chatscene", "countdownscene"];
    const LEFT_SCENE_INDEX = scenes.indexOf("leftscene")
    const RIGHT_SCENE_INDEX = scenes.indexOf("rightscene")
    const CHAT_SCENE_INDEX = scenes.indexOf("chatscene")
    const COUNTDOWN_SCENE_INDEX = scenes.indexOf("countdownscene")
    const DISPLAY_DEVICE_ID = "display"
    const STREAMER_ID = "streamer"
    const state: StreamerState = {
        sceneIndex: -1,
        paintColor: paintColors[0],
        face: true,
        siteUrl: undefined
    }
    let editorConfigs;
    const db = await openDbAsync()

    try {
        tickEvent("streamer.load.start")
        body.classList.add("loading");
        console.log(`loading...`)
        editorConfigs = await fetchJSON("editors.json");
        console.log(`found ${Object.keys(editorConfigs).length} editors`)

        initMessages();
        initResize();
        initFocus();
        initVideos();
        initSubtitles();
        initAccessibility();
        initAddSite();
        loadPaint();
        loadEditor()
        loadToolbox()
        loadChat()
        loadSocial()
        await firstLoadFaceCam()
        await loadHardwareCam()
        await loadCamOverlays()
        await loadSettings()
        setScene("right")
        render()
        handleHashChange();
        tickEvent("streamer.load.ok")
        cleanVideos()
    } catch (e) {
        tickEvent("streamer.load.error")
        trackException(e, "load");
        console.error(e)
    }

    function editor() {
        return document.getElementById("editor") as HTMLIFrameElement
    }

    function editor2() {
        return document.getElementById("editor2") as HTMLIFrameElement;
    }

    function saveConfig(config) {
        if (!config) throw new Error("missing config")
        localStorage["streamer.config"] = JSON.stringify(config)
    }

    function cleanVideos() {
        const config = readConfig();
        const blobs = Object.keys(config)
            .filter(k => /Video$/.test(k))
            .map<string>(k => config[k])
            .filter(v => !!v)
            .map(v => v.split('\n')
                .filter(l => /^blob:/.test(l))
                .map(l => l.replace(/^blob:/, ''))
            ).reduce((all, curr) => all.concat(curr), []);
        db.gc(blobs)
    }

    async function showSettings() {
        await loadSettings()
        state.addSite = false;
        settings.classList.remove("hidden")
        render();
    }

    async function hideSettings() {
        settings.classList.add("hidden")
    }

    function settingsVisible() {
        return !/hidden/.test(settings.className)
    }

    function toggleSettings() {
        if (!settingsVisible())
            showSettings();
        else
            hideSettings();
    }

    function defaultConfig() {
        const cfg: StreamerConfig = {
            editor: "microbit",
            multiEditor: false,
            faceCamLabel: "",
            hardwareCamLabel: "",
            emojis: "😄🤔😭👀",
            micDelay: 300,
            title: "",
        }
        return cfg;
    }

    function readConfig(): StreamerConfig {
        try {
            const cfg = JSON.parse(localStorage["streamer.config"]) as StreamerConfig;
            if (cfg) {
                return cfg;
            }
        } catch (e) {
            console.log(e)
        }

        const cfg = defaultConfig();
        saveConfig(cfg)
        return cfg;
    }

    async function fetchJSON(url) {
        const resp = await fetch(url)
        const json = await resp.json();
        return json;
    }

    function parseYouTubeVideoId(url: string) {
        if (!url) return undefined;
        const m = /^https:\/\/(?:youtu\.be\/|(?:www.)?youtube.com\/watch\?v=)([a-z0-9_\-]+)$/i.exec(url)
        return m && m[1];
    }

    function createYouTubeEmbedUrl(ytVideoId: string, interactive: boolean) {
        let url = `https://www.youtube.com/embed/${ytVideoId}?autoplay=1&controls=${interactive ? "1" : "0"}&disablekb=1&fs=0&loop=1&playlist=${ytVideoId}&modestbranding=1&rel=0`;
        if (!interactive)
            url += "&mute=1"
        return url;
    }

    function render() {
        loadToolbox();

        const config = readConfig();
        const ytVideoId = parseYouTubeVideoId(config.backgroundVideo);

        body.className = [
            scenes[state.sceneIndex],
            state.hardware && "hardware",
            !state.face && "hideFacecam",
            state.chat && "chat",
            config.multiEditor && "multi",
            state.paint && "paint",
            state.micError && "micerror",
            state.recording && "recording",
            state.screenshoting && "screenshoting",
            state.stingering && "stingering",
            state.addSite && "addsite",
            (config.faceCamGreenScreen || config.hardwareCamGreenScreen) && state.thumbnail && "thumbnail",
            config.micDelay === undefined && "micdelayerror",
            !hasGetDisplayMedia && "displaymediaerror",
            config.faceCamLabel && !config.faceCamCircular && "facecamlabel",
            config.hardwareCamLabel && !config.hardwareCamCircular && "hardwarecamlabel",
            config.faceCamCircular && "facecamcircular",
            config.hardwareCamCircular && "hardwarecamcircular",
            config.faceCamId === DISPLAY_DEVICE_ID && "facecamdisplay",
            config.hardwareCamId && "hashardwarecam",
            config.hardwareCamId === DISPLAY_DEVICE_ID && "hardwarecamdisplay",
            config.greenScreen && "greenscreen",
            !!ytVideoId ? "backgroundyoutube" : config.backgroundVideo ? "backgroundvideo" : config.backgroundImage && "parallax",
            config.countdownEditor && "countdowneditor",
            config.countdownEditorBlur && "countdowneditorblur",
            config.fullScreenEditor && !config.multiEditor && "slim",
            (config.twitch || config.restream) && "haschat",
            config.faceCamGreenScreen && "hasthumbnail",
            config.stingerVideo && "hasstinger",
            config.camoverlayVideo && "hascamoverlay",
        ].filter(cls => !!cls).join(' ');
        if (state.face && (!config.faceCamId || state.faceCamError))
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

        //addSceneButton("OpenPane", "Move webcam left (Alt+Shift+2)", "left")
        //addSceneButton("OpenPaneMirrored", "Move webcam right (Alt+Shift+3)", "right")
        //addSceneButton("Contact", "Webcam large (Alt+Shift+4)", "chat")
        addSceneButton("Timer", "Show countdown (Alt+Shift+5)", "countdown")
        addButton(toolbox, "Webcam2", "Toggle webcam", toggleFace, state.face)

        //if (config.faceCamGreenScreen || config.hardwareCamGreenScreen) {
        //    addSep(toolbox)
        //    if (config.faceCamGreenScreen || config.hardwareCamGreenScreen)
        //        addButton(toolbox, "PictureCenter", "Toggle thumbnail mode (Alt+Shift+6)", toggleThumbnail, state.thumbnail)
        //if (config.hardwareCamId)
        //    addButton(toolbox, "Robot", "Hardware webcam (Alt+Shift+7)", toggleHardware, state.hardware)
        //if (config.twitch)
        //    addButton(toolbox, "OfficeChat", "Chat  (Alt+Shift+8)", toggleChat, state.chat)
        //}
        if (document.fullscreenEnabled) {
            addSep(toolbox)
            addButton(toolbox, "FullView", "Toggle full screen", toggleFullscreen)
        }

        addSep(toolbox);
        addButton(toolbox, "Add", "Add web site", addAddSiteButton)
        if (config.extraSites) config.extraSites.forEach(addSiteButton)
        addButton(toolbox, "Code", "Reload MakeCode editor", () => startStinger(config.stingerVideo, loadEditor, config.stingerVideoGreenScreen, config.stingerVideoDelay), !state.siteUrl)

        addSep(toolbox)
        if (state.speech)
            addButton(toolbox, "ClosedCaption", "Captions", toggleSpeech, state.speechRunning)
        if (hasGetDisplayMedia) {
            addButton(toolbox, "BrowserScreenShot", "Take screenshot", takeScreenshot);
            if (state.recording)
                addButton(toolbox, "Stop", "Stop recording", stopRecording)
            else
                addButton(toolbox, "Record2", "Start recording", startRecording)
        }

        addSep(toolbox)
        addButton(toolbox, "Settings", "Show settings", toggleSettings);

        function addSep(container) {
            const sep = document.createElement("div")
            sep.className = "sep"
            container.append(sep)
        }

        function addButton(container, icon, title, handler, active?: boolean) {
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
            if (emoji === state.emoji && state.paint)
                btn.classList.add("active")
            btn.innerText = emoji;
            btn.addEventListener("click", function (e) {
                tickEvent("streamer.emoji", { emoji }, { interactiveConsent: true })
                state.emoji = emoji;
                setPaintTool("emoji")
            }, false)
            paintbox.append(btn)
        }

        function addAddSiteButton() {
            state.addSite = true;
            render();
            addsiteinput.focus()
        }

        function addSiteButton(url) {
            addButton(toolbox, "SingleBookmark", url, () => setSite(url), url === state.siteUrl)
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
                if (!state.paint)
                    setPaintTool("pen")
                pushPaintEvent("whiteboard")
            })
        }
    }

    async function toggleFullscreen() {
        if (document.fullscreen) {
            await document.exitFullscreen()
        } else {
            await document.firstElementChild.requestFullscreen()
        }
    }

    function toggleFace() {
        state.face = !state.face
        render()
    }

    function setSite(url) {
        const reload = state.siteUrl === url
        state.siteUrl = url
        const config = readConfig();
        const ytid = parseYouTubeVideoId(url);
        if (ytid)
            url = createYouTubeEmbedUrl(ytid, true)
        startStinger(config.stingerVideo, () => {
            if (state.sceneIndex === CHAT_SCENE_INDEX || state.sceneIndex == COUNTDOWN_SCENE_INDEX)
                setScene("right");
            if (config.multiEditor && state.sceneIndex == LEFT_SCENE_INDEX)
                setFrameUrl(editor2(), url, true, reload);
            else
                setFrameUrl(editor(), url, false, reload);
        }, config.stingerVideoGreenScreen, config.stingerVideoDelay)
    }

    function setScene(scene) {
        tickEvent("streamer.scene", { scene: scene });
        const config = readConfig();
        const lastSceneIndex = state.sceneIndex;
        let sceneIndex = scenes.indexOf(`${scene}scene`);

        // click on countdown from countdown exits to chat
        if (sceneIndex === COUNTDOWN_SCENE_INDEX && lastSceneIndex === sceneIndex) {
            sceneIndex = CHAT_SCENE_INDEX
            scene = "chat"
        }

        // handle countdown
        if (sceneIndex === COUNTDOWN_SCENE_INDEX) {
            startCountdown(300000);
            const v = config.endVideo || config.stingerVideo
            if (v) {
                startStingerScene(v, sceneIndex)
                return;
            }
        } else {
            stopCountdown();
            const v = config.endVideo || config.stingerVideo
            if (lastSceneIndex == COUNTDOWN_SCENE_INDEX && v) {
                startStingerScene(v, sceneIndex)
                return;
            }
        }

        // stinger animation
        if (config.stingerVideo &&
            (sceneIndex == CHAT_SCENE_INDEX && isLeftOrRightScene(lastSceneIndex))
            || (isLeftOrRightScene(sceneIndex) && lastSceneIndex == CHAT_SCENE_INDEX)) {
            startStingerScene(config.stingerVideo, sceneIndex)
            return;
        }

        updateScene(sceneIndex);
        render();

        function isLeftOrRightScene(i) {
            return i == LEFT_SCENE_INDEX || i == RIGHT_SCENE_INDEX
        }
    }

    function updateScene(sceneIndex: number) {
        state.sceneIndex = sceneIndex;
        resetTransition(facecamlabel, "fadeout")
        resetTransition(hardwarecamlabel, "fadeout")
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

    function startCountdown(duration?, callback?) {
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
                countdown.innerText = (minutes || seconds > 10) ? `${minutes}:${pad(seconds)}` : `${seconds}`;
            } else {
                countdown.innerText = "";
            }
        } else {
            countdown.innerText = ""
        }

        function pad(num) {
            const s = "00" + num;
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

    function toggleThumbnail(ev: Event) {
        stopEvent(ev)
        const config = readConfig();
        startStinger(config.stingerVideo, () => {
            state.thumbnail = !state.thumbnail;
            if (state.thumbnail)
                state.chat = false;
            render();
        }, config.stingerVideoGreenScreen, config.stingerVideoDelay)
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

    function pushPaintEvent(ev, mouse?, head?) {
        const r = {
            type: ev,
            tool: state.painttool,
            emoji: state.emoji,
            color: state.paintColor,
            mouse: undefined,
            head: undefined
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
        let ev: PaintAction;
        // eslint-disable-next-line  no-cond-assign
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
                painttoolCtx.lineWidth = Math.max(16, (paint.width / 60) | 0);
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
                ctx.lineWidth *= 1 / outline;
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
                ctx.lineWidth *= 1 / outline;
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

    function setFrameUrl(frame: HTMLIFrameElement, url: string, secondary?: boolean, reload?: boolean) {
        const caches = secondary ? cachedFrames2 : cachedFrames;
        let cached = caches[url];
        if (!cached) {
            cached = caches[url] = document.createElement("iframe");
            cached.className = "box animated site hidden"
            cached.setAttribute("allow", "usb;camera;serial;microphone")
            cached.setAttribute("sandbox", "allow-scripts allow-same-origin allow-top-navigation allow-downloads allow-popups allow-popups-to-escape-sandbox allow-forms");
            cached.src = url;
            frame.parentElement.insertBefore(cached, frame);
        }

        if (reload)
            cached.src = cached.src

        // insert and remove
        frame.classList.add('hidden')
        const id = frame.getAttribute("id");
        frame.setAttribute("id", "")
        cached.setAttribute("id", id)
        cached.classList.remove('hidden')
    }

    function loadEditor(hash?: string) {
        const config = readConfig();
        // update first editor
        const editorConfig = editorConfigs[config.editor];
        if (!editorConfig) {
            showSettings();
            loadStyle();
            return;
        }

        let url = `${editorConfig.url}?editorLayout=ide&nosandbox=1}`;
        if (config.multiEditor)
            url += `&nestededitorsim=1`;
        if (hash)
            url += `#${hash}`

        const reload = !state.siteUrl
        state.siteUrl = undefined
        setFrameUrl(editor(), url, false, reload)

        if (config.multiEditor) {
            if (!editor2().parentElement)
                container.insertBefore(editor2(), editor());
            setFrameUrl(editor2(), url, true, reload)
        } else {
            // remove from DOM
            const e2 = editor2();
            if (e2)
                e2.remove();
        }

        loadStyle();
        render()
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
#countdown {
    color: ${primary};
    text-shadow: -3px 3px 1px #fff,
    3px 3px 1px #fff,
    3px -3px 1px #fff,
    -3px -3px 1px #fff;
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

        const ytVideoId = parseYouTubeVideoId(config.backgroundVideo);
        if (ytVideoId) {
            backgroundvideo.src = undefined;
            const url = createYouTubeEmbedUrl(ytVideoId, false)
            if (backgroundyoutube.src !== url)
                backgroundyoutube.src = url

            // rescale youtube iframe to cover the entire background
            const el = document.firstElementChild;
            const w = el.clientWidth
            const h = el.clientHeight
            const ratio = w / h;
            const hd = 16 / 9;
            if (ratio > hd) {
                // the video is going to be 16:9, compensate
                console.log(`ratio`, ratio)
                const vh = 100 * ratio / hd
                backgroundyoutube.style.height = `${vh}vh`
                backgroundyoutube.style.width = `100vw`
                backgroundyoutube.style.transform = `translate(0, ${-(vh - 100) / 2}vh)`
            } else {
                const vw = 100 / ratio * hd
                backgroundyoutube.style.height = `100vh`
                backgroundyoutube.style.width = `${vw}vw`
                backgroundyoutube.style.transform = `translate(${-(vw - 100) / 2}vh, 0)`
            }

        } else if (config.backgroundVideo) {
            resolveBlob(config.backgroundVideo).then(vurl => {
                backgroundvideo.src = vurl;
                backgroundyoutube.src = undefined;
            })
        } else {
            backgroundvideo.src = undefined;
            backgroundyoutube.src = undefined;
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
        state.chat = !state.chat && !!(config.twitch || config.restream);
        render();
    }

    function toggleHardware(e) {
        tickEvent("streamer.togglehardware", undefined, { interactiveConsent: true });
        if (e)
            stopEvent(e)
        const config = readConfig();
        state.hardware = !state.hardware && !!config.hardwareCamId;
        render();
    }

    function loadSocial() {
        const config = readConfig();

        if (!(config.twitch || config.restream))
            state.chat = false;

        titleEl.innerText = config.title || "";
    }

    function loadChat() {
        const config = readConfig();
        if (config.twitch) {
            chat.src = `https://www.twitch.tv/embed/${config.twitch}/chat?parent=makecode.com`;
            if (!chat.parentElement)
                container.insertBefore(chat, facecamcontainer)
        } else if (config.restream) {
            chat.src = config.restream;
            if (!chat.parentElement)
                container.insertBefore(chat, facecamcontainer)
        } else { // remove from dom
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
        if (!state.face) return;

        // load previous webcam
        const config = readConfig();
        try {
            state.faceCamError = false;
            body.classList.add("loading");
            facecamcontainer.classList.remove("error");
            await startStream(facecam, config.faceCamId, config.faceCamRotate, config.faceCamGreenScreen, config.faceCamClipBlack, config.faceCamContour);
            console.log(`face cam started`)
            if (!config.faceCamId)
                stopStream(facecam.srcObject); // request permission only
            state.face = true
            render()
            return; // success!
        }
        catch (e) {
            tickEvent("streamer.facecam.error")
            stopStream(facecam.srcObject);
            facecamcontainer.classList.add("error");
            state.faceCamError = true;
            state.face = false
            saveConfig(config)
            console.log(`could not start face cam`, e)
            render()
        }
        finally {
            body.classList.remove("loading");
        }
    }

    async function loadCamOverlays() {
        const config = readConfig();
        // update overlay
        if (config.camoverlayVideo) {
            const url = await resolveBlob(config.camoverlayVideo)
            facecamoverlay.src = url
            hardwarecamoverlay.src = url
        } else {
            const url = facecamoverlay.src;
            URL.revokeObjectURL(url);
            facecamoverlay.src = ""
            hardwarecamoverlay.src = ""
        }
    }

    async function loadHardwareCam() {
        // load previous webcam
        const config = readConfig();
        if (config.hardwareCamId) {
            try {
                state.hardwareCamError = false;
                hardwarecamcontainer.classList.remove("hidden");
                hardwarecamcontainer.classList.remove("error");
                await startStream(hardwarecam, config.hardwareCamId, config.hardwareCamRotate, config.hardwareCamGreenScreen, config.hardwareCamClipBlack, config.hardwareCamContour);
                console.log(`hardware cam started`)
                return; // success!
            }
            catch (e) {
                tickEvent("streamer.hardwarecam.error")
                stopStream(hardwarecam.srcObject)
                state.hardwareCamError = true;
                hardwarecamcontainer.classList.add("error");
                saveConfig(config)
                console.log(`could not start web cam`, e)
                render()
            }
        } else {
            state.hardwareCamError = false
            hardwarecamcontainer.classList.add("hidden");
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
                (<any>constraints.audio).deviceId = config.micId;
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

    function initAddSite() {
        accessify(addsiteinput);
        addsiteinput.addEventListener("click", ev => {
            const value = addsiteinput.value;
            if (!value) return; // ignore click

            state.addSite = false;
            const config = readConfig();

            // emoji?
            const em = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])+/.exec(value);
            if (em) {
                addsiteinput.value = "";
                config.emojis = em[0];
                saveConfig(config);
                state.emoji = config.emojis.substr(0, 2);
                setPaintTool("emoji")
            } else {
                const url: string = normalizeUrl(value);
                if (url) {
                    addsiteinput.value = "";
                    if (!config.extraSites)
                        config.extraSites = [];
                    if (config.extraSites.indexOf(url) < 0) {
                        config.extraSites.push(url);
                        saveConfig(config);
                    }
                    setSite(url)
                }
            }
            render();
        })
    }

    function initVideos() {
        accessify(facecam.parentElement)
        accessify(hardwarecam.parentElement)
        facecam.parentElement.onclick = () => onClick(facecam.parentElement);
        hardwarecam.parentElement.onclick = () => onClick(hardwarecam.parentElement);

        const facecamchatscenebtn = document.getElementById("facecamchatscenebtn")
        facecamchatscenebtn.onclick = showChat
        const hardwarecamchatscenebtn = document.getElementById("hardwarecamchatscenebtn")
        hardwarecamchatscenebtn.onclick = showChat
        const facecamchatbtn = document.getElementById("facecamchatbtn")
        facecamchatbtn.onclick = toggleChat
        const hardwarecamchatbtn = document.getElementById("hardwarecamchatbtn")
        hardwarecamchatbtn.onclick = toggleChat
        const facecamleftbtn = document.getElementById("facecamleftbtn")
        facecamleftbtn.onclick = showLeft
        const hardwarecamleftbtn = document.getElementById("hardwarecamleftbtn")
        hardwarecamleftbtn.onclick = showLeft
        const facecamrightbtn = document.getElementById("facecamrightbtn")
        facecamrightbtn.onclick = showRight
        const hardwarecamrightbtn = document.getElementById("hardwarecamrightbtn")
        hardwarecamrightbtn.onclick = showRight
        const facecamhardwarebtn = document.getElementById("facecamhardwarebtn")
        facecamhardwarebtn.onclick = toggleHardware
        const hardwarecamhardwarebtn = document.getElementById("hardwarecamhardwarebtn")
        hardwarecamhardwarebtn.onclick = toggleHardware
        const facecamthumbnailbtn = document.getElementById("facecamthumbnailbtn")
        facecamthumbnailbtn.onclick = toggleThumbnail
        const hardwarecamthumbnailbtn = document.getElementById("hardwarecamthumbnailbtn")
        hardwarecamthumbnailbtn.onclick = toggleThumbnail

        function swapLeftRight() {
            tickEvent("streamer.swap.leftright", undefined, { interactiveConsent: true })
            if (state.sceneIndex == LEFT_SCENE_INDEX)
                setScene("right")
            else if (state.sceneIndex == RIGHT_SCENE_INDEX)
                setScene("left")
            else if (state.sceneIndex == CHAT_SCENE_INDEX) {
                swapVideos();
                //updateSwap();
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

        function showChat(e) {
            tickEvent("streamer.videochatbtn", undefined, { interactiveConsent: true })
            stopEvent(e)
            setScene("chat")
        }

        function showLeft(e) {
            tickEvent("streamer.videoleftbtn", undefined, { interactiveConsent: true })
            stopEvent(e)
            setScene("left")
        }

        function showRight(e) {
            tickEvent("streamer.videorightbtn", undefined, { interactiveConsent: true })
            stopEvent(e)
            setScene("right")
        }

        function onClick(el) {
            const isfacecam = el.classList.contains("facecam");
            if (!isfacecam && state.hardware)
                swapVideos();
            else
                swapLeftRight();
        }

        const playpip = document.getElementById("playpip");
        const introvideo = document.getElementById("introvideo") as HTMLVideoElement;
        playpip.onclick = function (e) {
            tickEvent("streamer.intro.video", undefined, { interactiveConsent: true })
            stopEvent(e)
            loadSettings()
            hideSettings();
            (<any>introvideo).requestPictureInPicture()
                .then(() => introvideo.play())
        }
    }

    async function repairCams() {
        if (state.faceCamError)
            await loadFaceCam();
        if (state.hardwareCamError && state.hardware)
            await loadHardwareCam();
    }

    function initFocus() {
        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState === 'visible') {
                console.log(`visible`)
                repairCams()
            }
        }, false);
    }

    function initResize() {
        const resolutions = [{
            w: 1920,
            h: 1080,
            name: "HD 1080p"
        }, {
            w: 1280,
            h: 720,
            name: "SD 720p"
        }
        ]

        function update() {
            // clear canvas if any
            clearPaint();

            const el = document.firstElementChild;
            const w = el.clientWidth
            const h = el.clientHeight
            const resolution = resolutions.filter(r => r.w == w && r.h == h)[0];
            const text = `${w}x${h} ${resolution?.name || `- resize to 1920x1080 or 1080x720`}`
            const els = document.getElementsByClassName("screensize")
            for (let i = 0; i < els.length; ++i) {
                const el = els[i] as HTMLSpanElement
                el.innerText = text
                if (resolution) el.classList.add("perfect")
                else el.classList.remove("perfect")
            }

            // update ui
            loadStyle();
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
                const frames = document.querySelectorAll("iframe.site");
                for (let i = 0; i < frames.length; ++i) {
                    const ifrm = frames.item(i) as HTMLIFrameElement;
                    if (ifrm.contentWindow !== source)
                        ifrm.contentWindow.postMessage(data, "*");
                }
            }
        };

        window.onhashchange = handleHashChange;
        window.addEventListener("error", (ev: ErrorEvent) => {
            trackException(ev.error, "error");
            return false;
        });
        window.addEventListener("unhandledrejection", function (ev) {
            trackException(ev.reason, "promise");
        });
    }

    function handleHashChange() {
        const hash = window.location.hash;
        const parts = (hash || "").replace(/^#/, '').split('|');
        parts.forEach(part => {
            const frags = part.split(':')
            if (frags.length >= 2) {
                const action = frags.shift();
                const arg = frags.shift();
                const slug = frags.join(':')
                switch (action) {
                    case "editor": {
                        setEditor(arg, slug); break;
                    }
                    case "doc": {
                        // only same domain as editor
                        const config = readConfig();
                        const editorConfig = editorConfigs[config.editor]
                        config.multiEditor = true;
                        const doc = editorConfig.url.trim(/\/\w+$/) + "/" + arg.replace(/^\//, "");
                        setFrameUrl(editor2(), doc, true);
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
            const stream = await (<any>navigator).mediaDevices?.getDisplayMedia({
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
                    aspectRatio: 16 / 9,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            }
            if (deviceId)
                (<any>constraints).video.deviceId = deviceId;
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            el.srcObject = stream;
        }

        el.muted = true;
        el.volume = 0; // don't use sound!
        el.onloadedmetadata = (e) => {
            el.play();
            toggleGreenScreen(greenscreen, el, rotate, clipBlack, contourColor);
        }
        if (rotate)
            el.classList.add("rotate")
        else
            el.classList.remove("rotate");
    }

    function toggleGreenScreen(greenscreen: string, el: HTMLVideoElement, rotate?: boolean, clipBlack?: number, contourColor?: string) {
        // time to get serious
        if (greenscreen) {
            startGreenScreen(greenscreen, el, rotate, clipBlack, contourColor)
        }
        else
            stopGreenScreen(el)
    }

    function startGreenScreen(greenscreen: string, el: HTMLVideoElement, rotate?: boolean, clipBlack?: number, contourColor?: string) {
        el.style.opacity = "0";
        el.parentElement.classList.add("greenscreen")
        // https://github.com/brianchirls/Seriously.js/
        const canvas = document.getElementById(el.id + "serious") as HTMLCanvasElement;
        if (rotate)
            canvas.classList.add("rotate")
        else
            canvas.classList.remove("rotate");
        canvas.width = el.videoWidth;
        canvas.height = el.videoHeight;
        cleanSeriously(el)
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

        (el as any).seriously = seriously;
    }

    function stopGreenScreen(el: HTMLVideoElement) {
        el.style.opacity = "1";
        el.parentElement.classList.remove("greenscreen")
        cleanSeriously(el)
    }

    function cleanSeriously(el: HTMLVideoElement) {
        if ((el as any).seriously) {
            (el as any).seriously.stop();
            (el as any).seriously.destroy();
            (el as any).seriously = undefined;
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
                for (let i = nextInterimResult; i < results.length; ++i) {
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
            const stream = await (<any>navigator).mediaDevices?.getDisplayMedia({
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

        let stream: any = state.screenshotStream;
        if (!stream) {
            stream = state.screenshotStream = await getDisplayStream(false);
            stream.onerror = clean;
            stream.oninactive = clean;
            stream.onended = clean;
            const video = state.screenshotVideo = document.createElement("video") as HTMLVideoElement
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
            cvs.toBlob(img => downloadBlob(img, "screenshot.png"));
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
        mediaRecorder.ondataavailable = (e: any) => e.data.size && chunks.push(e.data);
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
            console.log(`downloading recorded video`)
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

    function downloadBlob(blob: Blob, name: string) {
        const url = URL.createObjectURL(blob);
        downloadUrl(url, name)
        window.URL.revokeObjectURL(url);
    }

    function downloadUrl(url: string, name: string) {
        const a = document.createElement("a") as HTMLAnchorElement;
        document.body.appendChild(a);
        a.style.display = "none";
        a.href = url;
        a.download = name;
        a.click();
    }

    function normalizeUrl(url: string) {
        if (!url) return undefined;
        url = url.trim();
        const m = /<iframe.*?src="([^"]+)".*?>/i.exec(url)
        if (m)
            url = decodeURI(m[1]).replace(/&amp;/g, "&");
        if (!/^http?s:\/\//i.test(url))
            url = "https://" + url;
        return url;
    }

    async function loadSettings() {
        const config = readConfig();
        const cams = await listCameras()
        const mics = await listMicrophones()

        const sections = document.querySelectorAll("div.section>h3") as NodeListOf<HTMLHeadingElement>
        for (let i = 0; i < sections.length; ++i) {
            const section = sections[i];
            section.onclick = (evt) => (evt.target as HTMLElement).parentElement.classList.toggle("expanded")
        }

        const settingsclose = document.getElementById("settingsclose")
        settingsclose.onclick = function (e) {
            tickEvent("streamer.settingsclose", undefined, { interactiveConsent: true })
            stopEvent(e)
            hideSettings()
        }

        const settingsreset = document.getElementById("settingsreset")
        settingsreset.onclick = function (e) {
            tickEvent("streamer.settingsclear", undefined, { interactiveConsent: true })
            stopEvent(e)
            if (confirm("This command will erase all your settings, are you sure?")) {
                saveConfig(defaultConfig())
                window.location.reload()
            }
        }

        const importsettingsinput = document.getElementById("importsettingsinput") as HTMLInputElement
        const importsettings = document.getElementById("importsettings") as HTMLButtonElement
        importFileButton("streamer.importsettings", importsettingsinput, importsettings, (file) =>
            readFileAsText(file)
                .then(text => {
                    const config = JSON.parse(text);
                    saveConfig(config);
                    window.location.reload()
                }))

        const exportsettings = document.getElementById("exportsettings")
        exportsettings.onclick = function (e) {
            tickEvent("streamer.exportsettings", undefined, { interactiveConsent: true })
            stopEvent(e)
            const config = readConfig();
            const url = `data:text/plain;charset=utf-8,` + encodeURIComponent(JSON.stringify(config, null, 2));
            downloadUrl(url, "streamer.json")
        }

        const editorselect = document.getElementById("editorselect") as HTMLSelectElement;
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

        const fullscreeneditorcheckbox = document.getElementById("fullscreeneditorcheckbox") as HTMLInputElement
        fullscreeneditorcheckbox.checked = !!config.fullScreenEditor
        fullscreeneditorcheckbox.onchange = function () {
            config.fullScreenEditor = !!fullscreeneditorcheckbox.checked
            saveConfig(config)
            render()
        }

        const multicheckbox = document.getElementById("multicheckbox") as HTMLInputElement
        multicheckbox.checked = !!config.multiEditor
        multicheckbox.onchange = function () {
            config.multiEditor = !!multicheckbox.checked
            saveConfig(config)
            render()
            loadEditor()
        }

        const powerpointarea = document.getElementById("powerpointarea") as HTMLTextAreaElement
        powerpointarea.value = ""
        powerpointarea.oninput = function (e) {
            const value = powerpointarea.value || ""
            const m = /<iframe.*?src="([^"]+)".*?>/i.exec(value)
            if (m) {
                const url = decodeURI(m[1]).replace(/&amp;/g, "&");
                let extraSites = config.extraSites;
                if (!extraSites) extraSites = config.extraSites = [];
                if (extraSites.indexOf(url) < 0) {
                    extraSites.push(url)
                    saveConfig(config);
                    loadSettings();
                    loadToolbox();
                    render()
                }
            }
        }

        const extrasitesarea = document.getElementById("extrasitesarea") as HTMLTextAreaElement
        extrasitesarea.value = (config.extraSites || []).join('\n');
        extrasitesarea.onchange = function (e) {
            config.extraSites = (extrasitesarea.value || "").split('\n')
                .filter(line => /^https?:\/\//.test(line))
                .map(line => line.trim());
            saveConfig(config);
            loadToolbox();
            render()
        }
        const facecamselect = document.getElementById("facecamselect") as HTMLSelectElement
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
        if (hasGetDisplayMedia) {
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
            state.face = true
            if (config.hardwareCamId == config.faceCamId)
                config.hardwareCamId = undefined; // priority to face cam
            saveConfig(config)
            loadFaceCam()
                .then(() => loadCamOverlays())
                .then(() => loadSettings())
        }
        const facerotatecheckbox = document.getElementById("facerotatecameracheckbox") as HTMLInputElement
        facerotatecheckbox.checked = !!config.faceCamRotate
        facerotatecheckbox.onchange = function () {
            config.faceCamRotate = !!facerotatecheckbox.checked
            saveConfig(config)
            render()
            loadFaceCam()
                .then(() => loadCamOverlays())
                .then(() => loadSettings())
        }
        const facecamcircularcheckbox = document.getElementById("facecamcircularcheckbox") as HTMLInputElement
        facecamcircularcheckbox.checked = !!config.faceCamCircular
        facecamcircularcheckbox.onchange = function () {
            config.faceCamCircular = !!facecamcircularcheckbox.checked
            saveConfig(config)
            render()
            loadFaceCam()
                .then(() => loadCamOverlays())
                .then(() => loadSettings())
        }

        const facecamscreeninput = document.getElementById("facecamscreeninput") as HTMLInputElement
        facecamscreeninput.value = config.faceCamGreenScreen || ""
        facecamscreeninput.onchange = function (e) {
            config.faceCamGreenScreen = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(facecamscreeninput.value))
                config.faceCamGreenScreen = facecamscreeninput.value
            saveConfig(config);
            // already running?
            if (config.faceCamGreenScreen && (<any>facecam).seriously?.chroma)
                (<any>facecam).seriously.chroma.screen = toSeriousColor(config.faceCamGreenScreen);
            else
                loadFaceCam()
                    .then(() => loadCamOverlays())
                    .then(() => loadSettings())
        }
        const facecamscreenclear = document.getElementById("facecamscreenclear") as HTMLButtonElement
        facecamscreenclear.onclick = function (e) {
            config.faceCamGreenScreen = undefined;
            saveConfig(config);
            loadFaceCam()
                .then(() => loadCamOverlays())
                .then(() => loadSettings())
        }
        const facecamscreencanvas = document.getElementById("facecamscreencanvas") as HTMLCanvasElement
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
            if (config.faceCamGreenScreen && (<any>facecam).seriously?.chroma) {
                (<any>facecam).seriously.chroma.screen = toSeriousColor(config.faceCamGreenScreen);
                loadSettings()
            }
            else
                loadFaceCam()
                    .then(() => loadCamOverlays())
                    .then(() => loadSettings())
        }
        const facecamgreenclipblack = document.getElementById("facecamgreenclipblack") as HTMLInputElement
        facecamgreenclipblack.value = (config.faceCamClipBlack || 0.6) + "";
        facecamgreenclipblack.onchange = function (e) {
            config.faceCamClipBlack = parseFloat(facecamgreenclipblack.value);
            saveConfig(config);
            // already running?
            if ((<any>facecam).seriously?.chroma)
                (<any>facecam).seriously.chroma.clipBlack = config.faceCamClipBlack;
            else
                loadFaceCam()
                    .then(() => loadCamOverlays())
                    .then(() => loadSettings())
        }
        const facecamcontourinput = document.getElementById("facecamcontourinput") as HTMLInputElement
        facecamcontourinput.value = config.faceCamContour || ""
        facecamcontourinput.onchange = function (e) {
            config.faceCamContour = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(facecamcontourinput.value))
                config.faceCamContour = facecamcontourinput.value
            saveConfig(config);
            // already running?
            if (config.faceCamContour && (<any>facecam).seriously?.contour)
                (<any>facecam).seriously.contour.color = toSeriousColor(config.faceCamContour);
            else
                loadFaceCam()
                    .then(() => loadCamOverlays())
                    .then(() => loadSettings())
        }
        const facecamcontourclear = document.getElementById("facecamcontourclear") as HTMLInputElement
        facecamcontourclear.onclick = function (e) {
            config.faceCamContour = undefined;
            saveConfig(config);
            loadFaceCam()
                .then(() => loadCamOverlays())
                .then(() => loadSettings())
        }

        config.faceCamFilter = config.faceCamFilter || {};
        ["contrast", "brightness", "saturate"].forEach(function (k) {
            const elid = "facecam" + k;
            const el = document.getElementById(elid) as HTMLInputElement;
            el.valueAsNumber = config.faceCamFilter[k];
            el.onchange = function () {
                config.faceCamFilter[k] = el.valueAsNumber;
                saveConfig(config);
                loadStyle();
            }
        })
        const facecamerror = document.getElementById("facecamerror") as HTMLDivElement
        facecamerror.onclick = () => {
            repairCams();
            loadSettings();
        }
        if (state.faceCamError)
            facecamerror.classList.remove("hidden")
        else
            facecamerror.classList.add("hidden")

        const hardwarecamselect = document.getElementById("hardwarecamselect") as HTMLSelectElement
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
        if (hasGetDisplayMedia) {
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
            loadHardwareCam()
                .then(() => loadCamOverlays())
                .then(() => loadSettings())
        }
        const hardwarerotatecheckbox = document.getElementById("hardwarerotatecameracheckbox") as HTMLInputElement
        hardwarerotatecheckbox.checked = !!config.hardwareCamRotate
        hardwarerotatecheckbox.onchange = function () {
            config.hardwareCamRotate = !!hardwarerotatecheckbox.checked
            saveConfig(config)
            loadHardwareCam()
                .then(() => loadCamOverlays())
                .then(() => loadSettings())
        }
        const hardwarecamcircularcheckbox = document.getElementById("hardwarecamcircularcheckbox") as HTMLInputElement
        hardwarecamcircularcheckbox.checked = !!config.hardwareCamCircular
        hardwarecamcircularcheckbox.onchange = function () {
            config.hardwareCamCircular = !!hardwarecamcircularcheckbox.checked
            saveConfig(config)
            render()
            loadFaceCam()
                .then(() => loadCamOverlays())
                .then(() => loadSettings())
        }

        const hardwarecamscreeninput = document.getElementById("hardwarecamscreeninput") as HTMLInputElement
        hardwarecamscreeninput.value = config.hardwareCamGreenScreen || ""
        hardwarecamscreeninput.onchange = function (e) {
            config.hardwareCamGreenScreen = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(hardwarecamscreeninput.value))
                config.hardwareCamGreenScreen = hardwarecamscreeninput.value
            saveConfig(config);
            // already running?
            if (config.hardwareCamGreenScreen && (<any>hardwarecam).seriously?.chroma)
                (<any>hardwarecam).seriously.chroma.screen = toSeriousColor(config.hardwareCamGreenScreen);
            else
                loadHardwareCam()
                    .then(() => loadCamOverlays())
                    .then(() => loadSettings())
        }

        const hardwarecamscreencanvas = document.getElementById("hardwarecamscreencanvas") as HTMLCanvasElement
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
            if (config.hardwareCamGreenScreen && (<any>hardwarecam).seriously?.chroma) {
                (<any>hardwarecam).seriously.chroma.screen = toSeriousColor(config.hardwareCamGreenScreen);
                loadSettings()
            }
            else
                loadHardwareCam().then(() => loadSettings())
        }
        const hardwarecamscreenclear = document.getElementById("hardwarecamscreenclear") as HTMLInputElement
        hardwarecamscreenclear.onclick = function (e) {
            config.hardwareCamGreenScreen = undefined;
            saveConfig(config);
            loadHardwareCam()
                .then(() => loadCamOverlays())
                .then(() => loadSettings())
        }
        const hardwarecamgreenclipblack = document.getElementById("hardwarecamgreenclipblack") as HTMLInputElement
        hardwarecamgreenclipblack.value = (config.hardwareCamClipBlack || 0.6) + "";
        hardwarecamgreenclipblack.onchange = function (e) {
            config.hardwareCamClipBlack = parseFloat(hardwarecamgreenclipblack.value);
            saveConfig(config);
            // already running?
            if ((<any>hardwarecam).seriously?.chroma)
                (<any>hardwarecam).seriously.chroma.clipBlack = config.hardwareCamClipBlack;
            else
                loadHardwareCam()
                    .then(() => loadCamOverlays())
                    .then(() => loadSettings())
        }
        const hardwarecamcontourinput = document.getElementById("hardwarecamcontourinput") as HTMLInputElement
        hardwarecamcontourinput.value = config.hardwareCamContour || ""
        hardwarecamcontourinput.onchange = function (e) {
            config.hardwareCamContour = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(hardwarecamcontourinput.value))
                config.hardwareCamContour = hardwarecamcontourinput.value
            saveConfig(config);
            // already running?
            if (config.hardwareCamContour && (<any>hardwarecam).seriously?.contour)
                (<any>hardwarecam).seriously.contour.color = toSeriousColor(config.hardwareCamContour);
            else
                loadHardwareCam()
                    .then(() => loadCamOverlays())
                    .then(() => loadSettings())
        }
        const hardwarecamcontourclear = document.getElementById("hardwarecamcontourclear") as HTMLButtonElement
        hardwarecamcontourclear.onclick = function (e) {
            config.hardwareCamContour = undefined;
            saveConfig(config);
            loadHardwareCam()
                .then(() => loadCamOverlays())
                .then(() => loadSettings())
        }

        config.hardwareCamFilter = config.hardwareCamFilter || {};
        ["contrast", "brightness", "saturate"].forEach(function (k) {
            const elid = "hardwarecam" + k;
            const el = document.getElementById(elid) as HTMLInputElement
            el.valueAsNumber = config.hardwareCamFilter[k];
            el.onchange = function () {
                config.hardwareCamFilter[k] = el.valueAsNumber;
                saveConfig(config);
                loadStyle();
            }
        })
        const hardwarecamerror = document.getElementById("hardwarecamerror") as HTMLDivElement
        hardwarecamerror.onclick = () => {
            repairCams()
            loadSettings()
        }
        if (config.hardwareCamId && state.hardwareCamError)
            hardwarecamerror.classList.remove("hidden")
        else
            hardwarecamerror.classList.add("hidden")

        const facecamlabelinput = document.getElementById("facecamlabelinput") as HTMLInputElement
        facecamlabelinput.value = config.faceCamLabel || ""
        facecamlabelinput.onchange = function (e) {
            config.faceCamLabel = (facecamlabelinput.value || "").trim()
            facecamlabelinput.value = config.faceCamLabel
            saveConfig(config);
            loadSocial()
            render()
        }

        const hardwarecamlabelinput = document.getElementById("hardwarecamlabelinput") as HTMLInputElement
        hardwarecamlabelinput.value = config.hardwareCamLabel || ""
        hardwarecamlabelinput.onchange = function (e) {
            config.hardwareCamLabel = (hardwarecamlabelinput.value || "").trim()
            hardwarecamlabelinput.value = config.hardwareCamLabel
            saveConfig(config);
            loadSocial()
            render()
        }

        const titleinput = document.getElementById("titleinput") as HTMLInputElement
        titleinput.value = config.title || ""
        titleinput.onchange = function (e) {
            config.title = (titleinput.value || "");
            titleinput.value = config.title
            saveConfig(config);
            loadSocial();
            render()
        }

        const backgroundimageinput = document.getElementById("backgroundimageinput") as HTMLInputElement
        backgroundimageinput.value = config.backgroundImage || ""
        backgroundimageinput.onchange = function (e) {
            config.backgroundImage = undefined;
            if (/^https:\/\//.test(backgroundimageinput.value))
                config.backgroundImage = backgroundimageinput.value
            saveConfig(config);
            loadStyle();
            render()
        }

        importVideoButton("background", true)
        importVideoButton("start", true)
        importVideoButton("end", true)
        importVideoButton("stinger", false)
        importVideoButton("camoverlay", true)

        const stingervideodelayinput = document.getElementById("stringervideodelayinput") as HTMLInputElement
        stingervideodelayinput.value = (config.stingerVideoDelay || "") + ""
        stingervideodelayinput.onchange = function (e) {
            const i = parseInt(stingervideodelayinput.value || "0");
            config.stingerVideoDelay = isNaN(i) ? 0 : i;
            stingervideodelayinput.value = (config.stingerVideoDelay || "") + ""
            saveConfig(config);
        }

        const stingervideoscreenclear = document.getElementById("stingervideoscreenclear") as HTMLInputElement
        stingervideoscreenclear.onclick = function (e) {
            config.stingerVideoGreenScreen = undefined;
            saveConfig(config);
            loadSettings()
            startStinger(config.stingerVideo, () => { })
        }

        const stingervideoscreeninput = document.getElementById("stingervideoscreeninput") as HTMLInputElement
        stingervideoscreeninput.value = config.stingerVideoGreenScreen || ""
        stingervideoscreeninput.onchange = function (e) {
            config.stingerVideoGreenScreen = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(stingervideoscreeninput.value))
                config.stingerVideoGreenScreen = stingervideoscreeninput.value
            saveConfig(config);
            loadSettings()
            startStinger(config.stingerVideo, () => { }, config.stingerVideoGreenScreen)
        }

        const backgroundcolorinput = document.getElementById("backgroundcolorinput") as HTMLInputElement
        backgroundcolorinput.value = config.styleBackground || ""
        backgroundcolorinput.onchange = function (e) {
            config.styleBackground = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(backgroundcolorinput.value))
                config.styleBackground = backgroundcolorinput.value
            saveConfig(config);
            loadStyle();
        }
        const backgroundcolorclear = document.getElementById("backgroundcolorclear") as HTMLInputElement
        backgroundcolorclear.onclick = function (e) {
            config.styleBackground = undefined;
            saveConfig(config);
            loadStyle();
            loadSettings();
        }

        const bordercolorinput = document.getElementById("bordercolorinput") as HTMLInputElement
        bordercolorinput.value = config.styleBorder || ""
        bordercolorinput.onchange = function (e) {
            config.styleBorder = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(bordercolorinput.value))
                config.styleBorder = bordercolorinput.value
            saveConfig(config);
            loadStyle();
        }
        const bordercolorclear = document.getElementById("bordercolorclear") as HTMLInputElement
        bordercolorclear.onclick = function (e) {
            config.styleBorder = undefined;
            saveConfig(config);
            loadStyle();
            loadSettings();
        }

        const borderbackgroundinput = document.getElementById("borderbackgroundinput") as HTMLInputElement
        borderbackgroundinput.value = config.stylePrimary || ""
        borderbackgroundinput.onchange = function (e) {
            config.stylePrimary = undefined;
            if (/^#[a-fA-F0-9]{6}$/.test(borderbackgroundinput.value))
                config.stylePrimary = borderbackgroundinput.value
            saveConfig(config);
            loadStyle();
        }
        const borderbackgroundclear = document.getElementById("borderbackgroundclear") as HTMLInputElement
        borderbackgroundclear.onclick = function (e) {
            config.stylePrimary = undefined;
            saveConfig(config);
            loadStyle();
            loadSettings();
        }

        const countdowneditorcheckbox = document.getElementById("countdowneditorcheckbox") as HTMLInputElement
        countdowneditorcheckbox.checked = !!config.countdownEditor
        countdowneditorcheckbox.onchange = function () {
            config.countdownEditor = !!countdowneditorcheckbox.checked
            saveConfig(config)
            render()
        }

        const countdownblureditorcheckbox = document.getElementById("countdownblureditorcheckbox") as HTMLInputElement
        countdownblureditorcheckbox.checked = !!config.countdownEditorBlur
        countdownblureditorcheckbox.onchange = function () {
            config.countdownEditorBlur = !!countdownblureditorcheckbox.checked
            saveConfig(config)
            render()
        }

        const twitchinput = document.getElementById("twitchinput") as HTMLInputElement
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

        const restreaminput = document.getElementById("restreaminput") as HTMLInputElement
        restreaminput.value = config.restream || ""
        restreaminput.onchange = function (e) {
            config.restream = (restreaminput.value || "")
            if (config.restream.indexOf("https://chat.restream.io/embed?token=") != 0)
                config.restream = ""
            restreaminput.value = config.restream
            saveConfig(config);
            state.chat = !!(config.twitch || config.restream);
            loadSocial();
            loadChat();
            render()
        }

        const greenscreencheckbox = document.getElementById("greenscreencheckbox") as HTMLInputElement
        greenscreencheckbox.checked = !!config.greenScreen
        greenscreencheckbox.onchange = function () {
            config.greenScreen = !!greenscreencheckbox.checked
            saveConfig(config)
            render()
        }

        const emojisinput = document.getElementById("emojisinput") as HTMLInputElement
        emojisinput.value = config.emojis || ""
        emojisinput.onchange = function (e) {
            config.emojis = emojisinput.value.replace(/\s*/g, '');
            emojisinput.value = config.emojis
            saveConfig(config);
            loadSocial()
            render()
        }

        const micselect = document.getElementById("micselect") as HTMLSelectElement
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
        const micdelayinput = document.getElementById("micdelayinput") as HTMLInputElement
        micdelayinput.value = (config.micDelay || "") + ""
        micdelayinput.onchange = function (e) {
            const i = parseInt(micdelayinput.value || "0");
            config.micDelay = isNaN(i) ? 0 : i;
            micdelayinput.value = (config.micDelay || "") + ""
            saveConfig(config);
        }

        function importVideoButton(name: string, replace: boolean) {
            importFileButton(`streamer.importvideo.${name}`,
                document.getElementById(`${name}videoimportinput`) as HTMLInputElement,
                document.getElementById(`${name}videoimportbtn`),
                async (file) => {
                    const fn = `${replace ? name : file.name}`.replace(/\.\w+$/, "") + "video"
                    db.put(fn, file)
                    const url = `blob:${fn}`;
                    const current = config[name + "Video"];
                    config[name + "Video"] = replace || !current ? url : `${current}\n${url}`
                    saveConfig(config);
                    loadSettings()
                    loadStyle()
                    render()
                })
            const videoinput = document.getElementById(`${name}videoinput`) as HTMLInputElement | HTMLTextAreaElement
            const field = `${name}Video`
            videoinput.value = config[field] || ""
            videoinput.oninput = videoinput.onchange = function (e) {
                config[field] = videoinput.value
                saveConfig(config);
                loadStyle()
                loadSettings()
                render()
            }
        }
    }

    function importFileButton(tick: string, input: HTMLInputElement, button: HTMLElement, done: (file: File) => void) {
        input.onchange = function () {
            const file = input.files[0] as File;
            if (file)
                done(file)
        }
        button.onclick = function (e) {
            tickEvent(tick, undefined, { interactiveConsent: true })
            stopEvent(e)
            input.click()
        }
    }

    function readFileAsText(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener("load", function () {
                try {
                    resolve(reader.result as string)
                } catch (e) {
                    reject(e)
                }
            }, false);
            reader.readAsText(file, 'utf-8')
        })
    }

    function setEditor(editor, hash?) {
        const editorConfig = editorConfigs[editor];
        if (!editorConfig) return;

        const config = readConfig();
        config.editor = editor;
        saveConfig(config);
        loadEditor(hash);
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
                    togglePaint();
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
                    toggleThumbnail(ev);
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
        // esc
        if (ev.keyCode === 27) {
            if (state.addSite) state.addSite = false;
            if (state.paint) togglePaint();
            if (settingsVisible()) toggleSettings();
            render();
        }

        function setPaintTool(ev, name) {
            state.painttool = name
            if (!state.paint)
                togglePaint();
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

    function tickEvent(id, data?: any, opts?: { interactiveConsent?: boolean }) {
        if (typeof pxt === "undefined") return;
        if (opts?.interactiveConsent && pxt.setInteractiveConsent)
            pxt.setInteractiveConsent(true);
        if (pxt.aiTrackEvent) {
            const args = tickProps(data);
            pxt.aiTrackEvent(id, args[0], args[1]);
        }
    }

    function trackException(err: any, id: string, data?: any) {
        if (typeof pxt === "undefined") return;
        if (pxt.aiTrackException) {
            const args = tickProps(data);
            pxt.aiTrackException(err, id, args[0]);
        }
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
            twitch: config.twitch ? 1 : 0,
            restream: config.restream ? 1 : 0
        };
        if (data)
            Object.keys(data).forEach(k => {
                if (typeof data[k] == "string") props[k] = data[k];
                else if (typeof data[k] == "number") measures[k] = data[k];
                else props[k] = JSON.stringify(data[k] || '');
            });
        return [props, measures];
    }

    async function startStingerScene(url: string, endSceneIndex: number) {
        const config = readConfig();
        startStinger(url, () => {
            updateScene(endSceneIndex);
            render()
        }, config.stingerVideoGreenScreen, config.stingerVideoDelay)
    }

    async function startStinger(url: string, end: () => void, greenScreen: string = "", transitionDelay = 700) {
        stingerEvents.start = () => {
            setTimeout(() => {
                end()
            }, transitionDelay || 1000)
        }
        stingerEvents.end = () => {
            state.stingering = false;
            render();
        }
        const stingeryoutube = document.getElementById('stingeryoutube')
        const ytVideoId = parseYouTubeVideoId(url);
        if (ytVideoId && stingerPlayer) {
            state.stingering = true;
            render();
            stopGreenScreen(stingervideo)
            stingervideo.src = undefined;
            stingervideo.classList.add("hidden");
            stingerPlayer.loadVideoById(ytVideoId, 0)

            // rescale youtube iframe to cover the entire background
            const el = document.firstElementChild;
            const w = el.clientWidth
            const h = el.clientHeight
            const ratio = w / h;
            const hd = 16 / 9;
            if (ratio > hd) {
                // the video is going to be 16:9, compensate
                console.log(`ratio`, ratio)
                const vh = 100 * ratio / hd
                stingeryoutube.style.height = `${vh}vh`
                stingeryoutube.style.width = `100vw`
                stingeryoutube.style.transform = `translate(0, ${-(vh - 100) / 2}vh)`
            } else {
                const vw = 100 / ratio * hd
                stingeryoutube.style.height = `100vh`
                stingeryoutube.style.width = `${vw}vw`
                stingeryoutube.style.transform = `translate(${-(vw - 100) / 2}vh, 0)`
            }
        } else if (url) {
            state.stingering = true;
            render();
            url = await resolveBlob(url)

            if (stingerPlayer) stingerPlayer.stopVideo()
            stingeryoutube.classList.add("hidden")
            stingervideo.src = url;
            stingervideo.onplay = () => {
                if (greenScreen) {
                    stingervideoserious.classList.remove("hidden")
                    startGreenScreen(greenScreen, stingervideo)
                } else {
                    stingervideo.classList.remove("hidden")
                }
                stingerEvents.start()
            }
            stingervideo.onpause = stingervideo.onerror = stingervideo.onended = () => {
                stingerEvents.end()
                stingervideo.classList.add("hidden")
                stingervideoserious.classList.add("hidden")
                // doesn't hurt
                URL.revokeObjectURL(url)
            }
        } else {
            stingervideo.src = undefined;
            if (stingerPlayer) stingerPlayer.stopVideo();
            stingervideo.classList.add("hidden");
            stingeryoutube.classList.add("hidden")
            state.stingering = false;
            stopGreenScreen(stingervideo)
            render();
            end();
        }
    }

    async function resolveBlob(url: string) {
        if (/\n/.test(url)) {
            // multiple urls, pick a random one
            const urls = url.split(/\n/g)
            url = urls[Math.floor(Math.random() * urls.length)];
        }
        const blob = /^blob:/.test(url) && url.substr("blob:".length);
        if (blob) {
            const file = await db.get(blob)
            if (file)
                url = URL.createObjectURL(file)
        }
        return url;
    }

    // this database stores video blobs
    function openDbAsync(): Promise<{
        put: (id: string, file: File | Blob) => void;
        get: (id: string) => Promise<File | Blob>;
        del: (id: string) => Promise<void>;
        gc: (urls: string[]) => void;
    }> {
        const DB_VERSION = 1
        const DB_NAME = "ASSETS"
        const STORE_BLOBS = "BLOBS"
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        let db: IDBDatabase;

        const api = {
            put: (id: string, file: File | Blob) => {
                try {
                    const transaction = db.transaction([STORE_BLOBS], "readwrite");
                    const blobs = transaction.objectStore(STORE_BLOBS)
                    blobs.put(file, id);
                } catch (e) {
                    console.error(`idb: put ${id} failed`)
                }
            },
            get: (id: string): Promise<File | Blob> => {
                return new Promise((resolve, reject) => {
                    try {
                        const transaction = db.transaction([STORE_BLOBS], "readonly");
                        const blobs = transaction.objectStore(STORE_BLOBS)
                        const request = blobs.get(id);
                        request.onsuccess = (event) => resolve((event.target as any).result)
                        request.onerror = (event) => resolve((event.target as any).result)
                    } catch (e) {
                        console.error(`idb: get ${id} failed`)
                        reject(e)
                    }
                })
            },
            del: (id: string): Promise<void> => {
                return new Promise((resolve, reject) => {
                    try {
                        const transaction = db.transaction([STORE_BLOBS], "readwrite");
                        const blobs = transaction.objectStore(STORE_BLOBS)
                        const request = blobs.delete(id);
                        request.onsuccess = (event) => resolve((event.target as any).result)
                        request.onerror = (event) => resolve((event.target as any).result)
                    } catch (e) {
                        console.error(`idb: del ${id}`)
                        reject(e)
                    }
                })
            },
            gc: (urls: string[]) => {
                const transaction = db.transaction([STORE_BLOBS], "readwrite");
                const blobs = transaction.objectStore(STORE_BLOBS)
                const request = blobs.getAllKeys();
                request.onsuccess = (event) => {
                    const keys: string[] = (event.target as any).result;
                    const dead = keys.filter(k => urls.indexOf(k) < 0);
                    if (dead.length)
                        console.log(`dead videos`, dead)
                    dead.forEach(api.del)
                }
            }
        }

        return new Promise((resolve, reject) => {
            // create or upgrade database
            request.onsuccess = function (event) {
                db = request.result;
                db.onerror = function (event) {
                    console.log("idb error", event);
                };
                resolve(api);
            }
            request.onupgradeneeded = function (event) {
                db = request.result;
                db.createObjectStore(STORE_BLOBS);
                db.onerror = function (event) {
                    console.log("idb error", event);
                };
                resolve(api);
            };
        })
    }
})()