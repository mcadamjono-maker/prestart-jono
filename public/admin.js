const DASHBOARD_ENDPOINT =
  "https://australia-southeast1-wdl-field-forms.cloudfunctions.net/dashboard";
const ACCESS_CODE_KEY = "wdl-dashboard-access-code";

const state = {
  reports: [],
  purchaseRequests: [],
  hazardReports: [],
  jobs: [],
  calendarEntries: [],
  selectedReport: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDate = (value) => {
  if (!value) return "Not supplied";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getAccessCode = () => localStorage.getItem(ACCESS_CODE_KEY) || "";

const dashboardFetch = async (path = "", options = {}) => {
  const response = await fetch(`${DASHBOARD_ENDPOINT}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-dashboard-code": getAccessCode(),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Dashboard request failed (${response.status}).`);
  }

  return payload;
};

const emptyHtml = () => $("#emptyTemplate").innerHTML;

const reportMeta = (report) =>
  [
    report.jobName || report.siteAddress || report.jobNumber,
    report.requestedBy,
    report.supplier,
    formatDate(report.submittedAtIso),
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" | ");

const renderMetrics = () => {
  $("#reportCount").textContent = state.reports.length;
  $("#purchaseCount").textContent = state.purchaseRequests.length;
  $("#hazardCount").textContent = state.hazardReports.length;
  $("#jobCount").textContent = state.jobs.length;
};

const renderReports = () => {
  const search = $("#reportSearch").value.toLowerCase().trim();
  const type = $("#reportTypeFilter").value;
  const filtered = state.reports.filter((report) => {
    const haystack = JSON.stringify(report).toLowerCase();

    return (!type || report.reportType === type) && (!search || haystack.includes(search));
  });

  $("#reportsList").innerHTML =
    filtered
      .map(
        (report) => `
          <article class="record">
            <div>
              <h3>${escapeHtml(report.subject || report.reportType)}</h3>
              <div class="meta">${reportMeta(report)}</div>
            </div>
            <div class="actions">
              <span class="badge">${escapeHtml(report.reportType)}</span>
              <button type="button" data-open-report="${report.id}">Open</button>
            </div>
          </article>`
      )
      .join("") || emptyHtml();
};

const renderPurchaseRequests = () => {
  $("#purchaseList").innerHTML =
    state.purchaseRequests
      .map(
        (report) => `
          <article class="record">
            <div>
              <h3>${escapeHtml(report.supplier || report.subject)}</h3>
              <div class="meta">${reportMeta(report)}</div>
              <div class="po-editor" data-po-editor="${report.id}">
                <select data-po-status>
                  ${["Pending", "Issued", "Declined", "Completed"]
                    .map(
                      (status) =>
                        `<option ${report.status === status ? "selected" : ""}>${status}</option>`
                    )
                    .join("")}
                </select>
                <input data-po-number placeholder="Xero PO number" value="${escapeHtml(
                  report.purchaseOrderNumber || ""
                )}" />
                <input data-po-note placeholder="Admin note" value="${escapeHtml(
                  report.adminNote || ""
                )}" />
                <button type="button" data-save-po="${report.id}">Save</button>
              </div>
            </div>
            <div class="actions">
              <span class="badge ${String(report.status || "").toLowerCase()}">${escapeHtml(
          report.status || "Pending"
        )}</span>
              <button class="secondary" type="button" data-open-report="${report.id}">Open</button>
            </div>
          </article>`
      )
      .join("") || emptyHtml();
};

const getWeekDates = (weekStart) => {
  const start = new Date(`${weekStart}T00:00:00`);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day.toISOString().slice(0, 10);
  });
};

const renderCalendar = () => {
  const weekStart = $("#calendarWeek").value;
  const days = getWeekDates(weekStart);
  const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  $("#calendarGrid").innerHTML = days
    .map((date, index) => {
      const entries = state.calendarEntries.filter((entry) => entry.date === date);

      return `
        <section class="day">
          <h3>${dayLabels[index]}<br />${date}</h3>
          ${
            entries
              .map(
                (entry) => `
                  <div class="signon">
                    <strong>${escapeHtml(entry.name)}</strong>
                    <div>${escapeHtml(entry.jobName || entry.siteAddress || "Job")}</div>
                    <small>${escapeHtml(entry.signedAt || "")}</small>
                  </div>`
              )
              .join("") || '<div class="empty">No sign-ons</div>'
          }
        </section>`;
    })
    .join("");
};

const renderJobs = () => {
  $("#jobsList").innerHTML =
    state.jobs
      .map(
        (job) => `
          <article class="job">
            <strong>${escapeHtml(job.number)}</strong>
            <span>${escapeHtml(job.name)}</span>
          </article>`
      )
      .join("") || emptyHtml();
};

const renderReportDetail = (report) => {
  const fields = Object.entries(report.fields || {});

  $("#reportDetail").innerHTML = `
    <h2>${escapeHtml(report.subject || report.reportType)}</h2>
    <p class="meta">${escapeHtml(report.reportType)} | ${formatDate(report.submittedAtIso)}</p>
    <div class="print-actions">
      <button type="button" id="printReport">Print / Save PDF</button>
      <button type="button" class="secondary" id="downloadReportHtml">Download printable copy</button>
    </div>
    <h3>Fields</h3>
    ${
      fields
        .map(
          ([label, value]) => `
            <div class="detail-field">
              <span>${escapeHtml(label.replace(/_/g, " "))}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>`
        )
        .join("") || '<div class="empty">No fields stored.</div>'
    }
    <h3>Filed Report</h3>
    <pre>${escapeHtml(report.message || "")}</pre>
    <h3>Attachments</h3>
    ${
      (report.attachmentSummary || [])
        .map(
          (attachment) =>
            `<div class="detail-field"><span>${escapeHtml(
              attachment.contentType
            )}</span><strong>${escapeHtml(attachment.filename)}</strong></div>`
        )
        .join("") || '<div class="empty">No attachment metadata.</div>'
    }
  `;
  $("#reportDrawer").classList.add("open");
  $("#reportDrawer").setAttribute("aria-hidden", "false");
};

