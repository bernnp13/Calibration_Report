const STORAGE_KEY = "calibration-report-app-state-v4";
const columns = ["WBC", "RBC", "HGB", "HCT", "PLT", "RBC-O", "WBC-O"];
const sampleRowKeys = ["wb1", "wb2", "wb3", "wb4", "wb5", "wb6", "wb7", "wb8", "wb9", "wb10"];
const rowDefinitions = [
  { key: "target", label: "Target", kind: "editable" },
  { key: "wb1", label: "WB #1", kind: "editable" },
  { key: "wb2", label: "WB #2", kind: "editable" },
  { key: "wb3", label: "WB #3", kind: "editable" },
  { key: "wb4", label: "WB #4", kind: "editable" },
  { key: "wb5", label: "WB #5", kind: "editable" },
  { key: "wb6", label: "WB #6", kind: "editable" },
  { key: "wb7", label: "WB #7", kind: "editable" },
  { key: "wb8", label: "WB #8", kind: "editable" },
  { key: "wb9", label: "WB #9", kind: "editable" },
  { key: "wb10", label: "WB #10", kind: "editable" },
  { key: "mean", label: "Mean", kind: "computed" },
  { key: "cv", label: "CV%", kind: "computed" },
  { key: "oldFactor", label: "Old Factor (%)", kind: "editable" },
  { key: "newFactor", label: "New Factor (%)", kind: "editable" },
];

const blankFields = {
  instrument: "",
  serialNo: "",
  company: "",
  address: "",
  lotNo: "",
  expDate: "",
  standardMaterial: "",
  materialLotNo: "",
  materialExpiry: "",
  traceability: "",
  dateCalibrated: "",
  performedBy: "",
};

function createBlankReport() {
  return rowDefinitions.reduce((rows, row) => {
    rows[row.key] = columns.reduce((cells, column) => {
      cells[column] = "";
      return cells;
    }, {});
    return rows;
  }, {});
}

function createBlankState() {
  return {
    selectedSite: "",
    fields: { ...blankFields },
    report: createBlankReport(),
  };
}

let state = loadState();

const siteGate = document.querySelector("#siteGate");
const siteOptionButtons = Array.from(document.querySelectorAll("[data-site-option]"));
const selectedSiteLabel = document.querySelector("#selectedSiteLabel");
const reportPage = document.querySelector("#reportPage");
const reportHeader = document.querySelector("#reportHeader");
const reportBrandLeft = document.querySelector("#reportBrandLeft");
const reportBrandTop = document.querySelector("#reportBrandTop");
const reportKicker = document.querySelector("#reportKicker");
const changeSiteButton = document.querySelector("#changeSiteButton");
const tableBody = document.querySelector("#tableBody");
const fieldInputs = Array.from(document.querySelectorAll("[data-field]"));
const pdfButton = document.querySelector("#pdfButton");
const ultraPdfButton = document.querySelector("#ultraPdfButton");
const printButton = document.querySelector("#printButton");
const sampleButton = document.querySelector("#sampleButton");
const clearButton = document.querySelector("#clearButton");
const exportButton = document.querySelector("#exportButton");
const importButton = document.querySelector("#importButton");
const importFileInput = document.querySelector("#importFileInput");
const statusMessage = document.querySelector("#statusMessage");
const ultraPrintButton = document.querySelector("#ultraPrintButton");

let currentStatusMessage =
  "Stored locally in this browser. Export a JSON backup to move reports to another device.";
let activePrintMode = "standard";
let activePrintHost = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createBlankState();
    const parsed = JSON.parse(raw);
    return mergeState(parsed);
  } catch {
    return createBlankState();
  }
}

