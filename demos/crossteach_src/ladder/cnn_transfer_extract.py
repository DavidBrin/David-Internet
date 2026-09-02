# 4.3 CNN transfer.ipynb - code cells + exercise text extracted for the Source drawer.
# DTU 02456 Deep Learning (fall 2025) course notebook with David's solutions;
# outputs stripped (originals in demos/dtu_deep_learning_notebooks_raw/).

# # Transfer learning on the Caltech101 dataset
#
# In this notebook, we will consider a more complex dataset than MNIST or CIFAR10. The images in Caltech101 are RGB images (3 channels) with variable size. There are 101 different classes. We will try a very common practice in computer vision nowadays: transfer learning from a pre-trained ImageNet model.
#
# Roadmap:
# - Modify the network from the previous exercise (CIFAR-10) to work with 224x224 images.
# - Train the model for a while on Caltech101 and see how far we can get.
# - Take a ResNet34 that was pre-trained on ImageNet-1k and fine-tune it to Caltech101.
#   - Consider both training only the head (the linear classifier at the end of the network) or the entire network.
#   - We should be able to reach better performance than our original network in fewer training steps.
# - Optional: play around with other pre-trained models from `timm` (see info [here](https://github.com/rwightman/pytorch-image-models)).

# ## Preliminaries

%matplotlib inline
from typing import List, Optional, Callable, Iterator
import random
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import torch
from torch import nn
import torch.nn.functional as F
import torch.optim as optim
import torchvision
from torchvision import transforms
from sklearn.model_selection import train_test_split

from sklearn.metrics import accuracy_score
from torch.utils.data import DataLoader, Dataset, Subset

sns.set_style("whitegrid")

!pip install timm
import timm

def accuracy(target, pred):
    return accuracy_score(target.detach().cpu().numpy(), pred.detach().cpu().numpy())

def show_image(img, title=None):
    img = img.detach().cpu()
    img = img.permute((1, 2, 0)).numpy()
    mean = np.array([0.485, 0.456, 0.406])
    std = np.array([0.229, 0.224, 0.225])
    img = std * img + mean   # unnormalize
    img = np.clip(img, 0, 1)
    plt.imshow(img)
    plt.gca().tick_params(axis="both", which="both", bottom=False, left=False, labelbottom=False, labelleft=False)
    if title is not None:
        plt.title(title)

# ### Set up dataset

imagenet_mean = [0.485, 0.456, 0.406]
imagenet_std = [0.229, 0.224, 0.225]
default_imagenet_normalization = transforms.Normalize(mean=imagenet_mean, std=imagenet_std)
train_transform = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.25, 1)),  # crop of random size and aspect ratio, resize to square
    transforms.RandomHorizontalFlip(),
    transforms.ToTensor(),
    default_imagenet_normalization,
])
test_transform = transforms.Compose([
    transforms.Resize(224),  # keep aspect ratio
    transforms.CenterCrop(224),  # square crop
    transforms.ToTensor(),
    default_imagenet_normalization,
])

batch_size = 64  # both for training and testing

# Load dataset (downloaded automatically if missing).
dataset = torchvision.datasets.Caltech101(root='./data', download=True)


def translate_label(y, keep_classes):
    try:
        return keep_classes.index(y)
    except ValueError:
        return -1


# Filter images such that no class has more than 100 examples.
# Loop through dataset in random order, include each image (its index) only if there are 
# fewer than 100 images of the same class.
# Here we also remove the classes "Faces" and "Faces_easy".
skip_classes = [0, 1]   # "Faces" and "Faces_easy"
keep_classes = [c for c in range(len(dataset.categories)) if c not in skip_classes]
indices = list(range(len(dataset)))
random.shuffle(indices)
new_indices = []
current_class_size = {class_number: 0 for class_number in np.unique(dataset.y)}
for i in indices:
    class_number = dataset.y[i]
    if class_number not in skip_classes and current_class_size[class_number] < 100:
        new_indices.append(i)
        current_class_size[class_number] += 1
indices = new_indices

# Compute subset of labels given new indices selection
labels = [translate_label(dataset.y[i], keep_classes) for i in indices]
assert max(labels) == 98

test_size = 640
train_size = len(indices) - test_size
train_idx, test_idx = train_test_split(
    indices,
    train_size=train_size,
    test_size=test_size,
    shuffle=True,
    random_state=42,  # always get the same split
    stratify=labels,
)


class DatasetSubsetWithTransform(Subset):
    
    def __init__(self, dataset, indices, transform=None):
        super().__init__(dataset, indices)
        self.transform = transform

    def _transform_and_translate(self, x, y):
        # Convert PIL image to RGB (some of them are greyscale)
        x = x.convert('RGB')
        if self.transform is not None:
            x = self.transform(x)
        y = translate_label(y, keep_classes)
        return x, y

    def __getitem__(self, idx):
        return self._transform_and_translate(*super().__getitem__(idx))
    
    def __getitems__(self, indices):
        items = super().__getitems__(indices)
        for i in range(len(items)):
            items[i] = self._transform_and_translate(*items[i])
        return items


