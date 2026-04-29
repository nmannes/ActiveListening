const fs = require('fs');
const path = require('path');
const { getSpeakerEntities } = require('./speaker_identification');

const cacheDir = path.join(__dirname, '../cache');
const filesToTest = [
  'manual_matches.json',
  'latest_markets.json',
  'matched_markets.json',
  'unmatched_markets.json'
];

function loadJson(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`Error loading ${filePath}: ${e.message}`);
  }
  return [];
}

const testData = [];

filesToTest.forEach(filename => {
  const filePath = path.join(cacheDir, filename);
  const data = loadJson(filePath);
  
  data.forEach(entry => {
    // Handle different structures
    let title = '';
    let expected = [];

    if (entry.title) {
      title = entry.title;
      expected = entry.speakerEntities || [];
    } else if (entry.market && entry.market.title) {
      title = entry.market.title;
      expected = entry.market.speakerEntities || [];
    }

    if (title) {
      // If it's an earnings call, the expected result is now "[Company] employee" 
      // per the new requirement, even if the cache says otherwise.
      const earningsMatch = title.match(/^What will (.*) say during their next earnings call/i);
      if (earningsMatch) {
        expected = [`${earningsMatch[1].trim()} employee`];
      }
      testData.push({ title, expected, source: filename });
    }
  });
});

// Deduplicate by title
const uniqueTestData = [];
const seenTitles = new Set();
testData.forEach(item => {
  if (!seenTitles.has(item.title)) {
    seenTitles.add(item.title);
    uniqueTestData.push(item);
  }
});

console.log(`\n========================================================`);
console.log(`--- Running Speaker ID Test Suite (${uniqueTestData.length} cases) ---`);
console.log(`========================================================\n`);

let passed = 0;
let failed = 0;

uniqueTestData.forEach((item, index) => {
  const caseNum = index + 1;
  const total = uniqueTestData.length;
  
  console.log(`[${caseNum}/${total}] Testing: "${item.title}"`);
  console.log(`Source: ${item.source}`);
  
  let result;
  try {
    // We don't silence logs anymore to make it more verbose
    result = getSpeakerEntities(item.title);
  } catch (e) {
    result = [];
    console.log(`[ERROR] ${e.message}`);
  }
  
  // Sort for comparison
  const sortedResult = [...new Set(result.map(e => e.trim()))].sort();
  const sortedExpected = [...new Set(item.expected.map(e => e.trim()))].sort();
  
  const isMatch = JSON.stringify(sortedResult) === JSON.stringify(sortedExpected);
  
  if (isMatch) {
    passed++;
    console.log(`[PASS] Result: ${JSON.stringify(sortedResult)}`);
  } else {
    failed++;
    console.log(`\n[FAIL]`);
    console.log(`Expected: ${JSON.stringify(sortedExpected)}`);
    console.log(`Actual:   ${JSON.stringify(sortedResult)}`);
  }
  console.log(`--------------------------------------------------------`);
});

console.log(`\n========================================================`);
console.log(`--- Test Summary ---`);
console.log(`Total:  ${uniqueTestData.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`========================================================\n`);

if (failed > 0) {
  console.log(`Note: Some failures may be due to the new early-return logic or improved extraction accuracy.\n`);
}
