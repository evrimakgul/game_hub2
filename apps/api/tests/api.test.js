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
});
