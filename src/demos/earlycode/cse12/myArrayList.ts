/**
 * TS port of David's CSE 12 MyArrayList
 * (demos/java_servers_raw/cse12/MyArrayList.java). Mirrors the Java
 * implementation's exact branches, including its quirks:
 *  - expandCapacity's four branches (empty-and-under-default,
 *    empty-and-over-default, double, exact) are reproduced verbatim,
 *  - insert()'s bounds check is against capacity (values.length), not
 *    length, exactly like the source,
 *  - the shift loops in insert/prepend/remove walk the FULL backing array
 *    (values.length), not just the valid length. Most of that walk is
 *    shifting nulls around; this module still runs the full loop (so the
 *    shift COUNT reported is exact) but only emits an animation frame when
 *    a real value actually moves, so the animation reads as "N elements
 *    moved" instead of a wall of empty hops.
 * Not fixture-tested against the Java source (no JVM in this pipeline) -
 * hand-traced against demos/java_servers_raw/cse12/MyArrayList.java instead.
 */

export const DEFAULT_CAPACITY = 5;

export type Slot = string | null;

export interface ListState {
  values: Slot[];
  length: number;
}

export interface Frame {
  values: Slot[];
  length: number;
  /** Indices touched this frame, for the box-highlight animation. */
  highlight: number[];
  note: string;
}

function pushFrame(frames: Frame[], state: ListState, highlight: number[], note: string): void {
  frames.push({ values: state.values.slice(), length: state.length, highlight, note });
}

export function createList(initialCapacity: number = DEFAULT_CAPACITY): ListState {
  return { values: new Array<Slot>(initialCapacity).fill(null), length: 0 };
}

/** Mirrors MyArrayList.expandCapacity(int) exactly. Mutates state.values. */
export function expandCapacity(state: ListState, requiredCapacity: number, frames: Frame[]): void {
  const oldCapacity = state.values.length;
  if (requiredCapacity < oldCapacity) {
    throw new Error("expandCapacity: requiredCapacity < capacity (IllegalArgumentException)");
  }

  let newCapacity: number;
  if (oldCapacity === 0 && DEFAULT_CAPACITY >= requiredCapacity) {
    newCapacity = DEFAULT_CAPACITY;
  } else if (oldCapacity === 0) {
    newCapacity = requiredCapacity;
  } else if (oldCapacity * 2 > requiredCapacity) {
    newCapacity = oldCapacity * 2;
  } else {
    newCapacity = requiredCapacity;
  }

  const oldValues = state.values;
  const newValues = new Array<Slot>(newCapacity).fill(null);
  pushFrame(frames, { values: oldValues, length: state.length }, [], `capacity ${oldCapacity} -> ${newCapacity}: new backing array allocated`);
  for (let i = 0; i < oldValues.length; i++) {
    if (oldValues[i] === null) continue; // Java copies these too; eliding empty hops from the animation
    newValues[i] = oldValues[i];
    pushFrame(frames, { values: newValues, length: state.length }, [i], `copy values[${i}] into the new array`);
  }
  state.values = newValues;
}

function pluralize(n: number): string {
  return n === 1 ? "element" : "elements";
}

/** Mirrors MyArrayList.insert(int, E). */
export function insert(state: ListState, index: number, element: string, frames: Frame[]): string {
  if (index < 0 || index > state.values.length) {
    throw new Error("insert: index out of bounds (IndexOutOfBoundsException)");
  }
  const oldCapacity = state.values.length;
  const oldLength = state.length;
  const grew = state.length === state.values.length;
  if (grew) expandCapacity(state, state.length + 1, frames);

  let shifted = 0;
  for (let i = state.values.length - 1; i > index; i--) {
    const src = state.values[i - 1];
    state.values[i] = src;
    if (src !== null) {
      shifted++;
      pushFrame(frames, state, [i - 1, i], `shift values[${i - 1}] -> values[${i}]`);
    }
  }
  state.values[index] = element;
  state.length++;
  pushFrame(frames, state, [index], `place "${element}" at values[${index}]`);

  const capNote = grew ? `capacity ${oldCapacity} -> ${state.values.length}, ` : "";
  return `insert(${index}, "${element}"): ${capNote}shifted ${shifted} ${pluralize(shifted)}, length ${oldLength} -> ${state.length}`;
}

