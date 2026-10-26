import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeaponTrial } from './helpers/weaponTrial.js';
import { weapons } from '../src/config/weapons.js';

test('weapon pass: bounded headshot rewards and real round-8/10 combat separate the early gun from premium automatics', () => {
  for (const gun of Object.values(weapons)) assert.ok(gun.headshotMultiplier >= 1.2 && gun.headshotMultiplier <= 2, gun.id);
  const trial = createWeaponTrial();
  try {
    for (const round of [8, 10]) {
      const results = Object.fromEntries(['priceGun', 'foamDartBlaster', 'rivetRifle', 'coilNailer']
        .map(id => [id, trial.run({ id, round })]));
      for (const result of Object.values(results)) {
        assert.equal(result.kills, 1, JSON.stringify(result));
        assert.equal(result.shots, result.hits, 'close aimed body shots land reliably');
        assert.equal(result.headKills, 0, 'body trial does not accidentally score headshots');
      }
      for (const id of ['foamDartBlaster', 'rivetRifle', 'coilNailer'])
        assert.ok(results[id].seconds < results.priceGun.seconds, `${id} is a real upgrade at round ${round}`);
      assert.equal(results.priceGun.reloads, round === 10 ? 1 : 0, 'smaller Price magazine creates its intended breakpoint');
      const head = trial.run({ id: 'rivetRifle', round, part: 'head' });
      assert.equal(head.headKills, 1); assert.ok(head.shots < results.rivetRifle.shots);
    }
    const sustained = trial.run({ id: 'coilNailer', round: 8, count: 5 });
    assert.equal(sustained.kills, 5); assert.ok(sustained.reloads >= 1, 'large drum still requires a real reload');
    const upgraded = trial.run({ id: 'rivetRifle', round: 17, tier: 'premium' });
    assert.ok(upgraded.kills === 1 && upgraded.reloads === 0, 'equal-tier progression remains viable');
    const longPrice = trial.run({ id: 'priceGun', round: 8, range: 30 });
    const longFoam = trial.run({ id: 'foamDartBlaster', round: 8, range: 30 });
    assert.equal(longPrice.kills, 1, 'the controlled hallway sightline must be unobstructed');
    assert.equal(longFoam.kills, 1);
    assert.ok(longFoam.seconds < longPrice.seconds, 'Foam offers reliable ranged performance over Price');
  } finally { trial.dispose(); }
});
