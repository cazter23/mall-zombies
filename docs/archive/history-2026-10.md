# Sunset Galleria: build history, October 2026 and before

> Archived from docs/history.md (newest first). The code and docs/folder-structure.md are the current truth.

## 28 October 2026 — Mannequin enemy

Added a faceless plastic mannequin from round 8 (5% of spawns, 8% from round 12), capped at two living actors.
Excess selections become Shoppers without increasing the round budget. Health is 0.8x Shopper, speed 5.8 m/s,
base kill payout 100. Attacks deal 40 with a fixed 0.45s wind-up and 1s recovery.
Watching the head or chest through a clear world sightline stops movement and interrupts attacks; looking away
plays a joint click and allows movement after 0.3s. Fixed-tick aim, base FOV and camera aspect drive observation;
ADS and renderer culling cannot release it. Screen-edge padding has hysteresis. Other actors do not occlude sight.
Watched actors resist crowd pushing and skip stationary rescue; gravity, forced stagger, death and removal still run.
A separate articulated plastic model preserves limb poses while frozen, with hard footsteps and joint sounds.
No map geometry or weapon balance changed. New mannequin tests cover observation, release/attacks, crowd/rescue,
health/mix/cap/quota, death/reset/disposal, real cinema stair traversal and pause.

## 26 October 2026 — Atrium and Cinema ammo machines

Added RESTOCK-O-MATICs in the Grand Atrium's ground-floor northeast corner and Cinema lobby beside the projection-passage
entrance. The Food Court machine remains; all three refill the held weapon for the existing 400-point price and require
their own area to be unlocked. The shared machine builder now supports raised floors, including geometry, collision,
signs, glow, pad and interaction spot. Recessed the body back and raised the inner mat to avoid shared decorative planes.
Validation: production build and 36 focused tests pass, including purchases, ownership/reset, zombie navigation, floor
height and coplanar checks. Browser screenshots inspected; both machines completed real 400-point refills without runtime errors.

## 26 October 2026 — wall-buy progression: Coil into Cinema

Moved the single Heavy Coil Nailer wall buy from the Promenade to the Cinema projection passage's east wall at
(-20.36, 8.3, 20), above the tile dado and between the reel rack/rewind equipment and rear crossover. Weapon price
is now 2500; ammo remains 650. The cheapest door route is Hallway (500) -> Service Corridor (1000) -> Cinema (1250),
so doors plus the Coil cost 5250. Cinema ownership through either entrance grants access; Promenade ownership alone
does not. The six other unique wall buys retain the audit's recommended locations. Seven unique stations remain;
the proposed duplicate Rivet/Nail stations are deferred. Combat stats and universal ammo pricing are unchanged.
Validation: production build, balance report and all 595 tests pass. Browser checks confirm the mounted display clears
the tile dado/equipment, Cinema-only availability, the 2500-point purchase, 650-point refill and restart reset.

## 26 October 2026 — parking atmosphere and environmental detail

Added worn/patched/cracked asphalt, faded paint, tyre/engine stains, puddles/drains/weeds, RV fittings and weathering,
mall service hardware/notices, and three compact scenes behind the RVs: abandoned shopping, interrupted delivery and an
untouched drink/chair/suitcase. The trolley/chair have vaultable collision; a shallow tall electrical cabinet is solid.
The street gains a bus shelter/timetable, bins, street names, roadworks, a stopped car and warm windows/delivery notices.
Painted lamp pools, a cool edge wash and distant haze supply dusk depth without additional real lamps. Haze and a gently
moving loose sign follow ambient-effects settings and reset. Spatial traffic/tree loops, an exit music speaker, cabinet
hum and occasional sign/PA/traffic sounds use authored gain/range and pulse/event timing; generic ambience timers freeze
on pause, require an audible unlocked area, reset on restart and never emit a backlog burst. All textures are procedural
and map-owned. Data is in config/parkingDetails.js; small visual modules keep the main mall builder focused on wiring.
The full-run reward assertion now recognizes the existing temporary benefit types as well as the original zone/sweep;
additional map geometry exposed that old assumption through a different random reward selection. Production reward logic
is unchanged, and the test now verifies that temporary benefits are also removed on restart.
Validation: production build and all 593 tests pass. Real browser checks cover the shopping/waiting scenes, RV row,
wall services and bus shelter; all three new ambient events fire with Web Audio running, ambient-effects off hides haze,
and outdoor zombie pursuit/purchase/restart pass. Screenshots: scratch/parking-detail-*.png.

## 26 October 2026 — exterior visibility, RV parking and roadside detail

The parking view exposed a room-culling problem: the Atrium's interior walls could disappear while its cross-room floor
slabs stayed visible. mall/mallExterior.js adds opaque exterior facades, a roof and corner returns, tagged alwaysVisible
for room culling; the interior remains culled. RV positions now derive from alternate painted bay centres rather than
independent coordinates. mall/parkingSurroundings.js replaces the sparse horizon with a marked road/intersection,
sidewalks, planted verges, three signed roadside businesses, distant buildings/cars, utility poles/wires and a mall pylon.
Scenery adds neither navigation colliders nor real lights. Parking tests cover actual bay containment and opaque
exterior sightlines before/after batching with the Atrium closed; the coplanar check also covers the new shell.
Validation: production build, all 589 tests, and a final 13-test exterior/culling/batching check pass. Browser views from
the north fence, the RV row and the east fence confirm the corrected silhouette, bay alignment and roadside detail;
purchase, zombie pursuit and restart also pass in the browser.

## 26 October 2026 — Customer Parking

Mega Mart's painted emergency exit now opens a 1250-point Customer Parking area (x 34.3..62.3, z -24..6).
An asphalt lot and flush sidewalk surround a row of three tall abandoned vans, with empty bays and wide circulation lanes.
Three fenced boundaries, four outdoor spawn markers, two pole lamps, a sunset sky, facade signage, wind and electrical
buzz give it an exterior identity. The former emergency-exit spawn moved to a boarded vent away from the threshold.
The area uses destination ownership, Flash Sales, culling, grading, horror, ambience, benchmark and map disposal/reset;
the complete map now costs 9500 points across nine purchases and 15 barriers. The focused parking tests cover buying,
walking both ways, every exterior spawn/route with and without the debug range, vehicle/perimeter collision and restart.
Validation: production build and all 587 tests pass. A real browser check bought the exit, captured the lot,
followed an outdoor Shopper to the player and verified reset; screenshots are in scratch/parking-overview.png and
scratch/parking-entrance.png. Distant pavement, trees and stores supply a horizon without adding navigation cells.

## 26 October 2026 — stronger base weapons against the existing health curve

BO3's readable Zombies GSC starts standard zombies at 150 HP, adds 100 per round through round 9, then adds 10% per round starting at round 10. Mall keeps its softer 150 / +75 / 7.5% curve; the weapon pass aims for comparable body-shot kills and ideal TTK around rounds 5–15. The free Staple stays at 30 damage. Price goes to 70 damage, 24 + 144 ammo; Nail 135; Foam 90 per dart with a 0.16 s pause after each three-dart burst; Cannon 70 per pellet; Rivet 95 at 10 shots/s with a 30-round magazine; Coil 95; Scanner 260. Headshot multipliers, falloff, upgrade multipliers, prices, and zombie health stay as before.

At 5 m, the balance model gives round-8 body kills in 10 Price shots, 5 Nails, 8 Foam darts (three bursts), 2 hip Cannon blasts, 8 Rivets, 8 Coil nails, or 3 charged Scanner shots. A close Cannon blast kills in one. Controlled headless aimed body trials against stationary round-8 Shoppers took Price 0.75 s, Nail 1.02 s, Foam 0.68 s, Rivet and Coil 0.72 s, and Scanner 1.40 s from the first shot. The Cannon needed one aimed blast in that trial. These timings include shots and intervening reloads, but exclude the Scanner's initial charge, aiming, switching, moving enemies, and missed shots.

The proposed Cannon value of 60 damage per pellet only killed a round-8 Shopper with one hip blast at 3 m about 54% of the time in sampled spread. At 70, the sampled rate was about 98%; at 5 m ADS it was dependable. This keeps the close-range promise despite pellet spread. Faster kills also mean fewer +10 nonlethal-hit payouts and more kills per ammo refill; watch round pacing and the economy in human playtesting.

Area unlock purchases (2026-10-26):
- Replaced independent shutter tolls with eight destination purchases totaling 8250 points. Existing 14 physical barriers open automatically once both adjoining areas are owned; no cascading ownership or paid shortcuts between owned areas.
- Area prices: Hallway 500, Mega Mart 750, Food Court/Service Corridor 1000, HOFFMAN'S/Atrium/Promenade/Cinema 1250. Destination prompts and Flash Sale original/discounted prices work from either entrance. Purchase events retain the physical barrier id and add areaId/openedDoorIds; one charge can animate and sound several shutters.
- Promenade ownership repairs the escalator when Hallway is owned. Debug O and Play again synchronize all ownership and barriers. Focused integration tests cover the complete 8250-point route, alternate entrance pricing, automatic connections/navigation/sound, denied purchases, discounts and reset.


Cinema second detail pass (2026-10-26):
- Projection corridor now has continuous tiled dado/skirting, conduit/junction boxes, guarded light housings, a shallow rewind bench with film spools and transport cases, and a louvred air-handling access panel. Return corridor adds blockwork, kick/chair rails, overhead channels, meters, delivery dockets and a cleaning checklist. Stairwell gains concrete joints, lower-wall paint and utility conduit. All new equipment sits outside the existing tested movement envelopes.
- Lobby adds carpet borders, framed entrances/poster cases, fitted concession frontage and candy packaging/cup stacks, an usher station, shallow waiting seats, suspended premiere banners and a changeable-letter showtime board. Auditorium adds broad fabric bays, continuous wall-side aisle strips, curtain pelmet, chamfered seat/cushion silhouettes and a reserved-for-repair seat scene.
- New data: config/cinemaFinish.js; builders: cinemaPublicFinish.js / cinemaServiceFinish.js. cinemaPrint.js shares a map-local 32-cell artwork sheet across row letters, identity signs, packaging and forms, keeping the original detail budgets intact: public dressing 23,422 triangles / 109 isolated batched meshes, service 3,598 / 33. Seat geometry in the real map is also reshaped; the isolated public count excludes the base seating. No additional real lights or collision; gameplay, purchases and spawn layout are unchanged.
- Production build and all 25 existing cinema, stairs, visual/clearance/resource and coplanar checks pass in the shared checkout. Six 1440x900 production-browser views reviewed with no runtime exceptions. Render counts were collected separately from the existing flythrough benchmark; software-browser cold shader timings are not useful for GPU performance comparisons.

