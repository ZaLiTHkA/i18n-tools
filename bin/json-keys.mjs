#! /usr/bin/env node

import minimist from "minimist";
import fs from "node:fs";
import { confirm } from "@inquirer/prompts";

/**
 * this script contains actions specific to manipulating the keys in a JSON file.
 */
(async () => {
  const argv = minimist(process.argv.slice(2), {
    boolean: ["flatten", "nest", "force", "dry-run"],
    alias: {
      f: "flatten",
      n: "nest",
      N: "dry-run",
      F: "force",
    },
  });
  // console.warn({ argv });

  if (argv._.length === 0) {
    throw Error("no input file path provided, unabled to continue.");
  }

  // validate our input file
  const maybeInFile = argv._.shift();
  if (!fs.existsSync(maybeInFile)) {
    throw Error(`cannot access input file "${maybeInFile}", unabled to continue.`);
  }

  // confirm that we have an intended action to perform
  if (!argv.flatten && !argv.nest) {
    throw Error("no action specified, please specify either --flatten or --nest to continue.");
  }

  // validate our output file
  const maybeOutFile = argv._.shift() || maybeInFile;
  if (maybeInFile !== maybeOutFile && fs.existsSync(maybeOutFile)) {
    throw Error("target output file already exists, please specify --overwrite to overwrite.");
  }
  if (maybeInFile === maybeOutFile) {
    console.warn("no output file specified, this will overwrite input file...");
  }

  const applyChanges = argv.force || await confirm({
    message: `would you like to apply these changes?`,
    name: "applyChanges",
  });
  if (!applyChanges) {
    console.log("process aborted, nothing more to do here...");
    process.exit(0);
  }

  // read and parse the input file
  const inFileData = fs.readFileSync(maybeInFile, "utf8");
  const inFileJson = JSON.parse(inFileData);

  // TODO: should we perhaps try to detect the current JSON structure here?
  //  using this to "nest" an already nested file, or "flatten" an already flattened file, results in identical output.

  const inFileJsonString = JSON.stringify(inFileJson, null, 2);
  // console.log(inFileJsonString);

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

  console.log("file structure updated, writing to output file...");
  fs.writeFileSync(maybeOutFile, outFileJsonString);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
