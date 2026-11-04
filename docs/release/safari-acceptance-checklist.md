# Manual Safari acceptance checklist — Veil UI playground

Test on a real Safari/WebKit browser at desktop and narrow mobile widths. Record Safari version, OS/device, viewport, date, tester and result for every item. Start at `/veil/playground/` with a fresh page load.

- [ ] Choose **Hello interface**. Enter `Amina`, activate **Greet** with a pointer, and confirm the output says `Hello Amina`.
- [ ] Repeat by keyboard: Tab to the name field, enter a name, Tab to **Greet**, press Enter and Space separately. Confirm the output updates and focus remains visible.
- [ ] Switch through Dashboard, Contact form, Operational review and Hello interface. Confirm each renders and its controls respond.
- [ ] Enter malformed JSON and a definition with an unsupported component. Render; confirm a useful error appears and the previous preview stays usable.
- [ ] Enter a definition over the displayed 32 KiB limit. Render; confirm it is rejected without breaking the page.
- [ ] Change a field and action result, then choose **Reset example**. Confirm the selected example and its initial state return.
- [ ] Choose **Copy JSON**. Paste into a plain text editor and confirm it is valid JSON for the selected example. If Safari blocks clipboard access, confirm the page gives a usable manual-copy fallback.
- [ ] Test desktop and narrow mobile preview widths. Confirm the preview fits its frame, controls remain reachable, code/preview scrolling works by touch and keyboard, and no page-level horizontal overflow appears.
- [ ] Inspect focus visibility, labels, status announcements, text contrast and zoom to 200%. Record any issue. Screen-reader checks are a separate qualification step.

**Release evidence:** attach screenshots or a short recording for the greeting pointer test and keyboard test. Record pass/fail and any console errors. Deployment requires every item to pass or an explicit maintainer disposition of any remaining issue.