/** Mirrors MyArrayList.append(E). */
export function append(state: ListState, element: string, frames: Frame[]): string {
  const oldCapacity = state.values.length;
  const oldLength = state.length;
  const grew = state.length >= state.values.length || state.values.length === 0;
  if (grew) expandCapacity(state, state.length + 1, frames);

  state.values[state.length] = element;
  state.length++;
  pushFrame(frames, state, [state.length - 1], `place "${element}" at values[${state.length - 1}]`);

  const capNote = grew ? `capacity ${oldCapacity} -> ${state.values.length}, ` : "";
  return `append("${element}"): ${capNote}length ${oldLength} -> ${state.length}`;
}

/** Mirrors MyArrayList.prepend(E). */
export function prepend(state: ListState, element: string, frames: Frame[]): string {
  const oldCapacity = state.values.length;
  const oldLength = state.length;
  const grew = state.length >= state.values.length || state.values.length === 0;
  if (grew) expandCapacity(state, state.length + 1, frames);

  let shifted = 0;
  for (let i = state.values.length - 1; i > 0; i--) {
    const src = state.values[i - 1];
    state.values[i] = src;
    if (src !== null) {
      shifted++;
      pushFrame(frames, state, [i - 1, i], `shift values[${i - 1}] -> values[${i}]`);
    }
  }
  state.values[0] = element;
  state.length++;
  pushFrame(frames, state, [0], `place "${element}" at values[0]`);

  const capNote = grew ? `capacity ${oldCapacity} -> ${state.values.length}, ` : "";
  return `prepend("${element}"): ${capNote}shifted ${shifted} ${pluralize(shifted)}, length ${oldLength} -> ${state.length}`;
}

/** Mirrors MyArrayList.remove(int). */
export function removeAt(state: ListState, index: number, frames: Frame[]): string {
  if (index < 0 || index >= state.length) {
    throw new Error("remove: index out of bounds (IndexOutOfBoundsException)");
  }
  const removed = state.values[index];
  const oldLength = state.length;

  let shifted = 0;
  for (let i = index; i < state.values.length - 1; i++) {
    const src = state.values[i + 1];
    state.values[i] = src;
    if (src !== null) {
      shifted++;
      pushFrame(frames, state, [i, i + 1], `shift values[${i + 1}] -> values[${i}]`);
    }
  }
  state.values[state.values.length - 1] = null;
  state.length--;
  pushFrame(frames, state, [state.values.length - 1], `clear values[${state.values.length - 1}]`);

  return `remove(${index}): removed "${String(removed)}", shifted ${shifted} ${pluralize(shifted)} left, length ${oldLength} -> ${state.length}`;
}

/** Mirrors MyArrayList.get(int). */
export function getAt(state: ListState, index: number, frames: Frame[]): string {
  if (index < 0 || index >= state.length) {
    throw new Error("get: index out of bounds (IndexOutOfBoundsException)");
  }
  pushFrame(frames, state, [index], `read values[${index}]`);
  return `get(${index}) -> "${String(state.values[index])}"`;
}

/** Mirrors MyArrayList.set(int, E). */
export function setAt(state: ListState, index: number, element: string, frames: Frame[]): string {
  if (index < 0 || index >= state.length) {
    throw new Error("set: index out of bounds (IndexOutOfBoundsException)");
  }
  const prev = state.values[index];
  state.values[index] = element;
  pushFrame(frames, state, [index], `overwrite values[${index}]`);
  return `set(${index}, "${element}") -> was "${String(prev)}"`;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Short auto-generated values: A, B, ..., Z, A2, B2, ... */
export function nextValue(seqIndex: number): string {
  const cycle = Math.floor(seqIndex / LETTERS.length) + 1;
  const letter = LETTERS[seqIndex % LETTERS.length];
  return cycle === 1 ? letter : `${letter}${cycle}`;
}
