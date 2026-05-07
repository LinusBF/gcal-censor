const statusElement = document.getElementById("status");
const toggleButton = document.getElementById("toggle");
const toggleLabel = document.getElementById("toggle-label");

let activeTabId = null;
let enabled = false;

function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0] || null);
    });
  });
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

function isCalendarTab(tab) {
  return Boolean(tab?.url?.startsWith("https://calendar.google.com/"));
}

async function messageCalendar(tabId, message) {
  try {
    return await sendMessage(tabId, message);
  } catch (_error) {
    await injectContentScript(tabId);
    return sendMessage(tabId, message);
  }
}

function renderState(state) {
  enabled = Boolean(state?.enabled);
  const count = Number(state?.count || 0);

  toggleButton.disabled = false;
  toggleButton.classList.toggle("is-on", enabled);
  toggleLabel.textContent = enabled ? "Uncensor titles" : "Censor titles";
  statusElement.textContent = enabled
    ? `${count} title${count === 1 ? "" : "s"} censored`
    : "Titles are visible";
}

function renderUnavailable() {
  activeTabId = null;
  toggleButton.disabled = true;
  toggleButton.classList.remove("is-on");
  toggleLabel.textContent = "Open Google Calendar";
  statusElement.textContent = "This only runs on calendar.google.com";
}

async function initialize() {
  const tab = await queryActiveTab();
  if (!isCalendarTab(tab)) {
    renderUnavailable();
    return;
  }

  activeTabId = tab.id;

  try {
    const state = await messageCalendar(activeTabId, { type: "GCTC_GET_STATE" });
    renderState(state);
  } catch (_error) {
    renderUnavailable();
  }
}

toggleButton.addEventListener("click", async () => {
  if (!activeTabId) {
    return;
  }

  toggleButton.disabled = true;

  try {
    const state = await messageCalendar(activeTabId, {
      type: "GCTC_SET_ENABLED",
      enabled: !enabled
    });
    renderState(state);
  } catch (_error) {
    renderUnavailable();
  }
});

initialize();
