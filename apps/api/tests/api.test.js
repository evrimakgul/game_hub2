import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function register(app, { displayName, email, password }) {
  const payload = {
    email,
    password
  };
  if (displayName !== undefined) {
    payload.displayName = displayName;
  }

  const response = await request(app).post("/api/v1/auth/register").send(payload);
  expect(response.status).toBe(201);
  return response.body;
}

async function login(app, { email, password }) {
  const response = await request(app).post("/api/v1/auth/login").send({
    email,
    password
  });
  expect(response.status).toBe(200);
  return response.body;
}

describe("MVP API scenarios", () => {
  let tempDir;
  let storeFile;
  let app;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gamehub2-"));
    storeFile = path.join(tempDir, "store.json");
    app = createApp({
      storeFile,
      jwtSecret: "test-secret"
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("GM invites player, player joins, and visibility rules are enforced", async () => {
    const gm = await register(app, {
      displayName: "GM One",
      email: "gm@example.com",
      password: "secret12"
    });
    const player = await register(app, {
      displayName: "Player One",
      email: "player@example.com",
      password: "secret12"
    });

    const createCampaign = await request(app)
      .post("/api/v1/campaigns")
      .set(authHeader(gm.token))
      .send({ name: "Ravenfall" });
    expect(createCampaign.status).toBe(201);
    const campaignId = createCampaign.body.campaign.id;

    const invite = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/invites`)
      .set(authHeader(gm.token))
      .send({ email: "player@example.com" });
    expect(invite.status).toBe(201);

    const accept = await request(app)
      .post("/api/v1/invites/accept")
      .set(authHeader(player.token))
      .send({ token: invite.body.invite.token });
    expect(accept.status).toBe(200);

    const extraInvite = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/invites`)
      .set(authHeader(gm.token))
      .send({ email: "futurefriend@example.com" });
    expect(extraInvite.status).toBe(201);

    const gmCharacters = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/characters`)
      .set(authHeader(gm.token));
    expect(gmCharacters.status).toBe(200);
    expect(gmCharacters.body.characters.length).toBe(2);

    const playerCharacters = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/characters`)
      .set(authHeader(player.token));
    expect(playerCharacters.status).toBe(200);
    expect(playerCharacters.body.characters.length).toBe(1);
    expect(playerCharacters.body.characters[0].userId).toBe(player.user.id);

    const gmCharacter = gmCharacters.body.characters.find(
      (entry) => entry.userId === gm.user.id
    );
    const playerCharacter = gmCharacters.body.characters.find(
      (entry) => entry.userId === player.user.id
    );

    const gmCanSeePlayer = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/characters/${playerCharacter.id}`)
      .set(authHeader(gm.token));
    expect(gmCanSeePlayer.status).toBe(200);

    const playerCannotSeeGm = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/characters/${gmCharacter.id}`)
      .set(authHeader(player.token));
    expect(playerCannotSeeGm.status).toBe(403);

    const gmSummary = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/summary`)
      .set(authHeader(gm.token));
    expect(gmSummary.status).toBe(200);
    expect(gmSummary.body.memberCount).toBe(2);
    expect(gmSummary.body.pendingInvitesCount).toBe(1);
    expect(gmSummary.body.pendingInvites).toHaveLength(1);
    expect(gmSummary.body.pendingInvites[0].token).toBeTypeOf("string");

    const playerSummary = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/summary`)
      .set(authHeader(player.token));
    expect(playerSummary.status).toBe(200);
    expect(playerSummary.body.memberCount).toBe(2);
    expect(playerSummary.body.pendingInvitesCount).toBe(1);
    expect(playerSummary.body.pendingInvites).toHaveLength(0);
  });

  it("Email/password signup works without display name", async () => {
    const signup = await register(app, {
      email: "simple-signup@example.com",
      password: "secret12"
    });
    expect(signup.user.email).toBe("simple-signup@example.com");
    expect(signup.user.displayName).toBe("simple-signup");
  });

  it("D10 roll returns success model and feed includes roll event", async () => {
    const gm = await register(app, {
      displayName: "GM One",
      email: "gm2@example.com",
      password: "secret12"
    });
    const player = await register(app, {
      displayName: "Player One",
      email: "player2@example.com",
      password: "secret12"
    });

    const createCampaign = await request(app)
      .post("/api/v1/campaigns")
      .set(authHeader(gm.token))
      .send({ name: "Ash Vale" });
    const campaignId = createCampaign.body.campaign.id;

    const invite = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/invites`)
      .set(authHeader(gm.token))
      .send({ email: "player2@example.com" });
    await request(app)
      .post("/api/v1/invites/accept")
      .set(authHeader(player.token))
      .send({ token: invite.body.invite.token });

    const roll = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/rolls`)
      .set(authHeader(player.token))
      .send({ pool: 5, difficulty: 6, label: "Attack check" });

    expect(roll.status).toBe(201);
    expect(roll.body.result.pool).toBe(5);
    expect(roll.body.result.difficulty).toBe(6);
    expect(roll.body.result.rolls).toHaveLength(5);
    expect(typeof roll.body.result.successes).toBe("number");
    expect(typeof roll.body.result.isSuccess).toBe("boolean");

    const events = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/events`)
      .set(authHeader(gm.token));
    expect(events.status).toBe(200);
    expect(
      events.body.events.some((entry) => entry.type === "DICE_ROLLED")
    ).toBe(true);

    const filtered = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/events?type=DICE_ROLLED`)
      .set(authHeader(gm.token));
    expect(filtered.status).toBe(200);
    expect(filtered.body.events.length).toBeGreaterThan(0);
    expect(
      filtered.body.events.every((entry) => entry.type === "DICE_ROLLED")
    ).toBe(true);
  });

  it("D10 roll validates pool/difficulty with clear 400 errors", async () => {
    const gm = await register(app, {
      displayName: "GM Roll Validation",
      email: "gm-roll-validation@example.com",
      password: "secret12"
    });
    const player = await register(app, {
      displayName: "Player Roll Validation",
      email: "player-roll-validation@example.com",
      password: "secret12"
    });

    const createCampaign = await request(app)
      .post("/api/v1/campaigns")
      .set(authHeader(gm.token))
      .send({ name: "Roll Validation Realm" });
    const campaignId = createCampaign.body.campaign.id;

    const invite = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/invites`)
      .set(authHeader(gm.token))
      .send({ email: "player-roll-validation@example.com" });
    await request(app)
      .post("/api/v1/invites/accept")
      .set(authHeader(player.token))
      .send({ token: invite.body.invite.token });

    const invalidPool = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/rolls`)
      .set(authHeader(player.token))
      .send({ pool: 0, difficulty: 6 });
    expect(invalidPool.status).toBe(400);
    expect(invalidPool.body.error).toContain("Pool must be an integer");

    const invalidDifficulty = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/rolls`)
      .set(authHeader(player.token))
      .send({ pool: 5, difficulty: 11 });
    expect(invalidDifficulty.status).toBe(400);
    expect(invalidDifficulty.body.error).toContain(
      "Difficulty must be an integer"
    );
  });

  it("Character sheet schema is exposed and XP-buy rules enforce progression edits", async () => {
    const gm = await register(app, {
      displayName: "GM Schema",
      email: "gm-schema@example.com",
      password: "secret12"
    });

    const createCampaign = await request(app)
      .post("/api/v1/campaigns")
      .set(authHeader(gm.token))
      .send({ name: "Schema Realm" });
    expect(createCampaign.status).toBe(201);
    const campaignId = createCampaign.body.campaign.id;

    const schemaResponse = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/characters/schema`)
      .set(authHeader(gm.token));
    expect(schemaResponse.status).toBe(200);
    expect(schemaResponse.body.rulesetId).toBe("d10-basic");
    expect(schemaResponse.body.schema.id).toBe("d10-basic-sheet-v2");
    expect(schemaResponse.body.schema.version).toBe(2);
    expect(schemaResponse.body.schema.sections).toHaveLength(10);
    const statsSection = schemaResponse.body.schema.sections.find(
      (section) => section.id === "stats"
    );
    expect(statsSection.groups.map((group) => group.id)).toEqual([
      "physical",
      "social",
      "mental"
    ]);
    const powersSection = schemaResponse.body.schema.sections.find(
      (section) => section.id === "powersSpells"
    );
    expect(powersSection.selectionSource.type).toBe("ruleset-power-system");
    expect(powersSection.selectionSource.tierIds).toEqual(["t1"]);
    const meritsFlawsSection = schemaResponse.body.schema.sections.find(
      (section) => section.id === "meritsFlaws"
    );
    expect(meritsFlawsSection.selectionSource.type).toBe(
      "ruleset-merits-flaws-system"
    );
    expect(meritsFlawsSection.selectionSource.categories).toEqual([
      "merits",
      "flaws"
    ]);

    const powerCatalogResponse = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/characters/powers/catalog`)
      .set(authHeader(gm.token));
    expect(powerCatalogResponse.status).toBe(200);
    expect(powerCatalogResponse.body.rulesetId).toBe("d10-basic");
    expect(powerCatalogResponse.body.powerSystem.nesting).toEqual([
      "tiers",
      "powers",
      "spells"
    ]);
    expect(powerCatalogResponse.body.powerSystem.tiers).toHaveLength(1);
    expect(powerCatalogResponse.body.powerSystem.tiers[0].id).toBe("t1");
    expect(
      powerCatalogResponse.body.powerSystem.tiers[0].powers.map((entry) => entry.label)
    ).toEqual([
      "Awareness",
      "Body Reinforcement",
      "Crowd Control",
      "Elementalist",
      "Healing",
      "Light Support",
      "Necromancy",
      "Shadow Control"
    ]);

    const meritsFlawsCatalogResponse = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/characters/merits-flaws/catalog`)
      .set(authHeader(gm.token));
    expect(meritsFlawsCatalogResponse.status).toBe(200);
    expect(meritsFlawsCatalogResponse.body.rulesetId).toBe("d10-basic");
    expect(meritsFlawsCatalogResponse.body.meritsFlawsSystem.categories).toEqual([
      "merits",
      "flaws"
    ]);
    expect(
      meritsFlawsCatalogResponse.body.meritsFlawsSystem.merits.map(
        (entry) => entry.label
      )
    ).toEqual([
      "Extra HP",
      "Extra Mana",
      "Gifted",
      "Rich Bitch",
      "Dao Companion",
      "Extra Language",
      "Dominant Dosha (Pitta)",
      "Dominant Dosha (Vata)",
      "Dominant Dosha (Kapha)",
      "Inspired",
      "Echoes of Past"
    ]);
    expect(
      meritsFlawsCatalogResponse.body.meritsFlawsSystem.flaws.map(
        (entry) => entry.label
      )
    ).toEqual([
      "Permanently Wounded",
      "Magic Blindness",
      "Asocial",
      "Huge Debt",
      "Uninspired",
      "Weak and Meek"
    ]);

    const update = await request(app)
      .put(`/api/v1/campaigns/${campaignId}/characters/me`)
      .set(authHeader(gm.token))
      .send({
        name: "Schema Hero",
        notes: "Session one note",
        bioPlayer: "GM Schema",
        bioAge: "29",
        bioDemeanor: "Calm",
        bioInspiration: 2,
        bioNegKarma: -1,
        bioPosKarma: 3,
        bioSessionXp: 4,
        bioGameDateTime: "Year 1, Day 20",
        bioMoney: 150
      });

    expect(update.status).toBe(200);
    const characterId = update.body.character.id;
    expect(update.body.character.name).toBe("Schema Hero");
    expect(update.body.character.notes).toBe("Session one note");
    expect(update.body.character.stats.physical.strength).toBe(1);
    expect(update.body.character.stats.social.manipulation).toBe(1);
    expect(update.body.character.stats.mental.wits).toBe(1);
    expect(update.body.character.sheet.sections.bio.bioPlayer).toBe("GM Schema");
    expect(update.body.character.sheet.sections.bio.bioInspiration).toBe(2);
    expect(update.body.character.sheet.sections.bio.bioSessionXp).toBe(4);
    expect(update.body.character.sheet.sections.combat.combatInitiative).toBe(0);
    expect(update.body.character.sheet.sections.skills.athletics).toBe(0);
    expect(update.body.character.sectionLocks.powersSpells.locked).toBe(true);
    expect(update.body.character.sectionLocks.meritsFlaws.locked).toBe(true);

    const invalidStat = await request(app)
      .put(`/api/v1/campaigns/${campaignId}/characters/me`)
      .set(authHeader(gm.token))
      .send({
        stats: {
          physical: {
            strength: 1000
          }
        }
      });
    expect(invalidStat.status).toBe(400);
    expect(invalidStat.body.error).toContain("Strength cannot be edited");

    const invalidSkill = await request(app)
      .put(`/api/v1/campaigns/${campaignId}/characters/me`)
      .set(authHeader(gm.token))
      .send({
        athletics: 1000
      });
    expect(invalidSkill.status).toBe(400);
    expect(invalidSkill.body.error).toContain("Athletics cannot be edited");

    const invalidCombat = await request(app)
      .put(`/api/v1/campaigns/${campaignId}/characters/me`)
      .set(authHeader(gm.token))
      .send({
        combatMana: 10000
      });
    expect(invalidCombat.status).toBe(400);
    expect(invalidCombat.body.error).toContain("Mana cannot be edited");

    const invalidPowers = await request(app)
      .put(`/api/v1/campaigns/${campaignId}/characters/me`)
      .set(authHeader(gm.token))
      .send({ powers: "manual" });
    expect(invalidPowers.status).toBe(400);
    expect(invalidPowers.body.error).toContain("Known Powers cannot be edited");

    const invalidMeritsFlaws = await request(app)
      .put(`/api/v1/campaigns/${campaignId}/characters/me`)
      .set(authHeader(gm.token))
      .send({ meritsFlaws: "manual" });
    expect(invalidMeritsFlaws.status).toBe(400);
    expect(invalidMeritsFlaws.body.error).toContain("Traits cannot be edited");

    const applySessionXp = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/session-claim`)
      .set(authHeader(gm.token))
      .send({});
    expect(applySessionXp.status).toBe(200);
    expect(applySessionXp.body.character.sheet.sections.bio.bioSessionXp).toBe(0);
    expect(applySessionXp.body.character.sheet.sections.bio.bioXpEarned).toBe(4);
    expect(applySessionXp.body.awardRecord.sessionNumber).toBe(0);

    const awardLedger = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/xp/session-awards`)
      .set(authHeader(gm.token));
    expect(awardLedger.status).toBe(200);
    expect(awardLedger.body.records).toHaveLength(1);
    expect(awardLedger.body.records[0].awards[0].xp).toBe(4);

    const skillBuy = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/buys`)
      .set(authHeader(gm.token))
      .send({
        kind: "SKILL",
        fieldId: "athletics",
        toLevel: 1
      });
    expect(skillBuy.status).toBe(201);
    expect(skillBuy.body.receipt.xpDeltaUsed).toBe(3);
    expect(skillBuy.body.character.sheet.sections.skills.athletics).toBe(1);
    expect(skillBuy.body.character.sheet.sections.bio.bioXpUsed).toBe(3);
    expect(skillBuy.body.character.sheet.sections.bio.bioXpLeftOver).toBe(1);

    const notEnoughXpForStat = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/buys`)
      .set(authHeader(gm.token))
      .send({
        kind: "STAT",
        fieldId: "strength",
        toLevel: 3
      });
    expect(notEnoughXpForStat.status).toBe(400);
    expect(notEnoughXpForStat.body.error).toContain("Not enough XP Left Over");

    const refillSessionXp = await request(app)
      .put(`/api/v1/campaigns/${campaignId}/characters/me`)
      .set(authHeader(gm.token))
      .send({ bioSessionXp: 40 });
    expect(refillSessionXp.status).toBe(200);

    const applySessionXpAgain = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/session-claim`)
      .set(authHeader(gm.token))
      .send({});
    expect(applySessionXpAgain.status).toBe(200);
    expect(applySessionXpAgain.body.character.sheet.sections.bio.bioXpEarned).toBe(44);

    const statBuy = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/buys`)
      .set(authHeader(gm.token))
      .send({
        kind: "STAT",
        fieldId: "strength",
        toLevel: 3
      });
    expect(statBuy.status).toBe(201);
    expect(statBuy.body.receipt.xpDeltaUsed).toBe(9);
    expect(statBuy.body.character.stats.physical.strength).toBe(3);

    const powerBuyWithoutSectionToggle = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/buys`)
      .set(authHeader(gm.token))
      .send({
        kind: "POWER",
        tierId: "t1",
        powerId: "awareness",
        toLevel: 1
      });
    expect(powerBuyWithoutSectionToggle.status).toBe(201);
    expect(powerBuyWithoutSectionToggle.body.character.progression.powers.t1.awareness).toBe(1);

    const unlockPowers = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/${characterId}/section-locks`)
      .set(authHeader(gm.token))
      .send({
        sectionId: "powersSpells",
        locked: false
      });
    expect(unlockPowers.status).toBe(200);
    expect(unlockPowers.body.sectionLocks.powersSpells.locked).toBe(false);

    const powerBuy = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/buys`)
      .set(authHeader(gm.token))
      .send({
        kind: "POWER",
        tierId: "t1",
        powerId: "awareness",
        toLevel: 2
      });
    expect(powerBuy.status).toBe(201);
    expect(powerBuy.body.character.progression.powers.t1.awareness).toBe(2);

    const unlockMeritsFlaws = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/${characterId}/section-locks`)
      .set(authHeader(gm.token))
      .send({
        sectionId: "meritsFlaws",
        locked: false
      });
    expect(unlockMeritsFlaws.status).toBe(200);
    expect(unlockMeritsFlaws.body.sectionLocks.meritsFlaws.locked).toBe(false);

    const meritBuy = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/buys`)
      .set(authHeader(gm.token))
      .send({
        kind: "MERIT",
        traitId: "extra-hp",
        toLevel: 1
      });
    expect(meritBuy.status).toBe(201);
    expect(meritBuy.body.receipt.xpDeltaUsed).toBe(5);
    expect(meritBuy.body.character.progression.merits["extra-hp"]).toBe(1);

    const meritBuyLevel2 = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/buys`)
      .set(authHeader(gm.token))
      .send({
        kind: "MERIT",
        traitId: "extra-hp",
        toLevel: 2
      });
    expect(meritBuyLevel2.status).toBe(201);
    expect(meritBuyLevel2.body.receipt.xpDeltaUsed).toBe(5);
    expect(meritBuyLevel2.body.character.progression.merits["extra-hp"]).toBe(2);

    const flawBuy = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/buys`)
      .set(authHeader(gm.token))
      .send({
        kind: "FLAW",
        traitId: "huge-debt",
        toLevel: 1
      });
    expect(flawBuy.status).toBe(201);
    expect(flawBuy.body.receipt.xpDeltaEarned).toBe(5);
    expect(flawBuy.body.character.progression.flaws["huge-debt"]).toBe(1);
    expect(flawBuy.body.character.sheet.sections.bio.bioXpEarned).toBe(49);

    const oldFlatStats = await request(app)
      .put(`/api/v1/campaigns/${campaignId}/characters/me`)
      .set(authHeader(gm.token))
      .send({
        stats: {
          might: 99
        }
      });
    expect(oldFlatStats.status).toBe(400);
    expect(oldFlatStats.body.error).toContain("Unknown stat group 'might'");

    const unknownStatGroup = await request(app)
      .put(`/api/v1/campaigns/${campaignId}/characters/me`)
      .set(authHeader(gm.token))
      .send({
        stats: {
          spooky: {
            fear: 3
          }
        }
      });
    expect(unknownStatGroup.status).toBe(400);
    expect(unknownStatGroup.body.error).toContain("Unknown stat group 'spooky'");

    const unknownStatInGroup = await request(app)
      .put(`/api/v1/campaigns/${campaignId}/characters/me`)
      .set(authHeader(gm.token))
      .send({
        stats: {
          physical: {
            power: 3
          }
        }
      });
    expect(unknownStatInGroup.status).toBe(400);
    expect(unknownStatInGroup.body.error).toContain(
      "Unknown stat 'power' in group 'physical'"
    );

    const invalidDemeanor = await request(app)
      .put(`/api/v1/campaigns/${campaignId}/characters/me`)
      .set(authHeader(gm.token))
      .send({
        bioDemeanor: "x".repeat(81)
      });
    expect(invalidDemeanor.status).toBe(400);
    expect(invalidDemeanor.body.error).toContain("Demeanor");

    const setActive = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/session/state`)
      .set(authHeader(gm.token))
      .send({ state: "active-live" });
    expect(setActive.status).toBe(200);

    const blockedXpBuyWhileActive = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/buys`)
      .set(authHeader(gm.token))
      .send({
        kind: "SKILL",
        fieldId: "technology",
        toLevel: 1
      });
    expect(blockedXpBuyWhileActive.status).toBe(400);
    expect(blockedXpBuyWhileActive.body.error).toContain("locked while session state is active-live");

    const blockedSessionClaimWhileActive = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/session-claim`)
      .set(authHeader(gm.token))
      .send({});
    expect(blockedSessionClaimWhileActive.status).toBe(400);
    expect(blockedSessionClaimWhileActive.body.error).toContain("locked while session state is active-live");
  });

  it("Data persists across app restart", async () => {
    const appA = createApp({ storeFile, jwtSecret: "test-secret" });
    const gm = await register(appA, {
      displayName: "GM Persist",
      email: "persist@example.com",
      password: "secret12"
    });

    const createCampaign = await request(appA)
      .post("/api/v1/campaigns")
      .set(authHeader(gm.token))
      .send({ name: "Persisted Realm" });
    expect(createCampaign.status).toBe(201);

    const appB = createApp({ storeFile, jwtSecret: "test-secret" });
    const relogin = await login(appB, {
      email: "persist@example.com",
      password: "secret12"
    });

    const campaigns = await request(appB)
      .get("/api/v1/campaigns")
      .set(authHeader(relogin.token));
    expect(campaigns.status).toBe(200);
    expect(campaigns.body.campaigns).toHaveLength(1);
    expect(campaigns.body.campaigns[0].name).toBe("Persisted Realm");
  });

  it("GM XP corrections are audited, freeze buys while pending, and support confirm/deny", async () => {
    const gm = await register(app, {
      displayName: "GM Correct",
      email: "gm-correct@example.com",
      password: "secret12"
    });

    const createCampaign = await request(app)
      .post("/api/v1/campaigns")
      .set(authHeader(gm.token))
      .send({ name: "Correction Realm" });
    expect(createCampaign.status).toBe(201);
    const campaignId = createCampaign.body.campaign.id;

    const prep = await request(app)
      .put(`/api/v1/campaigns/${campaignId}/characters/me`)
      .set(authHeader(gm.token))
      .send({ bioSessionXp: 20 });
    expect(prep.status).toBe(200);

    const claim = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/session-claim`)
      .set(authHeader(gm.token))
      .send({});
    expect(claim.status).toBe(200);
    const characterId = claim.body.character.id;

    const buy1 = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/buys`)
      .set(authHeader(gm.token))
      .send({
        kind: "SKILL",
        fieldId: "athletics",
        toLevel: 1
      });
    expect(buy1.status).toBe(201);
    const targetEntryId = buy1.body.receipt.entryId;

    const correctionCreate = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/${characterId}/xp/corrections`)
      .set(authHeader(gm.token))
      .send({
        targetEntryId,
        patch: { xpDeltaUsed: 2 },
        note: "Correcting overcharge"
      });
    expect(correctionCreate.status).toBe(201);
    expect(correctionCreate.body.correction.status).toBe("PENDING");
    expect(correctionCreate.body.correction.beforeState.xpDeltaUsed).toBe(3);
    expect(correctionCreate.body.correction.afterState.xpDeltaUsed).toBe(2);

    const frozenBuy = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/buys`)
      .set(authHeader(gm.token))
      .send({
        kind: "SKILL",
        fieldId: "technology",
        toLevel: 1
      });
    expect(frozenBuy.status).toBe(400);
    expect(frozenBuy.body.error).toContain("frozen");

    const listCorrections = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/characters/${characterId}/xp/corrections`)
      .set(authHeader(gm.token));
    expect(listCorrections.status).toBe(200);
    expect(listCorrections.body.corrections.length).toBe(1);

    const confirmCorrection = await request(app)
      .post(
        `/api/v1/campaigns/${campaignId}/characters/me/xp/corrections/${correctionCreate.body.correction.id}/confirm`
      )
      .set(authHeader(gm.token))
      .send({ note: "Confirmed" });
    expect(confirmCorrection.status).toBe(200);
    expect(confirmCorrection.body.correction.status).toBe("CONFIRMED");

    const buy2 = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/buys`)
      .set(authHeader(gm.token))
      .send({
        kind: "SKILL",
        fieldId: "technology",
        toLevel: 1
      });
    expect(buy2.status).toBe(201);

    const correctionCreate2 = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/${characterId}/xp/corrections`)
      .set(authHeader(gm.token))
      .send({
        targetEntryId: buy2.body.receipt.entryId,
        patch: { xpDeltaUsed: 7 },
        note: "Test deny"
      });
    expect(correctionCreate2.status).toBe(201);
    expect(correctionCreate2.body.correction.status).toBe("PENDING");

    const denyCorrection = await request(app)
      .post(
        `/api/v1/campaigns/${campaignId}/characters/me/xp/corrections/${correctionCreate2.body.correction.id}/deny`
      )
      .set(authHeader(gm.token))
      .send({ note: "Denied" });
    expect(denyCorrection.status).toBe(200);
    expect(denyCorrection.body.correction.status).toBe("DENIED_REVERTED");

    const canBuyAgain = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/characters/me/xp/buys`)
      .set(authHeader(gm.token))
      .send({
        kind: "SKILL",
        fieldId: "mechanics",
        toLevel: 1
      });
    expect(canBuyAgain.status).toBe(201);
  });

  it("Only GM can change session state and event feed records the change", async () => {
    const gm = await register(app, {
      displayName: "GM State",
      email: "gm-state@example.com",
      password: "secret12"
    });
    const player = await register(app, {
      displayName: "Player State",
      email: "player-state@example.com",
      password: "secret12"
    });

    const createCampaign = await request(app)
      .post("/api/v1/campaigns")
      .set(authHeader(gm.token))
      .send({ name: "State Realm" });
    const campaignId = createCampaign.body.campaign.id;

    const invite = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/invites`)
      .set(authHeader(gm.token))
      .send({ email: "player-state@example.com" });

    await request(app)
      .post("/api/v1/invites/accept")
      .set(authHeader(player.token))
      .send({ token: invite.body.invite.token });

    const playerAttempt = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/session/state`)
      .set(authHeader(player.token))
      .send({ state: "active-live" });
    expect(playerAttempt.status).toBe(403);

    const gmChange = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/session/state`)
      .set(authHeader(gm.token))
      .send({ state: "active-live" });
    expect(gmChange.status).toBe(200);
    expect(gmChange.body.campaign.sessionState).toBe("active-live");

    const events = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/events`)
      .set(authHeader(gm.token));
    expect(events.status).toBe(200);
    expect(
      events.body.events.some(
        (entry) =>
          entry.type === "SESSION_STATE_CHANGED" &&
          entry.payload &&
          entry.payload.state === "active-live"
      )
    ).toBe(true);
  });

  it("SSE stream denies outsiders and allows campaign members", async () => {
    const gm = await register(app, {
      displayName: "GM Stream",
      email: "gm-stream@example.com",
      password: "secret12"
    });
    const outsider = await register(app, {
      displayName: "Outsider",
      email: "outsider-stream@example.com",
      password: "secret12"
    });

    const createCampaign = await request(app)
      .post("/api/v1/campaigns")
      .set(authHeader(gm.token))
      .send({ name: "Stream Realm" });
    expect(createCampaign.status).toBe(201);
    const campaignId = createCampaign.body.campaign.id;

    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    try {
      const denied = await fetch(
        `${baseUrl}/api/v1/campaigns/${campaignId}/stream?token=${outsider.token}`
      );
      expect(denied.status).toBe(403);

      const abortController = new AbortController();
      const stream = await fetch(
        `${baseUrl}/api/v1/campaigns/${campaignId}/stream?token=${gm.token}`,
        {
          headers: { Accept: "text/event-stream" },
          signal: abortController.signal
        }
      );
      expect(stream.status).toBe(200);
      expect(stream.headers.get("content-type")).toContain("text/event-stream");

      const reader = stream.body.getReader();
      const firstChunk = await reader.read();
      const chunkText = new TextDecoder().decode(
        firstChunk.value || new Uint8Array()
      );
      expect(chunkText).toContain("event: connected");
      abortController.abort();
      reader.releaseLock();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("Chat supports public and private visibility rules", async () => {
    const gm = await register(app, {
      displayName: "GM Chat",
      email: "gm-chat@example.com",
      password: "secret12"
    });
    const playerA = await register(app, {
      displayName: "Player A",
      email: "player-a@example.com",
      password: "secret12"
    });
    const playerB = await register(app, {
      displayName: "Player B",
      email: "player-b@example.com",
      password: "secret12"
    });

    const createCampaign = await request(app)
      .post("/api/v1/campaigns")
      .set(authHeader(gm.token))
      .send({ name: "Chat Realm" });
    const campaignId = createCampaign.body.campaign.id;

    const inviteA = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/invites`)
      .set(authHeader(gm.token))
      .send({ email: "player-a@example.com" });
    const inviteB = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/invites`)
      .set(authHeader(gm.token))
      .send({ email: "player-b@example.com" });

    await request(app)
      .post("/api/v1/invites/accept")
      .set(authHeader(playerA.token))
      .send({ token: inviteA.body.invite.token });
    await request(app)
      .post("/api/v1/invites/accept")
      .set(authHeader(playerB.token))
      .send({ token: inviteB.body.invite.token });

    const gmSummary = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/summary`)
      .set(authHeader(gm.token));
    const gmUser = gmSummary.body.members.find((entry) => entry.role === "GM");
    const playerBUser = gmSummary.body.members.find(
      (entry) => entry.displayName === "Player B"
    );

    const publicMsg = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/chat/messages`)
      .set(authHeader(playerA.token))
      .send({
        text: "Hello party",
        visibility: "PUBLIC"
      });
    expect(publicMsg.status).toBe(201);

    const privateMsg = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/chat/messages`)
      .set(authHeader(playerA.token))
      .send({
        text: "Secret to GM",
        visibility: "PRIVATE",
        recipientUserIds: [gmUser.userId]
      });
    expect(privateMsg.status).toBe(201);

    const privateInvalidRecipient = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/chat/messages`)
      .set(authHeader(playerA.token))
      .send({
        text: "Bad secret",
        visibility: "PRIVATE",
        recipientUserIds: ["not-a-member"]
      });
    expect(privateInvalidRecipient.status).toBe(400);

    const gmView = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/chat/messages`)
      .set(authHeader(gm.token));
    expect(gmView.status).toBe(200);
    expect(gmView.body.messages).toHaveLength(2);

    const playerBView = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/chat/messages`)
      .set(authHeader(playerB.token));
    expect(playerBView.status).toBe(200);
    expect(playerBView.body.messages).toHaveLength(1);
    expect(playerBView.body.messages[0].text).toBe("Hello party");

    const privateOnlyForPlayerB = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/chat/messages?visibility=PRIVATE`)
      .set(authHeader(playerB.token));
    expect(privateOnlyForPlayerB.status).toBe(200);
    expect(privateOnlyForPlayerB.body.messages).toHaveLength(0);

    const privateOnlyForGm = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/chat/messages?visibility=PRIVATE`)
      .set(authHeader(gm.token));
    expect(privateOnlyForGm.status).toBe(200);
    expect(privateOnlyForGm.body.messages).toHaveLength(1);
    expect(privateOnlyForGm.body.messages[0].recipientUserIds).toContain(
      gmUser.userId
    );
    expect(privateOnlyForGm.body.messages[0].senderDisplayName).toBe("Player A");
    expect(privateOnlyForGm.body.messages[0].recipientUserIds).not.toContain(
      playerBUser.userId
    );
  });
});