train_set = DatasetSubsetWithTransform(dataset, train_idx, train_transform)
test_set = DatasetSubsetWithTransform(dataset, test_idx, test_transform)
train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True, drop_last=True)
test_loader = DataLoader(test_set, batch_size=batch_size, shuffle=False, drop_last=False)

# ### A closer look at the dataset
#
# We first plot the size of each class and observe the class distribution is not uniform.
#
# Then we show random examples from the dataset, annotated with the class label and index.
# Note that the training images include standard augmentations typically used for vision models (defined above).

label_idxs, counts = np.unique(labels, return_counts=True)
plt.figure(figsize=(20, 4.2))
sns.barplot(x=[dataset.categories[keep_classes[label]] for label in label_idxs], y=counts, color=sns.color_palette('muted')[0])
plt.xticks(rotation=90)
plt.xlabel("Class")
plt.ylabel("Number of examples")
plt.title("Class distribution")
plt.tight_layout()
plt.show()


def show_dataset_examples(dataloader):
    images, labels = next(iter(dataloader))
    with sns.axes_style("white"):
      fig, axes = plt.subplots(4, 8, figsize=(16, 9.5))
    axes = [ax for axes_ in axes for ax in axes_]   # flatten
    for j, (img, label) in enumerate(zip(images[:32], labels[:32])):
        plt.sca(axes[j])
        show_image(img, title=f"{dataset.categories[keep_classes[label.item()]]} ({label.item()})")
    plt.show()


print("\n\nTrain images (including augmentations):")
show_dataset_examples(train_loader)
print("\n\nTest images:")
show_dataset_examples(test_loader)

# ## Define a neural network
#
# **Assignment 1:** Adapt the CNN from the previous lab (CIFAR-10) to handle 224x224 images. We recommend reducing significantly the size of the tensors before flattening, by adding either convolutional layers with stride>1 or [MaxPool2d](https://pytorch.org/docs/stable/generated/torch.nn.MaxPool2d.html) layers (but see e.g. also [AvgPool2d](https://pytorch.org/docs/stable/generated/torch.nn.AvgPool2d.html)).

class Model(nn.Module):

    def __init__(self, num_classes):
        super().__init__()
        
        self.net = nn.Sequential(
            # First conv block
            nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(kernel_size=3, stride=2, padding=1),
            
            # Second conv block
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.MaxPool2d(kernel_size=2, stride=2),
            
            # Third conv block
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(),
            nn.MaxPool2d(kernel_size=2, stride=2),
            
            # Fourth conv block
            nn.Conv2d(256, 512, kernel_size=3, padding=1),
            nn.BatchNorm2d(512),
            nn.ReLU(),
            nn.MaxPool2d(kernel_size=2, stride=2),
            
            # Adaptive pooling to handle variable input sizes
            nn.AdaptiveAvgPool2d((1, 1)),
            
            # Flatten and fully connected layers
            nn.Flatten(),
            nn.Linear(512, num_classes)
        )

    def forward(self, x):
        return self.net(x)
    
model = Model(num_classes=len(np.unique(labels)))
device = torch.device('cuda')  # use cuda or cpu
model = model.to(device)
print(model)

# ## Define loss function and optimizer
#
# **Assignment 2:** Implement the criterion and optimizer, as in the previous notebook.

loss_fn = None  # Your code here!
optimizer = None  # Your code here!

# ## Train the network

# Test the forward pass with dummy data
out = model(torch.randn(2, 3, 224, 224).to(device))
print("Output shape:", out.size())

num_epochs = 10
validation_every_steps = 50

step = 0
model.train()

train_accuracies = []
valid_accuracies = []
        
for epoch in range(num_epochs):
    
    train_accuracies_batches = []
    
    for inputs, targets in train_loader:
        inputs, targets = inputs.to(device), targets.to(device)
        
        # Forward pass.
        output = model(inputs)
        
        # Compute loss.
        loss = loss_fn(output, targets)
        
        # Clean up gradients from the model.
        optimizer.zero_grad()
        
        # Compute gradients based on the loss from the current batch (backpropagation).
        loss.backward()
        
        # Take one optimizer step using the gradients computed in the previous step.
        optimizer.step()
        
        step += 1
        
        # Compute accuracy.
        predictions = output.max(1)[1]
        train_accuracies_batches.append(accuracy(targets, predictions))
        
        if step % validation_every_steps == 0:
            
            # Append average training accuracy to list.
            train_accuracies.append(np.mean(train_accuracies_batches))
            
            train_accuracies_batches = []
        
            # Compute accuracies on validation set.
            valid_accuracies_batches = []
            with torch.no_grad():
                model.eval()
                for inputs, targets in test_loader:
                    inputs, targets = inputs.to(device), targets.to(device)
                    output = model(inputs)
                    loss = loss_fn(output, targets)

                    predictions = output.max(1)[1]

                    # Multiply by len(x) because the final batch of DataLoader may be smaller (drop_last=False).
                    valid_accuracies_batches.append(accuracy(targets, predictions) * len(inputs))

                model.train()
                
            # Append average validation accuracy to list.
            valid_accuracies.append(np.sum(valid_accuracies_batches) / len(test_set))
     
            print(f"Step {step:<5}   training accuracy: {train_accuracies[-1]}")
            print(f"             test accuracy: {valid_accuracies[-1]}")

