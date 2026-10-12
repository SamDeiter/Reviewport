/**
 * Google Apps Script — Review Storage API v4
 *
 * Setup:
 * 1. Create a new Google Sheet (name it "Reviewport Reviews")
 * 2. Go to Extensions → Apps Script
 * 3. Paste this entire file into Code.gs (replace any existing code)
 * 4. Click Deploy → New Deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Authorize when prompted
 * 6. Copy the Web App URL — this is your SCRIPT_URL
 *
 * v4: Added screenshot upload to Google Drive with embedded IMAGE() in Sheet.
 *     doPost reads from e.parameter (form fields) to support
 *     hidden-form submissions that survive 302 redirects.
 *     doGet supports JSONP callbacks for cross-origin reads.
 */

// Google Drive folder for screenshots
var SCREENSHOT_FOLDER_ID = "1QUjAnB8HxcsKsLDewC9kzdcJQtsezJCH";

/**
 * Handle POST requests — save a review row OR upload a screenshot.
 * Accepts form-encoded data (e.parameter) and JSON body (e.postData).
 *
 * For screenshots, send action=screenshot with base64 image data.
 */
function doPost(e) {
  try {
    // Parse data from form parameters or JSON body
    var data;
    if (e.parameter && (e.parameter.toolId || e.parameter.action)) {
      data = e.parameter;
      // highlights comes as a JSON string from the form
      if (typeof data.highlights === "string") {
        try {
          data.highlights = JSON.parse(data.highlights);
        } catch (ignored) {
          data.highlights = [];
        }
      }
    } else if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: "No data received" }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Route: screenshot upload
    if (data.action === "screenshot") {
      return handleScreenshot(data);
    }

    // Route: clear all data (admin)
    if (data.action === "clearAll") {
      return handleClearAll();
    }

    // Route: regular review save
    return handleReviewSave(data);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.message }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Save a review row to the active sheet.
 */
function handleReviewSave(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // Ensure header row exists
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "timestamp",
      "toolId",
      "itemId",
      "itemTitle",
      "status",
      "note",
      "highlights",
      "reviewerEmail",
      "reviewerName",
      "screenshot",
      "screenshotUrl",
    ]);
  }

  sheet.appendRow([
    new Date().toISOString(),
    data.toolId || "",
    data.itemId || "",
    data.itemTitle || "",
    data.status || "",
    data.note || "",
    JSON.stringify(data.highlights || []),
    data.reviewerEmail || "",
    data.reviewerName || "",
    "", // screenshot (IMAGE formula added by screenshot upload)
    "", // screenshotUrl
  ]);

  return ContentService.createTextOutput(
    JSON.stringify({ success: true }),
  ).setMimeType(ContentService.MimeType.JSON);
}
/**
 * Clear all data rows from the sheet (keep header).
 * Also clears screenshots from the Drive folder.
 */
