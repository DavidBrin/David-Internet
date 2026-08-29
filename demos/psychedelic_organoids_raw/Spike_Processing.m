filename = "C:\Users\david\Documents\Voytek Research\LFP_psych_proj\PlateF\d60\PlateF_20241116_d60_LFP_10min(000)_NeuralEventDetector.spk"; %formerly data directory
output_directory = "C:\Users\david\Documents\Voytek Research\LFP_psych_proj\PlateF\d60\";
% Get a list of all .spk files in the data directory
%spk_files = dir(fullfile(data_directory, '*.spk'));

% Loop through each .spk file   edit: going one at a time for saving and
% naming purposes
%for file_index = 1:length(spk_files)
    % Load the .spk file
 %   filename = fullfile(data_directory, spk_files(file_index).name);
    disp(fileparts(filename))
    Data = AxisFile(filename).SpikeData.LoadData;
    
    % Initialize cell arrays to store spike times and spike waveforms
    sizes = size(Data)
    rows = sizes(1);
    cols = sizes(2);
    elec_rows = sizes(3);
    elec_cols = sizes(4);
    spike_times = cell(rows, cols, elec_rows, elec_cols);
    spike_waveforms = cell(rows, cols, elec_rows, elec_cols);
    %spike_times = cell(6, 8, 4, 4);
    %spike_waveforms = cell(6, 8, 4, 4);
    % Loop through each well and electrode
    for row = 1:rows
        for col = 1:cols
            for i = 1:elec_rows
                for j = 1:elec_cols
                    % Check if the electrode has data
                    if ~isempty(Data{row, col, i, j})
                        % Load spike times
                        spike_times{row, col, i, j} = [Data{row, col, i, j}(:).Start];
                        % Load spike waveforms (assuming there is at least one spike)
                        if ~isempty(Data{row, col, i, j}(1))
                            % Load spike waveforms (loop through all spikes)
                            num_spikes = length(Data{row, col, i, j});
                            spike_waveforms{row, col, i, j} = cell(1, num_spikes);
                            for spike_index = 1:num_spikes
                                spike_waveforms{row, col, i, j}{spike_index} = Data{row, col, i, j}(spike_index).GetVoltageVector;
                            end
                        else
                            spike_waveforms{row, col, i, j} = [];
                        end
                    else
                        spike_times{row, col, i, j} = [];
                        spike_waveforms{row, col, i, j} = [];
                    end
                end
            end
        end
    end
    
    % Form the output filename
    [~, base_filename, ~] = fileparts(filename);
    %output_filename = fullfile(output_directory, [base_filename,
    %%'_spike_data.mat']);   % causes error in save, not a text scalar
    output_filename = fullfile(output_directory,  'spike_data.mat');   %  change filename in folder once saved
    
    % Display the output filename for debugging
    disp(['Saving to: ', output_filename]);
    
    % Ensure output_filename is a valid string
    if ischar(output_filename) || isstring(output_filename)
        save(output_filename, 'spike_times', 'spike_waveforms', 'filename');
    else
        error('Output filename is not a valid string.');
    end

