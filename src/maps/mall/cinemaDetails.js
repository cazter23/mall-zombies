// Map-owned dressing and a single reusable slide texture. No gameplay state,
// colliders or extra real lights; static pieces participate in room batching.
import * as THREE from 'three';
import { atmosphere } from '../../config/environment.js';
import { buildCinemaArchitecture } from './cinemaArchitecture.js';
import { makeTileTexture } from '../../world/textures.js';
import { buildCinemaLobbyDetails } from './cinemaLobbyDetails.js';
import { buildCinemaAuditoriumDetails } from './cinemaAuditoriumDetails.js';
import { buildCinemaStoryDetails } from './cinemaStoryDetails.js';
import { cinemaDetails as detailConfig } from '../../config/cinemaDetails.js';
import { makeDustMoteTexture } from '../../world/atmosphereTextures.js';

export function buildCinemaDetails({ kit, looks, layout: c, floorY: Y }) {
  const C = c.colors, L = c.lobby, A = c.auditorium, P = c.passage, p = c.presentation;
  const y = h => Y + h;
  const box = (name, x, h, z, w, height, d, color, options = {}) => kit.box(x - w / 2, y(h), z - d / 2,
    x + w / 2, y(h + height), z + d / 2, kit.mat(color, options), { collide: false, name: `cinema_detail_${name}` });
  function sign(name, text, x, h, z, w, height, facing = 1, background = '#423044', color = '#f0dfbc') {
    const m = kit.sign(text, { x, y: y(h), z, width: w, height, facing, background, color });
    m.name = `cinema_detail_${name}`; return m;
  }
  const glow = color => ({ emissive: color, emissiveIntensity: .6, roughness: .7 });

  // Carpet motif is printed on the actual floor material, not a second floor.
  for (const id of ['lobby', 'screen', 'passage']) {
    const r = id === 'lobby' ? L : id === 'screen' ? A : P;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#48334f'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#715061'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(64, 8); ctx.lineTo(120, 64); ctx.lineTo(64, 120); ctx.lineTo(8, 64); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#ac8a69'; ctx.fillRect(62, 60, 4, 8); ctx.fillRect(60, 62, 8, 4);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set((r.maxX - r.minX) / 1.5, (r.maxZ - r.minZ) / 1.5);
    texture.anisotropy = 8;
    const floor = kit.group.getObjectByName(`cinema_floor_${id}`);
    // kit.mat is cached: give each floor its own material so repeat/UVs stay local.
    if (id === 'passage') {
      texture.dispose();
      const tile = makeTileTexture({ base: '#85918e', grout: '#566461', variation: 8, seed: 81 });
      tile.repeat.set((r.maxX - r.minX) / 2, (r.maxZ - r.minZ) / 2);
      floor.material = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tile, roughness: .9 });
    } else floor.material = new THREE.MeshStandardMaterial({ color: 0xffffff, map: texture, roughness: .98 });
  }
  buildCinemaArchitecture({ kit, looks, layout: c, floorY: Y });
  for (const x of [A.minX + .055, A.maxX - .055]) {
    for (const z of [8.5, 14.8, 20.9, 27.1]) {
      // The partition exit occupies z 22..25.4; none of these panels enter it.
      box('acoustic_panel', x, 1.45, z, .09, 2.0, 1.0, C.trim);
      box('sconce', x + (x < -33 ? .065 : -.065), 2.6, z, .035, .40, .18, C.cream, glow(C.cream));
    }
  }
  for (const z of [8, 15.3, 22]) box('ceiling_baffle', -33, c.height - .20, z, 16.9, .12, .28, C.trim);
  for (const x of [-40.5, -25.5]) for (const z of [9, 14.5, 20.9, 26])
    box('aisle_light', x, .025, z, .16, .025, .5, C.brass, glow(C.brass));
  // Floor-level passage lighting supplies a readable second escape route.
  for (const z of [8, 13, 18, 26.5]) {
    box('service_strip', P.maxX - .07, .22, z, .06, .08, 1.1, C.teal, glow(C.teal));
    box('service_pipe', P.maxX - .08, 3.45, z, .11, .11, 2.4, C.brass);
  }
  sign('screen_entry', 'SCREEN 1', -39.1, 3.05, 5.43, 2.9, .4, -1);
  sign('passage_entry', 'PROJECTION / EXIT', -22, 3.05, 5.43, 2.9, .35, -1);
  sign('auditorium_exit', 'EXIT →', -24.07, 3.05, 23.7, 2.0, .35, 'x-');
  sign('passage_exit', '← LOBBY', -22, 3.1, 5.88, 2.4, .35, 1);
  for (const side of [-1, 1]) sign('entrance', side === -1 ? 'SUNSET CINEMA' : 'SUNSET PROMENADE',
    side === -1 ? -19.9 : -20.43, 3.15, -2.9, 3.15, .45, side === -1 ? 'x+' : 'x-');
  for (const s of c.futureScreens) {
    for (const dx of [-.6, .6]) box('future_door_handle', (s.from + s.to) / 2 + dx, 1.02, L.minZ + .055, .04, .35, .05, C.brass);
    sign('future_screen_closed', 'NOT IN SERVICE', (s.from + s.to) / 2, 1.8, L.minZ + .06, 1.7, .25);
  }
  sign('service_stairs', 'EXIT · SERVICE STAIRS ↓', L.minX + .06, 3.05, -7.2, 3.15, .35, 'x+');
  sign('service_gate_notice', 'SECURITY SHUTTER BELOW', L.minX + .06, 3.43, -7.2, 2.9, .20, 'x+');

  // Enclosed counter cases match the existing tall collision: no invisible
  // space above a low counter and no campable strip behind the tills.
  const glass = kit.mat(0xaababb, { transparent: true, opacity: .22, roughness: .25 });
  for (const [id, r] of [['concessions', c.concessions], ['tickets', c.ticketBooth]]) {
    kit.box(r.minX, y(1.05), r.minZ, r.maxX, y(r.height - .16), r.maxZ, glass,
      { collide: false, name: `cinema_detail_${id}_glass` });
    box('counter_header', (r.minX + r.maxX) / 2, r.height - .16, (r.minZ + r.maxZ) / 2,
      r.maxX - r.minX + .08, .16, r.maxZ - r.minZ + .08, C.brass);
  }
  const con = c.concessions, tx = (c.ticketBooth.minX + c.ticketBooth.maxX) / 2;
  sign('concession_menu', 'POPCORN / SODA / FOREVER', con.maxX + .03, 3.05, .45, 4.8, .5, 'x+');
  sign('ticket_header', 'BOX OFFICE · ADMIT ONE', tx, 3.05, -9.35, 4.1, .45);
  sign('ticket_price', 'TONIGHT: YOUR ENTIRE SHIFT', tx, .67, -9.37, 3.3, .3);
  buildCinemaLobbyDetails({ kit, layout: c, floorY: Y });
  buildCinemaAuditoriumDetails({ kit, looks, layout: c, floorY: Y });
  const story = buildCinemaStoryDetails({ kit, layout: c, floorY: Y });
  sign('island_ad', 'NOW SHOWING · FOREVER', -33.5, .38, c.island.minZ - .025, 3.6, .25, -1);
  // Portrait one-sheets, with original graphic art rather than more menu tiles.
  for (const [i, poster] of c.posters.entries()) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 768;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = poster.base; ctx.fillRect(0, 0, 512, 768);
    ctx.strokeStyle = poster.accent; ctx.lineWidth = 4; ctx.strokeRect(16, 16, 480, 736);
    ctx.fillStyle = poster.accent; ctx.textAlign = 'center'; ctx.font = 'bold 39px sans-serif'; ctx.fillText(poster.title, 256, 105);
    ctx.font = '17px sans-serif'; ctx.fillText(poster.tagline, 256, 660);
    ctx.font = '15px sans-serif'; ctx.fillText('A SUNSET PICTURES PRESENTATION', 256, 713);
    ctx.beginPath(); ctx.arc(256, 340, 143, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#282333'; ctx.strokeStyle = '#282333'; ctx.lineWidth = 14;
    if (i === 0) {
      ctx.beginPath(); ctx.moveTo(130, 292); ctx.lineTo(166, 292); ctx.lineTo(194, 422); ctx.lineTo(356, 422); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(174, 316); ctx.lineTo(372, 316); ctx.lineTo(346, 392); ctx.lineTo(190, 392); ctx.closePath(); ctx.fill();
      for (const x of [210, 330]) { ctx.beginPath(); ctx.arc(x, 450, 18, 0, Math.PI * 2); ctx.fill(); }
      ctx.save(); ctx.translate(256, 548); ctx.rotate(-.10); ctx.fillStyle = poster.accent; ctx.fillRect(-130, -28, 260, 56);
      ctx.fillStyle = '#282333'; ctx.font = 'bold 29px sans-serif'; ctx.fillText('FINAL MARKDOWN', 0, 10); ctx.restore();
    } else if (i === 1) {
      ctx.beginPath(); ctx.arc(256, 340, 110, 0, Math.PI * 2); ctx.stroke();
      for (let n = 0; n < 12; n++) { const a = n * Math.PI / 6; ctx.beginPath(); ctx.moveTo(256 + Math.sin(a) * 84, 340 + Math.cos(a) * 84); ctx.lineTo(256 + Math.sin(a) * 96, 340 + Math.cos(a) * 96); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(256, 270); ctx.lineTo(256, 340); ctx.lineTo(308, 375); ctx.stroke();
      ctx.fillRect(126, 520, 260, 38); ctx.fillRect(176, 558, 160, 20);
    } else {
      ctx.fillRect(192, 235, 140, 255); ctx.fillStyle = poster.accent; ctx.fillRect(208, 251, 108, 223);
      ctx.fillStyle = '#282333'; ctx.beginPath(); ctx.moveTo(208, 251); ctx.lineTo(278, 280); ctx.lineTo(278, 488); ctx.lineTo(208, 474); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(208, 474); ctx.lineTo(110, 590); ctx.lineTo(385, 590); ctx.lineTo(316, 474); ctx.closePath(); ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    box('poster_frame', poster.x, .75, L.maxZ - .04, 1.56, 2.40, .05, C.brass);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.46, 2.30), new THREE.MeshBasicMaterial({ map: texture }));
    mesh.name = 'cinema_detail_movie_poster'; mesh.position.set(poster.x, y(1.95), L.maxZ - .08); mesh.rotation.y = Math.PI; kit.group.add(mesh);
  }
  for (const s of c.spawns) {
    const room = s.id.startsWith('lobby') ? L : s.id === 'projection' ? P : A;
    const alongX = s.wall === 'north' || s.wall === 'south';
    const x = alongX ? s.x : s.wall === 'west' ? room.minX + .035 : room.maxX - .035;
    const z = alongX ? s.wall === 'south' ? room.minZ + .035 : room.maxZ - .035 : s.z;
    box('spawn_grille', x, .15, z, alongX ? 1.2 : .045, 1.75, alongX ? .045 : 1.2, C.dark);
    for (let i = 0; i < 7; i++) box('spawn_louvre', x + (alongX ? 0 : s.wall === 'west' ? .035 : -.035), .3 + i * .21,
      z + (alongX ? s.wall === 'south' ? .035 : -.035 : 0), alongX ? 1.1 : .04, .06, alongX ? .04 : 1.1, C.brass);
  }
  const neon = looks.neon('cinema');
  neon.text('CINEMA', { x: -30, y: y(3.9), z: L.maxZ - .07, width: 5, height: .65, facing: -1, color: '#e7a7ce' });

  // One changing texture, no video, flashing light or per-frame canvas redraw.
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 320;
  const ctx = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const root = new THREE.Group(); root.name = 'cinema_presentation'; root.userData.dynamic = true; kit.group.add(root);
  const cx = (A.minX + A.maxX) / 2, sz = A.maxZ - .10;
  box('screen_border', cx, p.screenY - p.screenHeight / 2 - .12, sz + .045,
    p.screenWidth + .25, p.screenHeight + .24, .08, C.dark);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(p.screenWidth, p.screenHeight),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  screen.name = 'cinema_screen'; screen.position.set(cx, y(p.screenY), sz - .015); screen.rotation.y = Math.PI; root.add(screen);
  for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
    box('curtain_fold', cx + side * (p.screenWidth / 2 + .3 + i * .16), .20, sz - .12 + (i % 2) * .10,
      .15, c.height - .4, .17, i % 2 ? C.curtain : C.seatEdge);
  }
  const q = p.projector;
  box('projector_body', q.x, q.h, q.z, .65, .30, .65, C.dark);
  box('projector_mount', q.x, q.h + .30, q.z, .10, c.height - q.h - .3, .10, C.brass);
  box('projector_lens', q.x, q.h + .07, q.z + .36, .22, .16, .12, C.cream, glow(C.cream));
  const apex = new THREE.Vector3(q.x, y(q.h + .15), q.z + .43);
  const corners = [new THREE.Vector3(cx - p.screenWidth / 2, y(p.screenY - p.screenHeight / 2), sz - .04),
    new THREE.Vector3(cx + p.screenWidth / 2, y(p.screenY - p.screenHeight / 2), sz - .04),
    new THREE.Vector3(cx + p.screenWidth / 2, y(p.screenY + p.screenHeight / 2), sz - .04),
    new THREE.Vector3(cx - p.screenWidth / 2, y(p.screenY + p.screenHeight / 2), sz - .04)];
  const vertices = [], uvs = [];
  for (let i = 0; i < 4; i++) {
    for (const v of [apex, corners[i], corners[(i + 1) % 4]]) vertices.push(...v.toArray());
    uvs.push(.5, 0, 0, 1, 1, 1);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  // Feather every face so the beam never reads as a hard translucent wall.
  const beamCanvas = document.createElement('canvas'); beamCanvas.width = 64; beamCanvas.height = 128;
  const bctx = beamCanvas.getContext('2d'), across = bctx.createLinearGradient(0, 0, 64, 0);
  across.addColorStop(0, 'rgba(255,255,255,0)'); across.addColorStop(.5, 'rgba(255,255,255,.7)'); across.addColorStop(1, 'rgba(255,255,255,0)');
  bctx.fillStyle = across; bctx.fillRect(0, 0, 64, 128); bctx.globalCompositeOperation = 'destination-in';
  const along = bctx.createLinearGradient(0, 0, 0, 128);
  along.addColorStop(0, 'rgba(255,255,255,0)'); along.addColorStop(.25, 'rgba(255,255,255,1)'); along.addColorStop(1, 'rgba(255,255,255,0)');
  bctx.fillStyle = along; bctx.fillRect(0, 0, 64, 128); bctx.globalCompositeOperation = 'source-over';
  const beamTexture = new THREE.CanvasTexture(beamCanvas); beamTexture.colorSpace = THREE.SRGBColorSpace;
  const beam = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: C.screen, map: beamTexture, transparent: true,
    opacity: q.beamOpacity, depthWrite: false, side: THREE.DoubleSide }));
  beam.name = 'cinema_projector_beam'; root.add(beam);
  const dustPositions = new Float32Array(12 * 3), dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ map: makeDustMoteTexture(),
    color: C.screen, size: .038, opacity: .16, transparent: true, depthWrite: false }));
  dust.name = 'cinema_projector_dust'; root.add(dust);
  let time = 0, slide = -1, drawnFrame = -1;
  function draw(index) {
    const s = p.slides[index]; ctx.fillStyle = s.base; ctx.fillRect(0, 0, 1024, 320);
    ctx.strokeStyle = s.accent; ctx.lineWidth = 3; ctx.strokeRect(22, 20, 980, 280);
    ctx.fillStyle = s.accent; ctx.textAlign = 'center';
    ctx.font = 'bold 48px sans-serif'; ctx.fillText(s.title, 512, 98);
    ctx.font = '24px sans-serif'; ctx.fillText(s.subtitle, 512, 146);
    ctx.font = '18px sans-serif'; ctx.fillText(s.footer, 512, 280);
    // Quiet moving line art on a fixed-brightness field, never a strobe.
    const phase = time * .35;
    if (index === 0) {
      for (const x of [460, 564]) {
        ctx.beginPath(); ctx.arc(x, 205, 28, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 4; i++) { const a = phase + i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(x, 205); ctx.lineTo(x + Math.cos(a) * 23, 205 + Math.sin(a) * 23); ctx.stroke(); }
      }
    } else if (index === 1) {
      ctx.beginPath(); ctx.arc(512, 205, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(512, 205); ctx.lineTo(512 + Math.sin(phase) * 24, 205 - Math.cos(phase) * 24); ctx.stroke();
    } else if (index === 2) {
      ctx.strokeRect(480, 192, 64, 43);
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(487 + i * 12, 184 + Math.sin(phase + i) * 2, 6, 0, Math.PI * 2); ctx.stroke(); }
    } else {
      ctx.beginPath(); ctx.arc(512, 219, 30, Math.PI, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 4; i++) ctx.fillRect(450 + Math.sin(phase + i) * 5, 223 + i * 5, 124, 1);
    }
    texture.needsUpdate = true; slide = index; drawnFrame = Math.floor(time / detailConfig.motion.screenFrameSeconds);
    screen.userData.slideIndex = index;
  }
  function pose() {
    beam.visible = dust.visible = atmosphere.ambient.enabled;
    const index = Math.floor(time / p.slideSeconds) % p.slides.length; if (index !== slide) draw(index);
    for (let i = 0; i < 12; i++) {
      dustPositions[i * 3] = cx + Math.sin(i * 3.7 + time * .08) * (1.2 + i * .08);
      dustPositions[i * 3 + 1] = y(2.5 + Math.sin(i * 2.3 + time * .13) * .5);
      dustPositions[i * 3 + 2] = 12 + i * .9 + Math.sin(time * .06 + i) * .08;
    }
    dustGeometry.attributes.position.needsUpdate = true; dustGeometry.computeBoundingSphere();
  }
  screen.onBeforeRender = () => {
    // Redraw animation only while the screen is actually rendered. Hidden rooms
    // keep their clock but incur no 5-Hz canvas upload in the rest of the mall.
    if (atmosphere.ambient.enabled && Math.floor(time / detailConfig.motion.screenFrameSeconds) !== drawnFrame) draw(slide);
  };
  draw(0); pose();
  return { root, screen, beam, dust, story,
    update(dt) { if (atmosphere.ambient.enabled) time += dt; pose(); story.update(dt); },
    reset() { time = 0; pose(); draw(0); story.reset(); } };
}
