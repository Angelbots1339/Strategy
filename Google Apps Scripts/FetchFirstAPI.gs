/********************************************************************************************************************************** 
 * This script is designed to guide users through pulling data from the FRC Events API into Google Sheets.                        *
 *                                                                                                                                *
 * In order to use the system, you will need to obtain an API Key at https://frc-events.firstinspires.org/services/api/register   *
 *                                                                                                                                *
 * This tool is meant for demo purposes only. For more information, see https://frc-api-docs.firstinspires.org.                   *
 * Created by Jared Hasen-Klein. Code is offered without any warranty or guarentee.                                               *
 * Modified by 1339 (Alex F, Trevor D)
 * Modified by 1339 again (Kyle K, Sasha D, Trevor D)
 **********************************************************************************************************************************/


// User-defined variables
var range_year = SpreadsheetApp.getActive().getRangeByName("Selected_Year");
var range_code = SpreadsheetApp.getActive().getRangeByName("Selected_Code");
var range_regionalcode = SpreadsheetApp.getActive().getRangeByName("Selected_RegionalCode");
var range_matchtype = SpreadsheetApp.getActive().getRangeByName("Selected_Match_Type");

const YEAR = range_year.getValues();
const EVENT = range_code.getValues();
const REGIONAL_EVENT = range_regionalcode.getValues();
const MATCH_TYPE = range_matchtype.getValues();
const AWARD_YEAR_START = 2015;

// Your API credentials (replace with your actual credentials)
const API_USERNAME = '';
const API_TOKEN = '';

// JSON object keys for reef scoring
const REEF_KEYS = ["autoReef", "teleopReef"];
// JSON object keys for individual rows to collapse within the reef scoring object
const ROW_KEYS = ["topRow", "midRow", "botRow"];

function showUiPrompt() {
  const ui = SpreadsheetApp.getUi(); // Or DocumentApp.getUi(), etc.
  const response = ui.prompt(
    "API Password",
    "Please enter password for " + API_USERNAME,
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    Logger.log("User entered: " + response.getResponseText());
  } else if (response.getSelectedButton() === ui.Button.CANCEL) {
    Logger.log("User clicked Cancel.");
  } else if (response.getSelectedButton() === ui.Button.CLOSE) {
    Logger.log("User closed the dialog.");
  }
}


// Function to fetch API data
function fetchData(endpoint) {  
  var options = {
    'method': 'get',
    'headers': {
      'Authorization': 'Basic ' + Utilities.base64Encode(API_USERNAME + ':' + API_TOKEN)
    }
  };
  
  var response = UrlFetchApp.fetch(endpoint, options);
  var data = JSON.parse(response.getContentText());

  return data;
}

// parse data and write it to the spreadsheet
function writeDataArrayToSpreadsheet(dataArray, sheetName, flatten=true) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  } else {
    sheet.clear();
  }

  // throw data that isn't an array or JSON into it's own array
  //let dataArray = data.MatchScores || data.Schedule || data.Teams || [data];
  // flattened so every sub object is treated as part of the main object (removes nesting)
  if (flatten) dataArray = dataArray.map((d) => recursiveFlattenJSON(d));
  var headers = Object.keys(dataArray[0]);
  
  // Write headers
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Write data
  var rowData = dataArray.map(function(row) {
    return headers.map(function(header) {
      return row[header];
    });
  });
  
  if (rowData.length > 0) {
    sheet.getRange(2, 1, rowData.length, headers.length).setValues(rowData);
  }
  
  sheet.autoResizeColumns(1, headers.length);
}

function fetchScoreBreakdown() {
  var endpoint = `https://frc-api.firstinspires.org/v3.0/${YEAR}/scores/${EVENT}/${MATCH_TYPE}`;
  let data = fetchData(endpoint).MatchScores[0];
  //let data2 = Object.entries(data.alliances[0]).filter(([k, v]) => k == "totalPoints");
  let data2 = filterData(data.alliances[0], "totalPoints" , "alliance", "hubScore");

  writeDataArrayToSpreadsheet([data2], "Score Breakdown");
}

function filterData(data, ...wants) {
    return Object.entries(data).filter(([k, v]) => {console.log(k); return wants.includes(k)});
}

