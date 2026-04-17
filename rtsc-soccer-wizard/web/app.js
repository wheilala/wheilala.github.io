import { state, els } from "./app/state.js";
import { renderApp } from "./app/renderers.js";

const anchorCatalog = [
  { id: "rose-tree-impact-2015b", label: "Impact" },
  { id: "rose-tree-eagles-2012b", label: "Eagles" },
  { id: "rose-tree-warriors-2014g", label: "Warriors" },
  { id: "rose-tree-greyhounds-2014b", label: "Greyhounds" },
];

function closeMobileSidebar() {
  document.body.classList.remove("mobile-sidebar-open");
  if (els.mobileSidebarToggle) {
    els.mobileSidebarToggle.setAttribute("aria-expanded", "false");
  }
  if (els.mobileSidebarBackdrop) {
    els.mobileSidebarBackdrop.hidden = true;
  }
}

function openMobileSidebar() {
  document.body.classList.add("mobile-sidebar-open");
  if (els.mobileSidebarToggle) {
    els.mobileSidebarToggle.setAttribute("aria-expanded", "true");
  }
  if (els.mobileSidebarBackdrop) {
    els.mobileSidebarBackdrop.hidden = false;
  }
}

function applyMode(mode) {
  state.mode = mode === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", state.mode);
  if (els.modeToggle) {
    const input = els.modeToggle.querySelector(`input[value="${state.mode}"]`);
    if (input) {
      input.checked = true;
    }
  }
  window.localStorage.setItem("lsw-mode", state.mode);
}

function initializeMode() {
  applyMode("light");
}

