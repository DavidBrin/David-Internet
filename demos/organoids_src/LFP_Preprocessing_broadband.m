% Define the directory to save HDF5 files
output_directory = "C:\Users\david\Documents\Voytek Research\LFP_psych_proj\PlateB\Oct21-24"
raw_data_dir = "C:\Users\david\Documents\Voytek Research\LFP_psych_proj\PlateB\Oct21-24\PlateB_20241021_d60ish_LFP_10min(000)_BroadbandProcessor.raw";

% Create the directory if it doesn't exist
if ~isfolder(output_directory)
    mkdir(output_directory);
end

% Load the raw voltage data
all_data = AxisFile(raw_data_dir).RawVoltageData;
broadband = all_data(1, 2); %downsampled (lfp)
disp(broadband)
lfp_data = broadband.LoadData;

% Get the size of the LFP data
sizes = size(lfp_data);
lfp_rows = sizes(1);
lfp_cols = sizes(2);

% Initialize a 3D array to store data for all wells
time_points = length(lfp_data{1, 1}.Data);  % Assuming the time dimension is the same across all wells
combined_data = zeros(lfp_rows, lfp_cols, time_points);

% Loop through each well
for i = 1:lfp_rows
    for j = 1:lfp_cols
        % Extract the data for the current well
        current_well_data = lfp_data(i, j);
        
        % Check if the current_well_data is empty
        if isempty(current_well_data)
            disp(['No data for well ' char('A' + i - 1) num2str(j)]);
            continue;
        end
        
        % Extract the electrode data
        numeric_data = double(current_well_data{1, 1}.Data);  % Assuming you want to use the first electrode
        combined_data(i, j, :) = numeric_data;  % Store it in the 3D array

        %plot each
        %figure;
        %plot(numeric_data);
        %title(sprintf('Recording from Well %s%d', char('A' + i - 1), j));
        %xlabel('Time (samples)');
        %ylabel('Voltage (µV)');
        %grid on; % Add grid lines
    end
end


% Save the 3D array to a single HDF5 file
filename = fullfile(output_directory, 'lfp_data.h5');
if exist(filename, 'file')
    delete(filename); % Delete the existing file to avoid conflicts
end

h5create(filename, '/all_wells_data', size(combined_data), 'Datatype', 'double');
h5write(filename, '/all_wells_data', combined_data);

disp('Data saved successfully.');
