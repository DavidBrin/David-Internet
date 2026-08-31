 % Define the sampling frequency
T = 1/8192;
fs = 2*pi/T; % rad/sec
n = 0:8191;
t = n*T;


w0 = 2*pi*1000;
x = sin(w0*t);







%% ---- next code cell ----


figure;
subplot(2,1,1);
stem(n(1:50), x(1:50));
title('First 50 samples of x[n] vs n');
xlabel('n');
ylabel('x[n]');

subplot(2,1,2);
plot(t(1:50), x(1:50));
title('First 50 samples of x[n] vs sampling times');
xlabel('t');
ylabel('x(t)');

%% ---- next code cell ----

%function [X,f] = ctfts(x,T)
% CTFTS calculates the CTFT of a periodic signal x(t) which is reconstructed
% from the samples in the vector x using ideal bandlimited interpolation.
% the vector x contains samples x(t) over an integer number of periods, and
% T contains the sampling period. 
% 
% The vector X contains the area of the impulses at frequency values stored
% in the vector f.
%
% This function makes use of the relationship between the CTFT  of x(t) and
% the DTFT of its samples x[n], as well as the relationship between the
% DTFT of the samples x[n] and the DTFS of x[n].
% N=length(x);
% X=fftshift(fft(x,N))*(2*pi/N);
% f=linspace(-1,1-1/N,N)/(2*T);
%end

%% ---- next code cell ----

% Task 3: Calculate CTFT of reconstructed signal
[X, f] = ctfts(x, T);

figure;
subplot(2,1,1);
plot(f, abs(X));
title('Magnitude of CTFT X(jω)');
xlabel('Frequency (rad/sec)');
ylabel('|X(jω)|');

subplot(2,1,2);
plot(f, angle(X));
title('Phase of CTFT X(jω)');
xlabel('Frequency (rad/sec)');
ylabel('∠X(jω)');


%% ---- next code cell ----

% Task 4: Repeat for other frequencies
frequencies = [2*pi*1500, 2*pi*2000, pi];

for i = 1:length(frequencies)
    w0 = frequencies(i);
    x = sin(w0*t);
    
    % Calculate CTFT
    [X, f] = ctfts(x, T);
    
    figure;
    subplot(2,1,1);
    plot(f, abs(X));
    title(['Magnitude of CTFT for ω₀ = ' num2str(w0) ' rad/sec']);
    xlabel('Frequency (rad/sec)');
    ylabel('|X(jω)|');
    
    subplot(2,1,2);
    plot(f, angle(X));
    title(['Phase of CTFT for ω₀ = ' num2str(w0) ' rad/sec']);
    xlabel('Frequency (rad/sec)');
    ylabel('∠X(jω)');
    
    % Play the sound
    sound(x, 1/T);
    pause(2); % Pause to hear each sound
end


%% ---- next code cell ----

 

%% ---- next code cell ----

frequencies = [2*pi*3500, 2*pi*4000, 2*pi*4500,2*pi*5000, 2*pi*5500];

for i = 1:length(frequencies)
    w0 = frequencies(i);
    x = sin(w0*t);
    
    % Calculate CTFT
    [X, f] = ctfts(x, T);
    
    figure;
    subplot(2,1,1);
    plot(f, abs(X));
    title(['Magnitude of CTFT for ω₀ = ' num2str(w0) ' rad/sec']);
    xlabel('Frequency (rad/sec)');
    ylabel('|X(jω)|');
    
    subplot(2,1,2);
    plot(f, angle(X));
    title(['Phase of CTFT for ω₀ = ' num2str(w0) ' rad/sec']);
    xlabel('Frequency (rad/sec)');
    ylabel('∠X(jω)');
    
    % Play the sound
    sound(x, 1/T);
    pause(2); % Pause to hear each sound
end

%% ---- next code cell ----


fs = 2*pi* 8192; 
T = 1/8192;
n = 0:8191;
t = n*T;
a = 2*pi*(8192);
b = 2000;
x1 = sin(a*t + b*t.^2);

%% ---- next code cell ----


sound(x1, 1/T);
pause(5)

%% ---- next code cell ----


n10 = 0:81919;
t10 = n10*T;
x10 = sin(a*t10 + b*t10.^2);
sound(x10, 1/T);
pause(10)

%% ---- next code cell ----


n20 = 0:163839;
t20 = n20*T;
x20 = cos(a*t20 + b*t20.^2);
sound(x20, 1/T);


%% ---- next code cell ----

function [X,f] = ctfts(x,T)
% CTFTS calculates the CTFT of a periodic signal x(t) which is reconstructed
% from the samples in the vector x using ideal bandlimited interpolation.
% the vector x contains samples x(t) over an integer number of periods, and
% T contains the sampling period. 
% 
% The vector X contains the area of the impulses at frequency values stored
% in the vector f.
%
% This function makes use of the relationship between the CTFT  of x(t) and
% the DTFT of its samples x[n], as well as the relationship between the
% DTFT of the samples x[n] and the DTFS of x[n].
N=length(x);
X=fftshift(fft(x,N))*(2*pi/N);
f=linspace(-1,1-1/N,N)/(2*T);
end