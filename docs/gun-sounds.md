# Gun sounds

Every gun's sound is synthesized: there are no audio files. The recipes are in `src/config/gunSounds.js`, the format is at the
top of `src/config/audio.js`, and the engine is `src/audio/sound.js`. To listen, run `npm run dev` and open
http://localhost:5173/tools/audition.html.

## How a shot is built
Every fire sound has the same named parts, so upgrades can act on them by name:
- **crack**, the attack: a few ms of shaped noise, or an impulse. This is what makes a small shot feel loud.
- **body**, the weight: small guns are high and snappy, big guns low and boomy. The tiers make this part fuller and deeper.
- **mech**, the toy or tool inside: the stapler's spring, the labeler's ratchet, the nailer's air. Low ammo makes this part
  lighter and adds a hollow tick.
- **tail**, the room: each recipe's `send` into the shared reverb (`config/audio.js rooms`, by area), plus long parts of its own
  where a gun has them.

Other things that apply to every gun:
- **Variety:** each layer is nudged a little on every play (`vary`), on top of the global pitch wobble, and the crack/tick
  buffers come in four variants. A held trigger never repeats one sample.
- **Voice caps:** automatic guns cap their fire sound at 3-4 voices. The oldest voice is stolen with a 12 ms fade.

## Each gun
| Gun | What you should hear |
|---|---|
| Staple Gun | An office stapler, "ka-chik": a bright click, a small knock, a spring ping, then a second plastic click 26 ms later. The quietest gun you hold. |
| Price Gun | A pricing labeler: a plastic tick, a light body, a **three-click ratchet**, and a sticker peeling off. |
| Nail Gun | A framing nailer, "pfft-CHUNK": a hard crack, a driven thump, a steel driver-blade clank, and a **pneumatic hiss** closing down. |
| Foam Dart Blaster | "Fwump", once per dart, so a burst is three: a soft trigger tick, a low-passed puff, and the plunger's FM "boing". |
| Confetti Cannon | A party popper the size of a shotgun: a wide crack, a boomy driven body, then **paper fluttering** for 0.2 s and a tiny party-horn squeak. |
| Rivet Rifle | **Bright and ringing**: a sharp crack, a tight body, and a high inharmonic rivet "TANG" (about 2.35 kHz). |
| Heavy Coil Nailer | **Low and chuggy**: a dull driven thump at 85 Hz, the nail drum rattling round (FM), and an exhaust hiss after each shot. It measures 0.00 alike to the Rivet Rifle. |
| Barcode Scanner | The scan whine rises over the whole charge to exactly the beep's note, so the beep is the scan completing. Then an electric snap, a sub drop, a falling zap and a crackle. Let go early and the whine stops. Dry fire is the till's error buzz. |
| Leaf Blower | A two-stroke "brap" (FM sawtooth) and wind on every pulse. Held down, the pulses run into one engine. |
| Tennis Ball Launcher | A ball machine's "thoonk" (an air pop and a felt "pock"). Every bounce is a hollow rubber "pok", **7% higher each bounce** along the chain. |
| Return to Sender | The loudest: a pneumatic tube WHOOMP with a rising whistle, a rubber-stamp KA-CHUNK at 0.26 s, and a rainbow of four FM bells. Its reload ends on a post-office chime. |
| Stargazer 3000 | A big crack, a deep boom, a long tail and a star's glint. Then, delayed as before, the bolt: up, a telescope ratchet, back, forward, down. |
| Bottle Rocket Bazooka | Launch: a fuse hiss, a cardboard-tube whoomp, and a rising fwoosh and whistle. Burst: the biggest bang, with ten firework crackles scattered over 0.6 s. |
| Balloon Launcher | A rubbery squeak (FM) and a helium hiss. The pop is a sharp crack, the rubber flapping and a confetti rustle. |
| BOGO | Two cheap SMGs: a tight "tk" plus a paper flick, **alternating left and right** (±0.3 pan), quiet per shot because it fires about 18 times a second. |
| Box Cutter | The slider ratcheting out, a whoosh, and a thin steel snick (`melee.boxCutter.sounds.swing`). |
| Kiosk Sentry | `sentryShot`: a smaller staple clack and a servo whirr between shots. |
| Party Trap / Clearance Rack | The trap has its own blast (the cannon's boom, more streamers). The Clearance Rack's tags pop in the Price Gun's ratchet. |
| Hit feedback | All three are dry (no room) and sit in the 2-5 kHz gap above the gun bodies: `hitBody` is a quick thwack-tick, `hitHead` a desk-bell DING, `killConfirm` a cash register's CHA-CHING (the drawer's ratchet, then the bell). |

