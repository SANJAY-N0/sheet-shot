const CLIENT_ID = '612679483614-7i9h2j9rpob401rk0l81dogu7kgvsdml.apps.googleusercontent.com';
let rawSheetsValueMatrix = [];    // Fallback display value grid array
let formulasGridMatrix = [];      // Contains underlying hyperlink formula extractions

const alphabet = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ", "BA", "BB", "BC", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BK", "BL", "BM"];

// Tracker Axis Anchors Initial Settings
let b1ColLetter = "C", b1RowTracker = 9;
let b2ColTracker = 4, b2FixedRow = 8;
let b3ColTracker = 5, b3RowTracker = 10;

// Extracted Deep Link URL Cache String
let extractedActiveHyperlink = "";

document.addEventListener('DOMContentLoaded', () => {
    syncSavedStateSettings();
    verifyActiveProfileToken();

    document.getElementById('btn-goto-settings').addEventListener('click', togglePagePanels);
    document.getElementById('ext-title-nav').addEventListener('click', returnToMainViewer);

    document.getElementById('btn-login').addEventListener('click', runIdentityLoginFlow);
    document.getElementById('btn-logout').addEventListener('click', runIdentityLogoutFlow);
    document.getElementById('btn-validate').addEventListener('click', upgradePermissionsAndFetch);
    document.getElementById('btn-force-sync').addEventListener('click', triggerQuickRefreshSync);
    document.getElementById('btn-b2-open').addEventListener('click', () => { if (extractedActiveHyperlink) chrome.tabs.create({ url: extractedActiveHyperlink }); });

    document.getElementById('btn-open-live-url').addEventListener('click', () => {
        chrome.storage.local.get(['saved_sheet_link'], (res) => { if (res.saved_sheet_link) chrome.tabs.create({ url: res.saved_sheet_link }); });
    });

    // Block 1 Interactions
    document.getElementById('btn-b1-prev').addEventListener('click', () => { if (b1RowTracker > 1) { b1RowTracker--; evaluateWorkspaceDOM(); } });
    document.getElementById('btn-b1-next').addEventListener('click', () => { if (b1RowTracker < rawSheetsValueMatrix.length) { b1RowTracker++; evaluateWorkspaceDOM(); } });

    // Block 2 Interactions
    document.getElementById('btn-b2-prev').addEventListener('click', () => { if (b2ColTracker > 0) { b2ColTracker--; evaluateWorkspaceDOM(); } });
    document.getElementById('btn-b2-next').addEventListener('click', () => { if (b2ColTracker < alphabet.length - 1) { b2ColTracker++; evaluateWorkspaceDOM(); } });

    // Block 3 Interactions
    document.getElementById('btn-b3-prev').addEventListener('click', () => { if (b3RowTracker > 1) { b3RowTracker--; evaluateWorkspaceDOM(); } });
    document.getElementById('btn-b3-next').addEventListener('click', () => { if (b3RowTracker < rawSheetsValueMatrix.length) { b3RowTracker++; evaluateWorkspaceDOM(); } });
    document.getElementById('btn-counter-add').addEventListener('click', triggerCellIncrementOperation);
});

function togglePagePanels() {
    const settingsPage = document.getElementById('page-settings');
    if (settingsPage.classList.contains('active')) returnToMainViewer();
    else {
        document.getElementById('page-main').classList.remove('active');
        settingsPage.classList.add('active');
        document.getElementById('btn-goto-settings').innerText = "🏠";
    }
}

function returnToMainViewer() {
    document.getElementById('page-settings').classList.remove('active');
    document.getElementById('page-main').classList.add('active');
    document.getElementById('btn-goto-settings').innerText = "⚙️";
}

function extractSpreadsheetId(linkPath) {
    const parsedMatches = linkPath.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return parsedMatches ? parsedMatches[1] : null;
}

