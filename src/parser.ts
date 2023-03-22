export type Course = {
  subjectId: string;
  subjectLong: string;
  callNumber: string;
  title: string;
  description: string;

  __links: Link[];
};

const operators = ["and", "or"] as const;
type Operator = (typeof operators)[number];

type Literal = { type: "literal"; subjectId: SubjectId; callNumber: string };

type Expression =
  | {
      type: "operator";
      operator: Operator;
      values: Expression[];
    }
  | {
      type: "not";
      value: Expression;
    }
  | {
      type: "error";
      message: string;
    }
  | Literal;

const keywords = [
  "and",
  "or",
  "not",
  "prereq",
  "concur",
  "enrollment",
] as const;
type Keyword = (typeof keywords)[number];

const symbols = [",", ".", ":", ";", "(", ")"] as const;
type Symbol = (typeof symbols)[number];

export type SubjectId = string;

type Token =
  | { type: Operator }
  | { type: Keyword }
  | { type: Symbol }
  | { type: "error"; message: string }
  | { type: "eof" }
  | { type: "subjectId"; value: SubjectId }
  | { type: "callNumber"; value: string };

type TokenType = Token["type"];

const tokenizeSingle = (
  text: string,
  subjectIds: SubjectId[]
): { token: Token; remainder: string } => {
  const ws = text.match(/^\s+/);
  if (ws) {
    text = text.substring(ws[0].length);
  }

  const wordMatch = text.match(/^[a-z]+/);
  if (wordMatch) {
    const word = wordMatch[0];
    for (const keyword of [...keywords]) {
      if (word === keyword) {
        return {
          token: { type: keyword },
          remainder: text.substring(keyword.length),
        };
      }
    }

    for (const subjectId of subjectIds) {
      if (word === subjectId) {
        return {
          token: { type: "subjectId", value: subjectId },
          remainder: text.substring(subjectId.length),
        };
      }
    }
  }

  for (const symbol of symbols) {
    if (text.startsWith(symbol)) {
      return {
        token: { type: symbol },
        remainder: text.substring(symbol.length),
      };
    }
  }

  const callNumMatch = text.match(/^\d{3,4}(\.((\d+)|(xx)))?h?/i);
  if (callNumMatch) {
    const callNum = callNumMatch[0];
    return {
      token: { type: "callNumber", value: callNum },
      remainder: text.substring(callNum.length),
    };
  }

  return {
    token: { type: "error", message: text[0] },
    remainder: text.substring(1),
  };
};

const tokenize = (text: string, subjectIds: SubjectId[]): Token[] => {
  text = text.toLowerCase();

  let tokens: Token[] = [];
  while (true) {
    const { token, remainder } = tokenizeSingle(text, subjectIds);
    tokens.push(token);
    text = remainder;
    if (text.length === 0) break;
  }

  return tokens;
};

class Parser {
  index: number = 0;
  constructor(public tokens: Token[], public topLevelSubjectId: SubjectId) {}

  get next(): Token {
    if (this.index >= this.tokens.length) return { type: "eof" };
    return this.tokens[this.index];
  }

  consume(): Token {
    const result = this.next;
    this.index++;
    return result;
  }

  allow(types: TokenType[]): boolean {
    for (const type of types) {
      if (this.next.type == type) return true;
    }
    return false;
  }

  accept<T extends TokenType>(type: T): (Token & { type: T }) | null {
    const isTokenType = <T extends TokenType>(
      token: Token,
      type: T
    ): token is Token & { type: T } => {
      return token.type === type;
    };
    const result = this.next;
    if (isTokenType(result, type)) {
      this.consume();
      return result;
    }
    return null;
  }

  expect<T extends TokenType>(
    type: T
  ): (Token & { type: T }) | { type: "error"; message: string } {
    const result = this.accept(type);
    if (!result) {
      return this.skipErrors(type);
    }
    return result;
  }

  expr(): Expression {
    return this.semicolonSeperated(this.topLevelSubjectId);
  }

  orSeparated(defaultSubjectId: SubjectId): Expression {
    const values = [this.atom(defaultSubjectId)];
    if (values[0].type === "literal") defaultSubjectId = values[0].subjectId;

    while (this.accept("or")) {
      values.push(this.atom(defaultSubjectId));
    }

    if (values.length === 1) {
      return values[0];
    }

    return {
      type: "operator",
      operator: "or",
      values,
    };
  }

