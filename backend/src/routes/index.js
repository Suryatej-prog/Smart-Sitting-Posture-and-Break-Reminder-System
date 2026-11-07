const express = require('express');
const { getLiveStatus } = require('../controllers/liveStatusController');
const { listSensorReadings } = require('../controllers/sensorReadingsController');
const { listSessions, getSession } = require('../controllers/sessionsController');
const { listBreakEvents, acknowledgeBreakEvent } = require('../controllers/breakEventsController');
const { getDailyAnalytics, getWeeklyAnalytics } = require('../controllers/analyticsController');
const { getSettings, putSettings } = require('../controllers/settingsController');
const { saveCalibration, getLatestCalibration } = require('../controllers/calibrationController');

const router = express.Router();

router.get('/live-status', getLiveStatus);
router.get('/sensor-readings', listSensorReadings);
router.get('/sessions', listSessions);
router.get('/sessions/:id', getSession);
router.get('/break-events', listBreakEvents);
router.post('/break-events/:id/acknowledge', acknowledgeBreakEvent);
router.get('/analytics/daily', getDailyAnalytics);
router.get('/analytics/weekly', getWeeklyAnalytics);
router.get('/settings', getSettings);
router.put('/settings', putSettings);
router.post('/calibration', saveCalibration);
router.get('/calibration/latest', getLatestCalibration);

module.exports = router;
