export function summarizeRecord(matches) {
  return matches.reduce(
    (acc, match) => {
      if (!match.completed) return acc;
      acc.games += 1;
      if (match.result_type === "W") acc.wins += 1;
      if (match.result_type === "L") acc.losses += 1;
      if (match.result_type === "D") acc.draws += 1;
      return acc;
    },
    { wins: 0, losses: 0, draws: 0, games: 0 }
  );
}

export function getRecentCompletedMatches(team, limit = 5) {
  if (!team?.matches) return [];
  return team.matches
    .filter((match) => match.completed)
    .sort((a, b) => `${b.match_date}${b.match_time_utc}`.localeCompare(`${a.match_date}${a.match_time_utc}`))
    .slice(0, limit);
}

export function formatRecord(record) {
  return `${record.wins}-${record.losses}-${record.draws}`;
}

export function getPointsPerGame(record) {
  return record.games ? (record.wins * 3 + record.draws) / record.games : 0;
}

function summarizeGoals(matches, teamIsAnchor = false) {
  return matches.reduce(
    (acc, match) => {
      if (!match.completed) return acc;
      acc.goalsFor += teamIsAnchor ? match.opponent_score : match.team_score;
      acc.goalsAgainst += teamIsAnchor ? match.team_score : match.opponent_score;
      return acc;
    },
    { goalsFor: 0, goalsAgainst: 0 }
  );
}

function getResultPoints(resultType) {
  if (resultType === "W") return 3;
  if (resultType === "D") return 1;
  return 0;
}

function getDaysSinceMatch(matchDate) {
  if (!matchDate) return 9999;
  const matchTime = new Date(`${matchDate}T12:00:00`).getTime();
  const now = Date.now();
  return Math.max(0, (now - matchTime) / 86400000);
}

function getRecencyWeight(matchDate) {
  const days = getDaysSinceMatch(matchDate);
  if (days <= 180) return 1;
  if (days <= 365) return 0.75;
  return 0.5;
}

function summarizeWeightedPerformance(matches, teamIsAnchor = false) {
  return matches.reduce(
    (acc, match) => {
      if (!match.completed) return acc;

      const weight = getRecencyWeight(match.match_date);
      const goalsFor = teamIsAnchor ? match.opponent_score : match.team_score;
      const goalsAgainst = teamIsAnchor ? match.team_score : match.opponent_score;
      const resultType = goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D";

      acc.weightedGames += weight;
      acc.weightedPoints += getResultPoints(resultType) * weight;
      acc.weightedGoalDiff += (goalsFor - goalsAgainst) * weight;
      return acc;
    },
    { weightedGames: 0, weightedPoints: 0, weightedGoalDiff: 0 }
  );
}

function getGamesConfidence(games) {
  if (!games) return 0;
  return Math.min(1, Math.sqrt(games / 6));
}

function getSummaryMetrics(summary) {
  if (!summary) return null;

  const teamWeightedGames = summary.teamWeighted.weightedGames || 0;
  const impactWeightedGames = summary.impactWeighted.weightedGames || 0;
  const teamPpg = teamWeightedGames ? summary.teamWeighted.weightedPoints / teamWeightedGames : 0;
  const impactPpg = impactWeightedGames ? summary.impactWeighted.weightedPoints / impactWeightedGames : 0;
  const teamGdpg = teamWeightedGames ? summary.teamWeighted.weightedGoalDiff / teamWeightedGames : 0;
  const impactGdpg = impactWeightedGames ? summary.impactWeighted.weightedGoalDiff / impactWeightedGames : 0;

  return { teamPpg, impactPpg, teamGdpg, impactGdpg };
}

function getSummaryDirectionalScore(summary) {
  if (!summary) return 0;
  const metrics = getSummaryMetrics(summary);
  if (!metrics) return 0;
  const ppgGap = metrics.impactPpg - metrics.teamPpg;
  const gdpgGap = metrics.impactGdpg - metrics.teamGdpg;
  const rawScore = ppgGap * 18 + gdpgGap * 6;
  return rawScore * (summary.confidence || 0);
}

function getStrengthLabel(score) {
  const absScore = Math.abs(score);
  if (absScore < 10) return "Even";
  if (absScore < 22) return "Slight";
  if (absScore < 40) return "Moderate";
  return "Strong";
}

export function classifyMatchFormat(match) {
  const text = `${match.event_name || ""} ${match.event_display_name || ""}`.toLowerCase();
  if (/league|acela|cls|central league|inter-county/.test(text)) return "league";
  if (/cup|classic|tournament|invitational|showdown/.test(text)) return "tournament";
  return "other";
}

