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

    // 1. Redirect .html requests to clean URLs (except index.html if it was explicitly requested? 
    // Usually index.html should be redirected to / but our logic above handles / -> /index.html internally.
    // If incoming is /index.html, we should redirect to /. 
    // If incoming is /about.html, redirect to /about.
    if (pathname.endsWith('.html')) {
        let cleanPath = pathname.slice(0, -5);
        if (cleanPath === '/index') cleanPath = '/';
        // If cleanPath is empty string (shouldn't be due to leading slash), make it /
        if (cleanPath === '') cleanPath = '/';
        
        url.pathname = cleanPath;
        return Response.redirect(url.toString(), 301);
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
      // 2. Determine fetch path for GitHub
      // If path has no extension, assume .html (or directory index)
      let fetchPath = pathname;
      let isCleanUrl = false;
      
      // Basic check for extension: does the last segment contain a dot?
      const lastSegment = pathname.split('/').pop();
      if (!lastSegment.includes('.')) {
          isCleanUrl = true;
          fetchPath = pathname + '.html'; // Try appending .html first
      }

      // Construct GitHub raw content URL
      let githubUrl = `${GITHUB_RAW}/${GITHUB_REPO}/${BRANCH}${fetchPath}`;
      console.log(`Fetching: ${githubUrl}`);

      // Fetch from GitHub
      let response = await fetch(githubUrl);

      // If clean URL and 404, might be a directory -> try /index.html
      if (!response.ok && response.status === 404 && isCleanUrl) {
          console.log(`Clean URL ${fetchPath} failed, trying directory index...`);
          const dirIndexPath = pathname + '/index.html';
          const dirIndexUrl = `${GITHUB_RAW}/${GITHUB_REPO}/${BRANCH}${dirIndexPath}`;
          const dirResponse = await fetch(dirIndexUrl);
          
          if (dirResponse.ok) {
              response = dirResponse;
              fetchPath = dirIndexPath; // Update for content-type detection
          }
      }

      if (!response.ok) {
        // If still not found, try to serve 404.html
        // Use recursive logic or just fetch 404? 
        // Existing logic for 404:
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

      // Determine content type based on fetchPath (the actual file served)
      let contentType = 'text/plain';
      if (fetchPath.endsWith('.html')) {
        contentType = 'text/html; charset=utf-8';
      } else if (fetchPath.endsWith('.css')) {
        contentType = 'text/css; charset=utf-8';
      } else if (fetchPath.endsWith('.js')) {
        contentType = 'application/javascript; charset=utf-8';
      } else if (fetchPath.endsWith('.json')) {
        contentType = 'application/json; charset=utf-8';
      } else if (fetchPath.endsWith('.png')) {
        contentType = 'image/png';
      } else if (fetchPath.endsWith('.jpg') || fetchPath.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (fetchPath.endsWith('.gif')) {
        contentType = 'image/gif';
      } else if (fetchPath.endsWith('.svg')) {
        contentType = 'image/svg+xml';
      } else if (fetchPath.endsWith('.webp')) {
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
