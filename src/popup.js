import { Chart } from "chart.js/auto";

let chartInstance;
const MAX_VISIBLE_DOMAINS = 5; // Maximum number of domains to display individually
let currentUsageData = {}; // Global variable to store the latest usage data

document.addEventListener("DOMContentLoaded", () => {
  // Load usage data and update the UI for the dashboard view.
  chrome.storage.local.get({ usageData: {} }, (data) => {
    const usageData = data.usageData;
    currentUsageData = usageData;
    updateChart(usageData);
    updateUsageList(usageData);
  });

  // Setup navigation tabs to toggle between views.
  const dashboardTab = document.getElementById("dashboardTab");
  const configTab = document.getElementById("configTab");
  const dashboardView = document.getElementById("dashboardView");
  const configView = document.getElementById("configView");

  dashboardTab.addEventListener("click", () => {
    dashboardTab.classList.add("active");
    configTab.classList.remove("active");
    dashboardView.style.display = "block";
    configView.style.display = "none";
  });

  configTab.addEventListener("click", () => {
    configTab.classList.add("active");
    dashboardTab.classList.remove("active");
    configView.style.display = "block";
    dashboardView.style.display = "none";
  });

  // Listen for clicks on the chart canvas to detect clicks on the "Other" slice.
  document
    .getElementById("usageChart")
    .addEventListener("click", function (event) {
      if (chartInstance) {
        const activePoints = chartInstance.getElementsAtEventForMode(
          event,
          "nearest",
          { intersect: true },
          true
        );
        if (activePoints.length > 0) {
          const index = activePoints[0].index;
          if (chartInstance.data.labels[index] === "Other") {
            alert("Other Websites Breakdown:\n" + getOtherBreakdown());
          }
        }
      }
    });

  // Handle domain form submission for adding/updating domain limits.
  const domainForm = document.getElementById("domainForm");
  domainForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const domainInput = document.getElementById("domainInput").value.trim();
    const limitInput = document.getElementById("limitInput").value.trim();
    const limit = parseInt(limitInput, 10);

    if (domainInput && !isNaN(limit)) {
      // Retrieve current domain limits and usage data
      chrome.storage.local.get({ domainLimits: {}, usageData: {} }, (data) => {
        const domainLimits = data.domainLimits;
        const usageData = data.usageData;

        // Update the domain limit
        domainLimits[domainInput] = limit;

        // Reset the time spent for this domain
        usageData[domainInput] = 0;

        // Save the updated data
        chrome.storage.local.set({ domainLimits, usageData }, () => {
          updateLimitsList(domainLimits);

          // Clear the form inputs
          document.getElementById("domainInput").value = "";
          document.getElementById("limitInput").value = "";
        });
      });
    }
  });

  // Load domain limits and update the list on popup load.
  chrome.storage.local.get({ domainLimits: {} }, (data) => {
    updateLimitsList(data.domainLimits);
  });
});

// Update the main chart with usage data, grouping extra domains as "Other".
function updateChart(usageData) {
  currentUsageData = usageData; // Store globally for later use in breakdown.
  // Sort the entries by time descending.
  const sorted = Object.entries(usageData).sort((a, b) => b[1] - a[1]);
  const topEntries = sorted.slice(0, MAX_VISIBLE_DOMAINS);
  const otherEntries = sorted.slice(MAX_VISIBLE_DOMAINS);
  const labels = topEntries.map((item) => item[0]);
  const times = topEntries.map((item) => Math.round(item[1]));

  // Group the remaining domains into "Other".
  if (otherEntries.length > 0) {
    const otherTotal = otherEntries.reduce((sum, item) => sum + item[1], 0);
    labels.push("Other");
    times.push(Math.round(otherTotal));
  }

  if (!chartInstance) {
    const ctx = document.getElementById("usageChart").getContext("2d");
    chartInstance = new Chart(ctx, {
      type: "pie",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Time Spent (s)",
            data: times,
            backgroundColor: generateColors(labels.length),
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    });
  } else {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = times;
    chartInstance.data.datasets[0].backgroundColor = generateColors(
      labels.length
    );
    chartInstance.update();
  }
}

// Update the usage list displayed below the chart.
function updateUsageList(usageData) {
  const usageList = document.getElementById("usageList");
  usageList.innerHTML = ""; // Clear existing list.
  const domains = Object.keys(usageData).sort(
    (a, b) => usageData[b] - usageData[a]
  );
  domains.forEach((domain) => {
    const li = document.createElement("li");
    li.textContent = `${domain}: ${Math.round(usageData[domain])} seconds`;
    usageList.appendChild(li);
  });
}

// When "Other" is clicked, return a breakdown string of the grouped domains.
function getOtherBreakdown() {
  const sorted = Object.entries(currentUsageData).sort((a, b) => b[1] - a[1]);
  const otherEntries = sorted.slice(MAX_VISIBLE_DOMAINS);
  return otherEntries
    .map(([domain, time]) => `${domain}: ${Math.round(time)} s`)
    .join("\n");
}

// Helper function to generate an array of distinct colors.
function generateColors(n) {
  const colors = [];
  for (let i = 0; i < n; i++) {
    colors.push(`hsl(${(i * 360) / n}, 70%, 60%)`);
  }
  return colors;
}

/**
 * Update the "Current Domain Limits" list in the UI.
 * domainLimits is an object with domain names as keys and time limits (in seconds) as values.
 */
function updateLimitsList(domainLimits) {
  const limitsList = document.getElementById("limitsList");
  limitsList.innerHTML = ""; // Clear current list.
  Object.keys(domainLimits).forEach((domain) => {
    const li = document.createElement("li");
    li.textContent = `${domain}: ${domainLimits[domain]} s`;
    // Add a remove button to allow deletion of the domain limit.
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.style.marginLeft = "10px";
    removeBtn.addEventListener("click", () => {
      chrome.storage.local.get(
        { domainLimits: {}, alertedDomains: {} },

        (data) => {
          const limits = data.domainLimits;
          delete limits[domain];

          chrome.storage.local.set({ domainLimits: limits }, () => {
            updateLimitsList(limits);
          });

          if (data.alertedDomains[domain]) {
            const alerts = data.alertedDomains;
            delete alerts[domain];

            chrome.storage.local.set({ alertedDomains: alerts });
          }
        }
      );
    });
    li.appendChild(removeBtn);
    limitsList.appendChild(li);
  });
}
