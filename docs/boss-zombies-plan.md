# Boss zombies: plan

Status: outline, nothing built yet. Numbers here are starting points, to be tuned by playing. Build-A-Blaster and the Mascot are merged, so this can start.
Build one phase at a time, in its own git worktree, and test before the next.

## The idea

A boss is not a bigger zombie. Each one is a mall employee who changes the rules of the round, and each has a clear way to beat that rule:

| Boss | Rule it changes | How you beat it |
|---|---|---|
| The Janitor | The floor turns against you | Keep moving, finish it before the floor is covered |
| The Security Guard | Your escape routes close | Land headshots to break the radio and end the lockdown |
| The Mall Manager | The horde starts following orders | Break up the Staff Meeting before it finishes |
| The Influencer | A follower count brings extra enemies | Keep hitting her to drive the count down |

## Decided

- Four bosses for now, in the order below. Santa and Food Court Karen wait until the first four are good.
- Bosses are employees and they use the Galleria's own language (PA lines, memos, policies).
- Every number goes in `config/`, every price or voucher through `g.pricing`, every payout through the 'kill' event.

## Assumed (say if you disagree)

- **A boss is one extra zombie on a normal round.** The round's zombies still come. It counts as alive, so the round can't end until it dies.
- **One boss per round, maximum.** A boss never shares a round with a new zombie type's first appearance.
- **Bosses show a health bar** at the top of the screen, with their name and job title.
- **Bosses resist control effects.** Stagger is ignored and slows are halved, so Security Sweep, Staff Entrance, Loss Prevention and Product Recall
  can't stun-lock them. Mystery Shopper and Product Recall never mark one. `applyConfusion` refuses a boss, so Glitter can't switch one off, and Antifreeze's shatter
  doesn't count a boss's halved slow as a chill.
- **Full damage from everything else**, including attachments, upgrades, Inventory Liquidation and Build-A-Blaster stuffings.

## When they appear

| Boss | First appears | Health (× a normal zombie that round) | Health at first appearance | Kill value |
|---|---|---|---|---|
| Janitor | Round 5 or 7 | 6 | 2,700 at round 5 | 300 |
| Security Guard | Round 9 or 11 | 10 | 7,500 at round 9 | 750 |
| Mall Manager | Rounds 12 to 14 | 10 | About 10,000 at round 13 | 1,000 |
| Influencer | Round 15 or 17 | 8 | About 9,250 at round 15 | 1,000 |

The windows avoid round 8 (Mannequin) and round 10 (the Mascot). Each run picks from the window, so bosses aren't memorised.
After round 17, a boss comes every 3 rounds, rotating, never the same one twice in a row. Health scales with the round automatically.
Target fight lengths with a gun that suits the round: Janitor 15 s, Guard 30 s, Manager 35 s, Influencer 25 s.

## The bosses

### The Janitor (mini-boss)

Slow (2.2 m/s) and tanky, with a mop, a bucket and a yellow wet floor sign.
- **Wet floor:** leaves a trail of patches that slow the player 30%. At most 6 patches, each lasting 12 s. Zombies ignore them.
- **Clean-up:** mops away a Spill Cleanup patch if he walks through one, so your own incentive is not safe from him.
- **Attack:** a 60-damage mop swing with a longer wind-up than a normal slam.
- **Reward:** a guaranteed incentive drop.

### The Security Guard

3 m/s, too-tight uniform, flashlight, walkie-talkie.
- **Taser lunge:** a smaller version of the Cart Pusher's charge. Telegraphed for 0.8 s, sidestep to dodge, and a miss leaves him stunned and taking
  extra damage. A hit does 40 damage and slows the player for 1 s, without taking away control.
- **Lockdown:** at 75% and 35% health he radios in. After a 3 s alarm, the shutters around the player's area come down for up to 25 s.
  Three headshots break the radio and lift the lockdown early. Only shutters close, so an escalator exit stays open.
- **Backup:** calls 2 Mall Walkers once per lockdown. They come out of the round's remaining zombies, not on top of them.
- **Reward:** the **Master Key**, one free area unlock.

### The Mall Manager

Suit, name badge, clipboard. Walks at 2.4 m/s.
- **Direct Report:** every 8 s he points, and up to 6 zombies he can see within 14 m move 30% faster for 5 s.
- **Staff Meeting:** at 66% and 33% health he stops for 8 s and wheels out a whiteboard. Zombies he can see within 12 m stop and face him. He takes 1.5×
  damage during the meeting. Deal 15% of his maximum health and the meeting is cancelled, leaving him stunned for 3 s. Fail, and every zombie alive gets
  +25% speed and damage for 20 s.
- **Attack:** a 60-damage clipboard slam.
- **Reward:** the **Signed Approval**, one free Extended Warranty tier, up to Premium.

### The Influencer

Ring light, selfie stick, always filming. She doesn't chase you. She moves between spots and keeps 10 to 16 m away.
- **Followers:** a counter on the boss bar climbs over time. A hit lowers it, and a headshot lowers it more.
- **Fans:** at 25%, 50% and 75% of the counter, 3 fans rush in. At 100% she goes viral: 8 fans arrive and the counter falls back to 50%.
- **Fans are paid nothing.** They are the only zombies added on top of a round, so they give no points and no incentive credit. Otherwise she'd be a points farm.
  They have half health and still count against the round's maximum alive.
