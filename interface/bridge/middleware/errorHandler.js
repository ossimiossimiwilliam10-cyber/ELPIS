function globalErrorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.url} - ${err.message}`);
  if (err.stack) {
    console.error(err.stack);
  }

  // Handle specific errors if needed
  if (err.name === 'ValidationError' || err.name === 'ZodError') {
    return res.status(400).json({ error: "Données invalides", details: err.errors || err.message });
  }

  res.status(500).json({ error: "Erreur serveur interne", message: err.message });
}

module.exports = globalErrorHandler;
