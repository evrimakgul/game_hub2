const MASTER_ACTION = {
  HOST: "Host a New Game",
  CREATE_RULESET: "Create a New Ruleset",
  MY_RULESETS: "My Rulesets",
  PASSIVE_OLD_GAMES: "Passive / Old Games",
  ACTIVE_GAMES: "Active Games"
};

const MASTER_PASSIVE_STATES = new Set(["idle", "paused", "ended"]);
const RULESET_DRAFTS_STORAGE_KEY = "gamehub.masterRulesetDrafts.v1";
const PLAYER_LAYOUT_DRAFTS_STORAGE_KEY = "gamehub.playerLayoutDrafts.v1";
const PLAYER_LAYOUT_DRAFT_FIELDS = [
  "bioPronouns",
  "bioArchetype",
  "combatInitiative",
  "combatDefense",
  "combatArmor",
  "skills",
  "powers",
  "equipment",
  "meritsFlaws",
  "connections",
  "inventory"
];

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
  realtimeInFlight: false,
  masterAction: MASTER_ACTION.HOST,
  masterCampaignFilter: "all",
  masterCampaignCache: [],
  masterRulesetDrafts: [],
  masterEditingDraftId: null,
  masterPreviewDraftId: null,
  playerLayoutDrafts: {}
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

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadMasterRulesetDrafts() {
  try {
    const raw = localStorage.getItem(RULESET_DRAFTS_STORAGE_KEY);
    if (!raw) {
      state.masterRulesetDrafts = [];
      state.masterPreviewDraftId = null;
      return;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      state.masterRulesetDrafts = [];
      state.masterPreviewDraftId = null;
      return;
    }
    state.masterRulesetDrafts = parsed
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({
        id: String(entry.id || createClientId()),
        name: String(entry.name || "").trim(),
        theme: String(entry.theme || "").trim(),
        defaultDifficulty: Number(entry.defaultDifficulty) || 6,
        notes: String(entry.notes || ""),
        createdAt: String(entry.createdAt || new Date().toISOString()),
        updatedAt: String(
          entry.updatedAt || entry.createdAt || new Date().toISOString()
        )
      }))
      .filter((entry) => entry.name);
    if (state.masterRulesetDrafts.length > 0) {
      state.masterPreviewDraftId = state.masterRulesetDrafts[0].id;
    } else {
      state.masterPreviewDraftId = null;
    }
  } catch {
    state.masterRulesetDrafts = [];
    state.masterPreviewDraftId = null;
  }
}

function saveMasterRulesetDrafts() {
  try {
    localStorage.setItem(
      RULESET_DRAFTS_STORAGE_KEY,
      JSON.stringify(state.masterRulesetDrafts)
    );
  } catch {
    // Ignore storage failures (private mode/quota).
  }
}

function findMasterRulesetDraftById(draftId) {
  return state.masterRulesetDrafts.find((entry) => entry.id === draftId) || null;
}

function renderMasterRulesetDraftFormMode() {
  const submit = el("master-ruleset-draft-submit");
  const cancel = el("master-ruleset-draft-cancel");
  const mode = el("master-ruleset-draft-mode");
  const editingDraft = state.masterEditingDraftId
    ? findMasterRulesetDraftById(state.masterEditingDraftId)
    : null;

  if (submit) {
    submit.textContent = editingDraft ? "Update Draft" : "Save Draft";
  }
  if (cancel) {
    cancel.classList.toggle("hidden", !editingDraft);
  }
  if (mode) {
    mode.textContent = editingDraft
      ? `Mode: editing "${editingDraft.name}".`
      : "Mode: creating new draft.";
  }
}

function resetMasterRulesetDraftForm() {
  const form = el("master-ruleset-draft-form");
  if (!form) {
    return;
  }
  form.reset();
  const difficultyField = form.elements.namedItem("defaultDifficulty");
  if (difficultyField) {
    difficultyField.value = "6";
  }
  state.masterEditingDraftId = null;
  renderMasterRulesetDraftFormMode();
}

