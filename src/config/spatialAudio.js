// =============================================================================
// SPATIAL AUDIO CONFIG: where zombie sounds come from (docs/spatial-audio.md).
// A zombie's sound is placed at the zombie (audio/sound.js: a PannerNode per voice, HRTF on headphones), follows it while
// it plays, falls off with distance by its PROFILE, and is muffled by walls and floors (game/soundStage.js: by the
// room-culling areas and the openings between them). Only the nearest / most important `voices` are full voices; the rest
// of the horde is one cheap crowd bed. The player's own sounds (guns, hits, UI) are never positional.
// Read at runtime by audio/sound.js, audio/spatial.js and game/soundStage.js; Settings > Audio "3D sound" and
// Settings > Graphics "Zombie sound voices" write `mode` and `quality`.
// =============================================================================

export const spatialAudio = {
  // 'headphones': HRTF (front/back, up/down, left/right) | 'speakers': plain stereo panning (+ a darker sound from behind).
  mode: 'headphones',
  // 'full' | 'fewer' (the Potato preset: plain stereo whatever `mode` says, fewer voices, no extra rooms).
  quality: 'full',
  voices: { full: 12, fewer: 6 }, // full positional voices at once; a lower-priority play is dropped (the crowd bed covers it)
  remoteRooms: { full: 2, fewer: 0 }, // extra room reverbs, so a groan in the Cinema rings like the Cinema (0: the room you are in)

  // The listener is the camera: every voice is re-placed relative to it each frame (yaw only by default, so a zombie upstairs
  // stays "up" when you look at the floor). elevationScale steepens the up/down angle the HRTF hears (it is subtle otherwise).
  followPitch: false,
  elevationScale: 1.8,
  // Panner moves: 0 = set straight to the new spot each frame. A glide (setTargetAtTime) puts Chrome's PannerNode on its
  // per-sample path and DOUBLED the positional cost (measured 15 November 2026: docs/spatial-audio.md); the HRTF already
  // crossfades between directions itself, and at 60 updates a second a zombie moves a few cm a step.
  positionSmoothSeconds: 0,
  levelSmoothSeconds: 0.08, // gain / muffle changes glide this fast (a door opening, a zombie rounding a corner)
  speakersBehind: { cutoffHz: 3200, gain: 0.8 }, // Speakers only: a sound right behind you is this dark and this quiet

  // Distance PROFILES (each zombie sound names one in config/zombies.js; default 'body').
  //   gain = (ref / max(ref, d)) ^ rolloff, faded out over the last `fade` of max; nothing starts past `max` metres.
  //   priority decides who gets a voice when they run out (higher wins; then the louder one). minGain: never quieter than
  //   this inside `max` (the cues you must not miss). send: x the recipe's room send (far sounds are mostly room).
  profiles: {
    step: { ref: 1.5, rolloff: 1.5, max: 16, fade: 0.25, priority: 1 }, // shuffles, squeaks, creaks: a layer up close
    heavy: { ref: 2.5, rolloff: 1.2, max: 24, fade: 0.25, priority: 4 }, // a Mascot's boots: heard a room away
    voice: { ref: 2, rolloff: 1.0, max: 30, fade: 0.3, priority: 2 }, // groans, huffs, pants: carry further than a step
    body: { ref: 2, rolloff: 1.1, max: 26, fade: 0.25, priority: 3 }, // crashes, pops, clicks
    alert: { ref: 3, rolloff: 0.9, max: 30, fade: 0.25, priority: 6, minGain: 0.12 }, // a Shoplifter's jingle, a Mascot's honk
    cue: { ref: 4, rolloff: 0.7, max: 45, fade: 0.2, priority: 10, minGain: 0.3 }, // a charge, an attack, a getaway
    boss: { ref: 6, rolloff: 0.5, max: 90, fade: 0.2, priority: 20, minGain: 0.45 }, // a boss walking in
  },
  sendDistanceExponent: 0.4, // the room send falls with distance^this (slower than the direct sound: far = more room)
  defaultSend: 0.14, // a positional recipe with no `send` of its own sends this much into the room it is in

  // Walls and floors (game/soundStage.js). Same area = clear; an open opening in a straight line = clear; the next area
  // through an open opening = neighbour; further = far; only through a closed shutter (or no way at all) = closed.
  // A source on the other floor (more than floorGapMeters up or down) in another area is at least `far`.
  occlusion: {
    clear: { gain: 1, cutoffHz: 20000 },
    neighbour: { gain: 0.72, cutoffHz: 3800 },
    far: { gain: 0.45, cutoffHz: 1300 },
    closed: { gain: 0.3, cutoffHz: 650 },
    floorGapMeters: 3,
    doorwayPadding: 0.6, // a point this close to an opening counts as in both areas
  },

  // Floors underfoot (by grade zone; anything not listed is shiny mall tile). A 'step' sound's surface colours it: pitch,
  // muffle and level, and a recipe named `<sound>@<surface>` replaces it there (shopperShuffle@carpet...).
  surfaces: {
    tile: { pitch: 1, cutoffHz: 20000, gain: 1 },
    carpet: { pitch: 0.88, cutoffHz: 1700, gain: 0.65 },
    concrete: { pitch: 0.95, cutoffHz: 7000, gain: 1 },
    asphalt: { pitch: 0.92, cutoffHz: 9000, gain: 1.15 },
  },
  surfaceOf: {
    cinemaLobby: 'carpet', cinemaScreen: 'carpet', departmentStore: 'carpet',
    serviceCorridor: 'concrete', martBack: 'concrete', cinemaService: 'concrete',
    parkingLot: 'asphalt',
  },

  // The crowd bed: one looped murmur (audio/crowdBed.js) standing in for every zombie in range, voiced or not.
  //   level = maxGain x (1 - e^(-weight / knee)); weight = the sum of each zombie's 'voice' gain x its occlusion gain.
  //   Silent below minZombies. It sits where the horde is (the weighted direction, `distance` m out); surrounded = in front.
  crowd: {
    minZombies: 4, range: 30, maxGain: 0.32, knee: 3, distance: 3, updateSeconds: 0.1, smoothSeconds: 0.6,
    seconds: 6, voices: 9, volume: 1, send: 0.08,
  },

  // The audition page's mini map (tools/audition.html): metres across the square, and how often "Loop" replays a sound.
  audition: { mapMeters: 30, loopSeconds: 1.1, orbitMeters: 6, orbitSeconds: 8 },
};
