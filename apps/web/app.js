const state = {
  token: null,
  user: null,
  currentPage: "connection",
  selectedCampaignId: null,
  selectedCampaignName: null,
  selectedCampaignState: null,
  selectedCampaignRole: null,
  realtimeSource: null,
  realtimePrefix: null,
  realtimeCampaignId: null,
  realtimeInFlight: false
};

function el(id) {
  return document.getElementById(id);
}

function expectedRole(prefix) {
  return prefix === "master" ? "GM" : "PLAYER";
}

function setStatus(message, payload) {
  const node = el("status");
  node.textContent = payload
    ? `${message}\n${JSON.stringify(payload, null, 2)}`
    : message;
}

function setWelcomeUser() {
  const node = el("welcome-user");
  if (!state.user) {
    node.textContent = "";
    return;
  }
  node.textContent = `Logged in as ${state.user.displayName} (${state.user.email})`;
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

function getActivePrefix() {
  if (state.currentPage === "player" || state.currentPage === "master") {
    return state.currentPage;
  }
  return null;
}

function hasValidSelectionFor(prefix) {
  return (
    Boolean(state.selectedCampaignId) &&
    state.selectedCampaignRole === expectedRole(prefix)
  );
}

function clearCampaignSelection() {
  state.selectedCampaignId = null;
  state.selectedCampaignName = null;
  state.selectedCampaignState = null;
  state.selectedCampaignRole = null;
}

function renderCampaignState(prefix) {
  const node = el(`${prefix}-campaign-state`);
  if (!node) {
    return;
  }
  if (!hasValidSelectionFor(prefix)) {
    node.textContent = "No campaign selected.";
    return;
  }
  node.textContent =
    `Selected: ${state.selectedCampaignName} | ` +
    `Role: ${state.selectedCampaignRole} | ` +
    `Session: ${state.selectedCampaignState || "unknown"}`;
}

function renderAutoRefreshState(prefix) {
  const node = el(`${prefix}-auto-refresh-state`);
  if (!node) {
    return;
  }
  if (!state.token) {
    node.textContent = "Auto-refresh: off (login first).";
    return;
  }
  if (!hasValidSelectionFor(prefix)) {
    node.textContent = "Auto-refresh: off (select a campaign first).";
    return;
  }
  if (
    state.realtimeSource &&
    state.realtimePrefix === prefix &&
    state.realtimeCampaignId === state.selectedCampaignId
  ) {
    if (state.realtimeSource.readyState === EventSource.OPEN) {
      node.textContent = "Auto-refresh: on (server push for events/chat).";
    } else if (state.realtimeSource.readyState === EventSource.CONNECTING) {
      node.textContent = "Auto-refresh: reconnecting...";
    } else {
      node.textContent = "Auto-refresh: off.";
    }
    return;
  }
  if (typeof EventSource === "undefined") {
    node.textContent = "Auto-refresh: off (browser does not support SSE).";
    return;
  }
  node.textContent = "Auto-refresh: off.";
}

function renderRoleStates() {
  renderCampaignState("player");
  renderCampaignState("master");
  renderAutoRefreshState("player");
  renderAutoRefreshState("master");
}

function showPage(pageName) {
  for (const page of document.querySelectorAll(".page")) {
    page.classList.toggle("page--active", page.dataset.page === pageName);
  }
  state.currentPage = pageName;
  ensureRealtimeStream();
  renderRoleStates();
}

function clearRoleOutputs(prefix) {
  const summary = el(`${prefix}-summary-output`);
  const members = el(`${prefix}-members-output`);
  const invites = el(`${prefix}-invites-output`);
  const events = el(`${prefix}-events-output`);
  const chat = el(`${prefix}-chat-output`);
  const inviteOut = el(`${prefix}-invite-output`);
  const chars = el(`${prefix}-character-output`);
  if (summary) summary.textContent = "";
  if (members) members.innerHTML = "";
  if (invites) invites.innerHTML = "";
  if (events) events.textContent = "";
  if (chat) chat.textContent = "";
  if (inviteOut) inviteOut.textContent = "";
  if (chars) chars.textContent = "";
}

function signOut() {
  state.token = null;
  state.user = null;
  clearCampaignSelection();
  stopRealtimeStream();
  setWelcomeUser();
  clearRoleOutputs("player");
  clearRoleOutputs("master");
  renderRoleStates();
  showPage("connection");
  setStatus("Logged out.");
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

function currentCampaignId(prefix) {
  if (!hasValidSelectionFor(prefix)) {
    throw new Error("Select a campaign first.");
  }
  return state.selectedCampaignId;
}

function eventQueryPath(prefix) {
  const campaignId = currentCampaignId(prefix);
  const params = new URLSearchParams();
  const type = String(el(`${prefix}-event-type-filter`)?.value || "").trim();
  const limit = String(el(`${prefix}-event-limit`)?.value || "50").trim();
  if (type) params.set("type", type);
  if (limit) params.set("limit", limit);
  return `/api/v1/campaigns/${campaignId}/events?${params.toString()}`;
}

function chatQueryPath(prefix) {
  const campaignId = currentCampaignId(prefix);
  const params = new URLSearchParams();
  const visibility = String(el(`${prefix}-chat-visibility-filter`)?.value || "").trim();
  const limit = String(el(`${prefix}-chat-limit`)?.value || "50").trim();
  if (visibility) params.set("visibility", visibility);
  if (limit) params.set("limit", limit);
  return `/api/v1/campaigns/${campaignId}/chat/messages?${params.toString()}`;
}

function formatEvent(entry) {
  return `[${formatDate(entry.createdAt)}] ${entry.type} by ${
    entry.actorUserId
  } -> ${JSON.stringify(entry.payload || {})}`;
}

function formatChat(entry) {
  if (entry.visibility === "PRIVATE") {
    const recipients =
      entry.recipientNames?.length > 0
        ? entry.recipientNames.join(", ")
        : entry.recipientUserIds.join(", ");
    return `[${formatDate(entry.createdAt)}] [PRIVATE] ${entry.senderDisplayName} -> ${recipients}: ${entry.text}`;
  }
  return `[${formatDate(entry.createdAt)}] [PUBLIC] ${entry.senderDisplayName}: ${entry.text}`;
}

function stopRealtimeStream() {
  if (state.realtimeSource) {
    state.realtimeSource.close();
    state.realtimeSource = null;
  }
  state.realtimePrefix = null;
  state.realtimeCampaignId = null;
  state.realtimeInFlight = false;
  renderRoleStates();
}

async function refreshRealtimeSilently(prefix = state.realtimePrefix) {
  if (
    state.realtimeInFlight ||
    !prefix ||
    !hasValidSelectionFor(prefix) ||
    getActivePrefix() !== prefix
  ) {
    return;
  }
  state.realtimeInFlight = true;
  try {
    await Promise.all([
      loadEvents(prefix, true),
      loadChatMessages(prefix, true)
    ]);
  } catch {
    // Keep stream alive on transient refresh failures.
  } finally {
    state.realtimeInFlight = false;
  }
}

function ensureRealtimeStream() {
  const prefix = getActivePrefix();
  if (!prefix || !state.token || !hasValidSelectionFor(prefix)) {
    stopRealtimeStream();
    return;
  }
  const campaignId = state.selectedCampaignId;
  if (
    state.realtimeSource &&
    state.realtimePrefix === prefix &&
    state.realtimeCampaignId === campaignId
  ) {
    renderRoleStates();
    return;
  }
  stopRealtimeStream();
  if (typeof EventSource === "undefined") {
    renderRoleStates();
    return;
  }

  const params = new URLSearchParams({ token: state.token });
  const source = new EventSource(
    `/api/v1/campaigns/${campaignId}/stream?${params.toString()}`
  );
  source.addEventListener("session_event", () => {
    refreshRealtimeSilently(prefix);
  });
  source.addEventListener("chat_message", () => {
    refreshRealtimeSilently(prefix);
  });
  source.addEventListener("connected", () => {
    refreshRealtimeSilently(prefix);
  });
  source.onerror = () => {
    renderRoleStates();
  };
  state.realtimeSource = source;
  state.realtimePrefix = prefix;
  state.realtimeCampaignId = campaignId;
  renderRoleStates();
  refreshRealtimeSilently(prefix);
}

async function loadCampaigns(prefix) {
  const result = await api("/api/v1/campaigns");
  const targetRole = expectedRole(prefix);
  const campaigns = result.campaigns.filter((entry) => entry.role === targetRole);
  const list = el(`${prefix}-campaign-list`);
  list.innerHTML = "";

  if (campaigns.length === 0) {
    list.innerHTML = `<li>No ${prefix} campaigns found.</li>`;
    return;
  }

  for (const campaign of campaigns) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.textContent = `${campaign.name} | session: ${campaign.sessionState}`;
    button.type = "button";
    button.addEventListener("click", async () => {
      try {
        setSelectedCampaign(campaign);
        await refreshRoleData(prefix);
        setStatus(`Selected ${prefix} campaign: ${campaign.name}`);
      } catch (error) {
        setStatus(error.message);
      }
    });
    item.appendChild(button);
    list.appendChild(item);
  }
}

function setSelectedCampaign(campaign) {
  state.selectedCampaignId = campaign.id;
  state.selectedCampaignName = campaign.name;
  state.selectedCampaignState = campaign.sessionState || "idle";
  state.selectedCampaignRole = campaign.role;
  renderRoleStates();
  ensureRealtimeStream();
}

function renderMembers(prefix, members) {
  const node = el(`${prefix}-members-output`);
  if (!node) return;
  node.innerHTML = "";
  if (!members || members.length === 0) {
    node.innerHTML = "<li>No members.</li>";
    return;
  }
  for (const member of members) {
    const item = document.createElement("li");
    const email = member.email ? ` | ${member.email}` : "";
    item.textContent = `${member.displayName} (${member.role})${email} | userId: ${member.userId}`;
    node.appendChild(item);
  }
}

function renderInvites(prefix, pendingInvites = [], pendingCount = 0) {
  const node = el(`${prefix}-invites-output`);
  if (!node) return;
  node.innerHTML = "";
  if (prefix !== "master") {
    return;
  }
  if (pendingInvites.length === 0) {
    node.innerHTML = `<li>No pending invites. Count: ${pendingCount}</li>`;
    return;
  }
  for (const invite of pendingInvites) {
    const item = document.createElement("li");
    item.textContent = `${invite.email} | token: ${invite.token} | expires: ${formatDate(invite.expiresAt)}`;
    node.appendChild(item);
  }
}

function setFormValue(form, name, value) {
  const field = form.elements.namedItem(name);
  if (!field) {
    return;
  }
  field.value = value === undefined || value === null ? "" : String(value);
}

function populatePlayerCharacterForm(character) {
  const form = el("player-character-form");
  if (!form || !character) {
    return;
  }
  setFormValue(form, "name", character.name || "");
  setFormValue(form, "notes", character.notes || "");

  const stats = character.stats || {};
  setFormValue(form, "might", stats.might);
  setFormValue(form, "agility", stats.agility);
  setFormValue(form, "mind", stats.mind);
  setFormValue(form, "spirit", stats.spirit);
  setFormValue(form, "health", stats.health);
  setFormValue(form, "stress", stats.stress);
}

async function loadPlayerCharacters(silent = false) {
  const campaignId = currentCampaignId("player");
  const result = await api(`/api/v1/campaigns/${campaignId}/characters`);
  el("player-character-output").textContent = JSON.stringify(
    result.characters,
    null,
    2
  );

  if (result.characters?.length > 0) {
    const myCharacter =
      result.characters.find((entry) => entry.userId === state.user?.id) ||
      result.characters[0];
    populatePlayerCharacterForm(myCharacter);
  }

  if (!silent) {
    setStatus("Characters loaded.");
  }

  return result.characters;
}

async function loadSummary(prefix) {
  const campaignId = currentCampaignId(prefix);
  const summary = await api(`/api/v1/campaigns/${campaignId}/summary`);
  state.selectedCampaignName = summary.campaign.name;
  state.selectedCampaignState = summary.campaign.sessionState || state.selectedCampaignState;
  state.selectedCampaignRole = summary.campaign.role || state.selectedCampaignRole;
  renderRoleStates();

  el(`${prefix}-summary-output`).textContent = JSON.stringify(
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
  renderMembers(prefix, summary.members);
  renderInvites(prefix, summary.pendingInvites, summary.pendingInvitesCount);
}

async function loadEvents(prefix, silent = false) {
  const result = await api(eventQueryPath(prefix));
  const lines =
    result.events?.length > 0
      ? result.events.map((entry) => formatEvent(entry)).join("\n")
      : "No events.";
  el(`${prefix}-events-output`).textContent = lines;
  if (!silent) {
    setStatus("Events refreshed.");
  }
}

async function loadChatMessages(prefix, silent = false) {
  const result = await api(chatQueryPath(prefix));
  const lines =
    result.messages?.length > 0
      ? result.messages.map((entry) => formatChat(entry)).join("\n")
      : "No chat messages.";
  el(`${prefix}-chat-output`).textContent = lines;
  if (!silent) {
    setStatus("Chat refreshed.");
  }
}

async function refreshRoleData(prefix) {
  await loadSummary(prefix);
  await loadEvents(prefix, true);
  await loadChatMessages(prefix, true);
  if (prefix === "player") {
    await loadPlayerCharacters(true);
  }
  ensureRealtimeStream();
}

function attachAuthHandlers() {
  el("go-signup").addEventListener("click", () => {
    showPage("signup");
  });

  el("back-to-connection").addEventListener("click", () => {
    showPage("connection");
  });

  el("discord-signin").addEventListener("click", () => {
    setStatus("Discord sign-in is planned, but not wired in this MVP.");
  });

  el("login-form").addEventListener("submit", async (event) => {
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
      setWelcomeUser();
      showPage("welcome");
      setStatus("Logged in.");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("register-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const result = await api("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password")
        })
      });
      state.token = result.token;
      state.user = result.user;
      setWelcomeUser();
      showPage("welcome");
      setStatus("Account created.");
    } catch (error) {
      setStatus(error.message);
    }
  });
}

