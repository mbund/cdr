import courses from "./data/courses.json";

const nodes = courses.map((course) => ({
  id: `${course.subjectId} ${course.callNumber}`,
  group: course.subjectId,
}));

const graph = {
  nodes: nodes,
  links: courses.flatMap((course) => {
    const prereqs = course.description.match(/Prereq: (.*)/)?.[1];
    if (!prereqs) return [];

    const num = prereqs.match(/(\d+)/)?.[0];
    const target = `${course.subjectId} ${num}`;
    if (!num) return [];
    if (!nodes.find((node) => node.id === target)) return [];

    return {
      source: `${course.subjectId} ${course.callNumber}`,
      target: target,
    };
  }),
};

await Bun.write("public/courses.json", JSON.stringify(graph));
