# Code scraped from LFP_psych_through_FOOOF.ipynb (60 MB notebook; outputs dropped)

# ### Imports and Setup

# %% [cell 1]
#import matlab.engine 
import os
import scipy.io
import h5py
import math
import matplotlib.pyplot as plt
import numpy as np
import pickle
from tqdm import tqdm
import IProgress
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
from neurodsp.filt import filter_signal

# Import the FOOOF object
from fooof import FOOOF
from fooof.sim.gen import gen_aperiodic
from fooof.plts.spectra import plot_spectra
from fooof.plts.annotate import plot_annotated_peak_search

# %% [cell 2]

fs = 12500
fs_ds = 100 # Maestro downsampled frequency

# %% [cell 3]
directory = r"C:\Users\david\Documents\Voytek Research\LFP_psych_proj\lfp_psychedelics_dataset"
directory2 = r"C:\Users\david\Documents\Voytek Research\LFP_psych_proj\lfp_psych_ dataset2"
directory3 = r"C:\Users\david\Documents\Voytek Research\LFP_psych_proj\broadband_squared_dataset"
directory4 = r"C:\Users\david\Documents\Voytek Research\LFP_psych_proj\broadband_dataset"

# ### Creating the dictionary with all the LFP data

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

# %% [cell 5]
# Loop through all files in the directory
dict_wells2 = {}
for filename in os.listdir(directory2):
    # Check if the file is an HDF5 file
    if filename.endswith('.h5'):
        # Open the HDF5 file
        with h5py.File(os.path.join(directory2, filename), 'r') as file:
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
                dict_wells2[well_id] = data[0].reshape(4, 4, -1)

# %% [cell 6]
# Loop through all files in the directory
dict_wells3 = {}
for filename in os.listdir(directory3):
    # Check if the file is an HDF5 file
    if filename.endswith('.h5'):
        # Open the HDF5 file
        with h5py.File(os.path.join(directory3, filename), 'r') as file:

           
            #extract well ID 
            # Extract well ID from the filename
            well_id = filename.split('_')[-1].split('.')[0]  # Extracts the part after 'well' and before '.h5'
        
            # List all datasets in the file
            dataset_names = list(file.keys())
            
            # Access datasets 
            for dataset_name in dataset_names:
                dataset = file[dataset_name]
                print(dataset[0])
              
                data = dataset[:]
                # Store data for the current well in the dictionary - this data is already downsampled to 100hz in the Maestro machine :/ 
                dict_wells3[well_id] = data[0].reshape(4, 4, -1)

# %% [cell 7]
# Loop through all files in the directory
dict_wells4 = {}
for filename in os.listdir(directory4):
    # Check if the file is an HDF5 file
    if filename.endswith('.h5'):
        # Open the HDF5 file
        with h5py.File(os.path.join(directory4, filename), 'r') as file:

           
            #extract well ID 
            # Extract well ID from the filename
            well_id = filename.split('_')[-1].split('.')[0]  # Extracts the part after 'well' and before '.h5'
        
            # List all datasets in the file
            dataset_names = list(file.keys())
            
            # Access datasets 
            for dataset_name in dataset_names:
                dataset = file[dataset_name]
                #print(dataset[0])
              
                data = dataset[:]
                # Store data for the current well in the dictionary - this data is already downsampled to 100hz in the Maestro machine :/ 
                dict_wells4[well_id] = data[0].reshape(4, 4, -1)

# %% [cell 8]
filename = r"C:\Users\david\Documents\Voytek Research\LFP_psych_proj\broadband_squared_dataset\combined_lfp_data.h5"
with h5py.File(filename, 'r') as file:
    ds_wells_data = file['all_wells_data'][:]
print(ds_wells_data.shape)
# Since the dimensions are flipped, we need to transpose them
ds_wells_data = np.transpose(ds_wells_data, (2, 1, 0))

# Now ds_wells_data_corrected should have the correct shape
print(ds_wells_data.shape)

# %% [cell 9]
print(ds_wells_data)

# %% [cell 10]
test = dict_wells['wellC5'][0][2]
print("Length of recording in minutes: ", str(len(test)/fs_ds/60))

# %% [cell 11]
test3 = dict_wells3['wellB5'][0][2]
print("Length of recording in minutes: ", str(len(test3)/100/60))

# %% [cell 12]
test4 = dict_wells4['wellB5'][0][2]
print("Length of recording in minutes: ", str(len(test4)/fs_ds/60))

# %% [cell 13]
print(dict_wells3)

