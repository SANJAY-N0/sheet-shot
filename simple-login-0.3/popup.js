// ─── Constants ───────────────────────────────────────────────────────────────
const OAUTH_CLIENT_ID =
  "612679483614-xxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com";

// ─── Alphabet Lookup (A → BM) ────────────────────────────────────────────────
const alphabet = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM",
  "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ",
  "BA", "BB", "BC", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BK", "BL", "BM",
];

// ─── State ────────────────────────────────────────────────────────────────────
let sheetValuesMatrix = [];
let sheetFormulasMatrix = [];
let sheetHyperlinkMatrix = []; // cell hyperlinks from spreadsheets.get API

// Block 1 — Name Viewer: configurable column (default C), navigates by Row
let b1Col = "C";
let b1Row = 9;

// Block 2 — Value Viewer: fixed Row 8, navigates by Column
let b2ColIdx = 5; // default "F" (first problem col in MERN_DS)
const B2_FIXED_ROW = 8;

// Sheet tab name — used to prefix all API ranges
let sheetName = "MERN_DS";

// Block 3 — Counter: position = B1's row × B2's column (intersection)
// No independent state — always derived from b1Row and b2ColIdx

let targetHyperlinkRedirectUrl = "";
let b1HyperlinkUrl = ""; // resolved URL for Block 1 cell

// ─── DOMContentLoaded ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initializeOperationalState();

  // ── Navigation: header ──
  document.getElementById("ext-title-nav")
    .addEventListener("click", showMainPage);

  document.getElementById("btn-goto-settings")
    .addEventListener("click", toggleSettingsPage);

  // ── Auth buttons ──
  document.getElementById("btn-login")
    .addEventListener("click", executeGoogleLoginPipe);

  document.getElementById("btn-logout")
    .addEventListener("click", executeIdentitySessionWipe);

  // ── Settings: validate & save ──
  document.getElementById("btn-validate")
    .addEventListener("click", saveConfigurationInputsToMemory);

  // ── Footer buttons ──
  document.getElementById("btn-open-live-url")
    .addEventListener("click", () => {
      chrome.storage.local.get(["sheet_url_path"], (res) => {
        if (res.sheet_url_path) chrome.tabs.create({ url: res.sheet_url_path });
      });
    });

  document.getElementById("btn-force-sync")
    .addEventListener("click", triggerDataSynchronizationFetch);

  // ── Block 1 navigation (row shift) ──
  document.getElementById("btn-b1-prev")
    .addEventListener("click", () => handleB1RowShift(-1));
  document.getElementById("btn-b1-next")
    .addEventListener("click", () => handleB1RowShift(1));

  // ── Block 1 link button ──
  document.getElementById("b1-link-btn")
    .addEventListener("click", () => {
      if (b1HyperlinkUrl) chrome.tabs.create({ url: b1HyperlinkUrl });
    });

  // ── Block 1 text value also clickable as hyperlink ──
  document.getElementById("b1-text-val")
    .addEventListener("click", () => {
      if (b1HyperlinkUrl) chrome.tabs.create({ url: b1HyperlinkUrl });
    });

  // ── Block 2 navigation (column shift) ──
  document.getElementById("btn-b2-prev").addEventListener("click", () => {
    if (b2ColIdx > 0) {
      b2ColIdx--;
      synchronizeLayoutUI();
      savePositionCaches();
    }
  });
  document.getElementById("btn-b2-next").addEventListener("click", () => {
    if (b2ColIdx < alphabet.length - 1) {
      b2ColIdx++;
      synchronizeLayoutUI();
      savePositionCaches();
    }
  });

  // ── Block 3: CRUD listeners ──
  document.getElementById("btn-counter-add")
    .addEventListener("click", executeCellIncrementTransaction);
  document.getElementById("btn-b3-save")
    .addEventListener("click", saveCustomCounterValue);

  // ── Block 3: Row nav (drives b1Row) ──
  document.getElementById("btn-b3-row-prev")
    .addEventListener("click", () => handleB1RowShift(-1));
  document.getElementById("btn-b3-row-next")
    .addEventListener("click", () => handleB1RowShift(1));

  // ── Block 3: Col nav (drives b2ColIdx) ──
  document.getElementById("btn-b3-col-prev").addEventListener("click", () => {
    if (b2ColIdx > 0) { b2ColIdx--; synchronizeLayoutUI(); savePositionCaches(); }
  });
  document.getElementById("btn-b3-col-next").addEventListener("click", () => {
    if (b2ColIdx < alphabet.length - 1) { b2ColIdx++; synchronizeLayoutUI(); savePositionCaches(); }
  });

  // ── Block 2 Open Link button ──
  document.getElementById("b2-link-btn")
    .addEventListener("click", () => {
      if (targetHyperlinkRedirectUrl)
        chrome.tabs.create({ url: targetHyperlinkRedirectUrl });
    });

  // ── Block 2 text value also clickable as hyperlink ──
  document.getElementById("b2-text-val")
    .addEventListener("click", () => {
      if (targetHyperlinkRedirectUrl)
        chrome.tabs.create({ url: targetHyperlinkRedirectUrl });
    });
});

