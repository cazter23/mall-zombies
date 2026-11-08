# UI readability

The existing mall directory, paper forms, receipt typography, boss treatments and
PA intercom are retained. `src/ui/readability.css` refines their typography and
layout after `retail.css`.

- Comfort settings save **UI scale** (85–135%) and **Text size** (100–150%)
  independently of 3D render resolution. The shared type/spacing tokens grow
  gently above 1080 CSS pixels in height. Combat text growth is bounded by the
  available screen width; compounded enlargement uses compact benefit summaries.
- Interactions show readable action/price headings and separate comparison terms
  on a dark backing. Buff names, timers and charges have their own hierarchy.
- Left HUD cards flow vertically. Bosses occupy a center lane; sales, PA and
  compact certificate notices occupy a right lane. Workshop orders start below
  the measured boss display and reserve the bottom strip for health/stamina.
- Settings and Controls scroll their content while retaining their footer. The
  Controls diagram falls back to a readable list when its labels would shrink.
  Controller D-pad scrolls the Controls list and the correspondence archive.
- The workshop scrolls choices/summary, keeps order/cancel visible, and follows
  keyboard/controller selection. At narrow widths its columns stack vertically.
- PA reading time follows message length (4.5–12 seconds); purchases remain for
  3 seconds and certificate summaries for 12 seconds. Presentation timers do not
  affect combat or purchases.
- Pause/results → **Notices & certificates** retains the latest 30 PA messages and 8
  complete certificates for the run, including instructions preempted by another
  announcement. Pausing/death hides transient notices without clearing the file;
  a new run clears it. Narrow layouts prioritize interactions/orders over PA
  popups, with their full text still available in this archive.

`tests/uiReadability.test.js` covers archive bounds/copies/reset and independent
saved scale settings. `tests/retailUi.test.js` covers message-length timing and
queue/display duration agreement alongside the existing purchase/PA tests.
Real-browser checks cover menus, HUD lanes, workshop footer/selection, archive
keyboard behavior and default/combined enlarged settings at desktop and narrow
viewports.
