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
public class EffectResponse {

	public static class Effect {
		public String effectType;
		public Card card;
	}

	public final String etype = "ResponseToEffect";
	public Effect effect = new Effect();

}
