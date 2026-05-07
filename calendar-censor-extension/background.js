const CALENDAR_URL_PREFIX = "https://calendar.google.com/";
const TOGGLE_MESSAGE = { type: "GCTC_TOGGLE" };

function isCalendarTab(tab) {
  return Boolean(tab?.id && tab?.url?.startsWith(CALENDAR_URL_PREFIX));
}

function sendMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(response);
    });
  });
}

function injectContentScript(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ["content.js"]
      },
      () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve();
      }
    );
  });
}

async function messageCalendar(tabId, message) {
  try {
    return await sendMessage(tabId, message);
  } catch (_error) {
    await injectContentScript(tabId);
    return sendMessage(tabId, message);
  }
}

async function setBadge(tabId, state) {
  const enabled = Boolean(state?.enabled);
  await chrome.action.setBadgeText({
    tabId,
    text: enabled ? "ON" : ""
  });
  await chrome.action.setBadgeBackgroundColor({
    tabId,
    color: "#111827"
  });
}

async function showUnavailable(tabId) {
  if (!tabId) {
    return;
  }

  await chrome.action.setBadgeText({ tabId, text: "CAL" });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#b91c1c" });

  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: "" });
  }, 1400);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!isCalendarTab(tab)) {
    await showUnavailable(tab?.id);
    return;
  }

  try {
    const state = await messageCalendar(tab.id, TOGGLE_MESSAGE);
    await setBadge(tab.id, state);
  } catch (_error) {
    await showUnavailable(tab.id);
  }
});
