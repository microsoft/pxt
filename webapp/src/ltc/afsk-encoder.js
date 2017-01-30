function FskEncoder(sampleRate) {
    this.sample_rate = sampleRate;

    this.state.omega_lo = (2 * Math.PI * this.f_lo) / this.sample_rate;
    this.state.omega_hi = (2 * Math.PI * this.f_hi) / this.sample_rate;
    this.state.phase = 0;
    this.state.current_bit = 0;
    this.state.baud_frac = 0;
    this.state.baud_incr = this.baud_rate / this.sample_rate;
}

FskEncoder.prototype = {
    f_lo: 8666,
    f_hi: 12500,
    baud_rate: 8000,
    sample_rate: 0, // comes from calling function based on browser/computer config

    state : {
        phase: 0,
        omega_lo: 0,
        omega_hi: 0,
        current_bit: 0,
        baud_frac: 0,
        baud_incr: 0,
        curbyte: 0,
        bitpos: 0,
        datapos: 0,
    },

    PHASE_BITS: 16,
    PHASE_BASE: (1 << 16), // hardcode PHASE_BITS here b/c javascript can't reference initializers in initializers

    // compute samples per bit. Needed to allocate audio buffers before modulating
    samplesPerBit: function() {
        return  this.sample_rate / this.baud_rate; // Not rounded! Floating point!
    },

    // for debug.
    dumpBuffer: function(buf) {
        var out = "";
        for (var i = 0; i < buf.length; i++)
            out += "0x" + buf[i].toString(16) + ",";
        return out;
    },

    // does what you think it does -- input data should be uint8 array, outputdata is floats
    modulate: function(inputData, outputData) {
        for(var i = 0; i < outputData.length; i++) {
            this.state.baud_frac += this.state.baud_incr;
            if( this.state.baud_frac >= 1) {
                this.state.baud_frac -= 1;
                if( this.state.bitpos == 0 ) {
                    if( this.state.datapos <= inputData.length ) {
                        this.state.curbyte = inputData[this.state.datapos++];
                        this.state.bitpos = 8;
                    } else {
                        return outputData;
                    }
                }
                this.state.current_bit = this.state.curbyte & 1;
                this.state.curbyte >>= 1;
                this.state.bitpos--;
            }
            outputData[i] = Math.cos(this.state.phase);
            if( this.state.current_bit == 0) {
                this.state.phase += this.state.omega_lo;
            } else {
                this.state.phase += this.state.omega_hi;
            }
        }

        this.state.datapos = 0;
        return outputData;
    }
};

// AMD exports
if (typeof module !== "undefined"  && module.exports) {
  module.exports = FskEncoder;
}