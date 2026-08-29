#include <iostream>
#include <iomanip>
#include <fstream>
#include <cstring>
#include <cstring>

using namespace std;

ifstream infile;

int readNumbersAndTallyOccurrences(int occurrences[],int size, ifstream& infile);

void printCounts (int occurrences[],int size);

void findMostAndLeastOccurrence(int occurrences[],int size,int& highestCountIndex,int& lowestCountIndex);

int findTotalOccurrenceCount(int occurrences[],int size);





int main()
{
    string fileName;
    int inputMax ;

    cout << "This program reads a number file and display the number occurrence statistics." << endl;
    cout << "Enter an existing file name: ";
    cin >> fileName;
    /*if (!(fileName == numbers1.txt || fileName == numbers2.txt || fileName ==  numbers3.txt || fileName == numbers-large.txt || fileName == numbers-none.txt || fileName == numbers-nome2.txt)){
        cout << "File " << fileName << " not found";
        return 0;
    }*/
    infile.open(fileName);
    if (!(infile.good())){
        cout << "File " << fileName << " not found";
        return 0;
    }
    cout << "Enter the highest number to get occurrence count (must be > 1): ";
    cin >> inputMax;
    while (inputMax < 1){
        cout << "Number must not be less than 1!" << endl;
        cout << "Enter the highest number to get occurrence count (must be > 1): ";
        cin >> inputMax;
    }
    int occurrences[inputMax] = {0};
    int size = inputMax;
    int total = readNumbersAndTallyOccurrences(occurrences, inputMax, infile);
    if (!(total == 0)){
    printCounts(occurrences, inputMax);
    int highestCountIndex = 0, lowestCountIndex = 0;
    findMostAndLeastOccurrence(occurrences, inputMax, highestCountIndex, lowestCountIndex);
    cout << "There are " << total << " numbers in the file.\n";
    cout << "The total of occurrence counts for numbers in the range [1, " << inputMax << "] is " << findTotalOccurrenceCount(occurrences, inputMax) << endl;
    cout << "The number " << highestCountIndex << " has the highest occurrence" << endl;
    cout << "The number "<< lowestCountIndex<< " has the lowest occurrence" << endl;
    }
    else{
        cout << "File does not have any numbers";
    }
    return 0;
}


int readNumbersAndTallyOccurrences(int occurrences[],int size, ifstream& infile){/*
Function to read all the numbers in the input file using a loop
It keeps track of the occurrence of each number if it is < or equal to size in the array parameter
Code reads but do no process numbers that are greater than the size. For example, if user enters 20 as the maxInput, the code reads but does not use numbers that are > 20.
Function does not print anything (main function and printCounts function does the printing)
Function returns the count of all numbers in the file.
*/
    string line;
    getline(infile, line);
    int currentNum = 0, counter = 0;
    while (infile >> currentNum){
        if (currentNum <= size){
            occurrences[currentNum - 1]++;
        }
        counter ++;
    }
    return counter;
 }

void printCounts (int occurrences[], int size){
    cout << setw(10) << "Number" << setw(20) << "Occurrences" << endl;
    for (int counter = 0; counter < size; counter++){
        cout << setw(10) <<  counter + 1 << setw(20) << occurrences[counter] << endl;
    }

}

void findMostAndLeastOccurrence(int occurrences[], int size, int& highestCountIndex, int& lowestCountIndex){
    int current1 = 0, current2 = 99999999;
    for (int ind = 0; ind < size; ind++){
        if (occurrences[ind] > current1){
            current1 = occurrences[ind];
            highestCountIndex = ind + 1;
        }
        if (occurrences[ind] < current2){
            current2 = occurrences[ind];
            lowestCountIndex = ind + 1;
    }
    }
}

int findTotalOccurrenceCount(int occurrences[], int size){
    int total = 0;
    for (int ind = 0; ind < size; ind ++){
            total += occurrences[ind];
    }
    return total;
}
