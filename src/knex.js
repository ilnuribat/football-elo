import Knex from 'knex';
import pg from 'pg';
import { PG_URI } from './utils.js';

pg.types.setTypeParser(pg.types.builtins.TEXT, (text) => Buffer.from(text, 'binary').toString('utf8'));

let knex;

export async function getKnex() {
  if (knex) {
    return knex;
  }

  knex = new Knex({
    client: 'pg',
    connection: PG_URI,
    pool: { min: 2, max: 10 },
  });

  return knex;
}
