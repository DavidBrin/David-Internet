# MCNN1.ipynb: ensemble of five CNN1s on balanced subsets.
# From the open-source p300-speller project by Manuel Carzaniga and Lorenzo
# Gualniera (github.com/Manucar/p300-speller), the codebase archived and studied
# on Triton Neurotech's ML team. Code cells extracted for the Source drawer;
# outputs and embedded figures stripped (originals in demos/p300_speller_bci_raw/).

# # MCNN1 SETTINGS
#
# SUBJECT'S DATA SELECTION:
# - **A**: Signal samples: 7794, EEG channels: 64, Testset letters: 100
# - **B**: Signal samples: 7794, EEG channels: 64, Testset letters: 100

import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np     
import random           
from scipy.io import loadmat
from scipy import signal
from google.colab import drive
import warnings
import string
import os

from keras.layers import *
from keras.models import Model
from keras import backend as K
from keras import Sequential
from keras.callbacks import ModelCheckpoint
from keras.callbacks import EarlyStopping
from sklearn.metrics import confusion_matrix
from sklearn.preprocessing import scale
from sklearn.preprocessing import MinMaxScaler

# Install mne library for topoplot
!pip install mne
import mne

warnings.filterwarnings('ignore')
drive.mount('/content/drive')

####################### SETTINGS ########################
# Set this variable with the desidered subject's letter #
SUBJECT_SELECTED = "B"                                  #
#########################################################

subject_names = ["A", "B"]
ì
# Check for errors in the settings
if SUBJECT_SELECTED not in subject_names:
    raise ValueError("SUBJECT_SELECTED value {} is invalid.\nPlease enter one of the following parameters {}".format(SUBJECT_SELECTED, subject_names))

# Google drive data paths
MODEL_LOCATIONS_FILE_PATH = 'drive/My Drive/AY1920_DT_P300_SPELLER_03/Trained_models/MCNN1/' + SUBJECT_SELECTED
SUBJECT_TRAIN_FILE_PATH = 'drive/My Drive/AY1920_DT_P300_SPELLER_03/Dataset/Subject_' + SUBJECT_SELECTED + '_Train.mat'
SUBJECT_TEST_FILE_PATH = 'drive/My Drive/AY1920_DT_P300_SPELLER_03/Dataset/Subject_' + SUBJECT_SELECTED + '_Test.mat'
CHANNEL_LOCATIONS_FILE_PATH = 'drive/My Drive/AY1920_DT_P300_SPELLER_03/Dataset/channels.csv'
CHANNEL_COORD = 'drive/My Drive/AY1920_DT_P300_SPELLER_03/Dataset/coordinates.csv'

# Channel selection
CHANNELS = [i for i in range(64)]

# # Training set processing
#
# 1.   Application of bandpass filter **(0.1-20Hz)**;
# 2.   Down-sampling signals from 240Hz to 120Hz;
# 3.   Obtain windows of 650ms at the start of every flashing (175ms)
# 4.   Normalization of samples in each window: **Zi = (Xi - mu) / sigma**;
# 5.   Reshape each window to be a 3D tensor with dimensions: **(N_SAMPLES, 78, 64)**;

if not os.path.exists(SUBJECT_TRAIN_FILE_PATH):
    print("Missing file: {}".format(SUBJECT_TRAIN_FILE_PATH))
else:
    # Load the required data
    data = loadmat(SUBJECT_TRAIN_FILE_PATH)
    # Get the variables of interest from the loaded dictionary
    signals = data['Signal']
    flashing = data['Flashing']
    stimulus = data['StimulusType']
    word = data['TargetChar']
    
    SAMPLING_FREQUENCY = 240
    # From the dataset description we know that there are 15 repetitions
    REPETITIONS = 15
    # Compute the duration of the recording in minutes
    RECORDING_DURATION = (len(signals))*(len(signals[0]))/(SAMPLING_FREQUENCY*60)
    # Compute number of trials
    TRIALS = len(word[0])

    print("**********************************")
    print("       TRAIN SET INFORMATION      ")
    print("**********************************")
    print("Sampling Frequency: %d Hz [%.2f ms]" % (SAMPLING_FREQUENCY, (1000/SAMPLING_FREQUENCY)))
    print("Session duration:   %.2f min" % RECORDING_DURATION)
    print("Number of letters:  %d" % TRIALS)
    print("Spelled word:       %s" % ''.join(word))

