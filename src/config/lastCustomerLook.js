// Lorraine Pruitt, the Last Customer: her Sunday-best twinset and the trolley of returns she pushes into Customer Parking.
// Visual only (zombies/bosses/lastCustomerModel.js): her hitboxes stay the standing ones in config/bosses.js, so every
// lean below is kept small (a lean moves the drawn head, not the head box). Meters in the stock zombie skeleton's space.
export const lastCustomerLook = {
  colors: {
    cardigan: 0xb48bc4, cuff: 0x9c74ad, blouse: 0xf3e6d6, button: 0xf7f1e6, pearl: 0xf4efe6, gold: 0xe6bc61,
    skirt: 0x5b3b5e, hem: 0x46304a, perm: 0xc9c0db, permShade: 0xa69dba, frames: 0xc0394f, lipstick: 0xb23a5a,
    mouth: 0x1a0d14, // (her agape mouth: its own colour, so it stays a mesh of its own and can be shown while Speechless)
    chain: 0xd8c27a,
  },
  primitives: { sphere: [0.5, 8, 6] },
  parts: [
    // A lilac cardigan over a cream blouse, pearl buttons, a gold brooch and a string of pearls.
    { bone: 'upper', color: 'cardigan', size: [0.49, 0.5, 0.29], at: [0, 0.33, 0] },
    { bone: 'upper', color: 'blouse', size: [0.1, 0.42, 0.02], at: [0, 0.37, -0.15] },
    { bone: 'upper', color: 'button', size: [0.025, 0.025, 0.015], at: [-0.062, 0.42, -0.152] },
    { bone: 'upper', color: 'button', size: [0.025, 0.025, 0.015], at: [-0.062, 0.32, -0.152] },
    { bone: 'upper', color: 'button', size: [0.025, 0.025, 0.015], at: [-0.062, 0.22, -0.152] },
    { bone: 'upper', color: 'gold', size: [0.055, 0.055, 0.02], at: [-0.15, 0.47, -0.155], rotation: [0, 0, 0.78] },
    { bone: 'upper', color: 'pearl', shape: 'sphere', size: [0.04, 0.04, 0.04], at: [-0.075, 0.56, -0.15] },
    { bone: 'upper', color: 'pearl', shape: 'sphere', size: [0.04, 0.04, 0.04], at: [-0.04, 0.53, -0.158] },
    { bone: 'upper', color: 'pearl', shape: 'sphere', size: [0.04, 0.04, 0.04], at: [0, 0.52, -0.16] },
    { bone: 'upper', color: 'pearl', shape: 'sphere', size: [0.04, 0.04, 0.04], at: [0.04, 0.53, -0.158] },
    { bone: 'upper', color: 'pearl', shape: 'sphere', size: [0.04, 0.04, 0.04], at: [0.075, 0.56, -0.15] },
    // A calf-length plum skirt (the legs swing inside it, as a shopper's skirt does).
    { bone: 'upper', color: 'skirt', size: [0.52, 0.46, 0.31], at: [0, -0.2, 0] },
    { bone: 'upper', color: 'hem', size: [0.53, 0.05, 0.32], at: [0, -0.41, 0] },
    { bone: 'leftArm', color: 'cardigan', size: [0.16, 0.16, 0.25], at: [0, 0, -0.12] },
    { bone: 'rightArm', color: 'cardigan', size: [0.16, 0.16, 0.25], at: [0, 0, -0.12] },
    { bone: 'leftForearm', color: 'cuff', size: [0.15, 0.15, 0.17], at: [0, 0, -0.09] },
    { bone: 'rightForearm', color: 'cuff', size: [0.15, 0.15, 0.17], at: [0, 0, -0.09] },
    { bone: 'leftForearm', color: 'gold', size: [0.155, 0.155, 0.03], at: [0, 0, -0.2] },
    // A lilac-grey set perm, cat-eye glasses on a chain (rims around the eyes, never over them), clip-on pearls, lipstick.
    { bone: 'head', color: 'perm', shape: 'sphere', size: [0.37, 0.2, 0.37], at: [0, 0.33, 0.02] },
    { bone: 'head', color: 'perm', shape: 'sphere', size: [0.14, 0.13, 0.14], at: [-0.12, 0.39, -0.08] },
    { bone: 'head', color: 'perm', shape: 'sphere', size: [0.14, 0.13, 0.14], at: [0.12, 0.39, -0.08] },
    { bone: 'head', color: 'perm', shape: 'sphere', size: [0.15, 0.14, 0.15], at: [0, 0.44, -0.01] },
    { bone: 'head', color: 'perm', shape: 'sphere', size: [0.15, 0.13, 0.15], at: [-0.12, 0.38, 0.11] },
    { bone: 'head', color: 'perm', shape: 'sphere', size: [0.15, 0.13, 0.15], at: [0.12, 0.38, 0.11] },
    { bone: 'head', color: 'permShade', shape: 'sphere', size: [0.11, 0.17, 0.17], at: [-0.16, 0.25, 0.04] },
    { bone: 'head', color: 'permShade', shape: 'sphere', size: [0.11, 0.17, 0.17], at: [0.16, 0.25, 0.04] },
    { bone: 'head', color: 'permShade', shape: 'sphere', size: [0.3, 0.2, 0.12], at: [0, 0.24, 0.15] },
    { bone: 'head', color: 'frames', size: [0.12, 0.028, 0.02], at: [-0.075, 0.226, -0.162], rotation: [0, 0, 0.16] },
    { bone: 'head', color: 'frames', size: [0.12, 0.028, 0.02], at: [0.075, 0.226, -0.162], rotation: [0, 0, -0.16] },
    { bone: 'head', color: 'frames', size: [0.085, 0.012, 0.016], at: [-0.072, 0.152, -0.162] },
    { bone: 'head', color: 'frames', size: [0.085, 0.012, 0.016], at: [0.072, 0.152, -0.162] },
    { bone: 'head', color: 'frames', size: [0.03, 0.012, 0.016], at: [0, 0.19, -0.165] },
    { bone: 'head', color: 'chain', size: [0.008, 0.2, 0.008], at: [-0.158, 0.12, -0.05] },
    { bone: 'head', color: 'chain', size: [0.008, 0.2, 0.008], at: [0.158, 0.12, -0.05] },
    { bone: 'head', color: 'pearl', shape: 'sphere', size: [0.035, 0.035, 0.035], at: [-0.162, 0.16, 0.01] },
    { bone: 'head', color: 'pearl', shape: 'sphere', size: [0.035, 0.035, 0.035], at: [0.162, 0.16, 0.01] },
    { bone: 'head', color: 'lipstick', size: [0.12, 0.018, 0.02], at: [0, 0.106, -0.153] },
    { bone: 'head', color: 'lipstick', size: [0.12, 0.018, 0.02], at: [0, 0.058, -0.153] },
  ],
  // Speechless: the mouth drops open (hidden otherwise).
  mouth: { color: 'mouth', size: [0.09, 0.085, 0.02], at: [0, 0.075, -0.158] },

  // Her trolley: the Cart Pusher's frame and size (its charge nose reach matches it), her colours, and a heap of returns.
  trolley: {
    frameColor: 0xc9ccd1, handleColor: 0x3f8f8a, bumperColor: 0x2b2b33, wheelColor: 0x1d1d22,
    contents: [0xffffff], contentsCount: [0, 0], // (no random boxes: the heap below is hers)
    width: 0.56, depth: 0.8, basketBottom: 0.45, basketTop: 0.95, handleY: 1.0, handleZ: -0.32,
  },
  // The returns, in the trolley's space (handle at z -0.32, basket from z -0.38 to -1.18, rails at x +-0.28).
  heap: [
    // A boxed toaster with a red band, a television box tipped over the front, a stack of shoe boxes.
    { color: 0xf1e3c6, size: [0.3, 0.22, 0.24], at: [-0.1, 0.57, -0.55] },
    { color: 0xd9443f, size: [0.305, 0.06, 0.245], at: [-0.1, 0.6, -0.55] },
    { color: 0xb08a5c, size: [0.44, 0.34, 0.16], at: [0.02, 0.86, -0.98], rotation: [0.28, 0, 0.08] },
    { color: 0x8a6a45, size: [0.3, 0.2, 0.01], at: [0.02, 0.87, -1.07], rotation: [0.28, 0, 0.08] },
    { color: 0xff8a3d, size: [0.13, 0.07, 0.012], at: [-0.1, 0.95, -1.05], rotation: [0.28, 0, 0.08] },
    { color: 0x5b8fc7, size: [0.26, 0.11, 0.17], at: [-0.12, 0.74, -0.78] },
    { color: 0xf284ca, size: [0.26, 0.11, 0.17], at: [-0.1, 0.85, -0.77], rotation: [0, 0.2, 0] },
    // A standard lamp in the front corner, its shade above the heap but below her face (shots pass through the trolley).
    { color: 0x6e6455, size: [0.035, 0.7, 0.035], at: [0.2, 0.85, -1.08] },
    { color: 0xf2d28a, size: [0.28, 0.18, 0.28], at: [0.2, 1.27, -1.08] },
    { color: 0x6e6455, size: [0.14, 0.03, 0.14], at: [0.2, 0.51, -1.08] },
    // A coral dress on a hanger, draped over the left rail.
    { color: 0xe36f6f, size: [0.02, 0.5, 0.3], at: [-0.305, 0.72, -0.72] },
    { color: 0x9a9aa5, size: [0.02, 0.07, 0.14], at: [-0.29, 1.0, -0.72] },
    // Her handbag, hung on the handle, and the receipt: pinned under her right hand, down the right side, curled on the floor.
    { color: 0x6b2f4a, size: [0.24, 0.19, 0.1], at: [-0.13, 0.86, -0.42] },
    { color: 0xe6bc61, size: [0.08, 0.025, 0.105], at: [-0.13, 0.94, -0.42] },
    { color: 0xfbf6ea, size: [0.08, 0.008, 0.16], at: [0.13, 1.03, -0.38] },
    { color: 0xfbf6ea, size: [0.008, 0.62, 0.08], at: [0.295, 0.7, -0.46] },
    { color: 0xfbf6ea, size: [0.08, 0.008, 0.34], at: [0.33, 0.012, -0.6], rotation: [0, 0.35, 0] },
  ],

  // Pushing: upright behind the handle (the Cart Pusher hunches; she has her dignity). armAngle is the arms' world angle.
  pushing: {
    armAngle: -0.95, hunch: 0.06, telegraphShake: 0.05, telegraphCrouch: 0.08, chargeLean: 0.14, crashTilt: 0.45, crashSlump: 0.12,
  },
  // Speechless: a hand to her pearls, the other raised for the manager, chin up, trembling. Radians.
  speechless: {
    leftArm: [-1.25, -0.55, 0.1], leftElbow: 2.0,
    rightArm: [1.15, 0.1, -0.25], rightElbow: 0.35,
    chinUp: 0.32, tremble: 0.035, trembleRate: 31, easeSeconds: 0.25,
  },
};
