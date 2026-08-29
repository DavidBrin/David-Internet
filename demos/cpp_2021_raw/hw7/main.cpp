/*David Brin
7/24/2021
Reading files*/

#include <iostream>
#include <climits>
#include <fstream>
#include <iomanip>

using namespace std;

void processFile(string fileName);
void displayResults(int smallest, int largest, double average, int belowAvgCount, int aboveAvgCount);

string fileName, line;
int smallest = INT_MAX, largest = INT_MIN, belowAvgCount, aboveAvgCount, currentNum, counter, sum;
double average;
ifstream infile;
int main()
{
    cout << "This program reads a file of numbers, then calculates and displays some statistics of numbers."<<  endl;
    cout << "Enter a file name: ";
    cin >> fileName;
    processFile(fileName);
    displayResults(smallest, largest, average, belowAvgCount, aboveAvgCount);


    return 0;
}

void processFile(string fileName){
    sum = 0;
    counter = 0;
    belowAvgCount = 0;
    aboveAvgCount = 0;
    infile.open(fileName);
    getline(infile, line); // read the first line of the file
    while (infile >> currentNum){
        if (currentNum < smallest){
            smallest = currentNum;
        }
        if (currentNum > largest){
            largest = currentNum;
        }
        sum += currentNum;
        counter ++;
    }
    infile.close();
    average = (double) sum / (double) counter;
    infile.open(fileName);
    getline(infile, line); // read the first line of the file
    while (infile >> currentNum){
        if (currentNum < average){
            belowAvgCount ++;
        }
        if (currentNum > average){
            aboveAvgCount ++;
        }
    }

}

void displayResults(int smallest, int largest, double average, int belowAvgCount, int aboveAvgCount) {
    if (counter != 0){
        cout << endl;
        cout << endl;
        cout << setw(25) << "Smallest" << setw(25) << smallest << endl;
        cout << setw(25) << "Largest" << setw(25) << largest << endl;
        cout << setw(25) << "Average" << setw(25) << average << endl;
        cout << endl;
        cout << setw(25) << "Numbers below the average" << setw(25) << belowAvgCount << endl;
        cout << setw(25) << "Numbers above the average" << setw(25) << aboveAvgCount << endl;
    }
    else {
        cout << "File does not contain any numbers";
    }
}