  commaSeperated(defaultSubjectId: SubjectId): Expression {
    let hadFirst = false;
    const values = [this.orSeparated(defaultSubjectId)];
    const value = values[values.length - 1];
    if (!hadFirst && value.type === "literal") {
      defaultSubjectId = value.subjectId;
    }
    let operator: Operator | null = null;

    while (this.accept(",")) {
      if (this.accept("or")) {
        operator = "or";
      } else if (this.accept("and")) {
        operator = "and";
      }
      values.push(this.orSeparated(defaultSubjectId));
      const value = values[values.length - 1];
      if (!hadFirst && value.type === "literal") {
        defaultSubjectId = value.subjectId;
      }
    }

    if (values.length === 1) {
      return values[0];
    }

    if (!operator) {
      return {
        type: "error",
        message: `Expected operator in comma seperated list ${values
          .map(prettyPrint)
          .join(", ")}`,
      };
    }

    return {
      type: "operator",
      operator,
      values,
    };
  }

  semicolonSeperated(defaultSubjectId: SubjectId): Expression {
    let hadFirst = false;
    const values = [this.commaSeperated(defaultSubjectId)];
    const value = values[values.length - 1];
    if (!hadFirst && value.type === "literal") {
      defaultSubjectId = value.subjectId;
    }
    let operator: Operator | null = null;

    while (this.accept(";")) {
      if (this.accept("or")) {
        operator = "or";
      } else if (this.accept("and")) {
        operator = "and";
      }
      values.push(this.commaSeperated(defaultSubjectId));
      const value = values[values.length - 1];
      if (!hadFirst && value.type === "literal") {
        defaultSubjectId = value.subjectId;
      }
    }

    if (values.length === 1) {
      return values[0];
    }

    if (!operator) {
      return {
        type: "error",
        message: `Expected operator in semicolon seperated list ${values
          .map(prettyPrint)
          .join(", ")}
      }`,
      };
    }

    return {
      type: "operator",
      operator,
      values,
    };
  }

  atom(defaultSubjectId: SubjectId): Expression {
    this.skipErrors("expression");
    const subjectIdToken = this.accept("subjectId");
    if (subjectIdToken) {
      const callNumberToken = this.expect("callNumber");
      if (callNumberToken.type === "error") return callNumberToken;
      this.skipParens();
      return {
        type: "literal",
        subjectId: subjectIdToken.value,
        callNumber: callNumberToken.value,
      };
    }
    const callNumberToken = this.accept("callNumber");
    if (callNumberToken) {
      this.skipParens();
      return {
        type: "literal",
        subjectId: defaultSubjectId,
        callNumber: callNumberToken.value,
      };
    }

    return this.skipErrors("expression");
  }

  skipParens() {
    if (this.accept("(")) {
      while (!(this.accept(")") || this.accept("eof"))) this.consume();
    }
  }

  skipErrors(expected: string): Expression & { type: "error" } {
    const errorMessages: string[] = [];
    while (
      !this.allow([
        "subjectId",
        "callNumber",
        ",",
        "prereq",
        "concur",
        "eof",
        ".",
      ])
    ) {
      const token = this.consume();
      errorMessages.push(token.type === "error" ? token.message : token.type);
    }

    return {
      type: "error",
      message: `Expected ${expected}, got "${errorMessages.join("")}"`,
    };
  }

  start(): { prereq: Expression | null; concur: Expression | null } {
    let prereq: Expression | null = null;
    let concur: Expression | null = null;

    while (!this.allow(["prereq", "concur", "eof"])) {
      this.consume();
    }

    while (this.allow(["prereq", "concur"])) {
      let mode: "p" | "c";
      if (this.accept("prereq")) {
        mode = "p";
        if (this.accept("or")) {
          this.expect("concur");
          mode = "c";
        }
      } else {
        this.accept("concur");
        mode = "c";
      }
      this.expect(":");
      const e = this.expr();
      if (mode === "p") {
        prereq = e;
      } else {
        concur = e;
      }

      while (!this.allow(["prereq", "concur", "eof"])) {
        this.consume();
      }
    }

    return { prereq, concur };
  }
}

const parse = (
  text: string,
  topLevelSubjectId: SubjectId,
  subjectIds: SubjectId[]
) => {
  const tokens = tokenize(
    text,
    subjectIds.map((subjectId) => subjectId.toLowerCase())
  );
  const parser = new Parser(tokens, topLevelSubjectId);
  return parser.start();
};

