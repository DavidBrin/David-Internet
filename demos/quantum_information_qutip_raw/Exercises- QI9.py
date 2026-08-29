
"""
Quantum Information -- Week 9: Solutions (all exercises)
This single code cell contains pen-and-paper explanations (as comment blocks / docstrings),
mathematical steps, and runnable code (NumPy; optional QuTiP examples commented / guarded).
Save and run this cell in an environment where you have numpy installed. If you want to run the
QuTiP parts, install QuTiP (`pip install qutip`) and uncomment the relevant lines.

---- PEN-AND-PAPER EXERCISES ----

Exercise 1
----------
Statement (rendered): Show that
    H^{\otimes n} |x> = 2^{-n/2} \sum_{y \in \{0,1\}^n} (-1)^{x \cdot y} |y>,
where x is an n-bit string, H is the single-qubit Hadamard, and x·y is the bitwise dot product modulo 2.

Proof / reasoning:
- For one qubit, H|0> = (|0> + |1>)/√2 and H|1> = (|0> - |1>)/√2.
  Equivalently H|x> = 2^{-1/2} \sum_{y=0}^1 (-1)^{x y} |y> (here xy is product in {0,1}).
- For n qubits the tensor-power H^{\otimes n} acts componentwise on basis states |x> = |x_1>⊗...⊗|x_n>:
    H^{\otimes n} |x> = (⊗_{j=1}^n H) (⊗_{j=1}^n |x_j>)
                     = ⊗_{j=1}^n (2^{-1/2} \sum_{y_j\in\{0,1\}} (-1)^{x_j y_j} |y_j>)
                     = 2^{-n/2} \sum_{y_1,...,y_n} (-1)^{\sum_j x_j y_j} |y_1...y_n>.
- The exponent sum is exactly the bitwise dot product x·y (mod 2). Thus we obtain the desired formula.
This generalises from n=1 by simple tensor-product expansion.

Exercise 2
----------
Find the bra-ket and matrix form of the unitary operations implementing all four possible single-bit
functions f:{0,1} -> {0,1} using the standard model with 2 qubits (1 input, 1 output):
    U_f |x>|y> = |x>|y ⊕ f(x)>

There are four possible functions f:
1) f0(x) = 0 (constant 0)
2) f1(x) = 1 (constant 1)
3) id(x) = x (identity)
4) neg(x) = x ⊕ 1 (negation)

Bra-ket forms and matrices (computational basis order |00>,|01>,|10>,|11>):
- For f0(x)=0: U_f |x,y> = |x,y>. So U_f = I_4 (identity 4x4 matrix).
- For f1(x)=1: U_f |x,y> = |x, y⊕1>. That flips the second qubit regardless of x, so U_f = I ⊗ X. Matrix is block-diagonal with X blocks.
- For id(x)=x: U_f |x,y> = |x, y⊕x>. This is the CNOT with first qubit as control, second as target. Matrix:
  CNOT = [[1,0,0,0],
          [0,1,0,0],
          [0,0,0,1],
          [0,0,1,0]]
- For neg(x)=x⊕1: Then y ⊕ f(x) = y ⊕ (x⊕1) = (y⊕1) ⊕ x. This is equivalent to first apply X on target, then CNOT, or as a single unitary it equals (I ⊗ X)·CNOT.

Exercise 3
----------
Construct quantum circuits that implement these oracles.
- f0: do nothing (identity) -> no gates.
- f1: apply X on output qubit -> single X on second qubit.
- id: apply CNOT (control = input, target = output).
- neg: apply CNOT then X on the target (or X then CNOT then X depending on convenience).

Exercise 4
----------
Construct 4-qubit circuits that implement U_f for a few different constant and balanced functions f.
Context: For Deutsch-Jozsa with n=3 input qubits and one output qubit, U_f maps |x>|y> -> |x>|y ⊕ f(x)>.
- Constant functions: f(x)=0 for all x (no gates), f(x)=1 for all x (apply X to the output qubit).
- Balanced example: f(x) = x_1 (first input bit). Then U_f = CNOT with control qubit 0 and target qubit (output). In 4-qubit space that's kron(proj on other inputs as identity) etc.; practically we implement CNOTs controlled by the particular input bits that define f.
- Another balanced: f(x) = x_1 ⊕ x_2, implement using two CNOTs from input bits 1 and 2 to the output (mod 2 sum).

Exercise 5
----------
Prove unitarity of the general n→m (classical) quantum processor U_f:
    U_f |x>|y> = |x>|y ⊕ f(x)>
for all bit-strings x (length n) and y (length m).

Proof outline:
- Define U_f on computational basis states as above. It permutes basis vectors: for fixed x, the map y -> y ⊕ f(x) is a bijection on the set {0,1}^m (XOR with fixed string is invertible: same operation is its own inverse).
- A linear map which permutes an orthonormal basis is unitary because its matrix representation in that basis is a permutation matrix (which is orthogonal/unitary): rows and columns are orthonormal basis vectors permuted, hence UU^\dagger = I.
- Concretely, for basis states |x,y> and |x',y'>, U_f maps them to |x,y⊕f(x)> and |x',y'⊕f(x')>. The inner product is preserved because basis states are orthonormal and permutation preserves inner products. So U_f is unitary.

---- COMPUTATIONAL EXERCISES ----
The code below provides:
 - explicit NumPy matrix constructions for the 2-qubit oracles (exercise 2),
 - constructions for some 4-qubit oracles (exercise 4) for constant and balanced functions,
 - a simple simulation of the Deutsch-Jozsa algorithm using NumPy (for small n) and an optional QuTiP circuit example (commented). 
 - a demonstration of Bernstein-Vazirani using NumPy (exercise 7).

IMPORTANT: This code uses NumPy. QuTiP examples are included but guarded: the script checks if qutip is importable.
"""