# Application of butterworth filter
b, a = signal.butter(4, [0.1/SAMPLING_FREQUENCY, 20/SAMPLING_FREQUENCY], 'bandpass')
for trial in range(TRIALS):
    signals[trial, :, :] = signal.filtfilt(b, a, signals[trial, :, :], axis=0)

# Down-sampling of the signals from 240Hz to 120Hz
DOWNSAMPLING_FREQUENCY = 120
SCALE_FACTOR = round(SAMPLING_FREQUENCY / DOWNSAMPLING_FREQUENCY)
SAMPLING_FREQUENCY = DOWNSAMPLING_FREQUENCY

print("# Samples of EEG signals before downsampling: {}".format(len(signals[0])))

signals = signals[:, 0:-1:SCALE_FACTOR, :]
flashing = flashing[:, 0:-1:SCALE_FACTOR]
stimulus = stimulus[:, 0:-1:SCALE_FACTOR]

print("# Samples of EEG signals after downsampling: {}".format(len(signals[0])))

# Number of EEG channels
N_CHANNELS = 64
# Window duration after each flashing [ms]
WINDOW_DURATION = 650
# Number of samples of each window
WINDOW_SAMPLES = round(SAMPLING_FREQUENCY * (WINDOW_DURATION / 1000))
# Number of samples for each character in trials
SAMPLES_PER_TRIAL = len(signals[0])

train_features = []
train_labels = []

for trial in range(TRIALS):
    for sample in (range(SAMPLES_PER_TRIAL)):
        if (sample == 0) or (flashing[trial, sample-1] == 0 and flashing[trial, sample] == 1):
            lower_sample = sample
            upper_sample = sample + WINDOW_SAMPLES
            window = signals[trial, lower_sample:upper_sample, :]                
            # Features extraction
            train_features.append(window)
            # Labels extraction
            if stimulus[trial, sample] == 1:
                train_labels.append(1) # Class P300
            else:
                train_labels.append(0) # Class no-P300

# Convert list to numpy arrays
train_features = np.array(train_features)
train_labels = np.array(train_labels)

# Tensor dimensions (SAMPLES, 78, 64)
dim_train = train_features.shape
print("Features tensor shape: {}".format(dim_train))

# Data normalization Zi = (Xi - mu) / sigma
for pattern in range(len(train_features)):
    train_features[pattern] = scale(train_features[pattern], axis=0)

# Divide data into positive and negative samples
tableData = np.array([(train_features[i], train_labels[i]) for i in range(len(train_features))])
np.random.shuffle(tableData)

positiveTable = []
negativeTable = []

for sample in tableData:
    if sample[1] == 1:
        positiveTable.append(sample)
    else:
        negativeTable.append(sample)

positiveTable = np.array(positiveTable)
negativeTable = np.array(negativeTable)

# Split negative set in 5 subsets
np.random.shuffle(negativeTable)
win_size = round(len(negativeTable)/5)
start_index = 0

for i in range(5):
    if i==0:
        train_features1 = negativeTable[start_index : start_index + win_size, 0]
        train_labels1 = negativeTable[start_index : start_index + win_size, 1]    
    elif i==1:
        train_features2 = negativeTable[start_index : start_index + win_size, 0]
        train_labels2 = negativeTable[start_index : start_index + win_size, 1]
    elif i==2:
        train_features3 = negativeTable[start_index : start_index + win_size, 0]
        train_labels3 = negativeTable[start_index : start_index + win_size, 1]    
    elif i==3:
        train_features4 = negativeTable[start_index : start_index + win_size, 0]
        train_labels4 = negativeTable[start_index : start_index + win_size, 1]    
    elif i==4:
        train_features5 = negativeTable[start_index : , 0]
        train_labels5 = negativeTable[start_index : , 1]    
    start_index += win_size

# Reshape samples to be a 3D tensor (n_samples, 78, 64)
train_features1 = np.stack(train_features1, axis=0)
train_features2 = np.stack(train_features2, axis=0)
train_features3 = np.stack(train_features3, axis=0)
train_features4 = np.stack(train_features4, axis=0)
train_features5 = np.stack(train_features5, axis=0)

# Obtain positive samples to concatenate
pos_features = []
pos_labels = []
for sample in positiveTable:
    pos_features.append(sample[0])
    pos_labels.append(sample[1])
pos_features = np.array(pos_features)

