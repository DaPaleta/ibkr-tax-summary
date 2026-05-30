/**
 * Content-script bootstrap (classic script).
 *
 * MV3 content_scripts entries are loaded as classic scripts, which can't use
 * `import` syntax or `import.meta`. We work around that by dynamically
 * importing the real entry, which Vite emits as an ES module. The dynamic
 * `import()` is allowed in classic scripts and the loaded module runs in the
 * same isolated world (so `chrome.*` APIs are still available).
 */
import(chrome.runtime.getURL('content-main.js')).catch((err) => {
  console.error('[tax-assistant] failed to load content-main:', err);
});
