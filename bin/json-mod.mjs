#! /usr/bin/env node

import minimist from "minimist";
import fs from "node:fs";

/**
 * this script aims to provide a generic mechanism for modifying JSON file contents.
 */
(async () => {
  const argv = minimist(process.argv.slice(2), {
    boolean: ["flatten", "nest", "overwrite", "force", "dry-run"],
    alias: {
      f: "flatten",
      n: "nest",
      O: "overwrite",
      N: "dry-run",
      F: "force",
    },
  });
  // console.warn({ argv });

  if (argv._.length === 0) {
    console.error("no input file path provided, unabled to continue.");
    process.exit(1);
  }

  // validate our input file
  const maybeInFile = argv._.shift();
  if (!fs.existsSync(maybeInFile)) {
    console.error(`cannot access input file "${maybeInFile}", unabled to continue.`);
    process.exit(1);
  }

  // validate our output file
  const maybeOutFile = argv.overwrite ? maybeInFile : argv._.shift();
  if (argv.overwrite) {
    console.warn("--overwrite specified, this will write changes directly to the input file...");
  } else if (fs.existsSync(maybeOutFile) && !argv.force) {
    console.error(`output file "${maybeOutFile}" already exists, "--force" must be specified to overwrite.`);
    process.exit(1);
  }

  // read and parse the input file
  const inFileData = fs.readFileSync(maybeInFile, "utf8");
  const inFileJson = JSON.parse(inFileData);

  // TODO: should we perhaps try to detect the current JSON structure here?
  //  using this to "nest" an already nested file, or "flatten" an already flattened file, results in identical output.

  const inFileJsonString = JSON.stringify(inFileJson, null, 2);
  console.log(inFileJsonString);

  let outFileJson;

  // if "--flatten" is specified, try to flatten the incoming JSON
  if (argv.flatten) {
    console.log("flattening JSON keys...");

    function convertNestedKeys(obj) {
      const result = {};
      for (const key in obj) {
        if (typeof obj[key] === "object") {
          const nestedResult = convertNestedKeys(obj[key]);
          for (const nestedKey in nestedResult) {
            result[`${key}.${nestedKey}`] = nestedResult[nestedKey];
          }
        } else {
          result[key] = obj[key];
        }
      }
      return result;
    }

    outFileJson = convertNestedKeys(inFileJson);
  }

  // if "--nest" is specified, try to nest the incoming JSON
  if (argv.nest) {
    console.log("nesting JSON keys...");

    function expandDotNotation(obj) {
      const result = {};
      for (const key in obj) {
        const parts = key.split(".");
        let current = result;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
        current[parts[parts.length - 1]] = obj[key];
      }
      return result;
    }

    outFileJson = expandDotNotation(inFileJson);
  }

  const outFileJsonString = JSON.stringify(outFileJson, null, 2);
  console.log(outFileJsonString);

  if (inFileJsonString === outFileJsonString) {
    console.log("process resulted in no structural changes, nothing more to do here...");
    process.exit(0);
  }

  if (argv.dryRun) {
    console.log("performed a dry run, skipping file write...");
    process.exit(0);
  }

  if (!fs.existsSync(maybeOutFile) || argv.overwrite || argv.force) {
    console.log("file structure updated, writing to output file...");
    fs.writeFileSync(maybeOutFile, JSON.stringify(outFileJson, null, 2));
  }
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
