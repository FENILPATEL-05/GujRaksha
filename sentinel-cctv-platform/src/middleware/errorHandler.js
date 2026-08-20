const errorHandler = (err, req, res, next) => {
  console.error('[INDUSTRIAL_ERROR_LOG]', err);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected enterprise system error occurred.',
      timestamp: new Date().toISOString()
    }
  });
};

module.exports = errorHandler;
