const state = {
  token: null,
  user: null,
  campaignId: null,
  campaignName: null,
  campaignState: null
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

function renderCampaignState() {
  const node = document.querySelector("#campaign-state");
  if (!state.campaignId) {
    node.textContent = "No campaign selected.";
    return;
  }
  node.textContent = `Selected: ${state.campaignName || state.campaignId} | Session: ${
    state.campaignState || "unknown"
  }`;
}

function setSelectedCampaign(campaign) {
  state.campaignId = campaign.id;
  state.campaignName = campaign.name;
  state.campaignState = campaign.sessionState || "idle";
  renderCampaignState();
}

function numberOrUndefined(value) {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }
  return Number(value);
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
      button.textContent = `${campaign.name} (${campaign.role})`;
      button.addEventListener("click", () => {
        setSelectedCampaign(campaign);
        setStatus(`Selected campaign: ${campaign.name}`);
      });
      item.appendChild(button);
      list.appendChild(item);
    }
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
    document.querySelector("#invite-output").textContent = `Invite token: ${result.invite.token}`;
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
      setStatus("Invite accepted.");
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
    setStatus("Roll completed.", result.result);
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#load-events").addEventListener("click", async () => {
  try {
    const campaignId = getCampaignIdOrFail();
    const result = await api(`/api/v1/campaigns/${campaignId}/events`);
    document.querySelector("#event-output").textContent = JSON.stringify(
      result.events,
      null,
      2
    );
  } catch (error) {
    setStatus(error.message);
  }
});

renderCampaignState();
setStatus("Ready. Register or login first.");
