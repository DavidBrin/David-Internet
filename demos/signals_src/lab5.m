L = 1; 
g = 9.8;
num = 1;
den = [1 0 -g/L]

figure;
[p, z] = plotpz(num, den);
disp('Zeros:');
disp(z);
disp('Poles:');
disp(p)



%% ---- next code cell ----

k_values = linspace(0, 25, 11); % Range of k values
max_real = zeros(size(k_values));
max_imag = zeros(size(k_values));

for i = 1:length(k_values)
    k = k_values(i);
    den = [1 0 -(g-k)/L];
    poles = roots(den);
    
    max_real(i) = max(real(poles)); % Max real part
    max_imag(i) = max(abs(imag(poles))); % Max imaginary part
end

% Plot results
figure;
subplot(2,1,1);
plot(k_values, max_real, 'b-o');
xlabel('k values');
ylabel('Max Real Part of Poles');
title('Maximum Real Component');
grid on;

subplot(2,1,2);
plot(k_values, max_imag, 'r-o');
xlabel('k values');
ylabel('Max Imaginary Part of Poles');
title('Maximum Imaginary Component');
grid on;


%% ---- next code cell ----

figure;
for i = 1:4
    k = k_values(i);
    den = [1 0 -(g-k)/L];
    [p, z] = plotpz(1, den);
    hold on;

end
hold off;
figure;
for i = 5:length(k_values)
    k = k_values(i);
    den = [1 0 -(g-k)/L];
    [p, z] = plotpz(1, den);
    hold on;


end
hold off;

%% ---- next code cell ----



%% ---- next code cell ----

 %don't mind the variable names, I had to debug for a bit and left them
 %this way
L = 1;
g = 9.8;
t = linspace(0, 10, 100);

k_unstable = 10;  
k_stable = 25;  

alpha_unstable = sqrt((g-k_unstable)/L);
th1 = sinh(alpha_unstable * t) / alpha_unstable;

omega_stable = sqrt((k_stable-g)/L);
th2 = sin(omega_stable * t) / omega_stable;

figure;
plot(t, th1, 'r', 'LineWidth', 1.5); 
hold on;
plot(t, th2, 'b', 'LineWidth', 1.5);
xlabel('Time (s)');
ylabel('\theta(t)');
title('Impulse Response with Different Proportional Feedback Values');
legend({['\theta(t) for k = ', num2str(k_unstable), ], ...
        ['\theta(t) for k = ', num2str(k_stable), ]});
grid on;



%% ---- next code cell ----

L = 1;
g = 9.8;
omega0 = 4;
k2 = -2*omega0;
k1 = -L*omega0^2 - g;

num = 1;
den = [1 -k2 -(g+k1)/L];

figure;
[p, z] = plotpz(num, den);
title('Pole-Zero Plot for System with PD Feedback');
disp('Zeros:');
disp(z);
disp('Poles:');
disp(p);


%% ---- next code cell ----

L = 1;
g = 9.8;
omega0 = 4;
k2 = -2*omega0;
k1 = -L*omega0^2 - g;

t = linspace(0, 10, 100);
th3 = t.*exp(-omega0*t); 

figure;
plot(t, th3, 'b', 'LineWidth', 1.5);
xlabel('Time (s)');
ylabel('\theta(t)');
title('Impulse Response with PD Feedback');
grid on;


%% ---- next code cell ----


L = 1;
g = 9.8;
omega0 = 4;
k2 = -2*omega0;
k1 = -L*omega0^2 - g;


t = linspace(0, 10, 100);
dt = t(2) - t(1);

% Step input for half the time
x = [ones(1,50) zeros(1,50)];

% Initialize the output and state variables
th4 = zeros(size(t));
theta = 0;  % Initial angle
dtheta = 0; % Initial angular velocity

% Manually simulate the system using numerical integration
for i = 1:length(t)-1
    
    % d^2θ/dt^2 = (g+k1)/L * θ + k2 * dθ/dt + x(t)
    d2theta = (g+k1)/L * theta + k2 * dtheta + x(i);
    
    dtheta = dtheta + d2theta * dt;
    theta = theta + dtheta * dt;
    th4(i+1) = theta;
end


figure;
subplot(2,1,1);
plot(t, x, 'r', 'LineWidth', 1.5);
xlabel('Time (s)');
ylabel('x(t)');
title('Step Disturbance Input');
grid on;

