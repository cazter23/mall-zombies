# Gun sounds

Every gun's sound is synthesized: there are no audio files. The recipes are in `src/config/gunSounds.js`, the format is at the
top of `src/config/audio.js`, and the engine is `src/audio/sound.js`. To listen, run `npm run audition` (it opens the page as one file in Firefox, no dev server), or `npm run dev` and open
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
| Confetti Cannon | PUNCH: a wide 6 ms crack, a **kick** that drops from 200 to 68 Hz in 20 ms and holds, a low-mid **slap**, a blast of air and a low roll; everything else **dips 6 dB** for 0.2 s. Then the paper flutter and a tiny party-horn squeak. |
| Rivet Rifle | A rivet gun with weight: a hard crack, a short kick (240 to 95 Hz in 10 ms: at 12 shots a second the low end has to end quickly) and a tight slap, then the bright rivet **TANG** that keeps it apart from the Coil Nailer. No dip (it would pump). |
| Heavy Coil Nailer | **Low and chuggy**: a dull driven thump at 85 Hz, the nail drum rattling round (FM), and an exhaust hiss after each shot. It measures 0.00 alike to the Rivet Rifle. |
| Barcode Scanner | The scan whine rises over the whole charge to exactly the beep's note, so the beep is the scan completing. Then an electric snap, a sub drop, a falling zap and a crackle. Let go early and the whine stops. Dry fire is the till's error buzz. |
| Leaf Blower | A two-stroke "brap" (FM sawtooth) and wind on every pulse. Held down, the pulses run into one engine. |
| Tennis Ball Launcher | A ball machine's "thoonk" (an air pop and a felt "pock"). Every bounce is a hollow rubber "pok", **7% higher each bounce** along the chain. |
| Return to Sender | The loudest: a pneumatic tube WHOOMP with a rising whistle, a rubber-stamp KA-CHUNK at 0.26 s, and a rainbow of four FM bells. Its reload ends on a post-office chime. |
| Stargazer 3000 | A sniper's SLAM: a big crack, a kick from 220 to 58 Hz in 22 ms, two slaps, a blast of air and a long low roll; everything else **dips 7 dB** for 0.28 s. Then a star's glint and (delayed, as before) the bolt. |
| Bottle Rocket Bazooka | Launch: a fuse hiss, a cardboard-tube whoomp, and a rising fwoosh and whistle. Burst: the biggest bang, with ten firework crackles scattered over 0.6 s. |
| Balloon Launcher | A balloon let go: the rubber's wobbly "eek" (a squeak with a 25 Hz vibrato), the neck flapping "brrrp" as the air rushes out, and a hiss. The pop is a very sharp, very short BANG, the rubber snapping back, a flap and a confetti rustle. |
| BOGO | Two cheap SMGs: a short "pap" (a 3 ms crack, a driven body that ends before the next shot) and a paper flick, **on the side of the gun that fired** (`sidePan` 0.3: left mouse / LT = the left gun). Quiet per shot: both guns together fire about 18 a second. |
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
Kept low on purpose (the first round of listening found it overdone): the tail is a hint of the space, not an echo.
| Room | Where | Feel |
|---|---|---|
| hall | the main hallway, the Promenade | 1.0 s, wet 0.10 |
| court | the Food Court | 1.3 s, 0.12 |
| atrium | the Grand Atrium | 2.0 s, 0.16, bright: it still rings most |
| cinema | the Cinema lobby and screen | 1.6 s, 0.14, dark (carpet and curtains) |
| corridor | the Service Corridor, Mega Mart's back room, the Cinema service passage | 0.45 s, 0.12, tight with a metallic flutter |
| store | HOFFMAN'S | 0.6 s, 0.07, soft |
| warehouse | Mega Mart | 1.2 s, 0.10 |
| smallRoom | the start room | 0.4 s, 0.06 |
| parking | the parking lot | 0.3 s, 0.04, nearly dry, one late slap off the building |

Each gun's `send` into the room is 0.03-0.2 (the big, rare guns the most). Settings > Audio > Room echo turns it off entirely.

**Punch** (round three, tuned for desktop speakers). Three things make a shot hit, and the big guns have all three:
- a **kick**: a sine that drops fast (in 10-25 ms) and then holds at 55-95 Hz (`freqTime`). The body part's drive adds its
  overtones at 2x and 3x, which small speakers can play when they can't play the kick itself.
- a **slap**: 12-25 ms of noise in the low mids (250-700 Hz), the "smack" between the crack and the kick.
- **contrast**: the Confetti Cannon, Stargazer, Return to Sender, Bottle Rocket burst and Party Trap duck everything else
  (`duck`) for 0.2-0.3 s. The shot itself and the hit sounds skip the dip.

Version B of each is what the game plays. The audition page also has A (tighter, drier) and C (bigger, heavier) for the
Confetti Cannon, Rivet Rifle and Stargazer (tools/auditionPunch.js), levelled to the same loudness, so only the punch differs.

The master compressor has a 6 ms attack (it was 0 ms), so the first milliseconds of every shot get through
before it acts. The limiter (1 ms) and the soft clip catch the peak, so nothing passes 0 dBFS.

