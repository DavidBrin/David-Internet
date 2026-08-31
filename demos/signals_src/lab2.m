load echo_F23.mat
Fs = 22050;
%sound(y, Fs);

%% ---- next code cell ----

alpha = 0.9;
N = 5000;


h_echo = zeros(1, N+1)     % 0 vector
h_echo(1) = 1              % 1 at first position (n = 0)
h_echo(N+1) = alpha        % 1 at last position  (n = 5000)

%% ---- next code cell ----

stem(h_echo)
xlabel('n')
ylabel('h[n]')

%% ---- next code cell ----

d = zeros(1, 90001)
d(1) = 1

%% ---- next code cell ----

N = 5000;
alpha = 0.9;
b = 1;
a = [1, zeros(1, N-1), alpha]
h_removal = filter(b, a, d)
stem(h_removal);
xlabel('n');
ylabel('h[n]');
title('Impulse Response of the Echo Removal System');
grid on;

%% ---- next code cell ----

y_filt = filter(b, a, y)
sound(y_filt, Fs)

%% ---- next code cell ----

h_overall = conv(h_echo, h_removal)
plot(h_overall)
xlabel('n');
ylabel('h[n]');
title('Echo Removal System');
grid on;

%% ---- next code cell ----

y_test = conv(h_overall, y_filt)
sound(y_filt, Fs)
pause(length(y_filt)/Fs + 1);
sound(y_test, Fs)
figure;
subplot(2,1,1);
plot(y_filt);
title('Original filt');
xlabel('Samples');
ylabel('Amplitude');

subplot(2,1,2);
plot(y_test);
title('New Output');
xlabel('Samples');
ylabel('Amplitude');

%The sound was a little harder to hear but the plots show the signal is
%quite similar but now with an extra reverb after the signal, this part
%makes sense when looking at the "Echo Removal System" graph that shows
%another impulse at around n = 90000

%% ---- next code cell ----

Ryy = xcorr(y, y); 
n = -floor(length(Ryy)/2) : floor(length(Ryy)/2) ; % Time shifts
figure;
plot(n, Ryy);
xlabel('Lag (n)');
ylabel('Autocorrelation');
title('Autocorrelation of Echo Signal R_{yy}[n]');
grid on;

%% ---- next code cell ----

Rxx = xcorr(y_filt, y_filt);
figure;
plot(n, Rxx);
xlabel('Lag (n)');
ylabel('Autocorrelation');
title('Autocorrelation of Recovered Signal R_{xx}[n]');
grid on;