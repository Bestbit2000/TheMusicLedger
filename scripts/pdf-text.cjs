// ML-309: used to read the ABRSM syllabus PDFs (no Python/poppler on the dev machine). Usage: node scripts/pdf-text.cjs in.pdf out.txt
// Minimal PDF text extraction with Node built-ins only: inflates FlateDecode streams and reads the
// Tj/TJ/' /" string operators. Good enough for a text-based PDF with literal strings.
// Usage: node pdftext.js in.pdf out.txt
const fs = require('fs');
const zlib = require('zlib');
const [inFile, outFile] = process.argv.slice(2);
const buf = fs.readFileSync(inFile);
const s = buf.toString('latin1');

function unescapeLiteral(str) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c !== '\\') { out += c; continue; }
        const n = str[++i];
        if (n === 'n') out += '\n';
        else if (n === 'r') out += '';
        else if (n === 't') out += '\t';
        else if (n === 'b' || n === 'f') out += '';
        else if (/[0-7]/.test(n)) {
            let oct = n;
            while (oct.length < 3 && /[0-7]/.test(str[i + 1])) oct += str[++i];
            out += String.fromCharCode(parseInt(oct, 8));
        } else out += n;
    }
    // Common ligatures/specials in this font set.
    return out.replace(/\x1e/g, 'fi').replace(/\x1f/g, 'fi').replace(/\x1d/g, 'ff').replace(/\x17/g, '').replace(/\x95/g, '•').replace(/\x96/g, '–').replace(/\x97/g, '—').replace(/\x92/g, "'").replace(/\x93/g, '"').replace(/\x94/g, '"');
}
// Reads the strings from a content stream, starting a new line at each text positioning change.
function textOf(content) {
    let out = '';
    let i = 0;
    const n = content.length;
    let line = '';
    const flush = () => { if (line.trim()) out += line.replace(/\s+/g, ' ').trim() + '\n'; line = ''; };
    while (i < n) {
        const c = content[i];
        if (c === '(') {
            let depth = 1, j = i + 1, str = '';
            while (j < n && depth) {
                const ch = content[j];
                if (ch === '\\') { str += ch + content[j + 1]; j += 2; continue; }
                if (ch === '(') depth++;
                else if (ch === ')') { depth--; if (!depth) break; }
                str += ch; j++;
            }
            line += unescapeLiteral(str);
            i = j + 1;
            continue;
        }
        // Positioning operators start a new line; big negative kerning in TJ acts as a space.
        const op = content.slice(i, i + 3);
        if (/^(Td |TD |Tm\s|T\* |ET\s)/.test(op + ' ') || /^T[dDm*]\b/.test(content.slice(i, i + 2)) && /\s/.test(content[i - 1] || ' ')) {
            if (content.slice(i, i + 2) === 'ET' || content.slice(i, i + 2) === 'Tm' || content.slice(i, i + 2) === 'TD' || content.slice(i, i + 2) === 'T*') flush();
            else if (content.slice(i, i + 2) === 'Td') {
                // Td with a y change is a new line; a pure x move is a gap
                const before = content.slice(Math.max(0, i - 40), i).trim().split(/\s+/);
                const ty = Number(before[before.length - 1]);
                if (ty) flush(); else line += ' ';
            }
            i += 2;
            continue;
        }
        i++;
    }
    flush();
    return out;
}
const re = /stream\r?\n/g;
let m, page = 0, out = '';
while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf('endstream', start);
    const dict = s.slice(Math.max(0, m.index - 300), m.index);
    if (!/FlateDecode/.test(dict)) continue;
    let content;
    try { content = zlib.inflateSync(buf.subarray(start, end)).toString('latin1'); } catch (e) { continue; }
    if (!/\bT[Jj]\b/.test(content) || !/\bBT\b/.test(content)) continue;
    page++;
    out += `\n===== text stream ${page} =====\n` + textOf(content);
}
fs.writeFileSync(outFile, out);
console.log('streams with text:', page, 'chars:', out.length);
