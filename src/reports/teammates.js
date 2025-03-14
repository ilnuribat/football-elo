import { getKnex } from '../knex.js';


async function main() {
  console.log('start', new Date());
  const knex = await getKnex();
  const gamePlayersId = [
    31, 3, 51, 48, 12, 15, 17, 5, 2, 7, 38, 4, 10, 20, 50, 47, 44, 1,
  ];

  const { rows } = await knex.raw(`
    select
      least, greatest,
      min(name1) as name1,
      max(name2) as name2,
      min(plays) as plays,
      min(wins) as wins
    from (
      select 
        min(p1.name) as name1,
        min(p1.id) as p1_id,
        min(p2.name) as name2,
        min(p2.id) as p2_id,
        count(*) as plays,
        sum(r1.result) as wins,
        min(least(p1.id, p2.id)) as least,
        min(greatest(p1.id, p2.id)) as greatest
      from results r1
      inner join results r2
        on r1.result = r2.result and r1.match_id = r2.match_id and r1.player_id <> r2.player_id
      inner join players p1
        on r1.player_id = p1.id
      inner join players p2
        on r2.player_id = p2.id
      inner join matches m
        on m.id = r1.match_id
      where
        r1.match_id between 1 and 40
        -- and m.season = '2025'
        and (
          p1.id in (${gamePlayersId.join(', ')})
          and p2.id in (${gamePlayersId.join(', ')})
        )
      group by r1.player_id, r2.player_id
    ) p
    group by least, greatest
    order by plays desc, wins desc
  `);

  console.table(rows);
}

main().catch((e) => {
  console.log(e);

  process.exit(1);
});