function fetchMatchSchedule() {
  var endpoint = `https://frc-api.firstinspires.org/v3.0/${YEAR}/schedule/${EVENT}?tournamentLevel=${MATCH_TYPE}`;
  let data = fetchData(endpoint);
  writeDataArrayToSpreadsheet(data.Schedule, "Match Schedule");
}

function fetchSeason() {
  var endpoint = `https://frc-api.firstinspires.org/v3.0/${YEAR}`;
  var data = fetchData(endpoint);
  writeDataArrayToSpreadsheet([data], "Season Info", false);
}

function fetchEvents() {
  var endpoint = `https://frc-api.firstinspires.org/v3.0/${YEAR}/events`;
  var data = fetchData(endpoint);
  writeDataArrayToSpreadsheet(data.Events, "Season Events", false);
}

function fetchEventDetail() {
  var endpoint = `https://frc-api.firstinspires.org/v3.0/${YEAR}/teams?eventCode=${EVENT}`;
  var data = fetchData(endpoint);
  writeDataArrayToSpreadsheet(data.teams, "Event Detail", false);
}

function fetchChamps() {
  var endpoint = `https://frc-api.firstinspires.org/v3.0/${YEAR}/teams?eventCode=CMPTX`;
  var data = fetchData(endpoint);
  writeDataArrayToSpreadsheet(data.teams, "Champs", false);
}

function fetchAwards() {
  var dataArray = [];
  for (var i = AWARD_YEAR_START; i <= YEAR; i++) {
    var endpoint = `https://frc-api.firstinspires.org/v3.0/${i}/awards/list`;
    var data = fetchData(endpoint);

  }
    writeDataArrayToSpreadsheet(data.awards, "Awards", false, i);
}

function fetchEventTeamData() {
  var endpoint = `https://frc-api.firstinspires.org/v3.0/${YEAR}/teams?eventCode=${REGIONAL_EVENT}`;
  var eventData = fetchData(endpoint);
  var dataArray = [];

  for (const team of eventData.teams) {
    var teamEndpoint = `https://frc-api.firstinspires.org/v3.0/${YEAR}/events?teamNumber=${team.teamNumber}`;
    var teamData = fetchData(teamEndpoint);

    dataArray.push({
      "team number": team.teamNumber,
      "events": teamData.Events.map(e => e.name).join(", "),
      "event codes": teamData.Events.map(e => e.code).join(", ")
    });
  }

  writeDataArrayToSpreadsheet(dataArray, "Event Team Info", false);
}

// recusively flatten the entire JSON into a single continuous object
function recursiveFlattenJSON(data, flatItem={}, location="") {
  Object.keys(data).forEach((key) => {
    var newLocation = location == "" ? key : location + "_" + key;

    if (!(typeof data[key] === 'object' && data[key] != null)) {
      flatItem[newLocation] = data[key];
      return;
    }

    if (!REEF_KEYS.includes(key)) {
      recursiveFlattenJSON(data[key], flatItem, newLocation);
      return;
    }

    // handle reef data
    Object.keys(data[key]).forEach((subKey) => {
      var subLocation = newLocation + "_" + subKey;
      var subData = data[key][subKey];

      // format boolean list
      if (ROW_KEYS.includes(subKey)) {
        let score = 0;

        Object.values(subData).forEach((b) => score += b ? 1 : 0);
        subData = score;
      }

      flatItem[subLocation] = subData;
      return;
    });
  });

  return flatItem;
}

// Combines the key functions

function fetchDataAndCreateSheets() {
  fetchScoreBreakdown();  // This calls fetchAndParseData for score breakdown
  fetchMatchSchedule();   // This calls fetchAndParseData for match schedule
  fetchEventDetail();   // This calls fetchAndParseData for Event Detail
  fetchChamps();      //Pull Champs qualifiers
}

// Adds a menu item to create the sheets

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('FRC API')
      .addItem('Fetch Data and Create Sheets', fetchDataAndCreateSheets.name)
      .addItem("Fetch Event Team Data", fetchEventTeamData.name)
      .addItem("Fetch Event Data", fetchEvents.name)
      .addItem("Fetch Award History", fetchAwards.name)
      .addToUi();
}