function getAppUrlFromReq(req) {
    const originOrRef = String(req.headers.origin || req.headers.referer || '').toLowerCase();

    const parseList = (v) =>
        (v || '')
            .split(',')
            .map((s) => s.trim().toLowerCase().replace(/\/+$/, '')) // sin trailing slash
            .filter(Boolean);

    const cajaList = parseList(process.env.CAJA_ORIGINS);
    const mantList = parseList(process.env.MANTENEDOR_ORIGINS);

    const matches = (list) => list.some((entry) => originOrRef.startsWith(entry));

    if (matches(cajaList)) return process.env.APP_URL_CAJA || process.env.APP_URL;
    if (matches(mantList)) return process.env.APP_URL_MANTENEDOR || process.env.APP_URL;

    return process.env.APP_URL || process.env.APP_URL_MANTENEDOR || process.env.APP_URL_CAJA;
}

module.exports = getAppUrlFromReq;