Start room typography refresh & foundational balance tuning:
- Start room typography overhaul: Google Fonts added in index.html (Anton, Bebas Neue, Fraunces, Playfair Display, Silkscreen, Caveat). Replaced generic monospace sheet() with authentic POS thermal dot-matrix receiptSheet (VT323/Silkscreen, purple-black ribbon ink #2a2436, serrated tear, barcode, store #042) and legal-pad clipboardSheet (Permanent Marker/Caveat ballpoint scrawl, cyan rules, red margin). Added Monarch 1136 price label gun style (pricetag) with day-glo yellow/pink/red stickers and rubber stamp font. Upgraded clearance signage ("NO REFUNDS") to Anton/Bebas Neue condensed liquidation wood-type, and store farewell notice ("STORE CLOSING") to a dignified 1970s department-store parchment letterhead (Playfair Display/Fraunces serif with gold double-borders).
- Foundational balance levers tuned to Treyarch solo benchmarks: economy.rounds.breakSeconds increased from 6 to 10s (intermission travel window); feel.health.regenDelay reduced from 3.5 to 2.5s and regenRate increased from 40 to 50 HP/s (prevents death during sprint meter exhaustion); feel.movement.backpedalMultiplier tuned from 0.70 to 0.78 (3.9 m/s retreat speed vs 3.4 m/s joggers). All verified against tests/startRoom.test.js, posterTextures.test.js, decor.test.js, departmentStore.test.js, and npm run test:quick.

Weapon balance pass: Price Gun magazine/reserve 28/168, damage still 28; Rivet damage 58; Foam Dart damage 56;
Heavy Coil damage 44, full to 15m then 65% at 30m. Fire rates, handling, reloads, prices and zombie health unchanged.
Headshot multipliers: Staple/Nail/Scanner 2x, Price/Coil 1.5x, Foam/Rivet 1.75x, Cannon 1.2x.
Price is the early-game sprayer; Rivet is a stronger automatic, Coil trades handling/reload for sustained fire and pierce.
Foam remains the quicker-aiming accurate burst option. Equal-tier and attachment role tests reflect this progression;
range attachments may challenge Nail at 30m, but it retains the 40m advantage. Older balance notes below are historical.

Sunset Cinema is playable from the Promenade's west-wing shutter (1500 points): a broad lobby, flat auditorium and projection
passage form a continuous combat loop. Six upper-floor spawns, normal door pricing/reset, culling/grading and spatial ambience
are connected. The west service stairs now reach Service Corridor through a separate 1500-point lower shutter, completing
an external loop through Promenade and the hallway; the cinema's front shutter opens both cinema and upstairs. Screen 2/3
remain sealed. The full cinema detail pass is in: warm architectural trim/coffers/marquee, concession equipment and
box-office paperwork/showtimes, acoustic ribs/speakers, numbered seats/cupholders, restrained seat/litter stories,
projection equipment, service wayfinding/cleaning/delivery scenes and worn stair concrete. Local screen art moves slowly
with capped visible-only uploads; dust/poster motion respects Ambient extras and litter respects Clutter. Existing two
lamps are retuned, service spaces have their own readable grade, and spatial ventilation/relay sounds use existing
ambient voice limits. Combat footprints, door prices, weapons and balance are unchanged.

Character and weapon model refresh ("faceted, not voxel"):
- First-person hands, arms and lower body (`weapons/models/arms.js`, `player/body.js`, `weapons/viewmodel.js`, `config/feel.js`):
  replaced rectangular palm/finger blocks with shaped faceted palms (`unitPalmGeo`), distinct thumbs (`unitThumbGeo`), a readable
  right trigger index finger (`rightIndexFinger`) plus 3 grouped grip fingers (`rightGripFingers`), 4 articulated curled support
  fingers (`unitSupportFingersGeo`) plus `supportThumb`, and tapered 8-sided forearms with employee polo sleeves, ribbed crimson
  cuffs (`rightCuff`/`leftCuff`) and cream uniform tipping stripes. Melee box-cutter arm shares `buildCuffedArmSegment` and has a
  faceted fist + trapezoid snap-off blade. First-person body adds a faceted waist, brass belt buckle, tapered legs and faceted sneakers.
- Shared zombie anatomy & static shop clerks (`zombies/zombieModel.js`, `config/shoppers.js`, `zombies/shopperAppearance.js`,
  `maps/mall/props.js`): shared indexed `ANATOMY_GEOMETRIES` give Shoppers, Mall Walkers and Cart Pushers a faceted cranium and
  tapered jaw (`head` stays comfortably inside the 0.25m headshot hitbox), brow ridge, ears, V-tapered torso with shoulder caps,
  tapered limbs, faceted shoes, recognizable hands (palm, curled fingers, inner thumb), and five restrained cartoon-undead face
  profiles (`sunkenEyes`, `offsetJaw`, `droopingEyelid`, `retailSmile`, `discolored`). Per-bone geometry batching now runs on all
  zombie types (~17-18 meshes / ~1.5k tris per Shopper or Mall Walker) with isolated per-zombie materials for hit flashes.
  `props.clerk()` uses `buildClerkFigure()` with cloned geometry instances so `map.dispose()` never disposes shared zombie geometry.
- Refreshed older weapons & upgrade parts (`priceGun.js`, `stapleGun.js`, `nailGun.js`, `foamDartBlaster.js`, `confettiCannon.js`,
  `upgradeParts.js`): Price Gun rebuilt as a sloped supermarket tagger with open cradle cheeks, red-bordered sticker roll, visible
  paper feed ribbon, price-band dial, ink roller, emerging `"$9.99"` label, enclosed trigger guard, `PRICEMASTER` plaque and firing
  roll/roller/label feed motion. Staple Gun rebuilt with a hinged upper compression lever + rubber palm pad, full-length chrome
  staple channel + animated rear spring-pusher rod, stepped driver nose, side staple inspection windows and `STAPLE-PRO T50` sticker.
  Nail Gun adds a cylindrical rear piston tower + bolted exhaust cap, exhaust louvres, fasteners, `CAUTION 120 PSI` decal, brass
  serrated safety contact foot + return spring on the punching nose, twin-rail angled magazine with visible collated nails, and a
  brass quick-connect air fitting + hose stub. Foam Dart Blaster adds a faceted clamshell receiver with parting seam and screw bosses,
  ribbed foregrip, shaped skeletonized stock with orange buttpad, `FOAM STORM · AGES 8-80` plaque and indexing rotary drum.
  `upgradeParts.js` adds mounting brackets/adapters on universal parts, weapon-tailored `jumboPack` reservoirs/drums/packs via
  `mount.gunId`, a cam-latch + finger-loop `speedLoader`, a woven-tag `wristband`, and a branded Extended Warranty service seal.

Promenade steps 1-3: independently authored upper bounds/floor sections and three sealed future connections; widened southern
route (+2.5m above the Food Court, no downstairs layout changes); SHOE-PER SALE becomes a two-entrance room with a vaultable
display and perimeter stock/fitting area. Existing upper unlock, balcony holes/rails, escalators, Atrium shutter, prices and four
spawn markers retained. Southern vents/decor follow the moved wall. Structural support is reused without doubled slabs;
new annex support/roof, floor-aware navigation and grading are integrated. tests/promenade.test.js covers traversal/vaults/live
zombies; mall.test.js now checks spawn floor heights instead of accidentally testing upstairs markers on the ground layer.
Steps 4-6 complete: eastern bench ring/tree replaced by a low landmark and perimeter seats, opening both junction routes and
the Atrium approach. Authored detail adds directory artwork, payphones/magazine rack, upholstered seats/forgotten bag, overhead
direction signs (arrows reversed on the back), warm ceiling diffuser, shoe tickets/fitting pair, a closed Pretzel Palace scenic
counter and lit BUILD-A-BLASTER renovation frontage. The actual workshop/system and expansion wings remain sealed for later.
All detail is static/map-owned: about 7.7k triangles and 36 meshes after isolated batching, no added real lights/colliders.
Fixed a coincident shelf/post edge found by extending the coplanar regression to upstairs. Culling now covers the wider main
floor and the shoe annex, with a portal for each entrance; the workshop neon follows upstairs horror/quality controls.
Browser: sprint/slide, shop loop, Atrium crossing and a 12-zombie horde (all arrive in about 10-15s). Controlled headless round-1
Shopper routes from the ground-floor hallway/Atrium approaches through their escalators reach the eastern junction in about
24-25s; exact times vary with gait/speed/crowding. Spawn counts/rates/prices are unchanged; the existing four upstairs markers
keep local pressure. New geometry/clearance/culling/resource tests plus the full suite and build verify the changes.

Security shutters rebuilt: matte enamel slats, faded Galleria sunset/band, area-specific notices/stickers/wear; clearance
raspberry, Food Court teal, Mart blue-grey, Atrium lavender/brass, staff institutional green. config/shutters.js owns finishes,
door-ID assignments, slat pitch and hardware dimensions. Fixed side guides and roller cassettes stay after opening; a solid
bottom rail, lifting handles and lock plates move with the curtain. world/shutter.js shortens the visible curtain and crops
its UVs as it feeds upward (constant slat/letter size, top fixed at the housing; no slab rising through the lintel). Original
collider box, headroom threshold, 1.2s speed, prices/zone events and reset behaviour remain. Frames add no collision; existing
static batching leaves all moving pieces alone. Guide caps/edges and cassette undersides keep an 8mm clearance from adjacent
floor, jamb and lintel planes so the fixed frames do not z-fight after batching. Low staff-shortcut/Promenade destination signs are mounted forward of the
cassette on rigid plaques. game/shutterSounds.js listens to purchases: short motor start, tick-paced rolling rattle, clunk
on actual completion. No queued wall-clock finish sound; pause freezes it and death/runReset cancel; debug opens are silent.


Grand Atrium detail pass: twelve shallow decorative storefronts on the ground and upper perimeter (fashion mannequins,
perfume, luggage, TVs, repeated employee portraits, papered/closed displays). No new accessible rooms, collision, doors or
lights. CELL-OUT stocks phones/keypads/cables/packages; SHADE SHACK has a glasses rack, display head, mirror, register and
disordered stock. Fountain adds stone panels, submerged coins (water now translucent), dedication, hatch, stains/chips,
subtle ripples and a local fountain voice through the existing capped/occluded ambience system. A single floor overlay
adds a tiled medallion, entrance bands and traffic wear; below normal shadow/decal height, no floor collision changes.
Opening banners (readable both sides), sunset mobile, pennants, pilasters/brackets and a stranded balloon dress the height;
bench bags/drink, planter-integrated litter bin, cleaning kit, employee board and directory add small scenes. Existing
vents, doors, fountain loop, upper ring and escalator remain clear (actual-triangle tests + existing movement/nav tests).
Data/colours/counts/timing: config/atrium.js. Builder: maps/mall/atriumDetails.js, called by atrium.js; its update/reset run
from map.update/reset. Static pieces use the existing batcher; only three ripples + the mobile animate (ambientEffects off
sets a still pose). This pass adds about 10k triangles, no new lights. All resources belong to the map kit.


Retail UI: title directory with sunset emblem/arrow navigation over the live flyover; combat round sign, checkout credit
display, floating ammo/name/tier text and employee reward strip. Vitals are two unframed continuous lines (health above thinner
stamina, fading almost out when full). Purchases use a compact hold-button/name/price line with a thin progress underline;
only upgrade terms or a points shortage add detail. Warranty transitions, replacement attachments and crossed-out original
sale prices remain (pricing.basePriceOf; charged prices unchanged). Brief Purchased text appears near the points counter.
Purchase confirmations listen to the event bus in the browser. PA messages
queue instead of overwriting each other; new threats preempt routine copy. Round/PA/sale use separate HUD positions.
Pause and stats use cream personnel forms/ruled ledgers; settings a facilities console; controls/help an employee handbook.
Receipt retained, with sticky retry buttons outside its printing animation. Controls, focus/inert behavior and gameplay
unchanged. Presentation lives in ui/retail.css, ui/announcements.js and config/ui.js. Stats empty/content sections now correctly
hide each other; equal-ammo weapon switches refresh the HUD name. Browser QA includes real F purchases, keyboard/controller
navigation and 1440x900, 800x600 and narrow layouts. No map/weapon balance edits for the UI.

VISUAL OVERHAUL (neon 80s vaporwave mall, leaning hard into horror; every costly effect toggleable). Plan: 1) performance
foundation, 2) the hallway as the approved REFERENCE ROOM, 3) neon + painted light pools, 4) floors/haze/post, 5) clutter,
6) set pieces, 7) dynamic horror lighting, 8) presets/perf polish. Step 1 is DONE:
- 1a Graphics tab (was Video): every setting that costs performance has `cost` ('low'|'medium'|'high', a tag in the menu) and
  EVERY Graphics preset (Potato / Low / Medium / High; Ultra joins with the first Ultra-only effect) must set it (tested). New
  effect = one entry in config/settings.js + its value in each Graphics preset.
