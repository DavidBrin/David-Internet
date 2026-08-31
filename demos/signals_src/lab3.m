load Lab3_F23.mat
imshow(tumbller_F23)

%% ---- next code cell ----

colormap(map)

%% ---- next code cell ----

size(tumbller_F23)

%% ---- next code cell ----

 % Load blurred image
for N_test = [1, 3, 8, 1000]  % Try different N values
    X_restored = deblur(tumbller_F23, N_test);
    figure, imshow(X_restored), title(['Deblurred with N = ', num2str(N_test)]);
end
for N_test = [375, 450, 550]  % Try different N values
    X_restored = deblur(tumbller_F23, N_test);
    figure, imshow(X_restored), title(['Deblurred with N = ', num2str(N_test)]);
end

%% ---- next code cell ----


    N = 3;
    figure;
    % Create the blur filter (impulse response)
    h = ones(1, N) / N;  
    
    % Apply convolution to blur the image
    blurred_image = conv2(tumbller_F23, h, 'same');
    
    imshow(blurred_image, []);
    colormap(map);
    title(['Blurred Image with N = ', num2str(N)]);
    N = 8;
    figure;
    % Create the blur filter (impulse response)
    h = ones(1, N) / N;  
    
    % Apply convolution to blur the image
    blurred_image = conv2(tumbller_F23, h, 'same');
    
    % Display the blurred images
    
    imshow(blurred_image, []);
    colormap(map);
    title(['Blurred Image with N = ', num2str(N)]);

%% ---- next code cell ----

% Define blur filter lengths
N_values = [3, 8];

% Frequency response analysis
figure;
for i = 1:length(N_values)
    N = N_values(i);
    
    % Create the impulse response of the blur filter
    h = ones(1, N) / N;
    
    % Compute frequency response
    [H, w] = freqz(h, 1, 1024, 'whole'); 
    
    % Plot magnitude response (linear scale)
    subplot(2,2,2*i-1);
    plot(w, abs(H));
    title(['Magnitude Response (Linear) for N = ', num2str(N)]);
    xlabel('Frequency (rad/sample)');
    ylabel('|H(e^{j\omega})|');
    grid on;
    
    % Plot magnitude response (dB scale)
    subplot(2,2,2*i);
    plot(w, 20*log10(abs(H)));  
    title(['Magnitude Response (dB) for N = ', num2str(N)]);
    xlabel('Frequency (rad/sample)');
    ylabel('Magnitude (dB)');
    grid on;
end


%% ---- next code cell ----

% Define frequency range
w = linspace(0, 2*pi, 1024); 

% Compute frequency responses
H2=  1 ./ (1 - 0.8 * exp(-1j*w));  
H1 = 1 ./ (1 + 0.8 * exp(-1j*w));  

% Plot magnitude responses
figure;
subplot(2,1,1);
plot(w, abs(H1), 'b', 'LineWidth', 1.5);
title('Magnitude Response of System 1');
xlabel('Frequency (rad/sample)');
ylabel('|H(e^{j\omega})|');
grid on;

subplot(2,1,2);
plot(w, abs(H2), 'r', 'LineWidth', 1.5);
title('Magnitude Response of System 2');
xlabel('Frequency (rad/sample)');
ylabel('|H(e^{j\omega})|');
grid on;


%% ---- next code cell ----

% System 1 coefficients
b1 = [1];  
a1 = [1, -0.8];

% System 2 coefficients
b2 = [1];  
a2 = [1, 0.8];


%% ---- next code cell ----

% Define frequency range
N = 1024;  % Number of points
[H1, w] = freqz(b1, a1, N, 'whole');  % System 1
[H2, ~] = freqz(b2, a2, N, 'whole');  % System 2

% Convert to dB scale
H1_dB = 20 * log10(abs(H1));
H2_dB = 20 * log10(abs(H2));

% Plot magnitude response in dB
figure;
subplot(2,1,1);
plot(w, H1_dB, 'b', 'LineWidth', 1.5);
title('Magnitude Response of System 1 Low pass Filter');
xlabel('Frequency (rad/sample)');
ylabel('Magnitude (dB)');
grid on;

subplot(2,1,2);
plot(w, H2_dB, 'r', 'LineWidth', 1.5);
title('Magnitude Response of System 2 High Pass');
xlabel('Frequency (rad/sample)');
ylabel('Magnitude (dB)');
grid on;
%type designated in plot titles (the w is plotted different so it looks
%like a notch and bandpass

%% ---- next code cell ----



%% ---- next code cell ----

N = 20;
a_x = zeros(1, N);
a_x([2, end]) = -4/5; % k = ±1
a_x([10, end-8]) = 2/5; % k = ±9

k = -floor(N/2):floor(N/2)-1;
figure;
stem(k, abs(a_x));
xlabel('Frequency Index k'); ylabel('|a_x|');
title('DTFS Coefficients of x[n]');

%% ---- next code cell ----



%% ---- next code cell ----

H1_k = 1 ./ (1 - 0.8*exp(-1j*2*pi*k/N));
H2_k = 1 ./ (1 + 0.8*exp(-1j*2*pi*k/N));

a_y1 = H1_k .* a_x;
a_y2 = H2_k .* a_x;

figure;
subplot(2,1,1);
stem(k, abs(a_y1));
title('Magnitude of Output DTFS Coefficients for System 1');
xlabel('Frequency Index k'); ylabel('|a_{y1}|');

subplot(2,1,2);
stem(k, abs(a_y2));
title('Magnitude of Output DTFS Coefficients for System 2');
xlabel('Frequency Index k'); ylabel('|a_{y2}|');

%% ---- next code cell ----

x_20 = ifft(a_x, 'symmetric');
x = repmat(x_20, 1, 6);
n = 0:length(x)-1;

figure;
stem(n, x);
title('Signal x[n] over 6 periods');
xlabel('n'); ylabel('x[n]');


%% ---- next code cell ----

 y1 = filter(b1, a1, x);
y2 = filter(b2, a2, x);

figure;
subplot(2,1,1);
stem(n, y1);
title('Output y1[n] of System 1');
xlabel('n'); ylabel('y1[n]');

subplot(2,1,2);
stem(n, y2);
title('Output y2[n] of System 2');
xlabel('n'); ylabel('y2[n]');


%% ---- next code cell ----

y1_20 = y1(1:N);
y2_20 = y2(1:N);

a_y1 = fft(y1_20) / N;
a_y2 = fft(y2_20) / N;

figure;
subplot(2,1,1);
stem(k, abs(a_y1));
title('Magnitude of DTFS Coefficients for y1');

subplot(2,1,2);
stem(k, abs(a_y2));
title('Magnitude of DTFS Coefficients for y2');

%% ---- next code cell ----

function N = deblur(Y,X)

L = size(Y, 2); %cols
h = ones(1, X) / X;
H = toeplitz([h, zeros(1, L-X)]);
N = Y * pinv(H');
end