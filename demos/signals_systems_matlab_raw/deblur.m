function N = deblur(Y,X)
%UNTITLED Summary of this function goes here
%   Detailed explanation goes here
L = size(Y, 2); %cols
h = ones(1, X) / X;
H = toeplitz([h, zeros(1, L-X)]);
N = Y * pinv(H');
end