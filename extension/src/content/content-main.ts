/**
 * Content-script entry. Listens for the toolbar-action "TOGGLE_PANEL" message
 * from the background service worker and toggles the floating panel.
 */
import { togglePanel } from './panel';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'TOGGLE_PANEL') {
    togglePanel();
    sendResponse({ ok: true });
  }
  return true;
});
