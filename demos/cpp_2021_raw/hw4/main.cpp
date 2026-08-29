/* David Brin
7/6/2021
using "cout", “cin”, variables, arithmetic operators, type casting, output formatting */

#include <iostream>
#include <cmath>
#include <iomanip>
using namespace std;

int main()
{

    int num1, num2;
    cout << "This program calculates quotient, remainder of 2 numbers" << endl;
    cout << "Enter two whole numbers separated by a space: ";
    cin >> num1 >> num2;
    cout << endl << "The quotient of integer division "<< "(" <<num1 <<"/"<<num2<<") is: " << num1/num2 << endl;
    cout << "the remainder of integer division " << "(" <<num1 <<"/"<<num2<<") is: " <<  num1%num2 << endl;
    cout << "the result of floating-point division " << "(" <<num1 <<"/"<<num2<<") is: " << fixed << setprecision (9) <<(double) num1/num2;

    return 0;
}
