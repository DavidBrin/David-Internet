/*
Name: David Brin
Email: d*****@ucsd.edu
PID: A1*******
Sourced used: write-up, JDK
*/

import java.util.Scanner;

public class RPS extends RPSAbstract {
    // Messages for the game.
    protected static final String GAME_NOT_IMPLEMENTED =
            "Game not yet implemented.";
    /**
     * Construct a new instance of RPS with the given possible moves.
     *
     * @param moves all possible moves in the game.
     */
    public RPS(String[] moves) {
        this.possibleMoves = moves;
        this.playerMoves = new String[MAX_GAMES];
        this.cpuMoves = new String[MAX_GAMES];
    }

    public static void main(String[] args) {
        // If command line args are provided use those as the possible moves
        String[] moves = new String[args.length];
        if (args.length >= MIN_POSSIBLE_MOVES) {
            System.arraycopy(args, 0, moves, 0, args.length);
        } else {
            moves = RPS.DEFAULT_MOVES;
        }
        // Create new game and scanner
        RPS game = new RPS(moves);
        Scanner in = new Scanner(System.in);
        
        // While user does not input "q", play game
        System.out.println(PROMPT_MOVE);
        String response = in.nextLine();
        while(!(response.equals(QUIT))){
            if(game.isValidMove(response))
            {
            game.playRPS(response, game.genCPUMove());
            System.out.println(PROMPT_MOVE);
            
            }
            else{ 
                System.out.println(INVALID_INPUT);
                System.out.println(PROMPT_MOVE);
                game.genCPUMove();
            }
            response = in.nextLine();
        }
        game.displayStats();
        // TODO: Insert the code to play the game.
        // See the writeup for an example orf the game play.
        // Hint: call the methods we/you have already written
        // to do most of the work! And don't forget Javadoc.

        in.close();
    }

     @Override
    public int determineWinner(String playerMove, String cpuMove) 
    {
       
        int pnum = -1, cnum = -1;
                for(int i = 0; i < possibleMoves.length; i++){
                    if(possibleMoves[i].equals(cpuMove)) cnum = i;
                    if(possibleMoves[i].equals(playerMove)) pnum = i;
                }
                if(cnum == -1 || pnum == -1) return INVALID_INPUT_OUTCOME;

        if ((pnum + 1) % possibleMoves.length == cnum)  return CPU_WIN_OUTCOME;
        else if ((cnum + 1) % possibleMoves.length == pnum) return PLAYER_WIN_OUTCOME;
        else return TIE_OUTCOME;
    }
}