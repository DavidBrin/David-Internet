#include <iostream>
#include <ctime>
#include <iomanip>

using namespace std;

int main()
{
    double memory, quantity, iprice, tax, bill;
    char quality;
    cout << "Enter the memory size of the PC (8 or 16 gigabytes): ";
    cin >> memory;
    if (memory != 8 && memory != 16){
        cout << "Invalid memory size!";
        return 0;
    }
    cout << "Enter the quality of the PC";
    cout << "(N for New, R for Refurbished, or D for Dented): ";
    cin >> quality;
    if (quality != 'N' && quality != 'R' && quality != 'D'){
        cout << "Invalid PC quality!";
        return 0;
    }
    cout << "Enter PC quantity to buy: ";
    cin >> quantity;
    if (!(quantity >= 0)){
        cout << "Invalid PC quantity!";
        return 0;
    }
    if (memory = 8){
        if (quality = 'N'){
            iprice = 699.99;
        }
        else if (quality = 'R'){
            iprice = 579.99;
        }
        else if (quality = 'D'){
            iprice = 439.99;
        }
    }
    else if (memory = 16){
        if (quality = 'N'){
            iprice = 849.99;
        }
        else if (quality = 'R'){
            iprice = 729.99;
        }
        else if (quality = 'D'){
            iprice = 609.99;
        }
    }
    tax = .0925 * (quantity*iprice);
    bill = iprice * quantity + tax;
    cout << fixed << setprecision(2);
    cout << "The item price is $" << iprice * quantity << endl;
    cout << "The sale tax is   $" << tax << endl;
    cout << "The total bill is $" << bill;

}


