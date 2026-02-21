const state = {
  token: null,
  user: null,
  campaignId: null,
  campaignName: null,
  campaignState: null,
  campaignRole: null,
  lastEventTimestamp: null,
  lastChatTimestamp: null
};

function setStatus(message, payload) {
  const status = document.querySelector("#status");
  status.textContent = payload
    ? `${message}\n${JSON.stringify(payload, null, 2)}`
    : message;
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

function getCampaignIdOrFail() {
  if (!state.campaignId) {
    throw new Error("Select a campaign first.");
  }
  return state.campaignId;
}

function numberOrUndefined(value) {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }
  return Number(value);
}

function formatDate(iso) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return String(iso);
  }
  return date.toLocaleString();
}

function renderCampaignState() {
  const node = document.querySelector("#campaign-state");
  if (!state.campaignId) {
    node.textContent = "No campaign selected.";
    return;
  }
  node.textContent = `Selected: ${state.campaignName || state.campaignId} | Role: ${
    state.campaignRole || "unknown"
  } | Session: ${state.campaignState || "unknown"}`;
}

function clearCampaignDashboard() {
  document.querySelector("#campaign-summary-output").textContent = "";
  document.querySelector("#campaign-members").innerHTML = "";
  document.querySelector("#campaign-invites").innerHTML = "";
  document.querySelector("#event-output").textContent = "";
  document.querySelector("#chat-output").textContent = "";
  state.lastEventTimestamp = null;
  state.lastChatTimestamp = null;
}

function renderMemberList(members = []) {
  const node = document.querySelector("#campaign-members");
  node.innerHTML = "";

  if (members.length === 0) {
    node.innerHTML = "<li>No members yet.</li>";
    return;
  }

  for (const member of members) {
    const item = document.createElement("li");
    const emailText = member.email ? ` | ${member.email}` : "";
    item.textContent =
      `${member.displayName} (${member.role})` +
      `${emailText} | userId: ${member.userId}`;
    node.appendChild(item);
  }
}

function renderInviteList(invites = [], pendingInvitesCount = 0) {
  const node = document.querySelector("#campaign-invites");
  node.innerHTML = "";

  if (state.campaignRole !== "GM") {
    node.innerHTML = `<li>Hidden for player role. Pending count: ${pendingInvitesCount}</li>`;
    return;
  }

  if (invites.length === 0) {
    node.innerHTML = "<li>No pending invites.</li>";
    return;
  }

  for (const invite of invites) {
    const item = document.createElement("li");
    item.textContent = `${invite.email} | token: ${invite.token} | expires: ${formatDate(
      invite.expiresAt
    )}`;
    node.appendChild(item);
  }
}

function setSelectedCampaign(campaign) {
  state.campaignId = campaign.id;
  state.campaignName = campaign.name;
  state.campaignState = campaign.sessionState || "idle";
  state.campaignRole = campaign.role || state.campaignRole;
  state.lastEventTimestamp = null;
  state.lastChatTimestamp = null;
  renderCampaignState();
}

function eventQueryPath() {
  const campaignId = getCampaignIdOrFail();
  const params = new URLSearchParams();
  const type = String(document.querySelector("#event-type-filter").value || "").trim();
  const limit = String(document.querySelector("#event-limit").value || "50").trim();

  if (type) {
    params.set("type", type);
  }
  if (limit) {
    params.set("limit", limit);
  }
  return `/api/v1/campaigns/${campaignId}/events?${params.toString()}`;
}

function formatEvent(event) {
  const actor = event.actorUserId || "unknown-user";
  const created = formatDate(event.createdAt);
  const payload = event.payload ? JSON.stringify(event.payload) : "{}";
  return `[${created}] ${event.type} by ${actor} -> ${payload}`;
}

function chatQueryPath() {
  const campaignId = getCampaignIdOrFail();
  const params = new URLSearchParams();
  const visibility = String(
    document.querySelector("#chat-visibility-filter").value || ""
  ).trim();
  const limit = String(document.querySelector("#chat-limit").value || "50").trim();

  if (visibility) {
    params.set("visibility", visibility);
  }
  if (limit) {
    params.set("limit", limit);
  }
  return `/api/v1/campaigns/${campaignId}/chat/messages?${params.toString()}`;
}

