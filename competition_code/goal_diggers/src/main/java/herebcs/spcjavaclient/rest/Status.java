package herebcs.spcjavaclient.rest;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

/**
 *
 * @author I816768
 */

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class Status {
	public String[] playerIDs;
	public String createdByPlayerId;
	public String _id;
	public int moveCount;
	public int moveCountInTurn;
	public int turnCount;
	public State state;
}