## Upgrades (`soundUpgrades`)
- **Deluxe, Premium, Platinum:** each tier makes the body fuller and a little deeper (Deluxe x1.1 gain and x0.98 pitch, up to
  Platinum x1.25 and x0.94), with more drive and room.
  - Premium adds a steel "sheen".
  - Platinum adds a brighter sheen and a sub thump.
- **Warranty Renewals:** +2% body each, up to 5.
- **Build-A-Blaster:** each build adds its stuffing's flavour to every shot:
  - fryer oil sizzles and spits
  - smoothie gurgles
  - neon buzzes and zaps
  - glitter shimmers
  - popcorn butter pops twice
  - antifreeze tinkles like ice

  On automatic guns the flavour plays on every 2nd to 4th shot (`flavourEvery`), so it stays clear and cheap.
- **Low ammo:** on the last 3 rounds (`feel.effects.lowAmmoThreshold`, when the HUD counter turns red), the mechanism plays
  lighter and higher, with a hollow tick. Guns with 5 rounds or fewer in the magazine don't get it.

## Rooms (`config/audio.js rooms`, chosen by the area you are in)
| Room | Where | Feel |
|---|---|---|
| hall | the main hallway, the Promenade | 1.4 s, fairly bright |
| court | the Food Court | 1.8 s |
| atrium | the Grand Atrium | 2.6 s, bright: it rings |
| cinema | the Cinema lobby and screen | 2.2 s, dark (carpet and curtains) |
| corridor | the Service Corridor, Mega Mart's back room, the Cinema service passage | 0.55 s, tight, with a metallic flutter |
| store | HOFFMAN'S | 0.8 s, soft |
| warehouse | Mega Mart | 1.6 s |
| smallRoom | the start room | 0.5 s |
| parking | the parking lot | 0.35 s, nearly dry, one late slap off the building |

Settings > Audio > Room echo turns it off for slow computers.

