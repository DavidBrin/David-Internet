import numpy as np
import matplotlib.pyplot as plt

# %% ---- next cell ----

import nbformat
from nbformat.v4 import new_notebook, new_code_cell

################################################################################
# Ex.1: Pauli operator identities
################################################################################
# Goal: Verify the Pauli matrix multiplication identities:
#   X Y = i Z,   Y Z = i X,   Z X = i Y

import numpy as np

# Pauli matrices
X = np.array([[0,1],[1,0]], dtype=complex)
Y = np.array([[0,-1j],[1j,0]], dtype=complex)
Z = np.array([[1,0],[0,-1]], dtype=complex)

print("=== Ex.1: Pauli identities ===")
print("X @ Y == i Z ?", np.allclose(X.dot(Y), 1j * Z))
print("Y @ Z == i X ?", np.allclose(Y.dot(Z), 1j * X))
print("Z @ X == i Y ?", np.allclose(Z.dot(X), 1j * Y))
print()  # blank line for readability

################################################################################
# Ex.2: qubit(theta, phi) and Bloch vector checks
################################################################################
# Goal: Implement qubit(theta, phi) that returns the state vector
#   |psi> = cos(theta/2)|0> + e^{i phi} sin(theta/2)|1>
# Then compute the Bloch vector from the state's density matrix and compare to
# the analytical expression (sinθ cosφ, sinθ sinφ, cosθ).

def qubit(theta, phi):
    """Return a normalized qubit state vector |psi> = cos(theta/2)|0> + e^{i phi} sin(theta/2)|1>."""
    a = np.cos(theta/2)
    b = np.exp(1j*phi) * np.sin(theta/2)
    vec = np.array([a, b], dtype=complex)
    # Normalise numerically for safety
    vec = vec / np.linalg.norm(vec)
    return vec

def density(psi):
    """Return density matrix ρ = |ψ><ψ| for pure state psi."""
    return np.outer(psi, psi.conj())

def bloch_from_density(rho):
    """Extract Bloch vector r = (Tr(ρ σ_x), Tr(ρ σ_y), Tr(ρ σ_z))."""
    sx = np.array([[0,1],[1,0]], dtype=complex)
    sy = np.array([[0,-1j],[1j,0]], dtype=complex)
    sz = np.array([[1,0],[0,-1]], dtype=complex)
    return np.array([np.trace(rho @ sx).real, np.trace(rho @ sy).real, np.trace(rho @ sz).real])

print("=== Ex.2: qubit and Bloch vector checks ===")
tests = [(0,0), (np.pi/2, 0), (np.pi/2, np.pi/4), (np.pi, 0)]
for theta, phi in tests:
    psi = qubit(theta, phi)
    rho = density(psi)
    bloch = bloch_from_density(rho)
    expected = np.array([np.sin(theta)*np.cos(phi), np.sin(theta)*np.sin(phi), np.cos(theta)])
    print(f"theta={theta:.6f}, phi={phi:.6f} -> Bloch {bloch} expected {expected}, close? {np.allclose(bloch, expected)}")
print()

################################################################################
# Ex.3: Using np.kron to build controlled/block operators
################################################################################
# Goal: Construct the operator |0><0| ⊗ I + |1><1| ⊗ X using np.kron and confirm
# that it equals the expected 4x4 block-diagonal matrix [[I,0],[0,X]].

I = np.eye(2, dtype=complex)
zero = np.array([1,0], dtype=complex)
one = np.array([0,1], dtype=complex)
proj0 = np.outer(zero, zero.conj())   # |0><0|
proj1 = np.outer(one, one.conj())     # |1><1|

op = np.kron(proj0, I) + np.kron(proj1, X)
expected = np.block([[I, np.zeros((2,2))],[np.zeros((2,2)), X]])

print("=== Ex.3: np.kron and block operator ===")
print("Operator equals expected block matrix? ", np.allclose(op, expected))
print()

################################################################################
# Ex.4: Build common 4x4 two-qubit gates and check relations
################################################################################
# Goal: Create X⊗I, I⊗X, CNOT, CZ, SWAP and verify some identities:
# - SWAP^2 = I
# - (I ⊗ H) CZ (I ⊗ H) = CNOT  (Hadamard on target maps CZ to CNOT)

# Single-qubit and two-qubit constructions
X_first  = np.kron(X, I)
X_second = np.kron(I, X)

# CNOT defined as block [[I, 0], [0, X]]
CNOT = np.block([[I, np.zeros((2,2))],[np.zeros((2,2)), X]])

# CZ as diagonal (1,1,1,-1)
CZ = np.diag([1,1,1,-1])

# SWAP matrix: permutes |01> <-> |10>
SWAP = np.array([[1,0,0,0],
                 [0,0,1,0],
                 [0,1,0,0],
                 [0,0,0,1]], dtype=complex)

# Hadamard
H = np.array([[1,1],[1,-1]])/np.sqrt(2)
H_target = np.kron(I, H)

print("=== Ex.4: two-qubit gates and relations ===")
print("X_first equals kron(X,I)?", np.allclose(X_first, np.kron(X, I)))
print("X_second equals kron(I,X)?", np.allclose(X_second, np.kron(I, X)))
print("CNOT equals controlled-X block? ", np.allclose(CNOT, np.kron(np.array([[1,0],[0,0]]), I) + np.kron(np.array([[0,0],[0,1]]), X)))
print("SWAP squared = identity?", np.allclose(SWAP.dot(SWAP), np.eye(4)))
lhs = H_target.dot(CZ).dot(H_target)
print("Relation (I⊗H) CZ (I⊗H) = CNOT holds (approx)?", np.allclose(lhs, CNOT))
