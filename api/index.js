// Single Vercel function for the app's existing /api/* and /uploads/* routes.
const app = require('../server');

module.exports = async (req, res) => {
  const url = new URL(req.url, 'https://' + (req.headers.host || 'localhost'));
  const routedPath = url.searchParams.get('route');
  if (routedPath) req.url = routedPath;
  return app(req, res);
};
