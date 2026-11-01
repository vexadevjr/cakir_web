'use strict';

const express = require('express');
const { getStats } = require('../services/stats');

const router = express.Router();

// Genel: Discord topluluk rakamları (yalnızca toplu sayılar)
router.get('/', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(await getStats());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
