# Codex Design Re-Review

## 1. Summary

The second pass shows meaningful progress against the previous review: duplicate customer headers were removed, several customer/admin screens were moved closer to `docs/design-bundle/`, missing CSS fragments were restored, and `npm test` passes.

However, not all previous findings are fully resolved. The implementation still has important design-bundle mismatches and one functional regression risk in the recommended menu area: `RecommendedBanner` renders clickable menu cards, but `MenuPage` does not pass `onAdd`, so the visible "줍기" buttons in that banner do nothing. The current verdict is **NEEDS FIXES**.

## 2. Review Scope

- Reviewed previous report: `docs/codexdesignreview.md`.
- Reviewed design source of truth: `docs/design-bundle/`.
- Reviewed helper document: `docs/DESIGN_BUNDLE_AUDIT.md`.
- Root-level `design-bundle/` was not present; `docs/design-bundle/` was the available design bundle in this repository.
- Reviewed current staged changes: none found by `git diff --cached --name-status`.
- Reviewed current unstaged changes:
  - `index.html`
  - `src/components/layouts/AdminLayout.jsx`
  - `src/components/layouts/CustomerLayout.jsx`
  - `src/components/molecules/DogTagFrame.jsx`
  - `src/components/molecules/MascotState.jsx`
  - `src/components/organisms/BoothMinimapModal.jsx`
  - `src/components/organisms/CartItem.jsx`
  - `src/components/organisms/CategoryTabs.jsx`
  - `src/components/organisms/ClosedScreen.jsx`
  - `src/components/organisms/MenuCard.jsx`
  - `src/components/organisms/MenuList.jsx`
  - `src/components/organisms/OrderTimeline.jsx`
  - `src/components/organisms/RecommendedBanner.jsx`
  - `src/components/organisms/StickyCartBar.jsx`
  - `src/pages/admin/DashboardPage.jsx`
  - `src/pages/admin/LoginPage.jsx`
  - `src/pages/admin/MenuAdminPage.jsx`
  - `src/pages/customer/CartPage.jsx`
  - `src/pages/customer/CheckoutPage.jsx`
  - `src/pages/customer/CompletePage.jsx`
  - `src/pages/customer/ErrorPage.jsx`
  - `src/pages/customer/MenuPage.jsx`
  - `src/pages/customer/StatusPage.jsx`
  - `src/pages/customer/TransferPage.jsx`
  - `src/styles/components.css`
- Reviewed current untracked files:
  - `backups/`
  - `docs/DESIGN_BUNDLE_AUDIT.md`
  - `docs/codexdesignreview-fix-report.md`
  - `docs/codexdesignreview.md`
  - `public/items/*.webp`
  - `public/mascot/mascot.png`
- Checked `.env` and `.env.example` diffs: no changes detected.
- Commands run are listed in section 11.

## 3. Previous Findings Resolution

1. Original finding summary: duplicate customer headers on complete/status/closed flows.
   - Resolution status: RESOLVED
   - Evidence: `CustomerLayout.jsx` still owns the shared header, while `CompletePage.jsx`, `StatusPage.jsx`, and `ClosedScreen.jsx` no longer render their own `app-header`.
   - Remaining issue: none found for this item.

2. Original finding summary: checkout page did not match the design-bundle table/coupon/receipt/sticky total structure.
   - Resolution status: PARTIALLY RESOLVED
   - Evidence: `src/pages/customer/CheckoutPage.jsx:85-104` now has a 1-12 table selector and coupon section; `src/pages/customer/CheckoutPage.jsx:105-115` restores receipt and sticky submit structure.
   - Remaining issue: the table selector uses `aria-pressed` buttons and `aria-labelledby="tableNo"` pointing at a visually hidden input, while the design-bundle uses radio-like selection semantics for this flow (`docs/design-bundle/screens-customer.jsx:297-318`).