# Concatenate positive samples and negative samples
train_features1 = np.concatenate((pos_features, train_features1), axis=0)
train_features2 = np.concatenate((pos_features, train_features2), axis=0)
train_features3 = np.concatenate((pos_features, train_features3), axis=0)
train_features4 = np.concatenate((pos_features, train_features4), axis=0)
train_features5 = np.concatenate((pos_features, train_features5), axis=0)

train_labels1 = np.concatenate((pos_labels, train_labels1), axis=0)
train_labels2 = np.concatenate((pos_labels, train_labels2), axis=0)
train_labels3 = np.concatenate((pos_labels, train_labels3), axis=0)
train_labels4 = np.concatenate((pos_labels, train_labels4), axis=0)
train_labels5 = np.concatenate((pos_labels, train_labels5), axis=0)

# # Testing set processing
#
# 1.   Application of bandpass filter **(0.1-20Hz)**;
# 2.   Down-sampling signas from 240Hz to 120Hz;
# 3.   Obtain windows of 650ms at the start of every flashing (175ms)
# 4.   Normalization of samples in each window: **Zi = (Xi - mu) / sigma**;
# 5.   Reshape each window to be a 3D tensor with dimensions: **(N_SAMPLES, 78, 64)**;
# 6.   Calculate weights vector to balance samples importance and obtain correct accuracy estimation;

# Test data loading
if not os.path.exists(SUBJECT_TEST_FILE_PATH):
    print("Missing file: {}", SUBJECT_TEST_FILE_PATH)
else:
    # Load the required data
    data_test = loadmat(SUBJECT_TEST_FILE_PATH)
    # Get the variables of interest from the loaded dictionary
    signals_test = data_test['Signal']
    flashing_test = data_test['Flashing']
    word_test =  data_test['TargetChar']
    stimulus_code_test = data_test['StimulusCode']

    SAMPLING_FREQUENCY = 240
    # From the dataset description we know that there are 15 repetitions
    REPETITIONS = 15
    # Compute the duration of the recording in minutes
    RECORDING_DURATION_TEST = (len(signals_test))*(len(signals_test[0]))/(SAMPLING_FREQUENCY*60)
    # Compute number of trials
    TRIALS_TEST = len(word_test[0])
    # Number of samples for each character in trials
    SAMPLES_PER_TRIAL_TEST = len(signals_test[0])
    
    print("**********************************")
    print("        TEST SET INFORMATION      ")
    print("**********************************")
    print("Sampling Frequency: %d Hz [%.2f ms]" % (SAMPLING_FREQUENCY, (1000/SAMPLING_FREQUENCY)))
    print("Session duration:   %.2f min" % RECORDING_DURATION_TEST)
    print("Number of letters:  %d" % TRIALS_TEST)
    print("Spelled word:       %s" % ''.join(word_test))

# Create characters matrix
char_matrix = [[0 for j in range(6)] for i in range(6)]
s = string.ascii_uppercase + '1' + '2' + '3' + '4' + '5' + '6' + '7' + '8' + '9' + '_'

# Append cols and rows in a list
list_matrix = []
for i in range(6):
    col = [s[j] for j in range(i, 36, 6)]
    list_matrix.append(col)
for i in range(6):
    row = [s[j] for j in range(i * 6, i * 6 + 6)]
    list_matrix.append(row)

# Create StimulusType array for the test set (missing from the given database)
stimulus_test = [[0 for j in range(SAMPLES_PER_TRIAL_TEST)] for i in range(TRIALS_TEST)]
stimulus_test = np.array(stimulus_test)

for trial in range(TRIALS_TEST):
    counter=0
    for sample in range(SAMPLES_PER_TRIAL_TEST):
        index = int(stimulus_code_test[trial, sample]) - 1
        if not index == -1:
            if word_test[0][trial] in list_matrix[index]:
                stimulus_test[trial, sample] = 1
            else:
                stimulus_test[trial, sample] = 0

# Application of butterworth filter
b, a = signal.butter(4, [0.1/SAMPLING_FREQUENCY, 20/SAMPLING_FREQUENCY], 'bandpass')
for trial in range(TRIALS):
    signals_test[trial, :, :] = signal.filtfilt(b, a, signals_test[trial, :, :], axis=0)

# Down-sampling of the signals from 240Hz to 120Hz
DOWNSAMPLING_FREQUENCY = 120
SCALE_FACTOR = round(SAMPLING_FREQUENCY / DOWNSAMPLING_FREQUENCY)
SAMPLING_FREQUENCY = DOWNSAMPLING_FREQUENCY

