import rawCourses from "./data/raw_courses.json";

const COOKIE = process.env.COOKIE;

const courses = [];

for (const course of rawCourses) {
  const courseNumber = course.number.match(/\./)?.length
    ? `b64-${btoa(course.number)}`
    : course.number;

  const url = `https://ohiostate.collegescheduler.com/api/terms/Autumn%202023%20Semester/subjects/${course.subjectId}/courses/${courseNumber}`;

  console.log(url);

  const result = await fetch(url, {
    headers: {
      cookie: COOKIE,
    },
  }).then((res) => res.json());

  courses.push({
    subjectId: course.subjectId,
    subjectLong: course.subjectLong,
    callNumber: course.number,
    title: course.title,
    description: result.description as string,
  });

  await Bun.write("data/courses.json", JSON.stringify(courses));

  await new Promise((resolve) => setTimeout(resolve, 500));
}

// console.log(courses);
// // console.log(await Promise.all(courses));
// for (const course of courses) {
//   console.log(await course);
//   await new Promise((resolve) => setTimeout(resolve, 2000));
// }