- 1b Benchmark: Shift+B on the title or pause screen (or `await __mall.benchmark()`): fx/benchmark.js flies map.benchmarkShots
  (11 named long views including the cinema lobby/screen/stairs, mall.js), every door opened for the route then restored; report = draw ms (CPU, not vsync-capped: the
  number to compare), frame ms, draw calls, triangles, per shot + slowest. In the test browser use the PRODUCTION preview
  (launch config mall-zombies-preview, `npm run build` first): the dev page reloads whenever another tool saves a file.
  A hidden/background pane only draws ~1-5 fps: frame ms is meaningless there, draw ms and calls still count.
- 1c Light pool (fx/lightPool.js, setting `lampCount` All / 8 / 6 / 4): below All the map's PointLights become hidden sources and
  a fixed pool of real lights follows the camera (fade, copies flicker, skips lamps at 0). High = All (unchanged look).
- 1d Static batching (world/staticBatch.js, main.js before the first frame; `?nobatch` turns it off to compare): still, opaque
  meshes merged by material in 12m chunks, colour-only standard materials share one vertex-coloured material. NOT merged:
  userData.dynamic (set it on anything shown/hidden/moved at runtime, e.g. the escalator barrier parts), material.userData.animated
  (materials changed at runtime, e.g. the flickering tube), transparent, shutters, hidden, instanced, one-of-a-kind textured
  (signs). 1483 -> 436 meshes, pixel-identical (mean diff 0 in 4 views), draw calls 612 -> 190 average (atrium ring 1378 -> 519).
- 1e Auto graphics (game/autoGraphics.js): the FIRST launch only (nothing saved) measures the title flyover's frame rate (visible,
  focused, hitch-free frames after a warm-up) and picks a preset (config/settings.js autoGraphics tiers).
Step 2 REVISED after review: the user liked the neon but NOT the black, and missed the corporate-satire tone. New direction
"GRAND OPENING, FOREVER" (config/look.js header): a bright 80s pastel mall still cheerfully open around the zombies; horror in the
details, darkness only in back of house and in later rounds (step 7). Hallway now: cream terrazzo with pink grout, mint walls,
lavender wainscot + chrome rail + peach band, white ceiling, warm-white lamps/panels (x 16 panel dead), neon kept but BACKED (dark
panels) where it sits on pastel walls; satire layer: neon OPEN 24/7/365/FOREVER and SMILE! IT'S IN YOUR CONTRACT, canvas posters
(world/posterTextures.js: Sunny the sun mascot, EMPLOYEE OF THE MONTH = Dale the zombie x6, the YOU ARE HERE. YOU WILL STAY HERE. map,
banners, notices: lost children, Galleria Rewards, wet floor); copy in look.hallway.satire. APPROVED ("This is good. Keep going.").
Rolled out to every area (maps/mall/zoneLooks.js, one builder per area, all from config/look.js entries, one shared look kit):
Start room (faded butter / raspberry clearance store; THANK YOU FOR SHOPPING! over the shutter, CLEARANCE), Food Court (peach / teal /
coral; FRESH MEAT DAILY, EAT · SHOP · REPEAT, FREE REFILLS*), Mega Mart (cool white + brand blue / yellow; LOW PRICES. LOWER
STANDARDS., SAVE MONEY. LIVE LESS., dying red tube at the back), Service Corridor (back of house: green / cream institutional
two-tone, dying sick-green tube, red EXIT, staff notices, heavier clutter), Level 2 (pink trim, THE SUN NEVER SETS ON SAVINGS,
YOUR STORE HERE!), Grand Atrium (neon sunsets beside SUNSET GALLERIA, COME FOR THE SALES. STAY FOREVER., trim round the arcade
and ring). Walls an area borrows from a neighbour get a 1 cm paintPanel (paint is on both faces of a shared wall). Washes sit 1 cm
off a wall (behind 2 cm stripes), sign glows 2.6 cm (coplanar.test covers the atrium and part of the Mart). Back of house is darker
in DECOR only so far: real dimming is the zone lighting step.
Steps 4-8 done:
- Zone lighting (fx/zoneGrading.js, config/look.js grading, map.gradeZones): per-area grade (exposure, tint, saturation, contrast,
  vignette) eased by the CAMERA position; dark sick-green Service Corridor, dim red Mart stockroom walkway. Graphics > Zone lighting
  (low cost; Potato off). fx/postProcessing.js grade pass (exposure goes through the tone mapping, so Visual effects Off keeps it).
- VHS filter (postProcessing VhsShader, look.vhs): Graphics > VHS filter Off/Subtle/Full, off by default, a style choice with no cost
  tag so presets never change it; with Visual effects Off that frame is composed like Low.
- Set pieces (maps/mall/setPieces.js, SET_PIECES data): hallway arcade bank (south wall, west end), start room CRT TV wall (static +
  SALE ad), Mega Mart can pyramid (no collision), level 2 mannequins. One collider each; built BEFORE the look kit so clutter avoids them.
  Atrium set piece skipped (another tool owns atrium.js / atriumDetails.js); Food Court ball pit not done.
- Horror layer (game/features/horror.js, map feature kind 'horror', look.horror, map.horror): from round 5 darker each round, a growing
  share of flickering neon dies (neon.setFailures), lamps flicker out for the run; from round 6, 35%/round power cut in the player's area
  (neon.setPower(0), its lamps off, zone grade -> powerCut red), stutters back. All flicker holds >= 0.18 s (under 3 flashes/s).
  Comfort > Horror lighting (Calm off). forceCut() on the instance for testing. Start room / Mart detail lamps never die.
