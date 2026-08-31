load 'Lab_1_F23.mat'

%% ---- next code cell ----

display(length(X))
display(Fs);

%% ---- next code cell ----

 mW = real(X);
 pW = imag(X);
 W = mW.*exp(1j*pW)
 Z = [real(W); imag(W)]
 N = length(Z);
 
 rng(2023);
 perm = randperm(N);
 invPerm(perm) = 1:length(perm)
Z_flat = Z(:); % Flatten Z into a 1D array
Y = Z_flat(invPerm)
sizeY = length(Y)

%% ---- next code cell ----

 %sound(Y, Fs)
 %no

%% ---- next code cell ----

M = flipud(Y);
sound(M, Fs); 

%% ---- next code cell ----

t = (0:sizeY -1)/Fs;
figure;
plot(t, Y, 'r');
xlabel("Time (seconds)");
ylabel("Amplitude");
title("Audio Y vs Time");

figure;
plot(t, M, "b");
xlabel('time (secs)');
ylabel("Amplitude");
title("Audio M vs Time");

%% ---- next code cell ----

 %sound(M, Fs/2)

%% ---- next code cell ----

%sound(M, Fs*2)

%% ---- next code cell ----


%function decimate(inputVector)
% outputVector = inputVector(1:2:end);
%end

%% ---- next code cell ----

% function interpolate(inputVector)

% function outputVector = interpolate(inputVector)
% shiftVector = inputVector(2:end);

% interpolatedValues = (inputVector(1:end-1) + shiftVector) / 2;

% outputVector = reshape([inputVector(1:end-1); interpolatedValues], 1, []);
% outputVector = [outputVector, inputVector(end)];

% end


%% ---- next code cell ----

x= [7 6 5 4 3 2 1 2 3 4 5 6 7]
decx = decimate(x)
interx = interpolate(x)
y=[8 7 6 5 4 3 2 1 2 3 4 5 6 7 8]
decy = decimate(y)
intery = interpolate(y)
x = decimate(x)
x = interpolate(x)
x = interpolate(x)
x = decimate(x)
y = decimate(y)
y = interpolate(y)
y= interpolate(y)
y = decimate(y)

%decimate halves(+1) the size while interpolate doubles(-1)
%the order of operation affects the result by changing the values that go
%into the next function.
% the interpolate function preserve original values so can uphold the same
% values if interpolate then decimate but the operations commute only if
% the signal is structured so that interpolation perfectly reconstructs 
% missing values


%% ---- next code cell ----

n = 0:199;                     
theta = (2*pi/200) * n    


z = exp(1i * theta) .* cos(4 * theta);

% Plot
figure
plot(real(z), imag(z), 'b', 'LineWidth', 2)
axis equal;
xlabel('Re(z)');
ylabel('Im(z)');
title('8-Leaf Rose in the Complex Plane');
grid on;


%% ---- next code cell ----

%same equation
n = 0:199;                     
theta = (2*pi/200) * n;    
z = exp(1i * theta) .* cos(4 * theta);

% Init
figure;
hold on;
axis equal;
xlabel('Re(z)');
ylabel('Im(z)');
title('Tracing the 8-Leaf Rose in the Complex Plane');
grid on;


xlim([-1, 1]);
ylim([-1, 1]);

% Animate the points one at a time
for k = 1:length(z)
    plot(real(z(k)), imag(z(k)), 'bo', 'MarkerFaceColor', 'b');
    pause(0.05);  % Pause for animation
end
hold off;

%% ---- next code cell ----


n = 0:199;                     
theta = (4*pi/200) * n;    

%z = exp(1i * theta) .* cos(3 * theta); 
z = exp(1i * theta) .* sin(3/2 * theta);
%z = exp(1i * theta) .* cos(3/2 * theta); 
% Initialize figure
figure;
hold on;
axis equal;
xlabel('Re(z)');
ylabel('Im(z)');
title('Tracing the 6-Leaf Rose in the Complex Plane');
grid on;

xlim([-1, 1]);
ylim([-1, 1]);

% Animate the points one at a time
for k = 1:length(z)
    plot(real(z(k)), imag(z(k)), 'bo', 'MarkerFaceColor', 'b');
    pause(0.05);  % Pause for animation
end
hold off;


%% ---- next code cell ----

0;

%% ---- next code cell ----

function outputVector = decimate(inputVector)
 outputVector = inputVector(1:2:end);
end


function outputVector = interpolate(inputVector)
 shiftVector = inputVector(2:end);

 interpolatedValues = (inputVector(1:end-1) + shiftVector) / 2;

 outputVector = reshape([inputVector(1:end-1); interpolatedValues], 1, []);
 outputVector = [outputVector, inputVector(end)];

end