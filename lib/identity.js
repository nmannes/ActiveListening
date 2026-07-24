const fs = require('fs');
const path = require('path');

/**
 * Loads identity details for autofill.
 * Priority: 
 * 1. identity.json in root
 * 2. Environment variables (AUTOFILL_FIRST_NAME, etc.)
 * 3. Hardcoded defaults
 */
function getIdentity() {
  const rootDir = path.join(__dirname, '..');
  const identityPath = path.join(rootDir, 'identity.json');
  
  let identity = {
    firstName: process.env.AUTOFILL_FIRST_NAME || 'nathan',
    lastName: process.env.AUTOFILL_LAST_NAME || 'mannes',
    email: process.env.AUTOFILL_EMAIL || 'nmannes@gmail.com',
    company: process.env.AUTOFILL_COMPANY || 'n/a',
    country: process.env.AUTOFILL_COUNTRY || 'United States',
    phone: process.env.AUTOFILL_PHONE || '555-0100',
    zip: process.env.AUTOFILL_ZIP || '10001',
    jobTitle: process.env.AUTOFILL_JOB_TITLE || 'Analyst',
    city: process.env.AUTOFILL_CITY || 'New York',
    state: process.env.AUTOFILL_STATE || 'NY'
  };

  if (fs.existsSync(identityPath)) {
    try {
      const fileData = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
      identity = { ...identity, ...fileData };
    } catch (e) {
      console.error(`[identity] Failed to parse identity.json: ${e.message}`);
    }
  }

  return identity;
}

module.exports = { getIdentity };
