// Gridify 2.0 - Cloudflare Worker
// Serves static HTML files from GitHub repository

const GITHUB_REPO = 'abhinandtrade-oss/Gridify.2.0';
const GITHUB_RAW = 'https://raw.githubusercontent.com';
const BRANCH = 'main';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // Remove trailing slash if not root
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // Default to index.html for root path
    if (pathname === '' || pathname === '/') {
      pathname = '/index.html';
    }

    // Block access to sensitive paths
    if (
      pathname.includes('src/') ||
      pathname.includes('wrangler') ||
      pathname.includes('package.json') ||
      pathname.includes('.git')
    ) {
      return new Response('Access Denied', { status: 403 });
    }

    try {
      // Construct GitHub raw content URL
      const githubUrl = `${GITHUB_RAW}/${GITHUB_REPO}/${BRANCH}${pathname}`;
      console.log(`Fetching: ${githubUrl}`);

      // Fetch from GitHub
      const response = await fetch(githubUrl);

      if (!response.ok) {
        // If not found, try to serve 404.html
        if (response.status === 404 && pathname !== '/404.html') {
          const notFoundUrl = `${GITHUB_RAW}/${GITHUB_REPO}/${BRANCH}/404.html`;
          const notFoundResponse = await fetch(notFoundUrl);
          if (notFoundResponse.ok) {
            return new Response(notFoundResponse.body, {
              status: 404,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
          }
        }
        return new Response('404 - Page Not Found', {
          status: 404,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      // Determine content type based on file extension
      let contentType = 'text/plain';
      if (pathname.endsWith('.html')) {
        contentType = 'text/html; charset=utf-8';
      } else if (pathname.endsWith('.css')) {
        contentType = 'text/css; charset=utf-8';
      } else if (pathname.endsWith('.js')) {
        contentType = 'application/javascript; charset=utf-8';
      } else if (pathname.endsWith('.json')) {
        contentType = 'application/json; charset=utf-8';
      } else if (pathname.endsWith('.png')) {
        contentType = 'image/png';
      } else if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (pathname.endsWith('.gif')) {
        contentType = 'image/gif';
      } else if (pathname.endsWith('.svg')) {
        contentType = 'image/svg+xml';
      } else if (pathname.endsWith('.webp')) {
        contentType = 'image/webp';
      }

      // Return file with proper headers and caching
      return new Response(response.body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      console.error(`Error fetching ${pathname}:`, error);
      return new Response(`Error: ${error.message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  },
};
