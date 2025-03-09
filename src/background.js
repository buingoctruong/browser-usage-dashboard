const entertainingSites = [
  "youtube.com",
  "netflix.com",
  "facebook.com",
  "www.instagram.com",
  "twitter.com",
  "reddit.com",
  "tiktok.com",
];

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

// Every second, add 1 second to the current active tab’s usage.
setInterval(() => {
  if (activeTabId) {
    chrome.tabs.get(activeTabId, (tab) => {
      if (tab && tab.url) {
        const domain = getDomain(tab.url);
        chrome.storage.local.get({ usageData: {} }, (data) => {
          let usageData = data.usageData;
          usageData[domain] = (usageData[domain] || 0) + 1; // add one second
          chrome.storage.local.set({ usageData }, () => {
            // After updating usage, check for entertainment alert.
            checkEntertainmentAlert(usageData);
          });
        });
      }
    });
  }
}, 1000);

// Helper function to extract domain from URL.
function getDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch (e) {
    return "unknown";
  }
}

// Check if total time on entertainment sites exceeds 7200 seconds (2 hours).
function checkEntertainmentAlert(usageData) {
  let totalEntertainmentTime = 0;
  for (let domain in usageData) {
    for (let site of entertainingSites) {
      if (domain.includes(site)) {
        totalEntertainmentTime += usageData[domain];
      }
    }
  }
  if (totalEntertainmentTime >= 30) {
    chrome.storage.local.get({ alertShown: false }, (data) => {
      if (!data.alertShown) {
        chrome.notifications.create(
          "entertainmentAlert",
          {
            type: "basic",
            iconUrl: "assets/icon48.png",
            title: "Time Alert",
            message:
              "You have spent more than 2 hours on entertaining websites today!",
            priority: 2,
          },
          () => {
            console.log("Entertainment alert notification created.");
          }
        );
        chrome.storage.local.set({ alertShown: true });
      }
    });
  }
}

// --- Daily Reset Logic ---
// Schedule an alarm to reset usage data at midnight (alarm is silent).
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
    chrome.storage.local.set({ usageData: {}, alertShown: false }, () => {
      console.log("Daily usage data reset.");
    });
  }
});

// Schedule the daily reset on startup.
scheduleDailyReset();
