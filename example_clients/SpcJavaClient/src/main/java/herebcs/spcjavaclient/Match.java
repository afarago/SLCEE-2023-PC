package herebcs.spcjavaclient;

import com.fasterxml.jackson.databind.ObjectMapper;
import herebcs.spcjavaclient.Card.Suit;
import herebcs.spcjavaclient.rest.EffectResponse;
import herebcs.spcjavaclient.rest.Status;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Random;
import java.util.concurrent.TimeUnit;
import okhttp3.Credentials;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.Route;

/**
 *
 * @author I816768
 */
public class Match {

    private String matchID;
    private final String tags;
    private final String playerID;
    private final String BASE_URL;
    private final String password;
    
    public Match (String matchID, String tags, String playerID, String password, String BASE_URL) {
        this.matchID = matchID;
        this.tags = tags;
        this.playerID = playerID;
        this.BASE_URL = BASE_URL;
        this.password = password;
    }

    public void play() throws IOException {
        var client = new OkHttpClient.Builder()
                .readTimeout(60, TimeUnit.SECONDS)
                .authenticator((Route route, Response response) -> {
                    if (response.request().header("Authorization") != null) {
                        return null; // Give up, we've already attempted to authenticate.
                    }

                    String credential = Credentials.basic(playerID, password);
                    return response.request().newBuilder()
                            .header("Authorization", credential)
                            .build();
                })
                .build();

        if (matchID == null) {
            waitForMatch(client);
        }
        
        System.out.println(playerID + ": playing match " + matchID + ".");

        do {
            Status status = null;
            while (status == null) {
                status = getStatus(client, true);
            }
            
            if (status.state.currentPlayerIndex == null) {
                if (status.state.winnerIdx == null) {
                    System.out.println(playerID + ": The game ended in a draw.");
                } else {
                    var winnerID = status.playerids[status.state.winnerIdx];
                    if (winnerID.equals(playerID)) {
                        System.out.println(playerID + ": I won.");
                    } else {
                        System.out.println(playerID + ": I lost.");
                    }
                }
                break;
            }

            if (status.state.pendingEffect == null) {
                // draw or stop
                if (status.state.playArea.length == 0) {
                    draw(client);
                } else {
                    var rnd = (new Random()).nextFloat();
                    if (rnd < 0.3) {
                        stop(client);
                    } else {
                        draw(client);
                    }
                }
            } else {
                var orig = Suit.valueOf(status.state.pendingEffect.effectType);

                switch (status.state.pendingEffect.effectType) {
                    case "Oracle" -> {
                        var rnd = (new Random()).nextFloat();
                        Card card;
                        if (rnd < 0.3) {
                            card = null;
                        } else {
                            card = status.state.pendingEffect.cards[0];
                        }
                        respond(client, orig, card);
                    }
                    case "Hook" -> {
                        var bank = status.state.banks[status.state.currentPlayerIndex];
                        var firstCardType = bank.keySet().iterator().next();
                        var maxCardValue = Collections.max(bank.get(firstCardType));
                        var card = new Card();
                        card.suit = Suit.valueOf(firstCardType);
                        card.value = maxCardValue;
                        respond(client, orig, card);
                    }
                    case "Sword" -> {
                        var bank = status.state.banks[1 - status.state.currentPlayerIndex];
                        var myBank = status.state.banks[status.state.currentPlayerIndex];
                        var cardTypes = bank.keySet();
                        var myCardTypes = myBank.keySet();
                        cardTypes.removeAll(myCardTypes);
                        var firstCardType = cardTypes.iterator().next();
                        var firstCardValue = Collections.max(bank.get(firstCardType));                     
                        var card = new Card();
                        card.suit = Suit.valueOf(firstCardType);
                        card.value = firstCardValue;
                        respond(client, orig, card);
                    }
                    case "Cannon" -> {
                        var bank = status.state.banks[1 - status.state.currentPlayerIndex];
                        var firstCardType = bank.keySet().iterator().next();
                        var maxCardValue = Collections.max(bank.get(firstCardType));
                        var card = new Card();
                        card.suit = Suit.valueOf(firstCardType);
                        card.value = maxCardValue;
                        respond(client, orig, card);
                    }
                    case "Kraken" -> {
                        draw(client);
                    }
                    default -> {
                        var card = status.state.pendingEffect.cards[0];
                        respond(client, orig, card);
                    }
                }
            }
        } while (true);
    }
    
