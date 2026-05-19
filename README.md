# 📊 Google Sheet Viewer Pro — Chrome Extension

A Chrome / Brave extension that lets you read, navigate, and write values to any Google Spreadsheet directly from your browser toolbar — authenticated via Google OAuth.

---

## 📸 Extension Preview

> What the popup looks like when loaded in Chrome / Brave.

<p align="center">
  <img src="img-1.png" alt="Extension Popup — Main View" width="380" />
  &nbsp;&nbsp;
  <img src="img-2.png" alt="Extension Popup — Settings View" width="380" />
</p>

<p align="center">
  <em>Left: Main view with Name Viewer, Value Viewer & Cell Editor &nbsp;|&nbsp; Right: Settings / OAuth configuration</em>
</p>

---

## 📁 Project Files

```
simple-login-0.3/
├── manifest.json      ← Extension config (name, permissions, icons)
├── popup.html         ← Extension popup UI
├── popup.js           ← All logic: OAuth, Sheets API, CRUD
├── background.js      ← Service worker (minimal)
├── icon16.png         ← Toolbar icon (16×16)
├── icon48.png         ← Extensions page icon (48×48)
└── icon128.png        ← Chrome Web Store icon (128×128)
```

---

## ⚙️ Step 1 — Create a Google Cloud Project

1. Go to → **https://console.cloud.google.com/**
2. Click **"Select a project"** → **"New Project"**
3. Give it any name (e.g. `sheet-viewer-pro`) → click **Create**

---

## 🔑 Step 2 — Enable the Google Sheets API

1. In your project, go to **APIs & Services → Library**
2. Search for **"Google Sheets API"**
3. Click on it → click **Enable**

---

## 🆔 Step 3 — Create an OAuth 2.0 Client ID

> This is the most important step. The Client ID is what allows the extension to log in with Google.

1. Go to **APIs & Services → Credentials**
2. Click **"+ Create Credentials"** → choose **"OAuth client ID"**
3. If prompted, configure the **OAuth consent screen** first:
   - User Type → **External**
   - App name → anything (e.g. `Sheet Viewer`)
   - Add your email as a test user
   - Scopes → add:
     - `openid`
     - `email`
     - `profile`
     - `https://www.googleapis.com/auth/spreadsheets`
4. Back on Create Credentials → Application type → **Chrome Extension**
5. In the **"Item ID"** field, paste your **Extension ID** (see Step 5 below to get it)
6. Click **Create**
7. Copy the **Client ID** — it looks like:
   ```
   612679483614-xxxxxxxxxxxxxxxx.apps.googleusercontent.com
   ```

---

## 🛠️ Step 4 — Add Your Client ID to the Extension

Open `popup.js` and find **line 2–3** at the very top:

```js
// ─── Constants ───────────────────────────────────────────
const OAUTH_CLIENT_ID =
  "612679483614-7i9h2j9rpob401rk0l81dogu7kgvsdml.apps.googleusercontent.com";
```

**Replace the string** with your own Client ID:

```js
const OAUTH_CLIENT_ID = "YOUR_CLIENT_ID_HERE.apps.googleusercontent.com";
```

Save the file.

---

## 🔌 Step 5 — Load the Extension in Chrome / Brave

1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer Mode** (top-right toggle)
3. Click **"Load unpacked"**
4. Select the `simple-login-0.3/` folder
5. The extension appears in your toolbar — **copy the Extension ID** shown under its name  
   (e.g. `abcdefghijklmnopqrstuvwxyzabcdef`)

> Go back to **Step 3** and paste this Extension ID into your OAuth Client ID configuration if you haven't already, then save on Google Cloud Console.

---

## 🔄 Step 6 — Reload & Test

1. Back on `chrome://extensions`, click the **🔄 reload** button on the extension
2. Click the extension icon in the toolbar — the popup opens
3. Click the **⚙️ settings** icon (top right of popup)

---

## 📋 Step 7 — Configure Your Spreadsheet

Inside the Settings page:

| Field | What to enter |
|-------|---------------|
| **Google Spreadsheet Link** | Full URL from your browser, e.g. `https://docs.google.com/spreadsheets/d/1aBc.../edit` |
| **Sheet Tab Name** | The tab name inside the sheet, e.g. `MERN_DS`, `Sheet1` |
| **Block 1 Column** | The column letter for names (default `C`) |
| **Block 2 Column** | The column letter for values/links (default `F`) |

Then click **"Validate & Fetch Sync"** — this triggers the Google OAuth login popup.

---

## ✅ How OAuth Login Works (Behind the Scenes)

When you click **"Validate & Fetch Sync"** or **"Link Google Account"**:

1. The extension calls `chrome.identity.getRedirectURL()` to build the redirect URI automatically
2. It opens a Google sign-in popup via `chrome.identity.launchWebAuthFlow`
3. Google returns an **access token** in the URL hash
4. The token is stored in `chrome.storage.local` under the key `oauth_access_token`
5. All Sheets API calls use this token in the `Authorization: Bearer <token>` header

**Scopes requested:**
```
openid  email  profile
https://www.googleapis.com/auth/spreadsheets
```

The `spreadsheets` scope is required to **read and write** cell values.

---

## 🧩 Extension Blocks Explained

| Block | What it does |
|-------|-------------|
| **Block 1 — Name Viewer** | Reads column C (configurable), navigates by row |
| **Block 2 — Value Viewer** | Reads row 8 (fixed), navigates by column |
| **Block 3 — Cell Editor** | Reads/writes the intersection of Block 1's row × Block 2's column |

---

## 🗝️ Storage Keys (chrome.storage.local)

| Key | Value stored |
|-----|-------------|
| `oauth_access_token` | Google OAuth access token |
| `sheet_url_path` | Full Google Sheets URL |
| `sheet_name` | Sheet tab name (e.g. `MERN_DS`) |
| `b1_col` | Block 1 column letter |
| `b2_col_idx` | Block 2 column index (number) |
| `b1_row` | Last active row for Block 1 |

---

## 🚨 Common Issues

### ❌ "OAuth Client ID not found" or blank popup
- Make sure you replaced `OAUTH_CLIENT_ID` in `popup.js` with your real Client ID
- Reload the extension after saving

### ❌ Login popup appears but immediately closes
- Your Extension ID is not added to the OAuth Client ID on Google Cloud Console
- Go to Credentials → edit your OAuth Client ID → add the correct Extension ID

### ❌ "Access denied" / 403 on Sheets API
- You did not add `https://www.googleapis.com/auth/spreadsheets` scope in the consent screen
- The Google account used is not a test user (add it in the OAuth consent screen)

### ❌ Extension doesn't reload token after browser restart
- Tokens from `launchWebAuthFlow` can expire — click **"Validate & Fetch Sync"** again to re-authenticate

---

## 🧪 Quick Checklist Before First Use

- [ ] Google Cloud Project created
- [ ] Google Sheets API enabled
- [ ] OAuth consent screen configured with correct scopes
- [ ] OAuth Client ID created (type: Chrome Extension)
- [ ] Extension loaded in Chrome → Extension ID copied
- [ ] Extension ID added to OAuth Client ID on Google Cloud
- [ ] `OAUTH_CLIENT_ID` in `popup.js` updated with your Client ID
- [ ] Extension reloaded
- [ ] Spreadsheet URL + tab name entered in Settings

---

## 📬 Support

If authentication fails, open Chrome DevTools on the popup (`right-click popup → Inspect`) and check the **Console** tab for error messages.