3. Original finding summary: status page did not match design-bundle timeline, mascot, dog tag, banners, and sticky state actions.
   - Resolution status: PARTIALLY RESOLVED
   - Evidence: `src/pages/customer/StatusPage.jsx:67-89` now renders `OrderTimeline`, `MascotState`, status copy, ready/HOLD messaging, and sticky state actions.
   - Remaining issue: the design-bundle includes a small pulsing `DogTag` under the mascot (`docs/design-bundle/screens-customer.jsx:605-607`), but `StatusPage.jsx` imports no `DogTag` and does not render it.

4. Original finding summary: admin login screen did not match the design-bundle PIN keypad.
   - Resolution status: PARTIALLY RESOLVED
   - Evidence: `src/pages/admin/LoginPage.jsx` now uses the PIN cell/keypad/shake structure.
   - Remaining issue: design-bundle uses a 4-digit PIN (`docs/design-bundle/screens-admin.jsx:145-177`), while the implementation keeps a 6-cell PIN flow. This may be intentional for backend compatibility, but it is not an exact design-bundle match.

5. Original finding summary: admin top navigation was missing source tabs and business/user/logout details.
   - Resolution status: PARTIALLY RESOLVED
   - Evidence: `src/components/layouts/AdminLayout.jsx:15-21` now includes 본부/메뉴/내역/정산/이체확인/쿠폰, and the layout includes business badge/user/logout controls.
   - Remaining issue: the design-bundle top nav has five tabs: dashboard, menus, history, settlement, coupons (`docs/design-bundle/screens-admin.jsx:51-61`). The implementation adds `이체확인` as a main nav item and marks `내역` and `쿠폰` disabled, so the top-nav behavior is still not source-accurate.

6. Original finding summary: menu categories and recommended area did not match design-bundle.
   - Resolution status: PARTIALLY RESOLVED
   - Evidence: `src/pages/customer/MenuPage.jsx` now includes recommendation/category behavior, and assets are copied into `public/items/`.
   - Remaining issue: design-bundle shows `best-banner` as a compact banner before the normal menu grid (`docs/design-bundle/screens-customer.jsx:62-78`). The implementation renders a separate `best-grid` of `MenuCard`s (`src/components/organisms/RecommendedBanner.jsx:34-44`), and `MenuPage.jsx:45` does not pass `onAdd`, making those visible card buttons nonfunctional.

7. Original finding summary: complete and transfer flows were missing design-bundle payment guidance and sticky actions.
   - Resolution status: PARTIALLY RESOLVED
   - Evidence: `src/pages/customer/CompletePage.jsx` now includes the payment receipt, warning/info copy, and sticky actions.
   - Remaining issue: `src/pages/customer/TransferPage.jsx:80-86` delegates submission to the inline `TransferReportForm`; the design-bundle uses a page-level sticky bar for the transfer submit CTA (`docs/design-bundle/screens-customer.jsx:557-561`).

8. Original finding summary: CSS diverged from design-bundle, including missing log feed, scrollbar, and modal overscroll pieces.
   - Resolution status: RESOLVED
   - Evidence: `src/styles/components.css:1083` contains `overscroll-behavior: contain`; `src/styles/components.css:2052-2057` restores scrollbar hover styling; `src/styles/components.css:2086` restores `.log-feed`.
   - Remaining issue: none found for the specifically reported missing CSS pieces.

9. Original finding summary: `MenuAdminPage` did not use the design-bundle admin-table structure.
   - Resolution status: RESOLVED
   - Evidence: `src/pages/admin/MenuAdminPage.jsx` now renders the `.admin-table`, `.admin-table-head`, `.admin-table-row`, `tbl-thumb`, ammo, price display, and toggle structures.
   - Remaining issue: none found for this item.

10. Original finding summary: minimap modal was missing focus trap and overscroll containment.
    - Resolution status: RESOLVED
    - Evidence: `src/components/organisms/BoothMinimapModal.jsx:27-39` handles focus trapping; `src/styles/components.css:1083` adds overscroll containment.
    - Remaining issue: none found in static review.

