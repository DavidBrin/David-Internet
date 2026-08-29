/* My name is David Brin
this program calculates the volume and surface area of a rectangular prism.
7/1/21*/

#include <iostream>

using namespace std;

int main()
{
    double length;
    double height;
    double width;
    cout << "My name is David Brin" << endl;
    cout << "this program calculates the volume and surface area"<< endl;
    cout << "enter the length: " ;
    cin >> length;
    cout << endl << "enter the height: ";
    cin >> height;
    cout << endl << "enter the width: ";
    cin >> width;
    cout << "volume of the cuboid is: "<< length*width*height<< endl;
    cout << "surface area of the cuboid is: " << 2*length*width+2*length*height+2*width*height;
    return 0;
}
