// src/index.js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    let pathname = url.pathname;
    
    // Default to index.html
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }
    
    try {
      return new Response(await fetch('https://raw.githubusercontent.com/abhinandtrade-oss/Gridify.2.0/main' + pathname));
    } catch (e) {
      return new Response('404 Not Found', { status: 404 });
    }
  }
};
