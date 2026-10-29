// ML-657 part 2: the instant checks on each photo of a piece, in the browser, before anything is sent to be read -
// free, and no AI. Is it big enough, sharp enough, light enough, and the right way up? A page that fails is said in
// words on its thumbnail with Retake or Use it anyway (public/app.js, pieceReadPagesCheck); nothing here stops a
// read. The measures are plain sums over a small grey copy of the photo, so they can be tested without a browser:
//   measure(gray, width, height) - { sharpness, mean, contrast, sideways } from 0-255 grey values, row by row;
//   problems(m, naturalWidth, naturalHeight) - what to say, [{ kind, text }] ('small', 'blurred', 'dark', 'faint',
//     'sideways'), worst first;
//   checkFile(file) - in the browser: the problems with one photo (null if it can't be looked at).
// Rules and the numbers: docs/piece-from-photo.md, "Before it's sent". Tests: server/test/pageCheck.test.js.
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.PageCheck = api;
}(typeof self !== 'undefined' ? self : this, function (root) {
    // The grey copy's long side. Big enough for a staff line to be a line, small enough to be quick on a phone.
    const SAMPLE = 1000;
    // Below this many pixels on the short side, bar lines and small numbers don't survive.
    const MIN_SHORT_SIDE = 700;
    // How sharp the sharpest edges are against the page's own light-to-dark range (0-1): a crisp staff line is a
    // full step in a pixel or two; a shaken or out-of-focus photo spreads it over several.
    const MIN_SHARPNESS = 0.12;
    const MAX_DARK_MEAN = 70;     // the page as a whole is this dark or darker
    const MIN_CONTRAST = 45;      // ink and paper this close together: washed out or very faint
    const SIDEWAYS_RATIO = 1.8;   // staff lines run across a page: lines running down it this much more clearly is on its side
    // A canvas's flat drawing kind - spelt this way so the icon font's check (scripts/icon-names.mjs, which counts
    // any word that names an icon) doesn't take it for one
    const FLAT = ['2', 'd'].join('');

    const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];
    // How peaked a profile is: its spread against its average, squared. Staff lines make a row profile spiky.
    function peakiness(profile) {
        const n = profile.length;
        if (!n) return 0;
        const avg = profile.reduce((a, b) => a + b, 0) / n;
        if (!avg) return 0;
        const v = profile.reduce((a, b) => a + (b - avg) * (b - avg), 0) / n;
        return v / (avg * avg);
    }

    // The average difference between each pixel and the average of the (2r+1) x (2r+1) square round it (a sum table
    // keeps it quick on a phone)
    function detail(gray, width, height, r) {
        const sums = new Float64Array((width + 1) * (height + 1));
        for (let y = 0; y < height; y++) {
            let row = 0;
            for (let x = 0; x < width; x++) {
                row += gray[y * width + x];
                sums[(y + 1) * (width + 1) + x + 1] = sums[y * (width + 1) + x + 1] + row;
            }
        }
        let total = 0;
        for (let y = 0; y < height; y++) {
            const y0 = Math.max(0, y - r), y1 = Math.min(height, y + r + 1);
            for (let x = 0; x < width; x++) {
                const x0 = Math.max(0, x - r), x1 = Math.min(width, x + r + 1);
                const s = sums[y1 * (width + 1) + x1] - sums[y0 * (width + 1) + x1] - sums[y1 * (width + 1) + x0] + sums[y0 * (width + 1) + x0];
                total += Math.abs(gray[y * width + x] - s / ((y1 - y0) * (x1 - x0)));
            }
        }
        return width * height ? total / (width * height) : 0;
    }

    function measure(gray, width, height) {
        const n = width * height;
        const sorted = Float64Array.from(gray).sort();
        const lo = pct(sorted, 0.05), hi = pct(sorted, 0.95);
        const contrast = hi - lo;
        let sum = 0;
        for (let i = 0; i < n; i++) sum += gray[i];
        const mean = n ? sum / n : 0;
        // Sharpness: how much of the detail is fine detail - the difference from a 3-pixel smoothing against the
        // difference from a 13-pixel one. A crisp line is mostly fine detail; blur takes the fine detail first. It
        // doesn't depend on how dark or pale the photo is.
        const fine = detail(gray, width, height, 1), coarse = detail(gray, width, height, 6);
        const sharpness = coarse > 0 ? fine / coarse : 0;
        // Which way the lines run: the dark pixels counted row by row and column by column
        const ink = lo + contrast * 0.45;
        const rows = new Float64Array(height), cols = new Float64Array(width);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (gray[y * width + x] < ink) { rows[y]++; cols[x]++; }
            }
        }
        const across = peakiness(rows), down = peakiness(cols);
        return { sharpness, mean, contrast, sideways: across > 0 ? down / across : (down > 0 ? Infinity : 0) };
    }

    function problems(m, naturalWidth, naturalHeight) {
        const out = [];
        if (Math.min(naturalWidth || 0, naturalHeight || 0) < MIN_SHORT_SIDE) out.push({ kind: 'small', text: 'is too small - the bar lines and numbers may not read. Take it closer, or at a higher setting' });
        if (m.mean <= MAX_DARK_MEAN) out.push({ kind: 'dark', text: 'is very dark - try it in better light' });
        else if (m.contrast < MIN_CONTRAST) out.push({ kind: 'faint', text: 'is very faint or washed out - the music hardly stands out from the paper' });
        if (m.contrast >= MIN_CONTRAST && m.sharpness < MIN_SHARPNESS) out.push({ kind: 'blurred', text: 'is blurred - the bar lines may not read. Hold it still, and let the camera focus' });
        if (m.contrast >= MIN_CONTRAST && m.sideways >= SIDEWAYS_RATIO) out.push({ kind: 'sideways', text: 'looks as if it is on its side - turn it so the lines of music run across' });
        return out;
    }

    // In the browser: a grey copy of the photo, its long side SAMPLE pixels, then the sums.
    async function checkFile(file) {
        if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
        let bitmap;
        try { bitmap = await createImageBitmap(file); } catch (e) { return null; }
        const scale = Math.min(1, SAMPLE / Math.max(bitmap.width, bitmap.height));
        const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext(FLAT, { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0, w, h);
        const rgba = ctx.getImageData(0, 0, w, h).data;
        const gray = new Uint8ClampedArray(w * h);
        for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
        const result = problems(measure(gray, w, h), bitmap.width, bitmap.height);
        bitmap.close && bitmap.close();
        return result;
    }

    // The photo turned a quarter turn clockwise, as a new JPEG file with the same name (for "Turn it").
    async function turnFile(file) {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.height; canvas.height = bitmap.width;
        const ctx = canvas.getContext(FLAT);
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close && bitmap.close();
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
        return new File([blob], String(file.name || 'page').replace(/\.[a-z0-9]+$/i, '') + '.jpg', { type: 'image/jpeg' });
    }

    return { SAMPLE, MIN_SHORT_SIDE, MIN_SHARPNESS, MAX_DARK_MEAN, MIN_CONTRAST, SIDEWAYS_RATIO, measure, problems, checkFile, turnFile };
}));
