/**
 * TS ports of the wavelet-server Handlers (demos/earlycode_src/ChatServer.java,
 * DocSearchServer.java) and the JUnit lab (ListExamples.java). Quirks are kept
 * on purpose:
 *  - ChatServer's "/" branch resets chat to "" AND returns the pre-increment
 *    count (num++ in Java is post-increment: the response shows the old
 *    value, then num goes up for next time).
 *  - "/add-message" only accepts exactly "s=<msg>&user=<name>" - it splits on
 *    [=&] and reads parameters[1] (message) and parameters[3] (user); any
 *    other shape falls through to "404 Not Found!" (the real Java would
 *    throw ArrayIndexOutOfBoundsException there, which the course server's
 *    catch-all turns into a 500 - this port folds that case into the same
 *    404 the handler already returns for an unrecognized path, since that is
 *    the outcome the assignment cared about).
 *  - DocSearchServer's substring match is case-sensitive, over every synthetic
 *    doc, sorted paths, "Found N paths:\n...".
 *  - ListExamples.merge has a planted bug: the tail loop that drains list2
 *    increments index1 instead of index2 (the file's own comment says to
 *    change it). That makes it loop forever whenever it's reached with
 *    index2 still short of list2's length - MERGE_STEP_CAP below stands in
 *    for JUnit's @Test(timeout = 500) since a browser tab can't actually be
 *    killed by a JVM timeout.
 *  - ListExamples.filter uses result.add(0, s), which inserts every match at
 *    the front - so matches come out in the REVERSE of their input order.
 */

export interface CorpusDoc {
  path: string;
  text: string;
}

export interface CorpusData {
  note: string;
  docs: CorpusDoc[];
}

export interface ParsedRequest {
  path: string;
  query: string | null;
}

/** Stand-in for java.net.URI: split "path?query" the same way getPath()/getQuery() would see it. */
export function parseRequestUrl(input: string): ParsedRequest {
  const trimmed = input.trim();
  const qIdx = trimmed.indexOf("?");
  if (qIdx === -1) return { path: trimmed || "/", query: null };
  return { path: trimmed.slice(0, qIdx) || "/", query: trimmed.slice(qIdx + 1) };
}

// ---------------------------------------------------------------------------
// ChatServer
// ---------------------------------------------------------------------------

export interface ChatState {
  num: number;
  chat: string;
}

export const initialChatState: ChatState = { num: 0, chat: "" };

export type ChatBranch = "root" | "add-message-ok" | "add-message-404" | "unknown-404";

export interface ChatOutcome {
  response: string;
  nextState: ChatState;
  branch: ChatBranch;
}

export function chatHandle(rawUrl: string, state: ChatState): ChatOutcome {
  const { path, query } = parseRequestUrl(rawUrl);

  if (path === "/") {
    // num++ is post-increment in the Java: the response uses the OLD value.
    const response = `Number of chats: ${state.num}`;
    return { response, nextState: { num: state.num + 1, chat: "" }, branch: "root" };
  }

  if (path.includes("/add-message")) {
    const parameters = (query ?? "").split(/[=&]/);
    if (parameters[0] === "s" && parameters.length > 3) {
      const add = `${parameters[3]}: ${parameters[1]} \n`;
      const chat = state.chat + add;
      return { response: chat, nextState: { ...state, chat }, branch: "add-message-ok" };
    }
    return { response: "404 Not Found!", nextState: state, branch: "add-message-404" };
  }

  return { response: "404 Not Found!", nextState: state, branch: "unknown-404" };
}

// ---------------------------------------------------------------------------
// DocSearchServer
// ---------------------------------------------------------------------------

export type SearchBranch = "root" | "search-ok" | "search-no-q" | "unknown-path";

export interface SearchOutcome {
  response: string;
  branch: SearchBranch;
  foundPaths: string[];
}

export function docSearchHandle(rawUrl: string, docs: readonly CorpusDoc[]): SearchOutcome {
  const { path, query } = parseRequestUrl(rawUrl);

  if (path === "/") {
    return { response: `There are ${docs.length} total files to search.`, branch: "root", foundPaths: [] };
  }

  if (path === "/search") {
    const parameters = (query ?? "").split("=");
    if (parameters[0] === "q") {
      const term = parameters[1] ?? "";
      const foundPaths = docs
        .filter((d) => d.text.includes(term))
        .map((d) => d.path)
        .sort();
      const response = `Found ${foundPaths.length} paths:\n${foundPaths.join("\n")}`;
      return { response, branch: "search-ok", foundPaths };
    }
    return { response: "Couldn't find query parameter q", branch: "search-no-q", foundPaths: [] };
  }

  return { response: "Don't know how to handle that path!", branch: "unknown-path", foundPaths: [] };
}

// ---------------------------------------------------------------------------
// ListExamples: filter (order quirk) and merge (planted bug)
// ---------------------------------------------------------------------------

export type StringChecker = (s: string) => boolean;

/** Port of ListExamples.filter. result.add(0, s) means matches land in reverse order. */
export function filterQuirky(list: readonly string[], checker: StringChecker): string[] {
  const result: string[] = [];
  for (const s of list) {
    if (checker(s)) result.unshift(s);
  }
  return result;
}

/** Stands in for JUnit's @Test(timeout = 500) - a real infinite loop can't be
 * killed from inside itself, so this caps how many steps the port will take. */
export const MERGE_STEP_CAP = 3000;

export interface MergeOutcome {
  result: string[];
  timedOut: boolean;
  steps: number;
}

/** Port of ListExamples.merge. fixBug=false reproduces the planted bug (the
 * comment in the source says "change index1 below to index2 to fix test"). */
export function mergeBuggy(list1: readonly string[], list2: readonly string[], fixBug: boolean): MergeOutcome {
  const result: string[] = [];
  let index1 = 0;
  let index2 = 0;
  let steps = 0;

  while (index1 < list1.length && index2 < list2.length) {
    if (++steps > MERGE_STEP_CAP) return { result, timedOut: true, steps };
    if (list1[index1] < list2[index2]) {
      result.push(list1[index1]);
      index1 += 1;
    } else {
      result.push(list2[index2]);
      index2 += 1;
    }
  }
  while (index1 < list1.length) {
    if (++steps > MERGE_STEP_CAP) return { result, timedOut: true, steps };
    result.push(list1[index1]);
    index1 += 1;
  }
  while (index2 < list2.length) {
    if (++steps > MERGE_STEP_CAP) return { result, timedOut: true, steps };
    result.push(list2[index2]);
    if (fixBug) {
      index2 += 1;
    } else {
      // the planted bug: this should be index2 += 1
      index1 += 1;
    }
  }
  return { result, timedOut: false, steps };
}

export interface JUnitTestCase {
  name: string;
  l1: string[];
  l2: string[];
  expected: string[];
}

export const MERGE_TESTS: JUnitTestCase[] = [
  { name: "testMerge1", l1: ["x", "y"], l2: ["a", "b"], expected: ["a", "b", "x", "y"] },
  { name: "testMerge2", l1: ["a", "b", "c"], l2: ["c", "d", "e"], expected: ["a", "b", "c", "c", "d", "e"] },
];