function mergeState(savedState) {
  const fresh = createBlankState();
  const merged = {
    selectedSite:
      savedState?.selectedSite === "SAE" || savedState?.selectedSite === "SAHPC"
        ? savedState.selectedSite
        : "",
    fields: { ...fresh.fields, ...(savedState?.fields ?? {}) },
    report: createBlankReport(),
  };

  for (const row of rowDefinitions) {
    for (const column of columns) {
      const value = savedState?.report?.[row.key]?.[column];
      merged.report[row.key][column] = typeof value === "string" ? value : "";
    }
  }

  if (savedState?.report) {
    for (const row of rowDefinitions) {
      if (typeof savedState.report?.[row.key]?.MCV === "string" && !merged.report[row.key].HCT) {
        merged.report[row.key].HCT = savedState.report[row.key].MCV;
      }
      if (typeof savedState.report?.[row.key]?.["PLT-O"] === "string" && !merged.report[row.key]["WBC-O"]) {
        merged.report[row.key]["WBC-O"] = savedState.report[row.key]["PLT-O"];
      }
    }
  }

  if (savedState?.tabs?.["ct-wb"]) {
    for (const row of rowDefinitions) {
      const legacyRow = savedState.tabs["ct-wb"]?.[row.key];
      if (!legacyRow) continue;

      merged.report[row.key].WBC = typeof legacyRow.WBC === "string" ? legacyRow.WBC : merged.report[row.key].WBC;
      merged.report[row.key].RBC = typeof legacyRow.RBC === "string" ? legacyRow.RBC : merged.report[row.key].RBC;
      merged.report[row.key].HGB = typeof legacyRow.HGB === "string" ? legacyRow.HGB : merged.report[row.key].HGB;
      merged.report[row.key].HCT = typeof legacyRow.MCV === "string" ? legacyRow.MCV : merged.report[row.key].HCT;
      merged.report[row.key].PLT = typeof legacyRow.PLT === "string" ? legacyRow.PLT : merged.report[row.key].PLT;
      merged.report[row.key]["RBC-O"] =
        typeof legacyRow["RBC-O"] === "string" ? legacyRow["RBC-O"] : merged.report[row.key]["RBC-O"];
      merged.report[row.key]["WBC-O"] =
        typeof legacyRow["PLT-O"] === "string" ? legacyRow["PLT-O"] : merged.report[row.key]["WBC-O"];
    }
  }

  return merged;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderStatus();
}

function setStatus(message) {
  currentStatusMessage = message;
  renderStatus();
}

function renderStatus() {
  statusMessage.textContent = currentStatusMessage;
}

function isAllowedColumn(row, column) {
  if (!row.limited) return true;
  return row.limited.includes(column);
}

