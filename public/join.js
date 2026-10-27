// ML-580: the "Ask to join" form on the public page (index.html). Fills the band and instrument lists from
// GET /api/join/options (the band directory and the instruments - nothing about any member), notes when the
// page opened (a robot sends the form at once - server/services/joinRequests.js), sends the form, and says thanks
// in place of it. The answer is always the same, whatever happened. Without this script the form still posts and
// the page comes back with ?joined=1 or ?join-problem=. With the waiting list switched off it says to write to us.
(function () {
    var form = document.getElementById('joinForm');
    if (!form) return;
    var fields = document.getElementById('joinFields');
    var status = document.getElementById('joinStatus');
    var send = document.getElementById('joinSend');
    document.getElementById('joinStarted').value = String(Date.now());

    function say(text, done) {
        status.textContent = text;
        if (done) { fields.hidden = true; status.classList.add('is-done'); }
    }
    var CLOSED = 'Asking to join here is switched off for now. Write to us at hello@notablybetter.com and we’ll get back to you.';

    // ML-625: "Did you mean one of these bands?" - a band typed rather than picked from the list ("Cobham") wasn't
    // tied to the band. Before sending, the directory bands it most likely means (bandMatch.js, by spelling alone)
    // show under the box; picking one, or "None of these", sends it. Asked once for what was typed.
    var bands = [];
    var settled = null;
    var bandInput = document.getElementById('joinBand');
    var matchBox = document.getElementById('joinBandMatch');
    var matchList = document.getElementById('joinBandMatchOptions');
    function sendNow() { if (form.requestSubmit) form.requestSubmit(); else send.click(); }
    function closeMatch() { matchBox.hidden = true; matchList.textContent = ''; }
    function matchOption(text, pick) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'flow-choice-option';
        b.textContent = text;
        b.addEventListener('click', pick);
        return b;
    }
    function offerMatch() {
        var typed = bandInput.value.trim();
        if (!typed || typed === settled || !window.BandMatch) return false;
        var found = window.BandMatch.suggest(typed, bands);
        if (!found.length) return false;
        matchList.textContent = '';
        found.forEach(function (label) {
            matchList.appendChild(matchOption(label, function () { bandInput.value = label; settled = label; closeMatch(); sendNow(); }));
        });
        matchList.appendChild(matchOption('None of these, it’s a different band', function () { settled = typed; closeMatch(); sendNow(); }));
        matchBox.hidden = false;
        matchList.firstChild.focus();
        return true;
    }
    bandInput.addEventListener('input', closeMatch);

    // Back from a send without the script
    var params = new URLSearchParams(location.search);
    if (params.has('joined')) say("Thanks - we'll email you if we can let you in.", true);
    else if (params.has('join-problem')) say(params.get('join-problem'));

    fetch('/api/join/options', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (o) {
            if (!o) return;
            if (!o.open) { say(CLOSED, true); return; }
            var list = document.getElementById('joinBandList');
            bands = o.bands;
            o.bands.forEach(function (name) { var opt = document.createElement('option'); opt.value = name; list.appendChild(opt); });
            var select = document.getElementById('joinInstrument');
            o.instruments.forEach(function (i) { var opt = document.createElement('option'); opt.value = String(i.id); opt.textContent = i.name; select.appendChild(opt); });
        })
        .catch(function () { /* the form still works with what is typed */ });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.reportValidity()) return;
        if (offerMatch()) { say(''); return; }
        var body = {};
        new FormData(form).forEach(function (value, key) { body[key] = value; });
        body.ageConfirmed = document.getElementById('joinAge').checked;
        send.disabled = true;
        say('Sending…');
        fetch('/api/join', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
            .then(function (res) {
                if (res.ok) { say(res.d.message || "Thanks - we'll email you if we can let you in.", true); return; }
                send.disabled = false;
                say(res.status === 404 ? CLOSED : (res.d.error || res.d.message || 'That did not go - please try again in a minute.'));
            })
            .catch(function () { send.disabled = false; say('That did not go - check your connection and try again.'); });
    });
})();