// ─── Page Navigation ──────────────────────────────────────────────────────────
function showMainPage() {
  document.getElementById("page-main").classList.add("active");
  document.getElementById("page-settings").classList.remove("active");
}

function showSettingsPage() {
  document.getElementById("page-main").classList.remove("active");
  document.getElementById("page-settings").classList.add("active");
}

function toggleSettingsPage() {
  const settings = document.getElementById("page-settings");
  if (settings.classList.contains("active")) {
    showMainPage();
  } else {
    showSettingsPage();
  }
}

// ─── Row / Column Shift Handlers ──────────────────────────────────────────────
function handleB1RowShift(direction) {
  if (b1Row + direction > 0) {
    b1Row += direction;
    synchronizeLayoutUI();
    savePositionCaches();
  }
}
// Block 3 has no independent nav — it always follows B1 row + B2 column

// ─── Auth: Google Login ───────────────────────────────────────────────────────
function executeGoogleLoginPipe() {
  const redirectUri = chrome.identity.getRedirectURL();
  const scopes = ["openid", "email", "profile"];
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${OAUTH_CLIENT_ID}` +
    `&response_type=token` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes.join(" "))}`;

  chrome.identity.launchWebAuthFlow(
    { url: authUrl, interactive: true },
    (redirectUrl) => {
      if (chrome.runtime.lastError || !redirectUrl) return;
      const token = new URLSearchParams(
        new URL(redirectUrl).hash.substring(1)
      ).get("access_token");
      if (token) {
        chrome.storage.local.set({ oauth_access_token: token }, () => {
          evaluateTokenProfileStatus(token);
        });
      }
    }
  );
}

// ─── Auth: Logout ─────────────────────────────────────────────────────────────
function executeIdentitySessionWipe() {
  chrome.storage.local.get(["oauth_access_token"], (res) => {
    if (res.oauth_access_token) {
      fetch(
        `https://accounts.google.com/o/oauth2/revoke?token=${res.oauth_access_token}`
      );
    }
    chrome.storage.local.remove(
      ["oauth_access_token", "sheet_url_path"],
      () => {
        sheetValuesMatrix = [];
        sheetFormulasMatrix = [];
        clearProfileHeaderUI();
        document.getElementById("b1-text-val").innerText = "Loading...";
        document.getElementById("b1-text-val").style.textDecoration = "none";
        document.getElementById("b1-text-val").style.cursor = "default";
        document.getElementById("b1-text-val").style.color = "white";
        document.getElementById("b1-link-btn").style.display = "none";
        document.getElementById("b2-text-val").innerText = "Loading...";
        document.getElementById("b2-link-btn").style.display = "none";
        document.getElementById("b3-val-input").value = "0";
        b1HyperlinkUrl = "";
        targetHyperlinkRedirectUrl = "";
      }
    );
  });
}

