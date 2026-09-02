# 3.2 Automatic differentiation.ipynb - code cells + exercise text extracted for the Source drawer.
# DTU 02456 Deep Learning (fall 2025) course notebook with David's solutions;
# outputs stripped (originals in demos/dtu_deep_learning_notebooks_raw/).

# # Credits
#
# This is heavily influenced or copied from https://github.com/pytorch/tutorials

# # Autograd: automatic differentiation
#
# Central to all neural networks in PyTorch is the ``autograd`` package.
# Let’s first briefly visit this, and we will then go to training our first neural network.
#
# The `autograd` package provides automatic differentiation for all operations on Tensors.
# It is a define-by-run framework, which means that your backprop is defined by how your code is run, and that every single iteration can be different.
#
# Let us see this in more simple terms with some examples.

# ## 1. Tensor
#
# `torch.Tensor` is the central class of the package. Setting the attribute `.requires_grad` to `True` will make the tensor "record" all operations on it. When you finish your computation you can call `.backward()` and have all the gradients computed automatically. The gradient for this tensor will be accumulated into the `.grad` attribute.
#
# ![autograd.Variable](../static_files/autograd-variable.png)
#
# There’s one more class which is very important for autograd implementation - a `Function`.
#
# `Tensor` and `Function` are interconnected and build up an acyclic graph, that encodes a complete history of computation. Each tensor has a `.grad_fn` attribute that references a `Function` that has created the `Tensor` (except for Tensors created by the user - their `grad_fn` is `None`).
#
# If you want to compute the derivatives, you can call `.backward()` on a Tensor. If `Tensor` is a scalar (i.e. it holds a one element data), you don’t need to specify any arguments to backward(), however if it has more elements, you need to specify a `gradient` argument that is a tensor of matching shape.

import torch

# Create a tensor

x = torch.ones(2, 2, requires_grad=True)
print(x)

# Do a tensor operation:

y = x + 2
print(y)

# `y` was created as a result of an operation, so it has a `grad_fn`.

print(y.grad_fn)

# Do more operations on y

z = y * y * 3
out = z.mean()

print(z)
print(out)

# # Assignments
#
# 1. Create a Tensor that `requires_grad` of size (5, 5)
# 2. Sum the values in the Tensor

# ## 2. Gradients
#
# Let’s backprop now. Because `out` contains a single scalar, `out.backward()` is equivalent to `out.backward(torch.tensor([1.0]))`

out.backward()

# Print gradients d(out)/dx

print(x.grad)

# You should have a matrix of `4.5`. Let’s denote the tensor `out` with $o$.
#
# We have:
# $o = \frac{1}{4}\sum_i z_i$, $z_i = 3(x_i+2)^2$ and $z_i\bigr\rvert_{x_i=1} = 27$.
#
# Therefore, $\frac{\partial o}{\partial x_i} = \frac{3}{2}(x_i+2)$,
# hence $\frac{\partial o}{\partial x_i}\bigr\rvert_{x_i=1} = \frac{9}{2} = 4.5$.
#
# You can do many crazy things with autograd!

x = torch.randn(3, requires_grad=True)

y = x * 2
while y.data.norm() < 1000:
    y = y * 2

print(y)

gradients = torch.FloatTensor([0.1, 1.0, 0.0001])
y.backward(gradients)

print(x.grad)

# **Read later** \
# *Documentation* \
# `Tensor`: https://pytorch.org/docs/stable/tensors.html \
# `Function`: http://pytorch.org/docs/autograd

# # Assignments
#
# 1. Define a tensor and set `requires_grad` to `True`
# 3. Multiply the tensor by 2 and assign the result to a new python variable (i.e. `x = result`)
# 4. Sum the variable's elements and assign to a new python variable
# 5. Print the gradients of all the variables
# 6. Now perform a backward pass on the last variable (NOTE: for each new python variable that you define, call `.retain_grad()`)
# 7. Print all gradients again
#   - what did you notice?
