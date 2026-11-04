import * as THREE from 'three';
import { retailUnease as cfg } from '../../config/retailUnease.js';
import { look } from '../../config/look.js';
import { atmosphere } from '../../config/environment.js';

// Called by the existing horror feature. View changes happen only in quiet intervals;
// the mannequin must have been seen, then remain well outside the player's view.
export function buildRetailUnease({ map, player, rounds }) {
  const root = map.group, head = root?.getObjectByName('retail_unease_head');
  const figure = root?.getObjectByName('retail_unease_silhouette');
  if (!head || !figure) return { update() {}, reset() {} };
  const position = new THREE.Vector3(), forward = new THREE.Vector3(), offset = new THREE.Vector3();
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d'), feed = new THREE.CanvasTexture(canvas); feed.colorSpace = THREE.SRGBColorSpace;
  // Keep world positions before batching removes the individual screen meshes.
  const screens = new Set(), screenPositions = [];
  root.traverse(m => { if (m.name === 'television_screen') { screens.add(m.material); screenPositions.push(m.getWorldPosition(new THREE.Vector3())); } });
  for (const material of screens) { material.map = feed; material.color.set(0xffffff); material.needsUpdate = true; }
  function drawFeed(corridor) {
    ctx.fillStyle = '#78b3bd'; ctx.fillRect(0, 0, 256, 128);
    if (corridor) {
      ctx.fillStyle = '#e3d2b8'; ctx.fillRect(0, 0, 256, 88);
      ctx.fillStyle = '#728c88'; ctx.beginPath(); ctx.moveTo(0, 128); ctx.lineTo(106, 70);
      ctx.lineTo(150, 70); ctx.lineTo(256, 128); ctx.fill();
      ctx.strokeStyle = '#465456'; ctx.lineWidth = 2;
      for (const x of [18, 58, 198, 238]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(128 + (x - 128) * .17, 70); ctx.stroke(); }
      ctx.fillStyle = '#304c51'; ctx.fillRect(112, 43, 32, 32);
      ctx.fillStyle = '#fff0b7'; ctx.fillRect(105, 10, 46, 5);
      ctx.fillStyle = '#e7e6c9'; ctx.font = '9px monospace'; ctx.fillText('CAM 01 - CONCOURSE', 8, 117);
    }
    ctx.fillStyle = '#173d4933'; for (let y = 0; y < 128; y += 4) ctx.fillRect(0, y, 256, 1);
    feed.needsUpdate = true;
  }
  const originalX = figure.position.x;
  let seen, away, cooldown, feedTime, figureTime, showing, corridor, active = true;
  function reset() {
    seen = false; away = 0; cooldown = cfg.headCooldown; feedTime = cfg.feedSeconds;
    figureTime = cfg.silhouetteSeconds; showing = 0; corridor = false;
    head.rotation.y = 0; figure.visible = false; figure.position.x = originalX; drawFeed(false);
  }
  function view(object) {
    if (object.isVector3) position.copy(object); else object.getWorldPosition(position);
    offset.subVectors(position, player.position); offset.y -= player.eyeHeight ?? 1.6;
    const distance = offset.length(); return { distance, dot: forward.dot(offset.normalize()) };
  }
  reset();
  return {
    update(dt) {
      if (look.runtime.horror === false || !atmosphere.ambient.enabled) { if (active) reset(); active = false; return; }
      active = true;
      if (!map.zones.atrium?.open) return;
      forward.set(-Math.sin(player.yaw) * Math.cos(player.pitch ?? 0), -Math.sin(player.pitch ?? 0), -Math.cos(player.yaw) * Math.cos(player.pitch ?? 0));
      const gaze = view(head);
      if (gaze.distance > cfg.range) { figure.visible = false; showing = 0; return; }
      cooldown = Math.max(0, cooldown - dt); feedTime -= dt; figureTime -= dt;
      if (gaze.dot > cfg.seenDot) { seen = true; away = 0; }
      else if (gaze.dot < cfg.hiddenDot) away += dt;
      else away = 0;
      if (rounds.inBreak && seen && away >= cfg.awaySeconds && cooldown <= 0) {
        head.rotation.y = head.rotation.y ? 0 : cfg.headAngle; cooldown = cfg.headCooldown; away = 0;
      }
      if (rounds.inBreak && feedTime <= 0) {
        const watched = screenPositions.some(p => view(p).dot > cfg.hiddenDot);
        if (!watched) { corridor = !corridor; drawFeed(corridor); feedTime = cfg.feedSeconds; }
      }
      const distant = view(figure);
      if (showing > 0) {
        showing -= dt; figure.visible = showing > 0 && distant.dot > cfg.seenDot && distant.distance >= cfg.silhouetteMinRange;
        figure.position.x = originalX + .2 * (1 - Math.max(0, showing) / cfg.silhouetteDuration);
      } else if (rounds.inBreak && figureTime <= 0 && distant.dot > cfg.seenDot && distant.distance >= cfg.silhouetteMinRange && distant.distance <= cfg.range) {
        showing = cfg.silhouetteDuration; figure.visible = true; figureTime = cfg.silhouetteSeconds;
      }
    },
    reset,
  };
}
