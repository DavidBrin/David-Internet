/* David Brin
8/1/2021
Calculating area of rectangle with function*/

#include <iostream>

using namespace std;

bool rectangleAreaPerim (double width, double height, double& area, double& perimeter);

int main()
{
    cout << "This program calculates area and perimeter or rectangle." << endl;
    double width, height, area, perimeter;
    while (!(width == 0 && height == 0)){
        cout << "Enter width and height separated by spaces, or enter 0 0 to stop: ";
        cin >> width >> height;
        bool success = rectangleAreaPerim(width, height, area, perimeter);
        if ((width == 0 && height == 0)){
            cout << "Goodbye";
        }
        else if (success){
            cout << "Rectangle Area is " << area << "\nRectangle Perimeter is " << perimeter;
            cout << endl;
        }
        else {
        cout << "Invalid input\n";
        }
    }
    return 0;
}

bool rectangleAreaPerim (double width, double height, double& area, double& perimeter){ //calculates area and perimeter and returns bool value.
    if (width >= 0 && height >= 0){
        area = width * height;
        perimeter = (2 * width) + (2 * height);
        return true;
    }
    else {
        return false;
    }
}