## Measured (14 November 2026, tools/audition.html Measure)
Every sound was rendered offline at 48 kHz through the real engine, at master volume 0.55.
- **Dry** = in the parking lot (nearly no room). **Hall** = in the main hallway.
- **RMS** = the loudest 50 ms, in dBFS. **Peak** is in dBFS.
- **Length** = seconds until the sound (with the hallway's tail) falls 60 dB below its peak.
- **Centroid** = how bright the first 170 ms is, in Hz.
- **Old** = the same measurement of what the game played before.

| Sound | peak | RMS dry | RMS hall | length | centroid | old RMS | old centroid |
|---|---|---|---|---|---|---|---|
| Staple Gun | -10.1 | -24.7 | -24.7 | 0.81 | 2541 | -19.8 | 174 |
| Price Gun | -10.8 | -23.4 | -22.9 | 0.83 | 5155 | -30.0 | 196 |
| Nail Gun | -11.9 | -19.5 | -20.2 | 0.92 | 9435 | -18.1 | 518 |
| Foam Dart Blaster | -11.7 | -23.1 | -23.3 | 0.91 | 545 | -28.3 | 261 |
| Confetti Cannon | -9.6 | -14.3 | -14.8 | 1.00 | 1609 | -14.3 | 3600 |
| Rivet Rifle | -7.6 | -19.1 | -19.0 | 0.96 | 873 | -25.0 | 299 |
| Heavy Coil Nailer | -9.9 | -16.3 | -16.1 | 0.89 | 3379 | -24.9 | 133 |
| Barcode Scanner | -12.0 | -16.5 | -17.0 | 0.96 | 1248 | -21.3 | 1230 |
| Leaf Blower | -10.6 | -21.7 | -20.9 | 0.65 | 2084 | -29.6 | 1896 |
| Tennis Ball Launcher | -9.4 | -18.7 | -18.6 | 0.95 | 151 | -20.7 | 131 |
| Return to Sender | -8.1 | -12.2 | -12.3 | 1.20 | 262 | -13.4 | 1506 |
| Stargazer 3000 | -10.6 | -14.4 | -14.9 | 1.39 | 154 | -17.1 | 1173 |
| Bottle Rocket Bazooka | -7.1 | -15.7 | -15.5 | 1.08 | 1310 | -18.9 | 1388 |
| Balloon Launcher | -6.4 | -20.0 | -20.7 | 0.85 | 11053 | -28.9 | 10850 |
| BOGO | -9.0 | -26.2 | -25.7 | 0.72 | 1654 | -38.8 | 277 |
| Kiosk Sentry (x0.55, as in the game) | -13.1 | -25.1 | -25.5 | 0.95 | 659 | -23.9 | 181 |
| Box Cutter swing | -16.9 | -30.7 | -30.0 | 0.57 | 1998 | -30.7 | 1137 |
| Bottle Rocket burst | -9.8 | -12.5 | -12.1 | 1.14 | 86 | -12.5 | 134 |
| Balloon pop | -11.3 | -24.2 | -25.3 | 0.94 | 13129 | -26.6 | 13095 |
| Tennis bounce | -17.4 | -29.6 | -30.5 | 0.92 | 659 | -32.9 | 424 |
| Party Trap blast | -10.8 | -14.9 | -15.0 | 1.01 | 853 | -14.3 | 3380 |
| hitBody | -16.3 | -29.5 | -28.8 | 0.06 | 162 | -33.6 | 118 |
| hitHead | -11.7 | -28.3 | -28.1 | 0.09 | 2564 | -29.1 | 682 |
| killConfirm | -10.5 | -25.4 | -25.3 | 0.16 | 4263 | -25.9 | 241 |
| reference: walkerSqueak (x0.5) | -28.1 | -40.5 | -40.5 | 0.08 | 1913 | -40.5 | 1918 |
| reference: mannequinStep (x0.5) | -32.3 | -48.7 | -48.7 | 0.06 | 678 | -48.7 | 679 |

**Loudness, quietest first (dry RMS):** BOGO per shot -26.2 < Sentry -25.1 < Staple Gun -24.7 < Price Gun -23.4 < Foam Dart -23.1
< Leaf Blower -21.7 < Balloon -20.0 < Nail Gun -19.5 < Rivet Rifle -19.1 < Tennis -18.7 < Barcode Scanner -16.5 < Coil Nailer
-16.3 < Bottle Rocket -15.7 < Stargazer -14.4 < Confetti Cannon -14.3 < Return to Sender -12.2.

**How alike the guns are** (spectral shape and envelope correlation, minus the gap in brightness; 1 = identical):
- No pair scores above 0.71. The closest is Tennis / Stargazer at 0.71: both are low thumps, one short and one with a long tail.
- Rivet Rifle / Heavy Coil Nailer scores 0.00.
- Before the Staple Gun's second click was moved, Staple / BOGO scored 0.92.

**Stress test:** BOGO at 18.3 shots/s for 3 s, at Platinum +5 with glitter, a hit on every shot and a kill every 5th, in the
Atrium.
- The peak was -1.1 dBFS after the limiter and soft clip, and the loudest 50 ms was -9.4 dBFS.
- No NaN and no silent gaps.
- It rendered at 6.4x real time offline. The same render read 2.8x in an earlier run with the pane hidden, so the timing is noisy.
- Through the same engine, a plain BOGO shot costs about 1.5x the old one.
- Live in the pane, BOGO held exactly 4 voices and dropped to 0 when the burst ended.

**How the levels were set:** `level()` on the audition page measures each sound and proposes the volume that brings its loudest 50 ms
to a target. It was run twice, because the compressor bends the result.
- Shots and hit sounds: the ranking above (`LEVEL_TARGETS`).
- Dry fire: -37 dBFS.
- Reload steps: the old recipe's loudness, kept within -42..-26 dBFS.

Volumes over 1 are normal for the short, clicky guns: their layers are brief, so they need more gain to match.
