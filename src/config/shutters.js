// Shared visual construction; finishes are cosmetic, keyed by the existing door IDs.
// Prices, zones and opening speed still belong to economy.js / feel.js.
export const shutters = {
  pixelsPerMetre: 160,
  slatHeight: .16,
  paint: { roughness: .76, metalness: .12 },
  track: {
    width: .075,
    extraDepth: .08,
    housingHeight: .27,
    housingOverhang: .07,
    // Keep decorative frame faces clear of the wall/floor planes. Exact shared planes
    // shimmer at shallow angles once the static map is batched for rendering.
    frameClearance: .008,
    channelLift: .006,
    signOffset: .1,
  },
  bottomRailHeight: .065,
  handleHeight: .56,
  rollSoundInterval: .16,
  finishes: {
    public: { base: '#e5e1d1', accent: '#7faeaa', ink: '#46505a', heading: 'TEMPORARILY CLOSED',
      notice: 'YOUR PATIENCE IS CONTRACTUALLY REQUIRED.', seed: 13 },
    clearance: { base: '#e8dcc0', accent: '#b96c87', ink: '#5e4051', heading: 'OPENING SHORTLY',
      notice: 'PLEASE CONTINUE SPENDING.', sticker: 'BACK IN 5', seed: 27 },
    foodCourt: { base: '#eee1c9', accent: '#6faaa3', ink: '#355a59', heading: 'TEMPORARILY CLOSED',
      notice: 'CUSTOMER SATISFACTION IN PROGRESS.', seed: 43 },
    mart: { base: '#dfe3de', accent: '#698faa', ink: '#374b67', heading: 'STOCK CONTROL',
      notice: 'MORE SAVINGS ARE BEING PREPARED.', sticker: 'FINAL CHECK', seed: 61 },
    atrium: { base: '#eae1cf', accent: '#ac93b5', ink: '#5a4165', brass: true, heading: 'OPENING SHORTLY',
      notice: 'THANK YOU FOR YOUR INDEFINITE PATIENCE.', seed: 79 },
    staff: { base: '#aab6a6', accent: '#667a70', ink: '#344b43', heading: 'ACCESS RESTRICTED',
      notice: 'AUTHORIZED PERSONNEL. AUTHORIZED SMILES.', sticker: 'INSPECTED 1986', seed: 97 },
    department: { base: '#efe2cd', accent: '#8c2f45', ink: '#4a1d2a', brass: true, heading: 'GRAND OPENING',
      notice: "HOFFMAN'S. EST. FOREVER.", sticker: 'NOW HIRING', seed: 131 },
    cinema: { base: '#dfc6ce', accent: '#82516e', ink: '#49364f', brass: true, heading: 'FEATURE PRESENTATION',
      notice: 'YOUR SEAT IS RESERVED. FOREVER.', sticker: 'ADMIT ONE', seed: 113 },
  },
  doors: { startShutter: 'clearance', foodCourt: 'foodCourt', serviceCorridor: 'staff', megaMart: 'mart',
    parkingLot: 'staff',
    foodCourtMegaMart: 'mart', serviceCorridorFoodCourt: 'staff', atrium: 'atrium', atriumPromenade: 'atrium', atriumMegaMart: 'mart', cinema: 'cinema', cinemaStairs: 'staff',
    departmentStore: 'department', departmentStoreStartRoom: 'department' },
};

export function shutterFinish(id) {
  return shutters.finishes[Object.hasOwn(shutters.doors, id) ? shutters.doors[id] : 'public'];
}
