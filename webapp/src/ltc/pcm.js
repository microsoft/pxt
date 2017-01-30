/*jslint bitwise: true*/
/*global module, btoa, Audio, Buffer*/

// node btoa
if (typeof module !== "undefined" && module.exports) {
  var btoa = function(str) {
     return  (new Buffer(str || "", "ascii")).toString("base64");
  }; 
}

if (!btoa) {
  // btoa shim
  (function() {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", encLookup = [], i = 0;

    for (i = 0; i < 4096; i+=1) {
      encLookup[i] = chars[i >> 6] + chars[i & 0x3F];
    }
    window.btoa = function(src) {
      var bytes = [], i = 0, len = src.length, dst = '', n, n1, n2, n3;
      // to bytes
      for (i = 0; i < src.length; i+=1) {
        bytes.push(src.charCodeAt(i));
      }
      src = bytes;
      for (i = 0; len > 2; i+=3, len-=3) {
        n = (src[i] << 16) | (src[i+1]<<8) | src[i+2];
        dst += encLookup[n >> 12] + encLookup[n & 0xFFF];
      }
      if (len > 0) {
        n1 = (src[i] & 0xFC) >> 2;
        n2 = (src[i] & 0x03) << 4;
        if (len > 1) {
          n2 |= (src[i+=1] & 0xF0) >> 4;
        }
        dst += chars[n1];
        dst += chars[n2];
        if (len === 2) {
          n3 = (src[i+=1] & 0x0F) << 2;
          n3 |= (src[i] & 0xC0) >> 6;
          dst+= chars[n3];
        }
        if (len === 1) {
          dst += '=';
        }
        dst += '=';
      }
      return dst;
    };
  }());
}

var pcm = function(options) {

  var defaults = {channels: 1, rate: 8000, depth: 8 }, _ = {}, header;
  if (!_)
    _ = new Object();
  _.wav = [];
  _.dataURI = '';
  
  _.init = function() {
    options = _.mixin(options, defaults);
    header = {                         // OFFS SIZE NOTES
      chunkId      : [0x52,0x49,0x46,0x46], // 0    4    "RIFF" = 0x52494646
      chunkSize    : 0,                     // 4    4    36+SubChunk2Size = 4+(8+SubChunk1Size)+(8+SubChunk2Size)
      format       : [0x57,0x41,0x56,0x45], // 8    4    "WAVE" = 0x57415645
      subChunk1Id  : [0x66,0x6d,0x74,0x20], // 12   4    "fmt " = 0x666d7420
      subChunk1Size: 16,                    // 16   4    16 for PCM
      audioFormat  : 1,                     // 20   2    PCM = 1
      numChannels  : options.channels,                     // 22   2    Mono = 1, Stereo = 2...
      sampleRate   : options.rate,                  // 24   4    8000, 44100...
      byteRate     : 0,                     // 28   4    SampleRate*NumChannels*BitsPerSample/8
      blockAlign   : 0,                     // 32   2    NumChannels*BitsPerSample/8
      bitsPerSample: options.depth,                     // 34   2    8 bits = 8, 16 bits = 16
      subChunk2Id  : [0x64,0x61,0x74,0x61], // 36   4    "data" = 0x64617461
      subChunk2Size: 0                      // 40   4    data size = NumSamples*NumChannels*BitsPerSample/8
    };
  };

  function u32ToArray(i) {
    return [i&0xFF, (i>>8)&0xFF, (i>>16)&0xFF, (i>>24)&0xFF];
  }

  function u16ToArray(i) {
    return [i&0xFF, (i>>8)&0xFF];
  }

  function split16bitArray(data) {
    var r = [], j,i = 0, len = data.length;
    for (i = 0; i < len; i+=1) {
      r[j+=1] = data[i] & 0xFF;
      r[j+=1] = (data[i]>>8) & 0xFF;
    }
    return r;
  }

  _.build= function(data) {
    header.blockAlign = (header.numChannels * header.bitsPerSample) >> 3;
    header.byteRate = header.blockAlign * header.sampleRate;
    header.subChunk2Size = data.length * (header.bitsPerSample >> 3);
    header.chunkSize = 36 + header.subChunk2Size;

    _.wav = header.chunkId.concat(
        u32ToArray(header.chunkSize),
        header.format,
        header.subChunk1Id,
        u32ToArray(header.subChunk1Size),
        u16ToArray(header.audioFormat),
        u16ToArray(header.numChannels),
        u32ToArray(header.sampleRate),
        u32ToArray(header.byteRate),
        u16ToArray(header.blockAlign),
        u16ToArray(header.bitsPerSample),    
        header.subChunk2Id,
        u32ToArray(header.subChunk2Size),
        (header.bitsPerSample == 16) ? data : data
        );
//    _.dataURI = 'data:audio/wav;base64,'+ btoa(String.fromCharCode.apply(String, _.wav));
    _.dataURI = 'data:audio/wav;base64,';
    var dataBin = "";
    for (var i = 0; i < _.wav.length; i++) {
      dataBin += String.fromCharCode(_.wav[i]);
    }
    _.dataURI += btoa(dataBin);
  };
  if (!_)
    _ = new Object();
  _.mixin = function (source, destination) {
    var prop, index;
    if (typeof source === "object") {
      for (prop in source) {
        if ((typeof source[prop] === "object") && (source[prop] instanceof Array)) {
          if (destination[prop] === undefined) {
            destination[prop] = [];
          }
          for (index = 0; index < source[prop].length; index += 1) {
            if (typeof source[prop][index] === "object") {
              if (destination[prop][index] === undefined) {
                destination[prop][index] = {};
              }
              destination[prop].push(_.mixin(source[prop][index], destination[prop][index]));
            } else {
              destination[prop].push(source[prop][index]);
            }
          }
        } else if (typeof source[prop] === "object") {
          if (destination[prop] === undefined) {
            destination[prop] = {};
          }
          _.mixin(source[prop], destination[prop]);
        } else {
          destination[prop] = source[prop];
        }
      }
    }
    return destination;
  };

  _.init();

  return {
    toWav : function(data) {
      _.build(data);
      return {
        raw : _.wav,
        encode: function() {
          return  _.dataURI;
        },
        play: function() {
          if (!Audio) {
            throw new Error('Unsupported audio playback.');
          }      
          var audio = new Audio(_.dataURI);
          audio.play();
        }
      };
    }
  };
};

// AMD exports
if (typeof module !== "undefined"  && module.exports) {
  module.exports = pcm;
}