11. Original finding summary: customer header brand copy did not match design-bundle.
    - Resolution status: RESOLVED
    - Evidence: `src/components/layouts/CustomerLayout.jsx` now uses the visible Korean brand phrase and keeps screen-reader support.
    - Remaining issue: none found for this item.

12. Original finding summary: image dimensions were missing on key design assets.
    - Resolution status: RESOLVED
    - Evidence: `src/components/organisms/MenuCard.jsx:75-82`, `src/components/molecules/MascotState.jsx:60-67`, and `src/components/organisms/BoothMinimapModal.jsx:90` now include dimensions for the previously called-out images.
    - Remaining issue: a separate current issue remains in `CartItem.jsx`, listed under new findings.

## 4. New Findings

### P1

- Severity: P1
  - File path: `src/pages/customer/MenuPage.jsx`, `src/components/organisms/RecommendedBanner.jsx`, `src/components/organisms/MenuCard.jsx`
  - Problem: The recommended banner renders interactive `MenuCard` buttons, but `MenuPage.jsx:45` calls `<RecommendedBanner menus={popular} />` without `onAdd`. `MenuCard.jsx:44` uses optional chaining, so clicking the visible "줍기" button in the recommended area is a no-op.
  - Why it matters: This creates a user-visible broken ordering action and also diverges from the design-bundle, where the BEST area is a banner and the normal menu grid owns item selection.
  - Evidence from design-bundle or current implementation: `docs/design-bundle/screens-customer.jsx:62-78` shows `best-banner` followed by the normal `menu-grid`; `src/components/organisms/RecommendedBanner.jsx:34-44` renders three `MenuCard`s; `src/pages/customer/MenuPage.jsx:55` passes `onAdd` only to `MenuList`.
  - Suggested fix: Align the recommended area with the design-bundle banner behavior, or pass the same add handler to every visible `MenuCard` if product requirements intentionally keep interactive cards.

### P2

- Severity: P2
  - File path: `src/components/layouts/AdminLayout.jsx`
  - Problem: Admin top nav still does not match the design-bundle tab model.
  - Why it matters: The source design has five operational tabs, but the implementation exposes six nav items and disables two source tabs. This changes the admin information architecture and leaves design-bundle flows unreachable from the main nav.
  - Evidence from design-bundle or current implementation: `docs/design-bundle/screens-admin.jsx:51-61` lists dashboard, menus, history, settlement, coupons. `src/components/layouts/AdminLayout.jsx:15-21` adds `/admin/transfers` and disables `/admin/history` and `/admin/coupons`.
  - Suggested fix: Match the design-bundle tab set and preserve `/admin/transfers` outside the main tab model if that route must remain.

- Severity: P2
  - File path: `src/pages/customer/StatusPage.jsx`
  - Problem: The status page still omits the small `DogTag` element under the mascot.
  - Why it matters: The dog tag is part of the source layout and visual identity for the status screen, including the READY pulse behavior.
  - Evidence from design-bundle or current implementation: `docs/design-bundle/screens-customer.jsx:605-607` renders `<DogTag no={order.id} size="sm" pulse={order.status === 'READY'} />`; `src/pages/customer/StatusPage.jsx:67-89` renders timeline, mascot, copy, and sticky controls but no `DogTag`.
  - Suggested fix: Restore the dog tag in the source-bundle position without changing the existing order status logic.

- Severity: P2
  - File path: `src/pages/customer/TransferPage.jsx`, `src/components/organisms/TransferReportForm.jsx`
  - Problem: The transfer submit CTA remains inline inside the form instead of the page-level sticky bar shown in the design-bundle.
  - Why it matters: On mobile, the design expects the primary transfer confirmation action to remain fixed at the bottom. Inline placement can bury the main action after form content and diverges from the customer flow.
  - Evidence from design-bundle or current implementation: `docs/design-bundle/screens-customer.jsx:557-561` shows the sticky transfer submit bar; `src/components/organisms/TransferReportForm.jsx:197-199` places the submit button inside the form.
  - Suggested fix: Keep form validation/API behavior intact, but expose the primary submit action in the page-level sticky bar required by the design-bundle.

