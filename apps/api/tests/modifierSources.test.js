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
  const response = await request(app).post("/api/v1/auth/register").send({
    displayName,
    email,
    password
  });
  expect(response.status).toBe(201);
  return response.body;
}

describe("Modifier source API", () => {
  let tempDir;
  let storeFile;
  let app;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gamehub2-modifiers-"));
    storeFile = path.join(tempDir, "store.json");
    app = createApp({
      storeFile,
      jwtSecret: "test-secret"
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("allows GM to manage modifier sources and aggregates power/stat bonuses", async () => {
    const gm = await register(app, {
      displayName: "GM",
      email: "gm-mod@example.com",
      password: "secret12"
    });
    const player = await register(app, {
      displayName: "Player",
      email: "player-mod@example.com",
      password: "secret12"
    });

    const createCampaign = await request(app)
      .post("/api/v1/campaigns")
      .set(authHeader(gm.token))
      .send({ name: "Modifiers Test" });
    expect(createCampaign.status).toBe(201);
    const campaignId = createCampaign.body.campaign.id;

    const invite = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/invites`)
      .set(authHeader(gm.token))
      .send({ email: player.user.email });
    expect(invite.status).toBe(201);

    const accept = await request(app)
      .post("/api/v1/invites/accept")
      .set(authHeader(player.token))
      .send({ token: invite.body.invite.token });
    expect(accept.status).toBe(200);

    const gmCharacters = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/characters`)
      .set(authHeader(gm.token));
    expect(gmCharacters.status).toBe(200);
    const playerCharacter = gmCharacters.body.characters.find(
      (entry) => entry.userId === player.user.id
    );
    expect(playerCharacter?.id).toBeTruthy();

    const createStrengthBuff = await request(app)
      .post(
        `/api/v1/campaigns/${campaignId}/characters/${playerCharacter.id}/modifier-sources`
      )
      .set(authHeader(gm.token))
      .send({
        label: "Gauntlets of Force",
        kind: "equipment",
        modifiers: [
          {
            targetFieldId: "stats.physical.strength",
            amount: 2
          }
        ]
      });
    expect(createStrengthBuff.status).toBe(201);
    expect(createStrengthBuff.body.modifierSource.label).toBe("Gauntlets of Force");
    expect(
      createStrengthBuff.body.character.numericTriples.stats.physical.strength.bonus
    ).toBe(2);
    expect(
      createStrengthBuff.body.character.numericTriples.stats.physical.strength.current
    ).toBe(
      createStrengthBuff.body.character.numericTriples.stats.physical.strength.base + 2
    );

    const updateStrengthBuff = await request(app)
      .put(
        `/api/v1/campaigns/${campaignId}/characters/${playerCharacter.id}/modifier-sources/${createStrengthBuff.body.modifierSource.id}`
      )
      .set(authHeader(gm.token))
      .send({
        label: "Gauntlets of Force",
        kind: "equipment",
        modifiers: [
          {
            targetFieldId: "stats.physical.strength",
            amount: 3
          }
        ]
      });
    expect(updateStrengthBuff.status).toBe(200);
    expect(
      updateStrengthBuff.body.character.numericTriples.stats.physical.strength.bonus
    ).toBe(3);

    const createPowerDebuff = await request(app)
      .post(
        `/api/v1/campaigns/${campaignId}/characters/${playerCharacter.id}/modifier-sources`
      )
      .set(authHeader(gm.token))
      .send({
        label: "Null Ward",
        kind: "debuff",
        modifiers: [
          {
            targetFieldId: "powers.shadow-control",
            amount: -1
          }
        ]
      });
    expect(createPowerDebuff.status).toBe(201);
    expect(
      createPowerDebuff.body.character.numericTriples?.powers?.t1?.["shadow-control"]?.bonus
    ).toBe(-1);
    expect(
      createPowerDebuff.body.character.numericBreakdowns?.powers?.t1?.["shadow-control"]?.channels?.debuff
    ).toBe(-1);

    const listAsGm = await request(app)
      .get(
        `/api/v1/campaigns/${campaignId}/characters/${playerCharacter.id}/modifier-sources`
      )
      .set(authHeader(gm.token));
    expect(listAsGm.status).toBe(200);
    expect(listAsGm.body.modifierSources).toHaveLength(2);

    const listAsPlayer = await request(app)
      .get(
        `/api/v1/campaigns/${campaignId}/characters/${playerCharacter.id}/modifier-sources`
      )
      .set(authHeader(player.token));
    expect(listAsPlayer.status).toBe(403);

    const powerSource = createPowerDebuff.body.modifierSource;
    const togglePowerSource = await request(app)
      .post(
        `/api/v1/campaigns/${campaignId}/characters/${playerCharacter.id}/modifier-sources/${powerSource.id}/toggle`
      )
      .set(authHeader(gm.token))
      .send({});
    expect(togglePowerSource.status).toBe(200);
    expect(togglePowerSource.body.modifierSource.active).toBe(false);
    expect(
      togglePowerSource.body.character.numericTriples?.powers?.t1?.["shadow-control"]?.bonus
    ).toBe(0);

    const strengthSource = updateStrengthBuff.body.modifierSource;
    const deleteStrengthSource = await request(app)
      .delete(
        `/api/v1/campaigns/${campaignId}/characters/${playerCharacter.id}/modifier-sources/${strengthSource.id}`
      )
      .set(authHeader(gm.token));
    expect(deleteStrengthSource.status).toBe(200);
    expect(deleteStrengthSource.body.deletedSourceId).toBe(strengthSource.id);
    expect(
      deleteStrengthSource.body.character.numericTriples.stats.physical.strength.bonus
    ).toBe(0);
  });
});
