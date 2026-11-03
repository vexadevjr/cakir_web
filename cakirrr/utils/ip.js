'use strict';

// IPv4 adresleri IPv6 biçiminde (::ffff:1.2.3.4) gelirse sadeleştirir
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.connection.remoteAddress;
}

module.exports = { getClientIp };

