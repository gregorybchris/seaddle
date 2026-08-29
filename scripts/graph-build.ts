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

  const miles = (meters: number) => (meters / 1609.344).toFixed(1);
  console.log(
    `\n${result.segments} segments · ${result.nodes} nodes · ` +
      `${result.pins} pins · ${miles(result.meters)} mi ridden` +
      // Said separately for the same reason the site says it separately: the
      // ferry is eight miles of the map that nobody pedals.
      (result.crossedMeters > 0
        ? ` · ${miles(result.crossedMeters)} mi crossed`
        : ""),
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
