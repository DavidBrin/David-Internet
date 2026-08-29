/*David Brin
7/14/2021
random numbers*/

#include <iostream>
#include <cstdlib>
#include <ctime>


using namespace std;

int main()
{


    int n, secret, counter;
    unsigned seed = time(0);
    srand(seed);
    secret = (rand() % (8 - 1 + 1)) + 1;
    counter = 0;
    cout << "Welcome to the number guessing game." << endl;
    cout << "You have at most 3 chances to guess a secret number from 1 to 8."<<endl;
    cout << endl << "Enter a number from 1 to 8: ";
    cin >> n;
    if (n == secret){
        cout << "Correct guess. Congratulations!";
        return 0;
    }
    else if ((n < secret) && (counter < 2)){
        cout << "Not correct, your guess is too low, try again: ";
        cin >> n;
        counter ++;
    }
    else if ((n > secret) && (counter < 2)){
        cout << "Not correct, your guess is too high, try again: ";
        cin >> n;
        counter ++;
    }
    if (n == secret){
        cout << "Correct guess. Congratulations!";
        return 0;
    }
    else if ((n < secret

              ) && (counter < 2)){
        cout << "Not correct, your guess is too low, try again: ";
        cin >> n;
        counter ++;
    }
    else if ((n > secret) && (counter < 2)){
        cout << "Not correct, your guess is too high, try again: ";
        cin >> n;
        counter ++;
    }
    if (n == secret){
        cout << "Correct guess. Congratulations!";
        return 0;
    }
    else if ((n < secret) && (counter < 2)){
        cout << "Not correct, your guess is too low, try again: ";
        cin >> n;
        counter ++;
    }
    else if ((n > secret) && (counter < 2)){
        cout << "Not correct, your guess is too high, try again: ";
        cin >> n;
        counter ++;
    }
    if (counter == 2){
        cout <<"Not correct. You have reached your third trial.";
        cout << "The correct number is " << secret;
        return 0;
    }

}