- Severity: P2
  - File path: `src/pages/customer/CheckoutPage.jsx`
  - Problem: The table selector is visually close but semantically inconsistent.
  - Why it matters: Keyboard and screen-reader users may not get a proper radio-group experience for selecting one table number.
  - Evidence from design-bundle or current implementation: `src/pages/customer/CheckoutPage.jsx:86-93` uses a `radiogroup`, `aria-labelledby="tableNo"`, `aria-pressed`, and a hidden input. The design-bundle selection pattern uses radio-style checked state for the flow (`docs/design-bundle/screens-customer.jsx:297-318`).
  - Suggested fix: Use consistent radio semantics for the selector and ensure the radiogroup is labelled by visible text.

### P3

- Severity: P3
  - File path: `src/components/organisms/CartItem.jsx`
  - Problem: Cart item thumbnail images still omit explicit `width` and `height`.
  - Why it matters: Other fixed image findings were addressed, but this thumbnail can still contribute to layout shift if image dimensions are not constrained by CSS before load.
  - Evidence from design-bundle or current implementation: `src/components/organisms/CartItem.jsx:51` renders `<img src={menu.image} alt={menu.name} />`, while the updated image components now include dimensions.
  - Suggested fix: Add explicit dimensions or equivalent stable sizing for cart thumbnails.

- Severity: P3
  - File path: `src/styles/components.css`
  - Problem: `.input:focus, .select:focus` removes the outline and only changes border color.
  - Why it matters: This can weaken keyboard focus visibility, especially on lower-contrast displays.
  - Evidence from design-bundle or current implementation: `src/styles/components.css:615-618` sets `outline: none`.
  - Suggested fix: Preserve a visible focus ring or add an equivalent high-contrast focus indicator.

## 5. Design-Bundle Compliance

- Layout: Improved on checkout, complete, status, admin login, menu admin, and modal. Still mismatched in recommended menu layout, admin top nav, status dog tag, and transfer sticky CTA.
- Spacing: Most restored sections use design-bundle classes (`section`, `receipt`, `sticky-bar`, `admin-table`), but inline style patches remain in checkout/status/transfer and may drift from source spacing tokens.
- Colors: Restored CSS tokens and key classes are present. No unrelated one-off palette was found in the reviewed changes.
- Typography: Main source classes are now used more consistently. No new typography system was introduced.
- Border radius: No new radius system was found. Components continue to rely on the existing design-bundle classes and CSS variables.
- Shadows: No obvious new shadow direction was introduced beyond existing bundle classes.
- Icons: Existing emoji/icon language is mostly retained. Admin nav includes an extra transfer route not present in the source tab set.
- Emojis: Customer/payment/status emoji usage generally follows the bundle language. No unrelated placeholder emoji set was detected.
- Images/assets: `public/items/*.webp` and `public/mascot/mascot.png` match the corresponding `docs/design-bundle/assets/` hashes. No placeholder replacement asset was detected in the copied item/mascot assets.
- Motion: Login shake and status pulse are present. The status DogTag READY pulse remains missing because the DogTag itself is not rendered.
- Interactions: Major interaction issue remains in the recommended banner card buttons. Modal focus handling improved.
- Responsive behavior: Sticky bars were restored in several flows, but transfer still lacks the design-bundle page-level sticky submit CTA. Recommended cards can also add extra vertical density that is not shown in the source bundle.

## 6. Functional Regression Risks

