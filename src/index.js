import { elo } from './elo.js';


async function main() {
  console.log('start', new Date());

  await elo();
}

main().catch((e) => {
  console.log(e);

  process.exit(1);
});