    private void draw(OkHttpClient client) throws IOException {
        Response response = null;
        try {
            var body = "{\"etype\":\"Draw\"}";
            response = call(client, body);
            System.out.println(playerID + ": Draw.");

            if (response.code() != 200) {
                throw new IOException();
            }
        } finally {
            if (response != null) {
                response.close();
            }
        }
    }
    
    private void stop(OkHttpClient client) throws IOException {
        Response response = null;
        try {
            var body = "{\"etype\":\"EndTurn\"}";
            response = call(client, body);
            System.out.println(playerID + ": Stop.");

            if (response.code() != 200) {
                throw new IOException();
            }
        } finally {
            if (response != null) {
                response.close();
            }
        }
    }
    
    private void respond(OkHttpClient client, Suit responseType, Card chosen) throws IOException {
        Response response = null;
        
        try {      
            var eResp = new EffectResponse();
            eResp.effect.effectType = responseType.name();
            eResp.effect.card = chosen;
            var objectMapper = new ObjectMapper();
            var body = objectMapper.writeValueAsString(eResp);
            response = call(client, body);
            System.out.println(playerID + ": Response for " + responseType + ".");
            if (response.code() != 200) {
                throw new IOException();
            }
        } finally {
            if (response != null) {
                response.close();
            }
        }
    }
    
    private Response call(OkHttpClient client, String body) throws IOException {
        Response response = null;
        
        try {
            var mediaType = MediaType.parse("application/json; charset=utf-8");
            var rbody = RequestBody.create(body, mediaType);
            var request = new Request.Builder()
                    .url(BASE_URL + "/api/matches/" + matchID)
                    .post(rbody)
                    .build();
            var call = client.newCall(request);
            response = call.execute();
            return response;
        } finally {
            if (response != null) {
                response.close();
            }
        }
    }
    
    private Status getStatus(OkHttpClient client, boolean wait) throws IOException {
        
        Response response = null;
        
        try {
            String url = BASE_URL + "/api/matches/" + matchID + (wait ? "?waitactive=1" : "" );
            var request = new Request.Builder()
                    .url(url)              
                    .get()
                    .build();

            var call = client.newCall(request);
            response = call.execute();
            var code = response.code();

            if (code == 409) { // it is not our turn
                return null;
            } else if (code == 410) {
                return getStatus(client, false);
            } else if (code != 200) {
                throw new IOException("Server could not return the status of match " + matchID);
            }

            var responseBody = response.body();
            if (code == 200 && responseBody != null) {
                var objectMapper = new ObjectMapper();
                var resp = responseBody.string();
                var status = objectMapper.readValue(resp, Status.class);
                return status;
            } else {
                throw new IOException("Server could not return the status of match " + matchID);
            }
        } finally {
            if (response != null) {
                response.close();
            }
        }
    }
    
    private void waitForMatch(OkHttpClient client) throws IOException {
        
        String url = BASE_URL + "/api/matches?wait=1";
        if ((tags == null || tags.isEmpty()) || tags.isBlank()) {
            System.out.println(playerID + ": Waiting for match.");
        } else {
            url = url + "&tags=" + tags;
            System.out.println(playerID + ": Waiting for match with tags " + tags + ".");
        }
        
        var request = new Request.Builder()
                .url(url)
                .get()
                .build();
        
        do {
            
            Response response = null;
            
            try {
        
                var call = client.newCall(request);
                response = call.execute();
                var code = response.code();

                var responseBody = response.body();
                if (code == 200 && responseBody != null) {
                    var objectMapper = new ObjectMapper();
                    var resp = responseBody.string();
                    var statuses = objectMapper.readValue(resp, List.class);
                    if (statuses != null && !statuses.isEmpty()) {
                        var ids = new ArrayList<String>();
                        for (var status: (List<HashMap>)statuses) {
                            var player = status.get("activePlayerIndex");
                            if (player != null) {
                                var id = (String)status.get("_id");
                                ids.add(id);
                            }                           
                        } 
                        if (!ids.isEmpty()) {
                            Collections.sort(ids);
                            matchID = ids.get(0);
                            return;
                        }
                    }         
                } 
            } finally {
                if (response != null) {
                    response.close();
                }
            }
        } while (true);
    }
}
