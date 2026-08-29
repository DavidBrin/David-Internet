# Code scraped from lfp_analysis.ipynb (79 MB notebook; outputs dropped)

# %% [cell 1]
import matlab.engine 
import os
import scipy.io
import h5py
import math
import matplotlib.pyplot as plt
import numpy as np
import pickle
from progressbar import ProgressBar
import scipy as sp
from neurodsp.filt import filter_signal
from scipy.signal import butter, filtfilt
from scipy.signal import find_peaks

# Import spectral power functions
from neurodsp.spectral import compute_spectrum, rotate_powerlaw

# Import utilities for loading and plotting data
from neurodsp.utils import create_times
from neurodsp.utils.download import load_ndsp_data
from neurodsp.plts.spectral import plot_power_spectra
from neurodsp.plts.time_series import plot_time_series

# Import the FOOOF object
from fooof import FOOOF

# %% [cell 2]
fs = 12500
fs_ds = 100 # Maestro downsampled frequency

# %% [cell 3]
directory = '/Users/blancamartin/Desktop/LFP_org_psychedelics/Extracted_Data/'

# %% [cell 4]
# Loop through all files in the directory
dict_wells = {}
for filename in os.listdir(directory):
    # Check if the file is an HDF5 file
    if filename.endswith('.h5'):
        # Open the HDF5 file
        with h5py.File(os.path.join(directory, filename), 'r') as file:
            #extract well ID 
            # Extract well ID from the filename
            well_id = filename.split('_')[-1].split('.')[0]  # Extracts the part after 'well' and before '.h5'
        
            # List all datasets in the file
            dataset_names = list(file.keys())
            
            # Access datasets 
            for dataset_name in dataset_names:
                dataset = file[dataset_name]
              
                data = dataset[:]
                # Store data for the current well in the dictionary - this data is already downsampled to 100hz in the Maestro machine :/ 
                dict_wells[well_id] = data[0].reshape(4, 4, -1)

# #### Sanity check length of recording

# %% [cell 5]
test_leng = dict_wells['wellC5'][0][0]
print("Length of recording in minutes: ", str(len(test)/fs_ds/60))

# ### Plot all electrodes 

# %% [cell 6]
def plot_4x4_arrays(dictionary):
    for key, array_4x4 in dictionary.items():
        fig, axes = plt.subplots(4, 4, figsize=(12, 12))
        fig.suptitle(f'LFP traces for {key}', fontsize=20)
        for i in range(4):
            for j in range(4):
                ax = axes[i, j]
                ax.plot(array_4x4[i, j])
                ax.set_title(f'Array[{i}, {j}]')
                ax.set_xlabel('Index')
                ax.set_ylabel('Value')
        plt.tight_layout()
        plt.show()


plot_4x4_arrays(dict_wells)

# %% [cell 7]
def plot_4x4_psd(dictionary):
    for key, array_4x4 in dictionary.items():
        for i in range(4):
            for j in range(4):
                # Mean of spectrogram (Welch)
                freq_mean, psd_mean = compute_spectrum(array_4x4[i, j], fs_ds, method='welch', avg_type='mean', nperseg=fs*2)

                # Initialize a FOOOF object
                fm = FOOOF()
                
                # Set the frequency range to fit the model
                freq_range = [2, 40]
                
                # Report: fit the model, print the resulting parameters, and plot the reconstruction
                fm.report(freq_mean, psd_mean, freq_range)


plot_4x4_psd(dict_wells)

# ### Take average LFP for each well

# ### Plot PSDs and run specparam

# %% [cell 8]
# Mean of spectrogram (Welch)
freq_mean, psd_mean = compute_spectrum(test, fs_ds, method='welch', avg_type='mean', nperseg=fs*2)

# %% [cell 9]
# Plot the power spectra
plot_power_spectra([freq_mean[200:]],
                   [psd_mean[200:]],
                   ['Welch'])

# %% [cell 10]
# Initialize a FOOOF object
fm = FOOOF()

# Set the frequency range to fit the model
freq_range = [2, 40]

# Report: fit the model, print the resulting parameters, and plot the reconstruction
fm.report(freq_mean, psd_mean, freq_range)

# %% [cell 11]
5.0000e+01
