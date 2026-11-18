# Vault notes: why vaults went sideways (15 November 2026)

Playtest complaint: vaults sometimes go SIDEWAYS. The magnetism (a jump press near a counter or rail waits, then vaults you)
had to stay forgiving. This is what a headless sweep found, before any fix. Rules in force at the time: `feel.vault`
(maxApproachDegrees 65, maxLookDegrees 55, directionSearchDegrees 0/±12/±24, ledge.maxApproachDegrees 70, ledge.maxLookDegrees 70).

## How it was measured

The real `PlayerController` on the real mall colliders (tests/helpers/headlessGame.js, every door open), driven by a STICK
(`input.padMove`) so any angle between movement and view is possible: keys only give 0, 45 and 90 degrees. For each obstacle:
a 3 m run-up at angle `theta` off straight over, the view turned `look` off the movement, sprint or walk, jump pressed when the
body was 0.5 m (in reach) or 2.5 m (the magnet) from the face. Recorded: did it vault, the vault's direction against the view and
against the heading, where it landed, and which obstacle the vault actually crossed. Obstacles: the HOFFMAN'S cosmetics counters
(two 3 m counters 1 m apart), the start-room counter, a Mega Mart checkout, a Food Court bench, the Atrium and Promenade balcony rails.

Cells: `j` a plain jump, a number = it vaulted, and the vault went that many degrees off where you LOOK (+ = to your left).
(Sprinting rows past 50 degrees read a few degrees off because the run-up brushes fixtures; the walking table is clean.)

HOFFMAN'S counter (x -14.6..-11.6, z 9.6..10.4), centre, sprinting, press in reach:

```
theta\look  -90   -60   -45   -30     0    30    45    60    90
     0        j    48    45    30     0   -30   -45   -48     j
    30        j    48    45    30     0   -30   -45   -48     j
    40        j    48    45    30     0   -30   -45   -48     j
    60        j    53    38    23    -7   -37   -52     j     j
```

The same counter, running for the 1 m gap past its east end (toward the next counter) at 50 to 60 degrees: the straight
path's landing was blocked, and a path turned 24 degrees vaulted the corner of THIS counter instead (look -60 to +30, all the
same): turned 24 degrees from your heading, crossing a counter you were not heading for.

Atrium balcony rail (the Promenade rails give the same table), press in reach:

```
theta\look  -90   -60   -45   -30     0    30    45    60    90
     0        j    60    45    30     0   -30   -45   -60     j
    30       60    30    15     0   -30   -60     j     j     j
    50       40    10    -5   -20   -50     j     j     j     j
    70       20   -10   -25   -40   -70     j     j     j     j
```

On a rail the vault always turned you by exactly `theta` from your heading (it goes straight over), and you landed that much
further ALONG the balcony than where you were heading: 0.5 m at 30 degrees, 1 m at 50, 1.4 m at 60, 2.3 m at 70.

## What was real, and the line responsible

1. **Rails threw you over at up to 70 degrees from your heading (the worst one).** `ledgeAhead` (vault.js) climbs a rail
   straight along its normal whenever your path is within `ledge.maxApproachDegrees` 70 of it and your view within
   `ledge.maxLookDegrees` 70. Running along a balcony, drifting 20 degrees toward the rail and looking where you run, a jump
   press turned you 70 degrees and dropped you off the balcony (about 40 damage). The magnet made it worse: it measures a rail's
   gap straight out from the rail, so a press 2.5 m from the rail held the jump and then threw you over anyway.
2. **Counters: nothing checked that you were looking at the counter.** The vault follows your movement (within 65 degrees of
   straight over) and your view only had to be within 55 degrees of that movement, so your view could be up to 120 degrees
   from straight over: looking ALONG a counter (or slightly away from it) while drifting into it diagonally (W+D / W+A, or a
   stick diagonal) vaulted you over it, 45 to 55 degrees off your view. Example: the HOFFMAN'S table, theta 40 look 45 (you look
   along the counter) vaults at -45. The `facing` check (vault.js) compared view with the vault's direction, never with the counter.
