/**
 * Google Apps Script — Review Storage API v2
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
 * v2: Added JSONP support for cross-origin reads from Workspace domains.
 *     Handles sendBeacon POSTs (application/json content type).
 */

/**
 * Handle POST requests — save a review row
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
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
    ]);

    return ContentService.createTextOutput(
      JSON.stringify({ success: true }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.message }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests — load reviews for a tool + reviewer
 * Supports JSONP via ?callback=functionName parameter for cross-origin reads.
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
        message: "Review Storage API v2 is live",
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