subplot(2,1,2);
plot(t, th4, 'b', 'LineWidth', 1.5);
xlabel('Time (s)');
ylabel('\theta(t)');
title('System Response to Step Disturbance');
grid on;


%% ---- next code cell ----



%% ---- next code cell ----

%note: same method as last time, same system, different input

rng(0);

x = [randn(1,50) zeros(1,50)];


th5 = zeros(size(t));
theta = 0;  % Initial angle
dtheta = 0; % Initial angular velocity

% Manually simulate the system using numerical integration
for i = 1:length(t)-1
    % d^2θ/dt^2 = (g+k1)/L * θ + k2 * dθ/dt + x(t)
    d2theta = (g+k1)/L * theta + k2 * dtheta + x(i);
    dtheta = dtheta + d2theta * dt;
    theta = theta + dtheta * dt;
    th5(i+1) = theta;
end
figure;
subplot(2,1,1);
plot(t, x, 'r', 'LineWidth', 1.5);
xlabel('Time (s)');
ylabel('x(t)');
title('Random Disturbance Input');
grid on;

subplot(2,1,2);
plot(t, th5, 'b', 'LineWidth', 1.5);
xlabel('Time (s)');
ylabel('\theta(t)');
title('System Response to Random Disturbance');
grid on;


%% ---- next code cell ----


dth5 = zeros(size(t));
dth5(1) = 0; 
a_cart = zeros(size(t));
theta = 0; 
dtheta = 0; 

for i = 1:length(t)-1
    dth5(i) = dtheta;
    % a using PD feedback
    a_cart(i) = k1 * theta + k2 * dtheta;
    % d^2θ/dt^2 = (g+k1)/L * θ + k2 * dθ/dt + x(t)
    d2theta = (g+k1)/L * theta + k2 * dtheta + x(i);
    dtheta = dtheta + d2theta * dt;
    theta = theta + dtheta * dt;
    
    th5(i+1) = theta;
end


dth5(end) = dtheta;
a_cart(end) = k1 * theta + k2 * dtheta;

% force
m_cart = 1;
F_cart = m_cart * a_cart;

figure;
subplot(3,1,1);
plot(t, th5, 'b', 'LineWidth', 1.5);
xlabel('Time (s)');
ylabel('\theta(t)');
title('Stick Angle');
grid on;

subplot(3,1,2);
plot(t, a_cart, 'r', 'LineWidth', 1.5);
xlabel('Time (s)');
ylabel('a(t)');
title('Cart Acceleration');
grid on;

subplot(3,1,3);
plot(t, F_cart, 'g', 'LineWidth', 1.5);
xlabel('Time (s)');
ylabel('F(t)');
title('Force Applied to Cart (m=1kg)');
grid on;

%% ---- next code cell ----

0;
%---------------------------------------------------
%
%  function [h]=impulse(num,den,t)
%  
%  t   = row vector of time samples where impulse response is computed
%  num = numerator of rational system function  (row vector of high-order to 
%  low-order coefficients)
%  den = denominator of rational system function  (row vector of high-order to 
%  low-order coefficients)
%   
%  
%--------------------------------------------------


%% ---- next code cell ----

function [p,z]=plotpz(b,a)  

%---------------------------------------------------------------
% copyright 1996, 2001, by John Buck, Michael Daniel, and Andrew Singer.
% For use with the textbook "Computer Explorations in Signals and
% Systems using MATLAB", Prentice Hall, 1997, 2002.
%---------------------------------------------------------------

p=roots(a); % determine poles
z=roots(b); % determine zeros
p=p(:); % make into column vector
z=z(:); % make into column vector

% For plotting, determine maximum real part of all poles, zeros, and 1
MaxR= max(abs(real([p;  z; 1])));
%MaxR = 3;
% For plotting, determine maximum imaginary part of all poles, zeros, and j
MaxI= max(abs(imag([p; z; j])));
%MaxI = 4;
%MaxR= 
%MaxI= 
%why hold on

plot(1.25*[-MaxR MaxR],[0 0],'k')     % Plot the real axis
plot([0 0],1.25*[-MaxI MaxI],'k')     % Plot the imag axis
plot(real(z),imag(z),'ro')   % Plot zeros
plot(real(p),imag(p),'bx')   % Plot poles
xlabel('Re');
ylabel('Im');
%
box on
axis('square');                      % Make square aspect ratio
grid on
%hold off
end
