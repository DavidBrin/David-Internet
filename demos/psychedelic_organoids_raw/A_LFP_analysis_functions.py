#!/usr/bin/env python
# coding: utf-8

# In[1]:


'''
Description
Author: David Brin
First created: 9-10-2024

list of functions and descriptions to start analysis on lfp data using preprocessed lfp data by well and spike data by electrode
'''


#  First, import necessary libraries and define functions for analyzing lfp and spike data

# ## Imports and function definitions

# In[2]:


#import matlab.engine 
import os
import scipy.io
import h5py
import math
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import pickle
from tqdm import tqdm
import IProgress
import scipy as sp
from neurodsp.filt import filter_signal
from scipy.signal import butter, filtfilt
from scipy.signal import find_peaks
import pandas as pd
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


# Loading and plotting lfp data:

# In[3]:


# for loading data
def load_lfp(filename):
    '''
    function loads lfp data into one 3D array with lfp by well
    param filename must be a preprocessed lfp file
    returns lfp data array
    '''
    with h5py.File(filename, 'r') as file:
        ds_wells_data = file['all_wells_data'][:]
    # Since the dimensions are flipped, we need to transpose them
    ds_wells_data = np.transpose(ds_wells_data, (2, 1, 0))
    # Now ds_wells_data_corrected should have the correct shape
    print(ds_wells_data.shape)
    return ds_wells_data


# In[4]:


def plot_one_pspectrum(sig, name = "", fs_ds = 100):
    '''
    plots one power spectrum given an array of recording values
    Can pass in a name or change frequency
    plots one graph and returns nothing
    '''
    freq_mean, psd_mean = compute_spectrum(sig, fs_ds, method='welch', avg_type='mean', nperseg=fs_ds*2)
    plot_power_spectra([freq_mean[:]],[psd_mean[:]], [f'Welch {name}'])


# In[5]:


def plot_all_pspectra(ds_wells_data, fs_ds = 100, n_rows = 2, n_cols = 3):
    '''
    plots all power spectra from a given data set (3D array of recordings for 6 by 8 well layout)
    plots all graphs, returns nothing
    '''
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(20, 15))
    for i in range(n_rows):
        for j in range(n_cols):
            sig = ds_wells_data[i][j]
            freq_mean, psd_mean = compute_spectrum(sig, fs_ds, method='welch', avg_type='mean', nperseg=fs_ds*2)
    
            ax = axes[i, j]
            
            # Plot the power spectrum on the subplot
            ax.plot(freq_mean, psd_mean)
            ax.set_title(f'Welch- well{i}{j}')
            ax.set_xscale('log')
            ax.set_yscale('log')
    
    
    plt.tight_layout()
    plt.show()

def fooof_all_pspectra(ds_wells_data, fs_ds = 100, fmode = "knee",n_rows = 2, n_cols = 3 ):
    '''
    fits, reports, and plots all fooof power spectra from a given data set (3D array of recordings for 2 by 3 well layout)
    plots all graphs, returns nothing
    '''

    for i in range(n_rows):
        for j in range(n_cols):
            sig = ds_wells_data[i][j]
            freq_mean, psd_mean = compute_spectrum(sig, fs_ds, method='welch', avg_type='mean', nperseg=fs_ds*2)

            fm = FOOOF(min_peak_height=0.5316, aperiodic_mode = fmode)
            freq_range = [1, 50]
            fm.report(freq_mean, psd_mean, freq_range)
# In[6]:


def ds_power_windows(sig, inc, name = "", fs_ds = 100):
    ''' 
    plots power spectrum of every window of given recording (sig) given the window size (inc)
    calls plot_one_pspectrum, no returns
    designed for recordings of 600s
    '''
    curr = 0
    while curr + inc < 60000:
        wndw = sig[curr:curr+inc]              
        curr = curr + inc
        freq_mean, psd_mean = compute_spectrum(wndw, fs_ds, method='welch', avg_type='mean', nperseg=fs_ds*2)
        plot_power_spectra([freq_mean[:]], [psd_mean[:]], [f'Welch- {name} {curr} - {curr + inc}'])


# In[7]:


