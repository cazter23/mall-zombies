# 3D zombie sound

Every zombie sound comes from the zombie: behind you, to the side, upstairs, through a wall. Nothing is a sound file: the same
synthesised recipes (config/audio.js) go through a Web Audio PannerNode per voice. The player's own sounds (guns, hits, buying,
the PA, the radio) are not positional and did not change. Built 15 November 2026 (branch `claude/spatial-audio`).

To listen: `npm run audition` (or `npm run dev`, then /tools/audition.html), **with headphones**. The top card, *3D zombie sound*,
is a mini map: you are the arrow, drag the zombie round you.

## The pieces
| File | What it does |
|---|---|
| `config/spatialAudio.js` | Every number: mode, quality, voices, distance profiles, occlusion levels, floors, the crowd bed. |
| `audio/spatial.js` | Pure maths: a point in the listener's space, distance gain, occlusion level, voice scores. |
| `game/soundStage.js` | DOM-free, runs in the headless tests. Where each zombie sound comes from, how muffled it is, the crowd bed. |
| `audio/sound.js` | The Web Audio side: positional voices, the voice cap, extra room reverbs, the crowd bed's looped voice. |
| `audio/crowdBed.js` | Pure: the horde's murmur as one seamless loop of PCM. |
| `config/zombies.js` | Each zombie sound names a `profile`; `zombieSoundCues` (the swing wind-up, a boss walking in). |
| `tools/auditionSpatial.js` | The audition page's 3D card. |

A zombie calls `playSound(def)`. The zombie manager hands it on as `onSound(name, volume, zombie, def)`, and createGame passes
that to `g.soundStage.play(name, { emitter: zombie, def })`. The stage hands `sound.play` a `place()` function. The engine calls it
once when the sound starts and again every frame (`sound.updateSpatial()` in main.js render), so a sound follows a zombie that moves
while it plays, and it turns as you turn.

A positional voice: recipe -> volume -> **lowpass** (walls, the floor) -> **level** (distance x walls) -> **PannerNode** -> the world
bus. Its room send leaves after the lowpass, into the reverb of the room **the sound** is in. The master chain is unchanged:
compressor -> limiter -> soft clip, last.

## The listener
The camera is the listener. Each frame every voice is placed relative to it: +x right, +y up, -z ahead.
- **Yaw only** (`followPitch: false`): a zombie upstairs stays "up" when you look at the floor.
- `elevationScale` 1.8 steepens up/down. HRTF elevation is subtle; with it, the Promenade over the Hallway is clearly above you.
- **Distance is ours, not the panner's** (`rolloffFactor 0`). The level comes from the profile. The panner only does direction.

**Headphones (HRTF)** gives front/back, left/right and up/down. **Speakers** uses equal-power panning, which can't tell front from
back, so a sound behind you is darker (down to 3.2 kHz) and 20% quieter (`speakersBehind`).

## Distance profiles (`profiles`)
Each zombie sound names one; its own `maxDistance` (config/zombies.js) replaces the profile's `max`.
Gain = `(ref / max(ref, d)) ^ rolloff`, faded out over the last `fade` of `max`. Nothing starts past `max`. `minGain` is a floor
inside the range (the cues). `priority` decides who keeps a voice.

| Profile | ref | rolloff | max | priority | For |
|---|---|---|---|---|---|
| step | 1.5 | 1.5 | 16 | 1 | shuffles, squeaks, a mannequin's tap and creak, a cart's wheel |
| voice | 2 | 1.0 | 30 | 2 | groans, huffs, pants, a snicker (carries further than a step) |
| body | 2 | 1.1 | 26 | 3 | a cart crash, a helmet popping off |
| heavy | 2.5 | 1.2 | 24 | 4 | a Mascot's boots |
| alert | 3 | 0.9 | 30 | 6 | a Shoplifter's jingle, a Mascot's honk, a mannequin coming loose |
| cue | 4 | 0.7 | 45 | 10 | a charge, a swing winding up, a getaway, a Mascot's howl |
| boss | 6 | 0.5 | 90 | 20 | a boss walking in |

