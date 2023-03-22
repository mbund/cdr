import courses from "./data/2023/2023-autumn-courses.json";

import { constructGraph } from "./src/parser";

const fullGraph = constructGraph(
  courses as any,
  courses.map((course) => course.subjectId)
);

await Bun.write("public/courses-graph.json", JSON.stringify(fullGraph));