// ─── Settings: Save & Fetch ───────────────────────────────────────────────────
function saveConfigurationInputsToMemory() {
  const linkUrl = document.getElementById("cfg-sheet-link").value.trim();
  const b2ColRaw = document.getElementById("cfg-b2-col").value.trim().toUpperCase();

  if (!linkUrl || !extractSpreadsheetKey(linkUrl)) {
    alert("Please enter a valid Google Spreadsheet URL.");
    return;
  }
  if (!alphabet.includes(b2ColRaw)) {
    alert("Block 2 column is invalid. Use letters like A, B, E, BM.");
    return;
  }

  // Apply parsed settings to state
  const b1ColRaw = (document.getElementById("cfg-b1-col")?.value || "C").trim().toUpperCase();
  const sheetNameRaw = (document.getElementById("cfg-sheet-name")?.value || "MERN_DS").trim();

  if (!alphabet.includes(b1ColRaw)) {
    alert("Block 1 column is invalid. Use a letter like C, E.");
    return;
  }

  b1Col = b1ColRaw;
  b2ColIdx = alphabet.indexOf(b2ColRaw);
  sheetName = sheetNameRaw || "MERN_DS";

  // Request elevated OAuth scopes (needed for Sheets write access)
  const redirectUri = chrome.identity.getRedirectURL();
  const scopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/spreadsheets",
  ];
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${OAUTH_CLIENT_ID}` +
    `&response_type=token` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes.join(" "))}`;

  chrome.identity.launchWebAuthFlow(
    { url: authUrl, interactive: true },
    (redirectUrl) => {
      if (chrome.runtime.lastError || !redirectUrl) return;
      const token = new URLSearchParams(
        new URL(redirectUrl).hash.substring(1)
      ).get("access_token");
      if (token) {
        chrome.storage.local.set(
          {
            oauth_access_token: token,
            sheet_url_path: linkUrl,
            sheet_name: sheetName,
            b1_col: b1Col,
            b2_col_idx: b2ColIdx,
          },
          () => {
            evaluateTokenProfileStatus(token);
            pullLiveGoogleSheetDataset(token, linkUrl);
            showMainPage();
          }
        );
      }
    }
  );
}

// ─── Data: Fetch Sheet ────────────────────────────────────────────────────────
function pullLiveGoogleSheetDataset(token, sheetUrl) {
  const spreadsheetId = extractSpreadsheetKey(sheetUrl);
  // Prefix range with sheet tab name so the correct tab is read
  const tabPrefix = sheetName ? `${encodeURIComponent(sheetName)}!` : "";
  const dataRange = `${tabPrefix}A1:BM150`;
  const valEndpoint =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${dataRange}`;
  const formulaEndpoint =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${dataRange}?valueRenderOption=FORMULA`;
  // For hyperlinks, use the raw (unencoded) tab name in the ranges param
  const rawRange = sheetName ? `${sheetName}!A1:BM150` : "A1:BM150";
  const hyperlinkEndpoint =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `?includeGridData=true&ranges=${encodeURIComponent(rawRange)}&fields=sheets.data.rowData.values.hyperlink`;

  const authHeaders = { Authorization: `Bearer ${token}` };

  Promise.all([
    fetch(valEndpoint, { headers: authHeaders }).then((r) => r.json()),
    fetch(formulaEndpoint, { headers: authHeaders }).then((r) => r.json()),
    fetch(hyperlinkEndpoint, { headers: authHeaders }).then((r) => r.json()),
  ])
    .then(([valsData, formulasData, hypData]) => {
      if (valsData.values) sheetValuesMatrix = valsData.values;
      if (formulasData.values) sheetFormulasMatrix = formulasData.values;

      // Extract hyperlink matrix from the spreadsheets.get response
      sheetHyperlinkMatrix = [];
      const rowDataArr = hypData?.sheets?.[0]?.data?.[0]?.rowData || [];
      rowDataArr.forEach((rowObj, rIdx) => {
        sheetHyperlinkMatrix[rIdx] = (rowObj.values || []).map(
          (cellObj) => cellObj.hyperlink || ""
        );
      });

      synchronizeLayoutUI();
    })
    .catch((err) => console.error("Sheet fetch error:", err));
}

// ─── Data: Increment Counter Cell ────────────────────────────────────────────
function executeCellIncrementTransaction() {
  chrome.storage.local.get(["oauth_access_token", "sheet_url_path"], (res) => {
    if (!res.sheet_url_path) {
      alert("No sheet URL saved. Please configure in Settings.");
      return;
    }

    const b3Col = alphabet[b2ColIdx];
    const b3Row = b1Row;
    const b3ColIdx = b2ColIdx;
    const targetRow = b3Row - 1;

    const prevVal = parseInt(document.getElementById("b3-val-input").value) || 0;
    const newVal = prevVal + 1;

    // Optimistic local update
    if (!sheetValuesMatrix[targetRow]) sheetValuesMatrix[targetRow] = [];
    sheetValuesMatrix[targetRow][b3ColIdx] = newVal.toString();
    document.getElementById("b3-val-input").value = newVal;

    writeCounterToSheet(res.sheet_url_path, b3Col, b3Row, newVal, prevVal);
  });
}

