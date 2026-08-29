/* David Brin
 6/29/2021
cout with strings and arithmetic*/

#include <iostream>\
#include <string>

using namespace std;

int main()
{

    cout << "Hello, my name is David Brin" << endl;
    cout << "Today is June 29, 2021" << endl;
    cout << " 6565 + 1341 = " <<  6565 + 1341 << endl;
    cout << " 6565 - 1341 is " <<  6565 - 1341  << endl;
    cout << "865 * 32 is " << 865 * 32 << endl;
    cout << " 8756 / 129 = " << 8756 / 129 << endl;
    cout << " 8756 / 129.0 = " << 8756 / 129.0 << endl;
    string firstName, lastName;
    firstName= "david";
    lastName = "brin";
    cout << firstName << " " << lastName << endl;

    const double pi = 3.1415;
    double radius = 4;
    double circumference = 2*pi*radius;
    double area = pi*radius*radius;

    cout <<"circumference is " << circumference << endl;
    cout << "area is " << area << endl;

    int num;
    cin >>num;
    cout << num*2;

    return 0;

}