print("Finished training.")

# ## Test the network on the test data

# Evaluate test set
with torch.no_grad():
    model.eval()
    test_accuracies = []
    for inputs, targets in test_loader:
        inputs, targets = inputs.to(device), targets.to(device)
        output = model(inputs)
        loss = loss_fn(output, targets)

        predictions = output.max(1)[1]

        # Multiply by len(x) because the final batch of DataLoader may be smaller (drop_last=True).
        test_accuracies.append(accuracy(targets, predictions) * len(inputs))

    test_accuracy = np.sum(test_accuracies) / len(test_set)
    print(f"Test accuracy: {test_accuracy:.3f}")
    
    model.train()

# ## Using a pre-trained model
#
# Here we will load a ResNet34 that was pre-trained on ImageNet. We then discard the linear classifier at the end of the network (the "head" of the network) and replace it with a new one that outputs the desired number of logits for classification. To get a rough idea of the structure of the model, we print it below.
#
# The argument `finetune_entire_model` in `initialize_model()` controls whether the entire pre-trained model is fine-tuned. When this is `False`, only the linear head is trained, and the rest of the model is fixed. The idea is that the features extracted by the ImageNet model, up to the final classification layer, are very informative also on other datasets (see, e.g., [this paper](https://arxiv.org/abs/1910.04867) on the transferability of deep representations in large vision models).
#
# We will start here by training only the linear head. You can experiment different models and variations.
#
# Below, we define the model and forget the one we just trained. After that, you can go back to the section "Define loss function and optimizer" and re-execute the notebook from there, to train and evaluate the new model.

def initialize_model(model_name: str, *, num_classes: int, finetune_entire_model: bool = False):
    """Returns a pretrained model with a new last layer, and a dict with additional info.

    The dict now contains the number of model parameters, computed as the number of
    trainable parameters as soon as the model is loaded.
    """

    print(
        f"Loading model '{model_name}', with "
        f"finetune_entire_model={finetune_entire_model}, changing the "
        f"last layer to output {num_classes} logits."
    )
    model = timm.create_model(
        model_name, pretrained=True, num_classes=num_classes
    )

    num_model_parameters = 0
    for p in model.parameters():
        if p.requires_grad:
            num_model_parameters += p.numel()

    if not finetune_entire_model:
        for name, param in model.named_parameters():
            param.requires_grad = False

        # Layer names are not consistent, so we have to consider a few cases. This might 
        # break for arbitrary models from timm (we have not checked all available models).
        layer = None
        if hasattr(model, "classifier"):
            if isinstance(model.classifier, nn.Linear):
                layer = model.classifier
        elif hasattr(model, "head"):
            if isinstance(model.head, nn.Linear):
                layer = model.head
            elif hasattr(model.head, "fc") and isinstance(model.head.fc, nn.Linear):
                layer = model.head.fc
            elif hasattr(model.head, "l") and isinstance(model.head.l, nn.Linear):
                layer = model.head.l
        elif hasattr(model, "fc"):
            if isinstance(model.fc, nn.Linear):
                layer = model.fc
        if layer is None:
            raise ValueError(f"Couldn't automatically find last layer of model.")
        
        # Make the last layer trainable.
        layer.weight.requires_grad_()
        layer.bias.requires_grad_()

    num_trainable_model_parameters = 0
    for p in model.parameters():
        if p.requires_grad:
            num_trainable_model_parameters += p.numel()

    return model, {
        "num_model_parameters": num_model_parameters,
        "num_trainable_model_parameters": num_trainable_model_parameters,
    }

model, data = initialize_model('resnet34d', num_classes=len(np.unique(labels)), finetune_entire_model=False)

print(model)
print("Number of model parameters:", data["num_model_parameters"])
print("Number of trainable parameters:", data["num_trainable_model_parameters"])

device = torch.device('cuda')  # use cuda or cpu
model = model.to(device)

# **Assignment 3:**
#
# 1. Train the linear classifier on top of the pre-trained network, and observe how quickly you can get pretty good results, compared to training a smaller network from scratch as above.
#
# 2. Go back and change argument to finetune entire network, maybe adjust learning rate, see if you can get better performance than before and if you run into any issues.
#
# 3. Optional: experiment with `timm`: try smaller or larger models, including state-of-the-art models, e.g. based on vision transformers (ViT) or MLP-Mixers.
#
# 4. Briefly describe what you did and any experiments you did along the way as well as what results you obtained.
# Did anything surprise you during the exercise?
#
# 5. Write down key lessons/insights you got during this exercise.
