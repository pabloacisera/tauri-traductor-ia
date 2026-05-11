const _seedKey = 'x7f2k9';

export async function getClientSeed() {
    let seed = localStorage.getItem(_seedKey);
    if (!seed) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        seed = Array.from({length: 10}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        localStorage.setItem(_seedKey, seed);
    }
    return seed;
}

export async function generateDeviceFingerprint() {
    const seed = await getClientSeed();
    const components = [
        seed,
        navigator.userAgent,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.language,
        navigator.platform,
    ];
    const data = components.join('|');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    const arr = Array.from(new Uint8Array(buf));
    return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}
