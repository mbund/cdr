import { constructGraph, type Course, type SubjectId } from "./parser";

self.onmessage = (
  e: MessageEvent<{ courses: Course[]; subjectIds: SubjectId[] }>
) => {
  const { courses, subjectIds } = e.data;

  const graph = constructGraph(courses, subjectIds);

  self.postMessage(graph);
};

export {};