function parseNumber(value) {
  if (typeof value !== "string") return Number.NaN;
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

function formatComputed(value) {
  if (!Number.isFinite(value)) return "";
  return Number(value.toFixed(2)).toString();
}

function computeMean(column) {
  const values = sampleRowKeys
    .map((rowKey) => parseNumber(state.report[rowKey][column]))
    .filter((value) => Number.isFinite(value));

  if (!values.length) return "";
  const total = values.reduce((sum, value) => sum + value, 0);
  return formatComputed(total / values.length);
}

function computeCv(column) {
  const values = sampleRowKeys
    .map((rowKey) => parseNumber(state.report[rowKey][column]))
    .filter((value) => Number.isFinite(value));

  if (values.length < 2) return "";

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return "";

  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  const standardDeviation = Math.sqrt(variance);
  return formatComputed((standardDeviation / mean) * 100);
}

function syncComputedRows() {
  for (const column of columns) {
    state.report.mean[column] = computeMean(column);
    state.report.cv[column] = computeCv(column);
  }
}

function buildTable() {
  syncComputedRows();
  tableBody.innerHTML = "";

  for (const row of rowDefinitions) {
    const tableRow = document.createElement("tr");

    const labelCell = document.createElement("td");
    labelCell.className = "row-label";
    labelCell.textContent = row.label;
    tableRow.appendChild(labelCell);

    for (const column of columns) {
      const cell = document.createElement("td");
      const allowed = isAllowedColumn(row, column);

      if (!allowed) {
        cell.className = "slash-cell";
        cell.textContent = "/";
        tableRow.appendChild(cell);
        continue;
      }

      const input = document.createElement("input");
      input.className = "cell-input";
      input.type = "text";
      input.dataset.row = row.key;
      input.dataset.column = column;
      input.value = state.report[row.key][column];

      if (row.kind === "computed") {
        input.readOnly = true;
        input.tabIndex = -1;
        input.classList.add("readonly");
      } else {
        input.addEventListener("input", handleCellInput);
      }

      cell.appendChild(input);
      tableRow.appendChild(cell);
    }

    tableBody.appendChild(tableRow);
  }
}

function renderFields() {
  fieldInputs.forEach((input) => {
    const key = input.dataset.field;
    input.value = state.fields[key] ?? "";
  });
}

function renderSiteSelection() {
  const label = state.selectedSite || "Not selected";
  selectedSiteLabel.textContent = label;
  const isSae = state.selectedSite === "SAE";
  const isSahpc = state.selectedSite === "SAHPC";

  reportHeader.classList.toggle("brand-sae", isSae);
  reportHeader.classList.toggle("brand-sahpc", isSahpc);
  reportBrandLeft.classList.toggle("visible", isSae);
  reportBrandTop.classList.toggle("visible", isSahpc);
  reportKicker.classList.toggle("hidden", isSahpc);

  const gateOpen = !state.selectedSite;
  siteGate.classList.toggle("active", gateOpen);
  document.body.classList.toggle("gate-open", gateOpen);
}

function render() {
  renderSiteSelection();
  renderStatus();
  renderFields();
  buildTable();
}

function handleFieldInput(event) {
  const key = event.target.dataset.field;
  state.fields[key] = event.target.value;
  saveState();
}

function handleCellInput(event) {
  const { row, column } = event.target.dataset;
  const nextValue = event.target.value;

  state.report[row][column] = nextValue;
  syncComputedRows();
  saveState();
  buildTable();

  const activeElement = tableBody.querySelector(
    `[data-row="${CSS.escape(row)}"][data-column="${CSS.escape(column)}"]`,
  );
  activeElement?.focus();
  activeElement?.setSelectionRange?.(nextValue.length, nextValue.length);
}

function selectSite(site) {
  state.selectedSite = site;
  saveState();
  renderSiteSelection();
}

function loadSampleData() {
  const selectedSite = state.selectedSite;

  state = createBlankState();
  state.selectedSite = selectedSite;

  const sampleReport = {
    wb1: [7.12, 4.66, 13.8, 88.4, 248, 35.4, 9.4],
    wb2: [7.18, 4.61, 13.7, 88.8, 251, 35.1, 9.7],
    wb3: [7.09, 4.64, 13.9, 88.6, 249, 35.2, 9.5],
    wb4: [7.15, 4.62, 13.8, 88.5, 250, 35.3, 9.6],
    wb5: [7.11, 4.63, 13.7, 88.7, 252, 35.2, 9.6],
    wb6: [7.14, 4.65, 13.8, 88.6, 249, 35.4, 9.5],
    wb7: [7.13, 4.64, 13.8, 88.5, 250, 35.3, 9.5],
    wb8: [7.16, 4.62, 13.7, 88.7, 251, 35.2, 9.6],
    wb9: [7.1, 4.63, 13.8, 88.6, 250, 35.3, 9.5],
    wb10: [7.12, 4.64, 13.8, 88.5, 249, 35.4, 9.6],
    target: [7.1, 4.6, 13.8, 88.5, 250, 35.3, 9.5],
    oldFactor: ["", "", "", "", "", "", "1.8"],
    newFactor: ["", "", "", "", "", "", "1.2"],
  };

  for (const [rowKey, values] of Object.entries(sampleReport)) {
    values.forEach((value, index) => {
      state.report[rowKey][columns[index]] = String(value);
    });
  }

  syncComputedRows();
  saveState();
  setStatus("Sample table data loaded. Header, traceability, and signoff fields were left blank.");
  render();
}

function clearForm() {
  const selectedSite = state.selectedSite;
  state = createBlankState();
  state.selectedSite = selectedSite;
  saveState();
  setStatus("Form cleared. Your location selection was kept, and all report fields were reset.");
  render();
}

function createExportPayload() {
  return {
    app: "calibration-report-builder",
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
}

function buildFileStem() {
  const site = state.selectedSite || "report";
  const date = new Date().toISOString().slice(0, 10);
  return `${site.toLowerCase()}-calibration-report-${date}`;
}

function setExportCompact(enabled) {
  document.body.classList.toggle("export-compact", enabled);
}

function setUltraPrintMode(enabled) {
  document.body.classList.toggle("ultra-print", enabled);
}

function applyPrintMode(mode) {
  activePrintMode = mode;
  setUltraPrintMode(mode === "ultra");
}

function resetPrintMode() {
  activePrintMode = "standard";
  setUltraPrintMode(false);
}

function syncClonedInputValues(sourceRoot, cloneRoot) {
  const sourceInputs = Array.from(sourceRoot.querySelectorAll("input"));
  const cloneInputs = Array.from(cloneRoot.querySelectorAll("input"));

  sourceInputs.forEach((input, index) => {
    const cloneInput = cloneInputs[index];
    if (!cloneInput) return;
    cloneInput.value = input.value;
    cloneInput.setAttribute("value", input.value);
  });
}

function cleanupPrintHost() {
  activePrintHost?.remove();
  activePrintHost = null;
  document.body.classList.remove("print-sheet-mode");
  setExportCompact(false);
  setUltraPrintMode(false);
}

function waitForRenderFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

async function createPrintHost(mode = "standard") {
  cleanupPrintHost();
  applyPrintMode(mode);
  setExportCompact(true);

  const host = document.createElement("div");
  host.id = "printSheetHost";

  const sheet = document.createElement("div");
  sheet.className = "print-sheet";

  const clone = reportPage.cloneNode(true);
  clone.id = "reportPagePrintClone";
  syncClonedInputValues(reportPage, clone);

  sheet.appendChild(clone);
  host.appendChild(sheet);
  document.body.appendChild(host);
  activePrintHost = host;

  await waitForRenderFrame();

  const initialRect = clone.getBoundingClientRect();
  const maxWidth = sheet.clientWidth;
  const maxHeight = sheet.clientHeight;
  const scale = Math.min(maxWidth / initialRect.width, maxHeight / initialRect.height, 1);

  clone.style.width = `${initialRect.width}px`;
  clone.style.maxWidth = "none";
  clone.style.margin = "0";
  clone.style.transformOrigin = "top left";
  clone.style.transform = `scale(${scale})`;

  return { host, sheet, clone, scale };
}

async function printReport(mode = "standard") {
  try {
    await createPrintHost(mode);
    document.body.classList.add("print-sheet-mode");

    if (mode === "ultra") {
      setStatus("Ultra Compact Print Mode opened. Turn off browser headers and footers for the best one-page result.");
    }

    window.print();
  } catch {
    cleanupPrintHost();
    setStatus("Print layout could not be prepared. Please try again.");
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(createExportPayload(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${buildFileStem()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setStatus("Report data exported as JSON. You can import that file on another device.");
}

async function importDataFile(event) {
  const [file] = event.target.files ?? [];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const nextState = parsed?.state ?? parsed;

    state = mergeState(nextState);
    saveState();
    setStatus(`Imported report data from ${file.name}.`);
    render();
  } catch {
    setStatus("That file could not be imported. Use a JSON export created by this app.");
  } finally {
    importFileInput.value = "";
  }
}

async function downloadPdf(mode = "standard") {
  const pdfApi = window.html2pdf;
  if (!pdfApi) {
    setStatus("PDF library not available right now. Print was opened instead.");
    window.print();
    return;
  }

  const activeButton = mode === "ultra" ? ultraPdfButton : pdfButton;
  const previousLabel = activeButton.textContent;
  pdfButton.disabled = true;
  ultraPdfButton.disabled = true;
  activeButton.textContent = mode === "ultra" ? "Preparing Ultra PDF..." : "Preparing PDF...";

  try {
    const { sheet } = await createPrintHost(mode);

    await pdfApi()
      .set({
        filename: `${buildFileStem()}.pdf`,
        margin: [0, 0, 0, 0],
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all"] },
      })
      .from(sheet)
      .save();

    setStatus(mode === "ultra" ? "Ultra compact PDF downloaded successfully." : "PDF downloaded successfully.");
  } catch {
    setStatus("PDF download failed. You can still use Print to save the report as PDF.");
  } finally {
    cleanupPrintHost();
    pdfButton.disabled = false;
    ultraPdfButton.disabled = false;
    activeButton.textContent = previousLabel;
  }
}

window.addEventListener("beforeprint", () => {
  setUltraPrintMode(activePrintMode === "ultra");
});

window.addEventListener("afterprint", () => {
  cleanupPrintHost();
  resetPrintMode();
});

fieldInputs.forEach((input) => input.addEventListener("input", handleFieldInput));
siteOptionButtons.forEach((button) =>
  button.addEventListener("click", () => selectSite(button.dataset.siteOption)),
);
changeSiteButton.addEventListener("click", () => {
  state.selectedSite = "";
  saveState();
  setStatus("Selection cleared. Choose SAE or SAHPC before entering report data.");
  renderSiteSelection();
});

pdfButton.addEventListener("click", () => downloadPdf("standard"));
ultraPdfButton.addEventListener("click", () => downloadPdf("ultra"));
printButton.addEventListener("click", () => printReport("standard"));
ultraPrintButton.addEventListener("click", () => printReport("ultra"));
sampleButton.addEventListener("click", loadSampleData);
clearButton.addEventListener("click", clearForm);
exportButton.addEventListener("click", exportData);
importButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", importDataFile);

render();
