(async function () {
    const body = document.body;
    const container = document.getElementById("container");
    const editor = document.getElementById("editor");
    const editor2 = document.getElementById("editor2");
    const facecam = document.getElementById("facecam");
    const hardwarecam = document.getElementById("hardwarecam");
    const chat = document.getElementById("chat");
    const social = document.getElementById("social");
    const banner = document.getElementById("banner");
    const settings = document.getElementById("settings");
    const editorStyle = document.getElementById("editorstyle");
    const toolbox = document.getElementById("toolbox")
    const paint = document.getElementById('paint');
    const paintCtx = paint.getContext('2d');
    const painttool = document.getElementById('painttool');
    const painttoolCtx = painttool.getContext('2d');
    const recorder = document.getElementById('recorder')
    const screensize = document.getElementById('screensize')

    const frames = [editor, editor2];

    const scenes = ["leftscene", "rightscene", "chatscene"];
    const editorConfigs = await fetchJSON("/editors.json");
    const state = {
        sceneIndex: 1,
        left: false,
        chat: false,
        hardware: false,
        painttool: "arrow",
        recording: undefined
    }

    initMessages();
    initResize();
    loadPaint();
    loadEditor()
    await firstLoadFaceCam()
    await loadHardwareCam()
    await loadSettings()
    load();
    tickEvent("streamer.load")

    function load() {
        loadEditor()
        loadChat()
        loadSocial()
        loadToolbox()
        render()
    }

    function saveConfig(config) {
        if (!config) throw "missing config"
        localStorage["streamer.config"] = JSON.stringify(config)
    }

    async function showSettings() {
        await loadSettings()
        settings.classList.remove("hidden")
    }

    function readConfig() {
        try {
            const cfg = JSON.parse(localStorage["streamer.config"]);
            if (cfg)
                return cfg;
        } catch (e) {
            console.log(e)
        }

        const cfg = {
            editor: "microbit",
            multiEditor: false,
            twitter: "",
            mixer: "",
            emojis: "😄🤔😭👀",
            micDelay: 200
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
        const config = readConfig();
        body.className = `${scenes[state.sceneIndex]} ${state.hardware ? "hardware" : state.chat ? "chat" : ""} ${config.multiEditor ? "multi" : ""} ${state.paint ? "paint" : ""}`
        if (!config.faceCamId || state.faceCamError)
            showSettings();
    }

    function loadToolbox() {
        const config = readConfig();
        toolbox.innerHTML = ""

        const emojis = [];
        if (config.emojis)
            for (let i = 0; i < config.emojis.length; i += 2)
                emojis[i >> 1] = config.emojis.substr(i, 2);
        if (state.paint) {
            addPaintButton("ArrowTallUpLeft", "Draw arrow", "arrow")
            addPaintButton("RectangleShape", "Draw rectangle", "rect")
            addPaintButton("PenWorkspace", "Draw freeform", "pen")
            addButton("WhiteBoardApp16", "Paint screen in white", whiteboard)
            emojis.forEach(emoji => {
                const btn = document.createElement("button")
                btn.innerText = emoji;
                btn.addEventListener("pointerdown", function (e) {
                    tickEvent("streamer.emoji", { emoji }, { interactiveConsent: true })
                    state.emoji = emoji;
                    setPaintTool("emoji")
                }, false)
                toolbox.append(btn)
            })
            addButton("EraseTool", "Clear all drawings", clearPaint)
            addButton("ChromeClose", "Exit paint mode", togglePaint)
        } else {
            addButton("OpenPane", "move webcam left", () => setScene("left"))
            addButton("OpenPaneMirrored", "move webcam right", () => setScene("right"))
            addButton("Contact", "webcam large", () => setScene("chat"))
            if (config.hardwareCamId)
                addButton("Robot", "hardware webcam", toggleHardware)
            if (config.mixer || config.twitch)
                addButton("OfficeChat", "show/hide chat", toggleChat)
            addButton("PenWorkspace", "Paint mode", togglePaint)
            if (state.recording)
                addButton("Stop", "Stop recording", stopRecording)
            else
                addButton("Record2", "Start recording", startRecording)
            addButton("Settings", "Show settings", showSettings);
        }

        function addButton(icon, title, handler) {
            const btn = document.createElement("button")
            btn.title = title
            btn.addEventListener("pointerdown", function (e) {
                tickEvent("streamer.button", { button: icon }, { interactiveConsent: true })
                handler(e)
            }, false)
            const i = document.createElement("i")
            btn.append(i)
            i.className = `ms-Icon ms-Icon--${icon}`
            toolbox.append(btn)
            return btn;
        }

        function addPaintButton(icon, title, tool) {
            const btn = addButton(icon, title, () => setPaintTool(tool));
            if (state.painttool == tool)
                btn.classList.add("active")
        }

        function setScene(scene) {
            tickEvent("streamer.scene", { scene: scene }, { interactiveConsent: true });
            state.sceneIndex = scenes.indexOf(`${scene}scene`);
            render();
        }
    }

    function togglePaint() {
        state.paint = !state.paint;
        clearPaint();
        updatePaintSize();
        loadToolbox();
        render();
    }

    function setPaintTool(tool) {
        state.painttool = tool;
        loadToolbox();
    }

    function whiteboard() {
        paintCtx.save()
        paintCtx.beginPath();
        paintCtx.fillStyle = "rgba(255, 255, 255, 0.9)"
        paintCtx.rect(0, 0, paint.width, paint.height)
        paintCtx.fill()
        paintCtx.restore()
    }

    function clearPaint() {
        paintCtx.clearRect(0, 0, paint.width, paint.height);
        painttoolCtx.clearRect(0, 0, paint.width, paint.height);
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

        painttool.addEventListener('mousemove', function (e) {
            mouse.x = e.pageX - this.offsetLeft;
            mouse.y = e.pageY - this.offsetTop;
        }, false);

        painttool.addEventListener('mousedown', function (e) {
            head.x = e.pageX - this.offsetLeft;
            head.y = e.pageY - this.offsetTop;
            painttoolCtx.lineWidth = Math.max(10, (paint.width / 100) | 0);
            painttoolCtx.lineJoin = 'round';
            painttoolCtx.lineCap = 'round';
            painttoolCtx.strokeStyle = '#ffe135';
            if (state.painttool == 'pen') {
                painttoolCtx.beginPath();
                painttoolCtx.moveTo(mouse.x, mouse.y);
            }
            painttool.addEventListener('mousemove', onPaint, false);
        }, false);

        painttool.addEventListener('mouseup', function () {
            paintCtx.drawImage(painttool, 0, 0)
            painttoolCtx.clearRect(0, 0, painttool.width, painttool.height)
            painttool.removeEventListener('mousemove', onPaint, false);
        }, false);

        function onPaint() {
            const ctx = painttoolCtx
            ctx.clearRect(0, 0, painttool.width, painttool.height)
            ctx.save();
            if (state.painttool == 'arrow') {

                const p1 = mouse, p2 = head;
                const size = ctx.lineWidth * 2;
                // Rotate the context to point along the path
                const dx = p2.x - p1.x
                const dy = p2.y - p1.y
                const len = Math.sqrt(dx * dx + dy * dy);
                ctx.translate(p2.x, p2.y);
                ctx.rotate(Math.atan2(dy, dx));

                // line
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-len, 0);
                ctx.closePath();
                ctx.stroke();

                // arrowhead
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-size, -size);
                ctx.moveTo(0, 0);
                ctx.lineTo(-size, size);
                ctx.stroke();
            } else if (state.painttool == 'rect') {
                ctx.beginPath();
                ctx.rect(head.x, head.y, mouse.x - head.x, mouse.y - head.y)
                ctx.stroke()
            } else if (state.painttool == 'pen') {
                ctx.lineTo(mouse.x, mouse.y);
                ctx.stroke();
            } else if (state.painttool == 'emoji') {
                const p1 = mouse, p2 = head;
                const dx = p2.x - p1.x
                const dy = p2.y - p1.y
                const len = Math.max(64, (Math.sqrt(dx * dx + dy * dy) * 0.9) | 0);
                ctx.translate(p2.x, p2.y);
                ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);

                ctx.font = `${len}px serif`;
                ctx.textAlign = 'center'
                ctx.fillText(state.emoji, 0, 0);
            }
            ctx.restore();
        }

        clearPaint();
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

        // update page style
        let css = "";
        const styles = editorConfig.styles;
        if (styles) {
            css =
                `body {
background: ${styles.background};
}
.box {
border-color: ${styles.menu};
}
#social {
background: ${styles.primary};
}
`
        } else {
            css =
                `body {
background: rgb(99, 93, 198);
background: linear-gradient(45deg, rgba(99, 93, 198, 1) 0%, rgba(0, 212, 255, 1) 100%);
}
.box {
border-image: conic-gradient(red, yellow, lime, aqua, blue, magenta, red) 1;
}
#social {
background: #615fc7;
}
`
        }
        editorStyle.innerText = ""
        editorStyle.append(document.createTextNode(css));
    }

    function loadStyle() {
        const config = readConfig();
        const editorConfig = editorConfigs[config.editor];
        // update page style
        let css = "";
        const styles = editorConfig && editorConfig.styles;
        if (styles) {
            css =
                `body {
background: ${styles.background};
}
.box {
border-color: ${styles.menu};
}
#social {
background: ${styles.primary};
}
`
        } else {
            css =
                `body {
background: rgb(99, 93, 198);
background: linear-gradient(45deg, rgba(99, 93, 198, 1) 0%, rgba(0, 212, 255, 1) 100%);
}
.box {
border-image: conic-gradient(red, yellow, lime, aqua, blue, magenta, red) 1;
}
#social {
background: #615fc7;
}
`
        }
        editorStyle.innerText = ""
        editorStyle.append(document.createTextNode(css));
    }

    function stopEvent(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function toggleChat(e) {
        tickEvent("streamer.togglechat", undefined, { interactiveConsent: true });
        stopEvent(e)
        const config = readConfig();
        state.chat = !state.chat && (config.mixer || config.twitch);
        render();
    }

    function toggleHardware(e) {
        tickEvent("streamer.togglehardware", undefined, { interactiveConsent: true });
        stopEvent(e)
        const config = readConfig();
        state.hardware = !state.hardware && config.hardwareCamId;
        render();
    }

    function loadSocial() {
        const config = readConfig();
        banner.innerHTML = ''
        if (config.twitter)
            addSocial(`@${config.twitter}`)

        if (!config.mixer && !config.twitch)
            state.chat = false;

        function addSocial(text) {
            const a = document.createElement("span");
            a.className = "social"
            a.innerText = text
            banner.append(a)
        }
    }

    function loadChat() {
        const config = readConfig();
        if (config.mixer) {
            chat.src = `https://mixer.com/embed/chat/${config.mixer}?composer=false`;
            if (!chat.parentElement)
                container.insertBefore(chat, facecam)
        }
        else if (config.twitch) {
            chat.src = `https://www.twitch.tv/embed/${config.twitch}/chat?parent=makecode.com`;
            if (!chat.parentElement)
                container.insertBefore(chat, facecam)
        }
        else // remove from dom
            chat.remove();
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
            await startStream(facecam, config.faceCamId, config.faceCamRotate);
            console.log(`face cam started`)
            if (!config.faceCamId)
                stopStream(facecam); // request permission only
            return; // success!
        }
        catch (e) {
            tickEvent("streamer.facecam.error")
            stopStream(facecam);
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
                await startStream(hardwarecam, config.hardwareCamId, config.hardwareCamRotate);
                console.log(`hardware cam started`)
                return; // success!
            }
            catch (e) {
                tickEvent("streamer.hardwarecam.error")
                stopStream(hardwarecam)
                state.hardwareCamError = true;
                saveConfig(config)
                console.log(`could not start web cam`, e)
                render()
            }
        } else {
            state.hardwareCamError = false
            stopStream(hardwarecam)
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

    function stopStream(el) {
        try {
            if (el.srcObject) {
                const tracks = el.srcObject.getVideoTracks();
                if (tracks && tracks[0] && tracks[0].stop) tracks[0].stop();
            }
            el.srcObject = null;
        } catch (e) { }
    }

    function initResize() {
        window.onresize = function (e) {
            screensize.innerText = `(${window.innerWidth}x${window.innerHeight})`
        }
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
    }

    async function startStream(el, deviceId, rotate) {
        stopStream(el)
        console.log(`trying device ${deviceId}`)
        const constraints = {
            audio: false,
            video: {
                aspectRatio: 4 / 3
            }
        }
        if (deviceId)
            constraints.video.deviceId = deviceId;
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        el.muted = true;
        el.volume = 0; // don't use sound!
        el.srcObject = stream;
        el.onloadedmetadata = (e) => el.play();
        if (rotate)
            el.classList.add("rotate")
        else
            el.classList.remove("rotate");
    }

    function stopRecording() {
        const stop = state.recording;
        state.recording = undefined;
        if (stop) stop();
    }

    async function startRecording() {
        const config = readConfig();
        state.recording = undefined;
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                displaySurface: "browser",
                cursor: "always"
            }
        });
        const audioStream = await startMicrophone();
        // handle delay
        const audioCtx = new AudioContext();
        const audioSource = audioCtx.createMediaStreamSource(audioStream);
        const delay = audioCtx.createDelay(2);
        delay.delayTime.value = (config.micDelay || 0) / 1000;
        audioSource.connect(delay);
        const audioDestination = audioCtx.createMediaStreamDestination();
        delay.connect(audioDestination);
        stream.addTrack(audioDestination.stream.getAudioTracks()[0])
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
            recorder.classList.add('hidden')
            mediaRecorder.start();
        }
        state.recording = () => mediaRecorder.stop();
        loadToolbox();
        render();


        function download() {
            // makesure to close all streams
            recorder.classList.add('hidden')
            try {
                audioCtx.close();
                stream.getVideoTracks().forEach(track => track.stop())
                stream.getAudioTracks().forEach(track => track.stop())
            } catch (e) { }

            state.recording = undefined;

            const blob = new Blob(chunks, {
                type: "video/webm"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            document.body.appendChild(a);
            a.style = "display: none";
            a.href = url;
            a.download = "recording.webm";
            a.click();
            window.URL.revokeObjectURL(url);

            loadToolbox();
            render();
        }
    }

    async function loadSettings() {
        const config = readConfig();
        const cams = await listCameras()
        const mics = await listMicrophones()

        const settingsclose = document.getElementById("settingsclose")
        settingsclose.onclick = function (e) {
            tickEvent("streamer.settingsclose", undefined, { interactiveConsent: true })
            stopEvent(e)
            settings.classList.add("hidden")
        }
        const editorselect = document.getElementById("editorselect");
        editorselect.innerHTML = "" // remove all web cams
        Object.keys(editorConfigs).forEach(editorid => {
            const option = document.createElement("option")
            option.value = editorid
            option.text = editorConfigs[editorid].name;
            editorselect.add(option)
            if (config.editor == editorid)
                option.selected = true;
        })
        editorselect.onchange = function () {
            const selected = editorselect.options[editorselect.selectedIndex];
            config.editor = selected.value;
            saveConfig(config);
            render()
            loadEditor();
        }

        const multicheckbox = document.getElementById("multicheckbox")
        multicheckbox.checked = !!config.multiEditor
        multicheckbox.onchange = function () {
            config.multiEditor = !!multicheckbox.checked
            saveConfig(config)
            render()
            loadEditor()
        }

        const facecamselect = document.getElementById("facecamselect");
        facecamselect.innerHTML = "" // remove all web cams
        {
            const option = document.createElement("option")
            option.value = ""
            option.text = "Off"
            facecamselect.add(option)
        }
        cams.forEach(cam => {
            const option = document.createElement("option")
            option.value = cam.deviceId
            option.text = cam.label || `camera ${cam.deviceId}`
            facecamselect.add(option)
            if (config.faceCamId == cam.deviceId && cam.deviceId)
                option.selected = true;
        })
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
        hardwarecamselect.onchange = function () {
            const selected = hardwarecamselect.options[hardwarecamselect.selectedIndex];
            config.hardwareCamId = selected.value;
            saveConfig(config)
            state.hardware = !!config.hardwareCamId
            loadToolbox()
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
        const hardwarecamerror = document.getElementById("hardwarecamerror")
        if (config.hardwareCamId && state.hardwareCamError)
            hardwarecamerror.classList.remove("hidden")
        else
            hardwarecamerror.classList.add("hidden")

        const twitterinput = document.getElementById("twitterinput")
        twitterinput.value = config.twitter || ""
        twitterinput.onchange = function (e) {
            config.twitter = (twitterinput.value || "").replace(/^https:\/\/twitter.com\//, '').replace(/^@/, '').trim()
            twitterinput.value = config.twitter
            saveConfig(config);
            loadSocial()
            render()
        }

        const twitchinput = document.getElementById("twitchinput")
        twitchinput.value = config.twitch || ""
        twitchinput.onchange = function (e) {
            config.twitch = (twitchinput.value || "").replace(/^https:\/\/twitch.tv\//, '').replace(/^\//, '').trim()
            twitchinput.value = config.twitch
            saveConfig(config);
            loadSocial();
            loadToolbox()
            loadChat();
            render()
        }

        const mixerinput = document.getElementById("mixerinput")
        mixerinput.value = config.mixer || ""
        mixerinput.onchange = function (e) {
            config.mixer = (mixerinput.value || "").replace(/^https:\/\/mixer.com\//, '').replace(/^\//, '').trim()
            mixerinput.value = config.mixer
            saveConfig(config);
            loadSocial();
            loadToolbox()
            loadChat();
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
            loadToolbox()
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

    function tickEvent(id, data, opts) {
        if (typeof pxt === "undefined" || !pxt.aiTrackException || !pxt.aiTrackEvent) return;
        if (opts && opts.interactiveConsent && typeof mscc !== "undefined" && !mscc.hasConsent()) {
            mscc.setConsent();
        }
        const config = readConfig();
        const props = {
            editor: config.editor,
        };
        const measures = {
            multiEditor: config.multiEditor ? 1 : 0,
            twitter: config.twitter ? 1 : 0,
            mixer: config.mixer ? 1 : 0,
            twitch: config.twitch ? 1 : 0
        };
        if (data)
            Object.keys(data).forEach(k => {
                if (typeof data[k] == "string") props[k] = data[k];
                else if (typeof data[k] == "number") measures[k] = data[k];
                else props[k] = JSON.stringify(data[k] || '');
            });
        pxt.aiTrackEvent(id, props, measures);
    }
})()