// =============================================================================
// IDLE SAVER (core/idleSaver.js): the game goes easy on the computer when nobody is playing it.
// Only while the game is NOT running (title, pause and results screens). A live run is never touched.
//   awake -> dim     nothing pressed for delays[delay].dim seconds (or the window lost focus): draws dimFps times a second
//   dim   -> asleep  nothing pressed for delays[delay].sleep seconds: stops drawing and (muteWhenAsleep) suspends the audio
//   any key, click, mouse move over the focused window, controller input, or the window gaining focus wakes it at once.
// The settings menu writes `enabled`, `delay` and `muteWhenAsleep` (config/settings.js); the rest are plain numbers here.
// =============================================================================

export const idle = {
  enabled: true,
  delay: 'normal', // which row of `delays`
  delays: {
    short: { dim: 15, sleep: 60 }, // seconds
    normal: { dim: 30, sleep: 120 },
    long: { dim: 60, sleep: 300 },
  },
  dimFps: 10, // frames drawn per second while dim (the flyover just looks choppy; nobody is watching)
  muteWhenAsleep: true, // suspend the audio while asleep
  pollSeconds: 0.25, // how often the saver looks at the clock and the controller (a controller makes no browser events)
  padThreshold: 0.5, // a stick pushed this far counts as controller input
};
