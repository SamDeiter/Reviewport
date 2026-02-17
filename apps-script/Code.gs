/**
 * Google Apps Script — Review Storage API
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
 */
function doGet(e) {
  try {
    var toolId = e.parameter.toolId;
    var email = e.parameter.email;

    // Health check
    if (!toolId) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: "ok", message: "Review Storage API is live" }),
      ).setMimeType(ContentService.MimeType.JSON);
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

    return ContentService.createTextOutput(
      JSON.stringify({ success: true, reviews: reviews }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.message }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
