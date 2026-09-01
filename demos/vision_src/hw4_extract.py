# cse152a_wi25_hw4.ipynb - code cells extracted for the Source drawer.
# CSE 152A (UCSD, winter 2025) course template + David's solutions;
# outputs and embedded figures stripped (the originals live in demos/computer_vision_cse152_raw/).

# # CSE 152A Winter 2025 – Assignment 4
#
# - Assignment Published On: **Monday, March 3, 2025**
#
# - Due On: **Thursday, March 13, 2025 11:59 PM (Pacific Time)**
#
# ## Instructions
#
# Please answer the questions below using Python in the attached Jupyter notebook and follow the guidelines below:
#
# - This assignment must be completed **individually**. For more details, please follow the Academic Integrity Policy and Collaboration Policy posted on lecture slides.
#
# - All the solutions must be written in this Jupyter notebook.
#
# - After finishing the assignment in the notebook, please export the notebook as a PDF and submit both the notebook and the PDF (i.e. the `.ipynb` and the `.pdf` files) on Gradescope. (Note: Please ensure that all images/plots are clear in the pdf).
#
# - You may use basic algebra packages (e.g. `NumPy`, `SciPy`, etc) but you are not allowed to use open source codes that directly solve the problems. Feel free to ask the instructor and the teaching assistants if you are unsure about the packages to use.
#
# - It is highly recommended that you begin working on this assignment early.
#
# - Make sure that you read hints for questions (wherever given).
#
# **Late Policy:** Assignments submitted late will receive a 25% grade reduction for each 12 hours late (that is, 50% per day).
#
# ## Submission Instructions
#
# - You must submit both the `.ipynb` file and a `.pdf` version of your notebook.
#
# - Some methods to generate PDF
#     -  File -> Save and Export Notebook As -> `.html` -> Print -> Save as PDF
#     -  Using [nbconvert](https://nbconvert.readthedocs.io/en/latest/)
#
#
# - We will be grading primarily from your notebook.
#     - It is your responsibility to make sure that your code and outputs are visible.
#
# ## Virtual Environment
#
# ### Initial Set-up
# You can utilize a virtual environment (`venv`) in order to manage dependencies: [venv link](https://docs.python.org/3/library/venv.html) along with the libraries specified in `requirements.txt`.
#
# To create the environment:
# ```
# python -m venv cse152a_hw4
# ```
#
# To activate the environment (Mac/Linux):
# ```
# source ./cse152a_hw4/bin/activate
# ```
#
# To activate the environment (Windows):
# ```
# .\cse152a_hw4\Scripts\activate
# ```
#
# Once the virtual environment is activated, you can install the libraries according to `requirements.txt` like so:
# ```
# pip install -r requirements.txt
# ```
#
# You should then add the environment to jupyter notebook like so:
# ```
# python -m ipykernel install --user --name=cse152a_hw4
# ```
#
# To deactivate the environment, simply:
# ```
# deactivate
# ```
#
# This assumes you have Python installed already.
#
# ### Using the venv
# Once you've installed all the requirements within the venv, you can deactivate and would no longer need to repeat the above steps. You can simply open a Jupyter instance.
#
# Opening a Jupyter instance:
# ```
# jupyter-lab
# ```
#
# Ensure that you select the correct kernel (named `cse152a_hw4` if you followed the steps above) by clicking Kernel -> Change Kernel.

# # 1. Backpropogation [10 Points]
#
# We will study the backpropagation behavior for a  [softplus neuron](https://en.wikipedia.org/wiki/Softplus), given by:
#
# $$
# f(z) = ln\ (1+e^z)
# $$
#
# Consider a two-dimensional input given by $x = (x_1, x_2)^T$. A weight vector $w = (w_1, w_2)^T$ and a bias $b$ act on it. Thus, the output of a neuron is given by $f(x_1, x_2) = ln(1+e^{w_1x_1+w_2x_2+b})$.
# \
# \
# (a.) Draw the computational graph for the neuron in terms of elementary operations (addition, subtraction, multiplication, division, exponentiation) as seen in class. **[2 points]**
#
# (b.) Consider inputs $x_1 = 0.5, x_2=1.2,$ weights $w_1 = 0.2, w_2 = 0.8$ and bias $b = -0.1$. In the same figure, show the values at each node of the graph during forward propagation. **[2 points]**
#
# (c.) Use backpropagation to determine the gradients $\frac{\partial f}{\partial w_1}, \frac{\partial f}{\partial w_2}, \frac{\partial f}{\partial b}$. Also illustrate in the same figure the intermediate gradients at each node of the computation graph. **[4 points]**
#
# (d.) Explain the process of backpropagation you used to compute partial derivatives. **[2 points]**

