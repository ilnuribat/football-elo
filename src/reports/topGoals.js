import { getKnex } from '../knex.js';


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
