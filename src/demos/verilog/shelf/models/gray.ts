/**
 * hw6 `gray_code_to_binary_convertor.sv`: b[N-1] = g[N-1]; b[i] = b[i+1] ^ g[i].
 * The RTL registers input and output, so a value shows up two clocks after it is applied.
 */

export function grayToBinary(gray: number, n: number): number {
  let b = (gray >>> (n - 1)) & 1;
  let result = b << (n - 1);
  for (let i = n - 2; i >= 0; i--) {
    b ^= (gray >>> i) & 1;
    result |= b << i;
  }
  return result >>> 0;
}

export function binaryToGray(binary: number): number {
  return (binary ^ (binary >>> 1)) >>> 0;
}

/** The XOR chain as the RTL evaluates it, MSB first: [{ i, g, b }] */
export function grayChain(gray: number, n: number): { i: number; g: number; b: number }[] {
  const out: { i: number; g: number; b: number }[] = [];
  let b = 0;
  for (let i = n - 1; i >= 0; i--) {
    const g = (gray >>> i) & 1;
    b = i === n - 1 ? g : b ^ g;
    out.push({ i, g, b });
  }
  return out;
}
