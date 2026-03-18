const enableOpenPanelOnActionClick = async () => {
  if (!chrome.sidePanel || !chrome.sidePanel.setPanelBehavior) {
    return;
  }

  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    // Keep silent in production; this does not block the extension core flow.
    console.warn("PronoteBoost: unable to enable side panel action behavior", error);
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void enableOpenPanelOnActionClick();
});

chrome.runtime.onStartup.addListener(() => {
  void enableOpenPanelOnActionClick();
});