function formatChatMessage(message) {
  const created = formatDate(message.createdAt);
  const sender = message.senderDisplayName || message.senderUserId || "unknown";
  if (message.visibility === "PRIVATE") {
    const recipients = message.recipientNames?.length
      ? message.recipientNames.join(", ")
      : message.recipientUserIds.join(", ");
    return `[${created}] [PRIVATE] ${sender} -> ${recipients}: ${message.text}`;
  }
  return `[${created}] [PUBLIC] ${sender}: ${message.text}`;
}

async function loadCampaignSummary() {
  const campaignId = getCampaignIdOrFail();
  const summary = await api(`/api/v1/campaigns/${campaignId}/summary`);

  setSelectedCampaign(summary.campaign);
  document.querySelector("#campaign-summary-output").textContent = JSON.stringify(
    {
      campaign: summary.campaign.name,
      role: summary.campaign.role,
      ruleset: summary.campaign.rulesetId,
      sessionState: summary.campaign.sessionState,
      memberCount: summary.memberCount,
      pendingInvitesCount: summary.pendingInvitesCount
    },
    null,
    2
  );
  renderMemberList(summary.members);
  renderInviteList(summary.pendingInvites, summary.pendingInvitesCount);
}

async function loadEvents() {
  const result = await api(eventQueryPath());
  const events = result.events || [];
  const lines = events.length > 0 ? events.map(formatEvent).join("\n") : "No events.";
  document.querySelector("#event-output").textContent = lines;

  if (events.length > 0) {
    const last = events[events.length - 1];
    state.lastEventTimestamp = last.createdAt || state.lastEventTimestamp;
  }
}

async function loadChatMessages() {
  const result = await api(chatQueryPath());
  const messages = result.messages || [];
  const lines =
    messages.length > 0
      ? messages.map((message) => formatChatMessage(message)).join("\n")
      : "No chat messages.";
  document.querySelector("#chat-output").textContent = lines;

  if (messages.length > 0) {
    const last = messages[messages.length - 1];
    state.lastChatTimestamp = last.createdAt || state.lastChatTimestamp;
  }
}

document.querySelector("#register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);

  try {
    const result = await api("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({
        displayName: form.get("displayName"),
        email: form.get("email"),
        password: form.get("password")
      })
    });

    state.token = result.token;
    state.user = result.user;
    document.querySelector("#auth-state").textContent = `Logged in as ${result.user.displayName}`;
    setStatus("Registered and logged in.");
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);

  try {
    const result = await api("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password")
      })
    });

    state.token = result.token;
    state.user = result.user;
    document.querySelector("#auth-state").textContent = `Logged in as ${result.user.displayName}`;
    setStatus("Logged in.");
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#campaign-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);

  try {
    const result = await api("/api/v1/campaigns", {
      method: "POST",
      body: JSON.stringify({ name: form.get("name") })
    });
    setSelectedCampaign(result.campaign);
    await loadCampaignSummary();
    await loadEvents();
    await loadChatMessages();
    setStatus(`Campaign created and selected: ${result.campaign.name}`);
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#load-campaigns").addEventListener("click", async () => {
  try {
    const result = await api("/api/v1/campaigns");
    const list = document.querySelector("#campaign-list");
    list.innerHTML = "";

    for (const campaign of result.campaigns) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.textContent = `${campaign.name} (${campaign.role}) | session: ${campaign.sessionState}`;
      button.addEventListener("click", async () => {
        try {
          setSelectedCampaign(campaign);
          await loadCampaignSummary();
          await loadEvents();
          await loadChatMessages();
          setStatus(`Selected campaign: ${campaign.name}`);
        } catch (error) {
          setStatus(error.message);
        }
      });
      item.appendChild(button);
      list.appendChild(item);
    }

    if (result.campaigns.length === 0) {
      list.innerHTML = "<li>No campaigns yet.</li>";
    }
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#refresh-summary").addEventListener("click", async () => {
  try {
    await loadCampaignSummary();
    await loadChatMessages();
    setStatus("Campaign dashboard refreshed.");
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#invite-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);

  try {
    const campaignId = getCampaignIdOrFail();
    const result = await api(`/api/v1/campaigns/${campaignId}/invites`, {
      method: "POST",
      body: JSON.stringify({ email: form.get("email") })
    });
    document.querySelector("#invite-output").textContent =
      `Invite created for ${result.invite.email}\n` +
      `Token: ${result.invite.token}\n` +
      `Expires: ${formatDate(result.invite.expiresAt)}`;
    await loadCampaignSummary();
    await loadEvents();
    await loadChatMessages();
    setStatus("Invite created.");
  } catch (error) {
    setStatus(error.message);
  }
});