# # You can insert an image here.
# ![IMG_6031.jpeg](attachment:cb31e14f-0085-48f1-8b4b-8c9e27a013ce.jpeg)

# # 2. Training a small CNN for FashionMNIST image classification [15 Points]
#
# In this problem, you will train a small convolutional neural network for image classification, using PyTorch. We will use the FashionMNIST dataset for image classification (https://github.com/zalandoresearch/fashion-mnist)

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets
from torchvision.transforms import ToTensor
import matplotlib.pyplot as plt
from tqdm import tqdm
import pickle

# Load in the datasets

# Download the FashionMNIST Datasets (you will use these variables later on)
FashionMNIST_train = datasets.FashionMNIST(
    root="data",
    train=True,
    download=True,
    transform=ToTensor()
)

FashionMNIST_test = datasets.FashionMNIST(
    root="data",
    train=False,
    download=True,
    transform=ToTensor()
)

# Code adapted from PyTorch https://pytorch.org/tutorials/beginner/basics/data_tutorial.html
labels_map = {
    0: "T-Shirt",
    1: "Trouser",
    2: "Pullover",
    3: "Dress",
    4: "Coat",
    5: "Sandal",
    6: "Shirt",
    7: "Sneaker",
    8: "Bag",
    9: "Ankle Boot",
}

figure = plt.figure(figsize=(8, 8))
cols, rows = 3, 3
train_labels = FashionMNIST_train.targets
label = (train_labels == 0).nonzero()
for i in range(1, cols * rows + 1):
    # Select image of each label
    indices = (train_labels == i-1).nonzero()
    sample_idx = indices[0,0]
    img, label = FashionMNIST_train[sample_idx]
    figure.add_subplot(rows, cols, i)
    plt.title(labels_map[label])
    plt.axis("off")
    plt.imshow(img.squeeze(), cmap="gray")
plt.show()

print(f"Image Shape: {img.shape}")

# Check device
if torch.cuda.is_available():
    device = "cuda"
else:
    device = "cpu"

print(f"Using {device} device")

# **[ 3 points ] Define the network structure as follows**
#
# * Convolutional layer with 32 kernels, window size 5, padding size 2, stride 1
# * ReLU activation layer
# * Max pooling layer with window size 2, stride 2
# * Convolutional layer with 64 kernels, window size 5, padding size 2, stride 1
# * ReLU activation layer
# * Max pooling layer with window size 2, stride 2
# * Fully connected layer with 1024 output channels
# * ReLU activation layer
# * Dropout layer with drop rate 0.4
# * Fully connected layer with 10 output channels

