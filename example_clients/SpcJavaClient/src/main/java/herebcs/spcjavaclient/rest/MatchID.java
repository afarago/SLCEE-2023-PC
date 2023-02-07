package herebcs.spcjavaclient.rest;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 *
 * @author I816768
 */

@JsonIgnoreProperties(ignoreUnknown=true)
public class MatchID {
    public String id;
}
