# Sunset Galleria: the map, area by area (coordinates, doors, spawns, buy spots)

> Moved out of CLAUDE.md (verbatim) so the file every session loads stays small. Read the entry for the area you are working in. CLAUDE.md has a one-screen summary.

The start room opens into a MAIN HALLWAY (the hub). Buy each destination once, through any accessible entrance.
Connections open automatically and free when both adjoining areas are unlocked; a shutter never grants its neighbours.
Prices (category `door`, keyed by area): hallway 500, Mega Mart 750, Food Court 1000, Service Corridor 1000,
HOFFMAN'S 1250, Grand Atrium 1250, Promenade/upstairs 1250, Cinema 1250, Customer Parking 1250. Nine purchases fully connect all 15
barriers for 9500 points. Door Flash Sales apply to the destination price; prompts show the destination name.
Start Room is owned initially; Play again restores that state. Debug O opens all areas, or resets all when fully open.
- Start room: x -5..5, z 6..16, 4m ceiling, checkout counter, shelf, crates, boarded vents (and, decoration only: a slatwall of leftover stock on the
  east wall at z 13..15.4, SALE bunting across the ceiling at z 9 and 12.8, a FINAL WEEK sign hung over z 11). Its 4m doorway at z=6
  is blocked by a security shutter door (500) that opens the hallway. Hold **F** (controller: hold **X**) near a
  door to buy it. Debug: press **O** to open all doors for free; if all are open, O closes them all.
  Dressed as a picked-over clearance store: register/receipt/bags at the left end of the vaultable checkout,
  open shelves with a few products and dusty stock outlines (original collision footprint), framed dark boarded vents,
  sale/tape remnants, missing employee photo, FINAL MARKDOWN pricing station around the Price Gun, restrained perimeter
  floor litter/scuffs, damaged dead ceiling fitting, warm checkout / cool shutter light. Central lane and both spawn bodies stay clear.
