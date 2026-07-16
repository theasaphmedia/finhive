/**
 * FinHive ingestion script (Google Apps Script) -- Build Spec Section 4.
 *
 * One copy of this script is installed per organization (or one shared script
 * templated per org -- see CLAUDE.md "Open Items"). It polls a Gmail label for
 * forwarded bank alerts and POSTs each one to FinHive's /api/ingest endpoint.
 * It is completely bank-agnostic: the extraction logic lives server-side in
 * FinHive (via Claude), not here -- this script's only job is to find new
 * emails and forward their raw text.
 *
 * SETUP (per organization):
 * 1. In Gmail, create a label (e.g. "FinHive") and a filter that applies it to
 *    incoming bank alert emails (forwarded SMS or native bank emails).
 * 2. Go to script.google.com, create a new project, paste this file in.
 * 3. Fill in FINHIVE_API_URL and FINHIVE_INGESTION_TOKEN below (the token is
 *    generated per-organization in the FinHive admin panel during onboarding).
 * 4. Run `setUpTrigger` once from the Apps Script editor to install a
 *    time-driven trigger (every 10-15 minutes).
 * 5. Authorize the script's Gmail access when prompted.
 *
 * UPDATED to also forward Gmail's own "Authentication-Results" header (SPF/
 * DKIM pass or fail) alongside each message -- this is what lets FinHive tell
 * a spoofed "bank alert" apart from a real one, with no new external service:
 * Gmail already computes this for every message it receives, this script
 * just has to hand it over.
 */

const FINHIVE_API_URL = "https://finhive-app-taiglobal.vercel.app/api/ingest";
const FINHIVE_INGESTION_TOKEN = "f62f5dc8bc1238ada410d39835ae77187dfb824e014a070e789e6a1f7598790d"; // TWN Studios
const VERCEL_PROTECTION_BYPASS = "A9lfa39baLPYgfsAYPHNas0wuA5L8ZdS"; // lets this script through Vercel's deployment gate
const GMAIL_LABEL = "FinHive"; // the Gmail label applied to bank alert emails
const PROCESSED_LABEL = "FinHive/Processed"; // moved here after a successful POST

function pollBankAlerts() {
  const label = GmailApp.getUserLabelByName(GMAIL_LABEL);
  if (!label) {
    Logger.log('Label "%s" not found. Create it and apply it to bank alert emails first.', GMAIL_LABEL);
    return;
  }

  let processedLabel = GmailApp.getUserLabelByName(PROCESSED_LABEL);
  if (!processedLabel) {
    processedLabel = GmailApp.createLabel(PROCESSED_LABEL);
  }

  const threads = label.getThreads(0, 25); // batch size per run (safe under the 6-minute execution limit)

  threads.forEach((thread) => {
    const messages = thread.getMessages();

    messages.forEach((message) => {
      const messageId = message.getId();
      const rawText = message.getPlainBody() || message.getBody();
      const authResults = getAuthenticationResults(message);

      const success = sendToFinHive(messageId, rawText, authResults);

      if (success) {
        thread.removeLabel(label);
        thread.addLabel(processedLabel);
      }
    });
  });
}

/**
 * Gmail computes SPF/DKIM verdicts for every incoming message and exposes
 * them in the "Authentication-Results" header -- this just reads it back.
 * Returns "" if the header isn't present (e.g. very old messages), which
 * FinHive treats as "unknown" rather than "failed".
 */
function getAuthenticationResults(message) {
  try {
    return message.getHeader("Authentication-Results") || "";
  } catch (err) {
    Logger.log("Could not read Authentication-Results header: %s", err);
    return "";
  }
}

function sendToFinHive(messageId, rawText, authResults) {
  const payload = {
    token: FINHIVE_INGESTION_TOKEN,
    message_id: messageId,
    raw_text: rawText,
    auth_results: authResults,
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    headers: {
      "x-vercel-protection-bypass": VERCEL_PROTECTION_BYPASS,
    },
  };

  try {
    const response = UrlFetchApp.fetch(FINHIVE_API_URL, options);
    const code = response.getResponseCode();
    Logger.log("FinHive ingest response [%s]: %s", code, response.getContentText());
    return code >= 200 && code < 300;
  } catch (err) {
    Logger.log("FinHive ingest failed: %s", err);
    return false;
  }
}

/** Run this once manually from the Apps Script editor to install the timer. */
function setUpTrigger() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "pollBankAlerts") ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger("pollBankAlerts").timeBased().everyMinutes(15).create();

  Logger.log("Trigger installed: pollBankAlerts will run every 15 minutes.");
}
