var FskEncoder = require("./afsk-encoder.js");

var Modulator = function(params) {

    if (!params)
        params = new Object();

    if ("rate" in params)
        this.rate = params.rate;

    this.encoder = new FskEncoder(this.rate);

    // Create a "script node" that will actually generate audio samples.
    this.script_node = Modulator.prototype.script_node;

    // Start out in a not-playing state
    this.playing = false;
}

Modulator.prototype = {
    encoder: null, // FskEncoder object
    outputAudioBuffer: null, // AudioBuffer object
    uiCallback: null, // UI object for callback
    scriptNode: null, // Re-used script node object for audio generation
    can_stop: true, // Whether we can stop (usually we can)

    // modulate a single packet. The data to modulate should be Uint8 format
    // This function allocates an audio buffer based on the length of the data and the sample rate
    // It then calls the fsk modulator, and shoves the returned floating point array
    // into the audio context for later playback
    modulateStream: function(data) {

        // this odd construct is for safari compatibility
        if (!("audioContext" in window))
            window.audioContext = new(window.AudioContext || window.webkitAudioContext)();

        if (!"rate" in this)
            this.rate = window.audioContext.sampleRate;

        if (!this.script_node) {
            Modulator.prototype.script_node = window.audioContext.createScriptProcessor(4096, 2, 2);

            // If the script node has an invalid buffer size, force one with a nonzero buffer.
            if (!Modulator.prototype.script_node.bufferSize) {

                // IE with a polyfill exhibits this problem, and crashes when you try to stop.
                Modulator.prototype.script_node = window.audioContext.createScriptProcessor(4096, 2, 2);
                this.prototype.can_stop = false;
            }
            this.script_node = Modulator.prototype.script_node;
        }

        var bufLen = Math.ceil(data.length * 8 * this.encoder.samplesPerBit());
        this.outputAudioBuffer = window.audioContext.createBuffer(1, bufLen, this.rate);

        var timeStart = performance.now();

        var outputFloatArray = this.outputAudioBuffer.getChannelData(0);
        this.encoder.modulate(data, outputFloatArray); // writes outputFloatArray in-place

        // How far into the outputAudioBuffer we are.
        this.script_node_offset = 0;

        var timeEnd = performance.now();
        var timeElapsed = timeEnd - timeStart;
        console.log("Rendered " + data.length + " data bytes in " +
            timeElapsed.toFixed(2) + "ms");
    },

    silence: function(msecs) {
        var bufLen = Math.ceil(window.audioContext.sampleRate / (1000.0 / msecs));
        this.outputAudioBuffer = window.audioContext.createBuffer(1, bufLen, window.audioContext.sampleRate);
        var outputFloatArray = this.outputAudioBuffer.getChannelData(0);
        for (var i = 0; i < outputFloatArray.length; i++)
            outputFloatArray[i] = 0;
        this.script_node_offset = 0;
    },

    processAudio: function(ev) {
        var outl = ev.outputBuffer.getChannelData(0);
        var outr = ev.outputBuffer.getChannelData(1);

        // If we're not playing, but still being called, just fill the channel with silence.
        if (!this.playing) {
            for (var i = 0; i < outl.length; i++)
                outl[i] = outr[i] = 0;

            // Some browsers crash when you stop playing
            if (this.can_stop)
                this.script_node.disconnect();
            return;
        }

        var outputFloatArray = this.outputAudioBuffer.getChannelData(0);

        for (var i = 0; i < outl.length; i++) {
            if (this.script_node_offset >= outputFloatArray.length) {
                // If there's more data to play, reset the output float array.
                if (this.get_more_data())
                    outputFloatArray = this.outputAudioBuffer.getChannelData(0);

                // Otherwise, fill the buffer with 0s, and we'll stop playing on the next iteration.
                else {
                    for (var j = 0; j < outputFloatArray.length; j++)
                        outputFloatArray[j] = 0;
                }
                this.script_node_offset = 0;
            }

            outl[i] = outr[i] = outputFloatArray[this.script_node_offset++];
        }
    },

    // immediately play the modulated audio exactly once. Useful for debugging single packets
    playBuffer: function(obj, func) {
        console.log("-- playAudioBuffer --");
        var bufferNode = window.audioContext.createBufferSource();
        bufferNode.buffer = this.outputAudioBuffer;
        bufferNode.connect(window.audioContext.destination); // Connect to speakers
        bufferNode.addEventListener("ended", function() {
            var playTimeEnd = performance.now();
            var timeElapsed = playTimeEnd - this.playTimeStart;
            console.log("got audio ended event after " + timeElapsed.toFixed(2) + "ms");
            if (obj && func)
                func.call(obj);
        }.bind(this));
        this.playTimeStart = performance.now();
        bufferNode.start(0); // play immediately
    },

    // Plays through an entire file. You need to set the callback so once
    // a single audio packet is finished, the next can start. The index
    // tells where to start playing. You could, in theory, start modulating
    // part-way through an audio stream by setting index to a higher number on your
    // first call.
    playLoop: function(obj, end_func, param) {

        this.get_more_data = function() {
            if (!end_func.call(obj, param)) {
                this.playing = false;
                return false;
            }
            return true;
        };

        this.script_node.onaudioprocess = function(ev) {
            Modulator.prototype.processAudio.call(this, ev);
        }.bind(this);

        if (!this.playing) {
            this.playing = true;
            this.script_node.connect(window.audioContext.destination);
        }
    },

    modulatePcm: function(data, type) {

        var bufLen = Math.ceil(data.length * 8 * this.encoder.samplesPerBit());
        var modulatedData = new Float32Array(bufLen);
        if (type === undefined)
            type = 16;

        var timeStart = 0;
        var timeEnd = 0;
        if ((typeof performance) === "object")
            timeStart = performance.now();
        this.encoder.modulate(data, modulatedData); // writes outputFloatArray in-place
        if ((typeof performance) === "object")
            timeEnd = performance.now();
        var timeElapsed = timeEnd - timeStart;
        console.log("Rendered " + data.length + " data bytes in " +
            timeElapsed.toFixed(2) + "ms");

        if (type === 16) {
            var pcmData = new Int16Array(modulatedData.length);
            for (var i = 0; i < modulatedData.length; i++) {
                // Map -1 .. 1 to -32767 .. 32768
                pcmData[i] = Math.round((modulatedData[i]) * 32767);
            }
            return pcmData;
        }
        else {
            var pcmData = new Uint8Array(new ArrayBuffer(modulatedData.length * 2));
            for (var i = 0; i < modulatedData.length; i++) {
                // Map -1 .. 1 to -32767 .. 32768
                var sample = Math.round((modulatedData[i]) * 32767);

                // Javascript doesn't really do two's compliment
                if (sample < 0)
                    sample = (0xffff - ~sample);

                pcmData[(i * 2) + 0] = Math.round(sample) & 0xff;
                pcmData[(i * 2) + 1] = Math.round(sample >> 8) & 0xff;
            }
            return pcmData;
        }
    }
}

// AMD exports
if (typeof module !== "undefined"  && module.exports) {
  module.exports = Modulator;
}