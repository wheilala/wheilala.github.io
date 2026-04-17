import { state, els } from "./state.js";
import {
  escapeHtml,
  formatCompactDate,
  formatCompactDateWithWeekday,
  formatDate,
  formatMatchTime,
  formatScoreline,
  formatShortDate,
  getStateRankLabel,
  getTeamDisplayName,
  getTeamNameParts,
  renderTeamNameBlock,
} from "./format.js";
import {
  classifyCompetitionType,
  getCommonOpponentSummary,
  getComparisonEdge,
  getFormatAnalysis,
  getHeadToHeadSummary,
  getHomeAwayAnalysis,
  getRecentCompletedMatches,
  getTrendAnalysis,
  formatRecord,
} from "./analysis.js";

function getSelectedTeam() {
  return state.dataset?.teams.find((team) => team.team_key === state.selectedTeamKey) ?? null;
}

function getAnchorMeta() {
  return state.dataset?.anchor ?? null;
}

function getAnchorTeam() {
  const anchorKey = state.dataset?.anchor?.team_key;
  return state.dataset?.teams.find((team) => team.team_key === anchorKey) ?? null;
}

function getAnchorTeamFromDataset(dataset) {
  const anchorKey = dataset?.anchor?.team_key;
  return dataset?.teams?.find((team) => team.team_key === anchorKey) ?? null;
}

function getSidebarEntryName(team) {
  return getTeamDisplayName(team);
}

function getSidebarClubName(team) {
  return team?.team?.club_name || getTeamNameParts(team).teamName;
}

function getCanonicalSidebarTeams() {
  const anchorTeam = getAnchorTeam();
  const deduped = new Map();

  for (const team of state.dataset?.teams || []) {
    if (anchorTeam && team.team_key === anchorTeam.team_key) continue;

    const dedupeKey = team?.team?.team_id || team.team_key;
    const existing = deduped.get(dedupeKey);
    const isPreferred = !String(team.team_key || "").startsWith("auto-team-");
    const existingPreferred = existing ? !String(existing.team_key || "").startsWith("auto-team-") : false;

    if (!existing || (isPreferred && !existingPreferred)) {
      deduped.set(dedupeKey, team);
    }
  }

  return [...deduped.values()];
}

function renderSidebarLinks(container, items, options = {}) {
  if (!items.length) {
    container.innerHTML = `<p class="empty-sidebar">${options.emptyText || "No teams found."}</p>`;
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const compact = options.compact ? "sidebar-link-compact" : "";
      const meta = !options.compact && item.meta ? `<span class="sidebar-link-meta">${escapeHtml(item.meta)}</span>` : "";
      const isActive = item.team_key === state.selectedTeamKey ? "is-active" : "";
      const compactForm =
        options.compact && options.showForm && item.team
          ? renderFormStrip(item.team, 5, "sidebar-form-strip", options.highlightAgainstTeamId || null)
          : "";
      return `
        <button type="button" class="sidebar-link ${compact} ${isActive}" data-team-key="${escapeHtml(item.team_key)}">
          ${
            options.compact
              ? `<span class="sidebar-link-inline"><span class="sidebar-link-text">${escapeHtml(item.display_name)}</span></span>${compactForm}`
              : `<span class="sidebar-link-text">${escapeHtml(item.display_name)}</span>${item.meta ? `<span class="sidebar-link-date">${escapeHtml(item.meta)}</span>` : meta}`
          }
        </button>
      `;
    })
    .join("");

  [...container.querySelectorAll("button")].forEach((button) => {
    button.addEventListener("click", () => options.onNavigate(button.dataset.teamKey));
  });
}

function renderDatasetMeta() {
  const count = state.dataset?.teams.length ?? 0;
  const generatedAt = state.dataset?.generated_at_utc
    ? new Date(state.dataset.generated_at_utc).toLocaleString()
    : "unknown";
  const anchorDisplayName = getAnchorMeta()?.display_name || "Local Soccer Wizard";
  const anchorNickname = getAnchorMeta()?.nickname || getAnchorMeta()?.display_name || "Local Soccer Wizard";
  els.datasetMeta.textContent = `${count} tracked teams | refreshed ${generatedAt}`;
  els.sidebarAnchorName.textContent = getAnchorMeta()?.nickname
    ? `Rose Tree ${getAnchorMeta().nickname}`
    : getAnchorMeta()?.display_name || "";
  if (els.brandName) {
    els.brandName.textContent = `Rose Tree ${anchorNickname}`;
  }
  document.title = `${anchorDisplayName} | Local Soccer Wizard`;
}

