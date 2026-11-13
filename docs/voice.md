# Sunset Galleria — Voice Guide

Every string in `src/config/` belongs to a specific speaker. Match the voice, tone, punctuation, and length of the pool you edit.

## 1. Mall PA (`config/clawMachine.js` `pa`, `kiosk.js` `pa`, `bosses.js`, `economy.js`, `feel.js`)
- Deadpan corporate-retail intercom: calm, dry, bureaucratic; never excited, panic-stricken, or chatty.
- Never use exclamation marks.
- Treat absurd zombie reality as routine mall policy, store procedure, or customer-service logistics.
- Keep lines short enough to read cleanly during the PA banner window (see `docs/ui-readability.md`).

Real examples:
- `'GRAB-A-GUN is temporarily out of service. Sunny has been informed.'` (`config/clawMachine.js`)
- `"Kevin's cart has relocated to {where}. Mall management did not approve this. Mall management is a zombie."` (`config/kiosk.js`)
- `'One free area unlock. Please return the key to a member of staff who is still alive.'` (`config/bosses.js`)

Never: `'WATCH OUT! Zombies incoming!'`, `'Hey everyone, Kevin moved his cart over to the arcade!'`

## 2. Kiosk Kevin (`config/kiosk.js` `hawk`)
- Pushy, desperate kiosk salesman: loud, frantic, and packed with exclamation marks (`!` or `!!`).
- Keep each line short enough to fit cleanly inside his overhead speech bubble.
- Mix hard-sell pitches (`{product}` placeholders for stock lines) with panicked self-preservation (`duck` / `back`).
- Address the player directly (`you`, `friend`) rather than using passive HR phrasing.

Real examples:
- `'You! You look like someone who needs a {product}!'`
- `'{product}! As seen on TV! The TV is on fire!'`
- `'Everything must go! Including me, ideally!'`

Never: `'Kiosk Kevin clearance items are now available for purchase.'`, `'Buy a Soda Bomb, it deals high area damage.'`

## 3. GRAB-A-GUN Screen (`config/clawMachine.js` `screen`)
- Cheerful, slightly shady arcade cabinet: upbeat carnival hype undercut by rigged fine print naming Sunny.
- `attract` slides are strictly 3 very short lines in ALL CAPS (the CRT screen is tiny).
- Live prompts (`idle`, `sweeping`, `lifting`, `closed`, `soldOut`) stay to 1–2 crisp uppercase words or phrases.
- Reserve `{price}` for the attract/ready prompt; never write sentences or paragraphs.

Real examples:
- `["EVERYONE'S", 'A WINNER*', '{price} PTS']`
- `['NO REFUNDS', '(EXCEPT', 'SUNNY)']`
- `['THE CLAW', 'BELIEVES', 'IN YOU']`

Never: `'INSERT POINTS NOW TO OPERATE THE PRIZE CLAW UNIT'`, `'Out of order. Management apologizes for the inconvenience.'`

## 4. Death Reports — Form 109-C (`config/deathReports.js`)
- Deadpan HR workplace-incident report: `cause` reads like an OSHA/insurance filing; `tip` starts with `'Associate Tip:'`.
- **Words-only rule**: no `%`, multipliers, or raw numbers; describe intensity and behaviour in plain words.
- No exclamation marks; frame fatal attacks as customer-service or safety compliance lapses.
- Ensure every `tip` accurately reflects the enemy or hazard's real mechanic.

Real examples:
- `cause: 'Fatal blunt force trauma from dissatisfied customer'` / `tip: 'Associate Tip: Maintain active floor spacing and backpedal while delivering price markdowns.'`
- `cause: 'Unauthorized impact with moving shopping cart'` / `tip: 'Associate Tip: A rattling cart is taking aim; sidestep as it charges, because it cannot turn.'`
- `cause: 'Self-administered fireworks display, indoors, at close range'` / `tip: 'Associate Tip: Bottle rockets are for the far end of the Hallway. Fireproof attire is available in store.'`

Never: `'You got run over by a cart! Dodge sideways next time!'`, `'Associate Tip: Stay 5 m back — charges deal 45% bonus damage.'`

## 5. Survival Guide Forms (`config/guide.js`)
- **Two voices on one page**: `memo` is the company's printed training sheet (calm, oblivious, bureaucratic, no `!`).
- `notes` and `tip` are a survivor's pen and sticky-note scribbles on top of it: blunt, practical, first-person (`I`, `me`, `you`).
- Handwritten `notes` MAY cite exact stats (`damage`, `hp`), always interpolated from live config (`${shopper.attack.damage}`, `pct(...)`) rather than hardcoded.
- Keep `memo` corporate denial intact ("Visual Merchandising deny all knowledge").

Real examples:
- `memo`: `'Arrived for the sale. Did not leave. Nobody has told them the sale is over, and staff are advised not to volunteer.'`
- `notes`: `` `They walk straight at me and swing when they get close. ${shopper.attack.damage} damage a hit.` ``
- `tip`: `'Let it swing at you and step out of reach, then shoot while it has its hands on its knees.'`

Never: `'25 damage a hit'` (hardcoded number in `notes`), `'RUN FOR YOUR LIFE!!'` (panicked `memo`), or `'Associates should optimize evasion spacing.'` (HR jargon in `tip`).

## 6. Boss Lines (`config/bosses.js`)
- Store-crisis incidents disguised as mall-operations notices (`introBanner`, `phases`, `defeatBanner`): deadpan, no `!`.
- Pair a short title with one crisp sentence; each boss speaks through their literal store role (guard, manager, janitor, customer).
- `phases` explain the active mechanic clearly in character (headshots to cancel lockdown, shooting the presenter, etc.).
- `defeatBanner` closes the fight like an HR log or shift clock-out.

Real examples:
- `janitor.introBanner`: `'Maintenance advisory'` — `'Mopwater Murray is on duty. Please walk, do not run. Murray will run.'`
- `manager.phases.meeting`: `'Staff Meeting'` — `'Attendance is mandatory. Shoot the presenter to submit feedback.'`
- `lastCustomer.defeatBanner`: `'Last customer served'` — `'Lorraine has left the premises. Associates, start the van and clock out.'`

Never: `'BOSS INCOMING: DEFEAT MURRAY!'`, `'Phase 2: Manager gains a 2x speed buff!'`

## 7. HUD & Effect Words (`config/effectWords.js`, `upgrades.js`, `wardrobe.js`, `workshop.js`, `powerUps.js`)
- **Words-only rule**: zero digits with stat units (`%`, `×`, `x`, `s`, `m`, `°`, `→`), enforced by `hasStatNumber`; spell out small counts (`once`, `three`).
- Intensity words come only from `effectWords.js` `sizeBands` (`<= 0.12` `'a little'`, `<= 0.35` `'noticeably'`, above `'much'`) via `{size}` / `{Size}`.
- Keep each line terse and scannable so cards and HUD badges never wrap awkwardly.
- Use plain gear/perk shorthand without hype or exclamation marks.

Real examples (`config/upgrades.js`):
- `'{Size} bigger magazine'`
- `'Reloads {size} faster'`
- `'Run dry? Ammo replaced free, once a round'`

Never: `'+25% bigger magazine'`, `'Reloads 15% faster!'`, `'Free refill for 1 round when mag hits 0'`
