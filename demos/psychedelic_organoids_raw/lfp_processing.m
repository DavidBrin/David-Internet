% Define the directory to save HDF5 files
output_directory = '/Users/blancamartin/Desktop/LFP_org_psychedelics/Extracted_DataSpikes/';
raw_data_dir = '/Users/blancamartin/Desktop/LFP_org_psychedelics/2024-03-20_LFP_10min_no_stim_during_recording_was_stim_previously/118-5923/5MeOtreated-CheRiff-20032024-10minLFP(000)_BroadbandProcessor.raw';
% Create the directory if it doesn't exist
if ~isfolder(output_directory)
    mkdir(output_directory);
end
all_data = AxisFile(raw_data_dir).RawVoltageData;
broadband = all_data(1,1);
lfp_data = broadband.LoadData;
sizes = size(lfp_data);
lfp_rows = sizes(1);
lfp_cols = sizes(2);
% Loop through each well
for i = 1:lfp_rows
    for j = 1:lfp_cols
        % Generate the filename based on the well position
        filename = fullfile(output_directory, sprintf('lfp_well%s%d.h5', char('A' + i - 1), j));
        
        % Extract the data for the current well
        current_well_data = lfp_data(i, j, :,:);
        
        % Check if the current_well_data is empty
        if isempty(current_well_data)
            disp(['No data for well ' char('A' + i - 1) num2str(j)]);
            continue;
        end
        
        % Preallocate a cell array to store the extracted data for each electrode
        electrode_data = cell(4, 4);
        
        % Loop through each electrode in the 4x4 grid
        for k = 1:4
            for l = 1:4
                % Access the data for the current electrode
                data_pre = current_well_data(1,1,k,l);
                electrode_data{k, l} = data_pre{1}.Data;
            end
        end
        
        % Concatenate voltage data from each electrode into a single array
        all_electrode_data = cell2mat(electrode_data(:));
        
        % Save the extracted data as an array in an HDF5 file
        if exist(filename, 'file')
            h5write(filename, '/electrode_data', all_electrode_data);
        else
            h5create(filename, '/electrode_data', size(all_electrode_data), 'Datatype', 'double');
            h5write(filename, '/electrode_data', all_electrode_data);
        end
    end
end