- Performance: measured in the (throttled) test pane at 1280x720 with gl.finish per frame: timings too noisy to tune from, except real
  lamps (all ~25 ms avg vs 6 lamps ~19 ms; a 12-lamp pool looks identical but isn't faster). Neon glow / clutter barely matter.
  Room culling (fx/roomCulling.js, map.cullAreas / map.cullPortals): meshes wholly inside a room go on that room's camera layer
  (tagged before static batching; batches key on the layer), each frame a portal walk (open doors only, screen-rect narrowing) enables
  the visible rooms' layers. Pixel-identical to no culling in 84 renders (all benchmark + title poses, doors shut and open). Doors shut:
  2416 -> 1797 draw calls, 650k -> 339k triangles over the 8 benchmark views (atrium ring 655 -> 396, level 2 437 -> 254); all doors
  open: up to -22%. ?noculling compares. Raycasters must use layers.enableAll() (impactMarks does).
(First version, superseded:)  config/look.js =
the art direction as data (palette rules, hallway colours, neon colours, pool strengths, clutter; look.runtime = what the
Graphics settings write: neonGlow, clutter). maps/mall/hallwayLook.js builds it on top of the hallway: plum wainscot + chrome
rail round every opening, neon signs (FOOD COURT dead U, MEGA MART, GRAND ATRIUM, dying red STAFF ONLY, "GO NG OUT OF BUS NESS"),
a SUNSET GALLERIA centrepiece (neon sun + two stars; palms read as stick figures at that size), cyan/pink trim tubes in pieces,
painted light pools (additive soft quads, no real lights; sign glows sit 6 mm in front of the trim wash so coplanar.test passes),
a paint panel over the Mega Mart's white end wall, and clutter (world/scatter.js) kept out of doorways / spawns / buy spots / the
centre lane. mall.js takes the hallway's wall / floor / ceiling colours, lamps and dim violet light panels (props.lightPanel tint/glow)
from look.js; the old flat hallway signs are gone. Neon, pools and clutter groups are userData.dynamic (never static-batched).
Graphics settings neonGlow (halos + pools) and clutter (none/some/full) in every preset. Shots for review were taken from the
production preview with a canvas capture (main menu HUD excluded).
Room/portal culling was planned for 1d but frustum culling of the 12m batch chunks already does most of it; revisit if needed.
Also merged: world/neon.js (neon tube builder) and world/decor.js + world/scatter.js (decoration kit), not placed yet.


HOFFMAN'S DEPARTMENT STORE (built in a worktree in 5 steps: shell + gate, fixtures, start-room side door, look, Scanner move + perf):
see Map. Wiring in mall.js: LAYOUT.departmentStore (= config/departmentStore.js), zone, 2 doors, spawns, lamps (2), cullAreas +
2 cullPortals, gradeZones ('departmentStore' grade in look.grading), a horror area, a benchmark shot. Door count 14 (with the cinema's two). Measured from its
benchmark view: 226 draw calls / 36k triangles (hallway 639 / 101k). The Barcode Scanner moved here from Byte Me's pod.
HOFFMAN'S DETAIL PASS + SEAM: see Map. The store view went 226 -> 455 draw calls, 36k -> 54k triangles (hallway: 739 / 89k); the pass itself is
~310 static meshes / 4.4k triangles. Beside it: a receiving door on the stair connector wall (the store's west wall), now-showing one-sheets and
ticket stubs on the Promenade side of the cinema's front, and HOFFMAN'S / CINEMA on the hallway directory. FOUND: Three.js makes object ids
with Math.random(), so a test that seeds Math.random BEFORE building the map is tied to the map's mesh count (cinemaStairs.test.js did: its
horde scenarios flipped when meshes were added); seed AFTER building. The cinema's own detail pass (Codex) was already complete.

LATE WALL GUNS: the Rivet Rifle, Heavy Coil Nailer and Barcode Scanner are now real wall buys (economy.wallBuys, 'debugOnly' gone;
H still cycles them). Prices: Rivet 1500 / ammo 750 (275 sustained body DPS up close),
Coil Nailer 1250 / 650 (300 sustained body DPS, a 64-nail drum and a 2-zombie pierce), Scanner 1750 / 900 (weak sustained
dps, 180, but pierces 4 in a line, ~3x: the top crowd gun). Spots (mall.js wallBuys, each probed against the built geometry: nothing within
a metre, 3 m+ from every spawn on its floor): see Map > Wall-buy spots. Buying follows the existing two-slot rule. The old assertions
that these guns stay off the map now check they are on it once. tests/lateWallGuns.test.js: priced + zoned + one feature each, real F
holds buy for the exact price and refill for the ammo price (also from level 2), nothing offered while the area is closed or from inside
Byte Me through its wall, spots clear of spawns, all three bought in a row replace the gun in hand, Play again takes them away.

Rivet Rifle (a wall buy now, see above; was a debug-only prototype): automatic 58 damage at 7.5 shots/s, 1.75x headshots, 24 + 144 ammo, 2s magazine reload. Full damage to
12m, falling to 60% at 28m. Steady body fire with slower ADS (0.26s) and 0.78x normal ADS movement, smaller magazine
than Foam but stronger per-hit damage; Nail retains the long-range advantage. Own model, recoil, audio, impact marks and
controller pulse; supports existing tiers/attachments and cache refills. H marks the run assisted. tests/rivetRifle.test.js
covers cadence/reload, roles at every tier, bloom, real hits/payouts/no pierce, ADS/switch/reset, model reload and debug/cache
integration. Existing gun stats are unchanged. Play Again now immediately clears the previous gun's ADS state.

Controller vibration: core/haptics.js listens to shot (now includes weaponId), playerHit and powerUpCollect from the browser.
Five distinct gun pulses; damage overrides shots/pickups until its pulse ends. Uses the currently polled gamepad's dual-rumble
actuator, with legacy pulse fallback; missing/blocked devices are harmless no-ops. Settings -> Controller -> Controller
vibration adjusts strength (0 = off), saved normally. Stops immediately on pause, death, run reset, blur/hidden tab, unplug,
controller replacement or returning to keyboard/mouse. No queued feedback or changes to gameplay/visuals. Browser peripheral
built in main.js; createGame remains hardware-independent. Physical feel needs testing on the player's actual controller.

Atrium <-> Mega Mart shortcut 'atriumMegaMart' (1000, opens both zones, buyable from either side): a 3m shutter through the Mart's
north wall and the atrium's south wall at x 21.5..24.5 (LAYOUT.atrium.martLink), west of the checkouts, into the atrium's arcade;
GRAND ATRIUM / MEGA MART signs over it. 10 doors in all. tests/atrium.test.js covers both sides, walking through and Mart routes.

End of Shift death music: a quiet original seven-second sting (descending piano over Am -> F -> E7 -> Am/add9, a soft
falling thump, slightly detuning pad, register bell at receipt appearance, ending ventilation fade). Config in deathMusic.js;
sound.playDeathMusic({ receiptAt }) schedules a managed group of synthesized voices on the existing music/master volume
controls. playerDeath starts it after ambience is silenced; runReset (Play Again / Main Menu) cancels even future notes with
a short fade. Completed/cancelled voices disconnect their audio nodes; repeated starts replace the old group cleanly.

Employee incentives (power-ups): player gun/melee kills from round 2 fill a subtle performance meter (headshots/melee and
rapid multi-kills earn extra credit). At 12-16 credit a zombie drops a floating carton, blue beacon or security badge on
clear floor. One uncollected drop, 15s lifetime, no immediate repeats, maximum 3 drops per round; near-full inventories
exclude ammo drops. Walk through to collect (fast slides work; walls and other floors block collection). Stockroom Delivery
fills every carried reserve and tops the ready gun up to half a magazine; it never bypasses a running reload or the Cannon's
individual shells. Blue Light Special leaves a 4m zone for 20s: base kill credit doubles for zombies killed inside, with
same-floor/line-of-sight checks; +10 hits and headshot/melee bonuses are unchanged. Security Sweep knocks back and staggers
risen zombies for 2s, interrupting attacks and Cart Pusher charges, with collision but no damage or free points. HUD progress,
pickup/timer text, PA banners and distinct synthesized sounds; no added lights. Pausing freezes timers; death/Play again clear
pickups/zones. Debug testing: window.__mall.g.powerUps.debugDrop('stockroomDelivery'|'blueLightSpecial'|'securitySweep')
drops at the player's feet and marks the run assisted. Map source files are unchanged by this feature.

THE GRAND ATRIUM (maps/mall/atrium.js, see Map): the big open two-storey room north of the hallway. Gate 'atrium' (1500) in the
hallway's north wall (the north-east hallway vent moved to the south wall at x 16 for it), shortcut shutter 'atriumPromenade' (1000)
from its upper ring into the level 2 Promenade (opens both zones, buyable from either side, sits on the upper floor: shutters and
kit.wall take a floor height now, doorway.minY / wall bottom). 9 doors in all. Its escalator is props.escalator({ sealed: false,
hangingSign: false }) and is a second nav link (map.navigation.links). Found while building: a bench next to the fountain let you
jump onto it, out of every zombie's reach, so the fountain has a glass guard on its rim (one 2.2m collider) and the kiosks are solid
up to their canopies. Shared props.railing(x0, z0, x1, z1, floorY) builds every glass railing (level 2 and the atrium). Escalator
comb strip nudged 6mm off its plate's end (the two shared a face and flickered; the hallway escalator had it too). tests/atrium.test.js
(9): the real F-hold gate buy + Play again, sealed until bought (no route, no spawns) then every vent reachable incl. the ring's, a
running lap round the fountain with clear straight runs, the arcade corners, fountain/kiosks not standable even from a bench, ring
rails from four sides, a player rides the escalator up and down, zombies use it both ways, the Promenade link from both sides and
walkable through, no buying the gate from level 2; coplanar.test.js covers the whole atrium; mall.test.js counts 9 doors (its
120-orders test leaves out the escalator repair and both atrium doors, which have their own tests). The scene has 25 point lights
now (the atrium added 2, level 2 2): if the school computer struggles, the shelved light pool (git stash) is the fix to revisit.

Balcony ("less cramped" pass, part 2): level 2's floor (= the hallway ceiling) has two open BALCONY VOIDS over the hallway,
LAYOUT.level2.voids (x -9.5..-1.5 and 2.5..10, z 0.5..3.5), railed on all four sides (1.5m, ignoreShots: you can shoot down through
them), with a 4m bridge between them in front of the start room / Food Court doors. The hallway feels 10m tall: you see level 2's
skylights through the voids and zombies on the other floor. kit.slab takes `holes` (slabPiecesWithHoles in mapKit.js); the
atmosphere's ceiling seams/vents skip every hole (`ceilingHoles`), the hallway's centre light panels over the voids moved to the solid
strips beside them, the red promo banner and the swinging FOOD COURT / MEGA MART sign moved off the voids (the sign hangs under the
bridge), the old upper exit beacon/emergency light moved to level 2's west wall, the level 2 planter ring moved to x 14.2, and the
level 2 floor skin sits on the slab (it flickered against the void edges). tests: levelTwo.test.js balcony (open, sprint-jumping at each
void from all four sides never drops you, rails, ground nav under them), mall.test.js (ceiling solid round them, open in them).

Career statistics: the title menu's Statistics screen is an employee record with lifetime totals, personal bests and the
last 12 completed shifts, saved in browser localStorage. Death freezes one authoritative run summary for both the receipt
and the `runEnd` event. Gameplay-changing debug commands mark the run assisted, so its receipt still appears but it cannot
alter career totals or records. The receipt calls out new records, career totals, or a debug-run exclusion. Clear records
requires confirmation; controller navigation is supported.

Wider entrances ("less cramped" pass, part 1): the Food Court gate is 7m (was 4), the Mega Mart gate 6m (was 4), the Food Court <->
Mega Mart shortcut 5m (was 3); all are LAYOUT entries in mall.js. The RESTOCK-O-MATIC moved east to x 4.95 to stay clear of the wider
door lane, the east-end planters by the shortcut sit 0.6m from it (so the Food Court's south-east corner stays reachable), the
fallen wet-floor cone moved out of the door lane. Prices and doors unchanged. megaMartDetails.test.js reads the doorways from LAYOUT.

Second floor, step 5 of 6 (gameplay integration): level 2 ambience (atmosphere.js emitters level2_music + level2_hvac, zone 'upstairs';
the ceiling slab occludes them from the hallway), contact shadows follow ramp surfaces (a zombie on the escalator gets its shadow on
the steps, not on the blocks underneath), and debug Shift+T (`upstairs`, map.levelTwo { minY, arrival, below, repair }) teleports to
level 2's west lobby, repairing the escalator for free, and back to its foot. The Cart Pusher already only charges on the player's
floor (|dy| < 0.5) with lane rays at its own height. Tests in levelTwo.test.js (13 now).

Second floor, step 4 of 6: Level 2 is built (maps/mall/levelTwo.js, see Map). The old closed-off landing (props.upperLanding) is gone.
Done with it, because the first tests failed without it: the zombie manager treats spawn markers as standing on their own floor (spawn at
the marker's y, route cost and occupancy checked at that y; an explicit spawn spot still goes on the ground), surround slots are taken
only by zombies on the player's floor (slots and lines are checked at the player's y; a zombie on another floor follows the route to you,
it used to stand right above you pressing at an invisible slot), the stuck-zombie failsafe asks the route from the zombie's own floor, and
navigation.directionTo no longer cuts straight through a wall to a ramp's end from several cells away (zombies coming along either
passage pinned themselves on the escalator's side wall: now they head for the ramp end like any other cell and only walk in when close).
kit.tiledFloor takes { top, thickness, collide } (a thin tiled skin over the slab). Local spawning keeps zombies near you: with the
player on the ground only ~1.5% of spawns are upstairs, with the player on level 2 almost all are. NOT done yet (step 5): ambience zones
for level 2 (music/HVAC voices), contact shadows/Cart Pusher lanes on another floor, a debug teleport. tests/levelTwo.test.js (10 tests):
closed in, rails (3, too tall to jump, shots pass), nobody falls into the well from three sides, the walkway is connected and the planter
solid, every vent is a clean spawn on the floor, sealed until repaired (no upstairs spawn), spawn locality, a zombie from each vent comes
down to a player below, one crosses level 2 to a player up there, Play again reseals, and no pinning at the side wall for any lane.

Second floor, step 3 of 6: the escalator repair is a purchase. Door `escalatorRepair` (economy.doors.escalatorRepair 2000, ordinary
pricing / Flash Sale category 'door') with verb 'repair': prompt "Hold F to repair Escalator 2000" at the foot (door.position = props.escalator's
`foot`). Its barrier is an adapter in mall.js (`escalatorGate`): open() removes both landing barrier colliders (+ markCollidersChanged, so
the nav grid rebuilds and zombies can route up) and hides both ends' rope/posts/OUT OF ORDER boards (props.escalator returns them as `barrierParts`);
close() (Play again) puts it all back. It opens the new zone `upstairs` ('Level 2', closed at the start, nothing spawns there yet).
The map has 7 doors now; debug O (open all doors) includes the repair. Verified in tests (real F hold: too poor / enough, Play again
reseals, the mall door ladder) and in the browser (prompt, 2000 spent, rope and board gone). Level 2 itself is still just the closed-off landing.

Second floor, step 2 of 6: the escalator is walkable. props.escalator now builds a ramp surface (plate, 30-degree slope, top plate),
tall side walls, blocks under the lane (kept 0.4 m below the surface at their start: a rider's body reaches ahead of the feet) and
still the barrier across its foot; it returns { hole, topLanding, barrier, ramp, link, upperY } and the map exposes
`navigation: { floors: [0, upperY], links: [escalator.link] }` (createGame passes it to the zombie manager) and
`escalator: { barrier, ramp }`. The barrier is a normal collider: while it stands the escalator is sealed exactly as before (the old
sprint-jump test passes unchanged apart from ignoring the enclosed lane blocks); REMOVING it (and markCollidersChanged) is what
"repairing" means, which step 3 will make a purchase. Verified with the real game: a player walks up to level 2 (y 6.3) and back
down, walking under the high end still keeps you on the ground, a zombie climbs to a player upstairs (~10 s) and comes down to one
on the ground, and with the barrier up zombies never route up. The ceiling hole runs 0.4 m past the top of the slope (the slab's edge
met a rider's body while the feet were still a little below it). tests/ramps.test.js, tests/escalatorWalk.test.js. Level 2 itself
is still just the closed-off landing.

Second floor, step 1 of 6 (the plan: multi-floor navigation core, walkable escalator, zone + repair purchase, build level 2, gameplay
integration, verification): zombies/navigation.js now supports several floors joined by ramp links (see the folder structure).
tests/navFloors.test.js on synthetic two-floor maps with a gentle staircase and the real collision code: zombies climb to a player
upstairs, come down to one on the ground, reach one standing on the stairs from both floors, and a floor with no link is unreachable.
Nothing in the mall uses it yet (floors default to [0]). NOTE for the next step: the collision code only walks over bumps under
5 cm and a circle of radius 0.32 sees steps ahead, so real stairs need a slope under ~9 degrees; the escalator (30 degrees) needs a
ramp collider type.

Visual effects settings (for weak computers): Settings > Video > Visual effects = High / Low / Off (fx/postProcessing.js
setQuality: flags + MSAA sample count only, nothing rebuilt, safe mid-run; Off draws straight to the screen) and "Dust and flickering
lights" (config/environment.js atmosphere.ambient.enabled, read each tick by maps/mall/atmosphere.js). The Video presets set them:
Low = half resolution + effects Off + no dust/lights, Medium = 75% + Low, High = native + High (the default; High's output is
unchanged from before: measured ~0.2 mean difference on 0-255). Measured in the software-rendered test browser (relative only):
High ~52 ms/frame, Off + no dust ~17 ms (about 3x faster); the dust motes alone were ~13 ms of that. Off/Low look the same colour and
brightness as High (mean difference ~5/255) minus the bloom glow, lens vignette/fringing and smooth edges.
tests/visualEffects.test.js: the three levels on a stand-in renderer, Off's draw order, settings + presets + saving, and the mall's
dust/lights switch.

Single-file build: `npm run build:single` writes dist-single/sunset-galleria.html (~1.1 MB, git-ignored), the whole game with no
other files, so it runs by double-clicking it (the normal dist/ needs a web server: browsers refuse separate module scripts and
workers from file://). No image/audio files exist (textures drawn, sounds and music synthesized), so nothing else has to travel
with it. Verified served from a plain static server (loads, title screen, a run, the music worker starts as a blob: worker, no
console errors); NOT yet opened through file:// in a real browser from here. Settings are saved per browser.

RESTOCK-O-MATIC (the ammo machine, renamed from STAPLE-O-MAT and moved from the far west wall to the Food Court's north wall just
inside the door; see Map). Same 400-point flat refill, same feature kind; new look and a live screen. The feature now returns an
update hook that keeps the screen on the gun in hand (ammoScreenText: price, FULL or SALE). tests/ammoCache.test.js has the new
position (beside the door, north wall, faces south), buying from the front and never through the wall from the hallway, solidity,
clear door lane and routes, and the screen text; tests/coplanar.test.js also covers its region (it caught the cap/body and
side-sign shared planes).

Weapon firing sounds use distinct, heavier procedural recipes: the Staple Gun has a metal/tool-body strike, the
Price Gun a short label-punch snap, the Nail Gun a pneumatic piston slam, the Foam Dart Blaster a compressed-air
burst, and the Confetti Cannon a pressure boom with paper flutter. The master compressor has explicit fast peak
control so automatic fire and the cannon retain headroom even when the volume slider is at 100%.

Original background music: "After Closing", a 43.64-second/16-bar stereo lounge loop at 88 BPM, with electric piano,
bass, soft drums, detuned pad, echoes and a borrowed-minor second-half turn. config/music.js owns score/timbres;
audio/mallMusic.js deterministically renders PCM in audio/musicWorker.js, off the gameplay thread. sound.js caches
one buffer and shares a single looping source between mall speakers; distance/occlusion/pan and speaker EQ apply.
Pause preserves the cursor; Play again rewinds. Settings > Audio > Background music saves an independent volume
(45% default, zero mutes), separate from Mall ambience and Master volume. No audio downloads or per-note timers.
tests/music.test.js covers PCM/headroom/seam/determinism, asynchronous loading/source reuse, pause/reset/mute,
speaker selection and saved settings. Preview export: node tools/exportMusic.mjs path/to/after-closing.wav.

Debug keys cleaned up: one table in config/debug.js (see the folder structure), run by game/debugCommands.js (headless, tested),
polled by main.js (raw key codes stay there) and listed by the debug window (` toggles it; ui/debugPanel.js). Still live in a
normal game, with `debug.enabled` as the master switch. Replaced the Alt+Z / Shift+Z combos and the per-feature flags
(allowShutterToggle, zombieKeys, cheatKeys): Z spawns the selected zombie type, Shift+Z cycles the type. New: K kill all (pays),
L Flash Sale now, Shift+N +5 rounds (rounds.jumpTo), G god mode (health.invulnerable), H give the next wall gun, U free tier
(upgrade the gun in hand). tests/debugCommands.test.js: table (unique, no gameplay clashes, every id implemented), key
resolution, every command in the real game/mall, god mode and the window state surviving Play again, and the window itself.

Foam Dart Blaster capacity pass: 30 darts (ten bursts), up from 24 (eight bursts). Damage, burst timing, reload,
reserve and prices are unchanged. Measured sustained DPS rises from 228 to 242 at 5-15 m; the cheaper Price Gun
remains competitive up close, and Nail Gun retains its long-range lead. Upgraded capacities remain whole bursts
(Platinum: 39 darts). Burst, cancellation, reload, base-role and upgrade-role tests cover the new capacity.

Cart Pusher (round 6+, config/zombies.js `cartPusher` + economy.zombieMix: 10% of spawns, 15% from round 10; 1.8x health;
worth 130; its 2nd spawn in round 6 is forced, with a PA banner). A Shopper-look zombie pushing a shopping cart
(zombies/cartModel.js, visual only: no collider/hitbox, shots go through the basket). Walks like a Shopper and slams like
one up close; with a clear 1.6 m-wide lane at 5-14 m (rays at cart height: walls, counters, benches and stools block it;
checked every 0.25 s) it TELEGRAPHS for 0.9 s (stands, rattles the cart, head down, rattle + squeal sound) while turning
to aim, LOCKS the direction it faces, then CHARGES straight at 9 m/s (faster than your sprint) up to 3 m past where you
stood (max 16 m). In its path (the cart's width + 0.27 m; a ~1 m sidestep clears it) = 60 damage + a 7 m/s shove
('playerHit' gets `knockback`), then a 1 s stop. A miss = it CRASHES (the nose ray hits a wall, or it runs out of charge):
stunned 2 s, cart tipped, taking 1.5x damage. 4 s cooldown between charges. Debug: Shift+Z until it is selected, then Z spawns one.
tests/cartPusher.test.js: mix/health/value/intro, telegraph -> charge -> hit + shove, hit width, sidestep -> overshoot ->
crash + stun + extra damage, wall crash stops at the nose, no charge too close/far, through a bench, a narrow doorway or a
wall (but through a wide doorway), the normal slam up close, the model (cart on the root, upright when dead, poses, dispose)
and a real charge in the real game's hallway. Verified in the browser (telegraph pose, a real hit for 60, a dodge + crash).

Cannon consistency pass: pellet cone 7 -> 6 degrees, full damage through 4 m (was 3 m), taper to 10% at 12 m
(was 5% at 10 m). Point-blank body damage remains 432, with the same ammunition, reload, fire rate and penetration.
Stationary chest simulations average 412/333/261 damage at 3/4/5 m hip, 394 aimed at 5 m; individual seeded blasts
check reliable round-3 kills at 3 m and aimed at 5 m, plus useful hip fire at 4 m. These are controlled simulations,
not promises for moving targets, off-centre aim or movement spread. Other guns are unchanged.

Mall atmosphere pass: cooler hallway, warm clearance store/Food Court, fluorescent Mart and utility corridor;
roughness contrast and scuffed tiles, soft fixture/zombie contact shadows, ceiling infrastructure, consistent
mall notices and small interrupted-shopping scenes. Subtle sign sway/tube variation and spatial HVAC/fridge/music
add life without changing routes, collision, purchases, spawning or combat. Ambient tuning is in environment.js
and audio.js; sound fades out on pause/death/reset. Decorative geometry is batched; the escalator well and combat
lanes stay clear. Regression coverage lives in atmosphere.test.js.

Shopper visual variety: coordinated weekend/office/teen/errand/summer outfits; seven top styles, trousers/shorts/skirts,
seven hairstyles, three subtle width builds, stripes/logos, occasional torn sleeves/stains/missing shoes. Most have
no accessory; others get one bag, backpack, sunglasses or headphones. Thirty clothing palettes span blues, violets/lilacs,
yellows, ivory/white, charcoal, tan and the original reds/greens; accessories also have brighter choices. Head position, hitboxes, health, speed and
attack behavior are unchanged. Mall Walkers retain their original tracksuit/headband design. Rigid details batch
by material on each animated bone; materials are shared only within one zombie so hit flashes stay isolated,
and per-model merged geometry is disposed with the corpse. Appearance is picked once per spawn.

Prone: Ctrl (either side) / controller LB (L1) toggles a grounded prone stance. Crawl speed 1.25 m/s,
collision height 0.55 m, eye height 0.38 m; lowering eases the camera and shrinks collision with it.
Space/A or the prone button gets up without jumping; C/B rises to crouch. Headroom checks fall back to crouch
or keep prone under low cover. No airborne dives, sprint, slide boost, vault or melee lunge while prone;
shooting, ADS, reloads and ordinary zombie damage still work. Prone speed is a player stat, reset each run.
The first-person body lies low with legs behind the view; Controls diagrams/list and How to play include prone.

Menu audit fixes: Settings/Controls isolate keyboard focus and make background menus inert. Hidden menus explicitly
clear backdrop blur; entering play also closes Settings/Controls, including after a delayed pointer-lock grant.
Controller Settings navigation includes Reset tab, Reset everything (two presses), and Back; closing cancels a pending confirmation.
Preset selection tracks the selected button, including equivalent values, and custom values step to either endpoint.
Splatter changes clear existing flesh effects and red pools on the next rendered frame even while paused; dust,
tracers and persistent gun marks are preserved. Video shows native percentage and actual render/display pixel sizes.
Low/Medium/High target 50%/75%/100% of capped display density (2x maximum); exact native default avoids rounding down.
Saved pixel-ratio values remain compatible; select High to undo a previously saved low-resolution setting.

Gun-specific world impacts: embedded staples, crooked price stickers, protruding nails, foam darts and confetti/streamer
clusters. Cosmetic only; uses hitscan worldHit metadata after pierce. A visual ray verifies real map/debug-range mesh
surfaces (never invisible collision proxies, sprite labels or moving shutters), with corner checks to avoid overhanging
edges. One global 200-mark cap; Cannon limited to 2 projection attempts per blast; startup warms the 13 shared variant
pools and sticker textures. Restart clears marks; unloading a surface removes its marks on the next effects update.
Browser verified each signature, 300 impacts recycling to 200, restart to zero; projection averaged ~0.26ms per attempt
in the local test browser. Damage/points/accuracy/ammo are unchanged; regression suite, build and balance report pass.

Mega Mart stock variety expanded to 31 product types: camping gear, snack packs/jars/cups, mixed holiday decorations,
and household bottles/tissues/towels/pans. Independent per-shelf seeds give each level unequal runs of tidy, disturbed and
heavily looted stock: varying group sizes/gaps, front-to-back placement, crooked or fallen items, and occasional stray products.
There is no fixed pair/bay grid. Actual model bounds space neighbours apart and keep stock supported, inside the shelf
footprint and below the next shelf. Placements stay the same between runs. Existing clearance/vault/purchase regressions
pass; no collision, lighting, economy or combat changes.

Mega Mart detail pass: department-specific stock replaces generic product cubes, with sparse bays, checkout clutter,
receiving/stockroom wear, toy promotion, perimeter trolley and fluorescent housings. Gondola/counter collision and prices
are unchanged; only the visible-size parked trolley adds one small collider away from the main routes. Both existing lamps
are retuned in environment.js, with no extra lights. New clearance tests plus real checkout-vault/purchase tests pass.
Browser verified all four checkout vaults, walking through both entrances, the 1200-point Foam Dart buy and trolley collision.

Start-room detail pass complete: clearance-store checkout, picked-over shelves, framed zombie vents, sale remnants,
Price Gun station, missing employee photo, floor wear and static warm/cool lighting. No new colliders, prices, spawns
or gameplay features; shelf visuals opened up within the original collision footprint. Small static boxes are batched
by material. Tests cover clear fighting/spawn/vault spaces, valid geometry, a real vault and the 500-point Price Gun buy.

Store flicker fix: z-fighting where my new geometry shared planes: the pod back-wall paint panel under the signs/screens, the door
frame posts against the window sills, the store ceilings against the wall edges, the Customer Service booth's desk against its filing
cabinets, and its warranty card against the tier stickers. Fixed (thinner panel, posts 2cm proud, ceilings inside the walls, no
overlaps) and pinned by tests/coplanar.test.js (verified to fail when two of the bugs are put back).

Real stores: the Food Court's four shops are walk-in rooms (maps/mall/stores.js) with the attachment counters inside (barrels moved
from the Mega Mart pegboard to Nuts & Bolts), each with a zombie clerk, its own look and a zombie spawn just inside its door; the
Customer Service desk is a walled booth with a service window and clerk. Two south shops are recessed into the wall (6m deep), two
north shops are pods (4.5m) against the hallway wall; the north pillars and the Mega Mart pegboard are gone. Found while building:
the west pod first sealed the ammo machine's corner off (0.7m gap beside the planter), so both pods sit 0.6m inward (1.3m gap), and
the spawning test now compares origins with the number of LOCAL markers (a far corner like the ammo cache has only two close ones).
Verified by tests (210) and in the browser: every store looks right from outside and at the counter, the booth too.

Upgrade audit fixes: Platinum purchases and switching to a Platinum gun no longer read an invalid next-tier price
and freeze rendering. The interaction prompt rechecks availability before reading dynamic fields. Laser Pointer scales
bloom recovery along with bloom, preserving its intended hip benefit / ADS penalty during repeated bursts. Gun-model recoil
reads resolved stats, including shots and dry clicks before the first render after an attachment change. Display cases now
visibly reach their 1.25m collision height, with parts and name cards raised to match. Regression suite: 208 passing;
build and balance report pass (base gun numbers unchanged). Browser checked all three tier purchases with live F holds,
continued animation after Platinum, switching to the Platinum gun, case prompts/geometry, and fitting/firing Grip Tape.

Gun upgrades steps 3 + 4 done: the four store attachment counters (see Map) and the upgrade parts on the gun models (every
attachment has a visible part on every gun it fits; the tier sticker shows on the gun from Deluxe up). Verified in tests and in the
browser (real F hold at Byte Me fits a Laser Pointer to the staple gun for 750 and its beam shows; all four counters display their
parts; parts checked from both sides and from the player's view on all five guns; the Zoom Lens stays clear of the sights in ADS;
the grip tape is wound round hand + grip because the hand hides the handle). Gun upgrades are complete.

Debug O opens all doors together (or closes all when every door is already open). It no longer inverts each door:
buying the start shutter and then pressing O used to close it, lock the hallway zone and hide both the Nail Gun and
Customer Service prompts. Regression tests cover mixed door states and actual purchases at round 7 after debug open-all.

Gun upgrades step 2 of 4 done: the Customer Service desk (see Map) + the tier under the ammo counter. Buying a tier never refills
ammo (the user's call). Verified in tests/upgradeDesk.test.js and in the browser (real F hold: Staple Gun -> Deluxe for 2000,
damage 30 -> 42, magazine 12 -> 14 without a refill, HUD "Deluxe warranty"; the desk, signs and green-to-gold stickers look right).
Gun upgrades step 1 of 4 (the system; branch claude/gun-upgrades, which also has Codex's loop shortcuts merged in): Extended Warranty tiers + store
attachments as data (config/upgrades.js, prices economy.upgrades: tiers 2000 / 4000 / 8000, attachments 750-1000) turned into
mods by weapons/upgrades.js and applied with playerGun.setMods. Tier damage x1.4 / x2.1 / x3.5 keeps round-8 shot counts until
rounds 12 / 17 / 24. Roles hold at every tier, but the tiers' magazine/reload bonuses help reload-heavy guns a little more, so
the Foam Dart Blaster's 15 m lead over the Nail Gun becomes a near-tie at Premium/Platinum (within ~2.5%). Next: 2) Customer
Service desk (map feature, hallway by the elevator, position as data) + tier on the HUD, 3) attachment counters, 4) tier sticker +
attachment parts on the gun models.

Range pass (Staple Gun, Foam Dart Blaster, Nail Gun): every gun now has a range role. Staple Gun falloff full to 10 m -> 70% at
25 m (weakest at every range: 128 dps up close, 89 at 30 m). Foam Dart Blaster 50 -> 52 damage + falloff full to 15 m -> 75% at
30 m: the mid-range gun (best non-shotgun at 15 m: 228 vs Nail 222 / Price 217; just under the Price Gun up close, 228 vs 231;
172 at 30 m). 55 was tried and rejected: it beat the Price Gun up close. Nail Gun unchanged, no falloff: the long-range gun,
222 at 30 m, now 29% ahead of the next gun (was 1.4%). tests/balance.test.js pins all of it; `npm run balance` shows 15 m.

Loop shortcuts implemented on codex/loop-shortcuts in four steps: multi-zone doors, Food Court / Mega Mart (1000),
Service Corridor / Food Court (1250), then full routing/spawn/purchase verification. Both use ordinary shutter doors,
existing pricing and map data; each opens both adjoining zones and buys from either side. Door/zone reset preserves
overlapping holders until all close. Sixteen spawn markers and weapon/buy-station positions are unchanged.
Tests cover every purchase order, shortcut-only entry, both-sided interaction/collision/nav, natural Mega Mart wave spawns,
and local spawn selection at six positions with entrances only, shortcuts only and both loops. No gun code changed.
Browser verification (Chrome, fixed 60Hz): real F holds buy both shortcuts from either side at 1000 / 1250; ordinary
movement completes the main loop in 12.92s and west loop in 14.98s along clear waypoints, without sprint/sliding.
Controlled Shopper travel at 3.4m/s (includes 1s emergence; stop within 2m of a stationary player): Mega Mart rear vent
(21.8,-23.2) -> east Food Court (18.4,-8.3), closed shortcuts 19.58s / open 5.50s; corridor end (-21.8,-13.2) -> west
Food Court (-17.3,-12.2), 17.32s / 1.98s. Food Court east shop -> hallway centre stays ~7.5-7.6s; hallway northeast vent ->
Food Court entrance stays ~6.1-6.3s. These are controlled route timings, not survival/difficulty benchmarks; normal
4m spawn exclusion remains in force (all these origins are outside it).
Twelve-Shopper groups at 3.4m/s all crossed each doorway: first/last 2.53/5.52s east, 1.68/4.53s west (includes emergence),
no rescues, no climbing. A 12-zombie Z/Shift+Z horde aimed at the Food Court used both routes: Mart 2 shortcut / 1 hallway;
corridor 1 shortcut / 1 hallway. Horde timing used extra player health to observe routing, not a survival run. Close crowd
pressure can still shove the player. The cannon still buys for 1500 from its original corridor spot, cannot buy across
the opening; RESTOCK-O-MATIC refills for 400 from its front, never through the wall. Within 1m of the cannon its existing
facing-free prompt can take priority over the shortcut; stand nearer the corridor centre to buy the shutter.
Keep the agreed door widths/prices.
Browser-found fixes: floor beneath the west shared wall (the debug range shifted grid centres and revealed a 30cm
unsupported strip; map-only nav had missed it), and Food Court sign 4cm off the Mart wall to clear its 2cm brand stripe.
Both have regression tests. Final verification: 176 tests and production build pass (existing bundle-size warning only).

Codex refactor-review fixes (no gameplay change): a pierced/pellet hit on a target that is already dead (e.g. killed by a
'kill' listener earlier in the same shot) no longer pays +10; the 'purchase' event reads label/kind/id BEFORE use() (buying a
gun reports the gun, not "<Gun> ammo"); once dead nothing more is paid or counted; the feature and price registries only
accept their own entries (no 'toString' kind/category); resetPlayerStats removes undeclared fields; features are built after
the core event wiring with a richer ctx (g.features.context); discount rounding is economy.discountRoundTo. Tests for each.

Codex playtest follow-up: Foam Dart Blaster damage 45 -> 50 (round 3: two body bursts; round 5: one head burst), Confetti
Cannon wall ammo 750 -> 500 (the 400 RESTOCK-O-MATIC was cheaper than the wall). Fixes: a shot ends any reload pose at once
(viewmodel.fire sets reloadWeight 0), so the cannon no longer fires with its barrels open when firing cuts a shell-by-shell
reload short; the balance report's magazine time no longer counts the last shot's recovery (it overlaps the reload, as in
weapon.js) and labels shots vs trigger pulls (Foam: darts (pulls)); the cannon ceiling check is "no single BODY blast kills
round 5" (a point-blank head blast can: deliberate risky reward). Corrected sustained dps: Price 231, Nail 222, Foam 219,
Cannon 439 at 2 m. Watch: Nail vs Foam at 30 m is now only ~1.4% apart (the role check still passes); if the Nail Gun's
long-range role feels blurred, give the Foam Dart Blaster a little very-long-range falloff.

Gun balance rework (roles + upgrade-ready structure): every hit's damage comes from weapons/gunStats.js hitDamage, falloff
is a per-gun option, gameplay reads each slot's RESOLVED gun (resolveGun: config + mods), so Build-A-Blaster / attachments
are data (playerGun.setMods). `npm run balance` prints every gun as it plays; tests/balance.test.js pins the ROLES.
Confetti Cannon (room-clearer, updated consistency pass): 12 pellets x 36 (432 point blank), 6 deg hip cone (x0.45 aimed),
full damage through 4 m then down to 10% at 12 m, 6 + 24 shells. Controlled chest simulations average
432 / 412 / 261 / 71 / 11 damage at 1.5 / 3 / 5 / 9 / 12 m hip (aimed: 394 at 5 m). No single all-body blast can kill
round 5. Hip sustained DPS is 439 at 2 m, 265 at 5 m and 45 at 10 m. Price Gun (cheap close-range sprayer): 28 dmg (was 25), 32-round
magazine (was 24), 1.3s reload (was 1.4), 192 reserve, falloff full to 12 m -> 60% at 30 m: sustained 226 dps up to 12 m
(best of the non-shotguns; Nail 209, Foam 186), 137 at 30 m (below Nail/Foam). Known balance smell left alone: the Foam Dart
Blaster (1200) out-damages nothing it costs more than (186 dps vs Nail 209 at 1000); its role pass is a later step.

Visual fixes: corridor caps extend across their own side walls only, so the Service Corridor end cap no longer
overlaps/flickers through the Food Court wall beside the RESTOCK-O-MATIC. The Price Gun front sight post is seated
in the housing (its tip/ADS position stays the same). Confetti Cannon has fitted support-hand/thumb geometry,
a hinge below and forward of the breech, open rear bores and a shell/hand path that clears the receiver. Its
closed muzzle position and gameplay/reload timing are preserved. The Foam Dart Blaster and Confetti Cannon front-sight
beads sit on posts (they used to float above the body). Tests/weaponModels.test.js checks sight
attachment and receiver clearance across the reload; corridor/mall tests cover the shared-wall cap.

Zombie health tuning: 150 HP in round 1, +75 per round through round 9, then +7.5% per round.
This reduces bullet-sponginess (round-8 Shopper: 675 HP, 27 Price Gun body hits / 8 Nail Gun body hits).
Mall Walkers retain 65% of Shopper health. Zombie damage, movement, spawning and weapon stats are unchanged.

Local zombie spawning implemented: eligible markers are ranked by the existing weighted navigation field (wall
penalties mean route cost is not literal walking meters). New spawns pick 50% from the nearest four and 50% from
markers within 30 cost units of the cheapest safe marker. Open zones and reachability still gate every choice.
Player distance (4m horizontally) and live-body clearance (both radii + 0.25m, including emerging zombies) are
mandatory; no safe point returns null so rounds retry without spending quota. Prefer markers off a 3s cooldown;
if all safe local markers are cooling, relax only cooldowns, inside that same neighbourhood. Successful spawns
and stuck rescues record reuse; clear/new-run resets it. Rescues exclude their own body and keep health. Explicit
debug spawn positions still bypass marker selection. Tests/spawning.test.js covers selection, safety, cooldowns,
round retries, rescue health/occupancy and the real mall at six player positions. Distant-zombie recycling deferred.

New wall guns implemented: Foam Dart Blaster (Mega Mart, 1200 / ammo 600), three-round burst, 45 damage,
3x heads, 24/144 ammo, 0.07s between darts then 0.35s recovery, 1.9s drum-swap reload. Confetti Cannon
(Service Corridor, 1500 / ammo 750), six-shell tube, eight 32-damage pellets per blast (256 point blank: one-shots rounds
1-2, two-shots rounds 3-5), 2x heads, 5.5deg hip / 2.75deg ADS pellet cone, full damage through 6m then linear falloff to
20% at 14m, each pellet goes through a second zombie at half damage, 6/30 ammo, 0.55s between blasts. SHELL-BY-SHELL
reload (`def.shellReload`: 0.4s open, 0.4s per shell, 0.35s close; ~3.2s from empty, ~1.2s for one shell) and firing
interrupts it as soon as a shell is in (shells already loaded stay). Weapon.reloadProgress maps the phases onto windows of
the reload animation (start 0-0.3, ONE shell 0.3-0.7 repeating per shell, close 0.7-1); one load sound per shell. Existing balance numbers and prices preserved. Burst reload requests
wait for the final dart; switching, melee and vaulting cancel remaining darts. Pellet scoring uses the usual
hit/kill payout once per zombie per blast (killing pellet decides head bonus); walls and front bodies stop pellets.
Tracer pool is now 16; max shotgun wall puffs is 4, both in feel.effects. Tests/newGuns.test.js covers burst cadence,
cancellation, queued reloads, pellet damage/headshots/walls/scoring/accuracy, round damage tables, model/sound
registration, the tracer pool, and both real-mall buy/refill spots. The only main.js change adds the ADS-scaled
pellet cone to the crosshair. Built by Codex on codex/new-guns (plan: docs/archive/codex-new-guns-plan.md), integrated into main
alongside the ammo cache (RESTOCK-O-MATIC refills either new gun in hand for its flat price).

Build step 1 is done: start room + concourse, security shutter, pointer-lock look, WASD, jump,
limited sprint meter, wall/obstacle collision, config files, invisible spawn/wall-buy markers.
Added after step 1: crouch (hold C) and slide (tap C while sprinting). Slide locks direction, starts
fast and decays over ~0.9s, has a 1s cooldown, can be jumped out of, and drops into a crouch that stands
up when C is released and there's headroom. Landing/chain slides: jump while sprinting or sliding (or slide off a
ledge) and press C, and a slide starts on landing, skipping the cooldown and sprint requirement. C counts if
tapped in the air, held through landing, pressed up to `slide.chainPressBefore` before the jump, or up to
`slide.chainPressAfterLanding` after landing. Airborne movement never slows you below your current speed
(steering only: turning within 90 deg of your travel direction keeps your exact speed; holding the opposite
way still brakes), so slide-jumps keep their momentum. Chain nerf: each chained (landing) slide in a row, incl.
after a vault, starts slower: 10.5 -> 9.2 -> 8.0 -> 6.8 -> 5.8 -> 5.0 -> 4.5 m/s (floor; past ~5 chains it's slower
than walking); a normal sprint slide is always 100%, and 1s on your feet resets the count (`slide.chainSpeed`, `chainResetSeconds`).
Firing while sprinting drops you to a walk: the running pose snaps away (sprintFx.fireBlendOutSpeed), the shot goes
off after `sprint.sprintOutSeconds` (0.08s from a full sprint; the click is buffered), and sprint can't resume until
`sprint.fireBlocksSprintSeconds` (0.3s) after the last pull (player.blockSprint). Crouch/slide tuning is in
`feel.crouch` / `feel.slide`.
HUD: white health bar above green stamina bar, bottom-left.

Build step 2 is done: staple gun (hitscan, semi-auto, 40 dmg (now 30), 3x headshots, 12/60 ammo, 1.5s reload, R or
dry-click to reload, view kick), first-person model, silver tracer, confetti splatter, wall puffs, hit markers,
ammo HUD, practice dummies in the test range. Only `zombieHealthForRound` from `economy.js` is used so far;
`stats.health` never changes, and there are no zombies, waves, points or death handling.
Added after step 2: hip-fire spread with a dynamic 4-line crosshair, and ADS (hold right mouse): 0.18s eased
transition, spread x0.08, 20% zoom, gun centered with sight just below the crosshair, 75% walk speed.
Player look: last mall employee (red polo, khakis, white sneakers). Hands/forearms on the gun; legs and lower
torso visible when looking down, animated for walk/crouch/slide/air. The body sits `body.backOffset` behind
the camera so you look past the belly; only the lower torso is drawn (a full chest fills the screen).

Build step 3 is done. Shopper zombies (2.0 m/s) rise out of the floor at reachable spawn markers, path to the
player with a flow field (around pillars/benches/planters, through the doorway once the shutter is open), keep
spacing in a crowd, stop at arm's length, block the player, and can be shot (150 HP round 1: 5 body / 2 head
with the staple gun, now 30 dmg) with green/purple splatter, then fall over and sink. Attacks (COD-style, swing
on the way in): start within 1.5m with no wall between (low stuff like counters doesn't block; `wallBetween`), no
braking first; arms-overhead wind-up (0.35s in round 1, shrinking to 0.3s by round 9; `zombie.windupSeconds`;
its last `attack.slamSeconds` (0.1) are the slam, landing exactly when the hit is checked)
while stepping straight at you at full speed and turning fast (attack.turnSpeed 12), then a swing that hits for
40 if you're within 1.7m (a bit past the 1.5m start range = the lunge) and in front (3 hits = dead); 0.8s recovery
after a hit, only 0.3s after a miss (no free reset by stepping back). Standing still, strafing or walking up to
one = hit; backing off or jump-backing from a walker only works if you leave the instant its arms go up (or
earlier), never vs a jogger up close; a quick sprint-away (~0.1s reaction) still works. Player moves slower backwards (70%) and sideways (85%), stats.backpedalSpeed/strafeSpeed,
so retreating while shooting costs you; sprinting away still escapes if you react fast. Health regens after 3.5s at
40/s; red screen edges grow with damage, pulse below 40%, flash on hits. Box cutter (V): 150 dmg, lunge, cancels
reload. Death: camera tips over, "Clocked Out" results (time, round, kills, headshot/box cutter kills, accuracy),
Play again resets the run. Spawning is still debug Z (X clears); round is fixed at 1 until waves (step 4).
Sprint feedback (`feel.sprintFx`): head bob + slight roll (camera only, aim unaffected), the gun drops into a
running pose and swings with steps, and white/dark speed lines streak at the screen edges. Driven by
`player.sprintAmount` (0..1, smoothed) and `player.bobPhase`. Low health (<40%) = strong throbbing red edges.

Controller support + aim assist: Xbox/PlayStation via the Gamepad API. LS move (analog walk speed, click =
latched sprint), RS look (200/140 deg/s, curve 2, turn ramp to +80%), LT aim, RT fire, A jump, B crouch/slide,
X reload, RB/R3 box cutter, Start pause/resume. Prompts follow the last device. Aim assist (controller only,
chest-targeted): slowdown 60% hip / 50% ADS, rotational 15% hip / 25% ADS (only with stick input, full strength
except the outer 30% of the zone), ADS snap 40% within 5 deg (0.6s cooldown); master dial
`controls.aimAssist.strength`. Tested with a simulated controller; feel still needs real-hardware tuning.

Crowd behaviour (fixed chains/stacking/identical paths): measured with a 12-zombie horde through the doorway,
overlap time 53% -> 0%, conga lines 68% -> ~20%, doorway crossing spots 2 -> 8-12, zombies surround the player in
rings (several at arm's length all around), and a crowd can no longer shove the player through a wall (it used to
push you out of the map). Attack difficulty unchanged (same dodge-test results).

Gunplay polish (staple gun, reusable for every gun): camera recoil is a critically damped spring (1.0 deg peak
~35ms after the shot, x0.7 in ADS, back to exactly where you aimed; spamming climbs ~1.1 deg max) plus a 0.3 deg
visual-only roll; the gun model kicks on its own springs (4.5cm back, 7 deg flip, random twist/roll, slight forward
settle, x0.4 in ADS); squeeze lever animates; cartoon muzzle flash (orange burst + white core, ~3 frames) lights the
gun and the room; keyframed reload (gun tips up and rolls to show the staple channel, left hand drops away and
brings a strip, slap-in and snap-shut jolts) with synced sounds; a reload cancelled by the box cutter eases out;
turn sway (~2.5 deg, 0.25 in ADS), walk bob, breathing, landing dip. Synthesized sounds (shot, dry click, 3 reload
sounds) with no audio files. Gun sits a bit closer/higher and angled in so you see its side. Shot, kick, flash and
sound all happen on the same tick and show on the next frame; the crosshair still matches the shot exactly.

Step 4 in progress. Done: part A (map package + zones + doors, see maps/index.js) and part B (rounds and
points): round 1 starts on first play (3s delay), zombies spawn from open zones at the economy pace, the round
ends when all are dead, short break, next round. Zombie HP scales per round; Shoppers pick walk/jog/run gaits
(2.0/3.4/4.6 m/s) from `zombieTypes.shopper.gaitsByRound` (all walkers in rounds 1-2, runners from round 7).
COD payouts; results show round reached + points earned.
BO2-inspired tuning (after part B): wind-up 0.35s -> 0.3s; round number flips the instant the last zombie dies,
6s break, then zombies trickle in (early rounds slower: `spawnDelay.earlyRounds` 3.0/2.6/2.2/1.9s, max alive
5/6/9/12 in rounds 1-4); staple gun 30 dmg; a horde chasing you stays on its own side (behind you) and only
wraps all the way round when you stand still.
Part C done: interaction system (game/interactions.js). Hold F / X for 0.25s near and facing the shutter to buy it
(500): ka-ching, points pop-up, shutter rolls up, concourse zone opens. Not enough points: red cost, shake, buzz.
Controller X near a buyable: tap = reload, hold = buy.
Part D1 done: two weapon slots (COD rules: buying fills the empty slot, else replaces the gun in hand; each gun keeps
its ammo), switching with 1/2, mouse wheel or controller Y (0.18s drop + 0.32s raise, no firing/ADS, cancels
reloads). Price Gun wall buy on the start room's east wall: chalk outline + the gun on pegs; 500 to buy, 250 for
ammo (refills mag + reserve; no prompt when full). Price Gun: full-auto label gun, 25 dmg (x3 head; was 22, buffed after the balance playtest), ~12 shots/s,
24/180, 1.4s reload, bloom grows while held, small pitch + random sideways camera kick, pink sticker flash, its own
model/sounds/reload (swaps the label roll). The staple gun has no ammo refill (by design; maybe an ammo cache later).
Part D2 done (step 4 complete): Nail Gun wall buy on the concourse wall next to Nuts & Bolts (1000, ammo 500; only
offered once the shutter is open). Semi-auto framing nailer: 90 dmg (x3 head), nails pierce up to 3 zombies in a
line (100% / 80% / 60% damage; walls still stop them; +10 points per zombie hit), 10/60, 0.25s between shots, 1.8s
reload, big kick (1.8 deg + sideways wander), tight when you take your time but rushing opens the spread, 28%
zoom in ADS, dust-and-spark flash, pneumatic THUNK + hiss. Round 1: 2 body shots / 1 headshot (one headshot nail
can kill a line of round-1 zombies).

Core movement/combat additions: deliberate momentum vaults and committed box-cutter swings.
- **Vault:** move toward the start room's checkout counter, a Mega Mart checkout counter or a Food Court bench
  (the old concourse benches) and press jump (Space / A).
  Only those colliders are marked `vaultable`; crossing the short side must fit `feel.vault.maxDepth`.
  Requires a standing, grounded approach, suitable height/speed, full standing-body clearance and a
  supported, unoccupied landing. Raises before the near edge, crosses above the top, lowers beyond
  the far edge, and exits with the entry horizontal speed (no added speed). Horizontal speed is constant the
  whole way (the rise takes near/speed, min one tick; the drop covers `landingDistance` at full speed), so a
  vault never slows you (measured: sprint 8.00, walk 5.00, slide-in 10.3 m/s in, during and out). C / B during the vault
  queues the existing landing slide. The whole path is checked before starting and again every tick;
  a crowd shove or newly blocked path interrupts it. No invulnerability. The shutter cannot be vaulted.
  The gun lowers, ADS/shooting/reloading/switch input are blocked, and a reload in progress PAUSES
  (gun.update(dt, blocked, reloadPaused) -> weapon.update({ reloadPaused })) and carries on after.
  Forgiving trigger (sprinting/walking at it + jump = vault): a press with a vaultable obstacle on your path
  within `magnetRange` 3m holds (up to `magnetSeconds` 0.4) and vaults once in `reach` (1.7m) instead of
  jumping early; a jump that started < `airGraceSeconds` 0.2 ago still turns into a vault in the air; your
  path can cross up to `maxApproachDegrees` 75 off straight-on, and where you LOOK barely matters
  (`maxLookDegrees` 100); a blocked straight landing tries paths angled `directionSearchDegrees`
  (0, +-12, +-24). From 1.5 m/s. HUD "[Space] Vault" prompt (vault.preview(): the full plan checked from
  where you'll be when in reach) whenever a press would vault. `vault.lastResult` says why the last try failed (or
  "vaulted") for testing in the console. Animation: a speed vault: both legs swing up and out to one side over it (body.js,
  feel.body.vault*), and the view dips/tilts so you see them (controller.syncCamera, feel.vault.camera*;
  visual only, the gun is tucked away anyway).
  Tuning is `feel.vault`; `stats.vaultMaxHeight` and `stats.vaultMomentumRetention` are player modifiers.
- **Committed melee:** V / RB / R3 fixes the attack direction at swing start. Until the 0.15s impact,
  turning is limited to +/-12 degrees and new jumps/slides/steering are blocked (existing motion continues).
  Hit range, target life and walls are rechecked at impact, so a target can evade the slash. Movement returns
  at impact; gunfire/reload/switching/another slash wait until 0.37s on hit or 0.65s on miss. Inputs during
  recovery do not queue another slash. Lunges keep some entry speed on exit (85%, at least the existing
  stationary-lunge carry), end at impact, and use normal collision. Damage and points are unchanged.
  No melee starts during a vault or weapon switch. Teleport/reset clears pending actions.
  Timing/turn limit live in `melee.boxCutter`; entry carry is `stats.meleeLungeMomentumRetention`.
- **Checks:** `npm test` covers vault paths/landings/momentum, interruptions, existing jump/slide behavior,
  melee commitment/hit validation/recovery, weapon blocking, and reset/pause behavior. Browser smoke checks
  also verified the actual counter/three benches, shutter purchase, both wall buys, and a real-zombie lunge.

Settings screen: pause screen > Settings (video: FOV, FPS counter, render scale; mouse: sensitivity, invert Y, slower when
zoomed; controller: look speed, invert Y, deadzone, aim assist; audio: master volume; comfort: head bob, speed lines).
"Reset this tab" restores defaults. Adding more: see config/settings.js.
Health regen nerfed slightly: 3.5s delay (was 3), 40 HP/s (was 50; empty to full ~2.5s).

Step 5 in progress. Done: the Mall Walker (round 4+). A power-walking retiree in a matching tracksuit (stripes,
headband, wristbands, white sneakers, silver hair, maybe a fanny pack), slimmer than a shopper (model + hitbox).
5.4 m/s always (outpaces your walk 5 and backpedal 3.5, not your sprint 8), 65% of the round's health (round 4:
244 vs 375), same 40-damage slam and wind-up, same 60-point kill value. Winded after every swing (hit or miss):
stands bent over panting for 1.2s (no attacks), then follows at half speed for 0.6s: your opening. Squeaky
sneakers + huffing while chasing, panting when winded (louder when close, silent past ~12-14m). Spawn mix: 15% of
spawns from round 4, 25% from 6, 30% from 9 (part of the normal count); in its first round the 3rd spawn is forced
to be one if none came yet, and its first spawn in a run plays the PA chime + "Attention shoppers / Mall Walkers
have entered the building" banner. Debug: Shift+Z until it is selected, then Z spawns one. Verified in the browser (looks, power walk, a real
hit + winded pose, round-4 banner) and by tests/zombies.test.js.

Map expansion (before Cart Pusher / Mannequin / shop systems). Done earlier: map kit (world/mapKit.js) + mall
props/palette split out of mall.js (verified identical), doors can share a zone, the nav grid rebuilds on any marked
collider change; the Mega Mart + its 750 door.
REVISED PLAN (hub layout): the start shutter opens into a new MAIN HALLWAY (hub); Mega Mart (750), Food Court (1000)
and Service Corridor (1250) are each bought off it in any order; the hallway also gets an escalator + elevator
(sealed: "out of order" / "service only") as the way up to a second floor later; the Service Corridor is built from a
modular segment list so it can be extended. Steps: 1) hallway + the concourse becomes the Food Court (DONE),
2) escalator + elevator, sealed, 3) Food Court dressing (stalls, tables), 4) corridor segment builder, 5) Service
Corridor + 1250 door, 6) optional loop shortcuts (Food Court <-> Mega Mart, corridor <-> Food Court).
Step 1 done: hallway hub (see Map), the old concourse moved south as the Food Court behind a 1000 door, Mega Mart door
moved to the hallway's east end, Nail Gun wall buy moved onto the hallway wall (so it's still available right after
the 500 shutter). Verified: tests/mall.test.js (each area sealed until its own door is bought, in any order; Nail Gun
spot reachable after the start shutter; reset seals everything) and in the browser (real F-hold buys the start
shutter, the hallway/Food Court/Mega Mart look right, zombies reach the hallway from the Food Court in ~8s and from
the Mega Mart in ~10-14s).
Step 2 done: the escalator + elevator, both sealed (see Map). Verified: tests (sealed against a real sprint-jumping
player, walk-under clearance, ceiling open only above the escalator, the level-2 landing closed in, elevator wall
solid) and in the browser (escalator, hole + landing and elevator look right; zombies route round and under the
escalator and never leave the floor). Making them usable is step 7 (second floor, multi-floor navigation).
Step 3 done: Food Court dressing (see Map). Verified: tests (every stall queue spot + table lane reachable, nothing walkable
behind the counters, counters out of jump reach, a real player sprint-jumping at Burger Barn stays on the floor) and in
the browser (stalls, awnings, tables look right; zombies weave through the tables to the stalls and out to the
hallway in ~7-8s and never climb). Known nit: from the door the tree planter hides most of WOK THIS WAY's sign.
Step 4 done: the modular corridor builder (world/corridor.js + kit.corridor; no change to the map yet). Verified:
tests/corridor.test.js (straight / L / zig-zag / U-turn shapes: no floor overlaps, no wall pieces in the walkway, sealed on
every edge and corner; doorways + lintels, shared-wall gaps, open ends and branches exactly where asked; a real nav grid
walks a corridor end to end and through a branch doorway), and a throwaway sample corridor rendered in the browser.
Found + fixed while building it: walls extended at INSIDE corners poked a post into the walkway (now outside corners
only); an open end left no floor under the doorway it joins, so the nav grid couldn't cross (now the floor reaches
through); wallSegments stretched a wall when an opening hung off its end (openings are clipped now).
Step 5 done: the Service Corridor + its 1250 door (see Map), built with kit.corridor. Verified: tests (1250 in the
door ladder; sealed until bought, in any order; every part reachable after, lockers solid; no back way into the Food
Court through the shared wall; a real player walks in through the doorway to the dead end) and in the browser (a
real F-hold buys it for 1250; doorway + sign and the corridor's dressing look right; zombies from its 3 spawns reach
the hub in ~8-12s and never climb). The hub layout is now complete: start room -> hallway -> Mega Mart / Food Court /
Service Corridor, in any order.
Codex audit fixes, in steps: 1) light budget (SHELVED, see below), 2) sign textures cached + sized to the sign (low value on
a dedicated GPU), 3) merge static map meshes (fewer draw calls; low value for now), 4) no buying through walls (DONE),
5) map dispose removes its colliders + frees GPU memory, wall/corridor builders reject overlapping openings / self-crossing
corridors (DONE).
Step 1 shelved: a pool of 4 real point lights moved to the nearest lamps (world/lightPool.js) halved frame time on Intel
integrated graphics but made no difference on the user's NVIDIA card (Firefox), so it's in `git stash` ("step 1: light
budget"), not in the game. The "big circles on the ceiling" the user saw were the lamps themselves (hung 0.8m under the
ceiling = a hard bright disc); fixed by hanging lamps at ~60% of ceiling height with matching intensity (see Map > Lighting).
Step 4 done: buy spots need a clear line from the eye and 3D range (interactions.js; main passes `colliders`, doors pass their
shutter as `seeThrough`; shutter exposes `collider`). Fixes: the Nail Gun could be bought from the Food Court through the
wall; a second floor would have reached ground-floor buyables. Verified: tests/interactions.test.js (7) and in the browser
(real held F buys the start shutter and the Nail Gun; no prompt behind the wall).
Step 5 done: kit.dispose() (map.dispose calls it): unloading left all 117 colliders behind (a reload doubled them into
invisible walls) and never freed GPU memory; now the shared list is back to exactly what it was and every geometry/material/
texture is freed (tested, incl. reload). wallSegments throws on overlapping openings (one doorway's lintel used to hang into
the other); corridorLayout throws on a self-crossing loop or runs too close together (both used to build overlapping floors /
walls). None of these were triggered by the current mall; they protect future maps and rooms. Steps 2-3 remain optional.
Ammo cache done (first of the "flesh out the new areas" items): the vending machine above. Verified: tests/ammoCache.test.js (5) and
in the browser (real held F refills the staple gun for 400; no prompt when full, far away, or from the Service Corridor side of
the wall). Cover/funnels remain optional; loop shortcuts and the two new guns are in (see the top of Current state).
Step 6 done: loop shortcuts (Food Court <-> Mega Mart, Service Corridor <-> Food Court); see Map and the top of Current state.
