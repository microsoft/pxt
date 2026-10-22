// Web Audio implementation of the pxsim.audiohost.AudioHost.
namespace pxsim.audiohost {
    setAudioHost({
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
