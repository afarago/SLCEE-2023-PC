package herebcs.spcjavaclient;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * @author I816768
 */
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Data
public class Card {
	public Suit suit;
	public int value;

	public enum Suit {
		Anchor, Oracle, Hook, Mermaid, Cannon, Key, Chest, Map, Sword, Kraken
	}
}