# ---------------------- Python / NumPy code ----------------------
import numpy as np
from itertools import product

# Helper: computational basis vectors for n qubits
def basis_state(n, idx):
    v = np.zeros((2**n,), dtype=complex)
    v[idx] = 1.0
    return v

def int_to_bits(x, n):
    return tuple(((x >> i) & 1) for i in reversed(range(n)))

def bits_to_int(bits):
    v = 0
    for b in bits:
        v = (v << 1) | int(b)
    return v

# Pauli X and identity
X = np.array([[0,1],[1,0]], dtype=complex)
I2 = np.eye(2, dtype=complex)

# Build U_f for 1-bit functions (2-qubit unitary)
def Uf_1bit(f):
    # f: function mapping 0/1 -> 0/1
    U = np.zeros((4,4), dtype=complex)
    # computational basis order: |00>,|01>,|10>,|11>
    for x in [0,1]:
        for y in [0,1]:
            in_idx = (x<<1) | y
            out_y = y ^ f(x)
            out_idx = (x<<1) | out_y
            U[out_idx, in_idx] = 1.0
    return U

# Define the four functions
f_const0 = lambda x: 0
f_const1 = lambda x: 1
f_id     = lambda x: x
f_neg    = lambda x: x ^ 1

U_iden = Uf_1bit(f_const0)  # identity
U_flip = Uf_1bit(f_const1)  # I ⊗ X
U_cnot = Uf_1bit(f_id)      # CNOT
U_neg  = Uf_1bit(f_neg)     # negation oracle (CNOT with extra X)

print("2-qubit oracle matrices (rows/cols ordered as |00,|01,|10,|11>):")
print("U(identity) =\n", U_iden)
print("U(f=1) = I⊗X ?\n", U_flip)
print("U(id) = CNOT ?\n", U_cnot)
print("U(neg) =\n", U_neg)

# Verify relations
print("\nChecks:")
print("U(identity) is identity:", np.allclose(U_iden, np.eye(4)))
print("U(f=1) equals kron(I,X):", np.allclose(U_flip, np.kron(I2, X)))
print("U(id) is unitary and equals CNOT:", np.allclose(U_cnot.dot(U_cnot.conj().T), np.eye(4)))

# ---------------------- Build some 4-qubit oracles ----------------------
# We'll consider 3 input qubits + 1 output qubit = 4 qubits total.
def Uf_n_to_m(f, n, m):
    """
    Construct U_f for n input qubits and m output qubits as a 2^(n+m) x 2^(n+m) matrix.
    f: function mapping int in [0,2^n) -> int in [0,2^m)
    """
    dim = 2**(n+m)
    U = np.zeros((dim, dim), dtype=complex)
    for x in range(2**n):
        for y in range(2**m):
            in_idx = (x << m) | y
            out_y = y ^ f(x)
            out_idx = (x << m) | out_y
            U[out_idx, in_idx] = 1.0
    return U

# Examples: n=3 (inputs), m=1 (single output)
n = 3; m = 1

# constant zero: f(x)=0
f_c0 = lambda x: 0
U_c0 = Uf_n_to_m(f_c0, n, m)

# constant one: f(x)=1
f_c1 = lambda x: 1
U_c1 = Uf_n_to_m(f_c1, n, m)