## Measured (14 November 2026, third round, tools/audition.html Measure)
Every sound was rendered offline at 48 kHz through the real engine, at master volume 0.55.
- **Dry** = in the parking lot (nearly no room). **Hall** = in the main hallway.
- **RMS** = the loudest 50 ms, in dBFS. **Peak** is in dBFS.
- **Length** = seconds until the sound (with the hallway's tail) falls 60 dB below its peak.
- **Centroid** = how bright the first 170 ms is, in Hz (power-weighted, so a heavy body pulls it down).
- **Old** = the same measurement of what the game played before the overhaul.

| Sound | peak | RMS dry | RMS hall | length | centroid | old RMS |
|---|---|---|---|---|---|---|
| Staple Gun | -10.8 | -24.4 | -23.3 | 0.32 | 3198 | -19.6 |
| Price Gun | -11.0 | -23.8 | -23.4 | 0.33 | 7815 | -29.9 |
| Nail Gun | -11.7 | -19.4 | -19.0 | 0.43 | 9542 | -17.8 |
| Foam Dart Blaster | -11.3 | -22.9 | -23.5 | 0.40 | 629 | -28.2 |
| Confetti Cannon | -8.4 | -13.9 | -12.6 | 0.47 | 399 | -14.7 |
| Rivet Rifle | -10.1 | -18.0 | -18.0 | 0.47 | 218 | -25.2 |
| Heavy Coil Nailer | -10.8 | -17.0 | -17.2 | 0.45 | 2700 | -25.0 |
| Barcode Scanner | -7.9 | -18.2 | -17.1 | 0.41 | 4498 | -21.5 |
| Leaf Blower | -9.6 | -21.2 | -21.3 | 0.24 | 1883 | -29.4 |
| Tennis Ball Launcher | -8.9 | -18.2 | -18.2 | 0.48 | 146 | -20.9 |
| Return to Sender | -7.2 | -12.2 | -11.8 | 0.67 | 327 | -13.9 |
| Stargazer 3000 | -12.3 | -13.7 | -13.6 | 1.01 | 64 | -17.5 |
| Bottle Rocket Bazooka | -6.9 | -16.4 | -16.7 | 0.56 | 1378 | -19.4 |
| Balloon Launcher | -9.5 | -19.9 | -20.2 | 0.41 | 1351 | -29.1 |
| BOGO (per shot) | -14.0 | -23.6 | -23.8 | 0.33 | 249 | -38.7 |
| Kiosk Sentry (x0.55, as in the game) | -12.9 | -27.3 | -27.2 | 0.38 | 689 | -23.9 |
| Box Cutter swing | -16.3 | -29.6 | -30.2 | 0.18 | 1956 | -31.2 |
| Bottle Rocket burst | -9.8 | -12.1 | -12.0 | 0.78 | 76 | -13.5 |
| Balloon pop | -9.3 | -22.5 | -21.3 | 0.39 | 13221 | -27.2 |
| Tennis bounce | -16.7 | -29.6 | -30.8 | 0.40 | 620 | -32.9 |
| Party Trap blast | -10.7 | -15.6 | -15.6 | 0.58 | 810 | -14.6 |
| hitBody | -17.1 | -29.8 | -29.5 | 0.06 | 168 | -33.3 |
| hitHead | -11.1 | -27.9 | -27.9 | 0.09 | 2561 | -29.3 |
| killConfirm | -11.1 | -25.6 | -25.6 | 0.16 | 4309 | -26.0 |
| reference: walkerSqueak (x0.5) | -27.9 | -40.7 | -40.7 | 0.08 | 2003 | -40.7 |
| reference: mannequinStep (x0.5) | -33.4 | -48.6 | -48.6 | 0.06 | 659 | -48.6 |

The Confetti Cannon's centroid fell from 4529 Hz (round two) to 399 Hz: its energy moved from the crack and paper into the
kick and slap, at the same loudness.

Tails are about half as long as in the first round (0.3-0.5 s for most shots, against 0.8-1.0 s).

**Loudness, quietest first (dry RMS, after the last level):** Sentry < Staple Gun ~ Price Gun ~ Foam Dart < BOGO per shot <
Leaf Blower < Balloon < Nail Gun < Tennis < Rivet Rifle < Barcode Scanner < Coil Nailer < Bottle Rocket < Stargazer <
Confetti Cannon < Return to Sender.

**How alike the guns are** (spectral shape and envelope correlation, minus the gap in brightness; 1 = identical):
- No pair scores above 0.70. The closest is Leaf Blower / Bottle Rocket launch at 0.70: both are a whoosh over a low rumble.
- Rivet Rifle / Heavy Coil Nailer scores 0.00.

**Stress test:** BOGO at 18.3 shots/s for 3 s, at Platinum +5 with glitter, a hit on every shot and a kill every 5th, in the
Atrium.
- The peak was -1.0 dBFS after the limiter and soft clip, and the loudest 50 ms was -10.5 dBFS.
- No NaN and no silent gaps.
- It rendered at 2.9x real time offline, in a hidden pane (an earlier run read 6.4x: the timing is noisy).

**How the levels were set:** `level()` on the audition page measures each sound and proposes the volume that brings its loudest 50 ms
to a target. It is run twice, because the compressor bends the result.
- Shots and hit sounds: the ranking above (`LEVEL_TARGETS`).
- Dry fire: -37 dBFS.
- Reload steps: the old recipe's loudness, kept within -42..-26 dBFS.

Volumes over 1 are normal for the short, clicky guns: their layers are brief, so they need more gain to match.
