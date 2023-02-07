package herebcs.spcjavaclient.rest;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import herebcs.spcjavaclient.Card;

/**
 *
 * @author I816768
 */

@JsonIgnoreProperties(ignoreUnknown=true)
public class Pending {
    public String effectType;
    public Card[] cards;
    public Integer krakenCount;
}
