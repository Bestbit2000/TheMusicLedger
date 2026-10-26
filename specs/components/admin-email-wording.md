# Admin email wording

## 1. Metadata
- **Name:** Admin email wording editor (`admin.css`: `.admin-rich-toolbar`, `.admin-rich-text`)
- **Category:** Admin panel page
- **Status:** New (ML-617, 2026-10-26)

## 2. Overview
Admin → Content → **Email wording**: what the app's emails say, changed without a release
(`public/admin-email-wording.js`, [docs/email-wording.md](../../docs/email-wording.md)). The words of an email and
the signature at the bottom of every email a member gets are written in a small editor: formatting buttons above a
box to type or paste into, with an **Edit as HTML** switch that swaps the box for its HTML in a plain text box.
Whatever is typed is cleaned by the server before it is kept, so the box may show something the email won't carry
until it is saved. **Don't use** it for anything but what goes into an email - the app's own screens never take HTML.

## 3. Anatomy
- `.form-group` › `label` (names the box; `for` the HTML text box, and the box is `aria-labelledby` it).
- `.admin-rich-toolbar` (`role="toolbar"`) › `button.admin-stat-exclude-btn[data-format]` - Bold, Italic, Underline,
  Bulleted list; the signature adds **Insert the logo** once a logo is uploaded.
- `.admin-rich-text` - the box (`contenteditable`, `role="textbox"`, `aria-multiline`), looking like the panel's
  other text boxes. Paragraphs are spaced like the email's; a picture (the logo) fits its width.
- `textarea` (hidden until the switch is on) - the same words as HTML.
- `.admin-bc-fields` › `.toggle-switch` + "Edit as HTML". While it is on, the formatting buttons are disabled.
- Below the words: Subject and Button text boxes, the fill-ins list, and `.admin-security-toolbar` with Save, Preview,
  Send me a test, Reset to the original. Below the signature: Save the signature, Upload / Replace the logo, Remove
  the logo, Remove the signature. **Preview** shows the email as it will arrive in an `.admin-stat-tile`.

## 4. Tokens used
`--control-border`, `--input-bg`, `--text-color`, `--radius-lg`, `--font-base`, `--focus-ring`, `--touch-target`
(the box's least height, four rows of it), `--space-2`…`--space-4`.

## 5. Props / API
- Save stays disabled until something has changed; typing hides a preview that is now out of date.
- The formatting buttons keep the cursor where it was (the press doesn't move focus off the words).
- A signature saved with things an email can't carry (pictures other than the logo, scripts, odd styles) says so:
  "anything an email can't carry was taken out".

## 6. States
Box: empty / with words / focused (`--focus-ring`) / hidden behind the HTML switch. Formatting buttons: on /
disabled (while editing as HTML). Save: disabled / ready.

## 7. Code example
```html
<div class="form-group">
  <label id="emailWordingBodyLabel" for="emailWordingBodyHtml">Words</label>
  <div class="admin-rich-toolbar" role="toolbar" aria-label="Formatting: Words">
    <button type="button" class="admin-stat-exclude-btn" data-format="bold" aria-label="Bold"><strong>B</strong></button>
  </div>
  <div class="admin-rich-text" id="emailWordingBody" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="emailWordingBodyLabel"><p>Hi {first name},</p></div>
  <textarea id="emailWordingBodyHtml" class="hidden-group" rows="10"></textarea>
</div>
```

## 8. Cross-references
[admin-shell](admin-shell.md) · [toggle-switch](toggle-switch.md)

## 9. Accessibility
- The box is a named, multi-line textbox; every formatting button has a name ("Bold", "Bulleted list"); the toolbar is
  named after the box it formats. Keyboard users also have the usual shortcuts (Ctrl+B, Ctrl+I, Ctrl+U).
- The switch is named ("Edit words as HTML"). Messages after Save, Preview and a test are `role="status"`.
- The box keeps the 2px `--control-border` edge (3:1 against the page) and the focus ring of every other field.
- Every button is at least the panel's usual size; nothing is shown by colour alone.

See [accessibility foundation](../foundations/accessibility.md).
