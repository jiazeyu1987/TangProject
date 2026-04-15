import path from "node:path";
import { fileURLToPath } from "node:url";

import { runSimulation } from "./run-simulation.js";

function parseArgs(argv) {
  const args = [...argv];
  let scenario = "default-month";
  while (args.length) {
    const token = args.shift();
    if (token === "--scenario") {
      const value = args.shift();
      if (!value) {
        throw new Error("Missing value for --scenario.");
      }
      scenario = value;
      continue;
    }
    if (token && token.startsWith("--scenario=")) {
      scenario = token.slice("--scenario=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return { scenario };
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, "..");
  const options = parseArgs(process.argv.slice(2));
  const result = await runSimulation({
    projectRoot,
    scenarioName: options.scenario,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(
    `[simulation] failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