- Routing: Existing routes appear preserved, including `/admin/transfers`, but that route is now presented as a main nav tab even though the design-bundle does not include it in the top tab set.
- API calls: The reviewed customer checkout, transfer, status, and admin menu pages still call the expected APIs. `npm test` passing gives partial confidence here.
- State handling: Cart/menu/order state logic is mostly preserved. The recommended banner button no-op is a concrete state-handling regression risk because clicks do not add items.
- Forms: Checkout and transfer still submit through existing API paths. Checkout table selection needs better single-select semantics.
- Buttons: Recommended banner `MenuCard` buttons are visible but nonfunctional. Admin disabled nav buttons prevent access to source-bundle tabs.
- Modals: Minimap focus trap and overscroll handling improved; no new modal regression was found in static review.
- Links: Customer back-bar links and admin nav links were inspected statically; no broken path was proven, but admin history/coupons are disabled rather than routed.
- Loading states: Existing `LoadingState` branches remain present in reviewed pages.
- Error states: Existing `ErrorState` and inline error branches remain present in reviewed pages.
- Existing user flows: Menu ordering from the normal `MenuList` still passes `onAdd`; recommended-card ordering is the main broken flow found.

## 7. Accessibility and Responsive Issues

- Keyboard navigation: Modal focus trap improved. Checkout table selector should use proper radio semantics and visible labelling.
- Focus states: `src/styles/components.css:615-618` removes outline on inputs/selects; this should be replaced with a clearly visible focus indicator.
- Semantic HTML: Recommended banner cards create extra interactive controls that are not represented in the source design. Checkout selection semantics need cleanup.
- Contrast risks: No definitive contrast failure was verified without browser rendering. `npm test` emitted jsdom/axe `getComputedStyle` warnings, so automated contrast checks are not fully reliable in this environment.
- Alt text: Main menu/mascot/modal images have alt text. `CartItem` image alt text is present but the thumbnail wrapper is decorative in structure; confirm intended announcement behavior visually and with a screen reader.
- Mobile/tablet/desktop risks: Transfer submit is not sticky as designed. Recommended `best-grid` can increase vertical scroll and move the real menu grid down compared with the source design.

## 8. Code Quality Issues

- Duplicated styling: Inline styles remain in checkout/status/transfer for layout details already represented in design-bundle CSS patterns.
- Unused components/CSS: No full unused-component proof was established, but `RecommendedBanner` comments describe a `MenuCard` grid that conflicts with the source bundle and current behavior.
- Inconsistent style systems: The codebase still mixes bundle CSS classes with inline styles and occasional utility-style class comments. This is manageable but makes source-bundle parity harder to audit.
- Hardcoded values: Checkout table grid and sticky status styles are hardcoded inline. Some are source-derived, but they should be centralized if repeated.
- Maintainability: Admin nav now encodes disabled design-bundle tabs plus an extra app route in the same item list. This makes it unclear which nav model is authoritative.
- Repository hygiene: Untracked backup zip files are present under `backups/`. They were not inspected as source changes and should not be allowed to obscure review scope.

## 9. Final Verdict

**NEEDS FIXES**: Important design-bundle and interaction issues remain. The most serious issue is the recommended banner's visible nonfunctional add buttons. Several previous findings are only partially resolved, especially admin top nav, status DogTag, transfer sticky CTA, and checkout selection semantics.

## 10. Recommended Fix Order

1. Fix the recommended banner mismatch and no-op add buttons.
2. Align admin top nav with the design-bundle tab set while preserving any necessary existing route outside the main nav.
3. Restore the status screen DogTag in the source-bundle position.
4. Move or expose transfer submission through the design-bundle sticky CTA while preserving form/API behavior.
5. Correct checkout table selector semantics and visible labelling.
6. Add stable dimensions for `CartItem` thumbnails.
7. Replace `outline: none` focus handling with a visible focus indicator.
8. Review and remove untracked backup artifacts from the change set if they are not intended deliverables.

## 11. Commands Run

- `git -c safe.directory=C:/ACoding/09_order status --short`
  - Result: listed 25 modified tracked files and untracked docs/assets/backups. Git emitted warnings about denied access to `C:\Users\user/.config/git/ignore`.
- `git -c safe.directory=C:/ACoding/09_order diff --name-status`
  - Result: listed unstaged modified files.
