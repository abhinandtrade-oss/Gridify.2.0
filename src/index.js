// Gridify 2.0 - Cloudflare Worker
// Serves static HTML files from GitHub repository

const GITHUB_REPO = 'abhinandtrade-oss/Gridify.2.0';
const GITHUB_RAW = 'https://raw.githubusercontent.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // Default to index.html for root path
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    // Handle trailing slashes by adding index.html
    if (pathname.endsWith('/') && pathname !== '/') {
      pathname += 'index.html';
    }

    // Block access to src/ folder and config files
    if (pathname.includes('/src/') || pathname.includes('wrangler.toml') || pathname.includes('package.json')) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      // Construct GitHub raw URL
      const githubUrl = `${GITHUB_RAW}/${GITHUB_REPO}/main${pathname}`;
      
      // Fetch the file from GitHub
      const response = await fetch(githubUrl);
      
      if (!response.ok) {
        return new Response('404 - Page Not Found', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Determine content type
      let contentType = 'text/plain';
      if (pathname.endsWith('.html')) {
        contentType = 'text/html';
      } else if (pathname.endsWith('.css')) {
        contentType = 'text/css';
      } else if (pathname.endsWith('.js')) {
        contentType = 'application/javascript';
      } else if (pathname.endsWith('.json')) {
        contentType = 'application/json';
      } else if (pathname.endsWith('.png')) {
        contentType = 'image/png';
      } else if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (pathname.endsWith('.svg')) {
        contentType = 'image/svg+xml';
      }

      // Return the file with proper headers
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (error) {
      return new Response(`Error: ${error.message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  },
};