const unreachable = (): never => {
  throw "Unreachable!";
};

export const parseCallNumber = (
  callNumber: string
): {
  base: string;
  honors: boolean;
  section: string | null;
} | null => {
  const base = callNumber.match(/^\d{3,4}/i)?.[0];
  if (!base) return null;

  const honors =
    callNumber.toLowerCase().includes("h") ||
    callNumber.toLowerCase().includes("e");

  let section: string | null = null;
  if (callNumber.includes(".")) {
    let sectionMatch = callNumber.match(/(?<=\.)[\dX]+/)?.[0];
    if (sectionMatch) {
      section = sectionMatch;
    }
  }

  return {
    base: base,
    honors,
    section,
  };
};

const prettyPrint = (expression: Expression | null): string => {
  if (!expression) {
    return "none";
  }

  if (expression.type === "literal") {
    return `${expression.subjectId.toUpperCase()} ${expression.callNumber.toUpperCase()}`;
  }

  if (expression.type === "error") {
    // return `{${expression.message}}`;
    return "unknown";
  }

  if (expression.type === "operator") {
    return `(${expression.values
      .map((expression) => prettyPrint(expression))
      .join(` ${expression.operator} `)})`;
  }

  return unreachable();
};

export type Link = {
  source: string;
  target: string;
  concurrent: boolean;
  group: string;
};

export const constructGraph = (
  courses: Course[],
  includedSubjectIds: SubjectId[]
) => {
  const coursesFiltered = courses.filter((course) =>
    includedSubjectIds.includes(course.subjectId)
  );

  const allSubjectIds = courses.map((course) => course.subjectId);

  const coursesParsed = coursesFiltered.map((course) => {
    return {
      course: course,
      parsed: parse(course.description, course.subjectId, allSubjectIds),
    };
  });

  let nodes: {
    label: string;
    id: string;
    hover: string;
    group: string;
    __links: Link[];
  }[] = coursesParsed.map(({ course, parsed }) => {
    return {
      label: `${course.subjectId} ${course.callNumber}`,
      id: `${course.subjectId} ${course.callNumber}`,
      hover: `${course.subjectId} ${course.callNumber}<br>${
        course.title
      }<br><br>${course.description}<br><br>Prereqs: ${prettyPrint(
        parsed.prereq
      )}<br>Concur: ${prettyPrint(parsed.concur)}`,
      group: course.subjectId,

      __links: [],
    };
  });

  const links = coursesParsed.flatMap(({ course, parsed }) => {
    // console.log(`${course.subjectId} ${course.callNumber}`);

    const extract = (
      expression: Expression,
      concurrent: boolean,
      group: string
    ): Link[] => {
      if (expression.type === "literal") {
        const targetCourses = coursesFiltered.filter((c) => {
          if (c.subjectId !== expression.subjectId.toUpperCase()) return false;

          const targetCallNumber = parseCallNumber(expression.callNumber);
          const sourceCallNumber = parseCallNumber(c.callNumber);

          if (!targetCallNumber || !sourceCallNumber) return false;

          if (targetCallNumber.honors !== sourceCallNumber.honors) return false;

          if (targetCallNumber.base !== sourceCallNumber.base) return false;

          if (targetCallNumber.section && sourceCallNumber.section)
            return targetCallNumber.section === sourceCallNumber.section;

          if (!targetCallNumber.section || targetCallNumber.section === "XX")
            return targetCallNumber.base === sourceCallNumber.base;

          return false;
        });

        return targetCourses.flatMap((c) => [
          {
            source: `${c.subjectId} ${c.callNumber}`,
            target: `${course.subjectId} ${course.callNumber}`,
            concurrent: concurrent,
            group: group,
          },
        ]);
      }

      if (expression.type === "operator") {
        return expression.values.flatMap((value) =>
          extract(value, concurrent, prettyPrint(expression))
        );
      }

      return [];
    };

    const prereqs = parsed.prereq ? extract(parsed.prereq, false, "") : [];
    const concur = parsed.concur ? extract(parsed.concur, true, "") : [];

    return [...prereqs, ...concur];
  });

  nodes = nodes.map((node) => {
    node.__links = links.filter(
      (link) => link.source === node.id || link.target == node.id
    );
    return node;
  });

  return { nodes: nodes, links: links };
};
