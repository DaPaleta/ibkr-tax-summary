/**
 * Background service worker. Forwards toolbar action clicks to the active
 * tab's content script as a "toggle panel" message.
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
  } catch (err) {
    console.warn('[tax-assistant] could not reach content script:', err);
  }
});