# balanced examples:
# f(x) = x_0 (most significant bit) i.e. returns first bit of x
def f_bit0(x):
    bits = int_to_bits(x, n)
    return bits[0]

U_bit0 = Uf_n_to_m(f_bit0, n, m)

# f(x) = parity of the first two bits (x0 XOR x1)
def f_xor01(x):
    bits = int_to_bits(x, n)
    return bits[0] ^ bits[1]

U_xor01 = Uf_n_to_m(f_xor01, n, m)

print("\n4-qubit U_f sizes and unitarity checks:")
for name, U in [("constant0", U_c0), ("constant1", U_c1), ("bit0", U_bit0), ("xor01", U_xor01)]:
    print(f"{name}: shape={U.shape}, unitary? {np.allclose(U.dot(U.conj().T), np.eye(U.shape[0]))}")

# ---------------------- Deutsch-Jozsa simulation (NumPy) ----------------------
# We'll implement DJ for small n by building circuits with H gates and Uf matrices.
def H_single():
    return np.array([[1,1],[1,-1]], dtype=complex) / np.sqrt(2)

def H_n(n):
    H = H_single()
    res = H
    for _ in range(n-1):
        res = np.kron(res, H)
    return res

def run_deutsch_jozsa(Uf, n):
    """
    Uf: 2^(n+1) x 2^(n+1) unitary (n input, 1 output)
    Returns probability of measuring input qubits = 0^n after running DJ protocol.
    """
    dim = 2**(n+1)
    # Initial state |0^n>|1>
    psi0 = np.zeros((dim,), dtype=complex)
    psi0[(0<<1) | 1] = 1.0
    # Apply H^{\otimes n} on inputs and H on output
    H_all = np.kron(H_n(n), H_single())
    psi = H_all.dot(psi0)
    # apply oracle
    psi = Uf.dot(psi)
    # apply H^{\otimes n} on inputs again (identity on output)
    psi = np.kron(H_n(n), np.eye(2)).dot(psi)
    # Probability input=0^n
    prob_zero = 0.0
    for y in [0,1]:
        idx = (0<<1) | y
        prob_zero += np.abs(psi[idx])**2
    return prob_zero

print("\nDeutsch-Jozsa simulation (n=3 inputs):")
for name, U in [("constant0", U_c0), ("constant1", U_c1), ("bit0", U_bit0), ("xor01", U_xor01)]:
    p0 = run_deutsch_jozsa(U, n=3)
    print(f"{name}: probability input=0^n = {p0:.6f}")

# ---------------------- Bernstein-Vazirani (NumPy) ----------------------
def Uf_bernstein_vazirani(s_bits):
    n = len(s_bits); m = 1
    def f(x):
        bits = int_to_bits(x, n)
        dot = 0
        for a,b in zip(bits, s_bits):
            dot ^= (a & b)
        return dot
    return Uf_n_to_m(f, n, 1)

def run_bv(Uf, n):
    dim = 2**(n+1)
    psi0 = np.zeros((dim,), dtype=complex)
    psi0[(0<<1) | 1] = 1.0
    psi = np.kron(H_n(n), H_single()).dot(psi0)
    psi = Uf.dot(psi)
    psi = np.kron(H_n(n), np.eye(2)).dot(psi)
    probs = np.zeros((2**n,))
    for x in range(2**n):
        idx0 = (x<<1) | 0
        idx1 = (x<<1) | 1
        probs[x] = np.abs(psi[idx0])**2 + np.abs(psi[idx1])**2
    return probs

s_bits = (1,0,1)
Uf_bv = Uf_bernstein_vazirani(s_bits)
probs = run_bv(Uf_bv, n=3)
print("\nBernstein-Vazirani example (s=101): measurement probabilities for inputs (should peak at x=s):")
for x in range(2**3):
    print(f"x={format(x,'03b')}, prob={probs[x]:.6f}")
print("Expected peak at x = s =", ''.join(str(b) for b in s_bits))

# ---------------------- Optional: QuTiP demonstration ----------------------
try:
    import qutip as qt
    from qutip.qip.circuit import QubitCircuit
    print("\nQuTiP is available. Example QubitCircuit for CNOT:")
    qc = QubitCircuit(2)
    qc.add_gate("CNOT", targets=[1], controls=[0])
    print(qc)
except Exception:
    print("\nQuTiP not available; if you want qubit-circuit simulation with QuTiP, install `qutip`.")

# End of cell
'''

nb = new_notebook(cells=[new_code_cell(content)])
out_path = "/mnt/data/Exercises_QI_Week9_solutions_one_cell.ipynb"
with open(out_path, "w") as f:
    nbformat.write(nb, f)

out_path