function openMasterRulesetDraftEditor(draftId) {
  const draft = findMasterRulesetDraftById(draftId);
  const form = el("master-ruleset-draft-form");
  if (!draft || !form) {
    return false;
  }
  setFormValue(form, "name", draft.name);
  setFormValue(form, "theme", draft.theme);
  setFormValue(form, "defaultDifficulty", draft.defaultDifficulty);
  setFormValue(form, "notes", draft.notes);
  state.masterEditingDraftId = draft.id;
  renderMasterRulesetDraftFormMode();
  return true;
}

function renderMasterRulesetDraftPreview() {
  const node = el("master-ruleset-draft-preview");
  if (!node) {
    return;
  }
  if (state.masterRulesetDrafts.length === 0) {
    node.textContent = "No draft selected.";
    return;
  }

  let draft = state.masterPreviewDraftId
    ? findMasterRulesetDraftById(state.masterPreviewDraftId)
    : null;
  if (!draft) {
    draft = [...state.masterRulesetDrafts].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    )[0];
    state.masterPreviewDraftId = draft?.id || null;
  }

  if (!draft) {
    node.textContent = "No draft selected.";
    return;
  }

  node.textContent = JSON.stringify(
    {
      id: draft.id,
      name: draft.name,
      theme: draft.theme,
      defaultDifficulty: draft.defaultDifficulty,
      notes: draft.notes,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt || draft.createdAt
    },
    null,
    2
  );
}

function playerLayoutDraftKey(campaignId, userId) {
  return `${userId}:${campaignId}`;
}

function loadPlayerLayoutDrafts() {
  try {
    const raw = localStorage.getItem(PLAYER_LAYOUT_DRAFTS_STORAGE_KEY);
    if (!raw) {
      state.playerLayoutDrafts = {};
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      state.playerLayoutDrafts = {};
      return;
    }
    state.playerLayoutDrafts = parsed;
  } catch {
    state.playerLayoutDrafts = {};
  }
}

function savePlayerLayoutDrafts() {
  try {
    localStorage.setItem(
      PLAYER_LAYOUT_DRAFTS_STORAGE_KEY,
      JSON.stringify(state.playerLayoutDrafts)
    );
  } catch {
    // Ignore storage failures (private mode/quota).
  }
}

function currentPlayerLayoutDraftKey() {
  if (!state.user?.id || !state.selectedCampaignId) {
    return null;
  }
  return playerLayoutDraftKey(state.selectedCampaignId, state.user.id);
}

function collectPlayerLayoutDraftFields(form) {
  const draft = {};
  for (const name of PLAYER_LAYOUT_DRAFT_FIELDS) {
    draft[name] = String(form.elements.namedItem(name)?.value || "");
  }
  return draft;
}

function applyPlayerLayoutDraftToForm(form, draft) {
  for (const name of PLAYER_LAYOUT_DRAFT_FIELDS) {
    setFormValue(form, name, draft?.[name] || "");
  }
}

function renderPlayerLayoutDraftState(message = "") {
  const node = el("player-layout-draft-state");
  if (!node) {
    return;
  }
  if (!state.selectedCampaignId) {
    node.textContent = "Local layout draft: select a campaign first.";
    return;
  }
  node.textContent = message || "Local layout draft: ready.";
}

function loadCurrentPlayerLayoutDraftIntoForm() {
  const form = el("player-character-form");
  if (!form) {
    return;
  }
  const key = currentPlayerLayoutDraftKey();
  if (!key) {
    applyPlayerLayoutDraftToForm(form, {});
    renderPlayerLayoutDraftState("Local layout draft: select a campaign first.");
    return;
  }
  const draft = state.playerLayoutDrafts[key];
  if (!draft) {
    applyPlayerLayoutDraftToForm(form, {});
    renderPlayerLayoutDraftState("Local layout draft: none saved yet.");
    return;
  }
  applyPlayerLayoutDraftToForm(form, draft);
  const savedAt = draft.savedAt ? ` (${formatDate(draft.savedAt)})` : "";
  renderPlayerLayoutDraftState(`Local layout draft loaded${savedAt}.`);
}

