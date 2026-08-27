/**
 * Compile the graph for the site, and say what came out.
 *
 * The work itself lives in scripts/lib/compile so the dev server can run it
 * too: the admin writes the authoring files, and without something bridging
 * them the site would keep serving whatever was compiled last.
 */
import { compileGraph } from "./lib/compile";

async function main() {
  const result = await compileGraph();

  for (const problem of result.problems) {
    console.warn(`  ! ${problem.message}`);
  }
  for (const id of result.orphanGeometry) {
    console.warn(`  ! geometry/${id}.json has no matching segment`);
  }

  console.log(
    `\n${result.segments} segments · ${result.nodes} nodes · ` +
      `${result.pins} pins · ${(result.meters / 1609.344).toFixed(1)} mi`,
  );
  if (result.components.length > 1) {
    console.log(
      `${result.components.length} disconnected components: ` +
        result.components.map((size) => `${size} nodes`).join(", "),
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