const getPrintableHtml = (report) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(report.subject || report.reportType)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; margin: 28px; }
      h1 { border-bottom: 5px solid #d7ff2f; padding-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin: 18px 0; }
      td { border: 1px solid #ccc; padding: 8px; vertical-align: top; }
      td:first-child { width: 32%; font-weight: bold; background: #f4f4f4; }
      pre { white-space: pre-wrap; font-family: Consolas, monospace; border: 1px solid #ccc; padding: 12px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(report.reportType)}</h1>
    <p><strong>Subject:</strong> ${escapeHtml(report.subject)}</p>
    <p><strong>Submitted:</strong> ${formatDate(report.submittedAtIso)}</p>
    <table>
      ${Object.entries(report.fields || {})
        .map(
          ([label, value]) =>
            `<tr><td>${escapeHtml(label.replace(/_/g, " "))}</td><td>${escapeHtml(value)}</td></tr>`
        )
        .join("")}
    </table>
    <h2>Filed Report</h2>
    <pre>${escapeHtml(report.message || "")}</pre>
  </body>
</html>`;

const printReport = (report) => {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return;

  printWindow.document.write(getPrintableHtml(report));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

const downloadReportHtml = (report) => {
  const blob = new Blob([getPrintableHtml(report)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${(report.subject || report.reportType || "report")
    .replace(/[^\w.-]+/g, "-")
    .toLowerCase()}.html`;
  link.click();
  URL.revokeObjectURL(url);
};

const refreshDashboard = async () => {
  const payload = await dashboardFetch("?resource=summary");

  state.reports = payload.reports || [];
  state.purchaseRequests = payload.purchaseRequests || [];
  state.hazardReports = payload.hazardReports || [];
  state.jobs = payload.jobs || [];

  renderMetrics();
  renderReports();
  renderPurchaseRequests();
  renderJobs();
  await refreshCalendar();
};

const refreshCalendar = async () => {
  const weekStart = $("#calendarWeek").value;
  const payload = await dashboardFetch(`?resource=calendar&weekStart=${weekStart}`);

  state.calendarEntries = payload.entries || [];
  renderCalendar();
};

const getCurrentWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  now.setDate(now.getDate() + diff);
  return now.toISOString().slice(0, 10);
};

const bindEvents = () => {
  $$(".tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".tabs button").forEach((tab) => tab.classList.remove("active"));
      $$(".panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      $(`#${button.dataset.tab}`).classList.add("active");
    });
  });

  $("#saveAccessCode").addEventListener("click", () => {
    localStorage.setItem(ACCESS_CODE_KEY, $("#accessCode").value);
    refreshDashboard().catch((error) => alert(error.message));
  });
  $("#refreshDashboard").addEventListener("click", () =>
    refreshDashboard().catch((error) => alert(error.message))
  );
  $("#reportSearch").addEventListener("input", renderReports);
  $("#reportTypeFilter").addEventListener("change", renderReports);
  $("#calendarWeek").addEventListener("change", () =>
    refreshCalendar().catch((error) => alert(error.message))
  );
  $("#closeDrawer").addEventListener("click", () => {
    $("#reportDrawer").classList.remove("open");
    $("#reportDrawer").setAttribute("aria-hidden", "true");
  });
  $("#jobForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await dashboardFetch("", {
      method: "POST",
      body: JSON.stringify({
        action: "addJob",
        number: $("#jobNumber").value,
        name: $("#jobName").value,
      }),
    });
    $("#jobNumber").value = "";
    $("#jobName").value = "";
    await refreshDashboard();
  });
  document.body.addEventListener("click", async (event) => {
    const openId = event.target.dataset.openReport;
    const savePoId = event.target.dataset.savePo;

    if (openId) {
      const report = state.reports.find((item) => item.id === openId);
      state.selectedReport = report;
      renderReportDetail(report);
      return;
    }

    if (savePoId) {
      const editor = document.querySelector(`[data-po-editor="${savePoId}"]`);
      await dashboardFetch("", {
        method: "POST",
        body: JSON.stringify({
          action: "updatePurchase",
          reportId: savePoId,
          status: editor.querySelector("[data-po-status]").value,
          poNumber: editor.querySelector("[data-po-number]").value,
          adminNote: editor.querySelector("[data-po-note]").value,
        }),
      });
      await refreshDashboard();
      return;
    }

    if (event.target.id === "printReport" && state.selectedReport) {
      printReport(state.selectedReport);
    }

    if (event.target.id === "downloadReportHtml" && state.selectedReport) {
      downloadReportHtml(state.selectedReport);
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  $("#accessCode").value = getAccessCode();
  $("#calendarWeek").value = getCurrentWeekStart();
  bindEvents();
  refreshDashboard().catch((error) => {
    $("#reportsList").innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  });
});