function saveCurrentPlayerLayoutDraft() {
  const form = el("player-character-form");
  const key = currentPlayerLayoutDraftKey();
  if (!form || !key) {
    throw new Error("Select a campaign first.");
  }
  const fields = collectPlayerLayoutDraftFields(form);
  state.playerLayoutDrafts[key] = {
    ...fields,
    savedAt: new Date().toISOString()
  };
  savePlayerLayoutDrafts();
  renderPlayerLayoutDraftState(
    `Local layout draft saved (${formatDate(state.playerLayoutDrafts[key].savedAt)}).`
  );
}

function clearCurrentPlayerLayoutDraft() {
  const form = el("player-character-form");
  const key = currentPlayerLayoutDraftKey();
  if (!form || !key) {
    throw new Error("Select a campaign first.");
  }
  delete state.playerLayoutDrafts[key];
  savePlayerLayoutDrafts();
  applyPlayerLayoutDraftToForm(form, {});
  renderPlayerLayoutDraftState("Local layout draft cleared.");
}

function campaignMatchesMasterFilter(campaign) {
  if (state.masterCampaignFilter === "active") {
    return campaign.sessionState === "active";
  }
  if (state.masterCampaignFilter === "passive") {
    return MASTER_PASSIVE_STATES.has(String(campaign.sessionState || "idle"));
  }
  return true;
}

function isSelectedCampaignForPrefix(prefix, campaignId) {
  return (
    Boolean(state.selectedCampaignId) &&
    state.selectedCampaignId === campaignId &&
    state.selectedCampaignRole === expectedRole(prefix)
  );
}

function applyCampaignButtonState(button, prefix) {
  if (!button) {
    return;
  }
  const campaignId = String(button.dataset.campaignId || "");
  const baseLabel = String(button.dataset.baseLabel || button.textContent || "");
  button.dataset.baseLabel = baseLabel;
  const selected = isSelectedCampaignForPrefix(prefix, campaignId);
  button.classList.toggle("is-selected", selected);
  button.textContent = selected ? `${baseLabel} [selected]` : baseLabel;
}

function renderCampaignListSelection(prefix) {
  const list = el(`${prefix}-campaign-list`);
  if (!list) {
    return;
  }
  for (const button of list.querySelectorAll("button[data-campaign-id]")) {
    applyCampaignButtonState(button, prefix);
  }
}

function renderEventQuickFilterState(prefix) {
  const row = document.querySelector(`[data-event-quick-prefix="${prefix}"]`);
  if (!row) {
    return;
  }
  const selectedType = String(el(`${prefix}-event-type-filter`)?.value || "");
  for (const button of row.querySelectorAll("button[data-event-type]")) {
    button.classList.toggle(
      "is-active",
      String(button.dataset.eventType || "") === selectedType
    );
  }
}

function attachEventQuickFilters(prefix) {
  const row = document.querySelector(`[data-event-quick-prefix="${prefix}"]`);
  if (!row) {
    return;
  }

  for (const button of row.querySelectorAll("button[data-event-type]")) {
    button.addEventListener("click", async () => {
      const type = String(button.dataset.eventType || "");
      const select = el(`${prefix}-event-type-filter`);
      if (select) {
        select.value = type;
      }
      renderEventQuickFilterState(prefix);
      try {
        await loadEvents(prefix);
      } catch (error) {
        setStatus(error.message);
      }
    });
  }

  const select = el(`${prefix}-event-type-filter`);
  select?.addEventListener("change", () => renderEventQuickFilterState(prefix));
  renderEventQuickFilterState(prefix);
}

function renderMasterActionButtons() {
  for (const button of document.querySelectorAll("[data-master-action]")) {
    button.classList.toggle(
      "is-active",
      button.dataset.masterAction === state.masterAction
    );
  }
}

function setMasterWorkspacePanel(panelKey) {
  for (const panel of document.querySelectorAll("[data-master-panel]")) {
    panel.classList.toggle("master-panel--active", panel.dataset.masterPanel === panelKey);
  }
}

