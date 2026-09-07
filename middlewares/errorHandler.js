const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";
  const message =
    isProd && statusCode >= 500
      ? "Internal Server Error"
      : err.message || "Internal Server Error";

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || [],
    stack: !isProd ? err.stack : undefined,
  });
};

export default errorHandler;