print("# Samples of EEG signals before downsampling: {}".format(len(signals_test[0])))

signals_test = signals_test[:, 0:-1:SCALE_FACTOR, :]
flashing_test = flashing_test[:, 0:-1:SCALE_FACTOR]
stimulus_test = stimulus_test[:, 0:-1:SCALE_FACTOR]

print("# Samples of EEG signals after downsampling: {}".format(len(signals_test[0])))

# Number of EEG channels
N_CHANNELS = 64
# Window duration after each flashing [ms]
WINDOW_DURATION = 650
# Number of samples of each window
WINDOW_SAMPLES = round(SAMPLING_FREQUENCY * (WINDOW_DURATION / 1000))
# Number of samples for each character in trials
SAMPLES_PER_TRIAL_TEST = len(signals[0])

test_features = []
test_labels = []

count_positive = 0
count_negative = 0

for trial in range(TRIALS_TEST):
    for sample in (range(SAMPLES_PER_TRIAL_TEST)):
        if (sample == 0) or (flashing_test[trial, sample-1] == 0 and flashing_test[trial, sample] == 1):
            lower_sample = sample
            upper_sample = sample + WINDOW_SAMPLES
            window = signals_test[trial, lower_sample:upper_sample, :]
            # Features extraction
            test_features.append(window)
            # Labels extraction
            if stimulus_test[trial, sample] == 1:
                count_positive += 1
                test_labels.append(1) # Class P300
            else:
                count_negative += 1
                test_labels.append(0) # Class no-P300

# Get test weights to take into account the number of classes 
test_weights = []
for i in range(len(test_labels)):
    if test_labels[i] == 1:
        test_weights.append(len(test_labels)/count_positive)
    else:
        test_weights.append(len(test_labels)/count_negative)
test_weights = np.array(test_weights)

# Convert lists to numpy arrays
test_features = np.array(test_features)
test_labels = np.array(test_labels)

# 3D tensor (SAMPLES, 78, 64)
dim_test = test_features.shape
print("Features tensor shape: {}".format(dim_test))

# Data normalization Zi = (Xi - mu) / sigma
for pattern in range(len(test_features)):
    test_features[pattern] = scale(test_features[pattern], axis=0)

# # MCNN1 model definition, training and testing
#
# 1.   Function definiton for randomization of weights and biases;
# 2.   **Scaled_tanh(x)** activation function definition;
# 3.   ANN model definition (2 Conv1D layers, 2 dense layers);
# 4.   Training of 5 identical nets over 5 different datasets obtained as such:
#
#
#
# >*   Split negative dataset (containing only no-P300) into 5 subsets randomly;
# >*   Compose 5 datasets with all the positive samples plus one of the negative subsets;
# >*   Train each CNN1 over one of the balanced subset;
# >*   Predictions are obtained by calculating the mean of the outputs of the nets;
#
#
#
# 5.   Mean of all networks' outputs for prediction assignment;
# 6.   MCNN1 performance assessment;

# Randomizing function for bias and weights of the network
def cecotti_normal(shape, dtype = None, partition_info = None):
    if len(shape) == 1:
        fan_in = shape[0]
    elif len(shape) == 2:
        fan_in = shape[0]
    else:
        receptive_field_size = 1
        for dim in shape[:-2]:
            receptive_field_size *= dim
        fan_in = shape[-2] * receptive_field_size
    return K.random_normal(shape, mean = 0.0, stddev = (1.0 / fan_in))

# Custom tanh activation function
def scaled_tanh(x):
    return 1.7159 * K.tanh((2.0 / 3.0) * x)

# Build the model
def CNN1_model(channels=64, filters=10):
    model = Sequential([
        Conv1D(
            filters = filters,
            kernel_size = 1,
            padding = "same",
            bias_initializer = cecotti_normal,
            kernel_initializer = cecotti_normal,
            use_bias = True,
            activation = scaled_tanh,
            input_shape = (78, channels)
        ),
        Conv1D(
            filters = 50,
            kernel_size = 13,
            padding = "valid",
            strides = 11,
            bias_initializer = cecotti_normal,
            kernel_initializer = cecotti_normal,
            use_bias = True,
            activation = scaled_tanh,
        ),
        Flatten(),
        Dense(100, activation="sigmoid"),
        Dense(1, activation="sigmoid")
    ])
    model.compile(optimizer = 'adam', loss = 'mean_squared_error', metrics = ['accuracy'])
    return model

