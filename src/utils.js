import dotenv from 'dotenv';

dotenv.config();

const {
  PG_URI,
} = process.env;

export {
  PG_URI,
};