function handleClearAll() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }

  // Clear Drive folder screenshots
  try {
    var folder = DriveApp.getFolderById(SCREENSHOT_FOLDER_ID);
    var files = folder.getFiles();
    while (files.hasNext()) {
      files.next().setTrashed(true);
    }
  } catch (e) {
    // Folder might not exist yet, that's fine
  }

  return ContentService.createTextOutput(
    JSON.stringify({ success: true, message: "All data cleared" }),
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle screenshot upload: save base64 PNG to Google Drive,
 * then write =IMAGE() formula + raw URL into the Sheet.
 */
function handleScreenshot(data) {
  var base64Data = data.imageData;
  if (!base64Data) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: "No imageData provided" }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // Remove data URL prefix if present
  if (base64Data.indexOf(",") > -1) {
    base64Data = base64Data.split(",")[1];
  }

  // Decode base64 to blob
  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, "image/png");

  // Build filename: toolId_itemId_timestamp.png
  var timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  var fileName =
    (data.toolId || "unknown") +
    "_" +
    (data.itemId || "unknown") +
    "_" +
    timestamp +
    ".png";
  blob.setName(fileName);

  // Save to Drive folder
  var folder = DriveApp.getFolderById(SCREENSHOT_FOLDER_ID);
  var file = folder.createFile(blob);

  // Make viewable by anyone with the link
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Build URLs
  var fileId = file.getId();
  var viewUrl = "https://drive.google.com/file/d/" + fileId + "/view";
  // Direct thumbnail URL for =IMAGE() formula
  var thumbnailUrl =
    "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w400";

  // Find the matching row in the Sheet and add the screenshot
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var dataRange = sheet.getDataRange().getValues();
  var headers = dataRange[0];

  // Find column indices
  var colScreenshot = headers.indexOf("screenshot");
  var colScreenshotUrl = headers.indexOf("screenshotUrl");
  var colItemId = headers.indexOf("itemId");
  var colToolId = headers.indexOf("toolId");

  // If headers don't have screenshot columns yet, add them
  if (colScreenshot === -1) {
    colScreenshot = headers.length;
    sheet.getRange(1, colScreenshot + 1).setValue("screenshot");
  }
  if (colScreenshotUrl === -1) {
    colScreenshotUrl = headers.length + 1;
    sheet.getRange(1, colScreenshotUrl + 1).setValue("screenshotUrl");
  }

  // Find the most recent matching row (search from bottom)
  var targetRow = -1;
  for (var i = dataRange.length - 1; i >= 1; i--) {
    if (
      dataRange[i][colToolId] === data.toolId &&
      dataRange[i][colItemId] === data.itemId
    ) {
      targetRow = i + 1; // Sheet rows are 1-indexed
      break;
    }
  }

  if (targetRow > 0) {
    // Update existing row with screenshot
    sheet
      .getRange(targetRow, colScreenshot + 1)
      .setFormula('=IMAGE("' + thumbnailUrl + '")');
    sheet.getRange(targetRow, colScreenshotUrl + 1).setValue(viewUrl);
  } else {
    // No matching review row — append a new row with just the screenshot
    var newRow = [];
    for (var k = 0; k < Math.max(colScreenshotUrl + 1, headers.length); k++) {
      newRow.push("");
    }
    newRow[0] = new Date().toISOString();
    newRow[colToolId] = data.toolId || "";
    newRow[colItemId] = data.itemId || "";
    newRow[colScreenshot] = '=IMAGE("' + thumbnailUrl + '")';
    newRow[colScreenshotUrl] = viewUrl;
    if (headers.indexOf("reviewerEmail") > -1) {
      newRow[headers.indexOf("reviewerEmail")] = data.reviewerEmail || "";
    }
    sheet.appendRow(newRow);
    // Set the IMAGE formula (appendRow doesn't support formulas)
    var lastRow = sheet.getLastRow();
    sheet
      .getRange(lastRow, colScreenshot + 1)
      .setFormula('=IMAGE("' + thumbnailUrl + '")');
  }

  return ContentService.createTextOutput(
    JSON.stringify({
      success: true,
      fileId: fileId,
      viewUrl: viewUrl,
      thumbnailUrl: thumbnailUrl,
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle GET requests — load reviews for a tool + reviewer.
 * Supports JSONP via ?callback=functionName for cross-origin reads.
 */
function doGet(e) {
  try {
    var toolId = e.parameter.toolId;
    var email = e.parameter.email;
    var callback = e.parameter.callback;

    // Health check
    if (!toolId) {
      var healthResponse = JSON.stringify({
        status: "ok",
        message: "Review Storage API v4 is live",
      });
      if (callback) {
        return ContentService.createTextOutput(
          callback + "(" + healthResponse + ")",
        ).setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(healthResponse).setMimeType(
        ContentService.MimeType.JSON,
      );
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var reviews = [];

    for (var i = 1; i < data.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }

      // Filter by toolId and optionally by email
      if (row.toolId === toolId) {
        if (!email || row.reviewerEmail === email) {
          // Parse highlights back from JSON string
          try {
            row.highlights = JSON.parse(row.highlights);
          } catch (ignored) {
            row.highlights = [];
          }
          reviews.push(row);
        }
      }
    }

    var jsonResponse = JSON.stringify({ success: true, reviews: reviews });

    // Return as JSONP if callback is specified (bypasses CORS)
    if (callback) {
      return ContentService.createTextOutput(
        callback + "(" + jsonResponse + ")",
      ).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(jsonResponse).setMimeType(
      ContentService.MimeType.JSON,
    );
  } catch (err) {
    var errorResponse = JSON.stringify({
      success: false,
      error: err.message,
    });
    var cb = e.parameter.callback;
    if (cb) {
      return ContentService.createTextOutput(
        cb + "(" + errorResponse + ")",
      ).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(errorResponse).setMimeType(
      ContentService.MimeType.JSON,
    );
  }
}