function attachWelcomeHandlers() {
  el("enter-player").addEventListener("click", async () => {
    try {
      showPage("player");
      if (!hasValidSelectionFor("player")) {
        clearCampaignSelection();
        clearRoleOutputs("player");
      }
      await loadCampaigns("player");
      ensureRealtimeStream();
      setStatus("Player view opened.");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("enter-master").addEventListener("click", async () => {
    try {
      showPage("master");
      if (!hasValidSelectionFor("master")) {
        clearCampaignSelection();
        clearRoleOutputs("master");
      }
      await loadCampaigns("master");
      ensureRealtimeStream();
      setStatus("Master view opened.");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("logout-from-welcome").addEventListener("click", signOut);
}

function attachPlayerHandlers() {
  el("player-back-welcome").addEventListener("click", () => showPage("welcome"));
  el("player-logout").addEventListener("click", signOut);

  el("player-load-campaigns").addEventListener("click", async () => {
    try {
      await loadCampaigns("player");
      setStatus("Player campaigns loaded.");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("player-accept-invite-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      await api("/api/v1/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token: form.get("token") })
      });
      await loadCampaigns("player");
      setStatus("Invite accepted.");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("player-refresh-summary").addEventListener("click", async () => {
    try {
      await refreshRoleData("player");
      setStatus("Player summary refreshed.");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("player-character-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const campaignId = currentCampaignId("player");
      const payload = {};
      const name = String(form.get("name") || "").trim();
      const notes = String(form.get("notes") || "");
      if (name) {
        payload.name = name;
      }
      payload.notes = notes;

      const statNames = ["might", "agility", "mind", "spirit", "health", "stress"];
      const statValues = Object.fromEntries(
        statNames.map((key) => [key, String(form.get(key) || "").trim()])
      );
      const hasAnyStat = statNames.some((key) => statValues[key] !== "");
      if (hasAnyStat) {
        const hasAllStats = statNames.every((key) => statValues[key] !== "");
        if (!hasAllStats) {
          throw new Error("Fill all stat fields to update stats.");
        }
        payload.stats = Object.fromEntries(
          statNames.map((key) => [key, Number(statValues[key])])
        );
      }

      const result = await api(`/api/v1/campaigns/${campaignId}/characters/me`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      populatePlayerCharacterForm(result.character);
      el("player-character-output").textContent = JSON.stringify(
        result.character,
        null,
        2
      );
      await Promise.all([loadEvents("player", true), loadChatMessages("player", true)]);
      setStatus("Character updated.");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("player-load-characters").addEventListener("click", async () => {
    try {
      await loadPlayerCharacters();
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("player-roll-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const campaignId = currentCampaignId("player");
      const result = await api(`/api/v1/campaigns/${campaignId}/rolls`, {
        method: "POST",
        body: JSON.stringify({
          pool: Number(form.get("pool")),
          difficulty: Number(form.get("difficulty")),
          label: form.get("label") || ""
        })
      });
      await Promise.all([loadEvents("player", true), loadChatMessages("player", true)]);
      setStatus("Roll completed.", result.result);
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("player-load-events").addEventListener("click", async () => {
    try {
      await loadEvents("player");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("player-chat-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const campaignId = currentCampaignId("player");
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
      await loadChatMessages("player", true);
      setStatus("Chat message sent.", result.message);
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("player-load-chat").addEventListener("click", async () => {
    try {
      await loadChatMessages("player");
    } catch (error) {
      setStatus(error.message);
    }
  });
}

function attachMasterHandlers() {
  el("master-back-welcome").addEventListener("click", () => showPage("welcome"));
  el("master-logout").addEventListener("click", signOut);

  for (const button of document.querySelectorAll("[data-master-action]")) {
    button.addEventListener("click", () => {
      setStatus(`Master action selected: ${button.dataset.masterAction}`);
    });
  }

  el("master-create-campaign-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const result = await api("/api/v1/campaigns", {
        method: "POST",
        body: JSON.stringify({ name: form.get("name") })
      });
      setSelectedCampaign(result.campaign);
      await Promise.all([loadCampaigns("master"), refreshRoleData("master")]);
      setStatus("Campaign hosted.");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("master-load-campaigns").addEventListener("click", async () => {
    try {
      await loadCampaigns("master");
      setStatus("Master campaigns loaded.");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("master-refresh-summary").addEventListener("click", async () => {
    try {
      await refreshRoleData("master");
      setStatus("Master summary refreshed.");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("master-invite-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const campaignId = currentCampaignId("master");
      const result = await api(`/api/v1/campaigns/${campaignId}/invites`, {
        method: "POST",
        body: JSON.stringify({ email: form.get("email") })
      });
      el("master-invite-output").textContent =
        `Invite created for ${result.invite.email}\n` +
        `Token: ${result.invite.token}\n` +
        `Expires: ${formatDate(result.invite.expiresAt)}`;
      await refreshRoleData("master");
      setStatus("Invite created.");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("master-session-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const campaignId = currentCampaignId("master");
      const result = await api(`/api/v1/campaigns/${campaignId}/session/state`, {
        method: "POST",
        body: JSON.stringify({ state: form.get("state") })
      });
      state.selectedCampaignState = result.campaign.sessionState;
      await refreshRoleData("master");
      setStatus("Session state updated.");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("master-load-events").addEventListener("click", async () => {
    try {
      await loadEvents("master");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("master-chat-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const campaignId = currentCampaignId("master");
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
      await loadChatMessages("master", true);
      setStatus("Chat message sent.", result.message);
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("master-load-chat").addEventListener("click", async () => {
    try {
      await loadChatMessages("master");
    } catch (error) {
      setStatus(error.message);
    }
  });
}

function initialize() {
  attachAuthHandlers();
  attachWelcomeHandlers();
  attachPlayerHandlers();
  attachMasterHandlers();
  showPage("connection");
  setWelcomeUser();
  renderRoleStates();
  setStatus("Ready. Login first.");
}

window.addEventListener("beforeunload", () => {
  stopRealtimeStream();
});

initialize();
