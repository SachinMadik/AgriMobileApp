module.exports = function errorHandler(err, req, res, next) {
  const code = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? 'Internal server error';
  res.status(code).json({ error: message, code });
};