// ─── Data: Save Custom Counter Value from Input ───────────────────────────────
function saveCustomCounterValue() {
  chrome.storage.local.get(["sheet_url_path"], (res) => {
    if (!res.sheet_url_path) {
      alert("No sheet URL saved. Please configure in Settings.");
      return;
    }

    const inputEl = document.getElementById("b3-val-input");
    const newVal = parseInt(inputEl.value);
    if (isNaN(newVal)) { alert("Please enter a valid number."); return; }

    const b3Col = alphabet[b2ColIdx];
    const b3Row = b1Row;
    const b3ColIdx = b2ColIdx;
    const targetRow = b3Row - 1;

    const prevVal = sheetValuesMatrix[targetRow]
      ? parseInt(sheetValuesMatrix[targetRow][b3ColIdx]) || 0 : 0;

    if (!sheetValuesMatrix[targetRow]) sheetValuesMatrix[targetRow] = [];
    sheetValuesMatrix[targetRow][b3ColIdx] = newVal.toString();

    writeCounterToSheet(res.sheet_url_path, b3Col, b3Row, newVal, prevVal);
  });
}


// ─── Shared: Write a value to the counter cell ────────────────────────────────
// Uses the stored token directly. If it fails with 403, prompts user to re-login.
function writeCounterToSheet(sheetUrl, col, row, value, prevValue) {
  const statusEl = document.getElementById("b3-write-status");
  if (statusEl) { statusEl.innerText = "⏳ Saving..."; statusEl.style.color = "#4a8fbf"; }

  chrome.storage.local.get(["oauth_access_token"], (res) => {
    if (!res.oauth_access_token) {
      if (statusEl) { statusEl.innerText = "❌ Not logged in — go to Settings"; statusEl.style.color = "#f85149"; }
      return;
    }
    doSheetPut(res.oauth_access_token, sheetUrl, col, row, value, prevValue, statusEl);
  });
}

