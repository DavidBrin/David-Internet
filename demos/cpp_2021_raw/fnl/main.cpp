#include <iostream>
#include <cstring>
#include <iomanip>
#include <cmath>
#include <vector>

using namespace std;

int getDigitCount(string& str, int digit);

double add(double num1, double num2, double num3 = 0, double num4 = 0);

double raisePowerAndSum(double arr[], int power, int SIZE);

int main()  {
  string name;
    cout << "Enter a name: ";
    getline(cin, name);
    int len = name.length();
    if (!(len == 0)){
	cout << name[len - 1];
   }
}

double add(double num1, double num2, double num3, double num4){
    return num1 + num2 + num3 + num4;
}

int getDigitCount(string& str, int digit){
    int num = 0;
    for (int ind = 0; ind < 10; ind++){
        if (digit ==  str[ind]){
            num++;
        }
    }
    return num;
}


double raisePowerAndSum(double arr[], int power, int SIZE){
    		double total = 0;
    		for (int ind = 0; ind < SIZE; ind++){
           		arr[ind] = pow(arr[ind],power);
            		total += arr[ind];
    	}
    	return total;
	}
