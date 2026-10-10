// ML-518: the admin panel's "prove it's you" check, and Admin -> My passkeys.
//
// Opening the admin panel asks a super admin for a passkey - the device's own fingerprint, face or
// PIN - or, on a device without one, a code from their authenticator app (or a recovery code). The
// check lasts 15 minutes without use and 8 hours at most, and it is the server that enforces it: every
// /api/admin route refuses without it (requireAdminCheck). This file only draws the screens.
//
// The fingerprint never leaves the device. The browser's own passkey prompt (WebAuthn) does the
// checking; what is passed to the server is a signed answer to the server's question. The two
// functions that talk to the browser are makePasskey and usePasskey - no outside script.
// Built from the panel's own pieces (form rows, buttons, the two-step key and codes): no classes of
// its own. Loaded before admin.js, which calls AdminGate.open. docs/admin-passkey.md.
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const panel = () => window.AdminPanel;
    const esc = (s) => panel().escapeHtml(s);
    const supported = () => !!(window.PublicKeyCredential && navigator.credentials);

    // ---- the browser's passkey prompt ----
    const toBytes = (text) => {
        const b64 = String(text).replace(/-/g, '+').replace(/_/g, '/');
        return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
    };
    const toText = (buffer) => {
        let out = '';
        for (const byte of new Uint8Array(buffer)) out += String.fromCharCode(byte);
        return btoa(out).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    const withIds = (list) => (list || []).map((c) => ({ ...c, id: toBytes(c.id) }));
    async function makePasskey(options) {
        const made = await navigator.credentials.create({ publicKey: {
            ...options, challenge: toBytes(options.challenge), user: { ...options.user, id: toBytes(options.user.id) }, excludeCredentials: withIds(options.excludeCredentials)
        } });
        const r = made.response;
        return {
            id: made.id, rawId: toText(made.rawId), type: made.type, clientExtensionResults: made.getClientExtensionResults(),
            response: { clientDataJSON: toText(r.clientDataJSON), attestationObject: toText(r.attestationObject), transports: r.getTransports ? r.getTransports() : [] }
        };
    }
    async function usePasskey(options) {
        const got = await navigator.credentials.get({ publicKey: { ...options, challenge: toBytes(options.challenge), allowCredentials: withIds(options.allowCredentials) } });
        const r = got.response;
        return {
            id: got.id, rawId: toText(got.rawId), type: got.type, clientExtensionResults: got.getClientExtensionResults(),
            response: { clientDataJSON: toText(r.clientDataJSON), authenticatorData: toText(r.authenticatorData), signature: toText(r.signature), ...(r.userHandle ? { userHandle: toText(r.userHandle) } : {}) }
        };
    }
    // What the browser says when the prompt is closed or times out, in our words
    const promptError = (error) => (error && (error.name === 'NotAllowedError' || error.name === 'AbortError')
        ? 'The passkey prompt was closed before it finished.'
        : error && error.name === 'InvalidStateError' ? 'This device already has a passkey for the admin panel.' : (error && error.message) || 'That didn\'t work - try again.');
    const deviceName = () => (/iPhone|Android.*Mobile/.test(navigator.userAgent) ? 'My phone' : /iPad|Android/.test(navigator.userAgent) ? 'My tablet' : 'My computer');

    // ========================================
    // The "prove it's you" screen
    // ========================================
    let done = null;    // what to do once the check is made (admin.js: open, or show again, the panel)
    let status = null;  // the server's GET /api/admin/gate
    const host = () => $('adminGate');
    const say = (text) => { const m = host().querySelector('[data-gate-msg]'); if (m) { m.textContent = text; m.classList.toggle('hidden-group', !text); } };
    const codeRow = (id, label) => `<div class="form-group"><label for="${id}">${label}</label><input type="text" id="${id}" inputmode="numeric" autocomplete="one-time-code" maxlength="20" spellcheck="false"></div>`;
    const message = '<p class="admin-intro hidden-group" data-gate-msg role="alert"></p>';
    const backToApp = '<p><a class="admin-link" href="/">&larr; Back to the app</a></p>';

    async function open(onPass, known) {
        if (done) return; // already asking
        done = onPass;
        $('adminShell').classList.add('hidden-group');
        host().classList.remove('hidden-group');
        host().innerHTML = '<p>Checking&hellip;</p>';
        try { status = known || await panel().apiCall('/api/admin/gate'); } catch (error) { host().innerHTML = `<p role="alert">${esc(error.message)}</p>${backToApp}`; done = null; return; }
        if (status.fresh || !status.required) return finish();
        if (!status.twoStep) return drawSetUp();
        if (status.passkeys && supported()) return drawPasskey();
        drawCode();
    }
    function finish() {
        const next = done;
        done = null;
        host().classList.add('hidden-group');
        host().innerHTML = '';
        if (next) next();
    }

    function drawPasskey() {
        host().innerHTML = `
            <h1>Prove it's you</h1>
            <p>The admin panel holds members' details, so it asks again here - and after ${status.idleMinutes} minutes without use.</p>
            ${message}
            <button type="button" class="btn-submit" data-gate="passkey">Use my passkey</button>
            <p><button type="button" class="admin-stat-exclude-btn" data-gate="to-code">Use a code instead</button></p>
            ${backToApp}`;
        host().querySelector('[data-gate="passkey"]').focus();
    }
    function drawCode() {
        host().innerHTML = `
            <h1>Prove it's you</h1>
            <p>The admin panel holds members' details, so it asks again here - and after ${status.idleMinutes} minutes without use.</p>
            ${status.passkeys && !supported() ? '<p class="admin-intro">This browser can\'t use passkeys, so it is a code here.</p>' : ''}
            ${codeRow('gateCode', 'Code from your authenticator app')}
            <p class="admin-intro">Lost your phone? A recovery code works here too.</p>
            ${message}
            <button type="button" class="btn-submit" data-gate="code">Continue</button>
            ${status.passkeys && supported() ? '<p><button type="button" class="admin-stat-exclude-btn" data-gate="to-passkey">Use my passkey instead</button></p>' : ''}
            ${backToApp}`;
        $('gateCode').focus();
    }
    // A super admin who has never set up an authenticator app (they sign in with Google) does it here, once.
    async function drawSetUp() {
        host().innerHTML = '<p>Getting it ready&hellip;</p>';
        let details;
        try { details = await panel().apiCall('/api/admin/gate/authenticator', 'POST'); } catch (error) { host().innerHTML = `<p role="alert">${esc(error.message)}</p>${backToApp}`; done = null; return; }
        host().innerHTML = `
            <h1>Set up the admin check</h1>
            <p>The admin panel holds members' details, so from now on it asks you to prove it's you. First, an authenticator app - it is the way in on a device with no passkey, and the way to add a passkey.</p>
            <p><strong>1.</strong> Add Notably Better to an authenticator app on your phone - Google Authenticator, Microsoft Authenticator, 1Password and others all work.</p>
            <button type="button" class="btn-submit" data-gate="open-app">Add to my authenticator app</button>
            <p>On a computer, or the button doesn't open an app? Type this setup key into the app instead:</p>
            <p class="two-step-key" aria-label="Setup key">${esc(details.secret)}</p>
            <p><button type="button" class="admin-stat-exclude-btn" data-gate="copy-key">Copy the setup key</button></p>
            <p><strong>2.</strong> Type the 6-digit code the app shows for Notably Better.</p>
            ${codeRow('gateSetUpCode', 'Code')}
            ${message}
            <button type="button" class="btn-submit" data-gate="confirm-app">Turn it on</button>
            ${backToApp}`;
        host().dataset.otpauth = details.otpauthUrl;
        host().dataset.setupKey = details.secret.replace(/\s/g, '');
    }
    function drawRecoveryCodes(codes, then) {
        host().innerHTML = `
            <h1>Save your recovery codes</h1>
            <p>Keep these somewhere safe - a password manager, or printed out. If you lose your phone, each one gets you into the admin panel once. They won't be shown again.</p>
            <ol class="recovery-codes" aria-label="Recovery codes">${codes.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
            <p><button type="button" class="admin-stat-exclude-btn" data-gate="copy-codes">Copy the codes</button></p>
            <button type="button" class="btn-submit" data-gate="codes-saved">I've saved them</button>`;
        host().dataset.codes = codes.join('\n');
        afterCodes = then;
    }
    let afterCodes = null;
    // Straight after getting in with a code on a device that has no passkey: offer one.
    function offerPasskey() {
        if (!supported() || status.passkeys) return finish();
        host().innerHTML = `
            <h1>Add a passkey to this device?</h1>
            <p>Next time, this device's fingerprint, face or PIN opens the admin panel - no code to type. Your fingerprint or face never leaves the device.</p>
            <div class="form-group"><label for="gatePasskeyName">A name for it</label><input type="text" id="gatePasskeyName" maxlength="40" autocomplete="off" value="${esc(deviceName())}"></div>
            ${message}
            <button type="button" class="btn-submit" data-gate="add-passkey">Add a passkey</button>
            <p><button type="button" class="admin-stat-exclude-btn" data-gate="skip-passkey">Not now</button></p>`;
    }

    const copy = (text, saidWhenDone) => (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject(new Error('no clipboard')))
        .then(() => panel().showToast(saidWhenDone, 'success')).catch(() => panel().showToast('Couldn\'t copy - select it and copy by hand.'));

    const GATE_ACTIONS = {
        'to-code': drawCode,
        'to-passkey': drawPasskey,
        async passkey() {
            const answer = await usePasskey(await panel().apiCall('/api/admin/gate/passkey/options', 'POST'));
            panel().setToken((await panel().apiCall('/api/admin/gate/passkey', 'POST', { response: answer })).token);
            finish();
        },
        async code() {
            const out = await panel().apiCall('/api/admin/gate/code', 'POST', { code: $('gateCode').value });
            panel().setToken(out.token);
            if (out.usedRecoveryCode) panel().showToast(`That recovery code is now used up - ${out.recoveryCodesLeft} left. New ones: My passkeys.`);
            offerPasskey();
        },
        'open-app'() { window.location.href = host().dataset.otpauth; },
        'copy-key'() { copy(host().dataset.setupKey, 'Setup key copied'); },
        async 'confirm-app'() {
            const out = await panel().apiCall('/api/admin/gate/authenticator/confirm', 'POST', { code: $('gateSetUpCode').value });
            panel().setToken(out.token);
            drawRecoveryCodes(out.recoveryCodes, offerPasskey);
        },
        'copy-codes'() { copy(host().dataset.codes, 'Recovery codes copied'); },
        'codes-saved'() { const next = afterCodes; afterCodes = null; delete host().dataset.codes; next(); },
        async 'add-passkey'() {
            const name = $('gatePasskeyName').value;
            const made = await makePasskey(await panel().apiCall('/api/admin/passkeys/options', 'POST'));
            await panel().apiCall('/api/admin/passkeys', 'POST', { response: made, name });
            panel().showToast('Passkey added', 'success');
            finish();
        },
        'skip-passkey': finish
    };
    async function gateClick(e) {
        const btn = e.target.closest('[data-gate]');
        if (!btn || btn.disabled) return;
        btn.disabled = true;
        say('');
        try { await GATE_ACTIONS[btn.dataset.gate](); } catch (error) { say(error.name && error.name !== 'Error' ? promptError(error) : error.message); }
        if (btn.isConnected) btn.disabled = false;
    }
    const ENTER = { gateCode: 'code', gateSetUpCode: 'confirm-app', gatePasskeyName: 'add-passkey' };

    window.AdminGate = { open };

    // ========================================
    // Admin -> My passkeys
    // ========================================
    let data = null;
    let gate = null;
    let naming = null; // { id } to rename, or { add: true }
    const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not yet');
    const page = () => $('adminPasskeys');

    function render() {
        const rows = data.passkeys.map((k) => `
            <tr>
                <td class="admin-bc-text"><strong>${esc(k.name)}</strong></td>
                <td>${esc(when(k.createdAt))}</td>
                <td>${esc(when(k.lastUsedAt))}</td>
                <td><button type="button" class="admin-stat-exclude-btn" data-passkey="rename" data-id="${k.id}" aria-label="Rename ${esc(k.name)}">Rename</button> <button type="button" class="admin-stat-exclude-btn" data-passkey="remove" data-id="${k.id}" aria-label="Remove ${esc(k.name)}">Remove</button></td>
            </tr>`).join('');
        page().innerHTML = `
            <h2 class="admin-stat-section-title">Passkeys for ${esc(data.address)}</h2>
            <p class="admin-intro">One for each device you use the admin panel on. A passkey only works on the web address it was made on, so this list is for ${esc(data.address)} alone.</p>
            ${rows ? `<div class="admin-stat-table-wrap"><table class="admin-stat-table admin-bc-table">
                <thead><tr><th class="admin-bc-text">Name</th><th>Added</th><th>Last used</th><th aria-label="Options"></th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>` : '<p class="admin-intro">No passkey yet - the admin panel asks for a code from your authenticator app each time.</p>'}
            <div class="admin-security-toolbar">
                ${supported() ? '<button type="button" class="btn-submit no-margin" data-passkey="add">Add a passkey to this device</button>' : '<span class="admin-test-case-meta">This browser can\'t use passkeys.</span>'}
                ${gate.required ? '<button type="button" class="admin-stat-exclude-btn" data-passkey="lock">Lock the admin panel now</button>' : ''}
            </div>
            <h2 class="admin-stat-section-title">How the check works</h2>
            <p class="admin-intro">${gate.required
                ? `It is asked when the admin panel opens, and again after ${gate.idleMinutes} minutes without use or ${gate.maxHours} hours, whichever comes first.`
                : 'It is not asked on this site - a developer\'s machine with the local sign-in switched on. Everywhere else it is.'} On a device with no passkey the way in is a code from your authenticator app; adding a passkey needs one too.</p>
            <h2 class="admin-stat-section-title">Recovery codes</h2>
            <p class="admin-intro">${gate.twoStep ? `${gate.recoveryCodesLeft} of 10 left. Each gets you in once if you lose your phone. A new set replaces the old one.` : 'None yet - they come with setting up an authenticator app, which the admin panel asks for the first time it is opened where the check is on.'}</p>
            ${gate.twoStep ? `<div class="admin-bc-fields">
                <label class="admin-bc-field" for="passkeysNewCodesCode">Code from your authenticator app<input class="admin-bc-num" type="text" id="passkeysNewCodesCode" inputmode="numeric" autocomplete="one-time-code" maxlength="20" spellcheck="false"></label>
                <button type="button" class="admin-stat-exclude-btn" data-passkey="new-codes">New recovery codes</button>
            </div>` : ''}
            <div id="passkeysNewCodes"></div>`;
    }
    async function openPage() {
        try {
            [data, gate] = await Promise.all([panel().apiCall('/api/admin/passkeys'), panel().apiCall('/api/admin/gate')]);
            render();
        } catch (error) { page().innerHTML = `<p>Error loading data: ${esc(error.message)}</p>`; }
    }

    function askName(what) {
        naming = what;
        const current = what.id ? data.passkeys.find((k) => k.id === what.id) : null;
        $('passkeyNameTitle').textContent = what.add ? 'Add a passkey to this device' : 'Rename this passkey';
        $('passkeyNameIntro').textContent = what.add ? 'Give it a name you will know the device by. Then this device asks for your fingerprint, face or PIN.' : 'A name you will know the device by.';
        $('passkeyNameInput').value = current ? current.name : deviceName();
        $('passkeyCodeInput').value = '';
        // a new passkey is made on a check that used a code; one made with a passkey asks for the code here
        $('passkeyCodeGroup').classList.toggle('hidden-group', !(what.add && !data.canAdd));
        $('passkeyNameMessage').classList.add('hidden-group');
        $('passkeyNameSaveBtn').textContent = what.add ? 'Add a passkey' : 'Save';
        panel().showModal('passkeyNameModal');
        $('passkeyNameInput').focus();
    }
    async function saveName() {
        const btn = $('passkeyNameSaveBtn');
        const name = $('passkeyNameInput').value;
        btn.disabled = true;
        try {
            if (naming.add) {
                if (!data.canAdd) {
                    panel().setToken((await panel().apiCall('/api/admin/gate/code', 'POST', { code: $('passkeyCodeInput').value })).token);
                    data.canAdd = true;
                    $('passkeyCodeGroup').classList.add('hidden-group');
                }
                const made = await makePasskey(await panel().apiCall('/api/admin/passkeys/options', 'POST'));
                data = await panel().apiCall('/api/admin/passkeys', 'POST', { response: made, name });
                panel().showToast('Passkey added', 'success');
            } else {
                data = await panel().apiCall(`/api/admin/passkeys/${naming.id}`, 'PUT', { name });
            }
            panel().hideModal('passkeyNameModal');
            render();
        } catch (error) {
            const m = $('passkeyNameMessage');
            m.textContent = error.name && error.name !== 'Error' ? promptError(error) : error.message;
            m.classList.remove('hidden-group');
        }
        btn.disabled = false;
    }
    function remove(id) {
        const key = data.passkeys.find((k) => k.id === id);
        if (!key) return;
        panel().showConfirmModal(`Remove "${key.name}"?`, 'That device will be asked for a code from your authenticator app instead. The passkey itself stays in the device\'s own list until you delete it there.', async () => {
            try { data = await panel().apiCall(`/api/admin/passkeys/${id}`, 'DELETE'); render(); panel().showToast('Passkey removed', 'success'); } catch (error) { panel().showToast(error.message); }
        });
    }
    async function newCodes() {
        try {
            const out = await panel().apiCall('/api/admin/passkeys/recovery-codes', 'POST', { code: $('passkeysNewCodesCode').value });
            gate.recoveryCodesLeft = out.recoveryCodes.length;
            render();
            $('passkeysNewCodes').innerHTML = `
                <p class="admin-intro"><strong>Your old recovery codes no longer work.</strong> Save these somewhere safe - they won't be shown again.</p>
                <ol class="recovery-codes" aria-label="Recovery codes">${out.recoveryCodes.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
                <div class="admin-security-toolbar"><button type="button" class="admin-stat-exclude-btn" data-passkey="copy-new-codes">Copy the codes</button><button type="button" class="admin-stat-exclude-btn" data-passkey="hide-new-codes">I've saved them</button></div>`;
            $('passkeysNewCodes').dataset.codes = out.recoveryCodes.join('\n');
        } catch (error) { panel().showToast(error.message); }
    }
    async function lockNow() {
        try {
            panel().setToken((await panel().apiCall('/api/admin/gate/lock', 'POST')).token);
            window.location.reload();
        } catch (error) { panel().showToast(error.message); }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!host() || !page()) return;
        host().addEventListener('click', gateClick);
        host().addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || !ENTER[e.target.id]) return;
            e.preventDefault();
            host().querySelector(`[data-gate="${ENTER[e.target.id]}"]`)?.click();
        });
        document.querySelector('.admin-nav-item[data-section="passkeys"]')?.addEventListener('click', openPage);
        page().addEventListener('click', (e) => {
            const btn = e.target.closest('[data-passkey]');
            if (!btn || !data) return;
            const id = Number(btn.dataset.id);
            const act = btn.dataset.passkey;
            if (act === 'add') askName({ add: true });
            if (act === 'rename') askName({ id });
            if (act === 'remove') remove(id);
            if (act === 'lock') lockNow();
            if (act === 'new-codes') newCodes();
            if (act === 'copy-new-codes') copy($('passkeysNewCodes').dataset.codes, 'Recovery codes copied');
            if (act === 'hide-new-codes') { $('passkeysNewCodes').innerHTML = ''; delete $('passkeysNewCodes').dataset.codes; }
        });
        $('passkeyNameSaveBtn').addEventListener('click', saveName);
        $('passkeyNameCancelBtn').addEventListener('click', () => panel().hideModal('passkeyNameModal'));
    });
})();
