#! /usr/bin/env node

import minimist from "minimist";
import fs from "node:fs";

import { convertNestedKeys } from "../lib/functions.mjs";

/**
 * this script contains actions specific to manipulating the string values in a JSON file.
 */
(async () => {
  const argv = minimist(process.argv.slice(2), {
    boolean: ["find-duplicates", "count-words", "count-chars", "include-spaces"],
    alias: {
      d: "find-duplicates",
      w: "count-words",
      c: "count-chars",
      s: "include-spaces",
    },
  });
  // console.warn({ argv });

  if (argv._.length === 0) {
    throw Error("no input file path provided, unable to continue.");
  }

  // verify the input file exists
  const maybeInFile = argv._.shift();
  if (!fs.existsSync(maybeInFile)) {
    throw Error(`cannot access input file "${maybeInFile}", unable to continue.`);
  }

  // read and parse the input file
  const inFileData = fs.readFileSync(maybeInFile, "utf8");
  const inFileJson = JSON.parse(inFileData);

  if (argv["find-duplicates"]) {
    // first process the JSON file entries, using "values" as keys and storing "keys" in an array value.
    const valuesAsKeys = {};
    for (const key in inFileJson) {
      const value = inFileJson[key];
      if (typeof value !== "string") {
        console.error(`key "${key}" has value of type "${typeof value}"`);
        console.error("expected flattened json file with only string values..");
        process.exit(1);
      }

      const current = valuesAsKeys[value] || [];
      valuesAsKeys[value] = [...current, key];
    }

    // then parse the result to present a list of detected duplicates
    const onlyDupes = Object.entries(valuesAsKeys).filter((entry) => {
      return entry[1].length > 1;
    });
    console.log(`strings found with multiple keys: ${onlyDupes.length}`);
    for (const [key, value] of onlyDupes) {
      console.log("---------------------------------");
      console.log(` string: "${key}":`);
      for (const dupeKey of value) {
        console.log(`  key: "${dupeKey}"`);
      }
    }
  }

  if (argv["count-words"]) {
    console.log("counting words in file...");

    const flattenedJson = convertNestedKeys(inFileJson);
    const wordCount = Object.values(flattenedJson).reduce((acc, cur) => {
      console.log(`string: "${cur}"`);
      const withoutHolders = cur.replaceAll(/{{.*}}/g, "").replaceAll(/\s\s/g, " ");
      const words = withoutHolders.split(" ").filter((str) => str.length > 0);
      return acc + words.length;
    }, 0);

    console.log(`total word count: ${wordCount}`);
  }

  if (argv["count-chars"]) {
    console.log(`counting characters in file, ${argv["include-spaces"] ? "including" : "excluding"} spaces...`);

    const flattenedJson = convertNestedKeys(inFileJson);
    const charCount = Object.values(flattenedJson).reduce((acc, cur) => {
      console.log(`string: "${cur}"`);
      const withoutHolders = cur.replaceAll(/{{.*}}/g, "").replaceAll(/\s\s/g, " ");
      const str = !argv["include-spaces"] ? withoutHolders.replaceAll(/\s/g, "") : withoutHolders;
      return acc + str.length;
    }, 0);

    console.log(`total character count: ${charCount}`);
  }
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
