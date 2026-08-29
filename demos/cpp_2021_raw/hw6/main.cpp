#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int divisor, range, current, sum, counter;
    cout << "This programs display all numbers divisible by a certain divisor starting from 10.\n";
    cout << "Enter a divisor from 2 to 10: ";
    cin >> divisor;
    while (!(2 < divisor && divisor < 10)){
        cout << "Input " << divisor << " is not in the range of 2 to 10\n";
        cout << "Enter a divisor from 2 to 10: ";
        cin >> divisor;
    }
    cout << "Enter the Largest number to be generated. It must be in the range of 10-500: ";
    cin >> range;
    while (!(10 < range && range < 500)){
        cout << "Input " << range << " is not in the range of 10 to 500\n";
        cout << "Enter the Largest number to be generated. It must be in the range of 10-500: ";
        cin >> range;
    }
    cout << "Generated numbers divisible by " << divisor << " from 10 to " << range << endl;
    sum = 0;
    while (current+divisor <= range) {
        current = 10 + (divisor * counter);
        cout << setw(8) << current;
        counter ++;
        sum = sum + current;
    }
    cout << endl;
    cout << "Total sum: " << setw(10) << sum << endl;
    cout << "Count:     " << setw(10) << counter << endl;
    cout << "Average:   " << setw(10) << sum/counter;
    return 0;
}