- Main hallway: x -20..20, z -2..6 (8m wide), 6m ceiling. Doors: Food Court (1000, south wall x -3.5..3.5, a 7m gate, straight
  across from the start door, under a FOOD COURT sign, framed by two planters), Mega Mart (750, east end z -1..5, 6m,
  under a MEGA MART sign), Service Corridor (1000, west wall z 0.5..3.5, under a "STAFF ONLY"
  sign; the escalator's high end runs overhead just short of it). 3 boarded vents (zombie spawns).
- Kiosk Kevin has five carts (config/kiosk.js `sites`; one live, the rest say BACK IN 5 MIN). Each is a 2.2 × 0.75 m
  footprint: a 1.05 m counter under a canopy, ONE collider solid from the floor to the roof (kiosk.cart.roofY + roofThickness, not vaultable), and three labeled buy spots along its front. He opens
  from round 2 at the first, on the Hallway's south wall (x −9.6..−7.4, z −1.96..−1.21, facing +Z), and moves at
  each round start after that to another open site: Food Court (x −4.3..−2.1, z −6.875..−6.125, facing the gate, 4.6 m
  west of the Fryer apron), Grand Atrium (south arcade west of the Hallway gate, x 8.04..10.24, z 6.64..7.39, facing
  +Z), Sunset Promenade (east lounge, x 11.9..14.1, z −1.875..−1.125, y 6.3, facing the Atrium link) and Customer
  Parking (against the family van's east side, straddling the bay 0 / bay 1 line at x 43.0, x 42.555..43.305, z −12.15..−9.95, facing +X).
  The pay-to-trigger Fire Sprinklers pull station `sprinklerHazard` sits on the same south wall at (-6.6, 1.25, -1.95) facing +Z, between Kevin's Hallway cart (x -9.6..-7.4) and the planter (x -5.9..-4.5), under the notice poster (600 via `g.pricing`, drenching `x: -12..12, z: -2..6`). Out of reach from the Food Court gate (x -3.5..3.5), so the gate keeps its own prompt; the small red fire pull decal at x -3.9 by the gate is decoration.
  Escalator (SEALED until Hallway and Promenade are owned): west half, z 1..3, bottom end at x -4 facing the hub, rising west at 30 deg through a hole in
  the ceiling (x ~-16.5..-11.95) to level 2 (y 6.3, the top of the ceiling slab; see Level 2 below). Rope barriers + OUT OF ORDER boards at both ends disappear automatically when Hallway and Promenade are owned, including access via Atrium or Cinema; every collider you could
  reach from the floor is taller than a jump. Its low end (x -4..-10.4) is solid to the floor; under its high end
  (x -10.4..-17.5) there's >= 2m headroom, so players and zombies walk under it. Elevator (SEALED): doors in the north
  wall at x 10.5 (taped off, OUT OF ORDER, floor indicator "1", call button); painted on, the wall behind is solid.
- Level 2 (the Sunset Promenade; zone 'upstairs', unlocked for 1250 through any entrance): x -20..20, z -4.5..6,
  floor y 6.3, ceiling 9.9. You step off the escalator into a 2.5m west lobby; the escalator well (x -16.5..-11.95, z 0.7..3.3) is fenced by
  railings on its north, south and east sides. The southern passage gained 2.5m; the balcony holes and central bridge are unchanged.
  SHOE-PER SALE x -10..-4 is a real store extending north to z 11.3, with 2.1m entrances x -9.8..-7.7 and -6.3..-4.2,
  shoe shelves, fitting mirror/bench and a vaultable 0.65m display island. PRETZEL PALACE x 4..10 remains closed.
  Eastern lounge: a low 1.1 x 0.8m sunset-medallion plinth at (14.2, 1.6) replaces the tree/bench enclosure; benches hug the south,
  east and north perimeter, leaving routes round both sides and a clear Atrium-shutter approach. Directory on the south wall,
  east-wall payphones, magazine rack, upholstered seats and a backlit ceiling feature identify the junction. Southern benches, signs and two southern vents follow the
  new wall; all four existing upstairs spawn markers remain (east z 4.2, north x 16). The west connection (z -4.1..-1.7)
  now leads through the 1250-point Cinema area entrance. The east connection remains sealed for expansion.
  Main floor and annex are sections in config/promenade.js, independent of the hallway; navigation/grade follow the upper sections.
  Concourse pass (config/concourse.js): a shopfront run on the south wall, CASSETTE CITY x -4.1..1.0, GLAMOUR PORTRAITS 1.4..7.2,
  EAR-RESISTIBLE 17.0..19.8 (gate shut), and KEYS CUT x -12.5..-10.25 on the north wall; fronts stand 0.26 m off the wall, no colliders.
  Soffits (bulkheads) along both long walls from 3.0 m, 1.0 m deep (north gap x -3.7..3.7 for the Build-A-Blaster front), the pink
  trim on their front edge; the "Sunset Galleria · Level 2" sign is on the south soffit face. Ashtray urns (solid, 0.63 m) at
  x -9.3, -6.7 and 14.9 by the south benches; a mop bucket (solid, 0.45 m) at (-19.2, 5.2); garland on the void rails' walkway side.
  BUILD-A-BLASTER is a walk-in workshop, part of the Promenade zone. Storefront: interior x -3.35..3.35, z 6.3..11.7, two entrances flanking a solid
  glass display, parts cubbies down both walls (west: the Stuffing bins on the bottom shelf, lit while in today's stock; east: the Heart wall), the order bench in the middle (x 0, z 9.4..10.28; prompt z 9.25) with a 1.8 m lane either side.
  Back hall (section 'workshopHall'): interior x -9.5..4.9, z 12..26.5, 4.8 m high, reached through a 6.7 m wide, 3.2 m high mouth. It sits on its
  own slab over HOFFMAN'S and the start room; the east wall stops at x 5.2 because the Atrium's exterior wall starts at 5.27. The island
  (x -6.1..0.5, z 15.7..22.3) is the Stuffing Tank (centre -2.8, 19) plus a U-shaped conveyor open to the east, behind a glass guard: one
  bullet-through collider 2.2 m high, so nothing inside can be reached. A gantry carries the gun from the end of the belt over the east lane to the booth's counter, above head height, and it comes back to your hands from there.
  Detail pass (maps/mall/workshopDetails.js): storefront skins wall (west) and heart shelf (east), till on the bench, footprints, window decals and balloons;
  hall hoppers on the north wall piped to the tank, QC desk inside the island, lockers + time clock (east wall, z 12..13.4), bales (SW corner), laundry cart (NW corner),
  returns bin (x -5.3..-4.7 under the hoppers), plush pile and portraits (NE). Solid: lockers, bales, cart (2.2 m) and the bin (0.7 m, vaultable).
  Hold F at the bench for the order form; the bins, Heart wall and lever are scenery now (the bins still light up for today's stock, the lever drops when an order is done). Lanes round it are >= 3 m. Naming Booth on the east wall (z 20..23.2), lever
  further south on the same wall (z 16.8), Returns Chute hatch in the north wall (x -7; its three spawn spots are not in map.spawnPoints, the ritual steers to them). The Limited Editions
  shelf behind the display window is empty: they drop from zombies now. Debug Y teleports to the bench. Pretzel Palace remains closed but has a scenic warmer/counter/menu/grille. Shoe-store
  tickets/fitting shoes and two-sided hanging directional signs complete the pass. No new weapons or spawn markers.
  The elevator stays sealed. Data is exposed through LAYOUT.level2; see mall/levelTwo.js, promenadeShop.js and promenadeDetails.js.
- HOFFMAN'S · Est. Forever (zone 'departmentStore', maps/mall/departmentStore.js): the department store north of the hallway's
  west half, x -20..-5.3, z 6.3..26, 5 m ceiling; the cinema is west of it (x -42..-20.3), while Level 2's Shoe-Per Sale (x -10.3..-3.7, z 6..11.6) and Build-A-Blaster workshop hall (x -9.8..5.2, z 11.7..26.8) sit at y 6.3 above its east side.
  Gate (1250) in the hallway's north wall at x -19.5..-15.5 under a HOFFMAN'S neon; side door 'departmentStoreStartRoom' (1250)
  through the start room's west wall at z 11.6..13.5 (the start room's only second exit: buyable before the start shutter).
  Front: cosmetics + fragrance counters (vaultable); middle: six round racks and three mannequins; back: fitting rooms (a
  spawn out of the middle curtain), LAYAWAY counter (vaultable), shoe wall; stockroom door + west vent spawns. Collision rule:
  counters 0.95 m and vaultable, everything else >= 2.1 m (a counter-top jump peaks ~2.0 m). Cream/burgundy/brass look,
  ALL SALES FINAL. SO ARE YOU. The hallway's north-west vent moved to x -7 and the directory over it for the gate.
  Detail pass: each of the six racks is a department (COATS, DRESSES, BUSINESS CASUAL, MARKED DOWN FROM FOREVER with price tags, KNITS,
  a nearly bare NEW ARRIVALS) with a two-sided sign; folded-knit shelving on the west wall (z 7.7..12.9) and layaway bags on the north wall
  (x -13.9..-10.2), both solid 2.2 m; the middle fitting room's curtain pulled aside onto a mirror, the east booth taped off, scratches on
  the west curtain; a full-length wall mirror, wall busts, brass-edged beams with a hung EVERYTHING MUST STAY banner, sprinklers, diffusers;
  a tipped mannequin, a dropped bag, a lone shoe, packing peanuts; muffled music + air handling (existing ambience voices).
- Sunset Cinema (zone 'cinema', 1250-point area unlock off the Promenade's west wall at x -20.3..-20, z -4.1..-1.7):
  floor y 6.3, 4.8m ceiling height. Lobby x -42..-20.3, z -10.5..5.5; flat Screen 1 x -42..-24, z 5.8..27.8;
  projection passage x -23.7..-20.3, z 5.8..27.8. A 3.4m auditorium doorway and 3m passage entrance connect to the lobby;
  a 3.4m crossover at z 22..25.4 closes the loop. Four low seating blocks leave side/central aisles, a middle crossing and
  a broad front fighting floor. Seats remain vulnerable to zombie attacks; the low lobby display is vaultable. Concessions
  and ticket cases are enclosed/solid to their visible glass height. Screen 2/3 stay sealed.
  A west service stairwell now descends to the Service Corridor's north end (see below).
  Six local upper-floor spawn markers unlock with either cinema entrance.
  Plum carpet, brass, curtains, neon, fictional movie posters, slow locally drawn advertising slides, faint projector beam,
  projector/refrigerator/ventilation ambience and a quiet periodic projector relay, two pooled lamps, three culling rooms
  and three color grades (warm lobby, dark screen, readable cool service). Stepped cornices, coffers, steady marquee,
  detailed popcorn/soda/slush equipment, box-office printer/showtimes, acoustic ribs/speakers, numbered seats/cupholders,
  authored coats/drinks and sparse litter complete the detail pass. No new guns or balance changes.
  Data: LAYOUT.cinema (config/cinema.js); modules mall/cinema.js and cinemaDetails.js. Play again closes/resets the entire wing.
- Cinema Service Stairs: from the lobby's west doorway x -42.3..-42, z -8.8..-5.6, through a 3.7m-wide stairwell
  x -46..-42.3 down from y 6.3 to y 0; a 3m-wide return passage at z 7.1..10.1 joins the north end of Service Corridor
  through a 2.6m shutter (cinemaStairs, destination price, x -23.1..-20.5, z 3.5..3.8). From Service Corridor it offers Cinema (1250); from Cinema it offers
  Service Corridor (1000). Once both are owned the connection is free. The Cinema/Promenade shutter similarly offers
  the unowned destination (1250 either way). Owning Hallway and Promenade automatically repairs the escalator. Smooth ramp collision under 36 visible treads supports walking/sprinting/sliding; broad
  plateaus, solid under-stair support, wall-mounted handrails and wayfinding leave no climbable side refuge. The existing
  Cannon, lockers and Food Court shortcut stay where they are. No additional spawns or real lights; painted glow follows
  Neon glow. Projection equipment, maintenance signage, overhead pipes/cables, landing numbers, delivery/cleaning scenes
  and concrete wear decorate existing surfaces without shrinking routes or adding lights. Data: LAYOUT.cinemaStairs.
  Both floor landings and the link reset/unload with the map.
  Second cinema detail pass: projection corridor has tiled lower walls, continuous conduit, guarded light housings, a shallow
  rewind bench with transport cases and an air-handling panel. Return corridor adds blockwork, ceiling channels, meters,
  delivery dockets and cleaning records; stairwell adds concrete joints, utility conduit and painted lower wall.
  Lobby adds waiting seats, premiere banners, framed entrances/posters, carpet borders and concession cabinet/packaging;
  Screen 1 adds broad fabric panels, continuous side-wall aisle strips, a curtain pelmet and chamfered seat silhouettes.
  All are map-owned decoration. Existing movement/vent/vault clearances, collision, lighting pool and purchases are retained.
- The Grand Atrium (zone 'atrium'): x 8..32, z 6.6..30.6, behind a 5m gate (area unlock 1250) in the hallway's north wall at x 13..18 under a
  GRAND ATRIUM sign. Concourse pass: a kiddie ride (solid, vaultable 1.1 m) at (9.3, 18.6) and a gumball machine (solid 1.1 m) at (9.3, 19.75), between
  the west vent (z 16) and the Rivet Rifle; a directory totem (2.2 m) at (10.6, 8.4) inside the gate; sun shafts from the skylight. Two storeys (roof 9.9 under a big warm skylight): an open court x 11.5..28.5, z 10.1..27.1 with a square
  fountain (glass guard, solid to 2.2m, with the pay-to-trigger Electrified Fountain breaker switch `fountainHazard` on its south rim at (20, 1.28, 15.92), 750 via `g.pricing`) in the middle, CELL-OUT and SHADE SHACK kiosks, four tree planters, three benches; a 3.5m arcade
  round the edge under the UPPER RING (y 6.3), which is railed all round the court. A second escalator rises east from the court
  (x 16.5) to the ring's east side. The ring's south wall has the 'atriumPromenade' shutter (destination price,  x 11.5..14.5) into level 2.
  Five spawns: four ground vents (north x 13 / 27, west z 16, east z 12) and one on the ring's north wall. Data: LAYOUT.atrium.
  Twelve non-enterable shops on both floors have 2.35m interiors beyond cut wall openings: fashion, beauty, luggage, televisions,
  portraits and vacant fit-out units. Continuous glass colliders seal all windows and locked entrances; no new navigation or buys.
  Floors, ceilings, rear/side walls, stock, counters and luminous fixtures are scenery, with shared lettering for batching.
  Quiet horror details: Second Skin's mannequin head can turn after a sighting and an extended look away; TV stores can share
  an empty-concourse feed, and an upstairs vacant unit has a brief distant silhouette. The locked ground vacant unit contains
  an abandoned lunch and off-hook phone; upstairs footprints lead toward an empty display. Sparse phone/cart/footstep sounds
  use the existing spatial ambience and wall occlusion. Comfort > Horror effects disables anomalies; new runs restore them.
  Look pass (November 2026): the ground floor's south wall (z 6.6, shared with the hallway) has three framed sunset murals at y 3.3..4.8
  (x 8.4..12.65, 18.35..21.15, 24.85..31.6; maps/mall/atriumMurals.js), benches at x 18.6..20.9 and 29.6..31.7 (z 6.72..7.22) and a tree planter
  at x 28.4..29.3 under them (config/atrium.js southWall). SUNSET GALLERIA between the two suns on the north upper wall is neon. Plum border
  bands run along both long sides of the upper ring (config/concourse.js floor.bands).
- Food Court: x -20..20, z -14.3..-2.3, 6m ceiling, behind the 1000 shutter: the old concourse moved south (its four
  shops Good Sports / Nuts & Bolts / Play Time Toys / Byte Me are real stores now (see below), 2 pillars, 2 benches (north side), tree planter,
  end planters, ceiling lights, 4 spawns), placed relative to its center line FZ = -8.3. Three food stalls along the
  south wall between the shops: BURGER BARN (x -8.4..-3.1), WOK THIS WAY (-2.6..2.6), CORN DOG CORRAL (3.1..8.4, with the pay-to-trigger Fryer Blast valve switch `fryerHazard` on its front counter at (5.75, 1.05, -13.0), 750 via `g.pricing`, venting scalding oil across the grease apron `x: 2.5..9.0, z: -13.0..-6.5`); each
  is solid from the wall to its counter front (z -13.0), 1.2m tall, so you can't get onto or behind it. Eight round
  table sets (tables 0.75m you can hop onto via the 0.45m stools) at x +-9 / +-5.5 around the tree planter, leaving
  table lanes, a clear lane from the door to the planter and room to queue at the stalls; two trash cans (x +-11.2);
  an "EXIT · MAIN HALL" sign over the door inside.
- Mega Mart: x 20..34, z -24..6, 5m ceiling, behind the 750 shutter. Its west wall (x 20..20.3, 6m tall) is also the
  east wall of the hallway (door at z -1..5) and of the Food Court (shortcut at z -10.8..-5.8). Its north wall (z 6..6.6) has a third
  shutter, into the Grand Atrium at x 21.5..24.5 (3 m high, GRAND ATRIUM / MEGA MART signs; door `atriumMegaMart`): free once both areas
  are owned, else the price of the side not yet bought. Front: 4 checkout
  lanes (vaultable counters, x 24.5..27.5, 2m lanes, open ends to run round). Back: 3 stocked shelf gondolas
  (x 24 / 27.5 / 31, z -19.5..-8, solid, 2m tall) making 4 aisles, a 4.5m back walkway with stockroom/receiving
  doors + a boarded vent, an emergency exit on the east wall. Brand stripe, aisle signs, fluorescent strips (some
  dead), 2 point lights.
  Detail pass: recognisable Outdoor / Snacks / All Holidays / Housewares stock inside the original shelf footprints,
  looted stretches and shelf tickets, groceries/receipts/bags at register ends (vault lanes clear), receiving hardware and
  delivery/safety notices, TRY BEFORE YOU BUY Foam Dart promotion, dropped basket within a gondola, perimeter spill/scuffs,
  a solid parked trolley by the east wall at x 33.43..33.91, z -5.90..-5.08, framed fluorescent fittings. The two lamps now
  separate warm checkouts from cool aisles; no flashing. Entrances, crossings, spawn spaces and four main aisles stay clear.
  Overstock racks bolted high on the side walls (decks at y 3.0 and 3.72, nothing below 2.9 m): east wall z -9.6..-3.1, west wall
  z -14.8..-11.1 and -5.6..-1.3, each with a department sign at y 4.62 (megaMartDetails.js MART_FIXTURES.overstock).
- Customer Parking (zone `parkingLot`, 1250): outside Mega Mart's east wall, x 34.3..62.3, z -24..6, ground y 0.
  Closing Time's Last Customer enters at spawn_parkingLot_deliveryGate (39.3, 0, -22.8); her quota-funded Mall Walker backup uses the four existing safe lot markers. Her shared charge crashes into the solid vans. No new map entry or collider.
  The parking-validation ticket machine is mounted on the mauve van's west flank (x 53.8, z -11.05, prompt x 53.67), opposite its east-side start prompt. It stays within bay 4, adds no collision, and leaves the gaps, exit approach and four fence spawns clear. Both interactions belong to escapeVan.
  Realism (config/parkingDetails.js realism): accessible bay = bay 1 (x 43..46.5), cart corral in bay 5 (solid, vaultable 1.0 m;
  the gaps between the vans are combat lanes), a stray cart (solid), row letters and banners on the two light poles, a kerb island
  x 37.6..39.3, z -14.9..-7.2 (0.15 m step) with a young tree, an entrance vestibule x 34.45..36.25, z 0.3..4.7 (solid glass sides).
  Landmarks (config/parkingDetails.js landmarks): the mall's pylon sign inside the east fence at x 61.95, z -16.5 (two solid posts 9.2 m,
  neon name and sun above the fence), SUNSET GALLERIA in neon on the facade at z -18.6, y 4.95, gloss over the painted puddles, four
  cones by the south fence (decoration), and a box truck along the south fence x 43.6..50.2, z -23.65..-21.25 (solid, cab 2.25 m, box 2.75 m),
  clear of the south lane and the delivery-gate and south-fence spawns.
  The former emergency exit is a real 3m shutter at x 34..34.3, z 1..4. A flush sidewalk connects it to the asphalt;
  one parking row has three abandoned family/delivery vans, empty bays and broad lanes around both ends and sides.
  Vehicle bodies are solid to their visible tall roofs, preventing an unreachable camping spot. A 3.4m metal fence
  closes the other three sides; its boundary stops movement while bullets pass between the drawn bars.
  Four ground spawns along the north/east/south boundaries activate only after purchase. The former Mega Mart
  emergency-exit spawn now uses a boarded east-wall vent at (33.2, 0, -2), keeping the threshold clear.
  RV positions derive from alternate bay centres, with visible clearance inside the painted lines. An opaque exterior shell
  closes the Atrium above/beyond Mega Mart, including its roof and corners; it stays visible when interior rooms are culled.
  Beyond the fence: a marked road/intersection, sidewalks, planted verges, REWIND VIDEO / LAST STOP DINER / ETERNAL AUTO,
  distant buildings/cars, utility poles/wires and the SUNSET GALLERIA pylon. All are scenery without colliders or extra real lights.
  Detail pass: cracked/patched asphalt, worn paint, tyre/engine marks, puddles, two grates and kerb weeds. Three rear-row
  scenes: trolley/groceries near (42.5,-15.2), unfinished delivery near (48.1,-15.7), chair/drink/suitcase near (56.1,-15.7).
  Trolley and chair have vaultable collision; the shallow 2.2m power cabinet at (34.7,-20.6) is solid. Main front/rear lanes,
  central gaps, exit approach and all spawns remain clear. RVs add plates, wipers, mirrors, curtains, vents/aerials, travel
  stickers, dirt and one damaged light/boarded rear window. Facade adds downpipes, grilles, cameras, notices and roof ducts.
  Bus shelter at (68.4,17), bins, street names, roadworks and a stopped car extend the street scene; shop windows glow warmly.
  Painted lamp pools and distant haze add dusk depth; ambient-effects off hides haze and stops the loose sign's movement.
  Traffic/tree loops, an exit music speaker, cabinet hum and occasional rattle/PA/traffic sounds are spatial and unlock-gated.
  Data: config/parkingDetails.js; builders parkingDetails.js / parkingStreetDetails.js with shared parkingDetailKit.js.
  Sunset sky, exterior facade/return signs, two pooled pole lights, painted bays/crosswalk, wind and electrical buzz.
  Includes a culling room/portal, color grade, horror area and benchmark shot; Play again relocks it and map unload
  frees its geometry, textures, lights and colliders. The mauve van's east-side hold prompt is near (56.57, 1.2, -11.05).
  Starting it is free once all four keys are held, the first three duties are complete, Parking Validation (5000) is paid at its west-side machine, and the Last Customer is defeated. Data: config/parkingLot.js and config/closingTime.js;
  builder: maps/mall/parkingLot.js.
- Service Corridor: behind the 1000 area entrance, a 3m-wide back-of-house corridor built from a data spec with the
  corridor builder: in through the hallway's west wall (floor reaches under the doorway), a 1.5m run west, then 16m
  south along the Food Court's west side to a dead end at z -14 (x -23.3..-20.3, 3.5m ceiling). Its east side is the
  hallway's and Food Court's own west walls (noWall); the Food Court wall contains the shortcut at z -13.4..-11.
  Dressing on its west wall: EMPLOYEES MUST WASH HANDS sign, two boarded vents (spawns), an electrical panel
  with a DANGER · HIGH VOLTAGE sign and the pay-to-trigger PA System Lure paging switch `paLureHazard` at (-23.1, 1.35, -4.5) facing +X (500 via `g.pricing`, broadcasting a 10 m clearance lure around (-21.5, -4.5)), a bank of lockers (solid, narrows it to ~2.5m), exposed pipes the whole way;
  boxes + a vent (spawn) + NO LOITERING (ESPECIALLY THE UNDEAD) at the dead end; three ceiling strips (middle one
  dead), two warm point lights. Concrete-look floor, drab walls.
- Loop connections (ordinary security shutters; buy the unowned destination, free when both are owned):
  Food Court <-> Mega Mart (destination 1000 / 750), x 20..20.3, z -10.8..-5.8 (5m), height 3m, centered FZ = -8.3, signs MEGA MART / FOOD COURT.
  The east-end planter is split around the opening; clear approaches lead into the Mart's 3.2m west aisle.
  Service Corridor <-> Food Court (destination 1000 either way), x -20.3..-20, z -13.4..-11, height 3m, opposite the cannon at z -12.2;
  STAFF ONLY / EXIT · FOOD COURT signs. Lockers stay at z -11..-9, with 2.55m clear corridor width alongside/past them.
  The west planter, RESTOCK-O-MATIC and cannon buy spots are unchanged. The cannon is out of buying range from the Food Court.
  Main loop: hallway -> Food Court -> Mega Mart -> hallway. West loop: hallway -> Service Corridor -> Food Court -> hallway.
  Area ownership controls spawns and shops; Play again closes every shutter and seals all outer areas.
- Customer Service has three windows along its counter, each with its own sign and buy spot (the nearest one you face wins): Extended Warranty in the
  middle (x 7), SHARPENING at x 8.25 (box cutter tiers) and SECOND CHANCE at x 5.75 (the start-doorway end: one self-revive per run, 2,000,
  game/secondChance.js). The Second Chance ticket only shows on its own side of the middle and stays up once bought ("Already held" / "Used this run").
- The Night Safe mounts 2 cm proud of Customer Service’s east wall at x 8.8, centered at z 5.12 and facing east. Approach from the elevator side.
- The Returns Desk mounts on the hallway north wall east of Customer Service at x 11.8, facing south. Its prompt is (11.8, 1.42, 5.58); approach from z 4.38. It is clear of the safe, three service windows, Gold Card display and Prize Counter. It is the Return to Sender quest's counter (the quest issues the gun free: config/returnQuest.js) and sells the gun's ammo (economy `returnsAmmo`, through g.pricing 'closing'). Its second prompt, the label slot ("Fit: <label>", free), is 0.85 m along the wall at tray height, with a small label printer on the wall beside it.
- Customer Service booth (gun tiers): a small walled office on the hallway's north wall at x 5.2..8.8 (between the start doorway
  and the elevator), 1.6m deep + a 0.3m counter ledge; you buy at its service window (collider front z 4.1; service-window spots at z 4.0). Hold F/X to buy the next Extended
  Warranty tier for the gun in your hand. Its spot is ONE entry, LAYOUT.serviceDesk in mall.js (along/center/wallAt/facing/zone):
  change it to move the booth. A map feature of kind 'upgradeDesk'.
  The booth has a SECOND window 1.25 m along the counter (LAYOUT.serviceDesk.meleeOffset; feature.meleePosition, a SHARPENING sign above it):
  hold F/X there to buy the box cutter tiers (Sharpened Blade 1500, Box Cutter Pro 4000; economy.upgrades.melee).
- The four Food Court STORES (gun attachments; see mall/stores.js): GOOD SPORTS (grips) x -17..-9 and NUTS & BOLTS (barrels) x 9..17
  are rooms 6m deep behind the south wall; PLAY TIME TOYS (magazines) x -16.4..-10.6 and BYTE ME ELECTRONICS (sights) x 10.6..16.4 are
  4.5m-deep pods against the hallway wall (the two north pillars are gone: the pods hold the ceiling up). 3m doors, glass windows, a
  zombie clerk behind a full-width counter, two attachments per counter (one buy spot each), a zombie spawn just inside each door. Each
  store is ONE entry in LAYOUT.stores (mall.js). Map features of kind 'attachmentCounter' (one per attachment). The Mega Mart's aisle
  4 is HOUSEWARES again (the barrels moved from the old hardware pegboard to Nuts & Bolts).
- **Wardrobe** has 12 apparel displays and three fitting rooms. In the Food Court three are SHOWPIECES (maps/mall/wardrobeShowpieces/foodCourt.js):
  a burger on Burger Barn's roof sells the Paper Hat (buy at the counter, x -5.75); a skate ramp on the court floor in front of Good Sports' east
  window sells the Wheelies (x -11.05..-9.15, z -13.3..-12, 0.9 m, vaultable; buy at its front edge, x -10.1) and a 3 m foam finger in a pennant bin
  on the open court floor sells the Foam Finger (bin x -15.5..-14.5, z -10.4..-9.6; buy at its front, z -9.57; the 6 m pillar at (-13, -11.3) hides
  Good Sports' west half from the entrance, so it stands north of it). The ramp keeps Good Sports' 3 m door
  (x -14.5..-11.5) clear. The prompt coordinates for the other six ground-floor showpieces are in metres (x/z).
  Gold Card (4.03, 5.04) faces west toward the start shutter, just west of Customer Service. Mega Mart’s Sandwich Board (24.10, 2.75) and
  Fanny Pack (23.90, -3.16) face west from the gaps at the checkout ends. The Hi-Vis locker (-22.81, -8.46) faces east between the staff
  lockers and the z -7 vent lane, with a blade sign facing the hallway and room to approach along the corridor.
  HOFFMAN’S Cardigan (-15.50, 11.45) faces the gate from the front floor between the west wall and the cosmetics counters. The Mirrored
  Aviators (25.62, 14.52) face west from beside SHADE SHACK, with the fountain loop and kiosk footprint clear.
  Upstairs at y 6.3, the 3D Glasses monster faces east from beside Concessions (-40.38, -3.48). At Shoe-Per Sale the Light-Up Sneakers disco
  plinth (-9.55, 9.40) faces the west entrance. The Orthopedic Walkers treadmill (-4.78, 10.06) faces west with its sign toward the east entrance. Their prompts sit on
  opposite sides of the display island, with a separate prompt at the back-wall mirror. Fitting rooms also sit by the curtained booths in HOFFMAN’S
  and the Service Corridor lockers. Anchors are in `config/wardrobe.js`.
- Ammo cache: the RESTOCK-O-MATIC, a big hot-orange vending machine on the Food Court's NORTH wall just inside the door,
  east side (x 4.1..5.8, front at z -3.15 facing south; LAYOUT.restockMachine.x moves it along the wall), clear of the door
  lane, the east bench and the Byte Me pod. Hold F/X for 400 points to refill the gun in your hand (any gun, including the
  staple gun, which has no wall buy); no prompt when it's full or the Food Court is closed. Built to be seen: glowing header sign,
  an "AMMO" blade sign sticking out of the wall that reads down the wall both ways, "AMMO" on both sides, a yellow-and-black
  hazard pad on the floor where you stand and a soft warm glow on the tiles (unlit materials, no real lights, no flicker). Its LCD
  is live (the gun in hand, its ammo, the price / FULL / SALE). Solid 2.35 m body, one collider. A map feature of kind 'ammoCache'
  (game/features/ammoCache.js; mall/restockMachine.js builds it). It used to be a RESTOCK-O-MATIC on the west wall, which the
  Food Court stores made a far, awkward detour.
  Two additional machines use the same 400-point held-weapon refill: the Grand Atrium's ground-floor northeast corner
  (body centre x 30.5, back z 30.4, facing south), and Cinema lobby's north wall beside the projection-passage entrance
  (body centre x -25.7, back z 5.3, floor y 6.3, facing south). Each requires its own area's ownership, has an independent
  live screen and solid tall body, and leaves its front approach clear. No Parking or Promenade machine was added.
- GRAB-A-GUN, the claw machine (config/clawMachine.js sites, mall/clawCabinet.js, game/features/clawMachine.js): six 1.3 x 1.0 x 2.2 m
  cabinets, one collider each, always there; only the live one is uncovered (the others wear a "BACK SOON" dust sheet). Backs on the wall:
  Hallway (8, -2) facing north, between the Food Court gate and the Nail Gun (every run starts here; it waits until the Hallway is owned);
  Food Court (8.5, -2.3) facing south, between the RESTOCK-O-MATIC and Byte Me; Mega Mart (28, 6) facing south, past the checkouts;
  Grand Atrium (27, 6.6) facing north, the south arcade; Cinema lobby (-34.1, -10.5, floor y 6.3) facing north, clear of the screen door's
  jamb; Customer Parking (34.43, -8) facing east, on the Mart's outside facade. Each keeps clutter 2 m away (mall.js hallwayClear).
  THE PRIZE COUNTER ("REDEMPTION", mall/prizeCounter.js, config/clawMachine.js prizeCounter.site): one fixed 2.6 x 0.9 x 2.3 m booth on the
  Hallway's north wall at x -13 (z 6, facing south), between the boarded vent (x -7) and HOFFMAN'S gate (starts x -15.5), no spawn within 5 m. It was at x 3.65
  (between the start shutter and Customer Service) until the Wardrobe's Gold Card rack took x 4.7 of the same wall (merge of 9 November); the booth moved, the rack didn't. Five prizes at 0.52 m along its front (interaction
  points y 1.1, 0.99 m out from the wall). Rejected: x 10.6 on the same wall (it would cover the sealed elevator doors), the south wall at
  x 5.3 (a bench) and x 13.4 (a vent spawn 2.8 m away), the west of the hallway (spawns within 5 m), the Atrium (opens too late).
  Sunny's topper stands 0.5 m above each header (2.24..2.74 m, no collision), and peeks over the dust sheet too.
  Rejected: Hallway x 15 / x -12 (vent spawns), Mega Mart x 23 (the Atrium link), the Promenade, HOFFMAN'S and the Service Corridor.
- Wall-buy spots: start room east wall (4.98, 1.5, 10) = Price Gun; hallway south wall (11, 1.5, -1.98) = Nail Gun;
  Mega Mart north wall (31.5, 1.5, 5.98) = Foam Dart Blaster, Service Corridor west wall near the dead end
  (-23.28, 1.5, -12.2) = Confetti Cannon; Grand Atrium west arcade wall (8.02, 1.5, 21.5) = Rivet Rifle;
  Cinema projection-passage east wall (-20.36, 8.3, 20) = Heavy Coil Nailer (zone 'cinema', weapon 2500 / ammo 650),
  above the tile dado between the rewind/reel equipment and rear crossover; either Cinema entrance grants access.
  Its cheapest doors-plus-weapon route costs 5250 through Hallway -> Service Corridor -> Cinema. Seven unique buys remain;
  duplicate stations in the Promenade and Parking are deferred.
  HOFFMAN'S east wall between its side door and shoe wall (-5.33, 1.5, 15.3) = Barcode Scanner (zone 'departmentStore').
- Lighting: room lamps (point lights) hang at ~60% of the ceiling height with intensity scaled to match, NOT just under
  the ceiling: a lamp 0.8m under it lit a small hard-edged bright disc on the ceiling ("big circles"); hung lower it's a soft
  glow. Keep that if you move or add lamps (mall.js, the `lamp()` calls).
- Atmosphere: `mall/atmosphere.js` adds ceiling seams/vents/sprinklers (excluding the escalator well), service cable
  trays/access panel, Sunset Galleria notices/directory and a gently swaying two-sided sign, interrupted lunches,
  a fallen seat, restocking carton, perimeter dust/spills/leak and static fixture contact shadows. Decorative boxes
  batch by material and add no colliders. `map.update/reset` owns the local sign/tube animation; `map.ambience`
  is emitter data. `game/ambience.js` selects zone-aware, distance/occlusion-attenuated and stereo-panned HVAC,
  fridge and muffled music voices; occasional rattles come from nearby closed shutters. It owns no Web Audio nodes.
  Pause/death/reset silence the mix; `audio/sound.js` owns browser audio and uses `audio.ambienceVolume`.
  No realtime shadow maps or global blur; zombie contact shadows render after interpolation in main. Post-processing (bloom, lens
  vignette/fringing, ACES tone mapping, MSAA) is fx/postProcessing.js with three levels, Settings > Video > Visual effects: High (default),
  Low (composer only: no bloom/lens/MSAA), Off (no composer: the world and the gun drawn straight to the screen). "Dust and
  flickering lights" (atmosphere.ambient.enabled) hides the dust motes and zeroes the flicker/emergency lights (kept in the scene).
- Player spawns at (0, 0, 12) facing into the room (+Z, yaw Math.PI).

## Collectibles and quest props (config/lostFound.js, config/returnQuest.js; positions [x, y, z])
- Lost and Found, one item per area (feature kind `lostProperty`, hold to log): badge, Start Room (4.25, 0, 6.75); balloon, Main
  Hallway (19.25, 1.9, 5.25); order pager, Food Court (-11.75, 0, -7.55); shopping list, Mega Mart (33.25, 0, -23.5); Murray's flask,
  Service Corridor (-22.75, 0, -13.25); wishing coin, Grand Atrium (23.25, 0, 17.35); unpaid shoe, Promenade (16.75, 6.3, 5.25);
  mannequin's hand, HOFFMAN'S (-14.25, 0, 22.8); ticket stub, Cinema (-35.75, 6.3, -10); half-stuffed bear, Build-A-Blaster hall
  (-9, 6.3, 24.75); car keys, Customer Parking (61.8, 0, -23.5). tests/lostFound.test.js keeps each clear, reachable and its own prompt.
- NO REFUNDS signs, the Return quest's first step (feature kind `refundSign`, shoot to knock flat): Start Room (-4.5, 0, 13.25), Main
  Hallway (19.25, 0, -1.5), Food Court (8.75, 0, -13.8), Mega Mart (20.75, 0, -23.5).