# %% [cell 14]
lim = len(test)/10
test2 = dict_wells['wellC5'][0][2][:6000]
print("Length of recording in minutes: ", str(len(test2)/fs_ds/60))

# %% [cell 15]
plt.plot(ds_wells_data[1][1])

# %% [cell 16]
fs = 1250  # buzsaki data was acquired continuously at 20 kHz
# Filter settings
sig = dict_wells4['wellB2'][0][0]
f_theta = (4, 10)
f_lowpass = 30
n_seconds_filter = .1
# Lowpass filter
sig_low = filter_signal(sig, fs, 'lowpass', f_lowpass,n_seconds=n_seconds_filter, remove_edges=False)
times = np.arange(0, len(sig)/fs, 1/fs)
xlim = (2, 5)
tidx = np.logical_and(times >= xlim[0], times < xlim[1])
plot_time_series(times, [sig, sig_low], colors=['k', 'k'], alpha=[.5, 1], lw=2)
plot_time_series(times[tidx], [sig[tidx], sig_low[tidx]], colors=['k', 'k'], alpha=[.5, 1], lw=2)

# %% [cell 17]
fs = 12500 
# Filter settings
for i in range(4):
    for j in range(4):
        sig_og = dict_wells4['wellB2'][i][j]
        f_theta = (4, 10)
        f_lowpass = 100
        n_seconds_filter = .1
        # Lowpass filter
        sig_low = filter_signal(sig, fs, 'lowpass', f_lowpass,n_seconds=n_seconds_filter, remove_edges=False)
        times = np.arange(0, len(sig)/fs, 1/fs)
        plot_time_series(times, [sig, sig_low], colors=['k', 'k'], alpha=[.5, 1], lw=2)

sig = ds_wells_data[1][1]
times = np.arange(0, len(sig)/100, 1/100)
plot_time_series(times, sig, colors= 'k', alpha= 1, lw=2)

# %% [cell 18]
og_feq = 12500 
downsample_feq = 100

# Filter settings
for i in range(4):
    for j in range(4):
        sig = dict_wells4['wellB2'][i][j]
        f_theta = (4, 10)
        n_seconds_filter = .1
        # Lowpass filter
        sig_low = filter_signal(sig, og_feq, 'lowpass', downsample_feq,n_seconds=n_seconds_filter, remove_edges=False)
        sig_low = sp.signal.resample(sig_low, int((len(sig_low)/og_feq)*downsample_feq))
        
        times = np.arange(0, len(sig_low)/downsample_feq, 1/downsample_feq)
        plot_time_series(times, sig_low, colors= 'k', alpha= 1, lw=2)
        
        times = np.arange(0, len(sig)/og_feq, 1/og_feq)
        plot_time_series(times, sig, colors= 'b', alpha= 1, lw=2)
       
        

sig2 = ds_wells_data[1][1]
times = np.arange(0, len(sig2)/100, 1/100)
plot_time_series(times, sig2, colors= 'k', alpha= 1, lw=2)

# %% [cell 19]
og_feq = 12500 
downsample_feq = 100

# Filter settings
for i in range(4):
    for j in range(4):
        sig = dict_wells4['wellB2'][i][j]
        f_theta = (4, 10)
        n_seconds_filter = .1
        # Lowpass filter
        sig_low = filter_signal(sig, og_feq, 'lowpass', downsample_feq,n_seconds=n_seconds_filter, remove_edges=False)
        sig_low = sp.signal.resample(sig_low, int((len(sig_low)/og_feq)*downsample_feq))
        
        times = np.arange(0, len(sig_low)/downsample_feq, 1/downsample_feq)
        #plot_time_series(times, sig_low, colors= 'k', alpha= 1, lw=2)
        
        # Define the window of time you want to plot
        start_time = 2  # Start of the window in seconds
        end_time = 4    # End of the window in seconds
        
        # Find the indices corresponding to the start and end time
        start_idx = np.searchsorted(times, start_time)
        end_idx = np.searchsorted(times, end_time)
        
        # Slice the time and data arrays to get the window
        windowed_time = times[start_idx:end_idx]
        windowed_data = sig_low[start_idx:end_idx]
        
        # Plot the windowed time series data
        plot_time_series(windowed_time, windowed_data)
        
        # Optionally, add labels, title, etc.
        plt.xlabel('Time (s)')
        plt.ylabel('Amplitude')
        plt.title(f'Time Series Data from {start_time} to {end_time} seconds')
        
        # Show the plot
        plt.show()
        
        times = np.arange(0, len(sig)/og_feq, 1/og_feq)
        #plot_time_series(times, sig, colors= 'b', alpha= 1, lw=2)

         # Define the window of time you want to plot
        start_time = 2  # Start of the window in seconds
        end_time = 4    # End of the window in seconds
        
        # Find the indices corresponding to the start and end time
        start_idx = np.searchsorted(times, start_time)
        end_idx = np.searchsorted(times, end_time)
        
        # Slice the time and data arrays to get the window
        windowed_time = times[start_idx:end_idx]
        windowed_data = sig[start_idx:end_idx]
        
        # Plot the windowed time series data
        plot_time_series(windowed_time, windowed_data, colors = 'k')
        
        # Optionally, add labels, title, etc.
        plt.xlabel('Time (s)')
        plt.ylabel('Amplitude')
        plt.title(f'Time Series Data from {start_time} to {end_time} seconds')
        
        # Show the plot
        plt.show()
        