function renderMasterCampaignBucket(listId, campaigns, emptyText) {
  const node = el(listId);
  if (!node) {
    return;
  }
  node.innerHTML = "";
  if (!campaigns || campaigns.length === 0) {
    node.innerHTML = `<li>${emptyText}</li>`;
    return;
  }
  for (const campaign of campaigns) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.campaignId = campaign.id;
    button.dataset.baseLabel = `${campaign.name} | session: ${campaign.sessionState}`;
    applyCampaignButtonState(button, "master");
    button.addEventListener("click", async () => {
      try {
        setSelectedCampaign(campaign);
        await refreshRoleData("master");
        setStatus(`Selected master campaign: ${campaign.name}`);
      } catch (error) {
        setStatus(error.message);
      }
    });
    item.appendChild(button);
    node.appendChild(item);
  }
}

function renderMasterRulesetUsage() {
  const node = el("master-ruleset-usage-list");
  if (!node) {
    return;
  }
  node.innerHTML = "";

  if (state.masterCampaignCache.length === 0) {
    node.innerHTML = "<li>Load campaigns to see ruleset usage.</li>";
    return;
  }

  const usage = new Map();
  for (const campaign of state.masterCampaignCache) {
    const key = String(campaign.rulesetId || "unknown");
    if (!usage.has(key)) {
      usage.set(key, { count: 0, activeCount: 0 });
    }
    const row = usage.get(key);
    row.count += 1;
    if (campaign.sessionState === "active") {
      row.activeCount += 1;
    }
  }

  const entries = [...usage.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [rulesetId, row] of entries) {
    const item = document.createElement("li");
    item.textContent = `${rulesetId} | campaigns: ${row.count} | active: ${row.activeCount}`;
    node.appendChild(item);
  }
}

function renderMasterRulesetDrafts() {
  const node = el("master-ruleset-draft-list");
  if (!node) {
    return;
  }
  node.innerHTML = "";
  renderMasterRulesetDraftFormMode();

  if (state.masterRulesetDrafts.length === 0) {
    state.masterPreviewDraftId = null;
    state.masterEditingDraftId = null;
    renderMasterRulesetDraftFormMode();
    node.innerHTML = "<li>No local drafts yet.</li>";
    renderMasterRulesetDraftPreview();
    return;
  }

  const drafts = [...state.masterRulesetDrafts].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
  );

  for (const draft of drafts) {
    const item = document.createElement("li");
    const details = document.createElement("span");
    const theme = draft.theme ? ` | theme: ${draft.theme}` : "";
    const updated =
      draft.updatedAt && draft.updatedAt !== draft.createdAt
        ? ` | updated: ${formatDate(draft.updatedAt)}`
        : "";
    details.textContent =
      `${draft.name}${theme} | default difficulty: ${draft.defaultDifficulty} | ` +
      `created: ${formatDate(draft.createdAt)}${updated}`;

    const actions = document.createElement("div");
    actions.className = "draft-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "ghost";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => {
      const opened = openMasterRulesetDraftEditor(draft.id);
      if (opened) {
        state.masterPreviewDraftId = draft.id;
        renderMasterRulesetDrafts();
        setStatus(`Editing draft: ${draft.name}`);
      }
    });

    const duplicateButton = document.createElement("button");
    duplicateButton.type = "button";
    duplicateButton.className = "ghost";
    duplicateButton.textContent = "Duplicate";
    duplicateButton.addEventListener("click", () => {
      const now = new Date().toISOString();
      const copy = {
        ...draft,
        id: createClientId(),
        name: `${draft.name} (Copy)`,
        createdAt: now,
        updatedAt: now
      };
      state.masterRulesetDrafts.push(copy);
      state.masterPreviewDraftId = copy.id;
      saveMasterRulesetDrafts();
      renderMasterRulesetDrafts();
      setStatus(`Duplicated draft: ${copy.name}`);
    });

    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "ghost";
    previewButton.textContent = "Preview";
    previewButton.classList.toggle("is-active", draft.id === state.masterPreviewDraftId);
    previewButton.addEventListener("click", () => {
      state.masterPreviewDraftId = draft.id;
      renderMasterRulesetDrafts();
      setStatus(`Previewing draft: ${draft.name}`);
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "ghost";
    removeButton.textContent = "Delete";
    removeButton.addEventListener("click", () => {
      state.masterRulesetDrafts = state.masterRulesetDrafts.filter(
        (entry) => entry.id !== draft.id
      );
      if (state.masterEditingDraftId === draft.id) {
        resetMasterRulesetDraftForm();
      }
      if (state.masterPreviewDraftId === draft.id) {
        state.masterPreviewDraftId = null;
      }
      saveMasterRulesetDrafts();
      renderMasterRulesetDrafts();
      setStatus(`Deleted draft: ${draft.name}`);
    });

    actions.appendChild(editButton);
    actions.appendChild(duplicateButton);
    actions.appendChild(previewButton);
    actions.appendChild(removeButton);
    item.appendChild(details);
    item.appendChild(actions);
    node.appendChild(item);
  }

  renderMasterRulesetDraftPreview();
}

