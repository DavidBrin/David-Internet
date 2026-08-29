# Code scraped from PlateF/PlateF-D4.ipynb (40 MB notebook; outputs dropped)

# %% [cell 1]
'''
Description
Author: David Brin
Date created 10/28/24

This notebook uses "General_LFP_analysis_functions.py" for all imports and functions necessary for analysis. 
This notebook shows the raw and fitted power spectra from preprocessed LFP recordings, spatial spike activity along with active windows,
and the raw and fitted spectra of active windows, along with the distribution and variation of aperiodic and peak parameters. 
'''

# %% [cell 2]
%run "../General_LFP_analysis_functions.py"

# %% [cell 3]
lfp_data = load_lfp(r"C:\Users\david\Documents\Voytek Research\LFP_psych_proj\PlateF\d4\lfp_data.h5")
spike_times = load_spikes(r"C:\Users\david\Documents\Voytek Research\LFP_psych_proj\PlateF\d4\spike_data.mat")

# ## Full power spectra

# %% [cell 4]
 plot_all_pspectra(lfp_data)

# %% [cell 5]
fooof_all_pspectra(lfp_data, fs_ds = 100, fmode = "fixed")

# ## Spike Activity

# ### Spacial activity

# %% [cell 6]
spike_spacial_visualization(spike_times)

# %% [cell 7]
 spike_threshold_vis(spike_times)

# ### Temporal activity

# %% [cell 8]
find_and_plot_active_spike_windows(spike_times, 100, threshold = 100)

# %% [cell 9]
spike_times_by_well = spikes_by_well(spike_times)
binary_activity = plot_num_spikes_hist(spike_times_by_well, 100, num_windows = 6, threshold = 300) 
#plots histogram of windows above 50 spikes and creates binary_activity

# ## Windowed analysis

# %% [cell 10]
fooof_wind_thresh(binary_activity, lfp_data, 100, fmode = "fixed")

# %% [cell 11]
ndsp_wind_thresh(binary_activity, lfp_data, 100)

# ## Variation of FoooF Parameters

# %% [cell 12]
fm_array = set_fm_array(lfp_data, fmode = 'fixed')

# %% [cell 13]
param_heatmap(fm_array, fmode = "fixed")

# %% [cell 14]
dose_grid = np.array([
    ["Psilocybin-stim", "Psilocybin-stim", "LSD-stim", "LSD-stim", "Psilocin-stim", "Psilocin-stim", "Vehicle-stim", "Vehicle-stim"],
    ["Psilocybin-stim", "Psilocybin-stim", "LSD-stim", "LSD-stim", "Psilocin-stim", "Psilocin-stim", "Vehicle-stim", "Vehicle-stim"],
    ["Psilocybin-stim", "Psilocybin-stim", "LSD-stim", "LSD-stim", "Psilocin-stim", "Psilocin-stim", "Vehicle-stim", "Vehicle-stim"],
    ["Psilocybin", "Psilocybin", "LSD", "LSD", "Psilocin", "Psilocin", "Vehicle", "Vehicle"],
    ["Psilocybin-stim", "Psilocybin-stim", "LSD-stim", "LSD-stim", "Psilocin-stim", "Psilocin-stim", "Vehicle-stim", "Vehicle-stim"],
    ["Psilocybin", "Psilocybin", "LSD", "LSD", "Psilocin", "Psilocin", "Vehicle", "Vehicle"],
    ])

# %% [cell 15]
plot_variability(fm_array, dose_grid, fmode = "fixed")

# %% [cell 16]
# Remake Dose-grid for visibility:
dose_grid = np.array([
    ['Pbs', 'Pbs', "Ls", "Ls", "Ps", "Ps", "Vs", "Vs"],
    ['Pbs', 'Pbs', "Ls", "Ls", "Ps", "Ps", "Vs", "Vs"],
    ['Pbs', 'Pbs', "Ls", "Ls", "Ps", "Ps", "Vs", "Vs"],
    ['Pb', 'Pb', "L", "L", "P", "Ps", "V", "V"],
    ['Pbs', 'Pbs', "Ls", "Ls", "Ps", "Ps", "Vs", "Vs"],
    ['Pb', 'Pb', "L", "L", "P", "P", "V", "V"]])

# %% [cell 17]
plot_aperiodic_boxplot(fm_array,  dose_grid, fmode = "fixed")

# %% [cell 18]
 plot_peak_boxplot(fm_array)

# %% [cell 19]
plot_peak_binary_heatmap(fm_array)
