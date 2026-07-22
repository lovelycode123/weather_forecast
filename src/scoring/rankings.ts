import { ACTIVITIES, type Activity, type ActivityDayScore, type ScoredDay } from "./types.js";

export type ActivityWeekSummary = {
  activity: Activity;
  rank: number;
  averageScore: number;
  bestDay: string;
  worstDay: string;
  daily: ActivityDayScore[];
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Per-activity week roll-up: average score, best/worst day dates,
 * then sort activities best-first and assign rank (1 = best).
 */
export function buildRankings(scoredDays: ScoredDay[]): ActivityWeekSummary[] {
  if (scoredDays.length === 0) return [];

  const summaries = ACTIVITIES.map((activity) => {
    const dated = scoredDays.map((day) => {
      const score = day.scores.find((s) => s.activity === activity);
      if (!score) {
        throw new Error(`Missing score for ${activity} on ${day.weather.date}`);
      }
      return { date: day.weather.date, score };
    });

    const averageScore = round1(
      dated.reduce((sum, d) => sum + d.score.score, 0) / dated.length,
    );

    let best = dated[0]!;
    let worst = dated[0]!;
    for (const entry of dated) {
      if (entry.score.score > best.score.score) best = entry;
      if (entry.score.score < worst.score.score) worst = entry;
    }

    return {
      activity,
      averageScore,
      bestDay: best.date,
      worstDay: worst.date,
      daily: dated.map((d) => d.score),
    };
  });

  summaries.sort((a, b) => {
    if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
    return ACTIVITIES.indexOf(a.activity) - ACTIVITIES.indexOf(b.activity);
  });

  return summaries.map((summary, index) => ({
    ...summary,
    rank: index + 1,
  }));
}
