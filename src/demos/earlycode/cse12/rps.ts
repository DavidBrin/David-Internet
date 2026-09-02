/**
 * TS port of David's CSE 12 RPS
 * (demos/java_servers_raw/cse12/RPS.java + RPSAbstract.java).
 * determineWinner and the playRPS/displayStats bookkeeping are ported
 * verbatim. genCPUMove is backed by JavaRandom below, a faithful port of
 * java.util.Random's linear congruential generator seeded with
 * RPSAbstract.SEED (12), so the CPU's move sequence matches the original
 * program's for a fresh game.
 */

const JL_MULTIPLIER = 0x5deece66dn;
const JL_ADDEND = 0xbn;
const JL_MASK = (1n << 48n) - 1n;

/** Minimal port of java.util.Random - only what genCPUMove needs. */
export class JavaRandom {
  private seed: bigint;

  constructor(seed: number) {
    this.seed = (BigInt(seed) ^ JL_MULTIPLIER) & JL_MASK;
  }

  private next(bits: number): number {
    this.seed = (this.seed * JL_MULTIPLIER + JL_ADDEND) & JL_MASK;
    return Number(this.seed >> BigInt(48 - bits));
  }

  nextInt(bound: number): number {
    if (bound <= 0) throw new Error("bound must be positive");
    if ((bound & -bound) === bound) {
      // power of two
      return Number((BigInt(bound) * BigInt(this.next(31))) >> 31n);
    }
    let bits: number;
    let val: number;
    do {
      bits = this.next(31);
      val = bits % bound;
      // 32-bit signed overflow check, exactly like java.util.Random.nextInt
    } while (((bits - val + (bound - 1)) | 0) < 0);
    return val;
  }
}

export const SEED = 12;
export const DEFAULT_MOVES: readonly string[] = ["rock", "paper", "scissors"];
export const FIVE_MOVES: readonly string[] = ["rock", "paper", "scissors", "lizard", "spock"];

export const TIE_OUTCOME = 0;
export const PLAYER_WIN_OUTCOME = 1;
export const CPU_WIN_OUTCOME = 2;
export const INVALID_INPUT_OUTCOME = -1;

/** Mirrors RPS.determineWinner(String, String) verbatim. */
export function determineWinner(playerMove: string, cpuMove: string, moves: readonly string[]): number {
  let pnum = -1;
  let cnum = -1;
  for (let i = 0; i < moves.length; i++) {
    if (moves[i] === cpuMove) cnum = i;
    if (moves[i] === playerMove) pnum = i;
  }
  if (cnum === -1 || pnum === -1) return INVALID_INPUT_OUTCOME;
  if ((pnum + 1) % moves.length === cnum) return CPU_WIN_OUTCOME;
  if ((cnum + 1) % moves.length === pnum) return PLAYER_WIN_OUTCOME;
  return TIE_OUTCOME;
}

/** The same modular check as determineWinner, spelled out for display. */
export function explainRound(playerMove: string, cpuMove: string, moves: readonly string[]): string {
  const pnum = moves.indexOf(playerMove);
  const cnum = moves.indexOf(cpuMove);
  const n = moves.length;
  if (pnum === -1 || cnum === -1) return "invalid move";
  if ((pnum + 1) % n === cnum) {
    return `you: ${playerMove} (${pnum}), cpu: ${cpuMove} (${cnum}) -> (${pnum}+1)%${n} == ${cnum} -> cpu wins`;
  }
  if ((cnum + 1) % n === pnum) {
    return `you: ${playerMove} (${pnum}), cpu: ${cpuMove} (${cnum}) -> (${cnum}+1)%${n} == ${pnum} -> you win`;
  }
  if (pnum === cnum) {
    return `you: ${playerMove} (${pnum}), cpu: ${cpuMove} (${cnum}) -> same move -> tie`;
  }
  // Neither modular check holds: with more than 3 moves this happens for
  // DIFFERENT moves too (any pair more than one step apart on the cycle) -
  // the rule only ever makes each move beat exactly one other move.
  return `you: ${playerMove} (${pnum}), cpu: ${cpuMove} (${cnum}) -> neither (${pnum}+1)%${n}==${cnum} nor (${cnum}+1)%${n}==${pnum} -> tie`;
}

export interface RoundResult {
  playerMove: string;
  cpuMove: string;
  outcome: number;
  explanation: string;
}

export interface RpsStats {
  numGames: number;
  numPlayerWins: number;
  numCPUWins: number;
  numTies: number;
  /** Chronological order, oldest first (matches playerMoves/cpuMoves). */
  history: RoundResult[];
}

export function createStats(): RpsStats {
  return { numGames: 0, numPlayerWins: 0, numCPUWins: 0, numTies: 0, history: [] };
}

/** Mirrors RPSAbstract.playRPS's bookkeeping (numGames/wins/ties/history). */
export function playRPS(stats: RpsStats, playerMove: string, cpuMove: string, moves: readonly string[]): RpsStats {
  const outcome = determineWinner(playerMove, cpuMove, moves);
  return {
    numGames: stats.numGames + 1,
    numPlayerWins: stats.numPlayerWins + (outcome === PLAYER_WIN_OUTCOME ? 1 : 0),
    numCPUWins: stats.numCPUWins + (outcome === CPU_WIN_OUTCOME ? 1 : 0),
    numTies: stats.numTies + (outcome === TIE_OUTCOME ? 1 : 0),
    history: [...stats.history, { playerMove, cpuMove, outcome, explanation: explainRound(playerMove, cpuMove, moves) }],
  };
}

/** Mirrors RPSAbstract.genCPUMove(). */
export function genCPUMove(rng: JavaRandom, moves: readonly string[]): string {
  const num = rng.nextInt(moves.length);
  return moves[num];
}

/** Mirrors RPSAbstract.displayStats' percentage formula (numGames denominator). */
export function winPercent(count: number, numGames: number): string {
  if (numGames === 0) return "0.0";
  return ((count / numGames) * 100).toFixed(1);
}
