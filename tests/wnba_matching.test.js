const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { getTeamNames } = require("../lib/discover_markets");
const { detectSport } = require("../lib/event_status");

describe("WNBA team name resolution", () => {
  it('resolves "ATL Dream" team to atlanta', () => {
    const title = "What will the announcers say during ATL Dream vs DAL Wings Women's Professional Basketball Game";
    const result = getTeamNames(title);
    assert.equal(result[0][1], "atlanta");
    assert.ok(result[0].includes("dream"));
    assert.ok(result[0].includes("atl"));
  });

  it('resolves "DAL Wings" team to dallas', () => {
    const title = "What will the announcers say during ATL Dream vs DAL Wings Women's Professional Basketball Game";
    const result = getTeamNames(title);
    assert.equal(result[1][1], "dallas");
    assert.ok(result[1].includes("wings"));
    assert.ok(result[1].includes("dal"));
  });

  it('resolves "GS Valkyries" team to golden state', () => {
    const title = "What will the announcers say during GS Valkyries vs PHX Mercury Women's Professional Basketball Game";
    const result = getTeamNames(title);
    assert.equal(result[0][1], "golden state");
    assert.ok(result[0].includes("valkyries"));
    assert.ok(result[0].includes("gs"));
  });

  it('resolves "PHX Mercury" team to phoenix', () => {
    const title = "What will the announcers say during GS Valkyries vs PHX Mercury Women's Professional Basketball Game";
    const result = getTeamNames(title);
    assert.equal(result[1][1], "phoenix");
    assert.ok(result[1].includes("mercury"));
    assert.ok(result[1].includes("phx"));
  });

  it('resolves "MIN Lynx" team to minnesota', () => {
    const title = "What will the announcers say during MIN Lynx vs TOR Tempo Women's Professional Basketball Game";
    const result = getTeamNames(title);
    assert.equal(result[0][1], "minnesota");
    assert.ok(result[0].includes("lynx"));
    assert.ok(result[0].includes("min"));
  });

  it('resolves "TOR Tempo" team to toronto', () => {
    const title = "What will the announcers say during MIN Lynx vs TOR Tempo Women's Professional Basketball Game";
    const result = getTeamNames(title);
    assert.equal(result[1][1], "toronto");
    assert.ok(result[1].includes("tempo"));
    assert.ok(result[1].includes("tor"));
  });

  it('resolves "NY Liberty" team to new york', () => {
    const title = "What will the announcers say during NY Liberty vs LV Aces Women's Professional Basketball Game";
    const result = getTeamNames(title);
    assert.equal(result[0][1], "new york");
    assert.ok(result[0].includes("liberty"));
    assert.ok(result[0].includes("ny"));
  });

  it('resolves "LV Aces" team to las vegas', () => {
    const title = "What will the announcers say during NY Liberty vs LV Aces Women's Professional Basketball Game";
    const result = getTeamNames(title);
    assert.equal(result[1][1], "las vegas");
    assert.ok(result[1].includes("aces"));
    assert.ok(result[1].includes("lv"));
  });

  it("resolves mascot-only names without abbreviations", () => {
    const result = getTeamNames("What will the announcers say during Dream vs Wings Women's Professional Basketball Game");
    assert.equal(result[0][1], "atlanta");
    assert.ok(result[0].includes("dream"));
    assert.equal(result[1][1], "dallas");
    assert.ok(result[1].includes("wings"));
  });

  it("resolves full city-and-mascot names", () => {
    const result = getTeamNames("What will the announcers say during Connecticut Sun vs Seattle Storm Women's Professional Basketball Game");
    assert.equal(result[0][1], "connecticut");
    assert.ok(result[0].includes("sun"));
    assert.equal(result[1][1], "seattle");
    assert.ok(result[1].includes("storm"));
  });

  it("does not confuse Sun (WNBA Connecticut) with Suns (NBA Phoenix)", () => {
    const result = getTeamNames("What will the announcers say during Connecticut Sun vs Chicago Sky Women's Professional Basketball Game");
    assert.equal(result[0][1], "connecticut");
    assert.equal(result[1][1], "chicago");
  });

  it("resolves all 13 WNBA mascots to correct cities", () => {
    const mascotToCity = {
      dream: "atlanta",
      sky: "chicago",
      sun: "connecticut",
      wings: "dallas",
      valkyries: "golden state",
      fever: "indiana",
      aces: "las vegas",
      sparks: "los angeles",
      lynx: "minnesota",
      liberty: "new york",
      mercury: "phoenix",
      storm: "seattle",
      mystics: "washington",
      tempo: "toronto",
    };
    for (const [mascot, city] of Object.entries(mascotToCity)) {
      const result = getTeamNames(`What will the announcers say during ${mascot} vs Dream Women's Professional Basketball Game`);
      assert.equal(result[0][1], city, `${mascot} should resolve to ${city}`);
      assert.ok(result[0].includes(mascot), `${mascot} variant should include itself`);
    }
  });
});

describe("WNBA league detection", () => {
  it("detects WNBA from title containing women + professional basketball", () => {
    const info = detectSport({
      title: "What will the announcers say during ATL Dream vs DAL Wings Women's Professional Basketball Game",
      slug: "kxwnbamention26jul29atldal",
    });
    assert.deepEqual(info, { sport: "basketball", league: "wnba" });
  });

  it("detects WNBA from kxwnba slug prefix alone", () => {
    const info = detectSport({
      title: "Some ambiguous basketball title",
      slug: "kxwnbamention26jul30mintor",
    });
    assert.deepEqual(info, { sport: "basketball", league: "wnba" });
  });

  it("still detects NBA for non-WNBA basketball titles", () => {
    const info = detectSport({
      title: "What will the announcers say during Lakers vs Celtics Professional Basketball Game",
      slug: "kxnbamention26jul29lalvsbos",
    });
    assert.deepEqual(info, { sport: "basketball", league: "nba" });
  });

  it("returns null for non-sport titles", () => {
    const info = detectSport({
      title: "What will Trump say during his speech",
      slug: "kxtrumpmention26jul29",
    });
    assert.equal(info, null);
  });
});