function renderMasterWorkspace() {
  const title = el("master-workspace-title");
  if (!title) {
    return;
  }

  renderMasterActionButtons();

  if (state.masterAction === MASTER_ACTION.ACTIVE_GAMES) {
    title.textContent = "Showing only active campaigns.";
    setMasterWorkspacePanel("active");
    renderMasterCampaignBucket(
      "master-active-games-list",
      state.masterCampaignCache.filter((entry) => entry.sessionState === "active"),
      "No active games."
    );
    return;
  }

  if (state.masterAction === MASTER_ACTION.PASSIVE_OLD_GAMES) {
    title.textContent = "Showing idle, paused, and ended campaigns.";
    setMasterWorkspacePanel("passive");
    renderMasterCampaignBucket(
      "master-passive-games-list",
      state.masterCampaignCache.filter((entry) =>
        MASTER_PASSIVE_STATES.has(String(entry.sessionState || "idle"))
      ),
      "No passive/old games."
    );
    return;
  }

  if (state.masterAction === MASTER_ACTION.MY_RULESETS) {
    title.textContent = "Rulesets currently assigned to your campaigns.";
    setMasterWorkspacePanel("rulesets");
    renderMasterRulesetUsage();
    return;
  }

  if (state.masterAction === MASTER_ACTION.CREATE_RULESET) {
    title.textContent = "Build local ruleset drafts for future ruleset tooling.";
    setMasterWorkspacePanel("drafts");
    renderMasterRulesetDrafts();
    return;
  }

  title.textContent = "Host a new game or pick another action.";
  setMasterWorkspacePanel("host");
}

async function activateMasterAction(action) {
  state.masterAction = action;

  if (action === MASTER_ACTION.ACTIVE_GAMES) {
    state.masterCampaignFilter = "active";
    await loadCampaigns("master");
    renderMasterWorkspace();
    setStatus("Master view filtered: active games.");
    return;
  }

  if (action === MASTER_ACTION.PASSIVE_OLD_GAMES) {
    state.masterCampaignFilter = "passive";
    await loadCampaigns("master");
    renderMasterWorkspace();
    setStatus("Master view filtered: passive/old games.");
    return;
  }

  if (action === MASTER_ACTION.MY_RULESETS) {
    state.masterCampaignFilter = "all";
    await loadCampaigns("master");
    renderMasterWorkspace();
    setStatus("Master workspace: ruleset usage.");
    return;
  }

  if (action === MASTER_ACTION.CREATE_RULESET) {
    renderMasterWorkspace();
    const form = el("master-ruleset-draft-form");
    const nameField = form?.elements?.namedItem("name");
    nameField?.focus();
    setStatus("Master workspace: ruleset draft builder.");
    return;
  }

  state.masterCampaignFilter = "all";
  await loadCampaigns("master");
  renderMasterWorkspace();
  const hostForm = el("master-create-campaign-form");
  const input = hostForm?.elements?.namedItem("name");
  input?.focus();
  setStatus("Master workspace: host a new game.");
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
  renderCampaignListSelection("player");
  renderCampaignListSelection("master");
  renderMasterWorkspace();
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
  const timeline = el(`${prefix}-timeline-output`);
  const inviteOut = el(`${prefix}-invite-output`);
  const chars = el(`${prefix}-character-output`);
  const activeGames = el("master-active-games-list");
  const passiveGames = el("master-passive-games-list");
  const rulesets = el("master-ruleset-usage-list");
  const playerLayoutState = el("player-layout-draft-state");
  if (summary) summary.textContent = "";
  if (members) members.innerHTML = "";
  if (invites) invites.innerHTML = "";
  if (events) events.textContent = "";
  if (chat) chat.textContent = "";
  if (timeline) timeline.textContent = "";
  if (inviteOut) inviteOut.textContent = "";
  if (chars) chars.textContent = "";
  if (prefix === "master") {
    if (activeGames) activeGames.innerHTML = "";
    if (passiveGames) passiveGames.innerHTML = "";
    if (rulesets) rulesets.innerHTML = "";
  }
  if (prefix === "player") {
    if (playerLayoutState) {
      playerLayoutState.textContent = "Local layout draft: select a campaign first.";
    }
    const form = el("player-character-form");
    if (form) {
      applyPlayerLayoutDraftToForm(form, {});
    }
  }
  renderChatRecipientOptions(prefix, []);
}