document
  .querySelector("#accept-invite-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);

    try {
      await api("/api/v1/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token: form.get("token") })
      });
      setStatus("Invite accepted. Load campaigns and select one.");
    } catch (error) {
      setStatus(error.message);
    }
  });

document
  .querySelector("#session-state-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);

    try {
      const campaignId = getCampaignIdOrFail();
      const result = await api(`/api/v1/campaigns/${campaignId}/session/state`, {
        method: "POST",
        body: JSON.stringify({ state: form.get("state") })
      });

      state.campaignState = result.campaign.sessionState;
      renderCampaignState();
      await loadCampaignSummary();
      await loadEvents();
      await loadChatMessages();
      setStatus("Session state updated.", { sessionState: state.campaignState });
    } catch (error) {
      setStatus(error.message);
    }
  });

document
  .querySelector("#character-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);

    try {
      const campaignId = getCampaignIdOrFail();
      const result = await api(`/api/v1/campaigns/${campaignId}/characters/me`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.get("name") || undefined,
          stats: {
            might: numberOrUndefined(form.get("might")),
            agility: numberOrUndefined(form.get("agility")),
            mind: numberOrUndefined(form.get("mind")),
            spirit: numberOrUndefined(form.get("spirit")),
            health: numberOrUndefined(form.get("health")),
            stress: numberOrUndefined(form.get("stress"))
          }
        })
      });
      document.querySelector("#character-output").textContent = JSON.stringify(
        result.character,
        null,
        2
      );
      await loadEvents();
      await loadChatMessages();
      setStatus("Character updated.");
    } catch (error) {
      setStatus(error.message);
    }
  });

document.querySelector("#load-characters").addEventListener("click", async () => {
  try {
    const campaignId = getCampaignIdOrFail();
    const result = await api(`/api/v1/campaigns/${campaignId}/characters`);
    document.querySelector("#character-output").textContent = JSON.stringify(
      result.characters,
      null,
      2
    );
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#roll-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);

  try {
    const campaignId = getCampaignIdOrFail();
    const result = await api(`/api/v1/campaigns/${campaignId}/rolls`, {
      method: "POST",
      body: JSON.stringify({
        pool: Number(form.get("pool")),
        difficulty: Number(form.get("difficulty")),
        label: form.get("label") || ""
      })
    });
    await loadEvents();
    await loadChatMessages();
    setStatus("Roll completed.", result.result);
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);

  try {
    const campaignId = getCampaignIdOrFail();
    const visibility = String(form.get("visibility") || "PUBLIC").toUpperCase();
    const recipientUserId = String(form.get("recipientUserId") || "").trim();

    const body = {
      text: String(form.get("text") || "").trim(),
      visibility
    };

    if (visibility === "PRIVATE" && recipientUserId) {
      body.recipientUserIds = [recipientUserId];
    }

    const result = await api(`/api/v1/campaigns/${campaignId}/chat/messages`, {
      method: "POST",
      body: JSON.stringify(body)
    });

    await loadChatMessages();
    setStatus("Chat message sent.", result.message);
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#load-chat").addEventListener("click", async () => {
  try {
    await loadChatMessages();
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#load-events").addEventListener("click", async () => {
  try {
    await loadEvents();
  } catch (error) {
    setStatus(error.message);
  }
});

renderCampaignState();
clearCampaignDashboard();
setStatus("Ready. Register or login first.");