function syncSelectedTeamFromLocation() {
  const hashKey = window.location.hash.replace(/^#/, "");
  state.selectedTeamKey =
    (
      hashKey === "__home__" || hashKey === "__calendar__"
        ? hashKey
        : state.dataset?.teams.find((team) => team.team_key === hashKey)?.team_key
    ) ??
    "__home__";
}

function navigateToTeam(teamKey) {
  state.selectedTeamKey = teamKey;
  history.pushState(null, "", `#${teamKey}`);
  closeMobileSidebar();
  renderAnchorNav();
  renderApp({ onNavigateToTeam: navigateToTeam });
}

function navigateHome() {
  state.selectedTeamKey = "__home__";
  history.pushState(null, "", "#__home__");
  closeMobileSidebar();
  renderAnchorNav();
  renderApp({ onNavigateToTeam: navigateToTeam });
}

function navigateCalendar() {
  state.selectedTeamKey = "__calendar__";
  history.pushState(null, "", "#__calendar__");
  closeMobileSidebar();
  renderAnchorNav();
  renderApp({ onNavigateToTeam: navigateToTeam });
}

function navigateToAnchor(anchorId) {
  closeMobileSidebar();
  const url = new URL(window.location.href);
  url.searchParams.set("anchor", anchorId);
  url.hash = "__home__";
  window.location.href = url.toString();
}

function renderAnchorNav() {
  if (!els.anchorNav) return;

  const currentAnchorId = state.dataset?.anchor?.id;
  const anchorNickname = state.dataset?.anchor?.nickname || state.dataset?.anchor?.display_name || "Anchor";
  const availableAnchors = anchorCatalog.filter((anchor) => anchor.id !== currentAnchorId);
  const calendarLink = `<button type="button" class="anchor-nav-link ${state.selectedTeamKey === "__calendar__" ? "is-active" : ""}" data-nav-action="calendar">Club Calendar</button>`;
  const homeLink =
    state.selectedTeamKey && state.selectedTeamKey !== "__home__"
      ? `<button type="button" class="anchor-nav-link anchor-nav-home-link" data-nav-action="home"><span class="anchor-nav-home-desktop">${anchorNickname} Home</span><span class="anchor-nav-home-mobile">Back to ${anchorNickname} Home</span></button>`
      : "";

  els.anchorNav.innerHTML = `
    <div class="anchor-nav-home-slot">
      <div class="anchor-nav-primary-links">
        ${calendarLink}
        ${homeLink}
      </div>
    </div>
    <div class="anchor-nav-picker">
      <span class="anchor-nav-picker-label">Switch teams</span>
      <div class="anchor-nav-menu-wrap">
        <button
          type="button"
          class="anchor-nav-trigger"
          id="anchor-nav-trigger"
          aria-haspopup="menu"
          aria-expanded="false"
        >
          <span>${anchorNickname}</span>
          <span class="anchor-nav-trigger-icon" aria-hidden="true">v</span>
        </button>
        <div class="anchor-nav-menu" id="anchor-nav-menu" role="menu" hidden>
          ${availableAnchors
            .map(
              (anchor) =>
                `<button type="button" class="anchor-nav-menu-item" role="menuitem" data-anchor-id="${anchor.id}">${anchor.label}</button>`
            )
            .join("")}
        </div>
      </div>
    </div>
  `;

  if (els.sidebarAnchorSwitch) {
    els.sidebarAnchorSwitch.innerHTML = `
      <div class="sidebar-anchor-current">Current: ${anchorNickname}</div>
      <div class="sidebar-anchor-switch-list">
        ${availableAnchors
          .map(
            (anchor) =>
              `<button type="button" class="sidebar-anchor-switch-item" data-anchor-id="${anchor.id}">${anchor.label}</button>`
          )
          .join("")}
      </div>
    `;
  }

  const trigger = els.anchorNav.querySelector("#anchor-nav-trigger");
  const menu = els.anchorNav.querySelector("#anchor-nav-menu");
  if (trigger && menu) {
    trigger.addEventListener("click", () => {
      const isOpen = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", String(!isOpen));
      menu.hidden = isOpen;
    });
  }

  const homeButton = els.anchorNav.querySelector('[data-nav-action="home"]');
  if (homeButton) {
    homeButton.addEventListener("click", () => navigateHome());
  }

  const calendarButton = els.anchorNav.querySelector('[data-nav-action="calendar"]');
  if (calendarButton) {
    calendarButton.addEventListener("click", () => navigateCalendar());
  }

  [...els.anchorNav.querySelectorAll(".anchor-nav-menu-item")].forEach((button) => {
    button.addEventListener("click", () => {
      if (trigger && menu) {
        trigger.setAttribute("aria-expanded", "false");
        menu.hidden = true;
      }
      navigateToAnchor(button.dataset.anchorId);
    });
  });

  [...document.querySelectorAll(".sidebar-anchor-switch-item")].forEach((button) => {
    button.addEventListener("click", () => {
      navigateToAnchor(button.dataset.anchorId);
    });
  });
}

async function loadRelatedDatasets(anchorId) {
  state.relatedDatasets = {};

  const relatedAnchorMap = {
    "rose-tree-impact-2015b": [{ id: "rose-tree-eagles-2012b", relationLabel: "coach" }],
    "rose-tree-eagles-2012b": [
      { id: "rose-tree-impact-2015b", relationLabel: "coach" },
      { id: "rose-tree-warriors-2014g", relationLabel: "coach" },
    ],
    "rose-tree-warriors-2014g": [{ id: "rose-tree-eagles-2012b", relationLabel: "coach" }],
  };

  const relatedAnchors = relatedAnchorMap[anchorId] || [];
  if (!relatedAnchors.length) {
    return;
  }

  const responses = await Promise.all(
    relatedAnchors.map(async ({ id: relatedAnchorId, relationLabel }) => {
      try {
        const response = await fetch(`../data/generated/${relatedAnchorId}.json`, { cache: "no-store" });
        if (!response.ok) {
          return null;
        }

        return [relatedAnchorId, { dataset: await response.json(), relationLabel }];
      } catch {
        return null;
      }
    })
  );

  for (const item of responses) {
    if (!item) continue;
    const [relatedAnchorId, relatedRecord] = item;
    state.relatedDatasets[relatedAnchorId] = relatedRecord;
  }
}

async function loadAllAnchorDatasets(currentAnchorId) {
  state.allAnchorDatasets = state.dataset ? { [currentAnchorId]: state.dataset } : {};

  const otherAnchors = anchorCatalog.filter((anchor) => anchor.id !== currentAnchorId);
  if (!otherAnchors.length) {
    return;
  }

  const responses = await Promise.all(
    otherAnchors.map(async (anchor) => {
      try {
        const response = await fetch(`../data/generated/${anchor.id}.json`, { cache: "no-store" });
        if (!response.ok) {
          return null;
        }

        return [anchor.id, await response.json()];
      } catch {
        return null;
      }
    })
  );

  for (const item of responses) {
    if (!item) continue;
    const [anchorId, dataset] = item;
    state.allAnchorDatasets[anchorId] = dataset;
  }
}

async function loadDataset() {
  const params = new URLSearchParams(window.location.search);
  const anchorId = params.get("anchor") || "rose-tree-impact-2015b";
  const datasetPath = `../data/generated/${anchorId}.json`;
  const response = await fetch(datasetPath, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load dataset: ${response.status}`);
  }

  state.dataset = await response.json();
  syncSelectedTeamFromLocation();
  renderAnchorNav();
  renderApp({ onNavigateToTeam: navigateToTeam });

  loadRelatedDatasets(anchorId)
    .then(() => {
      renderApp({ onNavigateToTeam: navigateToTeam });
    })
    .catch(() => {
      state.relatedDatasets = {};
    });

  loadAllAnchorDatasets(anchorId)
    .then(() => {
      renderApp({ onNavigateToTeam: navigateToTeam });
    })
    .catch(() => {
      state.allAnchorDatasets = state.dataset ? { [anchorId]: state.dataset } : {};
    });
}

function wireEvents() {
  if (els.modeToggle) {
    els.modeToggle.addEventListener("change", (event) => {
      if (event.target instanceof HTMLInputElement) {
        applyMode(event.target.value);
      }
    });
  }

  els.homeNavButton.addEventListener("click", () => {
    navigateHome();
  });

  els.teamHomeLink?.addEventListener("click", () => {
    navigateHome();
  });

  els.backButton.addEventListener("click", () => {
    if (window.location.hash && window.location.hash !== "#__home__") {
      window.history.back();
      return;
    }
    navigateHome();
  });

  els.teamSearch.addEventListener("input", () => {
    renderApp({ onNavigateToTeam: navigateToTeam });
  });

  els.mobileSidebarToggle?.addEventListener("click", () => {
    const isOpen = document.body.classList.contains("mobile-sidebar-open");
    if (isOpen) {
      closeMobileSidebar();
      return;
    }
    openMobileSidebar();
  });

  els.mobileSidebarClose?.addEventListener("click", () => {
    closeMobileSidebar();
  });

  els.mobileSidebarBackdrop?.addEventListener("click", () => {
    closeMobileSidebar();
  });

  window.addEventListener("popstate", () => {
    syncSelectedTeamFromLocation();
    closeMobileSidebar();
    renderAnchorNav();
    renderApp({ onNavigateToTeam: navigateToTeam });
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest(".anchor-nav-menu-wrap")) return;

    const trigger = els.anchorNav?.querySelector("#anchor-nav-trigger");
    const menu = els.anchorNav?.querySelector("#anchor-nav-menu");
    if (trigger && menu) {
      trigger.setAttribute("aria-expanded", "false");
      menu.hidden = true;
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 980) {
      closeMobileSidebar();
    }
  });
}

initializeMode();
wireEvents();
loadDataset().catch((error) => {
  els.datasetMeta.textContent = "Could not load dataset.";
  els.teamClub.hidden = true;
  els.teamTitle.textContent = "Dataset load failed";
  els.teamSubtitle.textContent = error.message;
  els.teamGotsportLink.hidden = true;
});
