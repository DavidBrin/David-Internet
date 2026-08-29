/* David Brin
7/30/2021
Define and use of function with return value*/
#include <iostream>

using namespace std;

int createRandomFromChar(char inputChar);


int main()
{
    char inputChar1, inputChar2, inputChar3, inputChar4, inputChar5, play = 'y' ;
    cout << "This program plays a simple random number game." << endl;
    while (play == 'y' || play == 'Y'){
        cout << "Enter 5 vowel characters (a,e,i,o,u or A,E,I,O,U) separated by spaces: ";
        cin >> inputChar1 >> inputChar2 >> inputChar3 >> inputChar4 >> inputChar5;
        cout << endl << "The random numbers are " << createRandomFromChar(inputChar1);
        cout << " " << createRandomFromChar(inputChar2) << " " << createRandomFromChar(inputChar3) << " " << createRandomFromChar(inputChar4);
        cout << " " << createRandomFromChar(inputChar5);
        cout << endl << endl << "Do you want to play another game? (Y or y to continue): ";
        cin.ignore();
        cin.get(play);



    }
    cout << "Goodbye" << endl;
    return 0;
}

int createRandomFromChar(char inputChar) { //creates random numbers in a specific range for vowels
    if (inputChar == 'a' || inputChar == 'A'){
        return rand() % (20) + 1;
    }
    else if (inputChar == 'e' || inputChar == 'E'){
        return rand() % (20) + 21;
    }
    else if (inputChar == 'i' || inputChar == 'I'){
        return rand() % (20) + 41;
    }
    else if (inputChar == 'o' || inputChar == 'O'){
        return rand() % (20) + 61;
    }
    else if (inputChar == 'u' || inputChar == 'U'){
        return rand() % (20) + 81;
    }
    else {
        return 0;
    }

}
