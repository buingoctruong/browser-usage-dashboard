let activeTabId = null;

// Update activeTabId on tab activation.
chrome.tabs.onActivated.addListener((activeInfo) => {
  activeTabId = activeInfo.tabId;
});

// Update activeTabId on window focus changes.
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    activeTabId = null;
  } else {
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (tabs.length > 0) {
        activeTabId = tabs[0].id;
      }
    });
  }
});

// Helper function to extract domain from a URL.
function getDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch (e) {
    return "unknown";
  }
}

/**
 * Checks if the time spent on a domain exceeds the user-defined limit.
 * If the limit is reached and an alert has not been shown for that domain,
 * a notification is triggered.
 */
function checkUserDomainLimit(domain, timeSpent) {
  chrome.storage.local.get(
    { domainLimits: {}, alertedDomains: {} },
    (settings) => {
      const { domainLimits, alertedDomains } = settings;
      // Debug log for checking domain limits
      console.log(
        `Checking ${domain}: timeSpent = ${timeSpent}, limit = ${
          domainLimits[domain] || "none"
        }`
      );

      if (domainLimits[domain] && timeSpent >= domainLimits[domain]) {
        if (!alertedDomains[domain]) {
          chrome.notifications.create(
            {
              type: "basic",
              iconUrl: "assets/icon48.png",
              title: "Time Limit Alert",
              message: `You have exceeded your time limit for ${domain}!`,
              priority: 2,
              requireInteraction: true,
            },
            () => {
              // Debug log for checking notification creation
              console.log(
                `Time limit exceeded notification created for ${domain}`
              );
            }
          );
          alertedDomains[domain] = true;
          chrome.storage.local.set({ alertedDomains });
        }
      }
    }
  );
}

// Every second, add 1 second to the current active tab's usage.
setInterval(() => {
  if (activeTabId) {
    chrome.tabs.get(activeTabId, (tab) => {
      if (tab && tab.url) {
        const domain = getDomain(tab.url);
        chrome.storage.local.get({ usageData: {} }, (data) => {
          let usageData = data.usageData;
          usageData[domain] = (usageData[domain] || 0) + 1; // add one second
          chrome.storage.local.set({ usageData }, () => {
            // Check the current domain's usage against its limit.
            checkUserDomainLimit(domain, usageData[domain]);
          });
        });
      }
    });
  }
}, 1000);

// --- Daily Reset Logic ---
// Schedule an alarm to reset usage data and alert flags at midnight.
function scheduleDailyReset() {
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  ).getTime();
  chrome.alarms.create("dailyReset", {
    when: nextMidnight,
    periodInMinutes: 1440,
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyReset") {
    chrome.storage.local.set({ usageData: {}, alertedDomains: {} }, () => {
      console.log("Daily usage data and alert flags reset.");
    });
  }
});

// Schedule the daily reset on startup.
scheduleDailyReset();
