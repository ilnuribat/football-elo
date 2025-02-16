import { getKnex } from './knex.js';

export async function getTopGoalScores() {
  const knex = await getKnex();

  const { rows } = await knex.raw(`
    select
      p.id as id,
      max(p.name) as name,
      sum(r.goals) as goals,
      count(m.id) as matches
    from matches m
    inner join results r on m.id = r.match_id
    inner join players p on p.id = r.player_id
    where m.season = '2025'
    group by p.id
    order by goals desc, matches asc
  `);

  console.log(['name', 'goals', 'matches'].join(';'));
  rows.forEach((r) => {
    console.log([r.name, r.goals, r.matches].join(';'));
  });
}

export async function elo() {
  const getE = (rival, me) => 1 / (1 + 10 ** ((rival - me) / 400));

  const knex = await getKnex();

  const { rows } = await knex.raw(`
  select *
  from matches m
  inner join results r on r.match_id = m.id
  inner join players p on r.player_id = p.id
  where m.season = '2025'
  `);

  const tours = [...new Set(rows.map((r) => r.tour))]
    .sort((a, b) => a - b);

  const INITIAL_ELO = 1500;

  const playerIds = [...new Set(rows.map((r) => r.player_id))]
    .reduce((prev, curr) => {
      prev.set(curr, {
        rating: INITIAL_ELO,
        matches: 0,
        wins: 0,
      });

      return prev;
    }, new Map());

  for (const tour of tours) {
    const results = rows.filter((r) => r.tour === tour);
    const teamA = results.filter((r) => r.result === 1);
    const teamB = results.filter((r) => r.result === 0);


    const avgTeamAElo = teamA.reduce((a, c) => a + playerIds.get(c.player_id).rating, 0) / teamA.length;
    const avgTeamBElo = teamB.reduce((a, c) => a + playerIds.get(c.player_id).rating, 0) / teamB.length;


    const K = 30;
    const EforTeamA = getE(avgTeamAElo, avgTeamBElo);
    const EforTeamB = getE(avgTeamBElo, avgTeamAElo);
    const SforTeamA = 1;
    const SforTeamB = 0;

    const EloDiffTeamA = K * (SforTeamA - EforTeamA);
    const EloDiffTeamB = K * (SforTeamB - EforTeamB);

    teamA.forEach((p) => {
      const prev = playerIds.get(p.player_id);
      playerIds.set(p.player_id, {
        rating: prev.rating + EloDiffTeamA,
        matches: prev.matches + 1,
        wins: prev.wins + 1,
      });
    });
    teamB.forEach((p) => {
      const prev = playerIds.get(p.player_id);
      playerIds.set(p.player_id, {
        rating: prev.rating + EloDiffTeamB,
        matches: prev.matches + 1,
        wins: prev.wins,
      });
    });
  }

  const eloRating = [...playerIds.entries()]
    .map(([id, { matches, rating, wins }]) => ({
      id,
      rating: Math.round(rating * 1e0) / 1e0,
      matches,
      wins,
      name: rows.find((r) => r.player_id === id).name,
    }))
    .sort((a, b) => b.rating - a.rating);

  console.log(['name', 'rating', 'matches', 'wins'].join('\t'));
  eloRating.forEach((e) => {
    console.log([e.name, e.rating, e.matches, e.wins].join('\t'));
  });
  console.table(eloRating);
}


async function main() {
  console.log('start', new Date());

  await elo();
  // await getTopGoalScores();
}

main().catch((e) => {
  console.log(e);

  process.exit(1);
});

