const { findProgramsByZipAndKeywords } = require("../lib/tv_discovery");

(async () => {
    console.log("Running TV discovery test for 'bulls', 'knicks', 'basketball'...");
    // Use Chicago and NYC zips to be safe
    const results = await findProgramsByZipAndKeywords("60601", ["bulls", "knicks", "basketball"]);
    
    console.log(`Found ${results.length} programs.`);
    results.forEach(p => {
        console.log(`- ${p.title} on ${p.station} at ${p.time} (${p.date})`);
    });

    const hasBulls = results.some(p => p.title.toLowerCase().includes("bulls") || p.description.toLowerCase().includes("bulls"));
    const hasKnicks = results.some(p => p.title.toLowerCase().includes("knicks") || p.description.toLowerCase().includes("knicks"));

    if (hasBulls || hasKnicks) {
        console.log("✅ Success: Found Bulls or Knicks in the schedule!");
    } else {
        console.log("⚠️ Warning: Did not find Bulls or Knicks. They might not be on OTA or TitanTV might not have the listing for this specific ZIP/Keyword combo.");
    }
})();
