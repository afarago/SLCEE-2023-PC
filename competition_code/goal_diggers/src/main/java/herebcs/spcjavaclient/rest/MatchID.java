package herebcs.spcjavaclient.rest;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

/**
 *
 * @author I816768
 */

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class MatchID {
	public String id;
}
