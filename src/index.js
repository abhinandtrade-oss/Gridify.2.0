// Cloudflare Workers entry point
// Serves the Gridify e-commerce application

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // Default to index.html for root path
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    // Map route to file (without .html extension handling)
    // This is a simple routing handler
    if (pathname.endsWith('/') && pathname !== '/') {
      pathname += 'index.html';
    }

    // Return a simple response
    return new Response('Gridify 2.0 - Cloudflare Worker', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  },
};