# Training parameters
BATCH_SIZE = 256
EPOCHS = 200
VALID_SPLIT = 0.05
SHUFFLE = 1 # set to 1 to shuffle subsets during training

# Model summary
CNN1_model(channels=64, filters=10).summary()

# First CNN1 model definition
model1 = CNN1_model(channels=64, filters=10)

# Callback to save best model only
checkpoint = ModelCheckpoint(filepath=MODEL_LOCATIONS_FILE_PATH + "/" + "model1" + ".h5", 
                             monitor='val_loss', 
                             mode='min',
                             save_best_only=True)

# Callback to stop when loss on validation set doesn't decrease in 50 epochs
earlystop = EarlyStopping(monitor = 'val_loss', 
                          mode = 'min', 
                          patience = 50, 
                          restore_best_weights = True)

# Callback to keep track of model statistics
history1 = model1.fit(x=train_features1, 
                     y=train_labels1, 
                     batch_size=BATCH_SIZE, 
                     epochs=EPOCHS, 
                     validation_split=VALID_SPLIT, 
                     callbacks=[checkpoint, earlystop],
                     shuffle=SHUFFLE,
                     verbose=0)

# Second CNN1 model definition
model2 = CNN1_model(channels=64, filters=10)

# Callback to save best model only
checkpoint = ModelCheckpoint(filepath=MODEL_LOCATIONS_FILE_PATH + "/" + "model2" + ".h5", 
                             monitor='val_loss', 
                             mode='min',
                             save_best_only=True)

# Callback to stop when loss on validation set doesn't decrease in 50 epochs
earlystop = EarlyStopping(monitor = 'val_loss', 
                          mode = 'min', 
                          patience = 50, 
                          restore_best_weights = True)

# Callback to keep track of model statistics
history2 = model2.fit(x=train_features2, 
                     y=train_labels2, 
                     batch_size=BATCH_SIZE, 
                     epochs=EPOCHS, 
                     validation_split=VALID_SPLIT, 
                     callbacks=[checkpoint, earlystop],
                     shuffle=SHUFFLE,
                     verbose=0)

# Third CNN1 model definition
model3 = CNN1_model(channels=64, filters=10)

# Callback to save best model only
checkpoint = ModelCheckpoint(filepath=MODEL_LOCATIONS_FILE_PATH + "/" + "model3" + ".h5", 
                             monitor='val_loss', 
                             mode='min',
                             save_best_only=True)

# Callback to stop when loss on validation set doesn't decrease in 50 epochs
earlystop = EarlyStopping(monitor = 'val_loss', 
                          mode = 'min', 
                          patience = 50, 
                          restore_best_weights = True)

# Callback to keep track of model statistics
history3 = model3.fit(x=train_features3, 
                     y=train_labels3, 
                     batch_size=BATCH_SIZE, 
                     epochs=EPOCHS, 
                     validation_split=VALID_SPLIT, 
                     callbacks=[checkpoint, earlystop],
                     shuffle=SHUFFLE,
                     verbose=0)

# Fourth CNN1 model definition
model4 = CNN1_model(channels=64, filters=10)

# Callback to save best model only
checkpoint = ModelCheckpoint(filepath=MODEL_LOCATIONS_FILE_PATH + "/" + "model4" + ".h5", 
                             monitor='val_loss', 
                             mode='min',
                             save_best_only=True)

# Callback to stop when loss on validation set doesn't decrease in 50 epochs
earlystop = EarlyStopping(monitor = 'val_loss', 
                          mode = 'min', 
                          patience = 50, 
                          restore_best_weights = True)

# Callback to keep track of model statistics
history4 = model4.fit(x=train_features4, 
                     y=train_labels4, 
                     batch_size=BATCH_SIZE, 
                     epochs=EPOCHS, 
                     validation_split=VALID_SPLIT, 
                     callbacks=[checkpoint, earlystop],
                     shuffle=SHUFFLE,
                     verbose=0)

# Fifth CNN1 model definition
model5 = CNN1_model(channels=64, filters=10)

# Callback to save best model only
checkpoint = ModelCheckpoint(filepath=MODEL_LOCATIONS_FILE_PATH + "/" + "model5" + ".h5", 
                             monitor='val_loss', 
                             mode='min',
                             save_best_only=True)

