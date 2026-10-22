// Web Audio implementation of the pxsim.audiohost.AudioHost.
namespace pxsim.audiohost {
    setAudioHost({
        tone: (f, g) => AudioContextManager.tone(f, g),
        stop: () => AudioContextManager.stop(),
        setToneGain: g => AudioContextManager.setCurrentToneGain(g),
        onStopAll: h => AudioContextManager.onStopAll(h),
        isMuted: () => AudioContextManager.isMuted(),
        isAudioElementActive: () => AudioContextManager.isAudioElementActive(),
        sendMidiMessage: b => AudioContextManager.sendMidiMessage(b),
        startSamplePlayback: (s, f, r, sr, g) => AudioContextManager.startSamplePlayback(s, f, r, sr, g),
        createAudioElement: (u, c, v) => AudioContextManager.createAudioSourceNode(u, c, v),
        stopAll: () => AudioContextManager.stopAll(),
        mute: m => AudioContextManager.mute(m),
        playInstructionsAsync: (instructions, isCancelled, onPull) =>
            AudioContextManager.playInstructionsAsync(instructions, isCancelled, onPull),
        playPCMBufferStreamAsync: (pull, sampleRate, volume, isCancelled) =>
            AudioContextManager.playPCMBufferStreamAsync(pull, sampleRate, volume, isCancelled),
        setListenerPosition: (x, y, z) => AudioContextManager.setListenerPosition(x, y, z),
        disposeAllSpatialAudioPlayers: () => AudioContextManager.SpatialAudioPlayer.disposeAll(),
        createMetronome: () => new music.Metronome()
    });
}
