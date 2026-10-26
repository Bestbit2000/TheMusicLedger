// ML-617 / ML-618: Admin -> Email wording. What every email the app sends says - listed in three groups (to members,
// the words around messages you write, alerts to you) - changed here without a release: choose one, then its subject,
// words and button (where it has one), with {fill-ins} the app fills in when it sends. The words
// have formatting buttons (bold, italic, underline, a bulleted list) and an Edit as HTML switch. Below, the
// signature at the bottom of every email a member gets: pasted or formatted, with links, and a logo uploaded here
// (the one picture an email can carry). Preview shows the email as it will arrive, Send me a test emails it to you,
// Save makes the next one use it, Reset to the original brings back the built-in wording. Whatever is saved is
// cleaned by the server first (server/services/emailHtml.js); docs/email-wording.md. The editor is
// .admin-rich-toolbar + .admin-rich-text (specs/components/admin-email-wording.md); the rest is the panel's own pieces.
(function () {
    'use strict';
    const A = window.AdminPanel;
    if (!A) return;
    const esc = A.escapeHtml;
    const $ = (id) => document.getElementById(id);
    let data = null;
    let current = null;   // the email open on the page
    let signature = null; // { html, logoUrl, changedOn, changedBy }
    const baseline = {};  // each editor's HTML as loaded, to tell whether it has changed

    const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const TOOLS = {
        bold: { label: 'Bold', html: '<strong>B</strong>', command: 'bold' },
        italic: { label: 'Italic', html: '<em>I</em>', command: 'italic' },
        underline: { label: 'Underline', html: '<u>U</u>', command: 'underline' },
        list: { label: 'Bulleted list', html: '&bull; List', command: 'insertUnorderedList' },
        logo: { label: 'Insert the logo', html: 'Insert the logo' }
    };

    // One editor: the formatting buttons, the box to type in, and its HTML behind the switch
    function editor(id, label, html, tools) {
        return `<div class="form-group">
            <label id="${id}Label" for="${id}Html">${esc(label)}</label>
            <div class="admin-rich-toolbar" role="toolbar" aria-label="Formatting: ${esc(label)}">
                ${tools.map((t) => `<button type="button" class="admin-stat-exclude-btn" data-format="${t}" data-editor="${id}" aria-label="${TOOLS[t].label}">${TOOLS[t].html}</button>`).join('')}
            </div>
            <div class="admin-rich-text" id="${id}" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="${id}Label">${html}</div>
            <textarea id="${id}Html" class="hidden-group" rows="10" spellcheck="false"></textarea>
            <div class="admin-bc-fields">
                <label class="toggle-switch"><input type="checkbox" data-html-toggle="${id}" aria-label="Edit ${esc(label.toLowerCase())} as HTML"><span class="toggle-slider"></span></label>
                <span>Edit as HTML</span>
            </div>
        </div>`;
    }
    const htmlMode = (id) => !$(`${id}Html`).classList.contains('hidden-group');
    const editorHtml = (id) => (htmlMode(id) ? $(`${id}Html`).value : $(id).innerHTML).trim();
    const remember = (id) => { baseline[id] = editorHtml(id); };
    const draft = () => ({ subject: $('emailWordingSubject').value, body: editorHtml('emailWordingBody'), button: current.hasButton ? $('emailWordingButton').value : null });
    const wordingChanged = () => $('emailWordingSubject').value.trim() !== current.wording.subject
        || (current.hasButton && $('emailWordingButton').value.trim() !== current.wording.button)
        || editorHtml('emailWordingBody') !== baseline.emailWordingBody;
    const changedLine = (x) => (x.changedOn ? `Changed${x.changedBy ? ` by ${esc(x.changedBy)}` : ''} on ${esc(day(x.changedOn))}` : 'Built-in wording');

    // ML-618: every email the app sends, in its group - choosing one opens it in the editor below
    function emailList() {
        return data.groups.map((g) => {
            const rows = data.emails.filter((e) => e.group === g.key).map((e) => `
                <tr>
                    <td class="admin-bc-text"><strong>${esc(e.name)}</strong><div class="admin-stat-tile-sub">${esc(e.about)}</div></td>
                    <td class="admin-bc-text">${changedLine(e)}</td>
                    <td>${e.key === current.key ? '<span class="text-muted">Open below</span>' : `<button type="button" class="admin-stat-exclude-btn" data-email="${esc(e.key)}" aria-label="Change the words of ${esc(e.name)}">Change</button>`}</td>
                </tr>`).join('');
            return `<h2 class="admin-stat-section-title">${esc(g.name)}</h2><p class="admin-intro">${esc(g.about)}</p>
                <div class="admin-stat-table-wrap"><table class="admin-stat-table admin-bc-table">
                    <thead><tr><th class="admin-bc-text">Email</th><th class="admin-bc-text">Wording</th><th><span class="visually-hidden">Change</span></th></tr></thead>
                    <tbody>${rows}</tbody>
                </table></div>`;
        }).join('');
    }

    function render() {
        const e = current;
        const s = signature;
        const fillIns = e.fillIns.map((f) => `<li><code>{${esc(f.name)}}</code> - ${esc(f.what)}${f.required ? ' <strong>Must be in the words.</strong>' : ''}</li>`).join('');
        const after = [e.hasButton ? 'The button\'s link is added by the app, so leave links out of the words.' : 'Leave links out of the words.',
            e.footer ? `After ${e.hasButton ? 'the button' : 'the words'}, the app always adds: "${esc(e.footer)}"` : '',
            e.toOwner ? 'This is an alert to you, so it has no signature.' : 'The signature goes at the bottom - links can go there.'].filter(Boolean).join(' ');
        $('adminEmailWording').innerHTML = `
            ${emailList()}
            <h2 class="admin-stat-section-title" id="emailWordingEditing">Changing: ${esc(e.name)}</h2>
            <p class="admin-intro">${esc(e.about)}</p>
            <p class="admin-intro">${e.changed ? `${changedLine(e)}.` : 'This is the built-in wording.'}</p>
            <div class="form-group"><label for="emailWordingSubject">Subject</label><input type="text" id="emailWordingSubject" maxlength="${e.limits.subject}" value="${esc(e.wording.subject)}"></div>
            ${editor('emailWordingBody', 'Words', e.wording.body, ['bold', 'italic', 'underline', 'list'])}
            ${e.hasButton ? `<div class="form-group"><label for="emailWordingButton">Button</label><input type="text" id="emailWordingButton" maxlength="${e.limits.button}" value="${esc(e.wording.button)}"></div>` : ''}
            <p class="admin-intro">Fill-ins - written in curly brackets, filled in when the email is sent:</p>
            <ul class="admin-intro">${fillIns}</ul>
            <p class="admin-intro">${after}</p>
            <div class="admin-security-toolbar">
                <button type="button" class="btn-submit no-margin" id="emailWordingSave" disabled>Save</button>
                <button type="button" class="admin-stat-exclude-btn" id="emailWordingPreview">Preview</button>
                <button type="button" class="admin-stat-exclude-btn" id="emailWordingTest">Send me a test</button>
                ${e.changed ? '<button type="button" class="admin-stat-exclude-btn" id="emailWordingReset">Reset to the original</button>' : ''}
                <span class="admin-test-case-meta" id="emailWordingStatus" role="status" aria-live="polite"></span>
            </div>
            <div id="emailWordingPreviewBox" class="hidden-group"></div>

            <h2 class="admin-stat-section-title">Signature</h2>
            <p class="admin-intro">Goes at the bottom of every email a member gets - not the alerts sent to you. Paste your signature in, or type and format it. Links can go here; the only picture an email can carry is the logo you upload below, so any other picture is taken out when it is saved. ${s.changedOn ? `Changed${s.changedBy ? ` by ${esc(s.changedBy)}` : ''} on ${esc(day(s.changedOn))}.` : 'There is no signature yet.'}</p>
            ${editor('emailSignatureBody', 'Signature', s.html, s.logoUrl ? ['bold', 'italic', 'underline', 'list', 'logo'] : ['bold', 'italic', 'underline', 'list'])}
            <div class="admin-security-toolbar">
                <button type="button" class="btn-submit no-margin" id="emailSignatureSave" disabled>Save the signature</button>
                <button type="button" class="admin-stat-exclude-btn" id="emailSignatureLogo">${s.logoUrl ? 'Replace the logo' : 'Upload a logo'}</button>
                ${s.logoUrl ? '<button type="button" class="admin-stat-exclude-btn" id="emailSignatureLogoRemove">Remove the logo</button>' : ''}
                ${s.changedOn ? '<button type="button" class="admin-stat-exclude-btn" id="emailSignatureRemove">Remove the signature</button>' : ''}
                <span class="admin-test-case-meta" id="emailSignatureStatus" role="status" aria-live="polite">${s.logoUrl ? 'A logo is uploaded - Insert the logo puts it where the cursor is.' : 'A logo: PNG, JPEG or WebP, up to 1 MB.'}</span>
            </div>
            <input type="file" id="emailSignatureLogoFile" accept="image/png,image/jpeg,image/webp" aria-label="A logo for the signature" hidden>`;
        remember('emailWordingBody');
        remember('emailSignatureBody');
    }

    function showPreview(p) {
        const box = $('emailWordingPreviewBox');
        // The email as the server built it - words and signature already cleaned there
        box.innerHTML = `<h2 class="admin-stat-section-title">Preview</h2><div class="admin-stat-tile"><p><strong>${esc(p.subject)}</strong></p>${p.html}</div>`;
        box.classList.remove('hidden-group');
    }
    const hidePreview = () => $('emailWordingPreviewBox')?.classList.add('hidden-group');

    async function open() {
        try {
            const [list, sig] = await Promise.all([A.apiCall('/api/admin/email-wording'), A.apiCall('/api/admin/email-signature')]);
            data = list;
            signature = sig;
            current = data.emails.find((e) => e.key === (current ? current.key : 'invitation')) || data.emails[0];
            render();
        } catch (error) { $('adminEmailWording').innerHTML = `<p>Error loading data: ${esc(error.message)}</p>`; }
    }
    // After a save, keep anything not saved in the other part as it stands on the page
    function rerender() {
        const keepSig = editorHtml('emailSignatureBody') !== baseline.emailSignatureBody ? editorHtml('emailSignatureBody') : null;
        render();
        if (keepSig !== null) { $('emailSignatureBody').innerHTML = keepSig; $('emailSignatureSave').disabled = false; }
    }

    // Another email into the editor - asking first if the words on the page haven't been saved
    function choose(key) {
        const go = () => {
            current = data.emails.find((e) => e.key === key);
            rerender();
            $('emailWordingEditing').scrollIntoView({ block: 'start' });
            $('emailWordingSubject').focus({ preventScroll: true });
        };
        if (!wordingChanged()) { go(); return; }
        A.showConfirmModal(`Leave the ${current.name.toLowerCase()} without saving?`, 'The changes you made to its words are not kept.', go, true);
    }

    const say = (id, words) => { $(id).textContent = words; };
    async function doPreview() {
        try { showPreview(await A.apiCall(`/api/admin/email-wording/${current.key}/preview`, 'POST', { ...draft(), signature: editorHtml('emailSignatureBody') })); say('emailWordingStatus', ''); } catch (error) { say('emailWordingStatus', error.message); }
    }
    async function sendTest() {
        say('emailWordingStatus', 'Sending...');
        try {
            const out = await A.apiCall(`/api/admin/email-wording/${current.key}/test`, 'POST', draft());
            say('emailWordingStatus', `${out.notSentHere ? `This site doesn't send emails - the test is in its outbox for ${out.to}.` : `Test sent to ${out.to}.`}${current.toOwner ? '' : ' It carries the saved signature.'}`);
        } catch (error) { say('emailWordingStatus', error.message); }
    }
    async function save() {
        try {
            data = await A.apiCall(`/api/admin/email-wording/${current.key}`, 'PUT', draft());
            current = data.emails.find((e) => e.key === current.key);
            rerender();
            A.showToast('Saved - the next email uses it', 'success');
        } catch (error) { say('emailWordingStatus', error.message); }
    }
    function reset() {
        A.showConfirmModal(`Reset the ${current.name.toLowerCase()} to the original?`, 'The built-in wording is sent from now on. Your saved wording is not kept.', async () => {
            try {
                data = await A.apiCall(`/api/admin/email-wording/${current.key}`, 'DELETE');
                current = data.emails.find((e) => e.key === current.key);
                rerender();
                A.showToast('Back to the original wording', 'success');
            } catch (error) { A.showToast(error.message); }
        }, true);
    }

    // ---- The signature ----
    async function saveSignature() {
        const sent = editorHtml('emailSignatureBody');
        try {
            signature = await A.apiCall('/api/admin/email-signature', 'PUT', { html: sent });
            render();
            const cut = signature.html.replace(/\s+/g, '') !== sent.replace(/\s+/g, '');
            A.showToast(cut ? 'Saved - anything an email can\'t carry was taken out' : 'Signature saved', 'success');
        } catch (error) { say('emailSignatureStatus', error.message); }
    }
    function removeSignature() {
        A.showConfirmModal('Remove the signature?', 'Emails go without one from now on, and the logo is deleted too.', async () => {
            try { signature = await A.apiCall('/api/admin/email-signature', 'DELETE'); rerender(); A.showToast('Signature removed', 'success'); } catch (error) { A.showToast(error.message); }
        }, true);
    }
    async function uploadLogo(file) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { say('emailSignatureStatus', 'A logo has to be a picture: PNG, JPEG or WebP.'); return; }
        if (file.size > 1024 * 1024) { say('emailSignatureStatus', 'A logo can be up to 1 MB.'); return; }
        if (!window.vercelBlobUpload) { say('emailSignatureStatus', 'The upload isn\'t ready yet - try again in a moment.'); return; }
        say('emailSignatureStatus', 'Uploading...');
        try {
            const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.type];
            let token = '';
            try { token = localStorage.getItem('authToken') || ''; } catch (e) { /* the upload asks without it and is refused */ }
            // The sign-in token goes to our upload-token route only, as a header - never in an address (ML-574)
            const blob = await window.vercelBlobUpload(`email-signature/logo.${ext}`, file, {
                access: 'public', contentType: file.type,
                handleUploadUrl: '/api/admin/email-signature/logo/upload-token',
                headers: { Authorization: `Bearer ${token}` }
            });
            const had = !!signature.logoUrl;
            signature = await A.apiCall('/api/admin/email-signature/logo', 'PUT', { blobUrl: blob.url, fileSizeBytes: file.size, mimeType: file.type });
            rerender();
            A.showToast(had ? 'Logo replaced - the signature uses the new one' : 'Logo uploaded - use Insert the logo to put it in', 'success');
        } catch (error) { say('emailSignatureStatus', `The logo could not be uploaded: ${error.message}`); }
    }
    function removeLogo() {
        A.showConfirmModal('Remove the logo?', 'It is taken out of the signature and deleted.', async () => {
            try { signature = await A.apiCall('/api/admin/email-signature/logo', 'DELETE'); rerender(); A.showToast('Logo removed', 'success'); } catch (error) { A.showToast(error.message); }
        }, true);
    }

    // ---- The editors ----
    function format(t) {
        const id = t.dataset.editor;
        if (htmlMode(id)) return; // the buttons work on the formatted view
        $(id).focus();
        if (t.dataset.format === 'logo') {
            document.execCommand('insertHTML', false, `<img src="${esc(signature.logoUrl)}" alt="Logo" width="120">`);
        } else {
            document.execCommand(TOOLS[t.dataset.format].command, false, null);
        }
        changed(id);
    }
    function switchHtml(input) {
        const id = input.dataset.htmlToggle;
        const box = $(id);
        const code = $(`${id}Html`);
        if (input.checked) code.value = box.innerHTML;
        else box.innerHTML = code.value; // the super admin's own typing; the server cleans it before it is kept
        code.classList.toggle('hidden-group', !input.checked);
        box.classList.toggle('hidden-group', input.checked);
        document.querySelectorAll(`[data-format][data-editor="${id}"]`).forEach((b) => { b.disabled = input.checked; });
    }
    function changed(id) {
        hidePreview();
        if (id === 'emailSignatureBody') $('emailSignatureSave').disabled = editorHtml(id) === baseline[id];
        else $('emailWordingSave').disabled = !wordingChanged();
    }

    // ---- ML-618 stage 4: the message each of your pop-ups starts with (server/services/popupTexts.js) ----
    // Plain text, part by part: the first line, a "Why:" line for each reason, "What to do next:" and the last line.
    let popups = null;
    let currentPopup = null;
    const popupDraft = () => Object.fromEntries([...document.querySelectorAll('#adminPopupTexts textarea[data-part]')].map((t) => [t.dataset.part, t.value]));
    const popupChanged = () => currentPopup && currentPopup.parts.some((x) => (popupDraft()[x.part] ?? x.text) !== x.text);

    function renderPopups() {
        const rows = popups.map((p) => `
            <tr>
                <td class="admin-bc-text"><strong>${esc(p.name)}</strong><div class="admin-stat-tile-sub">${esc(p.about)}</div></td>
                <td class="admin-bc-text">${changedLine(p)}</td>
                <td>${currentPopup && p.key === currentPopup.key ? '<span class="text-muted">Open below</span>' : `<button type="button" class="admin-stat-exclude-btn" data-popup="${esc(p.key)}" aria-label="Change how ${esc(p.name.toLowerCase())} starts">Change</button>`}</td>
            </tr>`).join('');
        const p = currentPopup;
        const editorHtml = p ? `
            <h2 class="admin-stat-section-title" id="popupTextEditing">Changing: ${esc(p.name)}</h2>
            <p class="admin-intro">The pop-up puts these together, one paragraph each, for the reason you choose - then you can change the message in the pop-up before it is sent. Plain text. Leave a part empty and it is left out.</p>
            ${p.fillIns.length ? `<p class="admin-intro">Fill-ins for the first line:</p><ul class="admin-intro">${p.fillIns.map((f) => `<li><code>{${esc(f.name)}}</code> - ${esc(f.what)}${f.required ? ' <strong>Must be in it.</strong>' : ''}</li>`).join('')}</ul>` : ''}
            ${p.parts.map((x, i) => `<div class="form-group"><label for="popupPart${i}">${esc(x.label)}</label><textarea id="popupPart${i}" data-part="${esc(x.part)}" rows="3" maxlength="800">${esc(x.text)}</textarea></div>`).join('')}
            <div class="admin-security-toolbar">
                <button type="button" class="btn-submit no-margin" id="popupTextSave" disabled>Save</button>
                ${p.changed ? '<button type="button" class="admin-stat-exclude-btn" id="popupTextReset">Reset to the original</button>' : ''}
                <span class="admin-test-case-meta" id="popupTextStatus" role="status" aria-live="polite"></span>
            </div>` : '';
        $('adminPopupTexts').innerHTML = `
            <h2 class="admin-stat-section-title">Starting messages in pop-ups</h2>
            <p class="admin-intro">The message each of your pop-ups starts with when you warn a member, close an account, remove something or rename a band. It is what then goes in the email's {message} - and in the app.</p>
            <div class="admin-stat-table-wrap"><table class="admin-stat-table admin-bc-table">
                <thead><tr><th class="admin-bc-text">Pop-up</th><th class="admin-bc-text">Wording</th><th><span class="visually-hidden">Change</span></th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>
            ${editorHtml}`;
    }
    async function openPopups() {
        try { popups = (await A.apiCall('/api/admin/popup-texts')).popups; renderPopups(); } catch (error) { $('adminPopupTexts').innerHTML = `<p>Error loading data: ${esc(error.message)}</p>`; }
    }
    const afterPopupSave = (out) => {
        popups = out.popups;
        currentPopup = popups.find((p) => p.key === currentPopup.key);
        renderPopups();
    };
    function choosePopup(key) {
        const go = () => {
            currentPopup = popups.find((p) => p.key === key);
            renderPopups();
            $('popupTextEditing').scrollIntoView({ block: 'start' });
            $('popupPart0').focus({ preventScroll: true });
        };
        if (!popupChanged()) { go(); return; }
        A.showConfirmModal(`Leave ${currentPopup.name.toLowerCase()} without saving?`, 'The changes you made to its starting message are not kept.', go, true);
    }
    async function savePopup() {
        const draftParts = popupDraft();
        const parts = Object.fromEntries(currentPopup.parts.filter((x) => draftParts[x.part] !== x.text).map((x) => [x.part, draftParts[x.part]]));
        try { afterPopupSave(await A.apiCall(`/api/admin/popup-texts/${currentPopup.key}`, 'PUT', { parts })); A.showToast('Saved - the pop-up starts with it now', 'success'); } catch (error) { $('popupTextStatus').textContent = error.message; }
    }
    function resetPopup() {
        A.showConfirmModal(`Reset ${currentPopup.name.toLowerCase()} to the original?`, 'Every part of its starting message goes back to the built-in words.', async () => {
            try { afterPopupSave(await A.apiCall(`/api/admin/popup-texts/${currentPopup.key}`, 'DELETE')); A.showToast('Back to the original words', 'success'); } catch (error) { A.showToast(error.message); }
        }, true);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const popupHost = $('adminPopupTexts');
        popupHost?.addEventListener('click', (e) => {
            const t = e.target.closest('button');
            if (!t || !popups) return;
            if (t.dataset.popup) choosePopup(t.dataset.popup);
            if (t.id === 'popupTextSave') savePopup();
            if (t.id === 'popupTextReset') resetPopup();
        });
        popupHost?.addEventListener('input', () => { if (currentPopup) $('popupTextSave').disabled = !popupChanged(); });
        document.querySelector('.admin-nav-item[data-section="email-wording"]')?.addEventListener('click', openPopups);
    });

    document.addEventListener('DOMContentLoaded', () => {
        const host = $('adminEmailWording');
        if (!host) return;
        document.querySelector('.admin-nav-item[data-section="email-wording"]')?.addEventListener('click', open);
        // A formatting button mustn't take the cursor out of the words it is formatting
        host.addEventListener('mousedown', (e) => { if (e.target.closest('[data-format]')) e.preventDefault(); });
        host.addEventListener('click', (e) => {
            const t = e.target.closest('button');
            if (!t || !current) return;
            if (t.dataset.format) { format(t); return; }
            if (t.dataset.email) { choose(t.dataset.email); return; }
            if (t.id === 'emailWordingSave') save();
            if (t.id === 'emailWordingPreview') doPreview();
            if (t.id === 'emailWordingTest') sendTest();
            if (t.id === 'emailWordingReset') reset();
            if (t.id === 'emailSignatureSave') saveSignature();
            if (t.id === 'emailSignatureRemove') removeSignature();
            if (t.id === 'emailSignatureLogo') $('emailSignatureLogoFile').click();
            if (t.id === 'emailSignatureLogoRemove') removeLogo();
        });
        host.addEventListener('change', (e) => {
            if (e.target.dataset.htmlToggle) { switchHtml(e.target); return; }
            if (e.target.id === 'emailSignatureLogoFile') {
                const file = e.target.files[0];
                e.target.value = '';
                if (file) uploadLogo(file);
            }
        });
        // Save wakes up once something has changed; a preview shown is now out of date
        host.addEventListener('input', (e) => {
            if (!current) return;
            const inSignature = e.target.closest('#emailSignatureBody, #emailSignatureBodyHtml');
            changed(inSignature ? 'emailSignatureBody' : 'emailWordingBody');
        });
    });
})();
