const DASHBOARD_ENDPOINT =
  "https://australia-southeast1-wdl-field-forms.cloudfunctions.net/dashboard";
const JOB_INFO_ENDPOINT =
  "https://australia-southeast1-wdl-field-forms.cloudfunctions.net/jobInfo";
const ACCESS_CODE_KEY = "wdl-dashboard-access-code";

const state = {
  reports: [],
  chargeUpReports: [],
  hazardReports: [],
  jobs: [],
  calendarEntries: [],
  selectedReport: null,
  selectedJobNumber: "",
  selectedJobInfo: null,
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

const apiFetch = async (endpoint, path = "", options = {}) => {
  const response = await fetch(`${endpoint}${path}`, {
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

const dashboardFetch = (path = "", options = {}) =>
  apiFetch(DASHBOARD_ENDPOINT, path, options);

const jobInfoFetch = (path = "", options = {}) =>
  apiFetch(JOB_INFO_ENDPOINT, path, options);

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
  $("#chargeUpCount").textContent = state.chargeUpReports.length;
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
          <button
            class="job-row ${state.selectedJobNumber === job.number ? "selected" : ""}"
            type="button"
            data-select-job="${escapeHtml(job.number)}"
          >
            <strong>${escapeHtml(job.number)}</strong>
            <span>${escapeHtml(job.name)}</span>
          </button>`
      )
      .join("") || emptyHtml();
};

const setJobEditorDisabled = (isDisabled) => {
  [
    "#saveJobInfo",
    "#jobNotes",
    "#serviceLocationInfo",
    "#trafficManagementPlan",
    "#purchaseOrderNumbers",
    "#jobContacts",
    "#otherDetails",
    "#jobFileInput",
    "#chooseFiles",
    "#fileCategory",
    "#fileNotes",
  ].forEach((selector) => {
    const element = $(selector);
    if (element) element.disabled = isDisabled;
  });
};

const renderSelectedJobInfo = () => {
  const selectedJob = state.jobs.find((job) => job.number === state.selectedJobNumber);
  const jobInfo = state.selectedJobInfo || {};

  $("#selectedJobTitle").textContent = selectedJob
    ? `${selectedJob.number} - ${selectedJob.name}`
    : "Select a job";
  $("#selectedJobMeta").textContent = selectedJob
    ? "Office notes and files shown here are available in the field app."
    : "Choose a job to manage notes and files.";

  $("#jobNotes").value = jobInfo.notes || "";
  $("#serviceLocationInfo").value = jobInfo.serviceLocationInfo || "";
  $("#trafficManagementPlan").value = jobInfo.trafficManagementPlan || "";
  $("#purchaseOrderNumbers").value = jobInfo.purchaseOrderNumbers || "";
  $("#jobContacts").value = jobInfo.contacts || "";
  $("#otherDetails").value = jobInfo.otherDetails || "";

  setJobEditorDisabled(!selectedJob);

  $("#jobFilesList").innerHTML =
    jobInfo.files?.length > 0
      ? jobInfo.files
          .map(
            (file) => `
              <article class="file-record">
                <div>
                  <h4>${escapeHtml(file.filename)}</h4>
                  <p>${escapeHtml(file.category || "File")} | ${escapeHtml(
              file.notes || "No note"
            )}</p>
                  <small>${escapeHtml(formatDate(file.uploadedAtIso))}</small>
                </div>
                <div class="actions">
                  ${
                    file.url
                      ? `<a class="button-link" href="${escapeHtml(
                          file.url
                        )}" target="_blank" rel="noreferrer">Open</a>`
                      : ""
                  }
                  <button class="secondary" type="button" data-delete-file="${escapeHtml(
                    file.id
                  )}">Delete</button>
                </div>
              </article>`
          )
          .join("")
      : '<div class="empty">No files uploaded for this job yet.</div>';
};

const selectJob = async (jobNumber) => {
  state.selectedJobNumber = jobNumber;
  renderJobs();
  setJobEditorDisabled(true);
  $("#jobFilesList").innerHTML = '<div class="empty">Loading job information...</div>';

  const payload = await jobInfoFetch(`?jobNumber=${encodeURIComponent(jobNumber)}`);
  state.selectedJobInfo = payload.job || null;
  renderSelectedJobInfo();
};

const saveSelectedJobInfo = async () => {
  if (!state.selectedJobNumber) return;

  const selectedJob = state.jobs.find((job) => job.number === state.selectedJobNumber);
  const payload = await jobInfoFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "updateInfo",
      jobNumber: state.selectedJobNumber,
      name: selectedJob?.name || "",
      notes: $("#jobNotes").value,
      serviceLocationInfo: $("#serviceLocationInfo").value,
      trafficManagementPlan: $("#trafficManagementPlan").value,
      purchaseOrderNumbers: $("#purchaseOrderNumbers").value,
      contacts: $("#jobContacts").value,
      otherDetails: $("#otherDetails").value,
    }),
  });

  state.selectedJobInfo = payload.job || null;
  renderSelectedJobInfo();
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",").pop() || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const uploadFiles = async (files) => {
  if (!state.selectedJobNumber || !files.length) return;

  const selectedJob = state.jobs.find((job) => job.number === state.selectedJobNumber);

  for (const file of files) {
    const content = await fileToBase64(file);
    const payload = await jobInfoFetch("", {
      method: "POST",
      body: JSON.stringify({
        action: "uploadFile",
        jobNumber: state.selectedJobNumber,
        jobName: selectedJob?.name || "",
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        category: $("#fileCategory").value,
        notes: $("#fileNotes").value,
        content,
      }),
    });

    state.selectedJobInfo = payload.job || null;
  }

  $("#jobFileInput").value = "";
  $("#fileNotes").value = "";
  renderSelectedJobInfo();
};

const deleteJobFile = async (fileId) => {
  if (!state.selectedJobNumber || !fileId) return;

  if (!window.confirm("Delete this file from the job?")) return;

  const payload = await jobInfoFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "deleteFile",
      jobNumber: state.selectedJobNumber,
      fileId,
    }),
  });

  state.selectedJobInfo = payload.job || null;
  renderSelectedJobInfo();
};

const detailRows = (report) =>
  Object.entries(report.fields || {})
    .map(
      ([key, value]) => `
        <tr>
          <th>${escapeHtml(key.replace(/_/g, " "))}</th>
          <td>${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");

const printableHtml = (report) => `
<!doctype html>
<html>
  <head>
    <title>${escapeHtml(report.subject || report.reportType)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; margin: 28px; }
      h1 { border-bottom: 4px solid #d7ff2f; padding-bottom: 10px; }
      table { border-collapse: collapse; width: 100%; margin-top: 18px; }
      th, td { border: 1px solid #ccc; padding: 9px; text-align: left; vertical-align: top; }
      th { width: 30%; background: #f3f5f0; }
      pre { white-space: pre-wrap; border: 1px solid #ccc; padding: 14px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(report.reportType)}</h1>
    <p><strong>Subject:</strong> ${escapeHtml(report.subject)}</p>
    <p><strong>Submitted:</strong> ${escapeHtml(formatDate(report.submittedAtIso))}</p>
    <table>${detailRows(report)}</table>
    <h2>Filed Report</h2>
    <pre>${escapeHtml(report.message || "")}</pre>
  </body>
</html>`;

const openReport = (reportId) => {
  const report = state.reports.find((item) => item.id === reportId);

  if (!report) return;

  state.selectedReport = report;
  $("#reportDetail").innerHTML = `
    <div class="print-actions">
      <button type="button" id="printReport">Print / Save PDF</button>
      <button type="button" id="downloadReport">Download HTML</button>
    </div>
    <h2>${escapeHtml(report.subject || report.reportType)}</h2>
    <p class="meta">${reportMeta(report)}</p>
    <table class="detail-table">${detailRows(report)}</table>
    <h3>Filed Report</h3>
    <pre>${escapeHtml(report.message || "")}</pre>`;
  $("#reportDrawer").setAttribute("aria-hidden", "false");
};

const closeReport = () => {
  $("#reportDrawer").setAttribute("aria-hidden", "true");
  state.selectedReport = null;
};

const loadSummary = async () => {
  const payload = await dashboardFetch("?resource=summary");

  state.reports = payload.reports || [];
  state.chargeUpReports = payload.chargeUpReports || [];
  state.hazardReports = payload.hazardReports || [];
  state.jobs = payload.jobs || [];

  renderMetrics();
  renderReports();
  renderJobs();
  renderSelectedJobInfo();
};

const loadCalendar = async () => {
  const weekStart = $("#calendarWeek").value;
  const payload = await dashboardFetch(`?resource=calendar&weekStart=${weekStart}`);

  state.calendarEntries = payload.entries || [];
  renderCalendar();
};

const addJob = async (event) => {
  event.preventDefault();
  const number = $("#jobNumber").value.trim();
  const name = $("#jobName").value.trim();

  if (!number || !name) return;

  const payload = await dashboardFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "addJob",
      number,
      name,
    }),
  });

  state.jobs = [...state.jobs.filter((job) => job.number !== payload.job.number), payload.job]
    .sort((a, b) => a.number.localeCompare(b.number));
  $("#jobNumber").value = "";
  $("#jobName").value = "";
  renderMetrics();
  renderJobs();
};