function renderTeamList(onNavigate) {
  const anchorTeam = getAnchorTeam();
  const query = els.teamSearch.value.trim().toLowerCase();
  const sidebarTeams = getCanonicalSidebarTeams();
  const allTeams = sidebarTeams
    .map((team) => ({
      team_key: team.team_key,
      display_name: getSidebarEntryName(team),
      search_text: getSidebarEntryName(team).toLowerCase(),
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  const allTeamsFiltered = allTeams.filter((team) => !query || team.search_text.includes(query));
  state.filteredTeams = allTeamsFiltered;

  const upcomingItems = anchorTeam
    ? anchorTeam.matches
        .filter((match) => match.match_status === "scheduled")
        .sort((a, b) => `${a.match_date}${a.match_time_utc}`.localeCompare(`${b.match_date}${b.match_time_utc}`))
        .slice(0, 5)
        .map((match) => {
          const team = state.dataset.teams.find((entry) => entry.team.team_id === match.opponent_team_id);
          if (!team) return null;
          return { team_key: team.team_key, team, display_name: getSidebarClubName(team), meta: formatShortDate(match.match_date) };
        })
        .filter(Boolean)
    : [];

  const recentItems = anchorTeam
    ? anchorTeam.matches
        .filter((match) => match.completed)
        .sort((a, b) => `${b.match_date}${b.match_time_utc}`.localeCompare(`${a.match_date}${a.match_time_utc}`))
        .slice(0, 5)
        .map((match) => {
          const team = state.dataset.teams.find((entry) => entry.team.team_id === match.opponent_team_id);
          if (!team) return null;
          return { team_key: team.team_key, team, display_name: getSidebarClubName(team), meta: formatShortDate(match.match_date) };
        })
        .filter(Boolean)
    : [];

  renderSidebarLinks(els.upcomingTeamList, upcomingItems, {
    emptyText: "No upcoming opponents.",
    compact: true,
    showForm: true,
    highlightAgainstTeamId: anchorTeam?.team?.team_id || null,
    onNavigate,
  });
  renderSidebarLinks(els.recentTeamList, recentItems, {
    emptyText: "No recent opponents.",
    compact: true,
    showForm: true,
    highlightAgainstTeamId: anchorTeam?.team?.team_id || null,
    onNavigate,
  });
  renderSidebarLinks(els.allTeamList, allTeamsFiltered, {
    compact: true,
    emptyText: query ? "No opponents match this search." : "No tracked opponents.",
    onNavigate,
  });
}

function renderFormStrip(team, limit = 5, className = "home-form-strip", highlightAgainstTeamId = null) {
  const matches = getRecentCompletedMatches(team, limit);
  if (!matches.length) return `<span class="home-form-empty">--</span>`;

  const cells = matches
    .map((match) => {
      const code = match.result_type || "?";
      const tone = code === "W" ? "home-form-win" : code === "L" ? "home-form-loss" : code === "D" ? "home-form-draw" : "home-form-unknown";
      const opponent = match.opponent_full_name || getTeamNameParts(match).teamName;
      const scoreline = formatScoreline(match.team_score, match.opponent_score);
      const dateLabel = formatCompactDateWithWeekday(match.match_date);
      const title =
        code === "W"
          ? `${dateLabel} - Beat ${opponent}${scoreline !== "--" ? ` ${scoreline}` : ""}`
          : code === "L"
            ? `${dateLabel} - Lost to ${opponent}${scoreline !== "--" ? ` ${scoreline}` : ""}`
            : code === "D"
              ? `${dateLabel} - Tied ${opponent}${scoreline !== "--" ? ` ${scoreline}` : ""}`
              : `${dateLabel} - ${opponent}${scoreline !== "--" ? ` ${scoreline}` : ""}`;
      const highlightClass = highlightAgainstTeamId && match.opponent_team_id === highlightAgainstTeamId ? " home-form-cell-anchor-match" : "";
      return `<span class="home-form-cell ${tone}${highlightClass}" data-tooltip="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" tabindex="0">${escapeHtml(code)}</span>`;
    })
    .join("");

  return `<div class="${escapeHtml(className)}" aria-label="Recent form">${cells}</div>`;
}

function renderHeroFormCard(team, limit = 5) {
  const matches = getRecentCompletedMatches(team, limit);
  if (!matches.length) {
    return `
      <section class="hero-utility-card hero-form-card">
        <span class="hero-stat-label">Current Form</span>
        <div class="hero-stat-empty">No recent results yet</div>
      </section>
    `;
  }

  const latest = matches[0];
  return `
    <section class="hero-utility-card hero-form-card">
      <span class="hero-stat-label">Current Form</span>
      ${renderFormStrip(team, limit)}
      <div class="hero-stat-caption">Last ${matches.length} completed | ${escapeHtml(formatDate(latest.match_date))} latest</div>
    </section>
  `;
}

function renderHomeSketchCard(team) {
  const anchorName = getTeamNameParts(team).teamName || "Anchor";
  return `
    <section class="hero-utility-card hero-sketch-card" aria-hidden="true">
      <div class="hero-sketch-frame">
        <svg class="hero-sketch" viewBox="0 0 180 132" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 95C29 72 48 58 76 52C104 46 126 33 146 16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
          <path d="M23 107C40 88 57 79 79 74C102 69 123 58 158 30" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-dasharray="3 8"/>
          <circle cx="37" cy="87" r="7.5" stroke="currentColor" stroke-width="3"/>
          <circle cx="82" cy="67" r="7.5" stroke="currentColor" stroke-width="3"/>
          <circle cx="128" cy="42" r="7.5" stroke="currentColor" stroke-width="3"/>
          <path d="M126 108C144 98 155 88 164 73" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
          <path d="M152 70L165 72L161 85" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M28 27C35 22 42 21 49 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M115 111C122 106 129 105 136 108" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="hero-sketch-copy">
        <span class="hero-stat-label">Workbench</span>
        <p>A clearer weekly view for ${escapeHtml(anchorName)}: schedule, form, and the next pressure points.</p>
      </div>
    </section>
  `;
}

function renderHomeHeroMeta(team) {
  return `<div class="hero-utility-stack">${renderHeroFormCard(team)}</div>`;
}

const CLUB_CALENDAR_WINDOW_DAYS = 30;
const CLUB_CALENDAR_SPOTLIGHT_WINDOW_DAYS = 30;

function formatDateKey(value) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarDateRange() {
  const { startKey, endKey } = getDateRangeKeys(CLUB_CALENDAR_WINDOW_DAYS);
  return {
    startKey,
    endKey,
    label: `${formatDate(startKey)} to ${formatDate(endKey)}`,
  };
}

function getDateRangeKeys(dayCount) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + Math.max(dayCount - 1, 0));

  return {
    startKey: formatDateKey(start),
    endKey: formatDateKey(end),
  };
}

function getHomeVenueNickname(match) {
  const venue = `${match?.venue_name || ""} ${match?.venue_address || ""}`.toLowerCase();
  if (venue.includes("cherry")) {
    return "Cherry St.";
  }
  if (venue.includes("sleighton")) {
    return "Sleighton Park";
  }
  return match?.venue_name?.trim() || "Home field";
}

function getCalendarLocationLabel(match) {
  if (match?.home_away === "home") {
    return `Home | ${getHomeVenueNickname(match)}`;
  }

  if (match?.home_away === "away") {
    return match?.venue_name?.trim() ? `Away | ${match.venue_name.trim()}` : "Away";
  }

  return match?.venue_name?.trim() || "--";
}

function getCalendarAnchorOptions() {
  return Object.values(state.allAnchorDatasets || {})
    .map((dataset) => ({
      id: dataset?.anchor?.id,
      label: dataset?.anchor?.nickname || dataset?.anchor?.display_name || "Anchor",
    }))
    .filter((anchor) => anchor.id)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function getActiveCalendarAnchorIds() {
  const options = getCalendarAnchorOptions();
  const allIds = options.map((anchor) => anchor.id);
  const selected = (state.selectedCalendarAnchors || []).filter((anchorId) => allIds.includes(anchorId));
  return selected.length ? selected : allIds;
}

function getFilteredCalendarDatasets() {
  const activeIds = new Set(getActiveCalendarAnchorIds());
  return Object.values(state.allAnchorDatasets || {}).filter((dataset) => activeIds.has(dataset?.anchor?.id));
}

function getClubCalendarMatches() {
  const { startKey, endKey } = getCalendarDateRange();
  const datasets = getFilteredCalendarDatasets();

  return datasets
    .map((dataset) => {
      const anchorTeam = getAnchorTeamFromDataset(dataset);
      const anchorLabel = dataset?.anchor?.nickname || dataset?.anchor?.display_name || "Anchor";
      return (anchorTeam?.matches || [])
        .filter((match) => match.match_status === "scheduled" && match.match_date >= startKey && match.match_date <= endKey)
        .map((match) => ({
          anchorLabel,
          opponentLabel: match.opponent_full_name || match.opponent_team_name || match.opponent_name || "Opponent",
          match,
        }));
    })
    .flat()
    .sort((a, b) => `${a.match.match_date}${a.match.match_time_utc || ""}`.localeCompare(`${b.match.match_date}${b.match.match_time_utc || ""}`));
}

function getNextHomeGamesByAnchor() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = formatDateKey(today);

  return getFilteredCalendarDatasets()
    .map((dataset) => {
      const anchorTeam = getAnchorTeamFromDataset(dataset);
      const anchorLabel = dataset?.anchor?.nickname || dataset?.anchor?.display_name || "Anchor";
      const homeGames = (anchorTeam?.matches || [])
        .filter((match) => match.match_status === "scheduled" && match.home_away === "home" && match.match_date >= todayKey)
        .sort((a, b) => `${a.match_date}${a.match_time_utc || ""}`.localeCompare(`${b.match_date}${b.match_time_utc || ""}`))
        .slice(0, 2);

      return { anchorLabel, homeGames };
    })
    .sort((a, b) => a.anchorLabel.localeCompare(b.anchorLabel));
}

function getCalendarSpotlightHomeGames() {
  const { startKey, endKey } = getDateRangeKeys(CLUB_CALENDAR_SPOTLIGHT_WINDOW_DAYS);

  return getFilteredCalendarDatasets()
    .map((dataset) => {
      const anchorTeam = getAnchorTeamFromDataset(dataset);
      const anchorLabel = dataset?.anchor?.nickname || dataset?.anchor?.display_name || "Anchor";
      return (anchorTeam?.matches || [])
        .filter(
          (match) =>
            match.match_status === "scheduled" &&
            match.home_away === "home" &&
            match.match_date >= startKey &&
            match.match_date <= endKey
        )
        .map((match) => ({
          anchorLabel,
          opponentLabel: match.opponent_full_name || match.opponent_team_name || match.opponent_name || "Opponent",
          match,
        }));
    })
    .flat()
    .sort((a, b) => `${a.match.match_date}${a.match.match_time_utc || ""}`.localeCompare(`${b.match.match_date}${b.match.match_time_utc || ""}`));
}

function getCalendarSpotlightVenueGroups() {
  const games = getCalendarSpotlightHomeGames();
  return {
    cherry: games.filter(({ match }) => getHomeVenueNickname(match) === "Cherry St."),
    sleighton: games.filter(({ match }) => getHomeVenueNickname(match) === "Sleighton Park"),
  };
}

function findCoachConflict(match) {
  const anchorId = state.dataset?.anchor?.id;
  const conflictAnchors = new Set([
    "rose-tree-impact-2015b",
    "rose-tree-eagles-2012b",
    "rose-tree-warriors-2014g",
  ]);

  if (!conflictAnchors.has(anchorId)) {
    return null;
  }

  const relatedRecords = Object.values(state.relatedDatasets || {});
  if (!relatedRecords.length) {
    return null;
  }

  const currentStart = match?.match_time_utc ? new Date(match.match_time_utc) : null;
  const currentDate = match?.match_date || "";

  for (const relatedRecord of relatedRecords) {
    const relatedDataset = relatedRecord?.dataset || relatedRecord;
    const relationLabel = relatedRecord?.relationLabel || "";
    const relatedAnchorTeam = getAnchorTeamFromDataset(relatedDataset);
    if (!relatedAnchorTeam?.matches) {
      continue;
    }

    const conflicts = relatedAnchorTeam.matches
      .filter((otherMatch) => otherMatch.match_status === "scheduled" && otherMatch.match_date === currentDate)
      .map((otherMatch) => {
        if (!currentStart || !otherMatch.match_time_utc) {
          return {
            match: otherMatch,
            severity: "possible",
          };
        }

        const otherStart = new Date(otherMatch.match_time_utc);
        const minutesApart = Math.abs(otherStart.getTime() - currentStart.getTime()) / 60000;
        if (minutesApart <= 180) {
          return {
            match: otherMatch,
            severity: "conflict",
          };
        }

        return null;
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = a.match.match_time_utc || "";
        const bTime = b.match.match_time_utc || "";
        return aTime.localeCompare(bTime);
      });

    if (conflicts.length) {
      const first = conflicts[0];
      const otherParts = getTeamNameParts(first.match);
      const otherTeamLabel = relatedDataset.anchor?.nickname || relatedDataset.anchor?.display_name || otherParts.teamName;
      const otherTime = formatMatchTime(first.match.match_time_utc);
      const relationPrefix =
        relationLabel === "coach" ? "Potential coach conflict" : relationLabel === "player" ? "Potential player conflict" : "Potential conflict";
      return {
        severity: first.severity,
        message: `${relationPrefix} with ${otherTeamLabel}${otherTime ? ` game at ${otherTime}` : " game"}`,
      };
    }
  }

  return null;
}

function renderLastMatchup(anchorTeam, opponentTeamId) {
  if (!anchorTeam?.matches || !opponentTeamId) return `<span class="home-last-matchup-empty">--</span>`;

  const match = anchorTeam.matches
    .filter((item) => item.completed && item.opponent_team_id === opponentTeamId)
    .sort((a, b) => `${b.match_date}${b.match_time_utc}`.localeCompare(`${a.match_date}${a.match_time_utc}`))[0];

  if (!match) return `<span class="home-last-matchup-empty">No prior meeting</span>`;

  const verb = match.result_type === "W" ? "Won" : match.result_type === "L" ? "Lost" : "Drew";
  const anchorMeta = getAnchorMeta();
  const anchorLabel = anchorMeta?.nickname || anchorMeta?.display_name || getTeamNameParts(anchorTeam).teamName || "Anchor";
  const scoreline = formatScoreline(match.team_score, match.opponent_score);
  return `
      <div class="home-last-matchup">
        <span class="home-last-matchup-result ${match.result_type === "W" ? "edge-impact" : match.result_type === "L" ? "edge-team" : "edge-even"}">
          <span class="home-last-matchup-label">${escapeHtml(anchorLabel)} ${escapeHtml(verb)}</span>
          <span class="home-last-matchup-score">${escapeHtml(scoreline)}</span>
        </span>
        <span class="home-last-matchup-date">${escapeHtml(formatDate(match.match_date))}</span>
      </div>
    `;
}

function renderLastMatchupInline(anchorTeam, opponentTeamId) {
  if (!anchorTeam?.matches || !opponentTeamId) return `<span class="home-last-matchup-empty">No prior meeting</span>`;

  const match = anchorTeam.matches
    .filter((item) => item.completed && item.opponent_team_id === opponentTeamId)
    .sort((a, b) => `${b.match_date}${b.match_time_utc}`.localeCompare(`${a.match_date}${a.match_time_utc}`))[0];

  if (!match) return `<span class="home-last-matchup-empty">No prior meeting</span>`;

  const verb = match.result_type === "W" ? "Won" : match.result_type === "L" ? "Lost" : "Drew";
  const anchorMeta = getAnchorMeta();
  const anchorLabel = anchorMeta?.nickname || anchorMeta?.display_name || getTeamNameParts(anchorTeam).teamName || "Anchor";
  return `<span class="home-last-matchup-inline">${escapeHtml(`${anchorLabel} ${verb} ${formatScoreline(match.team_score, match.opponent_score)} (${formatDate(match.match_date)})`)}</span>`;
}

function renderHero(team) {
  const parts = getTeamNameParts(team);
  const anchorNickname = getAnchorMeta()?.nickname || getAnchorMeta()?.display_name || "Anchor";
  els.teamClub.textContent = parts.clubName;
  els.teamClub.hidden = !parts.clubName;
  els.teamTitle.textContent = parts.teamName;
  els.teamSubtitle.textContent = getStateRankLabel(team);
  els.teamGotsportLink.href = team.team.rankings_url || `https://rankings.gotsport.com/teams/${team.team.team_id}/game-history`;
  els.teamGotsportLink.hidden = false;
  if (els.teamHomeLink) {
    els.teamHomeLink.textContent = `Back to ${anchorNickname} home`;
    els.teamHomeLink.hidden = false;
  }
}

function getTeamInsights(team, options = {}) {
  const trend = getTrendAnalysis(team);
  const homeAway = getHomeAwayAnalysis(team);
  const format = getFormatAnalysis(team);
  const insights = [];

  if (trend.value === "Getting stronger" || trend.value === "Cooling off") {
    insights.push({
      label: trend.value,
      detail: trend.detail,
    });
  }

  if (homeAway.value === "Home lean" || homeAway.value === "Away lean") {
    insights.push({
      label: homeAway.value,
      detail: homeAway.detail,
    });
  }

  if (format.value === "League stronger" || format.value === "Tournament stronger") {
    insights.push({
      label: format.value,
      detail: format.detail,
    });
  }

  if (options.edgeLabel || options.edgeSubtitle) {
    insights.unshift({
      label: "Edge",
      detail: options.edgeSubtitle ? `${options.edgeLabel || "Even"}. ${options.edgeSubtitle}` : options.edgeLabel || "Even",
    });
  }

  return insights;
}

function renderSummary(team) {
  const anchorTeam = getAnchorTeam();
  const anchorMeta = getAnchorMeta();
  const anchorName = anchorMeta?.nickname || anchorMeta?.display_name || "Anchor";
  const teamName = getTeamDisplayName(team);
  const edge = getComparisonEdge(team, anchorTeam, anchorMeta?.display_name);
  const edgeLabel = edge
    ? edge.key === "team"
      ? getTeamNameParts(team).teamName
      : edge.label.replace(/^Advantage:\s*/, "")
    : "Even";
  const insights = getTeamInsights(team, {
    edgeLabel,
    edgeSubtitle: edge?.subtitle || `Based on ${anchorName} vs ${teamName}.`,
  });
  const headToHeadMatches = team.matches
    .filter((match) => match.completed && match.opponent_team_id === anchorTeam?.team?.team_id)
    .sort((a, b) => `${b.match_date}${b.match_time_utc}`.localeCompare(`${a.match_date}${a.match_time_utc}`))
    .slice(0, 5);
  const summaryCards = [];

  summaryCards.push({
    label: "Insights",
    value: "",
    subtext: "",
    compact: false,
    insights,
    insightCard: true,
  });

  if (headToHeadMatches.length) {
    summaryCards.push({
      label: "Prior Head-to-Head",
      headToHeadMatches,
      headToHeadCard: true,
    });
  }

  if (!summaryCards.length) {
    els.summaryGrid.innerHTML = "";
    els.summaryGrid.hidden = true;
    return;
  }

  els.summaryGrid.innerHTML = summaryCards
    .map(
      (card) => `
        <article class="summary-card ${card.compact ? "compact" : ""} ${card.insightCard ? "summary-card-insights" : ""}">
          <h4>${escapeHtml(card.label)}</h4>
          ${
            card.headToHeadMatches
              ? `<div class="summary-headtohead-list">${card.headToHeadMatches
                  .map(
                    (match) => {
                      const anchorResultType =
                        match.result_type === "W" ? "L" : match.result_type === "L" ? "W" : "D";
                      const anchorResultLabel =
                        anchorResultType === "W"
                          ? `${anchorName} won:`
                          : anchorResultType === "L"
                            ? `${anchorName} lost:`
                            : "Tied:";
                      const anchorScore = formatScoreline(match.opponent_score, match.team_score);
                      return `
                      <div class="summary-headtohead-item">
                        <span class="summary-headtohead-date">${escapeHtml(formatCompactDateWithWeekday(match.match_date))}</span>
                        <span class="compare-result ${
                          anchorResultType === "W"
                            ? "compare-result-win"
                            : anchorResultType === "L"
                              ? "compare-result-loss"
                              : "compare-result-draw"
                        }">${escapeHtml(anchorResultType)}</span>
                        <span class="summary-headtohead-opponent">${escapeHtml(anchorResultLabel)}</span>
                        <span class="summary-headtohead-score">${escapeHtml(anchorScore)}</span>
                      </div>
                    `;
                    }
                  )
                  .join("")}</div>`
              : card.insights
              ? `<ul class="summary-insight-list">${card.insights.map((insight) => `<li><span class="summary-insight-label">${escapeHtml(insight.label)}:</span> ${escapeHtml(insight.detail)}</li>`).join("")}</ul>`
              : `${card.value ? `<p class="${card.tone ? `summary-value summary-value-${card.tone}` : ""}">${escapeHtml(card.value)}</p>` : ""}<div class="summary-subtext">${escapeHtml(card.subtext)}</div>`
          }
        </article>
      `
    )
    .join("");
  els.summaryGrid.hidden = false;
}

function renderHome(onNavigate) {
  const impactTeam = getAnchorTeam();
  const anchorMeta = getAnchorMeta();
  const anchorParts = getTeamNameParts(impactTeam);
  const anchorName = anchorMeta?.nickname || anchorMeta?.display_name || "Anchor";

  els.calendarSpotlightPanel.hidden = true;
  els.calendarPanel.hidden = true;
  els.homePanel.hidden = false;
  els.comparePanel.hidden = true;
  els.summaryGrid.hidden = true;
  els.summaryGrid.innerHTML = "";
  els.matchesPanel.hidden = true;
  els.historicalMatchesBody.innerHTML = `<tr><td colspan="4" class="empty-state">Select a team on the left to browse its schedule and results.</td></tr>`;
  els.upcomingMatchesBody.innerHTML = `<tr><td colspan="4" class="empty-state">Select a team on the left to browse its schedule and results.</td></tr>`;
  els.hero.classList.add("hero-home");
  els.homePanel.classList.add("home-dashboard");
  els.heroEyebrow.textContent = "";
  els.teamClub.hidden = !anchorParts.clubName;
  els.teamClub.textContent = anchorParts.clubName;
  els.teamTitle.textContent = anchorParts.teamName || anchorMeta?.display_name || "Anchor";
  els.teamSubtitle.textContent = "";
  els.teamGotsportLink.hidden = true;
  if (els.teamHomeLink) {
    els.teamHomeLink.hidden = true;
  }
  els.heroMeta.hidden = false;
  els.heroMeta.innerHTML = renderHomeHeroMeta(impactTeam);
  els.homePanelTitle.textContent = `${anchorName} home`;
  els.homePanelCopy.textContent = `${anchorName} schedule, recent form, and matchup context from the anchor view.`;

  const upcoming = impactTeam
    ? impactTeam.matches
        .filter((match) => match.match_status === "scheduled")
        .sort((a, b) => `${a.match_date}${a.match_time_utc}`.localeCompare(`${b.match_date}${b.match_time_utc}`))
        .slice(0, 8)
    : [];

  const recent = impactTeam
    ? impactTeam.matches
        .filter((match) => match.completed)
        .sort((a, b) => `${b.match_date}${b.match_time_utc}`.localeCompare(`${a.match_date}${a.match_time_utc}`))
        .slice(0, 8)
    : [];

  els.homeUpcomingBody.innerHTML = upcoming.length
    ? upcoming
        .map((match, index) => {
          const opponentTeam = state.dataset.teams.find((team) => team.team.team_id === match.opponent_team_id);
          const edge = opponentTeam ? getComparisonEdge(opponentTeam, impactTeam, anchorMeta?.display_name) : null;
          const competitionType = classifyCompetitionType(match);
          const coachConflict = findCoachConflict(match);
          const opponentTeamName = opponentTeam?.team?.team_name || match.opponent_team_name || "Opponent";
          const opponentFullName = match.opponent_full_name || opponentTeamName;
          const mobileDateTime = `${formatCompactDateWithWeekday(match.match_date)}${match.match_time_utc ? ` | ${formatMatchTime(match.match_time_utc)}` : ""}`;
          const eventName = match.event_display_name || match.event_name || "";
          const edgeLabel = edge
            ? edge.key === "team"
              ? opponentTeamName
              : edge.label.replace(/^Advantage:\s*/, "")
            : "";
          const mobileEdgeLabel = edge
            ? `Edge: ${edge.key === "team" ? opponentTeamName : edge.key === "impact" ? anchorName : "Even"}`
            : "";
          const opponentRank = opponentTeam ? getStateRankLabel(opponentTeam) : "";
          const opponentNameBlock = `${renderTeamNameBlock(match, {
            clubClass: "name-club compact",
            teamClass: "name-team compact",
          })}${opponentRank ? `<span class="name-rank compact">${escapeHtml(opponentRank)}</span>` : ""}`;
          const opponentHtml = opponentTeam
            ? `<button type="button" class="table-link name-link" data-team-key="${escapeHtml(opponentTeam.team_key)}">${opponentNameBlock}</button>`
            : opponentNameBlock;
          const mobileDetailId = `home-upcoming-detail-${index}`;
          return `
            <tr class="home-mobile-summary-row">
              <td>
                <div class="home-date-stack">
                  <span class="home-date-inline">${escapeHtml(mobileDateTime)}</span>
                  ${competitionType ? `<span class="home-competition-pill home-competition-${escapeHtml(competitionType.key)}">${escapeHtml(competitionType.label)}</span>` : ""}
                  ${coachConflict ? `<span class="home-conflict-note home-conflict-${escapeHtml(coachConflict.severity)}">${escapeHtml(coachConflict.message)}</span>` : ""}
                </div>
                <button
                  type="button"
                  class="home-mobile-row-toggle"
                  aria-expanded="false"
                  aria-controls="${escapeHtml(mobileDetailId)}"
                >
                  <span class="home-mobile-row-main">
                    <span class="home-mobile-row-date">${escapeHtml(mobileDateTime)}</span>
                    <span class="home-mobile-row-team">${escapeHtml(opponentTeamName)}</span>
                  </span>
                  <span class="home-mobile-row-aside">
                    ${mobileEdgeLabel ? `<span class="home-mobile-row-chip">${escapeHtml(mobileEdgeLabel)}</span>` : ""}
                    ${coachConflict ? `<span class="home-mobile-row-status home-conflict-${escapeHtml(coachConflict.severity)}">${escapeHtml(coachConflict.severity === "conflict" ? "Potential conflict" : coachConflict.severity)}</span>` : ""}
                  </span>
                </button>
              </td>
              <td>${opponentHtml}</td>
              <td>${renderFormStrip(opponentTeam, 5, "home-form-strip", impactTeam?.team?.team_id || null)}</td>
              <td>${
                edge
                  ? `<div class="edge-stack home-edge-stack"><div class="home-edge-row"><span class="home-edge-label">Advantage</span><span class="home-edge-pill edge-${escapeHtml(edge.key)}">${escapeHtml(edgeLabel)}</span></div><span class="edge-note home-edge-note">${escapeHtml(edge.strength)} edge. ${edge.subtitle}</span></div>`
                  : "--"
              }</td>
              <td>${renderLastMatchup(impactTeam, opponentTeam?.team?.team_id || match.opponent_team_id)}</td>
            </tr>
            <tr class="home-mobile-detail-row" id="${escapeHtml(mobileDetailId)}" hidden>
              <td colspan="5">
                <div class="home-mobile-detail-card">
                  <div class="home-mobile-detail-header">
                    <div>
                      <div class="home-mobile-detail-value home-mobile-detail-opponent-full">${escapeHtml(opponentFullName)}</div>
                      ${opponentRank ? `<div class="home-mobile-detail-copy">${escapeHtml(opponentRank)}</div>` : ""}
                    </div>
                    ${
                      opponentTeam
                        ? `<button type="button" class="table-link home-mobile-open-team" data-team-key="${escapeHtml(opponentTeam.team_key)}">Opponent details</button>`
                        : ""
                    }
                  </div>
                  <div class="home-mobile-detail-grid">
                    <div class="home-mobile-detail-meta">
                      <span class="home-mobile-inline-label">${escapeHtml(mobileDateTime)}</span>
                      ${eventName ? `<span class="home-mobile-detail-copy">${escapeHtml(eventName)}</span>` : competitionType ? `<span class="home-mobile-detail-copy">${escapeHtml(competitionType.label)}</span>` : ""}
                      ${coachConflict ? `<span class="home-mobile-detail-copy home-conflict-${escapeHtml(coachConflict.severity)}">${escapeHtml(coachConflict.message)}</span>` : ""}
                    </div>
                    <div class="home-mobile-detail-block home-mobile-detail-formline">
                      <span class="home-mobile-inline-label">Form</span>
                      <div class="home-mobile-detail-form">${renderFormStrip(opponentTeam, 5, "home-form-strip", impactTeam?.team?.team_id || null)}</div>
                    </div>
                    <div class="home-mobile-detail-block">
                      <span class="home-mobile-inline-label">Edge</span>
                      ${
                        edge
                          ? `<span class="home-mobile-detail-value">${escapeHtml(edgeLabel)}</span><span class="home-mobile-detail-copy">${escapeHtml(edge.strength)} edge. ${escapeHtml(edge.subtitle)}</span>`
                          : `<span class="home-mobile-detail-copy">No edge read yet.</span>`
                      }
                      </div>
                      <div class="home-mobile-detail-block home-mobile-detail-last">
                        <span class="home-mobile-inline-label">Last matchup</span>
                        ${renderLastMatchupInline(impactTeam, opponentTeam?.team?.team_id || match.opponent_team_id)}
                      </div>
                    </div>
                  </div>
              </td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="5" class="empty-state">No upcoming games found.</td></tr>`;

  els.homeRecentBody.innerHTML = recent.length
    ? recent
        .map((match, index) => {
          const opponentTeam = state.dataset.teams.find((team) => team.team.team_id === match.opponent_team_id);
          const opponentName = opponentTeam?.team?.team_name || match.opponent_team_name || "Opponent";
          const scoreline = formatScoreline(match.team_score, match.opponent_score);
          const resultType = match.result_type || "D";
          const resultLabel = resultType === "W" ? "Won" : resultType === "L" ? "Lost" : "Drew";
          const mobileDetailId = `home-recent-detail-${index}`;
          const opponentHtml = opponentTeam
            ? `<button type="button" class="table-link name-link" data-team-key="${escapeHtml(opponentTeam.team_key)}">${renderTeamNameBlock(match, { clubClass: "name-club compact", teamClass: "name-team compact" })}</button>`
            : renderTeamNameBlock(match, { clubClass: "name-club compact", teamClass: "name-team compact" });
          return `
            <tr class="home-mobile-summary-row">
              <td>
                <span class="home-date-inline">${escapeHtml(formatCompactDateWithWeekday(match.match_date))}</span>
                <button
                  type="button"
                  class="home-mobile-row-toggle"
                  aria-expanded="false"
                  aria-controls="${escapeHtml(mobileDetailId)}"
                >
                  <span class="home-mobile-row-main">
                    <span class="home-mobile-row-date">${escapeHtml(formatCompactDateWithWeekday(match.match_date))}</span>
                    <span class="home-mobile-row-team">${escapeHtml(opponentName)}</span>
                  </span>
                  <span class="home-mobile-row-aside">
                    <span class="compare-result home-result-pill ${
                      resultType === "W"
                        ? "compare-result-win"
                        : resultType === "L"
                          ? "compare-result-loss"
                          : "compare-result-draw"
                    }">${escapeHtml(`${resultType} ${scoreline}`)}</span>
                  </span>
                </button>
              </td>
              <td>${opponentHtml}</td>
              <td><span class="compare-result home-result-pill ${
                resultType === "W"
                  ? "compare-result-win"
                  : resultType === "L"
                    ? "compare-result-loss"
                    : "compare-result-draw"
              }">${escapeHtml(`${resultType} ${scoreline}`)}</span></td>
            </tr>
            <tr class="home-mobile-detail-row" id="${escapeHtml(mobileDetailId)}" hidden>
              <td colspan="3">
                <div class="home-mobile-detail-card">
                  <div class="home-mobile-detail-header">
                      <div>
                        <div class="home-mobile-detail-kicker">Recent result</div>
                        <div class="home-mobile-detail-title">${escapeHtml(opponentName)}</div>
                      </div>
                      ${
                        opponentTeam
                          ? `<button type="button" class="table-link home-mobile-open-team" data-team-key="${escapeHtml(opponentTeam.team_key)}">Opponent details</button>`
                          : ""
                      }
                    </div>
                  <div class="home-mobile-detail-grid">
                    <div class="home-mobile-detail-block">
                      <span class="home-mobile-detail-label">Result</span>
                      <span class="home-mobile-detail-value">${escapeHtml(`${anchorName} ${resultLabel} ${scoreline}`)}</span>
                    </div>
                    <div class="home-mobile-detail-block">
                      <span class="home-mobile-detail-label">Date</span>
                      <span class="home-mobile-detail-value">${escapeHtml(formatCompactDateWithWeekday(match.match_date))}</span>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="3" class="empty-state">No recent games found.</td></tr>`;

  [...els.homePanel.querySelectorAll(".table-link")].forEach((button) => {
    button.addEventListener("click", () => onNavigate(button.dataset.teamKey));
  });

  [...els.homePanel.querySelectorAll(".home-mobile-row-toggle")].forEach((button) => {
    button.addEventListener("click", () => {
      const detailId = button.getAttribute("aria-controls");
      if (!detailId) return;
      const detailRow = els.homePanel.querySelector(`#${detailId}`);
      if (!detailRow) return;
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      detailRow.hidden = expanded;
      button.closest(".home-mobile-summary-row")?.classList.toggle("is-open", !expanded);
    });
  });
}

function renderCalendar() {
  const { label } = getCalendarDateRange();
  const calendarMatches = getClubCalendarMatches();
  const spotlightGroups = getCalendarSpotlightVenueGroups();
  const nextHomeGamesByAnchor = getNextHomeGamesByAnchor();
  const anchorOptions = getCalendarAnchorOptions();
  const activeAnchorIds = getActiveCalendarAnchorIds();
  const allSelected = anchorOptions.length > 0 && activeAnchorIds.length === anchorOptions.length;

  const renderSpotlightCards = (games, emptyText) =>
    games.length
      ? games
          .map(({ anchorLabel, opponentLabel, match }) => {
            const dateTime = `${formatCompactDateWithWeekday(match.match_date)}${match.match_time_utc ? ` | ${formatMatchTime(match.match_time_utc)}` : ""}`;
            return `
              <article class="calendar-spotlight-card">
                <div class="calendar-spotlight-topline">
                  <span class="calendar-anchor-pill">${escapeHtml(anchorLabel)}</span>
                  <span class="calendar-spotlight-badge">Home</span>
                </div>
                <div class="calendar-spotlight-opponent">${escapeHtml(opponentLabel)}</div>
                <div class="calendar-spotlight-meta">${escapeHtml(dateTime)}</div>
                <div class="calendar-spotlight-meta">${escapeHtml(getHomeVenueNickname(match))}</div>
              </article>
            `;
          })
          .join("")
      : `<div class="calendar-home-empty">${escapeHtml(emptyText)}</div>`;

  els.calendarSpotlightPanel.hidden = false;
  els.calendarPanel.hidden = false;
  els.homePanel.hidden = true;
  els.comparePanel.hidden = true;
  els.summaryGrid.hidden = true;
  els.summaryGrid.innerHTML = "";
  els.matchesPanel.hidden = true;
  els.historicalMatchesBody.innerHTML = `<tr><td colspan="4" class="empty-state">Select a team on the left to browse its schedule and results.</td></tr>`;
  els.upcomingMatchesBody.innerHTML = `<tr><td colspan="4" class="empty-state">Select a team on the left to browse its schedule and results.</td></tr>`;
  els.hero.classList.add("hero-home");
  els.homePanel.classList.remove("home-dashboard");
  els.heroEyebrow.textContent = "";
  els.teamClub.hidden = false;
  els.teamClub.textContent = "Rose Tree Soccer Club";
  els.teamTitle.textContent = "Club Calendar";
  els.teamSubtitle.textContent = "A 14-day view across the tracked RTSC anchor teams.";
  els.teamGotsportLink.hidden = true;
  if (els.teamHomeLink) {
    els.teamHomeLink.hidden = true;
  }
  els.heroMeta.hidden = true;
  els.heroMeta.innerHTML = "";
  els.calendarRangeLabel.textContent = `Upcoming games from ${label}.`;
  els.calendarFilterPills.innerHTML = `
    <button type="button" class="calendar-filter-pill ${allSelected ? "is-active" : ""}" data-calendar-filter="__all__">All Teams</button>
    ${anchorOptions
      .map(
        (anchor) =>
          `<button type="button" class="calendar-filter-pill ${activeAnchorIds.includes(anchor.id) ? "is-active" : ""}" data-calendar-filter="${escapeHtml(anchor.id)}">${escapeHtml(anchor.label)}</button>`
      )
      .join("")}
  `;

  els.calendarCherryGrid.innerHTML = renderSpotlightCards(
    spotlightGroups.cherry,
    "No Cherry St. home games are scheduled in the next 30 days."
  );
  els.calendarSleightonGrid.innerHTML = renderSpotlightCards(
    spotlightGroups.sleighton,
    "No Sleighton Park home games are scheduled in the next 30 days."
  );

  els.calendarMatchesBody.innerHTML = calendarMatches.length
    ? calendarMatches
        .map(({ anchorLabel, opponentLabel, match }) => {
          const dateTime = `${formatCompactDateWithWeekday(match.match_date)}${match.match_time_utc ? ` | ${formatMatchTime(match.match_time_utc)}` : ""}`;
          return `
            <tr>
              <td><span class="calendar-anchor-pill">${escapeHtml(anchorLabel)}</span></td>
              <td>${escapeHtml(opponentLabel)}</td>
              <td>${escapeHtml(dateTime)}</td>
              <td>${escapeHtml(getCalendarLocationLabel(match))}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="4" class="empty-state">No upcoming club games found in the next 14 days.</td></tr>`;

  els.calendarHomeGamesGrid.innerHTML = nextHomeGamesByAnchor
    .map(({ anchorLabel, homeGames }) => `
      <article class="calendar-home-card">
        <div class="calendar-home-card-header">
          <span class="calendar-anchor-pill">${escapeHtml(anchorLabel)}</span>
        </div>
        <div class="calendar-home-card-body">
          ${
            homeGames.length
              ? homeGames
                  .map((match) => {
                    const dateTime = `${formatCompactDateWithWeekday(match.match_date)}${match.match_time_utc ? ` | ${formatMatchTime(match.match_time_utc)}` : ""}`;
                    const opponent = match.opponent_full_name || match.opponent_team_name || match.opponent_name || "Opponent";
                    return `
                      <div class="calendar-home-game">
                        <div class="calendar-home-game-title">${escapeHtml(opponent)}</div>
                        <div class="calendar-home-game-meta">${escapeHtml(dateTime)}</div>
                        <div class="calendar-home-game-meta">${escapeHtml(getHomeVenueNickname(match))}</div>
                      </div>
                    `;
                  })
                  .join("")
              : `<div class="calendar-home-empty">No home games scheduled yet.</div>`
          }
        </div>
      </article>
    `)
    .join("");

  [...els.calendarSpotlightPanel.querySelectorAll("[data-calendar-filter]")].forEach((button) => {
    button.addEventListener("click", () => {
      const filterId = button.getAttribute("data-calendar-filter");
      if (!filterId) return;

      if (filterId === "__all__") {
        state.selectedCalendarAnchors = [];
        renderCalendar();
        return;
      }

      const current = getActiveCalendarAnchorIds();
      if (current.includes(filterId)) {
        if (current.length === 1) {
          return;
        }
        state.selectedCalendarAnchors = current.filter((anchorId) => anchorId !== filterId);
      } else if (current.length === anchorOptions.length) {
        state.selectedCalendarAnchors = [filterId];
      } else {
        state.selectedCalendarAnchors = [...current, filterId];
      }

      renderCalendar();
    });
  });
}

function renderCompareRibbon(team) {
  const impactTeam = getAnchorTeam();
  const anchorMeta = getAnchorMeta();
  const headToHead = getHeadToHeadSummary(team, impactTeam);
  const summary = getCommonOpponentSummary(team, impactTeam);
  if (!summary && !headToHead) {
    els.comparePanel.hidden = true;
    els.compareSummary.innerHTML = "";
    return;
  }

  els.comparePanel.hidden = false;
  const teamName = getTeamDisplayName(team);
  const anchorName = anchorMeta?.nickname || anchorMeta?.display_name || "Anchor";
  const anchorNickname = anchorMeta?.nickname || anchorName;
  const commonOpponentIds = summary
    ? new Set(
        team.matches
          .filter((match) => match.completed)
          .map((match) => match.opponent_team_id)
          .filter((id) => impactTeam.matches.some((impactMatch) => impactMatch.completed && impactMatch.opponent_team_id === id))
      )
    : new Set();

  const recentSharedMatches = summary
    ? team.matches
        .filter((match) => match.completed && commonOpponentIds.has(match.opponent_team_id))
        .sort((a, b) => `${b.match_date}${b.match_time_utc}`.localeCompare(`${a.match_date}${a.match_time_utc}`))
        .slice(0, 5)
    : [];

  const renderSharedMatch = (match) => `
    <div class="compare-ribbon-match">
      <span class="compare-ribbon-date">${escapeHtml(formatCompactDateWithWeekday(match.match_date))}</span>
      <span class="compare-ribbon-opponent">${escapeHtml(match.opponent_full_name || getTeamDisplayName(match) || getTeamNameParts(match).teamName)}</span>
      <span class="compare-result ${
        match.result_type === "W"
          ? "compare-result-win"
          : match.result_type === "L"
            ? "compare-result-loss"
            : "compare-result-draw"
      }">${escapeHtml(match.result_type)}</span>
      <span class="compare-ribbon-score">${escapeHtml(formatScoreline(match.team_score, match.opponent_score))}</span>
    </div>
  `;

  els.compareSummary.innerHTML = `
      <article class="compare-ribbon">
        <div class="compare-ribbon-section compare-ribbon-matches">
          <span class="compare-ribbon-kicker">${escapeHtml(`Teams ${anchorNickname} have also played`)}</span>
          <div class="compare-ribbon-match-list">
            ${
              recentSharedMatches.length
                ? recentSharedMatches.map(renderSharedMatch).join("")
              : `<div class="compare-ribbon-empty">No shared-opponent sample yet.</div>`
          }
        </div>
      </div>

        <div class="compare-ribbon-section compare-ribbon-records">
          <span class="compare-ribbon-kicker">Record context</span>
          ${
            summary
            ? `
              <div class="compare-ribbon-record"><span class="compare-ribbon-record-label">${escapeHtml(anchorNickname)} vs shared opponents</span><span class="compare-ribbon-record-value">${escapeHtml(formatRecord(summary.impactRecord))}</span></div>
              <div class="compare-ribbon-record"><span class="compare-ribbon-record-label">${escapeHtml(teamName)} vs shared opponents</span><span class="compare-ribbon-record-value">${escapeHtml(formatRecord(summary.teamRecord))}</span></div>
            `
            : `
              <div class="compare-ribbon-record"><span class="compare-ribbon-record-label">${escapeHtml(anchorNickname)} head-to-head</span><span class="compare-ribbon-record-value">${escapeHtml(formatRecord(headToHead.impactRecord))}</span></div>
              <div class="compare-ribbon-record"><span class="compare-ribbon-record-label">${escapeHtml(teamName)} head-to-head</span><span class="compare-ribbon-record-value">${escapeHtml(formatRecord(headToHead.teamRecord))}</span></div>
              `
          }
        </div>
    </article>
  `;
}

function renderMatches(team, onNavigate) {
  const impactTeam = getAnchorTeam();
  const anchorMeta = getAnchorMeta();
  const anchorNickname = anchorMeta?.nickname || anchorMeta?.display_name || "Anchor";
  const searchValue = "";
  const teamParts = getTeamNameParts(team);
  els.historicalSectionTitle.textContent = `${teamParts.teamName} results and schedule`;
  const rows = team.matches.filter((match) => {
    const haystack = [
      match.opponent_name,
      match.opponent_team_name,
      match.opponent_club_name,
      match.opponent_full_name,
      match.event_display_name,
      match.event_name,
      match.event_qualifier,
      match.venue_name,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(searchValue);
  });

  if (!rows.length) {
    els.historicalMatchesBody.innerHTML = `<tr><td colspan="4" class="empty-state">No historical games found for this filter.</td></tr>`;
    els.upcomingMatchesBody.innerHTML = `<tr><td colspan="4" class="empty-state">No upcoming games found for this filter.</td></tr>`;
    return;
  }

  const historicalRows = rows
    .filter((match) => match.completed || match.match_status === "awaiting_result")
    .sort((a, b) => `${b.match_date}${b.match_time_utc}`.localeCompare(`${a.match_date}${a.match_time_utc}`));
  const upcomingRows = rows
    .filter((match) => match.match_status === "scheduled")
    .sort((a, b) => `${a.match_date}${a.match_time_utc}`.localeCompare(`${b.match_date}${b.match_time_utc}`));

  const renderMatchRow = (match, index, sectionKey) => {
    const resultText = match.completed ? formatScoreline(match.team_score, match.opponent_score) : "--";
    const qualifier = match.event_qualifier || "--";
    const venue = match.venue_name || "--";
    const eventName = match.event_display_name || match.event_name || "Unknown event";
    const mobileDate = formatCompactDateWithWeekday(match.match_date);
    const opponentName = match.opponent_full_name || getTeamDisplayName(match) || getTeamNameParts(match).teamName || "Opponent";
    const mobileDetailId = `${sectionKey}-match-detail-${index}`;
    const opponentTeam = state.dataset.teams.find((item) => item.team.team_id === match.opponent_team_id);
    const resultTone =
      match.result_type === "W" ? "compare-result-win" : match.result_type === "L" ? "compare-result-loss" : "compare-result-draw";
    let compareHtml = "";

    if (impactTeam && impactTeam.team_key !== team.team_key) {
      const impactMatches = impactTeam.matches
        .filter((impactMatch) => impactMatch.opponent_team_id === match.opponent_team_id && impactMatch.completed)
        .sort((a, b) => `${b.match_date}${b.match_time_utc}`.localeCompare(`${a.match_date}${a.match_time_utc}`))
        .slice(0, 3);

      if (impactMatches.length) {
        compareHtml = `
          <div class="compare-box result-secondary">
            <span class="compare-label">${escapeHtml(`${anchorNickname} vs this opponent`)}</span>
            <div class="compare-list">
              ${impactMatches
                .map(
                  (impactMatch) => `
                    <div class="compare-item">
                      <span class="compare-result ${
                        impactMatch.result_type === "W"
                          ? "compare-result-win"
                          : impactMatch.result_type === "L"
                            ? "compare-result-loss"
                            : "compare-result-draw"
                      }">${escapeHtml(impactMatch.result_type)}</span>
                      ${escapeHtml(formatDate(impactMatch.match_date))} |
                      ${escapeHtml(formatScoreline(impactMatch.team_score, impactMatch.opponent_score))}
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>
        `;
      }
    }

    return `
      <tr class="team-mobile-summary-row">
        <td>${escapeHtml(formatDate(match.match_date))}</td>
        <td>
          <div class="opponent-cell">
            ${
              opponentTeam
                ? `<button type="button" class="table-link name-link" data-team-key="${escapeHtml(opponentTeam.team_key)}">${renderTeamNameBlock(match, { clubClass: "name-club compact", teamClass: "name-team compact" })}</button>`
                : renderTeamNameBlock(match, { clubClass: "name-club compact", teamClass: "name-team compact" })
            }
          </div>
          <button
            type="button"
            class="team-mobile-row-toggle"
            aria-expanded="false"
            aria-controls="${escapeHtml(mobileDetailId)}"
          >
            <span class="team-mobile-row-main">
              <span class="team-mobile-row-date">${escapeHtml(mobileDate)}</span>
              <span class="team-mobile-row-team">${escapeHtml(opponentName)}</span>
            </span>
            <span class="team-mobile-row-aside">
              ${match.completed ? `<span class="compare-result ${resultTone}">${escapeHtml(match.result_type)}</span>` : `<span class="team-mobile-row-status">Upcoming</span>`}
              <span class="team-mobile-row-score">${escapeHtml(resultText)}</span>
            </span>
          </button>
        </td>
        <td class="result-cell">
          <div class="result-primary">
            ${match.completed ? `<span class="compare-result ${resultTone}">${escapeHtml(match.result_type)}</span>` : ""}
            <span class="result-score">${escapeHtml(resultText)}</span>
          </div>
          ${compareHtml}
        </td>
        <td class="details-cell">
          <div class="details-primary">${escapeHtml(eventName)}</div>
          <div class="details-secondary">${escapeHtml(qualifier)}${venue !== "--" ? ` | ${escapeHtml(venue)}` : ""}</div>
        </td>
      </tr>
      <tr class="team-mobile-detail-row" id="${escapeHtml(mobileDetailId)}" hidden>
        <td colspan="4">
          <div class="team-mobile-detail-card">
            <div class="team-mobile-detail-header">
              <div>
                <div class="team-mobile-detail-kicker">${match.completed ? "Match result" : "Upcoming match"}</div>
                <div class="team-mobile-detail-title">${escapeHtml(opponentName)}</div>
              </div>
              ${
                opponentTeam
                  ? `<button type="button" class="table-link home-mobile-open-team" data-team-key="${escapeHtml(opponentTeam.team_key)}">Opponent details</button>`
                  : ""
              }
              <div class="team-mobile-detail-result">
                ${match.completed ? `<span class="compare-result ${resultTone}">${escapeHtml(match.result_type)}</span>` : ""}
                <span class="team-mobile-detail-score">${escapeHtml(resultText)}</span>
              </div>
            </div>
            <div class="team-mobile-detail-grid">
              <div class="team-mobile-detail-block">
                <span class="team-mobile-detail-label">Date</span>
                <span class="team-mobile-detail-value">${escapeHtml(mobileDate)}</span>
              </div>
              <div class="team-mobile-detail-block">
                <span class="team-mobile-detail-label">Event</span>
                <span class="team-mobile-detail-value">${escapeHtml(eventName)}</span>
                <span class="team-mobile-detail-copy">${escapeHtml(qualifier)}${venue !== "--" ? ` | ${escapeHtml(venue)}` : ""}</span>
              </div>
              ${
                compareHtml
                  ? `<div class="team-mobile-detail-block team-mobile-detail-compare">
                      <span class="team-mobile-detail-label">${escapeHtml(`${anchorNickname} context`)}</span>
                      ${compareHtml}
                    </div>`
                  : ""
              }
            </div>
          </div>
        </td>
      </tr>
    `;
  };

  els.historicalMatchesBody.innerHTML = historicalRows.length
    ? historicalRows.map((match, index) => renderMatchRow(match, index, "historical")).join("")
    : `<tr><td colspan="4" class="empty-state">No historical games found for this filter.</td></tr>`;

  els.upcomingMatchesBody.innerHTML = upcomingRows.length
    ? upcomingRows.map((match, index) => renderMatchRow(match, index, "upcoming")).join("")
    : `<tr><td colspan="4" class="empty-state">No upcoming games found for this filter.</td></tr>`;

  [...els.matchesPanel.querySelectorAll(".team-mobile-row-toggle")].forEach((button) => {
    button.addEventListener("click", () => {
      const detailId = button.getAttribute("aria-controls");
      if (!detailId) return;
      const detailRow = els.matchesPanel.querySelector(`#${detailId}`);
      if (!detailRow) return;
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      detailRow.hidden = expanded;
      button.closest(".team-mobile-summary-row")?.classList.toggle("is-open", !expanded);
    });
  });

  [...els.matchesPanel.querySelectorAll(".table-link")].forEach((button) => {
    button.addEventListener("click", () => onNavigate(button.dataset.teamKey));
  });
}

export function renderApp({ onNavigateToTeam }) {
  const team = getSelectedTeam();
  renderDatasetMeta();
  renderTeamList(onNavigateToTeam);
  els.homeNavButton.hidden = state.selectedTeamKey === "__home__";
  els.backButton.hidden = true;

  if (state.selectedTeamKey === "__calendar__") {
    renderCalendar();
    return;
  }

  if (state.selectedTeamKey === "__home__" || !team) {
    renderHome(onNavigateToTeam);
    return;
  }

  els.hero.classList.remove("hero-home");
  els.calendarSpotlightPanel.hidden = true;
  els.homePanel.classList.remove("home-dashboard");
  els.calendarPanel.hidden = true;
  const anchorNickname = getAnchorMeta()?.nickname || "Anchor";
  els.heroEyebrow.textContent = `${anchorNickname} opponent`;
  els.heroMeta.hidden = true;
  els.heroMeta.innerHTML = "";
  els.homePanel.hidden = true;
  els.matchesPanel.hidden = false;
  renderHero(team);
  renderSummary(team);
  renderCompareRibbon(team);
  renderMatches(team, onNavigateToTeam);
}