## Walls and floors (`occlusion`)
Walls and floors come from the room-culling areas and portals (map.cullAreas / cullPortals), with no raycasts against the colliders:

| Level | When | Gain | Muffle |
|---|---|---|---|
| clear | the same area, or a straight line to it through an open opening (a doorway, the escalator well) | 1 | none |
| neighbour | the next area through an open portal, off to the side of the opening | 0.72 | 3.8 kHz |
| far | two or more areas away | 0.45 | 1.3 kHz |
| closed | reachable only through a closed shutter, or not at all | 0.3 | 650 Hz |

Other rules:
- A sound in another area more than 3 m up or down (`floorGapMeters`) is at least **far**: the Promenade over the Hallway is
  heard through the floor.
- The Atrium is one area over both storeys, so a zombie on its upper ring is **clear** and above you.
- Standing in an opening counts as being in both areas (`doorwayPadding`).
- Outside the map (the debug test range), nothing is muffled.

The open-portal graph is walked once a tick, about 17 areas and 30 portals.

## Rooms
A sound rings like the room it is IN (`audio.roomOf` by grade zone): a groan in the Cinema rings like the Cinema while you stand
in the Hallway.
- **A sound in your own room** uses the shared reverb (the one the guns use).
- **A sound in another room** gets one of `remoteRooms` extra convolvers (2 on Full, 0 on Fewer). A convolver changes room only
  once its last tail has died. When both are busy, the sound uses your own room's reverb.
- **How much goes to the room:** a recipe without a `send` sends `defaultSend` 0.14. The send falls off with distance more slowly
  than the direct sound (`sendDistanceExponent` 0.4), so far away sounds roomier. Settings > Audio > Room echo turns all of it off.

