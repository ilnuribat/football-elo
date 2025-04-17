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
        history: [{
          tour: null,
          matchResult: null, // draw, lose
          newElo: INITIAL_ELO,
          diff: 0,
          goals: 0,
        }],
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

    // per player in match
    results.forEach((p) => {
      const getPlayerResult = (playData) => {
        if (playData.result === 'ab') {
          return 'draw';
        }

        return playData.result === playData.team ? 'win' : 'lose';
      };

      const playerResult = getPlayerResult(p);

      const prev = playerIds.get(p.player_id);
      let K = 15 + KGoalDiff;

      if (prev.matches < MINIMUM_MATCHES) {
        K += 10;
      }
      let EloDiff;
      if (p.team === 'a') {
        EloDiff = K * (SforTeamA - EforTeamA);
      } else {
        EloDiff = K * (SforTeamB - EforTeamB);
      }

      matchPlayers.set(`${match.id}:${p.player_id}`, {
        ...p,
        prevElo: prev.rating,
        newElo: prev.rating + EloDiff,
      });
      playerIds.set(p.player_id, {
        ...prev,
        rating: prev.rating + EloDiff,
        matches: prev.matches + (p.season === '2025' ? 1 : 0),
        wins: prev.wins + (p.season === '2025' && playerResult === 'win' ? 1 : 0),
        loses: prev.loses + (p.season === '2025' && playerResult === 'lose' ? 1 : 0),
        draws: prev.draws + (p.season === '2025' && playerResult === 'draw' ? 1 : 0),
        goals: prev.goals + (p.season === '2025' ? p.goals : 0),
        history: [...prev.history, {
          tour: p.tour,
          matchResult: playerResult, // draw, lose
          newElo: Math.round(prev.rating + EloDiff),
          diff: Math.round(EloDiff),
          goals: p.goals,
        }],
      });
    });
  }


  console.log('all rating');
  const eloRating = [...playerIds.entries()]
    .map(([id, info]) => ({
      id,
      name: players.find((r) => r.id === id).name,
      rating: Math.round(info.rating * 1e0) / 1e0,
      matches: info.matches,
      wins: info.wins,
      loses: info.loses,
      draws: info.draws,
      goals: info.goals,
    }))
    .filter((p) => p.matches >= 1)
    .sort((a, b) => b.rating - a.rating);

  // console.log(['name', 'team', 'rating', 'matches', 'wins'].join('\t'));
  // eloRating.forEach((e) => {
  //   console.log([e.name, e.team, e.rating, e.matches, e.wins, e.loses].join('\t'));
  // });
  console.table(eloRating);

  // next match prediction
  console.log('--- next match thoughts ----');
  const teamA = [21, 31, 50, 20, 38, 4, 19, 37, 7];
  const teamB = [1, 13, 9, 32, 47, 11, 10, 3, 27];

  const { teamA: teamARating, teamB: teamBRating } = eloRating.reduce((prev, curr) => ({
    teamA: prev.teamA + (teamA.includes(curr.id) ? curr.rating : 0),
    teamB: prev.teamB + (teamB.includes(curr.id) ? curr.rating : 0),
  }), { teamA: 0, teamB: 0 });
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

  console.log('Vadim Akmurzin:');
  console.table(playerIds.get(50).history);
  console.log('Ilnur:');
  console.table(playerIds.get(10).history);
}
