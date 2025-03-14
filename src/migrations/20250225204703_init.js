export async function up(knex) {
  await knex.raw(`
    CREATE TABLE players (
      id serial primary key NOT NULL,
      name text
    );
  `);

  await knex.raw("create type match_result_enum as enum('a', 'b', 'ab')");
  await knex.raw(`
    CREATE TABLE matches (
      id serial primary key NOT NULL,
      season text,
      tour integer,
      code text,
      date timestamp without time zone,
      result match_result_enum
    );
  `);

  await knex.raw("create type result_team_enum as enum('a', 'b', 'z')");
  await knex.raw(`
    CREATE TABLE public.results (
      player_id integer NOT NULL references players(id),
      match_id integer NOT NULL references matches(id),
      team result_team_enum,
      goals integer,
      primary key(player_id, match_id)
    );
  `);
}

export async function down(knex) {
  await knex.raw('drop table results');
  await knex.raw('drop table players');
  await knex.raw('drop table matches');
  await knex.raw('drop type match_result_enum');
  await knex.raw('drop type result_team_enum');
}
