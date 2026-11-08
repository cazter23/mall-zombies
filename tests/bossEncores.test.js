import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headlessGame.js';
import { bossIntroRounds, isEncoreRound } from '../src/game/bossDirector.js';
import { bossTiming } from '../src/config/bosses.js';

test('encore cadence is configurable and excludes type and Mascot variant debut rounds', () => {
  const cfg=bossTiming.encores;
  const intros=bossIntroRounds({ newMascot:{unlockRound:cfg.fromRound} });
  assert.equal(isEncoreRound(cfg.fromRound,intros),false);
  assert.equal(isEncoreRound(cfg.fromRound+cfg.everyRounds,intros),true);
  assert.equal(isEncoreRound(cfg.fromRound-1,intros),false);
  assert.equal(isEncoreRound(cfg.fromRound+1,intros),false);
  assert.ok(intros.has(4) && intros.has(6) && intros.has(8) && intros.has(10));
});

test('encores use only encountered bosses, enforce one per round and reset knowledge on Play again',t=>{
  const {g,tick}=headlessGame();
  t.after(()=>{g.resetRun();g.map.dispose();});
  g.health.invulnerable=true;g.rounds.jumpTo(6);g.rounds.update=()=>{};tick();
  const murray=g.bosses.summon('janitor'); assert.ok(murray);
  murray.takeHit({damage:murray.health,part:'body'});
  g.rounds.jumpTo(20); assert.ok(g.bosses.pending);
  const encore=g.bosses.summon(); assert.equal(encore.type.id,'janitor');
  assert.equal(g.bosses.summon('guard'),null);
  encore.takeHit({damage:encore.health,part:'body'});
  g.rounds.jumpTo(21); const doug=g.bosses.summon('guard');assert.ok(doug);
  doug.takeHit({damage:doug.health,part:'body'});
  g.rounds.jumpTo(24); const next=g.bosses.summon();assert.equal(next.type.id,'janitor','prefer a different known boss when possible');
  g.resetRun();g.rounds.jumpTo(20);assert.equal(g.bosses.pending,false);
});
