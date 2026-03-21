export function formatDate(value) {
  if (!value) return "Unknown";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatShortDate(value) {
  if (!value) return "Unknown";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
  });
}

export function formatCompactDate(value) {
  if (!value) return "Unknown";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatCompactDateWithWeekday(value) {
  if (!value) return "Unknown";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatMatchTime(value) {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatScoreline(teamScore, opponentScore) {
  const leftMissing = teamScore === null || teamScore === undefined || teamScore === "";
  const rightMissing = opponentScore === null || opponentScore === undefined || opponentScore === "";

  if (leftMissing && rightMissing) {
    return "--";
  }

  return `${leftMissing ? "--" : teamScore}-${rightMissing ? "--" : opponentScore}`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function getStateRankLabel(team) {
  const state = team?.team?.state;
  const rank = team?.team?.rankings?.association_rank;
  if (!rank && rank !== 0) return "State rank unavailable";
  if (state) return `${state} State #${rank}`;
  return `State Rank #${rank}`;
}

export function getTeamDisplayName(team) {
  return team?.team?.full_name || team?.requested_name || "Unknown Team";
}

export function getTeamNameParts(teamLike) {
  return {
    clubName: teamLike?.team?.club_name || teamLike?.opponent_club_name || "",
    teamName:
      teamLike?.team?.team_name ||
      teamLike?.opponent_team_name ||
      teamLike?.opponent_name ||
      teamLike?.requested_name ||
      "Unknown Team",
  };
}

export function renderTeamNameBlock(teamLike, options = {}) {
  const { clubName, teamName } = getTeamNameParts(teamLike);
  const clubClass = options.clubClass || "name-club";
  const teamClass = options.teamClass || "name-team";
  return `
    <div class="name-block">
      ${clubName ? `<div class="${clubClass}">${escapeHtml(clubName)}</div>` : ""}
      <div class="${teamClass}">${escapeHtml(teamName)}</div>
    </div>
  `;
}
