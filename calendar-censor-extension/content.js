(() => {
  if (window.__googleCalendarTitleCensor) {
    return;
  }

  const CHIP_SELECTOR = 'div[role="button"][data-eventchip][data-eventid]';
  const TITLE_SELECTOR = ".KcY3wb .I0UMhf, .I0UMhf";
  const FALLBACK_TITLE_SELECTOR = ".lhydbb.RIOtYe, .KcY3wb";
  const CENSORED_CLASS = "gctc-title-censored";
  const CENSORED_ATTR = "data-gctc-censored";
  const STYLE_ID = "gctc-style";

  let enabled = false;
  let observer = null;
  let scheduled = false;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${CENSORED_CLASS} {
        background: #000 !important;
        border-radius: 3px !important;
        box-decoration-break: clone !important;
        -webkit-box-decoration-break: clone !important;
        color: transparent !important;
        text-shadow: none !important;
        -webkit-text-fill-color: transparent !important;
      }
      .${CENSORED_CLASS} * {
        color: transparent !important;
        text-shadow: none !important;
        -webkit-text-fill-color: transparent !important;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function isVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }

    return Array.from(element.getClientRects()).some((rect) => {
      return rect.width > 0 && rect.height > 0;
    });
  }

  function uniqueElements(elements) {
    return Array.from(new Set(elements));
  }

  function findTitleTargets(chip) {
    const directTargets = uniqueElements(
      Array.from(chip.querySelectorAll(TITLE_SELECTOR)).filter(isVisible)
    );

    if (directTargets.length > 0) {
      return directTargets;
    }

    const fallbackTargets = uniqueElements(
      Array.from(chip.querySelectorAll(FALLBACK_TITLE_SELECTOR)).filter(
        isVisible
      )
    );

    return fallbackTargets.slice(0, 1);
  }

  function applyCensors() {
    if (!enabled) {
      return 0;
    }

    ensureStyle();

    let count = 0;
    document.querySelectorAll(CHIP_SELECTOR).forEach((chip) => {
      findTitleTargets(chip).forEach((title) => {
        title.classList.add(CENSORED_CLASS);
        title.setAttribute(CENSORED_ATTR, "true");
        count += 1;
      });
    });

    return count;
  }

  function clearCensors() {
    document.querySelectorAll(`[${CENSORED_ATTR}="true"]`).forEach((title) => {
      title.classList.remove(CENSORED_CLASS);
      title.removeAttribute(CENSORED_ATTR);
    });
  }

  function countCensoredTitles() {
    return document.querySelectorAll(`[${CENSORED_ATTR}="true"]`).length;
  }

  function scheduleApply() {
    if (!enabled || scheduled) {
      return;
    }

    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      applyCensors();
    });
  }

  function startObserver() {
    if (observer) {
      return;
    }

    observer = new MutationObserver(scheduleApply);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    window.addEventListener("resize", scheduleApply, { passive: true });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    window.removeEventListener("resize", scheduleApply);
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);

    if (enabled) {
      startObserver();
      return applyCensors();
    }

    stopObserver();
    clearCensors();
    return 0;
  }

  function getState() {
    return {
      enabled,
      count: countCensoredTitles()
    };
  }

  if (
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    chrome.runtime.onMessage
  ) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message.type !== "string") {
        return false;
      }

      if (message.type === "GCTC_GET_STATE") {
        sendResponse(getState());
        return false;
      }

      if (message.type === "GCTC_SET_ENABLED") {
        const count = setEnabled(message.enabled);
        sendResponse({ enabled, count });
        return false;
      }

      if (message.type === "GCTC_TOGGLE") {
        const count = setEnabled(!enabled);
        sendResponse({ enabled, count });
        return false;
      }

      return false;
    });
  }

  window.__googleCalendarTitleCensor = {
    apply: () => setEnabled(true),
    clear: () => setEnabled(false),
    getState,
    toggle: () => {
      const count = setEnabled(!enabled);
      return { enabled, count };
    }
  };
})();