// --- IDENTITY AND EXPANDED PERMISSIONS ENGINE CONTROLLER ---
function runIdentityLoginFlow() {
    const REDIRECT_URL = chrome.identity.getRedirectURL();
    const identityScopes = ['openid', 'email', 'profile'];
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URL)}&scope=${encodeURIComponent(identityScopes.join(' '))}`;

    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) return;
        const token = new URLSearchParams(new URL(redirectUrl).hash.substring(1)).get('access_token');
        if (token) chrome.storage.local.set({ oauth_token: token }, () => { renderProfileHeader(token); });
    });
}

function upgradePermissionsAndFetch() {
    const linkPath = document.getElementById('cfg-sheet-link').value;
    if (!linkPath || !extractSpreadsheetId(linkPath)) {
        alert("Please input a valid Google Sheets URL link path.");
        return;
    }

    const REDIRECT_URL = chrome.identity.getRedirectURL();
    const enhancedScopes = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/spreadsheets'];
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URL)}&scope=${encodeURIComponent(enhancedScopes.join(' '))}`;

    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) return;
        const token = new URLSearchParams(new URL(redirectUrl).hash.substring(1)).get('access_token');
        if (token) {
            // Pull and update configuration coordinates mapping indices dynamically from UI settings inputs
            b1ColLetter = document.getElementById('cfg-b1-col').value.toUpperCase() || "C";
            b1RowTracker = parseInt(document.getElementById('cfg-b1-row').value) || 9;

            let b2ColLetter = document.getElementById('cfg-b2-col').value.toUpperCase();
            b2ColTracker = alphabet.indexOf(b2ColLetter) !== -1 ? alphabet.indexOf(b2ColLetter) : 4;
            b2FixedRow = parseInt(document.getElementById('cfg-b2-row').value) || 8;

            let b3ColLetter = document.getElementById('cfg-b3-col').value.toUpperCase();
            b3ColTracker = alphabet.indexOf(b3ColLetter) !== -1 ? alphabet.indexOf(b3ColLetter) : 5;
            b3RowTracker = parseInt(document.getElementById('cfg-b3-row').value) || 10;

            chrome.storage.local.set({
                oauth_token: token,
                saved_sheet_link: linkPath,
                b1_col: b1ColLetter, b1_row_val: b1RowTracker,
                b2_col_val: alphabet[b2ColTracker], b2_row_val: b2FixedRow,
                b3_col_val: alphabet[b3ColTracker], b3_row_val: b3RowTracker
            }, () => {
                renderProfileHeader(token);
                pullLiveGoogleSheetDataset(token, linkPath);
                returnToMainViewer();
            });
        }
    });
}

// --- TWO-STAGE ENGINE PIPELINE: EXTRACTION FOR CELL VALUE & HYPERLINK FORMULAS ---
function pullLiveGoogleSheetDataset(token, sheetUrl) {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    const dataRange = "A1:BM150";

    // URL 1: Request standard formatting grid cache values
    const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${dataRange}`;
    // URL 2: Request underlying user-entered value formulas (Extracts embedded HYPERLINK parameter structures)
    const formulasUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${dataRange}?valueRenderOption=FORMULA`;

    Promise.all([
        fetch(valuesUrl, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(formulasUrl, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ])
        .then(([valuesData, formulasData]) => {
            if (valuesData.values) rawSheetsValueMatrix = valuesData.values;
            if (formulasData.values) formulasGridMatrix = formulasData.values;
            evaluateWorkspaceDOM();
        })
        .catch(err => console.error("Pipeline Sync Error: ", err));
}

function triggerCellIncrementOperation() {
    chrome.storage.local.get(['oauth_token', 'saved_sheet_link'], (res) => {
        if (!res.oauth_token || !res.saved_sheet_link) return;

        const targetRowIndex = b3RowTracker - 1;
        const targetColLetter = alphabet[b3ColTracker];

        let currentValue = parseInt(rawSheetsValueMatrix[targetRowIndex]?.[b3ColTracker]) || 0;
        currentValue++;

        // Sync back directly onto local matrix variables
        if (!rawSheetsValueMatrix[targetRowIndex]) rawSheetsValueMatrix[targetRowIndex] = [];
        rawSheetsValueMatrix[targetRowIndex][b3ColTracker] = currentValue.toString();
        evaluateWorkspaceDOM();

        const spreadsheetId = extractSpreadsheetId(res.saved_sheet_link);
        const apiRange = `${targetColLetter}${b3RowTracker}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${apiRange}?valueInputOption=USER_ENTERED`;

        fetch(url, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${res.oauth_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [[currentValue]] })
        }).catch(err => console.error(err));
    });
}

