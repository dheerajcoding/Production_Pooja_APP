/**
 * Returns a fully-resolved URL for any uploaded file path.
 *
 * In development the Vite proxy forwards /uploads → localhost:5000, so a
 * relative "/uploads/..." path works fine in the browser.
 *
 * In production set VITE_BACKEND_URL=https://your-api.com in the build env
 * so the browser hits the correct origin.
 *
 * Examples:
 *   mediaUrl('/uploads/chat/abc.jpg')  → '/uploads/chat/abc.jpg'  (dev)
 *   mediaUrl('https://cdn.../abc.jpg') → 'https://cdn.../abc.jpg' (passthrough)
 *   mediaUrl('')                       → ''
 */
export function mediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path; // already absolute — pass through
  }
  const base = import.meta.env.VITE_BACKEND_URL || ''; // '' → relative (proxied in dev)
  return `${base}${path}`;
}