def fooof_on_windows(sig, inc, name = "", fs_ds = 100):
    '''
    similar to ds_power_windows but runs fooof on windowed recording and prints a report
    min peak height set from 'ds_lfp_07-29-24' from peak of noise data
    '''
    curr = 0
    while curr + inc < 60000:
        wndw = sig[curr:curr+inc]               #change well with new function param (using 0,3 because of activity)
        curr += inc
        freq_mean, psd_mean = compute_spectrum(wndw, fs_ds, method='welch', avg_type='mean', nperseg=fs_ds*2)

        fm = FOOOF(min_peak_height=0.5316, aperiodic_mode = "knee")
        freq_range = [1, 50]
        fm.report(freq_mean, psd_mean, freq_range)


# Loading and analyzing spike data:

# In[8]:


def load_spikes(mat_file_path):
    '''
    loads in spike data from given path
    returns times for each spike formatted by electrode as 6 by 8 by 4 by 4 array of spikes
    spike_times_array[row][col][mea row][mea col][null check][spike num]
    if the electrode has a non-null recording accessing spikes will look like spike_times_array[row][col][mea row][mea col][0][spike num]
    if not, size of spike_times_array[row][col][mea row][mea col] will be 0
    includes commented out option to load in waveforms (not necessary for current use)
    '''
    mat_data = scipy.io.loadmat(mat_file_path)
    
    # Display the keys in the .mat file to understand its structure
    print(mat_data.keys())
    
    # Access a specific variable from the .mat file
    spike_times = mat_data.get('spike_times')
#    spike_waveforms = mat_data.get('spike_waveforms')
    
    if spike_times is not None:
        spike_times_array = np.array(spike_times)
    
#    if spike_waveforms is not None:
#        spike_waveforms_array = np.array(spike_waveforms)

    return spike_times_array


# In[9]:


def spike_spacial_visualization(spike_times_array, n_rows = 2, n_cols = 3):
    '''
    created a heatmap per well of spikes in the recording along with a blended heatmap of spikes per electrode
    returns nothing, plots graphs
    use load_spikes(filepath) to create spike_times_array
    '''
    if spike_times_array is None:
        raise ValueError("Spike times data not found in the .mat file.")
    
    # Initialize a 6x8 grid to store the sum of spikes in each 4x4 sub-grid
    heatmap_data = np.zeros((n_rows, n_cols))
    n_elec = 16
    if(n_rows == 6):
        n_elec = 4
    # Loop through each well and electrode
    for row in range(n_rows):
        for col in range(n_cols):
            # Initialize a 4x4 grid to store the number of spikes in each electrode
            sub_heatmap_data = np.zeros((n_elec, n_elec))
            
            for i in range(n_elec):
                for j in range(n_elec):
                    # Check if the electrode has data
                    if spike_times_array[row, col, i, j] is not None and spike_times_array[row, col, i, j].size > 0:
                        # Get the spike times for the electrode
                        spike_times = spike_times_array[row, col, i, j][0]
                        # Count the number of spikes and store in the sub-heatmap
                        sub_heatmap_data[i, j] = len(spike_times)
    
            # Sum the number of spikes in the 4x4 sub-grid and store in the main heatmap
            heatmap_data[row, col] = np.sum(sub_heatmap_data)
    
    # Plot the 6x8 heatmap
    plt.figure(figsize=(12, 8))
    plt.imshow(heatmap_data, cmap='hot', interpolation='nearest')
    plt.colorbar(label='Number of Spikes')
    plt.title('Spike Count Heatmap')
    plt.xlabel('Column')
    plt.ylabel('Row')
    plt.show()
    
    
    # Find the global min and max values for the subplots
    global_min = np.inf
    global_max = -np.inf
    
    for row in range(n_rows):
        for col in range(n_cols):
            for i in range(n_elec):
                for j in range(n_elec):
                    if spike_times_array[row, col, i, j] is not None and spike_times_array[row, col, i, j].size > 0:
                        spike_times = spike_times_array[row, col, i, j][0]
                        count = len(spike_times)
                        if count < global_min:
                            global_min = count
                        if count > global_max:
                            global_max = count
    
    # Plot each 4x4 sub-heatmap in its respective 6x8 position
    fig, axarr = plt.subplots(n_rows, n_cols, figsize=(24, 18))
    
    for row in range(n_rows):
        for col in range(n_cols):
            # Initialize a 4x4 grid to store the number of spikes in each electrode
            sub_heatmap_data = np.zeros((n_elec, n_elec))
            
            for i in range(n_elec):
                for j in range(n_elec):
                    # Check if the electrode has data
                    if spike_times_array[row, col, i, j] is not None and spike_times_array[row, col, i, j].size > 0:
                        # Get the spike times for the electrode
                        spike_times = spike_times_array[row, col, i, j][0]
                        # Count the number of spikes and store in the sub-heatmap
                        sub_heatmap_data[i, j] = len(spike_times)
            
            # Plot the 4x4 sub-heatmap with unified scale
            im = axarr[row, col].imshow(sub_heatmap_data, cmap='hot', interpolation='bilinear', vmin=global_min, vmax=global_max)
            axarr[row, col].axis('off')
    
    # Add a unified colorbar for the entire figure
    cbar = fig.colorbar(im, ax=axarr.ravel().tolist(), orientation='vertical', fraction=0.02, pad=0.04)
    cbar.set_label('Number of Spikes')
    
    plt.suptitle('Embedded Heatmaps of Spike Counts', fontsize=16)
    plt.show()


