// "End of Shift": a seven-second original closing-time sting.
// A minor -> F -> E7 -> Am(add9). Quiet electric piano, sagging pad,
// one register bell anchored to the receipt, then filtered ventilation.
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const piano = (midi, delay, gain = 0.12, decay = 1.2) => ({
  type: 'tone', wave: 'sine', freq: hz(midi), gain, attack: 0.008, decay, delay,
});
const pad = (notes, delay, decay, gain) => notes.map((midi) => ({
  type: 'tone', wave: 'triangle', freq: hz(midi), freqEnd: hz(midi) * 0.993,
  gain, attack: 0.25, decay, delay,
}));

export const deathMusic = {
  title: 'End of Shift',
  volume: 0.75,
  stopFadeSeconds: 0.04,
  layers: [
    { type: 'tone', wave: 'sine', freq: 95, freqEnd: 38, gain: 0.22, attack: 0.008, decay: 0.35 },
    piano(76, 0.12, 0.18), piano(72, 0.62, 0.16), piano(69, 1.08, 0.15, 1.6),
    ...pad([57, 60, 64], 0.05, 1.8, 0.035),
    ...pad([53, 57, 60], 1.9, 1.6, 0.04),
    piano(65, 2.1, 0.10, 1.4), piano(64, 3.45, 0.10, 1.5),
    ...pad([52, 56, 59, 62], 3.4, 1.4, 0.03),
    ...pad([45, 57, 60, 64, 71], 4.65, 2.2, 0.025),
    piano(71, 4.75, 0.07, 2),
    { ...piano(88, 0, 0.08, 0.8), anchor: 'receipt' },
    { ...piano(100, 0, 0.025, 0.35), anchor: 'receipt' },
    { type: 'noise', filter: 'lowpass', freq: 550, q: 0.7, gain: 0.025, attack: 0.6, decay: 1.5, delay: 5 },
  ],
};
