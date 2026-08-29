/* David Brin
8/1/2021
Arrays and function */

#include <iostream>
#include <cstring>
#include <iomanip>

using namespace std;

const char UPPER_VOWELS [] = "AEIOU";  // upper-case vowels
const char LOWER_VOWELS [] = "aeiou";  // lower-case vowels

int isVowel(char charInput);

int main()
{
    char characters[300];
    int current;
    cout << "This program counts the vowel occurrences in input phrase\n" << endl;
    cout << "Enter a phrase and hit Enter (maximum length 299): ";
    cin.getline(characters, 299);
    while (!(strlen(characters) == 0)){
        int counter[5] = { 0, 0, 0, 0, 0 };
        for (int ind = 0; ind < strlen(characters); ind++){
            current = isVowel(characters[ind]);
            counter[current] ++;
        }
        cout << "Vowel" << setw(20) << "Count\n";
        cout << "a - A" << setw(20) << counter[0] << endl;
        cout << "e - E" << setw(20) << counter[1] << endl;
        cout << "i - I" << setw(20) << counter[2] << endl;
        cout << "o - O" << setw(20) << counter[3] << endl;
        cout << "u - U" << setw(20) << counter[4] << endl;
        cout << endl << "Total of vowels is ";
        cout << counter[0] + counter[1] + counter[2] + counter[3] + counter[4];
        int occurrence = 0, last = 0;
        for (int ind = 0; ind < 5; ind ++){
            if (last < counter[ind]){
                last = counter[ind];
                occurrence = ind;
            }
        }
        cout << endl << "Vowel with highest occurrence is ";
        cout << UPPER_VOWELS[occurrence] << endl;
        cout << "Enter a phrase and hit Enter (maximum length 299): ";
        cin.getline(characters, 299);
    }
    return 0;
}

 int isVowel(char charInput){//Function takes a character c and returns an index number if c is a vowel
    for (int ind = 0; ind < 5; ind ++){
        if (UPPER_VOWELS[ind] == charInput){
            return ind;
        }
        if (LOWER_VOWELS[ind] == charInput){
            return ind;
        }
    }
    return -1;
 }

