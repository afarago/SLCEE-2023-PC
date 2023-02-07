package herebcs.spcjavaclient;

import java.io.IOException;
import java.util.concurrent.CompletableFuture;
import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.DefaultParser;
import org.apache.commons.cli.HelpFormatter;
import org.apache.commons.cli.Options;
import org.apache.commons.cli.ParseException;

/**
 *
 * @author I816768
 */
public class SpcJavaClient {

    public static void main(String[] args) throws Throwable {
        var options = new Options();
        options.addOption("p", true, "player id");
        options.addOption("pw", true, "password");
        options.addOption("p2", true, "second player's id (launches two instances that play against each other)");
        options.addOption("pw2", true, "password for player 2");
        options.addOption("s", true, "server url");
        options.addOption("g", true, "connect to an existing match with the specified id");
        options.addOption("w", false, "wait for a new match (cannot be used with -g)");
        options.addOption("t", true, "wait for matches with the given tags - must be used together with -w");
        options.addOption("l", false, "run app in a loop - for use with -t");
                
        var parser = new DefaultParser();
        CommandLine cmd;
        try {
            cmd = parser.parse(options, args);
            if (!cmd.hasOption("p") || !cmd.hasOption("pw") || !cmd.hasOption("s")) {
                System.out.println("Player ID, password and Server URL are mandatory parameters.");
                throw new ParseException("Player ID, password and Server URL are mandatory parameters.");
            }
            if ((cmd.hasOption("g") && cmd.hasOption("w"))
                    || (!cmd.hasOption("g") && !cmd.hasOption("w"))) {
                System.out.println("You must specify exactly one of parameters w and g.");
                throw new ParseException("You must specify exactly one of parameters w and g.");
            }

            String tags = null;
            String matchID = null;
            
            if (cmd.hasOption("g")) {
                matchID = cmd.getOptionValue("g");
            } else {
                tags = cmd.getOptionValue("t");
            }
            var BASE_URL = cmd.getOptionValue("s");
            var playerID = cmd.getOptionValue("p");
            var password = cmd.getOptionValue("pw");
            
            do {
                if (!cmd.hasOption("p2")) {
                    Match match = new Match(matchID, tags, playerID, password, BASE_URL);
                    play(match);
                    
                } else {
                    if (!cmd.hasOption("pw2")) {
                        System.out.println("Password for player 2 is missing.");
                        throw new ParseException("Password for player 2 is missing.");
                    }
                    Match match = new Match(matchID, tags, playerID, password, BASE_URL);
                    var playerID2 = cmd.getOptionValue("p2");
                    var password2 = cmd.getOptionValue("pw2");
                    Match match2 = new Match(matchID, tags, playerID2, password2, BASE_URL);
                    var future1 = CompletableFuture.runAsync(() -> {
                        play(match);
                    });
                    var future2 = CompletableFuture.runAsync(() -> {
                        play(match2);
                    });

                    var combinedFuture = CompletableFuture.allOf(future1, future2);
                    combinedFuture.join();
                } 
            } while (cmd.hasOption("l"));
        } catch (ParseException e) {
            var formatter = new HelpFormatter();
            formatter.printHelp("SpcJavaClient <options>", options);
        }
    }
    
    private static void play(Match match) {      
        boolean error;
        do {
            error = false;

            try {
                match.play();
            } catch (IOException e) {
                System.out.println("Restarting because of error: " + e.getMessage());
                error = true;
            }
        } while (error);
    }
}
