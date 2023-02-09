package herebcs.spcjavaclient.rest;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import herebcs.spcjavaclient.Card;
import lombok.Data;

/**
 *
 * @author I816768
 */

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class Pending {
	public String effectType;
	public Card[] cards;
	public Integer krakenCount;
}
