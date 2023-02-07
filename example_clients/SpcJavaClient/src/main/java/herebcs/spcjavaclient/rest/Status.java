package herebcs.spcjavaclient.rest;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 *
 * @author I816768
 */

@JsonIgnoreProperties(ignoreUnknown=true)
public class Status {
    public String[] playerids;
    public String createdByPlayerId;
    public String _id;
    public int moveCount;
    public int moveCountInTurn;
    public int turnCount;
    public State state;
}