# In[10]:


def spike_threshold_vis(spike_times_array, threshold = 20, n_rows = 2, n_cols = 3):
    '''
    similar to spike_spacial_visualization(spike_times_array) but colors dark green for electrodes over threshold and light for electrodes under
    '''
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(20, 15), constrained_layout=True)
    n_elec = 16
    if(n_rows == 6):
        n_elec = 4
    # Loop through each well and electrode to create subplots
    for row in range(n_rows):
        for col in range(n_cols):
            # Initialize an array to store electrode activity (1 for > 20 spikes, 0 otherwise)
            electrode_activity = np.zeros((n_elec, n_elec))
            for i in range(n_elec):
                for j in range(n_elec):
                    # Check if the electrode has data and is not empty
                    if spike_times_array[row, col, i, j] is not None and spike_times_array[row, col, i, j].size > 0:
                        # Get the spike times for the electrode
                        spike_times = spike_times_array[row, col, i, j][0]
                        # Mark as active if the electrode has more than 20 spikes
                        if len(spike_times) > threshold:
                            electrode_activity[i, j] = 1
    
            # Create a subplot for the current well
            ax = axes[row, col]
            ax.imshow(electrode_activity, cmap='Greens', vmin=0, vmax=1)
    
            # Customize the subplot appearance
            ax.set_xticks([])
            ax.set_yticks([])
            ax.set_title(f'Well {row+1},{col+1}', fontsize=8)
    
    # Set overall plot title and show the plot
    fig.suptitle(f'Electrode Spiking Activity Over {threshold}', fontsize=16)
    plt.show()


# In[11]:


