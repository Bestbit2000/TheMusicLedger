// ML-179: @vercel/blob/client's upload() runs entirely in the browser (the file goes straight to Blob
// storage, never through our own server). app.js is a plain classic script with no bundler, so this
// tiny module is the only piece that needs `import`; it exposes just the one function app.js calls.
// Keep this version in step with server/package.json's @vercel/blob - the browser's upload() and the
// server's handleUpload() speak one client-upload protocol.
// Its own file since ML-474: the content security policy allows no script written in the page.
import { upload } from 'https://cdn.jsdelivr.net/npm/@vercel/blob@2.8.0/client/+esm';
window.vercelBlobUpload = upload;
