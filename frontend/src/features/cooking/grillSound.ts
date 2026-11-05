let context: AudioContext | undefined;
export function unlockGrillSound() {
  try { context ??= new AudioContext(); void context.resume().catch(() => {}); } catch { /* Audio is optional. */ }
}
export function playGrillSound(kind: "success" | "fail") {
  unlockGrillSound();
  if (!context) return;
  const audio = context;
  if (kind === "success") {
    [523, 659, 784, 1047, 784, 1047].forEach((frequency, index) => {
      const note = audio.createOscillator(), gain = audio.createGain();
      const start = audio.currentTime + index * 0.16;
      note.type = "sine"; note.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.07, start + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      note.connect(gain); gain.connect(audio.destination); note.start(start); note.stop(start + 0.32);
    });
  } else {
    // A soft voiced “ohhh”: descending harmonics filtered through an /o/ vowel.
    const start = audio.currentTime;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.05, start + 0.1); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.95);
    gain.connect(audio.destination);
    for (const frequency of [500, 900]) {
      const voice = audio.createOscillator(), formant = audio.createBiquadFilter();
      voice.type = "sawtooth"; voice.frequency.setValueAtTime(190, start); voice.frequency.exponentialRampToValueAtTime(115, start + 0.85);
      formant.type = "bandpass"; formant.frequency.value = frequency; formant.Q.value = 5;
      voice.connect(formant); formant.connect(gain); voice.start(start); voice.stop(start + 1);
    }
  }
}
