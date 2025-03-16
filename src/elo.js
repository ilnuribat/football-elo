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

  const matches = await knex('matches').orderBy('date');
  const players = await knex('players');

  const matchPlayers = new Map();

  for (const match of matches) {
    for (const player of players) {
      matchPlayers.set(`${match.id}:${player.id}`, {});
    }
  }


  const INITIAL_ELO = 1500;
  const MINIMUM_MATCHES = 5;

  const playerIds = players
    .reduce((prev, curr) => {
      prev.set(curr.id, {
        name: curr.name,
        rating: INITIAL_ELO,
        matches: 0,
        wins: 0,
        loses: 0,
        draws: 0,
        nonPart: 0,
        goals: 0,
      });

      return prev;
    }, new Map());


  console.log([
    'tour', 'result', 'avgA', 'avgB', 'eloDiff', 'goalDf', 'KGoalDf', 'newElo',
    'EA', 'EB', 'SA', 'SB',
  ].join('\t'));
  for (const match of matches) {
    const results = rows.filter((r) => r.match_id === match.id);
    const teamA = results.filter((r) => r.team === 'a');
    const teamB = results.filter((r) => r.team === 'b');

    const goalDiff = results
      .map((r) => {
        const goals = r.team === 'a' ? r.goals : -r.goals;
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
    if (goalDiff > 9) {
      KGoalDiff = 15;
    }

    const avgTeamAElo = teamA.reduce((acc, curr) => acc + playerIds.get(curr.player_id).rating, 0) / teamA.length;
    const avgTeamBElo = teamB.reduce((acc, curr) => acc + playerIds.get(curr.player_id).rating, 0) / teamB.length;

    const EforTeamA = getE(avgTeamAElo, avgTeamBElo);
    const EforTeamB = getE(avgTeamBElo, avgTeamAElo);

    const SResultMap = {
      a: { a: 1, b: 0 },
      b: { a: 0, b: 1 },
      ab: { a: 0.5, b: 0.5 },
    };

    const { a: SforTeamA, b: SforTeamB } = SResultMap[teamA[0].result];


    console.log([
      ...Object.values({
        tour: results[0].tour,
        result: results[0].result,
        avgA: Math.round(avgTeamAElo),
        avgB: Math.round(avgTeamBElo),
        eloDiff: Math.round(avgTeamAElo - avgTeamBElo),
        goalDiff,
        KGoalDiff,
        newElo: Math.round((15 + goalDiff) * (SforTeamA - EforTeamA)),
        EA: `${EforTeamA}`.slice(0, 5),
        EB: `${EforTeamB}`.slice(0, 5),
        SA: `${SforTeamA}`.slice(0, 5),
        SB: `${SforTeamB}`.slice(0, 5),
      }),
    ].join('\t'));

    teamA.forEach((p) => {
      const prev = playerIds.get(p.player_id);
      let K = 15 + KGoalDiff;

      if (prev.matches < MINIMUM_MATCHES) {
        K += 10;
      }
      const EloDiffTeamA = K * (SforTeamA - EforTeamA);
      matchPlayers.set(`${match.id}:${p.player_id}`, {
        ...p,
        prevElo: prev.rating,
        newElo: prev.rating + EloDiffTeamA,
      });
      playerIds.set(p.player_id, {
        ...playerIds.get(p.player_id),
        rating: prev.rating + EloDiffTeamA,
        matches: prev.matches + 1,
        wins: prev.wins + (p.team === p.result ? 1 : 0),
        loses: prev.loses + (p.result !== 'ab' && p.team !== p.result ? 1 : 0),
        draws: prev.draws + (p.result === 'ab' ? 1 : 0),
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
      matchPlayers.set(`${match.id}:${p.player_id}`, {
        ...p,
        prevElo: prev.rating,
        newElo: prev.rating + EloDiffTeamB,
      });
      playerIds.set(p.player_id, {
        ...playerIds.get(p.player_id),
        rating: prev.rating + EloDiffTeamB,
        matches: prev.matches + 1,
        wins: prev.wins + (p.team === p.result ? 1 : 0),
        loses: prev.loses + (p.result !== 'ab' && p.team !== p.result ? 1 : 0),
        draws: prev.draws + (p.result === 'ab' ? 1 : 0),
        goals: prev.goals + (p.season === '2025' ? p.goals : 0),
      });
    });
  }

  // next match prediction
  console.log('--- next match thoughts ----');
  const teamA = [11, 10, 19, 12, 50, 5, 7, 15, 1];
  const teamB = [13, 44, 47, 29, 2, 4, 17, 31, 20];

  const eloRating = [...playerIds.entries()]
    .map(([id, info]) => ({
      id,
      team: teamA.includes(id) ? 1 : 0,
      name: players.find((r) => r.id === id).name,
      rating: Math.round(info.rating * 1e0) / 1e0,
      matches: info.matches,
      wins: info.wins,
      // loses: info.matches - info.wins,
      goals: info.goals,
    }))
    .filter((p) => p.matches >= 3)
  // .filter((p) => [...teamA, ...teamB].includes(p.id))
    .sort((a, b) => b.rating - a.rating);

  // console.log(['name', 'team', 'rating', 'matches', 'wins'].join('\t'));
  // eloRating.forEach((e) => {
  //   console.log([e.name, e.team, e.rating, e.matches, e.wins, e.loses].join('\t'));
  // });
  console.table(eloRating);

  const { teamA: teamARating, teamB: teamBRating } = eloRating.reduce((prev, curr) => {
    if (curr.team === 0) {
      return {
        teamA: prev.teamA + curr.rating,
        teamB: prev.teamB,
      };
    }

    return {
      teamA: prev.teamA,
      teamB: prev.teamB + curr.rating,
    };
  }, { teamA: 0, teamB: 0 });
  const avgTeamA = Math.round(teamARating / teamA.length);
  const avgTeamB = Math.round(teamBRating / teamB.length);

  console.log({
    teamARating,
    teamBRating,
    avgTeamA,
    avgTeamB,
    avgDiff: avgTeamA - avgTeamB,
    diff: teamARating - teamBRating,
  });
}
