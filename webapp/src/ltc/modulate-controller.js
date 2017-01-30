var Modulator = require("./modulate.js");
var murmurhash3_32_gc = require("./murmurhash3_gc.js");
var SparkMD5 = require("./spark-md5.js");
var pcm = require("./pcm.js");

var ModulationController = function(params) {

    if (!params)
        params = new Object();

    this.canvas = params.canvas || undefined;
    this.endCallback = params.endCallback || undefined;

    /* Are these needed? */
    this.saveState = false;

    this.isSending = false;
    this.playing = false;
    this.done = false;
    this.stoppedAt = 0;
    this.playCount = 0;
    this.maxPlays = 3;
    this.byteArray = null;
    this.rate = 44100;
    this.pcmData = null;

    this.PROT_VERSION = 0x01;   // Protocol v1.0

    this.CONTROL_PACKET = 0x01;
    this.DATA_PACKET = 0x02;

    this.modulator = new Modulator({
        rate: this.rate
    }); // the modulator object contains our window's audio context

    /* Preamble sent before every audio packet */
    this.preamble = [0x00, 0x00, 0x00, 0x00, 0xaa, 0x55, 0x42];

    /* Stop bits, sent to pad the end of transmission */
    this.stop_bytes = [0xff];
}

ModulationController.prototype = {

    makeControlHeader: function() {
        return [this.PROT_VERSION, this.CONTROL_PACKET, 0x00, 0x00];
    },

    makeDataHeader: function(blockNum) {
        return [this.PROT_VERSION, this.DATA_PACKET, blockNum & 0xff, (blockNum >> 8) & 0xff];
    },

    getPcmData: function() {
        return this.pcmData;
    },

    sendData: function(data) {
        if (data) {
            var dataLength = data.length;
            var array = new Uint8Array(new ArrayBuffer(dataLength));
            for (i = 0; i < dataLength; i++)
                array[i] = data.charCodeAt(i);

            this.byteArray = array;
            this.playCount = 0;
            this.transcodePacket(0);
            this.isSending = true;
        }
    },

    // this is the core function for transcoding
    // two object variables must be set:
    // byteArray.
    // byteArray is the binary file to transmit

    // the parameter to this, "index", is a packet counter. We have to recursively call
    // transcodePacket using callbacks triggered by the completion of audio playback. I couldn't
    // think of any other way to do it.
    transcodePacket: function(index) {
        var fileLen = this.byteArray.length;
        var blocks = Math.ceil(fileLen / 256);
        var packet;

        // index 0 & 1 create identical control packets. We transmit the control packet
        // twice in the beginning because (a) it's tiny and almost free and (b) if we
        // happen to miss it, we waste an entire playback cycle before we start committing
        // data to memory
        if (index == 0  || index == 1) {
            packet = this.makeCtlPacket(this.byteArray.subarray(0, fileLen));
        }
        else {
            // data index starts at 2, due to two sends of the control packet up front
            var block = index - 2;
            var start = block * 256;
            var end = start + 256;
            if (end > fileLen)
                end = fileLen;
            packet = this.makeDataPacket(this.byteArray.subarray(start, end), block);
        }

        this.silence = false;
        this.modulator.modulate(packet);
        this.modulator.playLoop(this, this.finishPacketPlayback, index + 1);
        this.modulator.drawWaveform(this.canvas);
    },

    transcodeToAudioTag: function(array, tag, type) {
        var isMP3 = (type.toLowerCase() === 'mp3');
        var isWav = (type.toLowerCase() == "wav");

        var fileLen = array.length;
        var blocks = Math.ceil(fileLen / 256);
        var rawPcmData = [];

        var pcmPacket;
        this.tag = tag;

        // Additional padding to work around anti-pop hardware/software
        this.makeSilence(rawPcmData, 250);

        pcmPacket = this.modulator.modulatePcm(this.makeCtlPacket(array.subarray(0, fileLen)));
        for (var i = 0; i < pcmPacket.length; i++)
            rawPcmData.push(pcmPacket[i]);

        // Make silence here
        this.makeSilence(rawPcmData, 100);

        pcmPacket = this.modulator.modulatePcm(this.makeCtlPacket(array.subarray(0, fileLen)));
        for (var i = 0; i < pcmPacket.length; i++)
            rawPcmData.push(pcmPacket[i]);

        // More silence
        this.makeSilence(rawPcmData, 500);

        for (var block = 0; block < blocks; block++) {
            var start = block * 256;
            var end = start + 256;
            if (end > fileLen)
            end = fileLen;
            pcmPacket = this.modulator.modulatePcm(this.makeDataPacket(array.subarray(start, end), block));
            for (var i = 0; i < pcmPacket.length; i++)
                rawPcmData.push(pcmPacket[i]);

            // Inter-packet silence
            this.makeSilence(rawPcmData, 80);
        }

        // Additional padding to work around anti-pop hardware/software
        this.makeSilence(rawPcmData, 250);

        this.playCount = 0;
        tag.pause();
        tag.onended = function() {
            // Play again if we haven't hit the limit'
            this.playCount++;
            if (this.playCount < this.maxPlays) {
                tag.play();
            }
            else {
                this.tag.onended = undefined;
                if (this.endCallback)
                    this.endCallback();
            }
        }.bind(this);
        
        if (isMP3)
            this.transcodeMp3(rawPcmData, tag);
        else if (isWav)
            this.transcodeWav(rawPcmData, tag);
        this.pcmData = rawPcmData;
        tag.play();
    },

    transcodeWav: function(samples, tag) {

        var pcmData = [];//new Uint8Array(new ArrayBuffer(samples.length * 2));
        for (var i = 0; i < samples.length; i++) {
            
            // Convert from 16-bit PCM to two's compliment 8-bit buffers'
            var sample = samples[i];

            // Javascript doesn't really do two's compliment
            if (sample < 0)
                sample = (0xffff - ~sample);

            pcmData.push(Math.round(sample) & 0xff);
            pcmData.push(Math.round(sample >> 8) & 0xff);
        }

        var pcmObj = new pcm({
            channels: 1,
            rate: this.rate,
            depth: 16
        }).toWav(pcmData);
        tag.src = pcmObj.encode();
    },

    makeSilence: function(buffer, msecs) {
        var silenceLen = Math.ceil(this.rate / (1000.0 / msecs));
        for (var i = 0; i < silenceLen; i++)
            buffer.push(0);
    },

    finishPacketPlayback: function(index) {

        if (!this.isSending)
            return false;

        // If "silence" is false, then we just played a data packet.  Play silence now.
        if (this.silence == false) {
            this.silence = true;

            if (index == 1)
                this.modulator.silence(100); // redundant send of control packet
            else if (index == 2)
                this.modulator.silence(500); // 0.5s for bulk flash erase to complete
            else
                this.modulator.silence(80); // slight pause between packets to allow burning
            this.modulator.playLoop(this, this.finishPacketPlayback, index);
            return true;
        }

        if (((index - 2) * 256) < this.byteArray.length) {
            // if we've got more data, transcode and loop
            this.transcodePacket(index);
            return true;
        }
        else {
            // if we've reached the end of our data, check to see how
            // many times we've played the entire file back. We want to play
            // it back a couple of times because sometimes packets get
            // lost or corrupted.
            if (this.playCount < 2) { // set this higher for more loops!
                this.playCount++;
                this.transcodePacket(0); // start it over!
                return true;
            }
            else {
                this.audioEndCB(); // clean up the UI when done
                return false;
            }
        }

    },

    makeUint32: function(num) {
        return [num & 0xff,
                (num >> 8) & 0xff,
                (num >> 16) & 0xff,
                (num >> 24) & 0xff];
    },

    makeUint16: function(num) {
        return [num & 0xff,
                (num >> 8) & 0xff];
    },

    /* Appends "src" to "dst", beginning at offset "offset".
        * Handy for populating data buffers.
        */
    appendData: function(dst, src, offset) {
        var i;
        for (i = 0; i < src.length; i++)
            dst[offset + i] = src[i];
        return i;
    },

    makeHash: function(data, hash) {
        return this.makeUint32(murmurhash3_32_gc(data, hash));
    },

    makeFooter: function(packet) {
        var hash = 0xdeadbeef;
        var data = new Array();
        var i;
        var j;

        // Join all argument arrays together into "data"
        for (i = 0; i < arguments.length; i++)
            for (j = 0; j < arguments[i].length; j++)
                data.push(arguments[i][j]);

        return this.makeHash(data, hash);
    },

    makePacket: function() {
        var len = 0;
        var i;
        for (i = 0; i < arguments.length; i++)
            len += arguments[i].length;

        var pkt = new Uint8Array(len);
        var offset = 0;

        for (i = 0; i < arguments.length; i++)
            offset += this.appendData(pkt, arguments[i], offset);

        return pkt;
    },

    makeCtlPacket: function(data) {
        // parameters from microcontroller spec. Probably a better way
        // to do this in javascript, but I don't know how (seems like "const" could be used, but not universal)
        var preamble = this.preamble;
        var header = this.makeControlHeader();
        var program_length = this.makeUint32(data.length);
        var program_hash = this.makeHash(data, 0x32d0babe);  // 0x32d0babe by convention
        var program_guid_str = SparkMD5.hash(String.fromCharCode.apply(null,data), false);
        var program_guid = [];
        var i;
        for (i = 0; i < program_guid_str.length-1; i += 2)
            program_guid.push(parseInt(program_guid_str.substr(i,2),16));

        var footer = this.makeFooter(header, program_length, program_hash, program_guid);
        var stop = this.stop_bytes;

        return this.makePacket(preamble, header, program_length, program_hash, program_guid, footer, stop);
    },

    makeDataPacket: function(dataIn, blocknum) {
        var i;

        // now assemble the packet
        var preamble = this.preamble;
        var header = this.makeDataHeader(blocknum);

        // Ensure the "data" payload is 256 bytes long.
        var data = new Uint8Array(256);
        for (i = 0; i < data.length; i++) data[i] = 0xff; // data.fill(0xff)
        this.appendData(data, dataIn, 0);

        var footer = this.makeFooter(header, data);
        var stop = this.stop_bytes;

        // 256 byte payload, preamble, sector offset + 4 bytes hash + 1 byte stop
        var packetlen = preamble.length + header.length + data.length + footer.length + stop.length;

        // now stripe the buffer to ensure transitions for baud sync
        // don't stripe the premable or the hash
        for (i = 0; i < data.length; i++) {
            if ((i % 16) == 3)
                data[i] ^= 0x55;
            else if ((i % 16) == 11)
                data[i] ^= 0xaa;
        }

        return this.makePacket(preamble, header, data, footer, stop);
    },

    // once all audio is done playing, call this to reset UI elements to idle state
    audioEndCB: function() {
        this.isSending = false;
    },

    stop: function() {
        this.isSending = false;
    },

    isRunning: function() {
        return this.isSending;
    }
}

// AMD exports
if (typeof module !== "undefined"  && module.exports) {
  module.exports = ModulationController;
}