## Floors underfoot (`surfaces`, `surfaceOf`)
A `step` or `heavy` sound is coloured by the floor it is on:
- **tile:** the mall's default.
- **carpet** (HOFFMAN'S, the Cinema): x0.88 pitch, muffled to 1.7 kHz, x0.65.
- **concrete** (the service corridors, Mega Mart's back room): x0.95, 7 kHz.
- **asphalt** (the parking lot): x0.92, 9 kHz, x1.15.

A recipe named `<sound>@<surface>` replaces the sound on that floor. The shopper's shuffle has a carpet brush and a gritty
asphalt scrape.

## What each zombie sounds like
| Zombie | Presence | Cue |
|---|---|---|
| Shopper | `shopperShuffle` (a scuff, every ~0.6 s, half the time), `shopperGroan` (every ~6 s, a vowel and a wobble) | |
| Shoplifter | `shoplifterJingle`: loot jingling every stride (alert); `shoplifterSnicker` | **Fleeing with your points:** the anti-theft gate's two-tone alarm, every 0.75 s, from it (cue, 45 m; not after you die) |
| Cart Pusher | `cartSqueak` + the basket rattling; a groan | **The charge telegraph** `cartRattle`: rattle, rising squeal and three forklift reversing beeps (cue, 30 m) |
| Mannequin | `mannequinStep` with a plastic joint's creak, only while it moves | `mannequinClick` when it comes loose (alert) |
| Mascot | `mascotThump` (heavy, 22 m) | **Approach:** `mascotHonk`, a clown-car horn twice, every ~3 s while the helmet is on (alert, 30 m); the howl before the rush (cue) |
| Any zombie | | **A swing winding up within reach:** `zombieLunge`, a rising "HRAAGH!" and the whoosh of the arms (cue) |
| A boss | | **Walking in:** `bossEntrance`, a heavy door and a shop's entrance chime, big and low, from where it is (boss, 90 m, never quieter than 0.45). The PA's sting stays as it was. |

Shuffle, groan and approach are periodic (`interval`, `jitter`, `chance`) and timed by each zombie's own random stream, never
Math.random, so sounds never change what a seeded test or a gait roll gets next. Cues skip the zombie manager's
`soundMinGapSeconds`. Everything else keeps it.

## Crowd management
- **The voice cap.** At most `voices` positional voices: 12 on Full, 6 on Fewer.
  - A new play scores `priority + gain`. If every voice is taken, it steals the lowest-scoring voice, or is dropped if it scores
    lowest itself.
  - A cue therefore always gets in, and a distant shuffle is the first to go.
  - The per-sound cap (6) is lifted to the positional cap for positional plays, so the most important voices stay, not the newest.
- **The crowd bed** stands in for the rest.
  - **What it is:** one looped murmur (audio/crowdBed.js, built a moment after audio starts).
  - **How loud:** `maxGain x (1 - e^(-weight / knee))`. `weight` is each live zombie in 30 m, weighted by distance and walls. It
    is silent below 4 zombies.
  - **Where:** `distance` m out toward where the horde is. Surrounded, it sits in front.
  - **Updates:** every 0.1 s; it stops entirely when it falls quiet.

## Settings
- **Settings > Audio > 3D sound:** Headphones (HRTF), the default, or Speakers (stereo).
- **Settings > Graphics > Zombie sound voices:** Full (12, 3D) or Fewer (6, stereo only, no extra rooms). It has a medium cost
  tag. The Potato preset picks Fewer; Low, Medium and High pick Full.

Both write config/spatialAudio.js and call `sound.setSpatial()`; live voices switch at once.

## What it costs (measured 15 November 2026, Chrome 156, this PC)
**In the game:** round 30, 40 zombies round you (shoppers, Shoplifters, carts, mannequins, Mascots), turning:
- **No dropouts:** 0 underruns over 9 s (Chrome's `AudioContext.playbackStats`).
- **Voices:** up to 12 positional voices; 47 lower-priority plays were dropped to the crowd bed, which sat at its 0.32 ceiling.
- **Potato (Fewer):** at most 6 voices, all equal-power, no extra rooms, 0 underruns.
- **Main thread:** `soundStage.update` 0.034 ms a tick, `sound.updateSpatial` 0.11 ms a frame.

**The audio thread**, offline renders of a busy round:
- **The round:** 6 s, two zombie sounds every 0.25 s round you, moving, the voice cap working.
- **Caveat:** these ran in a hidden browser pane, whose timings are noisy, so the numbers are the steady ones from repeated runs.

| Case | ms per 6 s | about |
|---|---|---|
| Not positional (the old way), no room | ~290 | 5% of one core |
| Positional, HRTF, positions set directly (shipped) | ~350 | 6% |
| Positional, equal-power, positions set directly | ~345 | 6% |
| Positional, positions GLIDING (setTargetAtTime) | ~650 | 11% |
| + the crowd bed | +~80 | +1% |
| + zombie sounds feeding the room reverb, with extra rooms | +~400 | +7% |

Two things came out of it:
- **Never automate a panner's position.** A glide puts Chrome's PannerNode on its per-sample path and doubled the cost.
  `positionSmoothSeconds` is 0: positions are set straight to the new spot each frame. The HRTF crossfades between directions
  itself, and a zombie moves a few cm per frame.
- **HRTF costs about the same as stereo.** The real cost is the reverb. In a fight, the guns already keep your own room's reverb
  busy, so the extra is the two remote rooms. On a slow computer, Fewer drops those, and Room echo off drops all of it.

To measure again: the audition card's **Measure 3D cost** (four cases). Run it with the browser window **visible**; in a hidden
tab, `window.__spatialRender({ positional, hrtf, quality, seconds })` repeats one case.

## How to tune
- **A sound too loud or soft overall:** its recipe's `volume` (config/audio.js).
- **Reach or importance:** its `maxDistance` and `profile` (config/zombies.js), or the profile itself (config/spatialAudio.js).
- **Walls too strong or weak:** `occlusion` levels (gain and cutoffHz).
- **Up/down not clear enough:** raise `elevationScale`.
- **The horde too present:** `crowd.maxGain`, `knee` and `minZombies`.
- **Rooms:** `defaultSend`, `sendDistanceExponent`, `remoteRooms`.
- **Too many or too few voices:** `voices`.

Test anything you change on the audition card with headphones, then in a real round.

Tests: tests/spatialAudio.test.js (docs/tests.md).
