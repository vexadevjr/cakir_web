'use strict';

const LoginAttempt = require('../models/LoginAttempt');
const { normalizeIp, cleanText } = require('../utils/ip');
const { logError } = require('../utils/redact');

// Giriş denemesini veritabanına kaydeder.
async function recordLogin(req, reason) {
    try {
        const body = req.body || {};

        await LoginAttempt.create({
            ip: normalizeIp(req.ip),
            username: cleanText(body.username, 40),
            success: reason === 'success',
            reason,
            ua: cleanText(req.get('user-agent'), 200),
        });

        return true;
    } catch (err) {
        logError('[Denetim] Giriş kaydı yazılamadı:', err);
        return false;
    }
}

module.exports = { recordLogin };
