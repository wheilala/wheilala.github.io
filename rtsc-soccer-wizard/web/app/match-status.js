// Unreported games must not disappear behind the usual recent-results limit.
export function getRecentGames(matches = [], limit = 8) {
  const ordered = matches
    .filter(match => match.completed || match.match_status === "awaiting_result")
    .sort((a, b) => `${b.match_date}${b.match_time_utc || ""}`.localeCompare(`${a.match_date}${a.match_time_utc || ""}`));
  const visible = new Set(ordered.slice(0, limit));
  return ordered.filter(match => visible.has(match) || (!match.completed && match.match_status === "awaiting_result"));
}

export function getRecentResult(match) {
  if (!match.completed) {
    return { type: "?", text: "? No score", label: "No score recorded; confirm whether played or needs a makeup", tone: "compare-result-pending" };
  }
  const type = match.result_type || (match.team_score > match.opponent_score ? "W" : match.team_score < match.opponent_score ? "L" : "D");
  return {
    type,
    text: `${type} ${match.team_score}-${match.opponent_score}`,
    label: `${type === "W" ? "Won" : type === "L" ? "Lost" : "Drew"} ${match.team_score}-${match.opponent_score}`,
    tone: type === "W" ? "compare-result-win" : type === "L" ? "compare-result-loss" : "compare-result-draw",
  };
}
