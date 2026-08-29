/*David Brin
7/5/2021
formating strings*/

#include <iostream>
#include <iomanip>
#include <string>

using namespace std;

int main()
{
    cout << "My name is David Brin" << endl;
    string day, month, year;
    cout << "Enter a day number, month number then year separated by spaces: ";
    cin >> day >> month >> year;
    string dateString = "the formatted date is '"+year+"/"+month+"/"+day+"'.";
    cout <<  dateString<< endl;
    cout << "the total length of output text is " <<dateString.length();
    return 0;
}