- `git -c safe.directory=C:/ACoding/09_order diff --cached --name-status`
  - Result: no staged file changes.
- `git -c safe.directory=C:/ACoding/09_order ls-files --others --exclude-standard`
  - Result: listed untracked backup zips, review/audit docs, and copied public assets.
- `Get-Content -Raw docs\codexdesignreview.md`
  - Result: previous Codex review was available and reviewed; console encoding rendered some Korean text garbled.
- `Get-Content -Raw docs\codexdesignreview-fix-report.md`
  - Result: reviewed as an untrusted implementation self-report, not as source of truth.
- `Test-Path design-bundle; Test-Path docs\design-bundle; Test-Path docs\DESIGN_BUNDLE_AUDIT.md; Test-Path .env`
  - Result: root `design-bundle` not found; `docs\design-bundle`, `docs\DESIGN_BUNDLE_AUDIT.md`, and `.env` found.
- `git -c safe.directory=C:/ACoding/09_order diff --stat`
  - Result: confirmed the changed-file volume and that the review scope was broad design/UI work.
- `git -c safe.directory=C:/ACoding/09_order diff -- .env .env.example`
  - Result: no diff output; no `.env` or `.env.example` changes detected.
- `Get-FileHash docs\design-bundle\assets\mascot.png,public\mascot\mascot.png,docs\design-bundle\assets\items\*.webp,public\items\*.webp -Algorithm SHA256`
  - Result: copied public mascot/item assets matched the design-bundle asset hashes.
- `rg -n "overscroll-behavior|log-feed|log-row|scrollbar-thumb:hover|scrollbar-color|transition: all|outline: none|outline-none|user-scalable|maximum-scale|autoFocus|<img" ...`
  - Result: confirmed restored CSS pieces and found remaining `outline: none` plus image usage sites.
- Read-only line inspections with `Get-Content` and `Select-String` on `docs/design-bundle/screens-customer.jsx`, `docs/design-bundle/screens-admin.jsx`, `src/components/layouts/*.jsx`, `src/pages/customer/*.jsx`, `src/pages/admin/*.jsx`, `src/components/organisms/*.jsx`, `src/components/molecules/MascotState.jsx`, and `src/styles/components.css`
  - Result: gathered the file/line evidence cited in sections 3-8.
- `npm test`
  - Result: passed with exit code 0. Output included React Router future flag warnings and jsdom/axe `window.getComputedStyle(elt, pseudoElt)` not-implemented warnings.
- `npm pkg get scripts`
  - Result: failed with `EPERM: operation not permitted, lstat 'C:\Users\user'`; replaced with direct `package.json` read.
- `Get-Content -Raw package.json`
  - Result: scripts include `build`, `test`, `test:watch`, `test:e2e`, `test:e2e:ui`, `dev`, `preview`, `server`, and `server:watch`. No `lint` or `typecheck` script was present.
- `Test-Path docs\codexdesignreview-v2.md`
  - Result: file did not exist before this report was written.
- `git -c safe.directory=C:/ACoding/09_order status --short docs/codexdesignreview-v2.md`
  - Result: after writing, only `docs/codexdesignreview-v2.md` appeared in that path-specific status check.

`npm run build` was not run because it would create or overwrite build output, while the user allowed only `docs/codexdesignreview-v2.md` to be written. `npm run test:e2e` was not run because Playwright commonly writes artifacts and browser output, which would also conflict with the write restriction.

## 12. Notes

- This report treats `docs/design-bundle/` as the repository's available design-bundle source of truth because root `design-bundle/` was absent.
- `docs/DESIGN_BUNDLE_AUDIT.md` and `docs/codexdesignreview-fix-report.md` were treated as helper/self-reporting documents only, not as design source of truth.
- Static review was used for most UI comparison. No browser screenshot or visual regression run was performed because starting/running full browser validation could create additional files outside the allowed report.
- Backup zip contents under `backups/` were not unpacked or inspected.
- Supplemental accessibility/UI review principles were checked against the Web Interface Guidelines reference: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