sig2 = ds_wells_data[1][1]
times = np.arange(0, len(sig2)/100, 1/100)
plot_time_series(times, sig2, colors= 'k', alpha= 1, lw=2)

# ### Plotting data using matplotlib

# %% [cell 20]
plt.plot(dict_wells4['wellB2'][0][2])

# %% [cell 21]
plt.plot(dict_wells3['wellB2'][0][2])

# %% [cell 22]
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

# ### Plot PSD and Fit Model using specparam

# chosen function for plotting windows of time in power spectrum:

# %% [cell 23]
import warnings

# Ignore all warnings
warnings.filterwarnings("ignore")

def plot_power_windows(well_name, window_length):
    '''
        plots all power windows for a given well, iterating through each electrode
        well_name: name of the well key from the data dictionary
        window_length: the raw time or number or samples (need to convert from seconds before input)
        plots keep track of window number, not time 
    '''
    for i in range(4):
        for j in range(4):
            test = dict_wells[well_name][i][j]
            length = len(test)
            increment = 0
            print(f"{well_name}: {i}, {j}")
            print("\n")
            window = 1
            while increment < length - window_length:
                # Mean of spectrogram (Welch)
                freq_mean, psd_mean = compute_spectrum(test[increment:increment+window_length], fs_ds, method='welch', avg_type='mean', nperseg=fs*2)
                
                # Plot the power spectra
                plot_power_spectra([freq_mean[200:]],
                                   [psd_mean[200:]],
                                   [f'Welch- {well_name}: {i},{j}; Window {window}'])
                
                increment = increment + window_length
                window += 1

# %% [cell 24]
import warnings

# Ignore all warnings
warnings.filterwarnings("ignore")

def plot_power_windows(well_name, window_length):
    '''
        plots all power windows for a given well, iterating through each electrode
        well_name: name of the well key from the data dictionary
        window_length: the raw time or number or samples (need to convert from seconds before input)
        plots keep track of window number, not time 
        
        
    '''
    for i in range(4):
        for j in range(4):
            sig = dict_wells[well_name][i][j]
            sig_low = filter_signal(sig, og_feq, 'lowpass', downsample_feq,n_seconds=n_seconds_filter, remove_edges=False)
            sig_low = sp.signal.resample(sig_low, int((len(sig_low)/og_feq)*downsample_feq))
            length = len(sig_low)
            increment = 0
            print(f"{well_name}: {i}, {j}")
            print("\n")
            window = 1
            while increment < length - window_length:
                # Mean of spectrogram (Welch)
                freq_mean, psd_mean = compute_spectrum(test[increment:increment+window_length], fs_ds, method='welch', avg_type='mean', nperseg=fs*2)
                
                # Plot the power spectra
                plot_power_spectra([freq_mean[200:]],
                                   [psd_mean[200:]],
                                   [f'Welch- {well_name}: {i},{j}; Window {window}'])
                
                increment = increment + window_length
                window += 1

# %% [cell 25]
plot_power_windows("wellB2", 12000)

# something missing:

# %% [cell 26]
def plot_4x4_psd(dictionary):
    fig, axes = plt.subplots(4, 4, figsize=(12, 12))
    limit = 0
    for key, array_4x4 in dictionary.items():
        for i in range(4):
            for j in range(4):
                ax = axes[i, j]
                # Mean of spectrogram (Welch)
                freq_mean, psd_mean = compute_spectrum(array_4x4[i, j], fs_ds, method='welch', avg_type='mean', nperseg=fs*2)

                # Initialize a FOOOF object
                fm = FOOOF()
                
                # Set the frequency range to fit the model
                freq_range = [2, 40]
                
                # Report: fit the model, print the resulting parameters, and plot the reconstruction
                #fm.report(freq_mean, psd_mean, freq_range)
                fm.fit(freq_mean, psd_mean, freq_range)
                fm.plot
        limit += 1
        if limit > 2:
            break




