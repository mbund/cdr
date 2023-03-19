import courses from "./data/courses.json";

const operators = ["and", "or"] as const;
type Operator = (typeof operators)[number];

type SubjectId = string;

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

const subjectIds = courses.map((course) => course.subjectId.toLowerCase());

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
  description: string
): { token: Token; remainder: string } => {
  const ws = description.match(/^\s+/);
  if (ws) {
    description = description.substring(ws[0].length);
  }

  const wordMatch = description.match(/^[a-z]+/);
  if (wordMatch) {
    const word = wordMatch[0];
    for (const keyword of [...keywords]) {
      if (word === keyword) {
        return {
          token: { type: keyword },
          remainder: description.substring(keyword.length),
        };
      }
    }

    for (const subjectId of subjectIds) {
      if (word === subjectId) {
        return {
          token: { type: "subjectId", value: subjectId },
          remainder: description.substring(subjectId.length),
        };
      }
    }
  }

  for (const symbol of symbols) {
    if (description.startsWith(symbol)) {
      return {
        token: { type: symbol },
        remainder: description.substring(symbol.length),
      };
    }
  }

  const callNumMatch = description.match(/^\d{3,4}(\.((\d+)|(xx)))?h?/i);
  if (callNumMatch) {
    const callNum = callNumMatch[0];
    return {
      token: { type: "callNumber", value: callNum },
      remainder: description.substring(callNum.length),
    };
  }

  return {
    token: { type: "error", message: description[0] },
    remainder: description.substring(1),
  };
};

const tokenize = (description: string): Token[] => {
  description = description.toLowerCase();

  let tokens: Token[] = [];
  while (true) {
    const { token, remainder } = tokenizeSingle(description);
    tokens.push(token);
    description = remainder;
    if (description.length === 0) break;
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
    }
    return { prereq, concur };
  }
}

const parse = (description: string, topLevelSubjectId: SubjectId) => {
  const tokens = tokenize(description);
  const parser = new Parser(tokens, topLevelSubjectId);
  return parser.start();
};

const unreachable = (): never => {
  throw "Unreachable!";
};

const baseCallNumber = (callNumber: string): string | null => {
  //   const numberMatch = callNumber.match(/\d+/);
  //   const numberString = numberMatch![0];
  //   if (numberString.length === 3) return null;

  //   return numberString + (callNumber[callNumber.length - 1] === "h" ? "h" : "");

  return callNumber;
};

const prettyPrint = (expression: Expression | null): string => {
  if (!expression) {
    return "none";
  }

  if (expression.type === "literal") {
    return `${expression.subjectId.toUpperCase()} ${expression.callNumber}`;
  }

  if (expression.type === "error") {
    return `{${expression.message}}`;
  }

  if (expression.type === "operator") {
    return `(${expression.values
      .map((expression) => prettyPrint(expression))
      .join(` ${expression.operator} `)})`;
  }

  return unreachable();
};

// CSE Prereq: 2231, 2321, and Stat 3460 or 3470, and enrollment in CSE, CIS, ECE, Data Analytics, or Math major, or CIS minor. Concur: Math 3345. Not open to students with credit for 5331.
// COMPSTD Prereq: English 1110 (110), or equiv. Not open to students with credit for 2341 (272). GE cultures and ideas and diversity global studies course. GE foundation historical and cultural studies course.
// CSE Prereq: 2122, 2123, or 2231; and 2321 or Math 2566; and enrollment in CSE, CIS, Data Analytics, Music (BS), Eng Physics, or Math major.
// BIOLOGY Prereq or concur: Chem 1110 or 1210. Not open to students with credit for 1113 or 1114, or majoring in the Biological Sciences. GE nat sci bio course. GE foundation natural sci course.
// CSE Prereq: Not open to students with credit for 1112 (105), 1113 (101), or 200. GE quant reason math and logical anly course. GE foundation math and quant reasoning or data anyl course.
// BIOLOGY Prereq: Math 1120, 1130, 1148, 1150, or above, or Math Placement Level L or M. Prereq or concur: Chem 1110, 1210, 1610, or 1910H, or permission of course coordinator. Not open to students with credit for 1113 or 1113.02. This course is available for EM credit. GE nat sci bio course. GE foundation natural sci course.
// BIOMEDE Prereq: 2000, Engr 1182 or 1282, MechEng 2040, Math 2174, and Biology 1113 or equiv, and enrollment in BiomedE major.
// MATH Prereq: A grade of C- or above in 1114 (114), 1151, 1156, 1161.xx, 152.xx, 161.xx, or 161.01H. Not open to students with credit for 1172, 1181H or any Math class numbered 1500 or above, or with credit for 153.xx, or Math courses numbered 162.xx or above. This course is available for EM credit. GE quant reason math and logical anly course. GE foundation math and quant reasoning or data anyl course.
// PHYSICS Intermediate level introduction to electronic circuits, devices, and instrumentation with emphasis on laboratory experience.Prereq: 1251, 1251H, 1261, or 1271.
// PHYSICS Prereq: Honors standing, Math 2174, 2415 (415), 2255 (255), or 5520H (521H), and a grade of C+ or above in Physics 2301 (263); or permission of instructor. Not open to students with credit for 5400, 555, or 656.

// const text = "";
// const parsed = parse(text, "physics");
// console.log(text);
// console.log("Prereqs: ", prettyPrint(parsed.prereq));
// console.log("Concur: ", prettyPrint(parsed.concur));

const nodes = courses.map((course) => ({
  label: `${course.subjectId} ${course.callNumber}`,
  id: `${course.subjectId} ${baseCallNumber(course.callNumber)}`,
  group: course.subjectId,
}));

type Link = {
  source: string;
  target: string;
  dashed: boolean;
};

const graph = {
  nodes: nodes,
  links: courses.flatMap((course) => {
    console.log(`${course.subjectId} ${course.callNumber}`);
    const parsed = parse(course.description, course.subjectId);

    const extract = (expression: Expression): Link[] => {
      if (expression.type === "literal") {
        const target = `${expression.subjectId.toUpperCase()} ${baseCallNumber(
          expression.callNumber
        )}`;
        if (!nodes.find((node) => node.id === target)) return [];

        return [
          {
            source: target,
            target: `${course.subjectId} ${baseCallNumber(course.callNumber)}`,
            dashed: false,
          },
        ];
      }

      if (expression.type === "operator") {
        return expression.values.flatMap((value) => extract(value));
      }

      return [];
    };

    const prereqs = parsed.prereq ? extract(parsed.prereq) : [];
    const concur = parsed.concur ? extract(parsed.concur) : [];

    return [...prereqs, ...concur];
  }),
};

await Bun.write("public/courses.json", JSON.stringify(graph));