def find_and_plot_active_spike_windows(spike_times_array, window_size, threshold = 0, n_rows = 2, n_cols = 3):
    '''
    takes in spike times array, window size, and a threshold
    finds and plots the number of spikes for all windows of time per electrode with spike numbers above the threshold (default 0)
    sorts plots by most spikes to least spikes
    no return
    '''
    # Initialize a list to store spike counts and their positions
    spike_counts = []
    n_elec = 16
    if(n_rows == 6):
        n_elec = 4
    # Loop through each well and electrode
    for row in range(n_rows):
        for col in range(n_cols):
            for i in range(n_elec):
                for j in range(n_elec):
                    # Check if the electrode has data and is not empty
                    if spike_times_array[row, col, i, j] is not None and spike_times_array[row, col, i, j].size > 0:
                        # Get the spike times for the electrode
                        spike_times = spike_times_array[row, col, i, j][0]
                        # Count the number of spikes and store with position
                        spike_counts.append((len(spike_times), (row, col, i, j)))
    # Filter out electrodes with less than threshold spikes
    spike_counts = [sc for sc in spike_counts if sc[0] > threshold]
    # Sort electrodes by spike count
    spike_counts.sort(reverse=True, key=lambda x: x[0])
    # Find clusters of active time windows for filtered electrodes
    active_time_windows = {}
    for count, (row, col, i, j) in spike_counts:
        spike_times = spike_times_array[row, col, i, j][0]
        active_windows = []
        # Find clusters of spike times
        start_time = spike_times[0]
        end_time = start_time + window_size
        spike_count_in_window = 0
    
        for spike_time in spike_times:
            if spike_time <= end_time:
                spike_count_in_window += 1
            else:
                active_windows.append((start_time, end_time, spike_count_in_window))
                start_time = spike_time
                end_time = start_time + window_size
                spike_count_in_window = 1    
        # Add the last window
        active_windows.append((start_time, end_time, spike_count_in_window))   
        active_time_windows[(row, col, i, j)] = active_windows
    
    # Plot the results
    num_plots = len(active_time_windows)
    fig, axes = plt.subplots((num_plots + 1) // 2, 2, figsize=(20, num_plots * 2))  # Adjust figure size accordingly
    axes = axes.flatten()
    for idx, ((row, col, i, j), windows) in enumerate(active_time_windows.items()):
        window_starts = [start_time for start_time, end_time, count in windows]
        spike_counts = [count for start_time, end_time, count in windows]
        
        axes[idx].bar(window_starts, spike_counts, width=window_size, align='edge')
        axes[idx].set_title(f'Electrode at Well ({row}, {col}), Sub-grid ({i}, {j})')
        axes[idx].set_xlabel('Time (s)')
        axes[idx].set_ylabel('Spike Count')
        #axes[idx].axhline(y=100, color='r', linestyle='--')
    # Hide any unused subplots
    for ax in axes[num_plots:]:
        ax.axis('off')
    plt.tight_layout()
    plt.show()


# In[12]:


def spikes_by_well(spike_times_array, n_rows = 2, n_cols = 3):
    '''
    consolidates MEA recordings into one array to create a spike time array by well
    usefull for matching organoid activity for lfp analysis
    returns spike_times_by_well
    '''
    n_elec = 16
    if(n_rows == 6):
        n_elec = 4
    spike_times_by_well = np.empty((n_rows, n_cols), dtype=object)
    for row in range(n_rows):
        for col in range(n_cols):
            # empty list to collect spike times for the current well
            well_spike_times = []
            
            for i in range(n_elec):
                for j in range(n_elec):
                    # Check if the entry is not empty and is not a zero-dimensional array
                    if spike_times_array[row][col][i][j].size > 0:
                        if isinstance(spike_times_array[row][col][i][j][0], np.ndarray):
                            well_spike_times.extend(spike_times_array[row][col][i][j][0])
                        else:
                            # If they are scalars, append them to the list
                            well_spike_times.append(spike_times_array[row][col][i][j][0])
            
            spike_times_by_well[row, col] = np.sort(np.array(well_spike_times))
    
    # Now spike_times_by_well is a 6x8 array where each entry contains a sorted array of spike times for that well
    return spike_times_by_well


# In[13]:


def plot_num_spikes_hist(spike_times_by_well, window_size, num_windows = 6, threshold = 500, n_rows = 2, n_cols = 2):
    '''
    plots a histogram of number of windows with a range of spikes starting at the given threshold
    uses spike times by well for use in relation to lfp analysis
    num_windows defaults to 6 for standard 600s recording
    threshold defaults to 500 spikes
    returns binary_spikes_per_window for active window analysis
    '''
    spikes_per_window = np.zeros((n_rows, n_cols, num_windows))
    binary_spikes_per_window = np.zeros((n_rows, n_cols, num_windows))
    # Process each well to calculate spikes per window and apply threshold
    for row in range(n_rows):
        for col in range(n_cols):
            if spike_times_by_well[row, col].size > 0:
                spike_times = spike_times_by_well[row, col]
                # Create windows and count spikes per window
                for w in range(num_windows):
                    start_time = w * window_size
                    end_time = (w + 1) * window_size
                    spikes_per_window[row, col, w] = np.sum((spike_times >= start_time) & (spike_times < end_time))
                
                # Apply threshold to create binary array
                binary_spikes_per_window[row, col] = spikes_per_window[row, col] > threshold
    
    flattened_spikes = spikes_per_window.flatten()
    flattened_binary_flags = binary_spikes_per_window.flatten()  
    # Filter the spikes that are above the threshold
    spikes_above_threshold = flattened_spikes[flattened_binary_flags == 1]  
    # Plot the histogram of spikes per window for those above the threshold
    plt.hist(spikes_above_threshold, bins=50, edgecolor='black')
    plt.xlabel('Number of Spikes per Window (Above Threshold)')
    plt.ylabel('Number of Windows')
    plt.title('Histogram of Number of Spikes per Window (Above Threshold)')
    plt.show()
    # binary_spikes_per_window is now a 6x8x6 array where each entry is 0 or 1 based on the threshold
    return binary_spikes_per_window


# Active window analysis for lfp:

# In[14]:


def fooof_wind_thresh(binary_activity, ds_wells_data, window_size, num_windows = 6, fs_ds = 100, fmode = "knee", n_rows = 2, n_cols = 3):
    '''
    creates and reports a fooof object on the data from the active window
    binary_activity: use returned value from plot_num_spikes_hist
    window_size: size of window
    num_windows defaults to 6 and fs_ds to 100 as previously done
    no return, prints and plots fooof report
    '''
    print(f"fitting all {window_size}s active windows per well")
    
    for row in range(n_rows):
        for col in range(n_cols):
            for w in range(num_windows):
                if binary_activity[row, col, w] == 1:
                    start_time = w * window_size
                    end_time = (w + 1) * window_size
    
                    print(f"fitting well {row},{col} {start_time}:{end_time}")
                    sig = ds_wells_data[row][col][start_time*fs_ds:end_time*fs_ds]              
                    freq_mean, psd_mean = compute_spectrum(sig, fs_ds, method='welch', avg_type='mean', nperseg=fs_ds*2)
            
                    fm = FOOOF(min_peak_height=0.5316, aperiodic_mode = fmode)
                    freq_range = [1, 50]
                    fm.report(freq_mean, psd_mean, freq_range)


# In[17]:


def ndsp_wind_thresh(binary_activity, ds_wells_data, window_size, num_windows = 6, fs_ds = 100, n_rows = 2, n_cols = 3):
    '''
    same as fooof_wind_thresh but uses the neurodsp method plot_power_spectra instead of fooof
    '''
    print(f"fitting all {window_size}s active windows per well")
    
    for row in range(n_rows):
        for col in range(n_cols):
            for w in range(num_windows):
                if binary_activity[row, col, w] == 1:
                    start_time = w * window_size
                    end_time = (w + 1) * window_size
    
                    print(f"fitting well {row},{col} {start_time}:{end_time}")
                    sig = ds_wells_data[row][col][start_time*fs_ds:end_time*fs_ds]              
                    freq_mean, psd_mean = compute_spectrum(sig, fs_ds, method='welch', avg_type='mean', nperseg=fs_ds)
                    plot_power_spectra([freq_mean[:]], [psd_mean[:]], [f'Welch- well[{row},{col}] {start_time}:{end_time}'])      


# Variation of FoooF parameters

# In[18]:


def set_fm_array(ds_wells_data, fs_ds = 100, n_rows = 2, n_cols = 3):
    '''
    creates an array of fooof objects based on given well data for parameter analysis by well
    returns the array of fooof objects
    '''
    fm_array = np.empty((n_rows, n_cols), dtype=object)
    for i in range(n_rows):
        for j in range(n_cols):
            sig = ds_wells_data[i][j]
            freq_mean, psd_mean = compute_spectrum(sig, fs_ds, method='welch', avg_type='mean', nperseg=fs_ds*2)
            # Initialize a FOOOF object
            fm = FOOOF(min_peak_height=0.5316, aperiodic_mode = "knee", verbose=False)
            fm_array[i, j] = fm
            # Set the frequency range to fit the model
            freq_range = [2, 50]
            
            # Report: fit the model, print the resulting parameters, and plot the reconstruction
            fm.fit(freq_mean, psd_mean, freq_range)

    return fm_array

def set_fm_array_one_outlier(ds_wells_data, fs_ds = 100, n_rows = 2, n_cols = 3, indices = [-1, -1]):
    '''
    creates an array of fooof objects based on given well data for parameter analysis by well
    returns the array of fooof objects
    '''
    fm_array = np.empty((n_rows, n_cols), dtype=object)
    for i in range(n_rows):
        for j in range(n_cols):
            if([i,j] == indices):
                continue
            sig = ds_wells_data[i][j]
            freq_mean, psd_mean = compute_spectrum(sig, fs_ds, method='welch', avg_type='mean', nperseg=fs_ds*2)
            # Initialize a FOOOF object
            fm = FOOOF(min_peak_height=0.5316, aperiodic_mode = "knee", verbose=False)
            fm_array[i, j] = fm
            # Set the frequency range to fit the model
            freq_range = [2, 50]
            
            # Report: fit the model, print the resulting parameters, and plot the reconstruction
            fm.fit(freq_mean, psd_mean, freq_range)

    return fm_array

# In[19]:


def param_heatmap(fm_array, n_rows = 2, n_cols = 3):
    '''
    uses a heatmap to plot each parameter in a spacial distribution view
    takes in fm_array (array of fooof objects)
    no return, just plots
    '''
    # Extract the 3 aperiodic parameters and R^2 values into separate 6x8 arrays
    offsets = np.zeros((n_rows, n_cols))
    knees = np.zeros((n_rows, n_cols))
    exponents = np.zeros((n_rows,n_cols))
    r_squared_values = np.zeros((n_rows, n_cols))
    
    for i in range(n_rows):
        for j in range(n_cols):
            offsets[i, j] = fm_array[i, j].aperiodic_params_[0]
            knees[i, j] = fm_array[i, j].aperiodic_params_[1]
            exponents[i, j] = fm_array[i, j].aperiodic_params_[2]
            r_squared_values[i, j] = fm_array[i, j].r_squared_
    
    # Create a function to plot heatmaps
    def plot_heatmap(data, title, cbar_label):
        plt.figure(figsize=(10, 8))
        sns.heatmap(data, annot=True, cmap='viridis', cbar_kws={'label': cbar_label})
        plt.title(title)
        plt.xlabel('Well Column')
        plt.ylabel('Well Row')
        plt.show()
    
    # Plot each heatmap
    plot_heatmap(offsets, 'Aperiodic Offsets', 'Value')
    plot_heatmap(knees, 'Aperiodic Knees', 'Value')
    plot_heatmap(exponents, 'Aperiodic Exponents', 'Value')
    plot_heatmap(r_squared_values, 'R-Squared Values', 'R^2')


# In[20]:

'''
#Example dose grid for following functions:
dose_grid = np.array([
    ['10uM', '10uM', '10uM', '20uM', '20uM', '20uM', 'Vehicle', 'Vehicle'],
    ['10uM', '10uM', '10uM', '20uM', '20uM', '20uM', 'Vehicle', 'Vehicle'],
    ['10uM', '10uM', '10uM', '20uM', '20uM', '20uM', 'Vehicle', 'Vehicle'],
    ['10uM', '10uM', 'Blank', 'Blank', 'Blank', 'Blank', 'Blank', 'Blank'],
    ['Blank', 'Blank', 'Blank', 'Blank', 'Blank', 'Blank', 'Blank', 'Blank'],
    ['Blank', 'Blank', 'Blank', 'Blank', 'Blank', 'Blank', 'Blank', 'Blank']
])
'''

# In[22]:


def plot_variability(fm_array, dose_grid, n_rows = 2, n_cols = 3):
    '''
    plots the standard deviation of the aperiodic paramters from given fm_array
    doesn't plot knees for scale issues
    lables should be changed according to 'dose_grid'
    returns nothing, plots graphs
    '''
    offsets = np.zeros((n_rows, n_cols))
    knees = np.zeros((n_rows, n_cols))
    exponents = np.zeros((n_rows, n_cols))
    r_squared_values = np.zeros((n_rows,n_cols))
    # Calculate standard deviation for each parameter based on the dose
    def calculate_variability(param_array, dose_grid, dose):
        mask = dose_grid == dose
        return np.nanstd(param_array[mask])
        
    for i in range(n_rows):
        for j in range(n_cols):
            offsets[i, j] = fm_array[i, j].aperiodic_params_[0]
            knees[i, j] = fm_array[i, j].aperiodic_params_[1]
            exponents[i, j] = fm_array[i, j].aperiodic_params_[2]
            r_squared_values[i, j] = fm_array[i, j].r_squared_
    
    '''    variability_10uM = {
        'Aperiodic 1': calculate_variability(offsets, dose_grid, '10uM'),
        #'Aperiodic 2': calculate_variability(knees, dose_grid, '10uM'),
        'Aperiodic 3': calculate_variability(exponents, dose_grid, '10uM'),
    }
    
    variability_20uM = {
        'Aperiodic 1': calculate_variability(offsets, dose_grid, '20uM'),
        #'Aperiodic 2': calculate_variability(knees, dose_grid, '20uM'),
        'Aperiodic 3': calculate_variability(exponents, dose_grid, '20uM'),
    }
    
    variability_vehicle = {
        'Aperiodic 1': calculate_variability(offsets, dose_grid, 'Vehicle'),
        #'Aperiodic 2': calculate_variability(knees, dose_grid, 'Vehicle'),
        'Aperiodic 3': calculate_variability(exponents, dose_grid, 'Vehicle'),
    }
    
    variability_empty = {
        'Aperiodic 1': calculate_variability(offsets, dose_grid, 'Blank'),
        #'Aperiodic 2': calculate_variability(knees, dose_grid, 'Blank'),
        'Aperiodic 3': calculate_variability(exponents, dose_grid, 'Blank'),
    }'''
    doses = np.unique(dose_grid)
    variabilities_dict = {}
    for dose in doses:
        variabilities_dict[dose] = {
            'Offset': calculate_variability(offsets, dose_grid, dose),
            #'Knee': calculate_variability(knees, dose_grid, '10uM'),
            'Exponent': calculate_variability(exponents, dose_grid, dose),
        }
    
    def variability(variability_dict, title):
        categories = list(variability_dict.keys())
        values = list(variability_dict.values())
        
        plt.figure(figsize=(10, 5))
        sns.barplot(x=categories, y=values, palette="viridis")
        plt.title(title)
        plt.ylabel('Standard Deviation')
        plt.show()

    '''variability(variability_10uM, 'Variability in 10uM Dose')
    variability(variability_20uM, 'Variability in 20uM Dose')
    variability(variability_vehicle, 'Variability in Vehicle (Control)')
    variability(variability_empty, 'Variability in empty')'''
    for key in variabilities_dict:
        variability(variabilities_dict[key], f'Variability in {key} Dose')


# In[23]:


def plot_aperiodic_boxplot(fm_array,  dose_grid, n_rows = 2, n_cols = 3):
    '''
    plots boxplots based on the aperiodic parameter lists extracted from fm_array and uses dose_grid for plotting 
    returns nothing, plots graphs
    '''
    dose_labels = []
    aperiodic_param_1_list = []
    aperiodic_param_2_list = []
    aperiodic_param_3_list = []
    offsets = np.zeros((n_rows, n_cols))
    knees = np.zeros((n_rows, n_cols))
    exponents = np.zeros((n_rows, n_cols))
    r_squared_values = np.zeros((n_rows, n_cols))
    #extract aperiodic parameter arrays
    for i in range(n_rows):
        for j in range(n_cols):
            offsets[i, j] = fm_array[i, j].aperiodic_params_[0]
            knees[i, j] = fm_array[i, j].aperiodic_params_[1]
            exponents[i, j] = fm_array[i, j].aperiodic_params_[2]
    
    # Loop through each well and collect data
    for i in range(n_rows):
        for j in range(n_cols):
            dose = dose_grid[i, j]
            #if dose in grouped_params:
                # Ensure that aperiodic parameters are not None or empty
            if offsets[i, j] is not None and knees[i, j] is not None and exponents[i, j] is not None:
                dose_labels.append(dose)
                aperiodic_param_1_list.append(offsets[i, j])
                aperiodic_param_2_list.append(knees[i, j])
                aperiodic_param_3_list.append(exponents[i, j])
    
    # Create a DataFrame
    df = pd.DataFrame({
        'Dose': dose_labels,
        'Offsets': aperiodic_param_1_list,
        'Knees': aperiodic_param_2_list,
        'Exponents': aperiodic_param_3_list
    })
    
    # Plotting boxplots for each aperiodic parameter
    plt.figure(figsize=(14, 10))
    
    for idx, param in enumerate(['Offsets', 'Knees', 'Exponents'], 1):
        plt.subplot(1, 3, idx)
        sns.boxplot(x='Dose', y=param, data=df)
        plt.title(f'{param} by Dose')
        plt.xlabel('Dose')
        plt.ylabel(param)
    
    plt.tight_layout()
    plt.show()


# In[24]:


def plot_peak_boxplot(fm_array, n_rows = 2, n_cols = 3):
    '''
    plots boxplots based on the peak parameter lists extracted from fm_array
    returns nothing, plots graphs
    '''
    peak_params = []

    for i in range(n_rows):
        for j in range(n_cols):
            peak_param = fm_array[i, j].peak_params_
            if peak_param is not None and len(peak_param) > 0:
                peak_params.append(peak_param)
    peak_param_1_list = []
    peak_param_2_list = []
    peak_param_3_list = []
    
    # Extract the peak parameters
    for params in peak_params:
        peak_param_1_list.append(params[0, 0])
        peak_param_2_list.append(params[0, 1])
        peak_param_3_list.append(params[0, 2])
    
    # Create a DataFrame
    df_peak = pd.DataFrame({
        'center frequency': peak_param_1_list,
        'power': peak_param_2_list,
        'bandwidth': peak_param_3_list
    })
    
    # Plotting boxplots for each peak parameter
    plt.figure(figsize=(14, 10))
    
    for idx, param in enumerate(['center frequency', 'power', 'bandwidth'], 1):
        plt.subplot(1, 3, idx)
        sns.boxplot(y=param, data=df_peak)
        plt.title(f'{param} Distribution')
        plt.xlabel('')
    
    plt.tight_layout()
    plt.show()

#return peak params



def plot_peak_binary_heatmap(fm_array, n_rows = 2, n_cols = 3):
    '''
    Creates a binary 2D array indicating if a well has peaks, and plots a heatmap.
    Takes in fm_array (array of FOOOF objects).
    '''
    # Initialize a 6x8 binary array (size of wells)
    peak_binary_array = np.zeros((n_rows, n_cols), dtype=int)
    
    # Loop through each well and check if there are any peaks
    for i in range(n_rows):
        for j in range(n_cols):
            if fm_array[i, j].n_peaks_ > 0: #or fm_array[i, j]._peak_params.size > 0:
                peak_binary_array[i, j] = 1
    
    # Plot the heatmap
    plt.figure(figsize=(10, 8))
    sns.heatmap(peak_binary_array, annot=True, cmap='Blues', cbar_kws={'label': 'Peaks (1 = Yes, 0 = No)'})
    plt.title('Binary Heatmap of Peak Presence')
    plt.xlabel('Well Column')
    plt.ylabel('Well Row')
    plt.show()

# In[ ]:


def plot_peak_boxplot2(fm_array, dose_grid, n_rows = 2, n_cols = 3):
    '''
    Plots boxplots for the peak parameters (n_peaks, peak_params) based on dose groups from dose_grid.
    '''
    dose_labels = []
    n_peaks_list = []
    peak_freqs_list = []
    peak_amps_list = []
    peak_bws_list = []
    
    # Extract n_peaks and peak parameters arrays
    for i in range(n_rows):
        for j in range(n_cols):
            n_peaks = fm_array[i, j].n_peaks_
            if n_peaks > 0:
                peak_params = fm_array[i, j].peak_params_
                
                for _ in range(n_peaks):  # Handle multiple peaks per well
                    dose_labels.append(dose_grid[i, j])
                    n_peaks_list.append(n_peaks)
                    peak_freqs_list.append(peak_params[_, 0])  # Frequency
                    peak_amps_list.append(peak_params[_, 1])   # Amplitude
                    peak_bws_list.append(peak_params[_, 2])    # Bandwidth

    # Create a DataFrame
    df = pd.DataFrame({
        'Dose': dose_labels,
        'n_peaks': n_peaks_list,
        'Peak Frequencies': peak_freqs_list,
        'Peak Amplitudes': peak_amps_list,
        'Peak Bandwidths': peak_bws_list
    })

    # Plotting boxplots for each peak parameter
    plt.figure(figsize=(18, 10))

    # Plot n_peaks
    plt.subplot(1, 4, 1)
    sns.boxplot(x='Dose', y='n_peaks', data=df)
    plt.title('Number of Peaks by Dose')
    plt.xlabel('Dose')
    plt.ylabel('Number of Peaks')

    # Plot peak frequencies
    plt.subplot(1, 4, 2)
    sns.boxplot(x='Dose', y='Peak Frequencies', data=df)
    plt.title('Peak Frequencies by Dose')
    plt.xlabel('Dose')
    plt.ylabel('Frequency')

    # Plot peak amplitudes
    plt.subplot(1, 4, 3)
    sns.boxplot(x='Dose', y='Peak Amplitudes', data=df)
    plt.title('Peak Amplitudes by Dose')
    plt.xlabel('Dose')
    plt.ylabel('Amplitude')

    # Plot peak bandwidths
    plt.subplot(1, 4, 4)
    sns.boxplot(x='Dose', y='Peak Bandwidths', data=df)
    plt.title('Peak Bandwidths by Dose')
    plt.xlabel('Dose')
    plt.ylabel('Bandwidth')

    plt.tight_layout()
    plt.show()




