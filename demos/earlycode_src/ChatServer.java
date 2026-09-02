import java.io.IOException;
import java.net.URI;

class Handler implements URLHandler {
    // The one bit of state on the server: a number that will be manipulated by
    // various requests.
    int num = 0;
    String chat = "";

    public String handleRequest(URI url) {
        
        String add = "does this work?";
        if (url.getPath().equals("/")) {
            chat = "";
            return String.format("Number of chats: %d", num ++);
        } 
        else {
            if (url.getPath().contains("/add-message")) {
                String[] parameters = url.getQuery().split("[=&]");
                if (parameters[0].equals("s")) {
                    add = String.format("%s: %s \n", parameters[3], parameters[1]);
                    chat += add;
                }
                else return "404 Not Found!";
            }
            else return "404 Not Found!";
        }
        return chat;
    }
}

class ChatServer {
    public static void main(String[] args) throws IOException {
        if(args.length == 0){
            System.out.println("Missing port number! Try any number between 1024 to 49151");
            return;
        }

        int port = Integer.parseInt(args[0]);

        Server.start(port, new Handler());
    }
}
