music.playSoundEffect(music.createSoundEffect(
    WaveShape.Sine,
    23,
    0,
    25,
    1,
    50,
    SoundExpressionEffect.None,
    InterpolationCurve.Linear
), SoundExpressionPlayMode.UntilDone)

music.playSoundEffect(music.createSoundEffect(
    WaveShape.Sine,
    23,
    0,
    25,
    1 + 1,
    50,
    SoundExpressionEffect.None,
    InterpolationCurve.Linear
), SoundExpressionPlayMode.UntilDone)

music.playSoundEffect(music.createSoundEffect(
    WaveShape.Sine,
    23,
    0,
    25,
    1,
    50 + 1,
    SoundExpressionEffect.None,
    InterpolationCurve.Linear
), SoundExpressionPlayMode.UntilDone)

