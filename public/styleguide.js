// The style guide page's own script (public/styleguide.html). Its own file since ML-474: the content
// security policy allows no script written in a page.
const colorGroups = {
    sgColorsBase: ['--bg-color', '--container-bg', '--text-color', '--secondary-color', '--input-bg', '--input-border', '--label-color'],
    sgColorsBrand: ['--primary-action', '--primary-action-strong', '--nav-action', '--selection-color'],
    sgColorsSemantic: ['--success-color', '--danger-color', '--warning-color', '--info-color'],
    sgColorsCategory: ['--cat-practise', '--cat-rehearsal', '--cat-lesson', '--cat-performance'],
    sgColorsHeatTime: ['--heat-time-0', '--heat-time-1', '--heat-time-2', '--heat-time-3', '--heat-time-4'],
    sgColorsHeatSess: ['--heat-sess-0', '--heat-sess-1', '--heat-sess-2', '--heat-sess-3', '--heat-sess-4'],
};

function renderSwatches() {
    const styles = getComputedStyle(document.body);
    for (const [containerId, tokens] of Object.entries(colorGroups)) {
        const el = document.getElementById(containerId);
        el.innerHTML = tokens.map(t => {
            const value = styles.getPropertyValue(t).trim();
            return `<div class="sg-swatch">
                <div class="sg-swatch-color" style="--sample: var(${t});"></div>
                <div class="sg-swatch-label"><strong>${t}</strong><span>${value}</span></div>
            </div>`;
        }).join('');
    }
}

// Labels read the live value from tokens.css so this page can't drift from it (ML-198).
const tokenValue = (t) => getComputedStyle(document.documentElement).getPropertyValue(t).trim();
const typeScale = ['--font-2xs', '--font-xs', '--font-sm', '--font-base', '--font-md', '--font-lg', '--font-xl', '--font-2xl', '--font-3xl'];
document.getElementById('sgType').innerHTML = typeScale.map(t =>
    `<div class="sg-type-row"><span class="sg-label">${t}</span><span class="sg-sample-size" style="--sample: var(${t});">The quick brown fox (${tokenValue(t)})</span></div>`
).join('');

const spaceScale = ['--space-0-5', '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-7', '--space-8', '--space-9', '--space-10'];
document.getElementById('sgSpace').innerHTML = spaceScale.map(t =>
    `<div class="sg-space-row"><span class="sg-label">${t}</span><div class="sg-space-bar" style="--sample: var(${t});"></div><span>${tokenValue(t)}</span></div>`
).join('');

document.getElementById('sgDarkToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    renderSwatches();
});

renderSwatches();
