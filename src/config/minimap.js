// =============================================================================
// MINIMAP: the mall directory board (ui/minimap.js; its floor plan: game/minimapPlan.js; the floors: the map's `minimap`).
// Hidden until asked for, on purpose (the user's decision): TAP the minimap button (Tab / controller Back) to show or hide a
// small map in the corner that turns with you; HOLD it for the whole directory, both floors, north-up, while held.
// What a printed directory would show, and nothing more: rooms (bought ones filled, locked ones hatched), shutters with the
// price to open them, escalators and stairs, where to buy things, Kiosk Kevin's cart while it is open, and dropped Closing
// Time keys when the run gives guidance (Directed). NEVER zombies, bosses, lost property or quest steps.
// THE LOOK: the mall's own directory signs (maps/mall/atriumDetails.js, atmosphere.js): a plum case with brass trim, the
// teal mall-signage header in cream serif, each area tinted like its shutters (config/shutters.js), wayfinding pictograms.
// =============================================================================

export const minimap = {
  holdSeconds: 0.28, // held longer than this = the full directory (and letting go does not toggle the corner map)

  corner: {
    size: 208, // HUD px, square (times --ui-space: it scales with the HUD and the UI scale setting)
    metresAcross: 44, // how much of the mall fits across it
    redrawsPerSecond: 30, // the corner map is redrawn this often, not on every frame the game draws (60 = every frame at 60 fps)
  },
  full: {
    heightShare: 0.86, // at most this share of the screen's height (the width is the CSS's 92vw)
    gap: 30, // px between the floors
    padding: 14, // px round the drawing
    otherFloor: 0.62, // the floor you are not on is drawn this much smaller
    tabHeight: 30, // px: the lit LEVEL tab over each floor
  },
  flickerSeconds: 0.16, // the backlight warming up when the directory opens (CSS; reduced motion skips it)

  colors: {
    case: '#2a1c2e', // the plum case behind the floors (in-world: directory_case)
    wall: '#2a1c2e',
    brass: '#c9a45c',
    header: '#246d76', headerInk: '#fff0cb', // the mall-signage strip
    locked: '#5d4a63', // mixed into an area's tint when it is not bought
    lockedMix: 0.72, // how much of `locked` (0 = the tint, 1 = all locked)
    hatch: 'rgba(42, 28, 46, 0.5)',
    labelLocked: '#e9dcef',
    void: '#120c16', voidRail: '#c9a45c',
    ramp: '#d8d2c4', rampEdge: '#2a1c2e', rampArrow: '#246d76',
    tape: '#d62839', tapeLight: '#fff4e0',
    tag: '#fff0cb', tagInk: '#4b304e', tagString: '#c9a45c',
    pictoBack: '#2a1c2e', pictoInk: '#fff0cb', number: '#c9a45c',
    tab: '#3b2a40', tabLit: '#246d76', tabInk: '#b6a3bb', tabInkLit: '#fff0cb',
    you: '#e63946', youRing: '#ffffff', cone: 'rgba(230, 57, 70, 0.22)',
    straggler: '#ff9f1c', stragglerRing: '#fff0cb', stragglerEdge: '#2a1c2e',
  },
  sales: {
    pulseSeconds: 1.4,
    soonFill: '#fff0cb',
    soonBorder: '#a14759',
    soonInk: '#422731',
    saleFill: '#f3c66e',
    saleBorder: '#2a1c2e',
    saleInk: '#422731',
    doorbusterFill: '#d62839',
    doorbusterRing: '#ffe066',
    doorbusterInk: '#fff4e0',
    radiusCorner: 5.5,
    radiusFull: 7.5,
    doorbusterRadiusCorner: 7,
    doorbusterRadiusFull: 10,
    ringGrow: 5.5,
  },
  // Each area's floor colour and the ink of its name: the shutter finishes' accents, lightened for a printed plan.
  areas: {
    startRoom: { fill: '#ecd0da', ink: '#5e4051' },
    hallway: { fill: '#f1e6cf', ink: '#4b304e' },
    foodCourt: { fill: '#c6e3dc', ink: '#355a59' },
    megaMart: { fill: '#cbd9e8', ink: '#374b67' },
    serviceCorridor: { fill: '#c8d2c3', ink: '#344b43' },
    atrium: { fill: '#e0d3e8', ink: '#5a4165' },
    departmentStore: { fill: '#ebc4cc', ink: '#4a1d2a' },
    upstairs: { fill: '#f6d6bb', ink: '#7a3b26' },
    cinema: { fill: '#dcc3d4', ink: '#49364f' },
    parkingLot: { fill: '#cfcfc9', ink: '#3b3f45' },
  },
  defaultArea: { fill: '#e8e2d4', ink: '#3b2a40' },
  walls: { full: 3, corner: 2.4 }, // px
  fonts: {
    area: '600 {px}px "Teko", "Arial Narrow", sans-serif',
    tag: '700 {px}px "Space Grotesk", system-ui, sans-serif',
    tab: '600 {px}px "Teko", "Arial Narrow", sans-serif',
    number: '700 {px}px "Space Grotesk", system-ui, sans-serif',
  },

  // Places worth finding, by map feature kind: a wayfinding pictogram (ui/minimap.js draws each `picto`; `back` = its square
  // if not the case colour) and its word.
  // Kinds not listed (wardrobe racks, refund signs, lost property, the horror layer) are left off. `label: 'weapon'` = the
  // index names the gun. `name` = the index's words for it (else `legend`).
  places: {
    wallBuy: { picto: 'gun', legend: 'Wall gun', label: 'weapon' },
    ammoCache: { picto: 'ammo', legend: 'RESTOCK-O-MATIC' },
    upgradeDesk: { picto: 'badge', legend: 'Extended Warranty' },
    attachmentCounter: { picto: 'scope', legend: 'Attachment counters' },
    workshop: { picto: 'hammer', legend: 'Build-A-Blaster' },
    fittingRoom: { picto: 'hanger', legend: 'Fitting room' },
    clawMachine: { picto: 'claw', legend: 'GRAB-A-GUN' },
    prizeCounter: { picto: 'ticket', legend: 'Prize counter' },
    kiosk: { picto: 'cart', legend: 'Kiosk Kevin', back: '#246d76' },
    fountainHazard: { picto: 'bolt', back: '#8f2433', legend: 'Hazard', name: 'Fountain breaker' },
    fryerHazard: { picto: 'bolt', back: '#8f2433', legend: 'Hazard', name: 'Fryer valve' },
    sprinklerHazard: { picto: 'bolt', back: '#8f2433', legend: 'Hazard', name: 'Fire alarm pull' },
    paLureHazard: { picto: 'bolt', back: '#8f2433', legend: 'Hazard', name: 'Paging panel' },
    nightSafe: { picto: 'safe', legend: 'Night safe' },
    returnsDesk: { picto: 'return', legend: 'Returns desk' },
    escapeVan: { picto: 'van', legend: 'Van' },
  },
  key: { picto: 'key', legend: 'Dropped key', back: '#9a6b16' }, // a Closing Time key on the floor (Directed runs only)
  // The store index beside the full directory: one heading per group, its places numbered in order.
  index: [
    { title: 'Wall guns', kinds: ['wallBuy'] },
    { title: 'Upgrades', kinds: ['upgradeDesk', 'attachmentCounter', 'workshop', 'fittingRoom'] },
    { title: 'Supplies', kinds: ['ammoCache', 'clawMachine', 'prizeCounter'] },
    { title: 'Hazards', kinds: ['fountainHazard', 'fryerHazard', 'sprinklerHazard', 'paLureHazard'] },
    { title: 'Customer services', kinds: ['nightSafe', 'returnsDesk', 'escapeVan'] },
  ],
  words: {
    title: 'Sunset Galleria', subtitle: 'Store directory',
    youAreHere: 'You are here',
    kevinOpen: (area) => `This round: ${area}`, kevinClosed: 'Not open yet',
    keys: 'Dropped keys', shutter: 'Shutter · price to open', up: 'UP',
    sale: 'On sale', saleSoon: 'Sale soon', doorbuster: 'Doorbuster',
  },
  pictoSize: { corner: 14, full: 17 }, // px, the dark rounded square each pictogram sits in
  you: { corner: 6, full: 6, pulseSeconds: 1.6, pulseGrow: 2.6, coneMetres: 7, coneDegrees: 70 },
  // Last-zombie straggler pings (ui/minimap.js draws the same dot + pulsing ring style as `you`).
  straggler: { corner: 5, full: 5.5, pulseSeconds: 1.4, pulseGrow: 2.8, cornerEdgeInset: 10 },
};
