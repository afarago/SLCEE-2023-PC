package herebcs.spcjavaclient.rest;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import herebcs.spcjavaclient.Card;
import java.util.Map;
import java.util.Set;

/**
 *
 * @author I816768
 */

@JsonIgnoreProperties(ignoreUnknown=true)
public class State {
    public Integer winnerIdx;
    public Pending pendingEffect;
    public Integer currentPlayerIndex;
    public Card[] playArea;
    public Map<String, Set<Integer>>[] banks;
}
