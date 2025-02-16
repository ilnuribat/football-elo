import { getKnex } from './knex.js';


export async function elo() {
  const getE = (rival, me) => 1 / (1 + 10 ** ((rival - me) / 400));

  const knex = await getKnex();

  const { rows } = await knex.raw(`
  select *
  from matches m
  inner join results r on r.match_id = m.id
  inner join players p on r.player_id = p.id
  -- where m.season = '2025'
  `);

  const tourDates = [...new Set(rows.map((r) => r.date.toISOString()))]
    .sort();

  const INITIAL_ELO = 1500;
  const MINIMUM_MATCHES = 5;

  const playerIds = [...new Set(rows.map((r) => r.player_id))]
    .reduce((prev, curr) => {
      prev.set(curr, {
        rating: INITIAL_ELO,
        matches: 0,
        wins: 0,
        goals: 0,
      });

      return prev;
    }, new Map());

  for (const tourDate of tourDates) {
    const results = rows.filter((r) => r.date.toISOString() === tourDate);
    const teamA = results.filter((r) => r.result === 1);
    const teamB = results.filter((r) => r.result === 0);

    const goalDiff = results
      .map((r) => {
        const goals = r.result === 1 ? r.goals : -r.goals;

        return goals;
      })
      .reduce((prev, curr) => prev + curr, 0);
    let KGoalDiff = 0; // зависимость К от разницы мячей
    if (goalDiff > 3) {
      KGoalDiff = 5;
    }
    if (goalDiff > 6) {
      KGoalDiff = 10;
    }

    const avgTeamAElo = teamA.reduce((acc, curr) => acc + playerIds.get(curr.player_id).rating, 0) / teamA.length;
    const avgTeamBElo = teamB.reduce((acc, curr) => acc + playerIds.get(curr.player_id).rating, 0) / teamB.length;

    const EforTeamA = getE(avgTeamAElo, avgTeamBElo);
    const EforTeamB = getE(avgTeamBElo, avgTeamAElo);
    const SforTeamA = 1;
    const SforTeamB = 0;

    console.log([
      ...Object.values({
        tour: results[0].tour,
        avgA: Math.round(avgTeamAElo),
        avgB: Math.round(avgTeamBElo),
        eloDiff: Math.round(avgTeamAElo - avgTeamBElo),
        goalDiff,
        newElo: Math.round((15 + goalDiff) * (SforTeamA - EforTeamA)),
      }),
    ]);


    teamA.forEach((p) => {
      const prev = playerIds.get(p.player_id);
      let K = 15 + KGoalDiff;

      if (prev.matches < MINIMUM_MATCHES) {
        K += 10;
      }

      const EloDiffTeamA = K * (SforTeamA - EforTeamA);
      playerIds.set(p.player_id, {
        rating: prev.rating + EloDiffTeamA,
        matches: prev.matches + 1,
        wins: prev.wins + 1,
        goals: prev.goals + (p.season === '2025' ? p.goals : 0),
      });
    });
    teamB.forEach((p) => {
      const prev = playerIds.get(p.player_id);
      let K = 15 + KGoalDiff;

      if (prev.matches < MINIMUM_MATCHES) {
        K += 10;
      }
      const EloDiffTeamB = K * (SforTeamB - EforTeamB);
      playerIds.set(p.player_id, {
        rating: prev.rating + EloDiffTeamB,
        matches: prev.matches + 1,
        wins: prev.wins,
        goals: prev.goals + (p.season === '2025' ? p.goals : 0),
      });
    });
  }

  const eloRating = [...playerIds.entries()]
    .map(([id, info]) => ({
      id,
      name: rows.find((r) => r.player_id === id).name,
      rating: Math.round(info.rating * 1e0) / 1e0,
      matches: info.matches,
      wins: info.wins,
      loses: info.matches - info.wins,
      goals: info.goals,
    }))
    .filter((p) => p.matches >= MINIMUM_MATCHES)
    .sort((a, b) => b.rating - a.rating);

  console.log(['name', 'rating', 'matches', 'wins', 'loses'].join('\t'));
  eloRating.forEach((e) => {
    console.log([e.name, e.rating, e.matches, e.wins, e.loses].join('\t'));
  });
  console.table(eloRating);
}


async function main() {
  console.log('start', new Date());

  await elo();
}

main().catch((e) => {
  console.log(e);

  process.exit(1);
});