plot_4x4_psd(dict_wells)

# %% [cell 27]
plt_log = False
def plot_4x4_psd(dictionary):
    fig, axes = plt.subplots(4, 4, figsize=(12, 12))
    limit = 0
    for key, array_4x4 in dictionary.items():
        for i in range(4):
            for j in range(4):
                ax = axes[i, j]
                # Mean of spectrogram (Welch)
                freq_mean, psd_mean = compute_spectrum(array_4x4[i, j], fs_ds, method='welch', avg_type='mean', nperseg=fs*2)

                # Initialize a FOOOF object
                fm = FOOOF()
                
                # Set the frequency range to fit the model
                freq_range = [2, 40]
                
                # Report: fit the model, print the resulting parameters, and plot the reconstruction
                #fm.report(freq_mean, psd_mean, freq_range)
                fm.fit(freq_mean, psd_mean, freq_range)
                plot_spectra(fm.freqs, fm._ap_fit, plt_log, label='Final Aperiodic Fit',
             color='blue', alpha=0.5, linestyle='dashed', ax=ax)
        limit += 1
        if limit > 2:
            break




plot_4x4_psd(dict_wells)

# %% [cell 28]
# Mean of spectrogram (Welch)
freq_mean, psd_mean = compute_spectrum(test, fs_ds, method='welch', avg_type='mean', nperseg=fs*2)

# %% [cell 29]
# Mean of spectrogram (Welch)
freq_mean2, psd_mean2 = compute_spectrum(test2, fs_ds, method='welch', avg_type='mean', nperseg=fs*2)

# %% [cell 30]
# Plot the power spectra
plot_power_spectra([freq_mean[200:]],
                   [psd_mean[200:]],
                   ['Welch'])

# %% [cell 31]
#add this for new file

# %% [cell 32]
length = len(test)/10
print(length)

# %% [cell 33]
# for each well and change window size
test = dict_wells['wellC5'][0][2]
length = len(test)
increment = 0
while increment < length - 6000 :
    # Mean of spectrogram (Welch)
    freq_mean, psd_mean = compute_spectrum(test[increment:increment+6000], fs_ds, method='welch', avg_type='mean', nperseg=fs*2)
    # Plot the power spectra
    plot_power_spectra([freq_mean[200:]],
                       [psd_mean[200:]],
                       ['Welch'])
    increment = increment + 6000

# Other methods of plotting windows in power spectra (not preffered):

# %% [cell 34]
def plot_all_power_windows(window_length):
    # Loop through each well in the dictionary
    for well_name, well_data in dict_wells.items():
        test = well_data[0][2]
        length = len(test)
        increment = 0
        print(well_name)
        print("\n")
        window = 1
        while increment < length - window_length:
            # Mean of spectrogram (Welch)
            freq_mean, psd_mean = compute_spectrum(test[increment:increment+window_length], fs_ds, method='welch', avg_type='mean', nperseg=fs*2)
            
            # Plot the power spectra
            plot_power_spectra([freq_mean[200:]],
                               [psd_mean[200:]],
                               [f'Welch - {well_name}; Window {window}'])
            
            increment = increment + window_length
            window += 1

# %% [cell 35]
def plot_power_OneElec(well_name, window_length):
    test = dict_wells[well_name][0][2]
    length = len(test)
    increment = 0
    window = 1
    while increment < length - window_length :
        # Mean of spectrogram (Welch)
        freq_mean, psd_mean = compute_spectrum(test[increment:increment+window_length], fs_ds, method='welch', avg_type='mean', nperseg=fs*2)
        # Plot the power spectra
        plot_power_spectra([freq_mean[200:]],
                           [psd_mean[200:]],
                           [f'Welch {well_name}, Window {window}'])
        increment = increment + window_length
        window += 1

# %% [cell 36]
plot_power_OneElec("wellB6", 1000)

# %% [cell 37]
# Initialize a FOOOF object
fm = FOOOF()

# Set the frequency range to fit the model
freq_range = [2, 40]

# Report: fit the model, print the resulting parameters, and plot the reconstruction
fm.report(freq_mean, psd_mean, freq_range)

# %% [cell 38]
# Initialize a FOOOF object
fm = FOOOF()

# Set the frequency range to fit the model
freq_range = [2, 40]

# Report: fit the model, print the resulting parameters, and plot the reconstruction
fm.report(freq_mean2, psd_mean2, freq_range)
