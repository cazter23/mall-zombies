import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headlessGame.js';
import { bossIntroRounds, isEncoreRound } from '../src/game/bossDirector.js';
import { bossTiming, bossTypes } from '../src/config/bosses.js';

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

test('first boss fights show introBanner, round 20 encores show encoreBanner, and Play again restores introBanner', (t) => {
  const { g, hud, sounds, tick } = headlessGame();
  t.after(() => { g.resetRun(); g.map.dispose(); });
  g.health.invulnerable = true;

  const spawns = [];
  g.events.on('bossSpawn', ({ zombie, encore }) => spawns.push({ id: zombie.type.id, encore }));
  const announcements = (from) => hud.calls.slice(from).filter(([name]) => name === 'showAnnouncement').map(([, a]) => a);

  // First fight: Mopwater Murray in round 6 -> encore: false, introBanner.
  g.rounds.jumpTo(6);
  g.rounds.update = () => {};
  tick();
  let h = hud.calls.length;
  let s = sounds.length;
  const murray = g.bosses.summon('janitor');
  assert.ok(murray);
  assert.deepEqual(spawns.at(-1), { id: 'janitor', encore: false });
  assert.deepEqual(announcements(h), [{ ...bossTypes.janitor.introBanner, priority: bossTiming.introPriority }]);
  assert.ok(sounds.slice(s).includes(bossTypes.janitor.introSound));
  murray.takeHit({ damage: murray.health, part: 'body' });

  // Round 20 encore of a previously encountered boss -> encore: true, encoreBanner.
  g.rounds.jumpTo(20);
  h = hud.calls.length;
  s = sounds.length;
  const encore = g.bosses.summon();
  assert.equal(encore.type.id, 'janitor');
  assert.deepEqual(spawns.at(-1), { id: 'janitor', encore: true });
  const encoreShown = announcements(h);
  assert.equal(encoreShown.length, 1);
  assert.equal(encoreShown[0].kicker, bossTypes.janitor.encoreBanner.kicker);
  assert.equal(encoreShown[0].priority, bossTiming.introPriority);
  assert.ok(bossTypes.janitor.encoreBanner.lines.includes(encoreShown[0].text));
  assert.notEqual(encoreShown[0].text, bossTypes.janitor.introBanner.text);
  assert.ok(sounds.slice(s).includes(bossTypes.janitor.introSound));
  encore.takeHit({ damage: encore.health, part: 'body' });

  // An unmet boss summoned on round 20 is still a first fight -> introBanner, not encoreBanner.
  g.rounds.jumpTo(21);
  h = hud.calls.length;
  const kettle = g.bosses.summon('guard');
  assert.ok(kettle);
  assert.deepEqual(spawns.at(-1), { id: 'guard', encore: false });
  assert.deepEqual(announcements(h), [{ ...bossTypes.guard.introBanner, priority: bossTiming.introPriority }]);
  kettle.takeHit({ damage: kettle.health, part: 'body' });

  // After Play again (resetRun), encountered knowledge is cleared so the next summon uses introBanner again.
  g.resetRun();
  g.rounds.jumpTo(6);
  g.rounds.update = () => {};
  tick();
  h = hud.calls.length;
  const freshMurray = g.bosses.summon('janitor');
  assert.ok(freshMurray);
  assert.deepEqual(spawns.at(-1), { id: 'janitor', encore: false });
  assert.deepEqual(announcements(h), [{ ...bossTypes.janitor.introBanner, priority: bossTiming.introPriority }]);
});