# Callback to stop when loss on validation set doesn't decrease in 50 epochs
earlystop = EarlyStopping(monitor = 'val_loss', 
                          mode = 'min', 
                          patience = 50, 
                          restore_best_weights = True)

# Callback to keep track of model statistics
history5 = model5.fit(x=train_features5, 
                     y=train_labels5, 
                     batch_size=BATCH_SIZE, 
                     epochs=EPOCHS, 
                     validation_split=VALID_SPLIT, 
                     callbacks=[checkpoint, earlystop],
                     shuffle=SHUFFLE,
                     verbose=0)

# Prepare figure
plt.figure(figsize=(20,8))
plt.subplots_adjust(hspace=0.3)
plt.style.use('tableau-colorblind10')

plt.subplot(2,3,1)
plt.plot(history1.history['acc'], label='training loss')
plt.plot(history1.history['val_acc'], label='validation loss')
# Set up labels and titles
plt.title('Model 1')
plt.xlabel('# Epochs')
plt.ylabel('Accuracy')

plt.subplot(2,3,2)
plt.plot(history2.history['acc'], label='training loss')
plt.plot(history2.history['val_acc'], label='validation loss')
# Set up labels and titles
plt.title('Model 2')
plt.xlabel('# Epochs')
plt.ylabel('Accuracy')

plt.subplot(2,3,3)
plt.plot(history3.history['acc'], label='training loss')
plt.plot(history3.history['val_acc'], label='validation loss')
# Set up labels and titles
plt.title('Model 3')
plt.xlabel('# Epochs')
plt.ylabel('Accuracy')

plt.subplot(2,3,4)
plt.plot(history4.history['acc'], label='training loss')
plt.plot(history4.history['val_acc'], label='validation loss')
# Set up labels and titles
plt.title('Model 4')
plt.xlabel('# Epochs')
plt.ylabel('Accuracy')

plt.subplot(2,3,5)
plt.plot(history5.history['acc'], label='training loss')
plt.plot(history5.history['val_acc'], label='validation loss')
# Set up labels and titles
plt.title('Model 5')
plt.xlabel('# Epochs')
plt.ylabel('Accuracy')

plt.show()

# Multiclassifier prediction function
def majorityPrediction(models, inputs):
    pred = []
    # Get models predictions
    for model in models:
        pred.append(model.predict(inputs))
    pred = np.array(pred)
    return pred.mean(axis=0)

# Load model 1
model1 = CNN1_model(channels=64, filters=10)
model1.load_weights(MODEL_LOCATIONS_FILE_PATH + "/model1.h5")
model1.compile(optimizer = 'adam', loss = 'mean_squared_error', metrics = ['accuracy'])

# Load model 2
model2 = CNN1_model(channels=64, filters=10)
model2.load_weights(MODEL_LOCATIONS_FILE_PATH + "/model2.h5")
model2.compile(optimizer = 'adam', loss = 'mean_squared_error', metrics = ['accuracy'])

# Load model 3
model3 = CNN1_model(channels=64, filters=10)
model3.load_weights(MODEL_LOCATIONS_FILE_PATH + "/model3.h5")
model3.compile(optimizer = 'adam', loss = 'mean_squared_error', metrics = ['accuracy'])

# Load model 4
model4 = CNN1_model(channels=64, filters=10)
model4.load_weights(MODEL_LOCATIONS_FILE_PATH + "/model4.h5")
model4.compile(optimizer = 'adam', loss = 'mean_squared_error', metrics = ['accuracy'])

# Load model 5
model5 = CNN1_model(channels=64, filters=10)
model5.load_weights(MODEL_LOCATIONS_FILE_PATH + "/model5.h5")
model5.compile(optimizer = 'adam', loss = 'mean_squared_error', metrics = ['accuracy'])
    
# Create dictionary to store models
model_dict = {1:model1, 2:model2, 3:model3, 4:model4, 5:model5}

# Load topoplot coordinates
if not os.path.exists(CHANNEL_COORD):
    print("Missing file: {}".format(CHANNEL_COORD))
else:
    xycoord = []
    # Read file content
    with open(CHANNEL_COORD, "r") as f:
        file_content = f.read()
        # Loop over all rows
        for row in file_content.split("\n"): 
        # Skip missing rows
            if row == '':
                continue
            xycoord.append(row)

