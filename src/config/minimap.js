// =============================================================================
// MINIMAP: the mall directory board (ui/minimap.js; its floor plan: game/minimapPlan.js; the floors: the map's `minimap`).
// Hidden until asked for, on purpose (the user's decision): TAP the minimap button (Tab / controller Back) to show or hide a
// small map in the corner that turns with you; HOLD it for the whole directory, both floors, north-up, while held.
// What a printed directory would show, and nothing more: rooms (bought ones filled, locked ones hatched), shutters with the
// price to open them, escalators and stairs, where to buy things, Kiosk Kevin's cart while it is open, and dropped Closing
// Time keys when the run gives guidance (Directed). NEVER zombies, bosses, lost property or quest steps.
// =============================================================================

export const minimap = {
  holdSeconds: 0.28, // held longer than this = the full directory (and letting go does not toggle the corner map)

  corner: {
    size: 208, // HUD px, square (times --ui-space: it scales with the HUD and the UI scale setting)
    metresAcross: 44, // how much of the mall fits across it
  },
  full: {
    heightShare: 0.86, // at most this share of the screen's height (the width is the CSS's 92vw), for both floors side by side
    gap: 34, // CSS px between the floors
    padding: 18, // px round the drawing
  },

  colors: {
    board: '#14213d', // the directory's backing
    frame: '#e9c46a',
    room: '#f2e8cf', // a bought area
    roomEdge: '#3d405b',
    locked: '#5b6478', // an area not bought yet (hatched)
    hatch: 'rgba(20, 33, 61, 0.55)',
    void: '#0b1326', // open to the floor below
    voidEdge: '#9aa5b8',
    ramp: '#b9c2d0',
    shutter: '#e63946', // a shutter still shut
    price: '#ffe08a',
    label: '#1d2540', // area names on a bought area
    labelLocked: '#dde3ee',
    floorTitle: '#e9c46a',
    floorTitleDim: '#8d97ab',
    you: '#e63946',
    youEdge: '#ffffff',
  },
  fonts: {
    area: '600 {px}px "Teko", "Arial Narrow", sans-serif',
    price: '700 {px}px "Space Grotesk", system-ui, sans-serif',
    title: '600 {px}px "Teko", "Arial Narrow", sans-serif',
    icon: '700 {px}px "Space Grotesk", system-ui, sans-serif',
  },

  // Places worth finding, by map feature kind: a coloured disc with a letter, and a word for the legend. Kinds not listed
  // (wardrobe racks, refund signs, lost property, the horror layer) are left off. `label: 'weapon'` writes the gun's name
  // beside its wall buy on the full directory.
  places: {
    wallBuy: { glyph: 'G', color: '#2a9d8f', legend: 'Wall gun', label: 'weapon' },
    ammoCache: { glyph: 'A', color: '#43aa8b', legend: 'Restock' },
    upgradeDesk: { glyph: 'W', color: '#577590', legend: 'Warranty' },
    attachmentCounter: { glyph: '+', color: '#4d908e', legend: 'Attachment' },
    workshop: { glyph: 'B', color: '#f3722c', legend: 'Build-A-Blaster' },
    fittingRoom: { glyph: 'F', color: '#c77dff', legend: 'Fitting room' },
    clawMachine: { glyph: 'C', color: '#f15bb5', legend: 'Claw machine' },
    prizeCounter: { glyph: 'P', color: '#f9844a', legend: 'Prize counter' },
    kiosk: { glyph: 'K', color: '#ffbe0b', legend: "Kevin's cart" }, // only while the cart is open, where it is this round
    fountainHazard: { glyph: '!', color: '#e76f51', legend: 'Hazard switch' },
    fryerHazard: { glyph: '!', color: '#e76f51', legend: 'Hazard switch' },
    sprinklerHazard: { glyph: '!', color: '#e76f51', legend: 'Hazard switch' },
    paLureHazard: { glyph: '!', color: '#e76f51', legend: 'Hazard switch' },
    nightSafe: { glyph: '$', color: '#90be6d', legend: 'Night safe' },
    returnsDesk: { glyph: 'R', color: '#8ecae6', legend: 'Returns desk' },
    escapeVan: { glyph: 'V', color: '#adb5bd', legend: 'Van' },
  },
  key: { glyph: '⚿', color: '#ffd166', legend: 'Dropped key' }, // a Closing Time key on the floor (Directed runs only)
  iconRadius: { corner: 6.5, full: 7.5 }, // CSS px
  youSize: { corner: 9, full: 8 },
};
