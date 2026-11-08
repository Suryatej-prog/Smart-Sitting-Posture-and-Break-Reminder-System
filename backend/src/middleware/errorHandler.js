function notFound(req, res) {
  res.status(404).json({ error: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: err.message });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'BAD_JSON', message: 'Request body is not valid JSON' });
  }
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.errorCode || 'INTERNAL_ERROR',
    message: status === 500 ? 'Something went wrong' : err.message
  });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { notFound, errorHandler, asyncHandler };