3. **A refused look was rescued by turning the path.** `LANDING_REASONS` listed 'not looking where it would take you', so when
   the straight vault failed the look check, `searchPlan` tried paths turned 12 and 24 degrees toward your view and took the
   first that passed. That stretched the 55 degree look limit to 79, and the vault came out turned from your heading (the
   ±60 columns above read 48: a 12 degree turn).
4. **The turned paths could vault a different obstacle.** Each turned path in `searchPlan` called `findObstacle` afresh, so a
   path turned 12 or 24 degrees could pick up a counter the straight path never touched: in HOFFMAN'S (counters 1 m apart)
   running for the gap turned you 24 degrees across the corner of the counter beside it. Related: while the magnet held a press,
   each tick looked for ANY obstacle on your path, so running past the counter you pressed at could vault the next one.
5. **Counter vs rail, keys vs stick.** Counters never turned you except through 3 and 4; rails always turned you by your approach
   angle. Keys only make 0 / 45 / 90 degree offsets, so with keys case 2 is a W+D or W+A diagonal; a stick reaches any angle,
   which is how cases 3 and 4 showed up. Walking and sprinting behave the same.

Not sideways (checked): the path during a counter vault is a straight line along your heading, it does not slide; a counter vault
at 60 degrees crosses the counter top diagonally (3 m along a 0.8 m counter), which is where you were running; the camera's 7 degree
roll during a vault is visual only.

## What changed (the fix, same day)

Each cause fixed in the logic; the one angle change is the rails', where the angle IS the sideways turn.

1. **Rails:** `ledge.maxApproachDegrees` 70 -> 50 and `ledge.maxLookDegrees` 70 -> 45 (feel.js). A climb is still straight over,
   so these are now the most it can turn you from where you run (50; a W+D diagonal at a rail you look straight at is 45, still a
   climb) and from where you look (45). The look check moved into `findObstacle`, per rail, so a rail you are not facing is never
   picked (and never hides one you are). Running along a balcony is a plain jump, at once (the magnet no longer holds it).
2. **Counters:** a new check, `maxFaceDegrees` 65: your view must be within 65 degrees of straight over the face you enter (from
   `crossing()`'s new `over`), per obstacle in `findObstacle`. The vault still follows your movement, and `maxLookDegrees` 55 still
   bounds it against your view; together your view is now at most 65 degrees off the counter instead of 120.
3. **No look rescue:** 'not looking where it would take you' left `LANDING_REASONS`; a straight vault refused for where you look
   stops there.
4. **Same obstacle only:** `searchPlan` finds the obstacle straight ahead once and every turned path may only cross THAT one
   (`findObstacle(..., only)`). The magnet does the same: `ahead()` remembers the obstacle a press was made at, and the held press
   (`controller.vaultHold`: `tryStart({ magnet: true })`, `ahead({ magnet: true })`) only vaults that one.

Kept: the magnet range and wait (3 m, 0.4 s), the air grace, the angled search for blocked landings (now on the same obstacle),
`maxApproachDegrees` 65 and `maxLookDegrees` 55, rails going straight over with no steering on the drop.

After, HOFFMAN'S counter walking (the sprint table differs only where the run-up brushes fixtures):

```
theta\look  -90   -60   -45   -30     0    30    45    60    90
     0        j     j    45    30     0   -30   -45     j     j
    30        j     j    45    30     0   -30     j     j     j
    40        j     j    45    30     0     j     j     j     j
    60        j     j     j    30     0   -30   -45     j     j
```

Atrium rail after:

```
theta\look  -90   -60   -45   -30     0    30    45    60    90
     0        j     j     j    30     0   -30     j     j     j
    30        j    30    15     0   -30     j     j     j     j
    50       40    10    -5   -20     j     j     j     j     j
    70        j     j     j     j     j     j     j     j     j
```

tests/vaultSideways.test.js turns these tables into both sides of the rule; against the old code its four "not sideways" tests
fail on exactly the cases above, and its two "forgiving" tests pass on both.
