#! /usr/bin/env node

import minimist from "minimist";

/**
 * dummy placeholder file, replace this with your own stuff...
 */
(async () => {
  const argv = minimist(process.argv.slice(2));
  console.warn({ argv });
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