export function classifyCompetitionType(match) {
  const text = `${match.event_name || ""} ${match.event_display_name || ""}`.toLowerCase();
  if (/challenge cup|state cup/.test(text)) return { key: "cup", label: "Cup" };
  if (/league|acela|cls|central league|inter-county/.test(text)) return { key: "league", label: "League" };
  if (/classic|tournament|invitational|showdown|\bcup\b/.test(text)) return { key: "tournament", label: "Tournament" };
  return null;
}

export function getTrendAnalysis(team) {
  const completed = team.matches
    .filter((match) => match.completed)
    .sort((a, b) => `${a.match_date}${a.match_time_utc}`.localeCompare(`${b.match_date}${b.match_time_utc}`));

  if (completed.length < 6) {
    return { value: "No clear trend", detail: "Not enough completed games for a trend read.", tone: "neutral" };
  }

  const splitIndex = Math.floor(completed.length / 2);
  const older = completed.slice(0, splitIndex);
  const recent = completed.slice(splitIndex);
  const olderRecord = summarizeRecord(older);
  const recentRecord = summarizeRecord(recent);
  const olderPpg = getPointsPerGame(olderRecord);
  const recentPpg = getPointsPerGame(recentRecord);
  const diff = recentPpg - olderPpg;

  if (diff > 0.35) return { value: "Getting stronger", detail: `Recent ${formatRecord(recentRecord)} vs older ${formatRecord(olderRecord)}.`, tone: "positive" };
  if (diff < -0.35) return { value: "Cooling off", detail: `Recent ${formatRecord(recentRecord)} vs older ${formatRecord(olderRecord)}.`, tone: "negative" };
  return { value: "No clear trend", detail: `Recent ${formatRecord(recentRecord)} vs older ${formatRecord(olderRecord)}.`, tone: "neutral" };
}

export function getHomeAwayAnalysis(team) {
  const completed = team.matches.filter((match) => match.completed);
  const homeRecord = summarizeRecord(completed.filter((match) => match.home_away === "home"));
  const awayRecord = summarizeRecord(completed.filter((match) => match.home_away === "away"));

  if (homeRecord.games < 4 || awayRecord.games < 4) {
    return { value: "No clear split", detail: "Home/away sample is still too small to read clearly.", tone: "neutral" };
  }

  const homePpg = getPointsPerGame(homeRecord);
  const awayPpg = getPointsPerGame(awayRecord);
  const diff = homePpg - awayPpg;

  if (diff > 0.75) return { value: "Home lean", detail: `${formatRecord(homeRecord)} home vs ${formatRecord(awayRecord)} away.`, tone: "positive" };
  if (diff < -0.75) return { value: "Away lean", detail: `${formatRecord(awayRecord)} away vs ${formatRecord(homeRecord)} home.`, tone: "positive" };
  return { value: "No clear split", detail: `${formatRecord(homeRecord)} home vs ${formatRecord(awayRecord)} away.`, tone: "neutral" };
}

export function getFormatAnalysis(team) {
  const completed = team.matches.filter((match) => match.completed);
  const leagueRecord = summarizeRecord(completed.filter((match) => classifyMatchFormat(match) === "league"));
  const tournamentRecord = summarizeRecord(completed.filter((match) => classifyMatchFormat(match) === "tournament"));

  if (!leagueRecord.games && !tournamentRecord.games) {
    return { value: "No clear split", detail: "No league or tournament classification available yet.", tone: "neutral" };
  }
  if (!leagueRecord.games) return { value: "Tournament-only sample", detail: `${formatRecord(tournamentRecord)} in tournaments.`, tone: "neutral" };
  if (!tournamentRecord.games) return { value: "League-only sample", detail: `${formatRecord(leagueRecord)} in league play.`, tone: "neutral" };

  const leaguePpg = getPointsPerGame(leagueRecord);
  const tournamentPpg = getPointsPerGame(tournamentRecord);
  const diff = leaguePpg - tournamentPpg;

  if (diff > 0.5) return { value: "League stronger", detail: `${formatRecord(leagueRecord)} league vs ${formatRecord(tournamentRecord)} tournament.`, tone: "positive" };
  if (diff < -0.5) return { value: "Tournament stronger", detail: `${formatRecord(tournamentRecord)} tournament vs ${formatRecord(leagueRecord)} league.`, tone: "positive" };
  return { value: "No clear split", detail: `${formatRecord(leagueRecord)} league vs ${formatRecord(tournamentRecord)} tournament.`, tone: "neutral" };
}