function signOut() {
  state.token = null;
  state.user = null;
  state.masterAction = MASTER_ACTION.HOST;
  state.masterCampaignFilter = "all";
  state.masterCampaignCache = [];
  state.masterEditingDraftId = null;
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

function timelineLimit(prefix) {
  const raw = Number(el(`${prefix}-timeline-limit`)?.value || 80);
  if (!Number.isInteger(raw)) {
    return 80;
  }
  return Math.max(1, Math.min(200, raw));
}

function timelineSource(prefix) {
  return String(el(`${prefix}-timeline-source-filter`)?.value || "ALL")
    .trim()
    .toUpperCase();
}

function timelineSearch(prefix) {
  return String(el(`${prefix}-timeline-search`)?.value || "")
    .trim()
    .toLowerCase();
}

function buildTimelineEntries(events = [], messages = []) {
  const eventEntries = events.map((entry) => ({
    source: "EVENT",
    createdAt: entry.createdAt,
    line: `[EVENT] ${formatEvent(entry)}`
  }));

  const chatEntries = messages.map((entry) => ({
    source: "CHAT",
    createdAt: entry.createdAt,
    line: `[CHAT] ${formatChat(entry)}`
  }));

  return [...eventEntries, ...chatEntries].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
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
      loadChatMessages(prefix, true),
      loadTimeline(prefix, true)
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
  const visibleCampaigns =
    prefix === "master"
      ? campaigns.filter((entry) => campaignMatchesMasterFilter(entry))
      : campaigns;

  if (prefix === "master") {
    state.masterCampaignCache = campaigns;
  }

  const list = el(`${prefix}-campaign-list`);
  list.innerHTML = "";

  if (campaigns.length === 0) {
    list.innerHTML = `<li>No ${prefix} campaigns found.</li>`;
    if (prefix === "master") {
      renderMasterWorkspace();
    }
    return;
  }

  if (visibleCampaigns.length === 0) {
    if (prefix === "master" && state.masterCampaignFilter === "active") {
      list.innerHTML = "<li>No active campaigns found.</li>";
    } else if (prefix === "master" && state.masterCampaignFilter === "passive") {
      list.innerHTML = "<li>No passive/old campaigns found.</li>";
    } else {
      list.innerHTML = `<li>No ${prefix} campaigns found.</li>`;
    }
    if (prefix === "master") {
      renderMasterWorkspace();
    }
    return;
  }

  for (const campaign of visibleCampaigns) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.dataset.campaignId = campaign.id;
    button.dataset.baseLabel = `${campaign.name} | session: ${campaign.sessionState}`;
    applyCampaignButtonState(button, prefix);
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

  if (prefix === "master") {
    renderMasterWorkspace();
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

function syncChatRecipientState(prefix) {
  const form = el(`${prefix}-chat-form`);
  if (!form) {
    return;
  }
  const visibilityField = form.elements.namedItem("visibility");
  const recipientField = form.elements.namedItem("recipientUserId");
  if (!visibilityField || !recipientField) {
    return;
  }

  const visibility = String(visibilityField.value || "PUBLIC").toUpperCase();
  const isPrivate = visibility === "PRIVATE";
  recipientField.disabled = !isPrivate;
  recipientField.required = isPrivate;
  if (!isPrivate) {
    recipientField.value = "";
  }
}

function renderChatRecipientOptions(prefix, members = []) {
  const form = el(`${prefix}-chat-form`);
  if (!form) {
    return;
  }
  const recipientField = form.elements.namedItem("recipientUserId");
  if (!recipientField) {
    return;
  }

  const previousValue = String(recipientField.value || "").trim();
  recipientField.innerHTML =
    '<option value="">private recipient (select member)</option>';

  for (const member of members) {
    if (!member || member.userId === state.user?.id) {
      continue;
    }
    const option = document.createElement("option");
    option.value = member.userId;
    option.textContent = `${member.displayName} (${member.role})`;
    recipientField.appendChild(option);
  }

  if (previousValue) {
    recipientField.value = previousValue;
  }
  syncChatRecipientState(prefix);
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
  loadCurrentPlayerLayoutDraftIntoForm();
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
  } else {
    loadCurrentPlayerLayoutDraftIntoForm();
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
  renderChatRecipientOptions(prefix, summary.members);
}

async function loadEvents(prefix, silent = false) {
  renderEventQuickFilterState(prefix);
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

async function loadTimeline(prefix, silent = false) {
  const campaignId = currentCampaignId(prefix);
  const limit = timelineLimit(prefix);
  const sourceFilter = timelineSource(prefix);
  const search = timelineSearch(prefix);

  const [eventResult, chatResult] = await Promise.all([
    api(`/api/v1/campaigns/${campaignId}/events?limit=${limit}`),
    api(`/api/v1/campaigns/${campaignId}/chat/messages?limit=${limit}`)
  ]);

  const merged = buildTimelineEntries(
    eventResult.events || [],
    chatResult.messages || []
  )
    .filter((entry) => sourceFilter === "ALL" || entry.source === sourceFilter)
    .filter((entry) => !search || entry.line.toLowerCase().includes(search));

  el(`${prefix}-timeline-output`).textContent =
    merged.length > 0 ? merged.map((entry) => entry.line).join("\n") : "No timeline entries.";

  if (!silent) {
    setStatus("Timeline refreshed.");
  }
}

async function refreshRoleData(prefix) {
  await loadSummary(prefix);
  await loadEvents(prefix, true);
  await loadChatMessages(prefix, true);
  await loadTimeline(prefix, true);
  if (prefix === "player") {
    await loadPlayerCharacters(true);
  }
  if (prefix === "master") {
    await loadCampaigns("master");
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
  attachEventQuickFilters("player");
  const playerChatForm = el("player-chat-form");
  const playerChatVisibility = playerChatForm?.elements?.namedItem("visibility");
  playerChatVisibility?.addEventListener("change", () =>
    syncChatRecipientState("player")
  );
  syncChatRecipientState("player");
  renderPlayerLayoutDraftState("Local layout draft: select a campaign first.");

  el("player-load-timeline").addEventListener("click", async () => {
    try {
      await loadTimeline("player");
    } catch (error) {
      setStatus(error.message);
    }
  });
  el("player-timeline-source-filter").addEventListener("change", async () => {
    try {
      await loadTimeline("player", true);
    } catch {}
  });
  el("player-timeline-search").addEventListener("input", async () => {
    try {
      await loadTimeline("player", true);
    } catch {}
  });
  el("player-timeline-limit").addEventListener("change", async () => {
    try {
      await loadTimeline("player", true);
    } catch {}
  });

  el("player-save-layout-draft").addEventListener("click", () => {
    try {
      saveCurrentPlayerLayoutDraft();
      setStatus("Local layout draft saved.");
    } catch (error) {
      setStatus(error.message);
    }
  });

  el("player-clear-layout-draft").addEventListener("click", () => {
    try {
      clearCurrentPlayerLayoutDraft();
      setStatus("Local layout draft cleared.");
    } catch (error) {
      setStatus(error.message);
    }
  });

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
      saveCurrentPlayerLayoutDraft();
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
      if (visibility === "PRIVATE" && !recipientUserId) {
        throw new Error("Select a recipient for a private message.");
      }
      if (visibility === "PRIVATE") {
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
  attachEventQuickFilters("master");
  const masterChatForm = el("master-chat-form");
  const masterChatVisibility = masterChatForm?.elements?.namedItem("visibility");
  masterChatVisibility?.addEventListener("change", () =>
    syncChatRecipientState("master")
  );
  syncChatRecipientState("master");

  el("master-load-timeline").addEventListener("click", async () => {
    try {
      await loadTimeline("master");
    } catch (error) {
      setStatus(error.message);
    }
  });
  el("master-timeline-source-filter").addEventListener("change", async () => {
    try {
      await loadTimeline("master", true);
    } catch {}
  });
  el("master-timeline-search").addEventListener("input", async () => {
    try {
      await loadTimeline("master", true);
    } catch {}
  });
  el("master-timeline-limit").addEventListener("change", async () => {
    try {
      await loadTimeline("master", true);
    } catch {}
  });

  for (const button of document.querySelectorAll("[data-master-action]")) {
    button.addEventListener("click", async () => {
      try {
        await activateMasterAction(button.dataset.masterAction);
      } catch (error) {
        setStatus(error.message);
      }
    });
  }

  el("master-ruleset-draft-cancel").addEventListener("click", () => {
    resetMasterRulesetDraftForm();
    setStatus("Ruleset draft edit cancelled.");
  });

  el("master-ruleset-draft-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const name = String(form.get("name") || "").trim();
    const theme = String(form.get("theme") || "").trim();
    const notes = String(form.get("notes") || "");
    const defaultDifficulty = Number(form.get("defaultDifficulty"));

    if (!name) {
      setStatus("Ruleset draft name is required.");
      return;
    }
    if (!Number.isInteger(defaultDifficulty) || defaultDifficulty < 2 || defaultDifficulty > 10) {
      setStatus("Default difficulty must be an integer between 2 and 10.");
      return;
    }

    const now = new Date().toISOString();
    let savedDraft = null;
    if (state.masterEditingDraftId) {
      const existing = findMasterRulesetDraftById(state.masterEditingDraftId);
      if (existing) {
        existing.name = name;
        existing.theme = theme;
        existing.notes = notes;
        existing.defaultDifficulty = defaultDifficulty;
        existing.updatedAt = now;
        savedDraft = existing;
      }
    }

    if (!savedDraft) {
      savedDraft = {
        id: createClientId(),
        name,
        theme,
        notes,
        defaultDifficulty,
        createdAt: now,
        updatedAt: now
      };
      state.masterRulesetDrafts.push(savedDraft);
    }

    state.masterPreviewDraftId = savedDraft.id;
    saveMasterRulesetDrafts();
    resetMasterRulesetDraftForm();
    renderMasterRulesetDrafts();
    setStatus(`Ruleset draft saved: ${savedDraft.name}`);
  });

  el("master-create-campaign-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const result = await api("/api/v1/campaigns", {
        method: "POST",
        body: JSON.stringify({ name: form.get("name") })
      });
      state.masterAction = MASTER_ACTION.HOST;
      state.masterCampaignFilter = "all";
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
      if (visibility === "PRIVATE" && !recipientUserId) {
        throw new Error("Select a recipient for a private message.");
      }
      if (visibility === "PRIVATE") {
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
  loadMasterRulesetDrafts();
  loadPlayerLayoutDrafts();
  attachAuthHandlers();
  attachWelcomeHandlers();
  attachPlayerHandlers();
  attachMasterHandlers();
  renderMasterWorkspace();
  showPage("connection");
  setWelcomeUser();
  renderRoleStates();
  setStatus("Ready. Login first.");
}

window.addEventListener("beforeunload", () => {
  stopRealtimeStream();
});

initialize();