- **Phone flash:** a short, mild white flash if you get within 5 m, with a wind-up so you can look away.
- **Reward:** the **Discount Code**, 50% off your next purchase, saving up to 2,000. It doesn't work on the claw machine (docs/claw-machine-plan.md).

## Rewards

Rewards are one-use vouchers held until spent and shown on the HUD. If a voucher can't be used (every area already owned, every gun at the top tier), it pays
points instead. `pricing.js` needs a voucher slot of its own: its existing coupon has only one slot, and Employee Discount's end clears it.

## How it fits the code

- **New `config/bosses.js`:** schedule, health multipliers, attack numbers, rewards, PA lines. Kill values go in `economy.killValues`.
- **Not in `economy.zombieMix`:** `zombieTypeForRound` and `nextType` expect the fields every regular type has, and bosses must never be picked at random.
  `zombieHealthFor` is taught to read the boss table too.
- **New `game/bossDirector.js`** (built in createGame, DOM-free): chooses each run's schedule on 'roundStart', spawns the boss partway through the round, ignores the Returns
  Chute's spawn steering so a boss never falls out of the hatch, retries if no spawn point is free, and notices a boss that vanished without a kill (the debug round skip calls `zombies.clear()`).
- **New `zombies/bosses/`:** one behaviour module and one model file per boss. `zombie.js` gets one small hook that hands control to the behaviour,
  so it doesn't grow four more sets of states.
- **Big look, normal body:** every zombie shares one navigation grid sized for the Shopper, so a boss's `radius` stays at or below the Cart Pusher's 0.42.
  The model and hitboxes can be larger. Bosses don't take a surround slot.
- **New events:** 'bossSpawn', 'bossPhase', 'bossDefeated' (listed in `events.js`). The HUD bar, PA lines, rewards and run stats listen for them.
- **Zombie buffs:** `applySlow` exists, but speed and damage boosts are new. A per-zombie damage multiplier is needed too, because attack damage comes from the type.
- **Meeting hold:** `zombie.frozen` is cleared and recalculated every tick for Mannequins, so the Staff Meeting needs its own hold. The stuck-zombie failsafe must skip it.
- **Lockdown:** calls `barrier.close()` and `barrier.open()` directly. It must never use `door.reset()`, which removes the player's ownership of the area. The
  navigation grid already rebuilds when a shutter moves. A shutter waits until nobody is standing under it. Zombies left outside get an unreachable route and the
  failsafe brings them back to a reachable spawn point, which takes up to 10 s.
- **Reset order:** the boss director and any lockdown reset before the `doors` step in `resetSteps`, or a late release reopens a shutter on the new run.

## Phases

### 1. Framework and the Janitor (Opus or Sol)
The config, director, schedule, health, boss bar, intro sting, events, debug command to summon a boss, and "Bosses defeated" in the run stats. The Janitor is first because
he is the simplest, so he proves the framework before anything hard depends on it.
Done when: a boss spawns on schedule, the round waits for it, it pays once, it can reach you anywhere in the mall, and death, Play again and a debug round skip all leave nothing behind.

### 2. The Mall Manager (Opus or Sol)
Direct Report, Staff Meeting, the buff system, the Signed Approval and the voucher slot.
Done when: a hold always ends (boss killed, meeting over, player dead), buffs expire, and a voucher survives a Flash Sale and an Employee Discount.

### 3. The Security Guard (Opus or Sol)
The taser lunge, lockdown, backup and Master Key. This phase includes a small map helper that says which shutters surround the player's area.
Done when: a lockdown can't trap the round. Tests cover every area, a player under a shutter, the boss dying mid-lockdown, the player dying mid-lockdown, and
area ownership being unchanged afterwards.

### 4. The Influencer (Opus or Sol for her movement, Sonnet or Luna for the rest)
Spot-to-spot movement, the follower counter, fans, phone flash and the Discount Code.
Done when: fans pay nothing, rounds still end, and she can't stand somewhere the player can't reach or shoot.

### 5. Spectacle and balance (Sonnet or Luna)
Finished models, boss music stings, deaths worthy of a boss, PA lines, and a humour pass. Add boss rows to `npm run balance`, then tune health, rewards and timing against the
economy report and real play.

### Later
- **Food Court Karen:** throws zombies, demands to see the manager, and is enraged if you've already killed him. Needs Food Court counters as targets.
- **Santa:** the late boss, with explosive presents and the Naughty List. Needs a Santa's Grotto in the map. A good candidate for a final boss.

## Tests to add

`tests/bosses.test.js`, plus one file per boss, using `headlessGame()`. Build the map before seeding `Math.random`.
- Schedule: first appearances stay in their windows, with never two bosses in a round.
- Rounds: the round waits for the boss, and fans and backup can't hang a round.
- Payouts: a boss pays once whatever kills it, and fans pay nothing.
- Control effects: no stun-locking, and no Mystery Shopper or Product Recall marks.
- Reset: death and Play again during every boss state leave no holds, buffs, patches, shutters or vouchers behind.
- Reachability: each boss can reach the player from every open zone.

## Rules to keep

- Update `docs/folder-structure.md`, `docs/tests.md` and `docs/history.md` with each phase.
- Run `npm test` and `npm run build` before every commit.
- Nothing else edits `zombie.js` or `zombieManager.js` during phase 1.
