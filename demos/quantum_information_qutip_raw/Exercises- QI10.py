
import nbformat
from nbformat.v4 import new_notebook, new_code_cell

code = r'''
# Simon's-algorithm exercises (Week 10) -- All-in-one code cell
# Explanations and math are given as comment blocks above each computation.
# This cell implements the tasks: XOR pairing with s=6, inner products mod 2,
# Hadamard transforms on 4 qubits, constructing a two-to-one oracle for Simon's
# hidden string s (using f(x)=min(x, x^s) as a convenient two-to-one mapping),
# and a NumPy simulation of Simon's algorithm that reads out the input register
# probabilities (the measurement statistics used to recover s).
#
# The original exercise sheet is "Exercises - QI Week 10.pdf".
# (Solutions here were prepared based on that sheet.)

import numpy as np
from itertools import product

# ---------------------- Utilities ----------------------
def bits(x, n):
    "Return tuple of n bits (most-significant first) representing integer x."
    return tuple(((x >> i) & 1) for i in reversed(range(n)))

def int_from_bits(bits_tuple):
    v = 0
    for b in bits_tuple:
        v = (v << 1) | int(b)
    return v

def bitwise_inner_mod2(a_bits, b_bits):
    "Return inner product (mod 2) of two bit tuples."
    s = 0
    for ai, bi in zip(a_bits, b_bits):
        s ^= (ai & bi)
    return s

def hadamard_n(n):
    "Return H^{\otimes n} as a 2^n x 2^n matrix."
    H = np.array([[1,1],[1,-1]], dtype=complex) / np.sqrt(2)
    res = H
    for _ in range(n-1):
        res = np.kron(res, H)
    return res if n>0 else np.array([[1.]], dtype=complex)

# ---------------------- Exercise 1: XOR with 6 (pairing) ----------------------
n = 4
s = 6  # secret/shift used in the exercise example
pairs = {}
print("Exercise 1: XOR with s =", s)
for x in range(2**n):
    y = x ^ s
    pairs[x] = y
# Display pairs (only once per pair)
seen = set()
for x in range(2**n):
    y = pairs[x]
    if x in seen or y in seen:
        continue
    print(f"{x:2d} (bits {bits(x,n)})  <-->  {y:2d} (bits {bits(y,n)})")
    seen.add(x); seen.add(y)
print()

# ---------------------- Exercise 2: inner products modulo 2 with bitstring for 13 ----------------------
x0 = 13
x0_bits = bits(x0, n)
print("Exercise 2: inner products mod 2 between bitstring of", x0, "and all numbers 0..15:")
for y in range(2**n):
    y_bits = bits(y, n)
    ip = bitwise_inner_mod2(x0_bits, y_bits)
    print(f"y={y:2d} bits={y_bits}  <x0,y> mod2 = {ip}")
print()

# ---------------------- Exercise 3: Hadamard on |13> and expansion ----------------------
# Prepare basis vector |13> in 4 qubits
dim = 2**n
e13 = np.zeros((dim,), dtype=complex); e13[x0] = 1.0
H4 = hadamard_n(n)
psi = H4.dot(e13)  # H^{\otimes 4} |13>
print("Exercise 3: H^{⊗4} |13> expanded as amplitudes for |y> (y from 0..15):")
for y in range(dim):
    amp = psi[y]
    phase = np.angle(amp)
    mag = np.abs(amp)
    # amplitude equals 2^{-n/2} * (-1)^{x0·y} for computational basis
    expected = (1/np.sqrt(dim)) * ((-1)**bitwise_inner_mod2(x0_bits, bits(y,n)))
    print(f"y={y:2d} bits={bits(y,n)} amp={amp:.4f} expected={expected:.4f} close? {np.allclose(amp, expected)}")
print()

# ---------------------- Exercise 4: Hadamard of (|x> + |x⊕s>)/sqrt(2) ----------------------
# In Simon's algorithm after querying the oracle and measuring the output register
# one obtains (up to normalization) the input superposition (|x> + |x⊕s>)/sqrt(2).
# Let's take x = 13 and s = 6 as in the exercises.
x = x0
x_xors = x ^ s
phi = np.zeros((dim,), dtype=complex)
phi[x] = 1/np.sqrt(2)
phi[x_xors] = 1/np.sqrt(2)
print("Exercise 4: state (|x> + |x⊕s>)/√2 has nonzero components at x and x⊕s:",
      f"{x} and {x_xors}, bits {bits(x,n)} & {bits(x_xors,n)}")
# Apply Hadamard to this state
phi_H = H4.dot(phi)
print("After H^{⊗4}, amplitudes (displaying only non-negligible ones):")
for y in range(dim):
    amp = phi_H[y]
    if np.abs(amp) > 1e-8:
        print(f"y={y:2d} bits={bits(y,n)} amp={amp:.6f} (real approx {amp.real:.6f})")
print()
# Observe: which y's survive? They are those satisfying y·s = 0 (mod 2).
survivors = [y for y in range(dim) if abs(phi_H[y])>1e-8]
print("Surviving y values:", survivors)
print("Check y·s mod2 == 0 for survivors? ->", [bitwise_inner_mod2(bits(y,n), bits(s,n)) for y in survivors])
print()

# ---------------------- Exercise 5: Using measurement outcomes to find s ----------------------
# Each survivor y gives a linear equation y·s = 0 (mod 2). Collect a few survivors and solve.
# We'll gather unique survivors and solve the linear system over GF(2).
ys = survivors  # measurement outcomes one could obtain
# Build matrix A with rows = bit vectors of y, RHS zero vector
A = np.array([bits(y,n) for y in ys], dtype=int)
b = np.zeros((len(ys),), dtype=int)

# Solve for s over GF(2): we can use Gaussian elimination mod 2.
def solve_gf2(A, b):
    A = A.copy() % 2
    b = b.copy() % 2
    rows, cols = A.shape
    r = 0
    pivots = []
    for c in range(cols):
        # find pivot in column c at or below row r
        pivot = None
        for i in range(r, rows):
            if A[i,c] == 1:
                pivot = i; break
        if pivot is None:
            continue
        if pivot != r:
            A[[r,pivot]] = A[[pivot,r]]
            b[r], b[pivot] = b[pivot], b[r]
        pivots.append(c)
        # eliminate other rows
        for i in range(rows):
            if i != r and A[i,c] == 1:
                A[i,:] ^= A[r,:]
                b[i] ^= b[r]
        r += 1
        if r == rows:
            break
    # brute-force search for solutions (small n)
    sols = []
    for candidate in range(2**cols):
        s_bits = np.array(bits(candidate, cols), dtype=int)
        if np.all((A.dot(s_bits) % 2) == b):
            sols.append(candidate)
    return sols

possible_solutions = solve_gf2(A, b)
print("Possible s values consistent with survivors (should include the true s):", possible_solutions)
print("True s =", s)
print()

# ---------------------- Exercise 6: Create an oracle on 4+4 qubits for a two-to-one function
# We'll implement a standard Simon two-to-one function defined by a hidden string s:
#   f_s(x) = min(x, x ⊕ s)
# This maps the pair (x, x⊕s) to the same integer value (the smaller one) creating a two-to-one map.
def f_s_min(x, s):
    return min(x, x ^ s)

def Uf_for_s(s, n=4, m=4):
    "Construct Uf as a 2^(n+m) x 2^(n+m) permutation matrix implementing |x>|y> -> |x>|y ⊕ f(x)>."
    dim = 2**(n+m)
    U = np.zeros((dim, dim), dtype=complex)
    for x in range(2**n):
        fx = f_s_min(x, s)
        for y in range(2**m):
            in_idx = (x << m) | y
            out_y = y ^ fx
            out_idx = (x << m) | out_y
            U[out_idx, in_idx] = 1.0
    return U

Uf = Uf_for_s(s, n=4, m=4)
print("Exercise 6: Constructed oracle Uf for s =", s, "shape =", Uf.shape, "unitary?", np.allclose(Uf.dot(Uf.conj().T), np.eye(Uf.shape[0])))
print()

# ---------------------- Exercise 7: Simulate Simon's algorithm (read out first 4 qubits)
# Standard Simon circuit (one query):
# 1. Prepare |0^n>|0^m>.
# 2. Apply H^{⊗n} to input register.
# 3. Apply Uf.
# 4. (Optionally measure output; equivalently, trace out output register.)
# 5. Apply H^{⊗n} to input register and measure input register.
# We'll compute the probability distribution over input measurement outcomes.
n = 4; m = 4
dim_all = 2**(n+m)
# initial state |0^n>|0^m>
psi0 = np.zeros((dim_all,), dtype=complex); psi0[0] = 1.0
# apply H^{⊗n} on input: H_inputs ⊗ I_out
H_inputs = hadamard_n(n)
U_H_inputs = np.kron(H_inputs, np.eye(2**m, dtype=complex))
psi = U_H_inputs.dot(psi0)
# apply oracle Uf
psi = Uf.dot(psi)
# Now we can either measure output or trace it out. We'll trace out the output register to get reduced density on inputs.
rho = np.outer(psi, psi.conj()).reshape([2**n,2**m,2**n,2**m])
# partial trace over output: result index order (in,out,in',out') so trace over output indices 1 and 3
rho_in = np.zeros((2**n,2**n), dtype=complex)
for y in range(2**m):
    rho_in += rho[:, y, :, y]
# apply H^{⊗n} again
rho_in_after = H_inputs.dot(rho_in).dot(H_inputs.conj().T)
# probabilities for measuring input register in computational basis:
probs = np.real(np.diag(rho_in_after))
print("Exercise 7: Probabilities for input register outcomes (indices 0..15):")
for i,p in enumerate(probs):
    if p > 1e-12:
        print(f"y={i:2d} bits={bits(i,n)} prob={p:.6f}")
print("Sum of probs:", probs.sum())
print()

# ---------------------- End of cell ----------------------
'''

nb = new_notebook(cells=[new_code_cell(code)])
out_path = "/mnt/data/Exercises_QI_Week10_one_cell.ipynb"
with open(out_path, "w") as f:
    nbformat.write(nb, f)

out_path
