import { PG_URI } from './src/utils.js';

const options = {
  client: 'postgresql',
  connection: PG_URI,
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    stub: './src/migrations/.stub',
    directory: './src/migrations',
    tableName: 'knex_migrations',
  },
};

export default options;