export function getHeadToHeadSummary(team, impactTeam) {
  if (!impactTeam || impactTeam.team_key === team.team_key) return null;

  const headToHeadMatches = team.matches.filter(
    (match) => match.completed && match.opponent_team_id === impactTeam.team.team_id
  );

  if (!headToHeadMatches.length) return null;

  const teamRecord = summarizeRecord(headToHeadMatches);
  const impactRecord = { wins: teamRecord.losses, losses: teamRecord.wins, draws: teamRecord.draws, games: teamRecord.games };
  const teamGoals = summarizeGoals(headToHeadMatches);
  const impactGoals = { goalsFor: teamGoals.goalsAgainst, goalsAgainst: teamGoals.goalsFor };

  return {
    games: headToHeadMatches.length,
    teamRecord,
    impactRecord,
    teamGoals,
    impactGoals,
    teamWeighted: summarizeWeightedPerformance(headToHeadMatches),
    impactWeighted: summarizeWeightedPerformance(headToHeadMatches, true),
    confidence: getGamesConfidence(headToHeadMatches.length),
  };
}

function getSummaryFavorite(summary) {
  if (!summary) return null;
  const score = getSummaryDirectionalScore(summary);
  if (score > 6) return "impact";
  if (score < -6) return "team";
  return null;
}

export function getCommonOpponentSummary(team, impactTeam) {
  if (!impactTeam || impactTeam.team_key === team.team_key) return null;

  const teamCompleted = team.matches.filter((match) => match.completed);
  const impactCompleted = impactTeam.matches.filter((match) => match.completed);
  const teamOpponentIds = new Set(teamCompleted.map((match) => match.opponent_team_id));
  const impactOpponentIds = new Set(impactCompleted.map((match) => match.opponent_team_id));
  const commonOpponentIds = [...teamOpponentIds].filter((id) => impactOpponentIds.has(id));
  if (!commonOpponentIds.length) return null;

  const commonIdSet = new Set(commonOpponentIds);
  const teamCommonMatches = teamCompleted.filter((match) => commonIdSet.has(match.opponent_team_id));
  const impactCommonMatches = impactCompleted.filter((match) => commonIdSet.has(match.opponent_team_id));
  const teamRecord = summarizeRecord(teamCommonMatches);
  const impactRecord = summarizeRecord(impactCommonMatches);
  const teamGoals = summarizeGoals(teamCommonMatches);
  const impactGoals = summarizeGoals(impactCommonMatches);

  return {
    commonOpponentCount: commonOpponentIds.length,
    teamRecord,
    impactRecord,
    teamGoals,
    impactGoals,
    teamWeighted: summarizeWeightedPerformance(teamCommonMatches),
    impactWeighted: summarizeWeightedPerformance(impactCommonMatches),
    confidence: Math.min(getGamesConfidence(teamCommonMatches.length), getGamesConfidence(impactCommonMatches.length)),
  };
}

export function getComparisonEdge(team, impactTeam, anchorLabel) {
  const headToHead = getHeadToHeadSummary(team, impactTeam);
  const common = getCommonOpponentSummary(team, impactTeam);
  const headToHeadFavorite = getSummaryFavorite(headToHead);
  const commonFavorite = getSummaryFavorite(common);
  const headToHeadScore = getSummaryDirectionalScore(headToHead);
  const commonScore = getSummaryDirectionalScore(common);
  const hasHeadToHead = Boolean(headToHead);
  const hasCommon = Boolean(common);

  let combinedScore = 0;
  let subtitle = "No comparison data yet.";
  let source = "none";

  if (hasHeadToHead && hasCommon && headToHeadFavorite && commonFavorite && headToHeadFavorite !== commonFavorite) {
    combinedScore = 0;
    subtitle = "Mixed signals: head-to-head conflicts with common opponents.";
    source = "mixed";
  } else if (hasHeadToHead) {
    const h2hWeight = hasCommon ? 0.68 : 1;
    const commonWeight = hasCommon ? 0.32 : 0;
    combinedScore = headToHeadScore * h2hWeight + commonScore * commonWeight;

    if (!headToHeadFavorite) {
      combinedScore *= 0.35;
      subtitle = hasCommon ? "Head-to-head is even; common opponents are only a light tiebreaker." : "Head-to-head is even so no clear edge.";
      source = "head-to-head";
    } else if (hasCommon && commonFavorite === headToHeadFavorite) {
      subtitle = "Head-to-head is supported by common opponents.";
      source = "aligned";
    } else if (hasCommon && !commonFavorite) {
      subtitle = "Driven by head-to-head; common-opponent profile is neutral.";
      source = "head-to-head";
    } else {
      subtitle = "Driven by head-to-head.";
      source = "head-to-head";
    }
  } else if (hasCommon) {
    combinedScore = commonScore;
    subtitle = "No direct meetings; edge is based on common opponents.";
    source = "common-opponents";
  }

  const strength = getStrengthLabel(combinedScore);
  if (strength === "Even") return { key: "even", label: "Advantage: Even", strength, subtitle, source };

  const key = combinedScore > 0 ? "impact" : "team";
  const sideLabel = key === "impact" ? anchorLabel || "Anchor" : "Opponent";
  return { key, label: `Advantage: ${sideLabel}`, strength, subtitle, source };
}
