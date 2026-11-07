const Settings = require('../models/Settings');
const config = require('../config/env');

// Short-lived cache so every incoming sensor reading does not hit MongoDB.
let cache = { value: null, expiresAt: 0 };
const CACHE_TTL_MS = 5000;

async function getSettings(forceRefresh = false) {
  if (!forceRefresh && cache.value && cache.expiresAt > Date.now()) return cache.value;
  // Atomic upsert: concurrent first-time callers cannot create duplicates.
  const settings = await Settings.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global', breakThresholdSeconds: config.breakThresholdSeconds } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  cache = { value: settings, expiresAt: Date.now() + CACHE_TTL_MS };
  return settings;
}

async function updateSettings(updates) {
  const allowed = ['breakThresholdSeconds', 'soundEnabled', 'volume', 'fullscreenWarning', 'theme'];
  const patch = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) patch[key] = updates[key];
  }
  const settings = await Settings.findOneAndUpdate(
    { key: 'global' },
    { $set: patch },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  cache = { value: settings, expiresAt: Date.now() + CACHE_TTL_MS };
  return settings;
}

module.exports = { getSettings, updateSettings };