# Create a list with x,y coordinates of each electrodes well formatted
coord = []
for x in xycoord:
    coord.append(x.split(','))
coord = np.array(coord)

# Flip y axis in order to plot in the right way the electrodes positions
for i in range(len(coord)):
    coord[i][1] = 681 -int(coord[i][1])

# Create a list of weights for all filters
nf = []
for net in range(5):
    for filt in range(10):
        nf.append(abs(np.array(model_dict[net+1].get_weights()[0])[0, :, filt]))
nf = np.array(nf, dtype=float)

# Plot topoplot of the filters in the first convolutional layer
fig = plt.figure(figsize=(22,8))
for tot in range(50):
    ax = fig.add_subplot(5, 10, tot+1)
    ax.set_title("Net {} #{}".format((tot//10)+1, (tot)%10+1))
    mne.viz.plot_topomap(nf[tot], coord, cmap='Spectral_r', axes=ax, show=False)

# MCNN1 accuracy
predictions = majorityPrediction(models=[model1, model2, model3, model4, model5], inputs=test_features).round()
score = 0
for i in range(len(predictions)):
    if predictions[i] == test_labels[i]:
        score += 1

# Single model evaluation
print("CNN1_1 test set accuracy: {}%".format(round(model1.evaluate(test_features, test_labels, verbose=0, sample_weight=test_weights)[1] * 100, 4)))
print("CNN1_2 test set accuracy: {}%".format(round(model2.evaluate(test_features, test_labels, verbose=0, sample_weight=test_weights)[1] * 100, 4)))
print("CNN1_3 test set accuracy: {}%".format(round(model3.evaluate(test_features, test_labels, verbose=0, sample_weight=test_weights)[1] * 100, 4)))
print("CNN1_4 test set accuracy: {}%".format(round(model4.evaluate(test_features, test_labels, verbose=0, sample_weight=test_weights)[1] * 100, 4)))
print("CNN1_5 test set accuracy: {}%".format(round(model5.evaluate(test_features, test_labels, verbose=0, sample_weight=test_weights)[1] * 100, 4)))

# Multiclassifier evaluation
print("-----------------------------------")
print("MCNN1  test set accuracy: {}%".format(round(score/len(predictions) * 100, 4)))

# Weighted confusion matrix (noP300: 80%, P300: 20%)
data = confusion_matrix(y_true=test_labels, y_pred=predictions, sample_weight=test_weights)

# Normalized confusion matrix (values in range 0-1)
data_norm = data/np.full(data.shape, len(test_labels))

# Plot the confusion matrix
df_cm = pd.DataFrame(data_norm, columns=np.unique(test_labels), index = np.unique(test_labels))
df_cm.index.name = 'Actual'
df_cm.columns.name = 'Predicted'
plt.figure(figsize = (6,5))
sns.set(font_scale = 1.4)
cm = sns.heatmap(df_cm, cmap="Blues", annot=True, annot_kws = {"size": 16}, vmin=0, vmax=1)
cm.axes.set_title("MCNN1 confusion matrix\n", fontsize=20)
plt.show()

# Model metrics (sens, spec, ppv, npv)
def model_metrics(conf_matrix):
    tn, fp, fn, tp = list(data_norm.flatten())
    sens = round(tp/(tp+fn),4) # Sensitivity
    spec = round(tn/(tn+fp),4) # Specificity
    ppv = round(tp/(tp+fp),4) # Positive Predicted Value
    npv = round(tn/(tn+fn),4) # Negative Predicted Value
    return {"Sensitivity":sens, "Specificity":spec, "PPV":ppv, "NPV":npv}

# Put model metrics into a table
metrics = model_metrics(data_norm)

# Create figure
fig = plt.figure(figsize=(5,1))
ax = fig.add_subplot(111)

# Hide graph outlines
for item in [fig, ax]:
    item.patch.set_visible(False)
ax.xaxis.set_visible(False)
ax.yaxis.set_visible(False)
ax.spines["top"].set_visible(False)
ax.spines["bottom"].set_visible(False)
ax.spines["left"].set_visible(False)
ax.spines["right"].set_visible(False)

# Table definition
table = ax.table(cellText=[list(metrics.values())], 
                     colLabels=list(metrics.keys()),
                     loc="center",
                     cellLoc="center",
                     colColours=["c"]*4)
table.set_fontsize(16)
table.scale(2,2)

plt.show()