// --- COMPLEX DYNAMIC REGEX FOR NESTED GOOGLE SHEET LINK PARSING ---
function evaluateWorkspaceDOM() {
    if (rawSheetsValueMatrix.length === 0) return;

    // Block 1 View Mapping Execution
    const b1Idx = alphabet.indexOf(b1ColLetter);
    const b1RowData = rawSheetsValueMatrix[b1RowTracker - 1];
    document.getElementById('b1-text-val').innerText = b1RowData ? (b1RowData[b1Idx] || 'Empty Cell') : 'Out of Bounds';
    document.getElementById('b1-coord-badge').innerText = `${b1ColLetter}-${b1RowTracker}`;

    // Block 2 View Mapping Execution (Extract display name handle alongside deep link formulas)
    const b2RowData = rawSheetsValueMatrix[b2FixedRow - 1];
    const b2FormulaRowData = formulasGridMatrix[b2FixedRow - 1];

    const displayTextHandle = b2RowData ? (b2RowData[b2ColTracker] || 'Empty Cell') : 'Empty Cell';
    const cellFormulaString = b2FormulaRowData ? (b2FormulaRowData[b2ColTracker] || '') : '';

    document.getElementById('b2-text-val').innerText = displayTextHandle;
    document.getElementById('b2-coord-badge').innerText = `${alphabet[b2ColTracker]}-${b2FixedRow}`;

    // Process Formula String using a Regex expression to pull out the URL parameter inside =HYPERLINK("url", "label")
    extractedActiveHyperlink = "";
    if (typeof cellFormulaString === 'string' && cellFormulaString.startsWith('=')) {
        const urlPatternMatches = cellFormulaString.match(/=HYPERLINK\(\s*["']([^"']+)["']/i);
        if (urlPatternMatches && urlPatternMatches[1]) {
            extractedActiveHyperlink = urlPatternMatches[1];
        }
    }

    // Fallback check parameter conditions if user writes straight un-wrapped links into sheet grid positions
    if (!extractedActiveHyperlink && (displayTextHandle.startsWith('http') || displayTextHandle.includes('.com'))) {
        extractedActiveHyperlink = displayTextHandle;
    } else if (!extractedActiveHyperlink && displayTextHandle.startsWith('@')) {
        extractedActiveHyperlink = `https://www.hackerrank.com/profile/${displayTextHandle.substring(1)}`;
    }

    // Handle visibility adjustments for the open hyperlink trigger button element 
    const linkRedirectButton = document.getElementById('btn-b2-open');
    if (extractedActiveHyperlink) {
        linkRedirectButton.style.display = 'block';
        linkRedirectButton.innerText = `🌐 Open Link (${alphabet[b2ColTracker]}-${b2FixedRow})`;
    } else {
        linkRedirectButton.style.display = 'none';
    }

    // Block 3 View Mapping Execution
    const b3RowData = rawSheetsValueMatrix[b3RowTracker - 1];
    document.getElementById('b3-text-val').innerText = b3RowData ? (b3RowData[b3ColTracker] || '0') : '0';
    document.getElementById('b3-coord-badge').innerText = `${alphabet[b3ColTracker]}-${b3RowTracker}`;
}

// --- AUXILIARY HELPERS ---
function triggerQuickRefreshSync() {
    chrome.storage.local.get(['oauth_token', 'saved_sheet_link'], (res) => {
        if (res.oauth_token && res.saved_sheet_link) pullLiveGoogleSheetDataset(res.oauth_token, res.saved_sheet_link);
    });
}

function verifyActiveProfileToken() {
    chrome.storage.local.get(['oauth_token', 'saved_sheet_link'], (res) => {
        if (res.oauth_token) {
            renderProfileHeader(res.oauth_token);
            if (res.saved_sheet_link) pullLiveGoogleSheetDataset(res.oauth_token, res.saved_sheet_link);
        } else {
            clearProfileHeaderUI();
        }
    });
}

function renderProfileHeader(token) {
    fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => { if (!res.ok) throw new Error("Session Expired"); return res.json(); })
        .then(data => {
            document.getElementById('profile-area').innerHTML = `Hi, <b>${data.given_name || data.name}</b>`;
            const badge = document.getElementById('auth-status');
            badge.innerText = "● Logged In";
            badge.className = "status-badge logged-in";
        }).catch(() => clearProfileHeaderUI());
}

function clearProfileHeaderUI() {
    document.getElementById('profile-area').innerHTML = ``;
    const badge = document.getElementById('auth-status');
    badge.innerText = "● Not Logged In";
    badge.className = "status-badge logged-out";
}

function runIdentityLogoutFlow() {
    chrome.storage.local.get(['oauth_token'], (res) => {
        if (res.oauth_token) fetch(`https://accounts.google.com/o/oauth2/revoke?token=${res.oauth_token}`);
        chrome.storage.local.remove(['oauth_token', 'saved_sheet_link'], () => {
            rawSheetsValueMatrix = []; formulasGridMatrix = [];
            clearProfileHeaderUI();
            document.getElementById('b1-text-val').innerText = "Loading...";
            document.getElementById('b2-text-val').innerText = "Loading...";
            document.getElementById('b3-text-val').innerText = "0";
            document.getElementById('btn-b2-open').style.display = 'none';
        });
    });
}

function syncSavedStateSettings() {
    chrome.storage.local.get(['saved_sheet_link', 'b1_col', 'b1_row_val', 'b2_col_val', 'b2_row_val', 'b3_col_val', 'b3_row_val'], (res) => {
        if (res.saved_sheet_link) document.getElementById('cfg-sheet-link').value = res.saved_sheet_link;
        if (res.b1_col) b1ColLetter = res.b1_col.toUpperCase();
        if (res.b1_row_val) b1RowTracker = parseInt(res.b1_row_val);
        if (res.b2_col_val) b2ColTracker = alphabet.indexOf(res.b2_col_val.toUpperCase());
        if (res.b2_row_val) b2FixedRow = parseInt(res.b2_row_val);
        if (res.b3_col_val) b3ColTracker = alphabet.indexOf(res.b3_col_val.toUpperCase());
        if (res.b3_row_val) b3RowTracker = parseInt(res.b3_row_val);

        document.getElementById('cfg-b1-col').value = b1ColLetter;
        document.getElementById('cfg-b1-row').value = b1RowTracker;
        document.getElementById('cfg-b2-col').value = alphabet[b2ColTracker];
        document.getElementById('cfg-b2-row').value = b2FixedRow;
        document.getElementById('cfg-b3-col').value = alphabet[b3ColTracker];
        document.getElementById('cfg-b3-row').value = b3RowTracker;
    });
}