const initialiseWeek = () => {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  today.setDate(today.getDate() + diffToMonday);
  $("#calendarWeek").value = today.toISOString().slice(0, 10);
};

const init = () => {
  $("#accessCode").value = getAccessCode();
  initialiseWeek();
  renderSelectedJobInfo();

  $("#saveAccessCode").addEventListener("click", () => {
    localStorage.setItem(ACCESS_CODE_KEY, $("#accessCode").value.trim());
    loadSummary().then(loadCalendar).catch((error) => alert(error.message));
  });

  $("#refreshDashboard").addEventListener("click", () =>
    loadSummary().then(loadCalendar).catch((error) => alert(error.message))
  );
  $("#reportSearch").addEventListener("input", renderReports);
  $("#reportTypeFilter").addEventListener("change", renderReports);
  $("#calendarWeek").addEventListener("change", loadCalendar);
  $("#jobForm").addEventListener("submit", (event) =>
    addJob(event).catch((error) => alert(error.message))
  );
  $("#saveJobInfo").addEventListener("click", () =>
    saveSelectedJobInfo().catch((error) => alert(error.message))
  );
  $("#chooseFiles").addEventListener("click", () => $("#jobFileInput").click());
  $("#jobFileInput").addEventListener("change", (event) =>
    uploadFiles(Array.from(event.target.files || [])).catch((error) => alert(error.message))
  );

  ["dragenter", "dragover"].forEach((eventName) => {
    $("#dropZone").addEventListener(eventName, (event) => {
      event.preventDefault();
      $("#dropZone").classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    $("#dropZone").addEventListener(eventName, (event) => {
      event.preventDefault();
      $("#dropZone").classList.remove("dragging");
    });
  });

  $("#dropZone").addEventListener("drop", (event) =>
    uploadFiles(Array.from(event.dataTransfer.files || [])).catch((error) =>
      alert(error.message)
    )
  );

  $$(".tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".tabs button").forEach((item) => item.classList.remove("active"));
      $$(".panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      $(`#${button.dataset.tab}`).classList.add("active");
    });
  });

  document.body.addEventListener("click", (event) => {
    const openReportId = event.target.closest("[data-open-report]")?.dataset.openReport;
    const selectJobNumber = event.target.closest("[data-select-job]")?.dataset.selectJob;
    const deleteFileId = event.target.closest("[data-delete-file]")?.dataset.deleteFile;

    if (openReportId) openReport(openReportId);
    if (selectJobNumber) selectJob(selectJobNumber).catch((error) => alert(error.message));
    if (deleteFileId) deleteJobFile(deleteFileId).catch((error) => alert(error.message));
  });

  $("#closeDrawer").addEventListener("click", closeReport);
  $("#reportDrawer").addEventListener("click", (event) => {
    if (event.target === $("#reportDrawer")) closeReport();
  });

  document.body.addEventListener("click", (event) => {
    if (event.target.id === "printReport" && state.selectedReport) {
      const printWindow = window.open("", "_blank");
      printWindow.document.write(printableHtml(state.selectedReport));
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }

    if (event.target.id === "downloadReport" && state.selectedReport) {
      const blob = new Blob([printableHtml(state.selectedReport)], {
        type: "text/html",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${state.selectedReport.reportType || "report"}-${
        state.selectedReport.id
      }.html`;
      link.click();
      URL.revokeObjectURL(url);
    }
  });

  loadSummary().then(loadCalendar).catch((error) => alert(error.message));
};

document.addEventListener("DOMContentLoaded", init);