function doSheetPut(token, sheetUrl, col, row, value, prevValue, statusEl) {
  const spreadsheetId = extractSpreadsheetKey(sheetUrl);
  // Always include the sheet tab name so the write goes to the right tab
  const rawRange = sheetName ? `${sheetName}!${col}${row}` : `${col}${row}`;
  const putUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/` +
    `${encodeURIComponent(rawRange)}?valueInputOption=USER_ENTERED`;

  fetch(putUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ range: rawRange, values: [[value]] }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.error) {
        const code = data.error.code || 0;
        // Roll back optimistic update
        if (sheetValuesMatrix[b1Row - 1])
          sheetValuesMatrix[b1Row - 1][b2ColIdx] = String(prevValue);
        document.getElementById("b3-val-input").value = prevValue;

        if (code === 401 || code === 403) {
          if (statusEl) {
            statusEl.innerText = "❌ Permission denied — re-login from Settings";
            statusEl.style.color = "#f85149";
          }
        } else {
          if (statusEl) {
            statusEl.innerText = `❌ Error ${code}: ${data.error.message}`;
            statusEl.style.color = "#f85149";
          }
        }
        console.error("Sheet write error:", data.error);
      } else {
        if (statusEl) {
          statusEl.innerText = `✅ Saved → ${sheetName ? sheetName + "!" : ""}${col}${row} = ${value}`;
          statusEl.style.color = "#56d364";
          setTimeout(() => { if (statusEl) statusEl.innerText = ""; }, 3000);
        }
      }
    })
    .catch((err) => {
      console.error("Sheet write failed:", err);
      if (statusEl) { statusEl.innerText = "❌ Network error"; statusEl.style.color = "#f85149"; }
    });
}


// ─── UI: Sync All Blocks to State ────────────────────────────────────────────
function synchronizeLayoutUI() {
  if (sheetValuesMatrix.length === 0) return;

  // ── Block 1: Name Viewer (configurable column, navigate row) ──
  const b1ColIdx = alphabet.indexOf(b1Col);
  const b1DataRow = sheetValuesMatrix[b1Row - 1];
  const b1FormulaRow = sheetFormulasMatrix[b1Row - 1];
  const b1DisplayValue = b1DataRow ? b1DataRow[b1ColIdx] || "Empty Cell" : "Out of Bounds";
  const b1FormulaStr = b1FormulaRow ? b1FormulaRow[b1ColIdx] || "" : "";

  document.getElementById("b1-text-val").innerText = b1DisplayValue;
  document.getElementById("b1-coord-lbl").innerText = `Cell: ${b1Col}${b1Row}`;

  // Detect hyperlink in Block 1 formula or plain URL in value
  b1HyperlinkUrl = "";
  if (typeof b1FormulaStr === "string" && b1FormulaStr.trim().startsWith("=")) {
    const m =
      b1FormulaStr.match(/=HYPERLINK\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/i) ||
      b1FormulaStr.match(/=HYPERLINK\(\s*["']([^"']+)["']/i);
    if (m && m[1]) b1HyperlinkUrl = m[1].trim();
  }
  if (!b1HyperlinkUrl && (b1DisplayValue.startsWith("http") || b1DisplayValue.includes(".com"))) {
    b1HyperlinkUrl = b1DisplayValue.trim();
  } else if (!b1HyperlinkUrl && b1DisplayValue.startsWith("@")) {
    b1HyperlinkUrl = `https://www.hackerrank.com/profile/${b1DisplayValue.substring(1).trim()}`;
  }

  // Style Block 1 text as a live hyperlink when URL is found
  const b1LinkBtn = document.getElementById("b1-link-btn");
  const b1TextEl = document.getElementById("b1-text-val");
  if (b1HyperlinkUrl) {
    b1LinkBtn.style.display = "inline-block";
    b1TextEl.style.textDecoration = "underline";
    b1TextEl.style.cursor = "pointer";
    b1TextEl.style.color = "#58a6ff";
    b1TextEl.title = b1HyperlinkUrl;
  } else {
    b1LinkBtn.style.display = "none";
    b1TextEl.style.textDecoration = "none";
    b1TextEl.style.cursor = "default";
    b1TextEl.style.color = "white";
    b1TextEl.title = "";
  }

  // ── Block 2: Value Viewer (fixed row 8, navigate col) ──
  const b2DataRow = sheetValuesMatrix[B2_FIXED_ROW - 1];
  const b2FormulaRow = sheetFormulasMatrix[B2_FIXED_ROW - 1];
  const b2ColLetter = alphabet[b2ColIdx];
  const b2Value = b2DataRow ? b2DataRow[b2ColIdx] || "Empty Cell" : "Empty Cell";
  const b2Formula = b2FormulaRow ? b2FormulaRow[b2ColIdx] || "" : "";

  document.getElementById("b2-text-val").innerText = b2Value;
  document.getElementById("b2-coord-lbl").innerText = `Cell: ${b2ColLetter}-${B2_FIXED_ROW}`;

  // Detect hyperlink — priority: real hyperlink from cell data > formula parse > value fallback
  targetHyperlinkRedirectUrl = "";

  // 1. Real hyperlink property from spreadsheets.get API (most reliable)
  const b2HyperlinkRow = sheetHyperlinkMatrix[B2_FIXED_ROW - 1];
  if (b2HyperlinkRow && b2HyperlinkRow[b2ColIdx]) {
    targetHyperlinkRedirectUrl = b2HyperlinkRow[b2ColIdx];
  }

  // 2. HYPERLINK formula parse (fallback if hyperlink matrix is empty)
  if (!targetHyperlinkRedirectUrl && typeof b2Formula === "string" &&
    b2Formula.trim().toUpperCase().startsWith("=HYPERLINK")) {
    const m =
      b2Formula.match(/=HYPERLINK\(\s*"([^"]+)"/i) ||
      b2Formula.match(/=HYPERLINK\(\s*'([^']+)'/i) ||
      b2Formula.match(/=HYPERLINK\(\s*([^,)\s]+)/i);
    if (m && m[1]) targetHyperlinkRedirectUrl = m[1].trim();
  }

  // 3. Plain URL or @username in the displayed value
  if (!targetHyperlinkRedirectUrl) {
    if (b2Value.startsWith("http") || b2Value.startsWith("www.") || b2Value.includes(".com")) {
      targetHyperlinkRedirectUrl = b2Value.trim();
    } else if (b2Value.startsWith("@")) {
      targetHyperlinkRedirectUrl = `https://www.hackerrank.com/profile/${b2Value.substring(1).trim()}`;
    }
  }

  // Open Link button — always visible; enable/style when URL found, grey out when not
  const linkBtn = document.getElementById("b2-link-btn");
  const b2TextEl = document.getElementById("b2-text-val");
  if (targetHyperlinkRedirectUrl) {
    linkBtn.disabled = false;
    linkBtn.style.background = "#1f3a5f";
    linkBtn.style.color = "#58a6ff";
    linkBtn.style.border = "1px solid #2d5986";
    linkBtn.style.cursor = "pointer";
    linkBtn.style.opacity = "1";
    b2TextEl.style.textDecoration = "underline";
    b2TextEl.style.cursor = "pointer";
    b2TextEl.title = targetHyperlinkRedirectUrl;
  } else {
    linkBtn.disabled = true;
    linkBtn.style.background = "#1a2a3a";
    linkBtn.style.color = "#3a6a9a";
    linkBtn.style.border = "1px solid #2a4a6a";
    linkBtn.style.cursor = "not-allowed";
    linkBtn.style.opacity = "0.4";
    b2TextEl.style.textDecoration = "none";
    b2TextEl.style.cursor = "default";
    b2TextEl.title = "";
  }

  // ── Block 3: Counter = intersection of B1 row and B2 column ──
  const b3Col = alphabet[b2ColIdx]; // derived from Block 2
  const b3Row = b1Row;              // derived from Block 1
  const b3ColIdx = b2ColIdx;
  const b3DataRow = sheetValuesMatrix[b3Row - 1];
  document.getElementById("b3-val-input").value =
    b3DataRow ? b3DataRow[b3ColIdx] || "0" : "0";
  document.getElementById("b3-coord-lbl").innerText =
    `Cell: ${b3Col}-${b3Row}  (${b1Col}${b3Row} row × col ${b3Col})`;
}

