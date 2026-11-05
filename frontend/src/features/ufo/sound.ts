let context: AudioContext | null = null;
export function playUfoSound(kind: 'good' | 'wrong' | 'shoo' | 'win' | 'capture') {

  try {

    context ??= new AudioContext();
    void context.resume();

    const notes = { good: [440, 660], wrong: [260, 220], shoo: [330, 550, 880], win: [440, 550, 660, 880], capture: [660, 550, 440, 330] }[kind];

    notes.forEach((f, i) => {
      const oscillator = context!.createOscillator(), gain = context!.createGain(), start = context!.currentTime + i * 0.12;
      oscillator.type = 'sine';
      oscillator.frequency.value = f;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.06, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      oscillator.connect(gain);
      gain.connect(context!.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
    });

  } catch {
    /* Sound is optional when the browser does not support Web Audio. */
  }

}
