#! /usr/bin/env node

import minimist from "minimist";

/**
 * this script contains actions specific to USE_CASE_DESCRIPTION.
 */
(async () => {
  const argv = minimist(process.argv.slice(2));
  console.warn({ argv });
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