// ─── Storage: Save Position State ────────────────────────────────────────────
function savePositionCaches() {
  chrome.storage.local.set({
    b1_row: b1Row,      // B1 col is always C — never saved
    b2_col_idx: b2ColIdx,   // B3 position is always derived from B1+B2
  });
}

// ─── Data: Manual Sync ────────────────────────────────────────────────────────
function triggerDataSynchronizationFetch() {
  chrome.storage.local.get(["oauth_access_token", "sheet_url_path"], (res) => {
    if (res.oauth_access_token && res.sheet_url_path)
      pullLiveGoogleSheetDataset(res.oauth_access_token, res.sheet_url_path);
  });
}

// ─── Init: Restore State from Storage ────────────────────────────────────────
function initializeOperationalState() {
  chrome.storage.local.remove(["b3_col", "b3_row"]);

  chrome.storage.local.get(
    ["sheet_url_path", "oauth_access_token", "b1_row", "b1_col",
      "b2_col_idx", "sheet_name"],
    (res) => {
      if (res.sheet_url_path)
        document.getElementById("cfg-sheet-link").value = res.sheet_url_path;

      if (res.b1_col) b1Col = res.b1_col;
      if (res.b1_row) b1Row = parseInt(res.b1_row);
      if (res.b2_col_idx !== undefined) b2ColIdx = parseInt(res.b2_col_idx);
      if (res.sheet_name) sheetName = res.sheet_name;

      // Restore settings inputs
      if (document.getElementById("cfg-b1-col"))
        document.getElementById("cfg-b1-col").value = b1Col;
      if (document.getElementById("cfg-b2-col"))
        document.getElementById("cfg-b2-col").value = alphabet[b2ColIdx] || "F";
      if (document.getElementById("cfg-sheet-name"))
        document.getElementById("cfg-sheet-name").value = sheetName;

      if (res.oauth_access_token) {
        evaluateTokenProfileStatus(res.oauth_access_token);
        if (res.sheet_url_path)
          pullLiveGoogleSheetDataset(res.oauth_access_token, res.sheet_url_path);
      } else {
        clearProfileHeaderUI();
      }
    }
  );
}

// ─── Auth: Validate Token & Update Profile UI ─────────────────────────────────
function evaluateTokenProfileStatus(token) {
  fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => {
      if (!res.ok) throw new Error("Token expired");
      return res.json();
    })
    .then((data) => {
      document.getElementById("profile-area").innerHTML =
        `User: <b>${data.given_name || data.name}</b>`;
      const badge = document.getElementById("auth-status");
      badge.innerText = "● Connected";
      badge.className = "status-badge logged-in";
    })
    .catch(() => clearProfileHeaderUI());
}

// ─── Auth: Clear Profile UI ───────────────────────────────────────────────────
function clearProfileHeaderUI() {
  document.getElementById("profile-area").innerHTML = "";
  const badge = document.getElementById("auth-status");
  badge.innerText = "● Not Logged In";
  badge.className = "status-badge logged-out";
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function extractSpreadsheetKey(url) {
  const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return matches ? matches[1] : null;
}