class Net(nn.Module):
    def __init__(self,drop):
        super(Net, self).__init__()
        self.drop = drop
        # DEFINE THE NETWORK STRUCTURE

        # Example: self.conv1 = nn.Conv2d(1, 3, 5,stride=1,padding=2,bias=True)
        # You can look at the main PyTorch tutorial for reference
        # https://pytorch.org/tutorials/beginner/basics/buildmodel_tutorial.html

        # --------------- YOUR CODE HERE ---------------
        self.conv1 = nn.Conv2d(in_channels=1, out_channels=32, kernel_size=5, stride=1, padding=2) #first layer
        self.relu1 = nn.ReLU()
        self.pool1 = nn.MaxPool2d(kernel_size=2, stride=2) #first max pooling 
        self.conv2 = nn.Conv2d(in_channels=32, out_channels=64, kernel_size=5, stride=1, padding=2) # second conv layer
        self.relu2 = nn.ReLU()
        self.pool2 = nn.MaxPool2d(2, 2)
        self.fc1 = nn.Linear(64 * 7 * 7, 1024) #full conn layer
        self.relu3 = nn.ReLU()
        self.dropout = nn.Dropout(p=0.4) if self.drop else nn.Identity() #droput layer 
        self.fc2 = nn.Linear(1024, 10) #fully conn output

        

    def forward(self, x):

        # --------------- YOUR CODE HERE ---------------
        x = self.pool1(self.relu1(self.conv1(x))) 
        x = self.pool2(self.relu2(self.conv2(x)))
        x = torch.flatten(x, start_dim=1)
        x = self.relu3(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        return x

# Print net
net = Net(drop=True).to(device)
print(net)

# **[ 5 points ] Complete the train function below. Use the same parameters to perform training in each of the following setups:**
#
# * SGD for optimization, without dropout
# * SGD for optimization, with dropout
# * Adam for optimization, without dropout
# * Adam for optimization, with dropout.
#
# As evaluation for each case above, perform the following:
# * Plot the loss graph and the accuracy graph of each batch on training set, and plot them on the same plot
# * Print the accuracy on test set after training
#
# Test accuracies are expected to be relatively high (~85 %) for all networks.
#
# Training can take a few minutes.

# CODE BELOW IS AN EXAMPLE STARTER
# FEEL FREE TO EDIT ANYTHING

# 'to_train' is a parameter that determines what part of the net to train.
# It is not required for this question, but will be useful in the next one.
# You should also change the parameters: epochs, batch, and learning rate as necessary.
# You may need to tune these hyperparameters.
def train(train_dataset, net, to_train, opt, epochs=10, batch=200, learning_rate=1e-3):
    # Initialize loss
    criterion = nn.CrossEntropyLoss()
    losslist = []
    acclist=[]

    # Create dataloader
    MNIST_train_dataloader = DataLoader(train_dataset, batch_size=batch, shuffle=True)

    # Select optimizer
    if(opt=='adam'):
        optimizer = optim.Adam(to_train,lr=learning_rate)
    else:
        optimizer = optim.SGD(to_train,lr=learning_rate,momentum = 0.99)
    optimizer.zero_grad()

    # Set model to training mode
    net.train()
    for k in tqdm(range(epochs)):
        running_loss = 0.0
        correct = 0
        total = 0
        for it, (X,y) in enumerate(MNIST_train_dataloader):
            # Send to device
            X, y = X.to(device), y.to(device)

            # Train the model using the optimizer and the batch data.
            # Append the loss and accuracy from each iteration to the losslist and acclist arrays
            # --------------- YOUR CODE HERE ---------------
            
            optimizer.zero_grad()# Zero the parameter gradients
            # Forward pass
            outputs = net(X)
            loss = criterion(outputs, y)
            # Backward pass
            loss.backward()
            optimizer.step()
            # Compute loss and accuracy
            running_loss += loss.item()
            _, predicted = torch.max(outputs, 1)
            correct += (predicted == y).sum().item()
            total += y.size(0)
            
        losslist.append(running_loss / len(MNIST_train_dataloader))
        acclist.append(correct/ total)

    return losslist,acclist

# Used to test or evaluate your network. Already written for you.
def test(test_dataset, net):
    batch = 200
    test_dataloader = DataLoader(test_dataset, batch_size=batch)
    size = len(test_dataloader.dataset)

    # Set model to eval mode
    net.eval()

    test_loss, correct = 0, 0
    with torch.no_grad():
        for X, y in test_dataloader:
            # Send to device
            X, y = X.to(device), y.to(device)

            # Prediction
            pred = net(X)

            # Calculate number of correct predictions in the batch
            correct += (pred.argmax(1) == y).type(torch.float).sum().item()

    # Compute total accuracy
    acc = correct / size
    return acc

# SGD with no dropout
# Example code
net = Net(drop=False).to(device)
print(net)
loss1, acc1 = train(FashionMNIST_train, net, net.parameters(), 'sgd')
ax=range(len(loss1))
plt.plot(ax, loss1, ax, acc1)
plt.legend(['loss', 'accuracy'])
plt.show()
print('Accuracy:{}'.format(test(FashionMNIST_test, net)))

# SGD with dropout
# --------------- YOUR CODE HERE ---------------
net = Net(drop=True).to(device)
print(net)
loss1, acc1 = train(FashionMNIST_train, net, net.parameters(), 'sgd')
ax=range(len(loss1))
plt.plot(ax, loss1, ax, acc1)
plt.legend(['loss', 'accuracy'])
plt.show()
print('Accuracy:{}'.format(test(FashionMNIST_test, net)))

# Adam with no dropout
# --------------- YOUR CODE HERE ---------------
net = Net(drop=False).to(device)
print(net)
loss1, acc1 = train(FashionMNIST_train, net, net.parameters(), 'adam')
ax=range(len(loss1))
plt.plot(ax, loss1, ax, acc1)
plt.legend(['loss', 'accuracy'])
plt.show()
print('Accuracy:{}'.format(test(FashionMNIST_test, net)))

# Adam with dropout
# --------------- YOUR CODE HERE ---------------
net = Net(drop=True).to(device)
print(net)
loss1, acc1 = train(FashionMNIST_train, net, net.parameters(), 'adam')
ax=range(len(loss1))
plt.plot(ax, loss1, ax, acc1)
plt.legend(['loss', 'accuracy'])
plt.show()
print('Accuracy:{}'.format(test(FashionMNIST_test, net)))

# **[ 5 points ] Plot the following graphs and note your observations**
#
# * Training loss graphs of SGD−dropout and Adam−dropout on the same plot.
# * Training loss graphs for Adam-dropout for 3 different values of batch sizes of 10, 200 and 500, on the same plot.


# Train SGD with dropout
net_sgd = Net(drop=True).to(device)
loss_sgd, _ = train(FashionMNIST_train, net_sgd, net_sgd.parameters(), 'sgd')

# Train Adam with dropout
net_adam = Net(drop=True).to(device)
loss_adam, _ = train(FashionMNIST_train, net_adam, net_adam.parameters(), 'adam')

# Plot SGD-dropout vs Adam-dropout
plt.figure(figsize=(8, 5))
plt.plot(range(len(loss_sgd)), loss_sgd, label='SGD + Dropout', color='blue')
plt.plot(range(len(loss_adam)), loss_adam, label='Adam + Dropout', color='red')
plt.xlabel('Epochs')
plt.ylabel('Training Loss')
plt.legend()
plt.title('Training Loss: SGD vs Adam (Dropout)')
plt.show()

# Train Adam with dropout for different batch sizes
batch_sizes = [10, 200, 500]
loss_dict = {}

for batch in batch_sizes:
    net = Net(drop=True).to(device)
    loss, _ = train(FashionMNIST_train, net, net.parameters(), 'adam', batch=batch)
    loss_dict[batch] = loss

# Plot Adam-dropout for batch sizes 10, 200, and 500
plt.figure(figsize=(8, 5))
for batch in batch_sizes:
    plt.plot(range(len(loss_dict[batch])), loss_dict[batch], label=f'Batch size {batch}')
    
plt.xlabel('Epochs')
plt.ylabel('Training Loss')
plt.legend()
plt.title('Training Loss for Adam (Dropout) with Different Batch Sizes')
plt.show()

# **[ 2 points ] The learning rate is a key hyperparameter during training. For this question, do the following.**
#
# 1. [ 1 point ] Train three models for three different values of the learning rate hyperparameter. Plot the loss graphs for training with these values of the learning rate on the same plot. Make sure that you change the hyperparameter enough such that there is a clear difference in the graphs and comment on the differences. Use SGD optimizer and no dropout.
#
# 2. [ 1 point ] Repeat the above task, but this time, use dropout with SGD optimizer. Note down your observations.

# --------------- YOUR CODE HERE ---------------

# Define learning rates to test
learning_rates = [0.001, 0.01, 0.1]
epochs = 20  # Define the number of epochs

# Train models without dropout
loss_dict_no_dropout = {}

for lr in learning_rates:
    net = Net(drop=False).to(device)  # No dropout
    loss, _ = train(FashionMNIST_train, net, net.parameters(), 'sgd', learning_rate=lr, epochs=epochs)
    loss_dict_no_dropout[lr] = loss

# Plot loss graphs for different learning rates (SGD, No Dropout)
plt.figure(figsize=(8, 5))
for lr in learning_rates:
    plt.plot(range(len(loss_dict_no_dropout[lr])), loss_dict_no_dropout[lr], label=f'LR={lr}')

plt.xlabel('Epochs')
plt.ylabel('Training Loss')
plt.legend()
plt.title('Training Loss for Different Learning Rates (SGD, No Dropout)')
plt.show()


# Train models with dropout
loss_dict_with_dropout = {}

for lr in learning_rates:
    net = Net(drop=True).to(device)  # With dropout
    loss, _ = train(FashionMNIST_train, net, net.parameters(), 'sgd', learning_rate=lr, epochs=epochs)
    loss_dict_with_dropout[lr] = loss

# Plot loss graphs for different learning rates (SGD, With Dropout)
plt.figure(figsize=(8, 5))
for lr in learning_rates:
    plt.plot(range(len(loss_dict_with_dropout[lr])), loss_dict_with_dropout[lr], label=f'LR={lr}')

plt.xlabel('Epochs')
plt.ylabel('Training Loss')
plt.legend()
plt.title('Training Loss for Different Learning Rates (SGD, With Dropout)')
plt.show()

# # 3. Transfer learning [15 Points]
#
# You will now visualize the effects of transfer learning by performing experiments using the STL10 dataset (https://cs.stanford.edu/~acoates/stl10/) . Note that this is just to understand how transfer learning works, in practice it is generally used with very large datasets and complex networks.

#!mkdir STL10
%cd STL10
#!wget -nc https://cs.stanford.edu/~acoates/stl10/stl10_matlab.tar.g
!curl -O https://cs.stanford.edu/~acoates/stl10/stl10_matlab.tar.gz

!tar -xzf stl10_matlab.tar.gz stl10_matlab/train.mat
%cd ..

# Convert .mat files to np arrays
import scipy.io as sio
import numpy as np

def load_data(path):
    data = sio.loadmat(path)
    return np.array(data['X']), np.array(data['y'])

data, labels = load_data('STL10/stl10_matlab/train.mat')

data = data.reshape((-1, 96, 96, 3), order='F').transpose(0, 3, 1, 2)
labels  = labels.reshape(-1)

#  **[ 2 points ] Plot 3 random images corresponding to each label from the training data**

np.shape(data)

# --------------- YOUR CODE HERE ---------------
unique_labels = np.unique(labels)

# Set up the plot
fig, axes = plt.subplots(len(unique_labels), 3, figsize=(9, 3 * len(unique_labels)))

# Plot images
for i, label in enumerate(unique_labels):
    # Get indices of images with the current label
    indices = np.where(labels == label)[0]
    
    # Randomly select 3 indices
    selected_indices = np.random.choice(indices, 3, replace=False)
    
    for j, idx in enumerate(selected_indices):
        ax = axes[i, j]
        ax.imshow(data[idx].transpose(1, 2, 0))  # Display the image
        ax.axis("off")
        ax.set_title(f"Label: {label}")

plt.tight_layout()
plt.show()

# We will split the dataset into two parts, one with labels 0-4 and other with labels 5-9, we have provided this code for you. This should print the sizes of data and labels in each split.

# Split the data and labels into two sets corresponding to labels 0-4 and 5-9.
data1 = np.zeros((0, 3, 96, 96))
labels1 = []
data2 = np.zeros((0, 3, 96, 96))
labels2 = []

## SVHN has labels in the range 1-10 and not 0-9.
# Split data and labels for labels 0 to 4
for i in range(5):
    x = data[labels == i][:500]
    data1 = np.vstack((data1, x))
    labels1 += [i] * len(x)

# Split data and labels for labels 5 to 9
for i in range(5, 10):
    x = data[labels == i][:500]
    data2 = np.vstack((data2, x))
    labels2 += [i] * len(x)

## Neural networks always accept labels in the range 0 to n-1.
## change data from cardinal to ordinal.
labels1 = np.array(labels1)
labels2 = np.array(labels2) - 5

data1.shape, data2.shape, labels1.shape, labels2.shape

## should print ((2500, 3, 96, 96), (2500, 3, 96, 96), (2500,), (2500,))

# **[ 3 points ] Create a simple convolutional network to classify the training data. The network structure should be as follows:**
#
# 1. Layer 1 - Convolutional layer with kernel size 4, Stride 2, Output channels 5, Relu activation
# 2. Layer 2 - Convolutional layer with kernel size 4, Stride 1, Output channels 10, Relu avtication
# 3. Layer 3 - Convolutional layer with kernel size 4, Stride 1, Output channels 20, Relu activation
# 4. Layer 4 - Convolutional layer with kernel size 4, Stride 1, Output channels 40, Relu activation
# 5. Layer 5 - Fully connected layer with 5 outputs

class Net(nn.Module):
    def __init__(self, n_labels=5):
        super().__init__()
        # --------------- YOUR CODE HERE ---------------
        self.conv1 = nn.Conv2d(kernel_size=4, stride=2, out_channels=5, in_channels=3)
        self.conv2 = nn.Conv2d(kernel_size=4, stride=1, out_channels=10, in_channels=5)
        self.conv3 = nn.Conv2d(kernel_size=4, stride=1, out_channels=20, in_channels=10)
        self.conv4 = nn.Conv2d(kernel_size=4, stride=1, out_channels=40, in_channels=20)
        self.fc = nn.Linear(40 * 38 * 38, 5)  # Images are given by 3, 96, 96
        self.relu = nn.ReLU()

    def forward(self, x):
        # --------------- YOUR CODE HERE ---------------
        x = self.relu(self.conv1(x))
        x = self.relu(self.conv2(x))
        x = self.relu(self.conv3(x))
        x = self.relu(self.conv4(x))
        x = torch.flatten(x, start_dim=1)
        x = self.fc(x)
        return x 
        
net = Net()
print(net)

# **[ 5 points ] Complete the train function below and follow the instructions**
#
# * Initialize the network, train the complete network (net.parameters) on data1 (The first 5 classes)
# * Plot the loss and accuracy graphs over training on the same plot
# * Print the final training accuracy as well**
#
# Set the learning rate, number of iterations and batch size such that the loss is gradually and smoothly decreasing and converging. The accuracy at the end of training must be around or greater than 55 %.

def train(tdata, tlabel, net, to_train):
    criterion = nn.CrossEntropyLoss()
    losslist = []
    acclist = [] # Hint: use argmax to find the index with the largest value
    
    # YOU MAY NEED TO CHANGE THESE PARAMETERS TO IMPROVE ACCURACY
    epochs=50  
    batch=64  
    learning_rate=1e-4
    optimizer = optim.SGD(to_train, lr=learning_rate, momentum=0.8)  # Added momentum for better convergence
    optimizer.zero_grad()
    device = "cpu"
    
    for k in tqdm(range(epochs)):
        ## Shuffle the data
        indices = np.arange(len(tdata))
        np.random.shuffle(indices)
        tdata = tdata[indices]
        tlabel = tlabel[indices]
        
        running_loss = 0.0
        correct = 0
        total = 0
        
        for l in range(int(len(tdata)/batch)):
            
            inputs = torch.FloatTensor(tdata[l*batch:(l+1)*batch]).to(device)
            targets = torch.LongTensor(tlabel[l*batch:(l+1)*batch]).to(device)
            # ----------------- YOUR CODE HERE ----------------
            if targets.dim() > 1 and targets.size(1) > 1:
                
                _, targets = torch.max(targets, 1)
            # Zero the parameter gradients
            optimizer.zero_grad()
            # Forward pass
            outputs = net(inputs)
            loss = criterion(outputs, targets)
            
            # Backward pass and optimize
            loss.backward()
            optimizer.step()

            running_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total += targets.size(0)
            correct += (predicted == targets).sum().item()
        
        
        epoch_loss = running_loss / int(len(tdata)/batch)
        epoch_acc = 100 * correct / total
        
        
        losslist.append(epoch_loss)
        acclist.append(epoch_acc)
        
        # Print statistics every 5 epochs
        if (k+1) % 5 == 0:
            print(f'Epoch {k+1}/{epochs}, Loss: {epoch_loss:.4f}, Accuracy: {epoch_acc:.2f}%')
    

    return losslist, acclist

# --------------- YOUR CODE HERE ---------------

device = "cpu"
net = Net()
net.to(device)
loss_history, accuracy_history = train(data1, labels1, net, net.parameters())

# Check if final accuracy meets requirement (>55%)
final_accuracy = accuracy_history[-1]
if final_accuracy >= 55:
    print(f"Training successful! Final accuracy: {final_accuracy:.2f}% meets the requirement.")
else:
    print(f"Training needs improvement. Final accuracy: {final_accuracy:.2f}% is below the 55% requirement.")

plt.figure(figsize=(12, 5))

plt.subplot(1, 2, 1)
plt.plot(loss_history, 'r-')
plt.title('Training Loss')
plt.xlabel('Epochs')
plt.ylabel('Loss')

plt.subplot(1, 2, 2)
plt.plot(accuracy_history, 'b-')
plt.title('Training Accuracy')
plt.xlabel('Epochs')
plt.ylabel('Accuracy (%)')

plt.tight_layout()
plt.show()

# **[ 2 points ] Without reinitializing the network, train only the fully connected layer (net.fc.parameters) now on data2 (The next 5 classes)**
#
# Do not change any hyper parameters such as learning rate or batch size. Plot the loss and accuracy and print the final values like before.

# --------------- YOUR CODE HERE ---------------

loss_history, accuracy_history = train(data2, labels2, net, net.fc.parameters())
final_accuracy = accuracy_history[-1]
if final_accuracy >= 55:
    print(f"Training successful! Final accuracy: {final_accuracy:.2f}% meets the requirement.")
else:
    print(f"Training needs improvement. Final accuracy: {final_accuracy:.2f}% is below the 55% requirement.")

plt.figure(figsize=(12, 5))

plt.subplot(1, 2, 1)
plt.plot(loss_history, 'r-')
plt.title('Training Loss')
plt.xlabel('Epochs')
plt.ylabel('Loss')

plt.subplot(1, 2, 2)
plt.plot(accuracy_history, 'b-')
plt.title('Training Accuracy')
plt.xlabel('Epochs')
plt.ylabel('Accuracy (%)')

plt.tight_layout()
plt.show()

# **[ 3 points ] Now repeat the process in the opposite order**
#
# * Initialize the net again, train the whole network on data2, generate the same plots as before
# * Then without reinitializing the net, train only the fully connected layer on data1 and generate the plots
#
# Do not change any hyperparameters.

 #--------------- YOUR CODE HERE ---------------
device = "cpu"
net = Net()
net.to(device)

loss_history, accuracy_history = train(data2, labels2, net, net.parameters())
final_accuracy = accuracy_history[-1]
if final_accuracy >= 55:
    print(f"Training successful! Final accuracy: {final_accuracy:.2f}% meets the requirement.")
else:
    print(f"Training needs improvement. Final accuracy: {final_accuracy:.2f}% is below the 55% requirement.")

plt.figure(figsize=(12, 5))

plt.subplot(1, 2, 1)
plt.plot(loss_history, 'r-')
plt.title('Training Loss')
plt.xlabel('Epochs')
plt.ylabel('Loss')

plt.subplot(1, 2, 2)
plt.plot(accuracy_history, 'b-')
plt.title('Training Accuracy')
plt.xlabel('Epochs')
plt.ylabel('Accuracy (%)')

plt.tight_layout()
plt.show()

# **[ 5 points ]**
#
# * Plot the accuracy vs iterations for the classifers trained to classify data1, via normal learning as well as transfer learning, on the same plot
# * Plot another graph for the classifiers trained to classify data2
#
# Explain the results obtained, based on the training regimen. Comment on why transfer learning worked/didn't work.

# --------------- YOUR CODE HERE ---------------

loss_history, accuracy_history = train(data1, labels1, net, net.fc.parameters())
final_accuracy = accuracy_history[-1]
if final_accuracy >= 55:
    print(f"Training successful! Final accuracy: {final_accuracy:.2f}% meets the requirement.")
else:
    print(f"Training needs improvement. Final accuracy: {final_accuracy:.2f}% is below the 55% requirement.")

plt.figure(figsize=(12, 5))

plt.subplot(1, 2, 1)
plt.plot(loss_history, 'r-')
plt.title('Training Loss')
plt.xlabel('Epochs')
plt.ylabel('Loss')

plt.subplot(1, 2, 2)
plt.plot(accuracy_history, 'b-')
plt.title('Training Accuracy')
plt.xlabel('Epochs')
plt.ylabel('Accuracy (%)')

plt.tight_layout()
plt.show()

# Honestly I'm not sure how the accuracy got so high, but it feels wrong becuase I never see accuracy like this with predictive models. It did take a while to train and I tweaked the parameters a few times, but it seems transfer learning worked by using the optimization and training to tweak the parameters of the fc layer to be so good that training on just that layer would still produce accurate results.

# **Optional**: Create a network with more layers, pooling layers, and more filters and try to increase accuracy as much as possible. Play around with the hyperparameters to understand how they affect the training process. No need to turn in anything for this.
