#! /usr/bin/env node

import { convertInchesToTwip, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import minimist from "minimist";
import fs from "node:fs";
import path from "node:path";
import { getTextExtractor } from "office-text-extractor";

(async () => {
  const argv = minimist(process.argv.slice(2), {
    strings: ["base-lang", "target-lang", "project"],
    boolean: ["import", "export", "force", "missing"],
    default: {
      "base-lang": "en",
    },
    alias: {
      b: "base-lang",
      t: "target-lang",
      p: "project",
      i: "import",
      e: "export",
      m: "missing",
    },
  });
  // console.warn({ argv });

  // verify that we have an appropriate action to carry out
  if (!argv["import"] === !argv["export"]) {
    throw Error("unable to determine target action, please specify either --import ot --export.");
  }

  // verify that we have a translations folder path to work with
  const srcFolder = argv._.shift();
  if (!srcFolder) {
    throw Error("no language folder path provided, unable to continue.");
  }
  if (!fs.existsSync(srcFolder) || !fs.lstatSync(srcFolder).isDirectory()) {
    throw Error(`"${srcFolder}" does not seem to be a valid directory, unable to continue.`);
  }

  const baseLang = argv["base-lang"];
  const targetLang = argv["target-lang"];
  const projectName = argv["project"] || "project";

  // ensure that we have both a base and target language id to work with
  if (!targetLang) {
    throw Error("no target language selected, please specify this with --target-lang.");
  }

  // prepare file names for the export and import actions
  const baseLangFilename = `${baseLang}.json`;
  const targetLangFilename = `${targetLang}.json`;
  const wordDocFilename = `${projectName}-${baseLang}-${targetLang}.docx`;

  // extrapolate the output folder path
  const destFolder = argv._.shift() || srcFolder;

  // export translations from JSON to DOCX
  if (argv["export"]) {
    console.log("exporting translations from JSON to DOCX...");

    const baseLangFilepath = path.normalize(`${srcFolder}/${baseLangFilename}`);
    const targetLangFilepath = path.normalize(`${srcFolder}/${targetLangFilename}`);
    const wordDocFilepath = path.normalize(`${destFolder}/${wordDocFilename}`);

    const baseLangEntries = JSON.parse(fs.readFileSync(baseLangFilepath, "utf8"));
    const targetLangEntries = JSON.parse(fs.readFileSync(targetLangFilepath, "utf8"));
    console.log(`found ${Object.keys(baseLangEntries).length} base language entries`);
    console.log(`found ${Object.keys(targetLangEntries).length} target language entries`);
    const missingCount = Object.keys(baseLangEntries).length - Object.keys(targetLangEntries).length;
    console.log(`output will include ${argv["missing"] ? (missingCount + " missing") : "all"} entries.`);

    const mergedEntries = Object.entries(baseLangEntries).map((b) => {
      const maybeTargetString = targetLangEntries[b[0]];
      return {
        key: b[0],
        [baseLang]: b[1],
        [targetLang]: maybeTargetString,
      };
    }).filter((e) => {
      return !argv["missing"] || e[targetLang] === undefined;
    });

    // each entry is built up using a table with 3 rows:
    //  - translation key
    //  - base language string
    //  - target language string
    // add an empty paragraph after each table to prevent Word from automatically combining them all.
    const langEntries = [];
    mergedEntries.forEach((e) => {
      const table = new Table({
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        margins: {
          top: convertInchesToTwip(0.1),
          bottom: convertInchesToTwip(0.1),
          right: convertInchesToTwip(0.1),
          left: convertInchesToTwip(0.1),
        },
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: {
                  size: 30,
                  type: WidthType.DXA,
                },
                children: [new Paragraph({
                  text: `key`,
                  keepNext: true,
                })],
              }),
              new TableCell({
                children: [new Paragraph({
                  text: e.key,
                  keepNext: true,
                })],
              }),
            ],
          }),
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: {
                  size: 30,
                  type: WidthType.DXA,
                },
                children: [new Paragraph({
                  text: baseLang,
                  keepNext: true,
                })],
              }),
              new TableCell({
                children: [new Paragraph({
                  text: e[baseLang],
                  keepNext: true,
                })],
              }),
            ],
          }),
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: {
                  size: 30,
                  type: WidthType.DXA,
                },
                children: [new Paragraph({
                  text: targetLang,
                  keepNext: true,
                })],
              }),
              new TableCell({
                children: [new Paragraph({
                  text: e[targetLang] || "",
                  keepNext: true,
                })],
              }),
            ],
          }),
        ],
      });
      langEntries.push(table);
      langEntries.push(new Paragraph({
        text: "",
        keepNext: true,
      }));
    });

    // construct the Word document
    const wordDoc = new Document({
      title: `Language Strings - ${baseLang}-${targetLang}`,
      sections: [
        // TODO: create document introduction page, which could be used for details such as translation entries, total word count, etc.
        // {
        //   children: [
        //     new Paragraph(""),
        //   ],
        // },
        {
          children: langEntries,
        },
      ],
    });

    // generate the Word document and write it to disk.
    Packer.toBuffer(wordDoc).then((buffer) => {
      fs.writeFileSync(path.resolve(wordDocFilepath), buffer);
    });
  }

  // import translations from DOCX to JSON
  if (argv["import"]) {
    console.log("importing translations from DOCX to JSON...");

    const wordDocFilepath = path.normalize(`${srcFolder}/${wordDocFilename}`);
    // NOTE: for the moment, I'm choosing to write the output to a separate file that can be imported into Tolgee.
    const targetLangFilepath = path.normalize(`${destFolder}/new-${targetLangFilename}`);

    const rawText = await getTextExtractor().extractText({
      input: path.resolve(wordDocFilepath),
      type: "file",
    });

    // parse the raw Word document text into a structure that can be used to update the target language JSON file.
    const regexMatches = rawText.matchAll(/key\n\n(?<key>^.*?$)\n\n(\w{2})\n\n(?<base>^.*?$)\n\n(\w{2})\n\n(?<target>^.*?$)\n\n\n\n/gm);
    const parsedMatches = Array.from(regexMatches).reduce((acc, match) => {
      if (match.groups.target !== "") {
        console.log(`found translation for "${match.groups.key}"`);
        acc[match.groups.key] = match.groups.target;
      } else {
        console.error(`missing translation for "${match.groups.key}"`);
      }
      return acc;
    }, {});
    console.log("parsedMatches:", parsedMatches);

    console.log(`writing new translations to output file: ${targetLangFilepath}`);
    const outFileJsonString = JSON.stringify(parsedMatches, null, 2);
    fs.writeFileSync(targetLangFilepath, outFileJsonString);
  }
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
