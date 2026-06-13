import "dotenv/config";

import { readdir } from "node:fs/promises";
import path from "node:path";
import { CorpusIngester } from "./ingest";
import { CorpusMetadata } from "./store";

const PAPERS_DIR = path.join(process.cwd(), "corpus", "papers");

function metadataForPaper(fileName: string): CorpusMetadata {
  return {
    citation: path.basename(fileName, path.extname(fileName)),
    doi: "",
    study_type: "paper",
    tags: [],
  };
}

export async function seedCorpus(papersDir = PAPERS_DIR): Promise<void> {
  const ingester = new CorpusIngester();
  const entries = await readdir(papersDir, { withFileTypes: true });
  const pdfFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
    .map((entry) => entry.name);

  for (const fileName of pdfFiles) {
    const filePath = path.join(papersDir, fileName);
    await ingester.ingestPDF(filePath, metadataForPaper(fileName));
  }
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seedCorpus().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
