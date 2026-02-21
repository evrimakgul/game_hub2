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
      .send({ state: "active" });
    expect(playerAttempt.status).toBe(403);

    const gmChange = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/session/state`)
      .set(authHeader(gm.token))
      .send({ state: "active" });
    expect(gmChange.status).toBe(200);
    expect(gmChange.body.campaign.sessionState).toBe("active");

    const events = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/events`)
      .set(authHeader(gm.token));
    expect(events.status).toBe(200);
    expect(
      events.body.events.some(
        (entry) =>
          entry.type === "SESSION_STATE_CHANGED" &&
          entry.payload &&
          entry.payload.state === "active"
      )
    ).toBe(true);
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
