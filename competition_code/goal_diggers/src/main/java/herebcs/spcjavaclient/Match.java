package herebcs.spcjavaclient;

import com.fasterxml.jackson.databind.ObjectMapper;
import herebcs.spcjavaclient.Card.Suit;
import herebcs.spcjavaclient.rest.EffectResponse;
import herebcs.spcjavaclient.rest.Status;
import okhttp3.Credentials;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.Route;
import org.jetbrains.annotations.NotNull;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static herebcs.spcjavaclient.Card.Suit.Anchor;
import static herebcs.spcjavaclient.Card.Suit.Cannon;
import static herebcs.spcjavaclient.Card.Suit.Chest;
import static herebcs.spcjavaclient.Card.Suit.Hook;
import static herebcs.spcjavaclient.Card.Suit.Key;
import static herebcs.spcjavaclient.Card.Suit.Kraken;
import static herebcs.spcjavaclient.Card.Suit.Mermaid;
import static herebcs.spcjavaclient.Card.Suit.Oracle;
import static herebcs.spcjavaclient.Card.Suit.Sword;

public class Match {

	private final String tags;
	private final String playerID;
	private final String BASE_URL;
	private final String password;
	private String matchID;

	public Match(String matchID, String tags, String playerID, String password, String BASE_URL) {
		this.matchID = matchID;
		this.tags = tags;
		this.playerID = playerID;
		this.BASE_URL = BASE_URL;
		this.password = password;
	}

	public void play() throws IOException {
		OkHttpClient client = getOkHttpClient();

		if (matchID == null) {
			waitForMatch(client);
		}

		System.out.println(playerID + ": playing match " + matchID);

		do {
			Status status = null;
			while (status == null) {
				status = getStatus(client, true);
			}

			if (endGame(status))
				break;

			evaluatePendingEffect(client, status);
		} while (true);
	}

	@NotNull
	private OkHttpClient getOkHttpClient() {
		return new OkHttpClient.Builder().readTimeout(60, TimeUnit.SECONDS)
			.authenticator((Route route, Response response) -> {
				if (response.request()
					.header("Authorization") != null) {
					return null; // Give up, we've already attempted to authenticate.
				}

				String credential = Credentials.basic(playerID, password);
				return response.request()
					.newBuilder()
					.header("Authorization", credential)
					.build();
			})
			.build();
	}

	private void waitForMatch(OkHttpClient client) throws IOException {
		String url = BASE_URL + "/api/matches?wait=1";
		if ((tags == null || tags.isEmpty()) || tags.isBlank()) {
			System.out.println(playerID + ": Waiting for match.");
		} else {
			url = url + "&tags=" + tags;
			System.out.println(playerID + ": Waiting for match with tags " + tags + ".");
		}

		var request = new Request.Builder().url(url)
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
						for (var status : (List<HashMap>) statuses) {
							var player = status.get("activePlayerIndex");
							if (player != null) {
								var id = (String) status.get("_id");
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

	private Status getStatus(OkHttpClient client, boolean wait) throws IOException {
		Response response = null;
		try {
			String url = BASE_URL + "/api/matches/" + matchID + (wait ? "?waitactive=1" : "");
			var request = new Request.Builder().url(url)
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
			if (responseBody != null) {
				var objectMapper = new ObjectMapper();
				var resp = responseBody.string();
				return objectMapper.readValue(resp, Status.class);
			} else {
				throw new IOException("Server could not return the status of match " + matchID);
			}
		} finally {
			if (response != null) {
				response.close();
			}
		}
	}

	private boolean endGame(Status status) {
		if (status.state.currentPlayerIndex == null) {
			if (status.state.winnerIdx == null) {
				System.out.println(playerID + ": The game ended in a draw.");
			} else {
				var winnerID = status.playerIDs[status.state.winnerIdx];
				String result = winnerID.equals(playerID) ? "I WON." : "I LOST.";
				System.out.println(playerID + " >> " + result);
			}
			return true;
		}
		return false;
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
		System.out.println("Response card: " + chosen);

		Response response = null;
		try {
			var eResp = new EffectResponse();
			eResp.effect.effectType = responseType.name();
			eResp.effect.card = chosen;
			var objectMapper = new ObjectMapper();
			var body = objectMapper.writeValueAsString(eResp);
			response = call(client, body);
			System.out.println(playerID + ": Response for " + responseType + ": " + response);
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
			var request = new Request.Builder().url(BASE_URL + "/api/matches/" + matchID)
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

	// ------------------------------------------------------------------------------------------------------------

	private void evaluatePendingEffect(OkHttpClient client, Status status) throws IOException {
		Card[] playArea = status.state.playArea;
		if (status.state.pendingEffect == null) {
			boolean playAreaMaxed = playArea.length > 3;
			int pointInBank = pointInBank(status);
			boolean pointMaxed = pointInBank > 8;
			if (playAreaMaxed || pointMaxed) {
				stop(client);
			} else {
				draw(client);
			}
		} else {
			Suit orig = Suit.valueOf(status.state.pendingEffect.effectType);
			final Card[] pendingCards = status.state.pendingEffect.cards;
			final Map<String, Set<Integer>> bankCurrent = status.state.banks[status.state.currentPlayerIndex];
			final Map<String, Set<Integer>> bankOpponent = status.state.banks[1 - status.state.currentPlayerIndex];
			Set<String> bankCurrentSuiteSet = bankCurrent.keySet();
			Set<String> bankOpponentSuiteSet = bankOpponent.keySet();
			List<String> playAreaSuitList = Arrays.stream(playArea)
				.map(card -> card.suit.name())
				.toList();
			Set<String> playAreaSuitSet = new HashSet<>(playAreaSuitList);

			choosePendingCard(client, status, orig, pendingCards, bankCurrent, bankOpponent, bankCurrentSuiteSet, bankOpponentSuiteSet,
				playAreaSuitList, playAreaSuitSet);
		}
	}

	private int pointInBank(Status status) {
		Card[] playArea = status.state.playArea;
		Map<String, Set<Integer>>[] banks = status.state.banks;
		Map<String, Set<Integer>> bankCurrent = banks[status.state.currentPlayerIndex];
		List<String> collectedKeysInBank = getSuitListFromBankWithoutPlayArea(bankCurrent, playArea);
		int pointInBank = 0;
		for (String key : collectedKeysInBank) {
			int inBank = bankCurrent.get(key)
				.stream()
				.mapToInt(v -> v)
				.max()
				.orElseThrow(RuntimeException::new);
			Card card1 = Arrays.stream(playArea)
				.filter(card -> card.suit.name()
					.equals(key))
				.findFirst()
				.orElseThrow(RuntimeException::new);
			if (card1.value > inBank) {
				int diff = card1.value - inBank;
				pointInBank += diff;
			}
		}
		return pointInBank;
	}

	private void choosePendingCard(OkHttpClient client, Status status, Suit orig, Card[] pendingCards,
			Map<String, Set<Integer>> bankCurrent, Map<String, Set<Integer>> bankOpponent, Set<String> bankCurrentSuiteSet,
			Set<String> bankOpponentSuiteSet, List<String> playAreaSuitList, Set<String> playAreaSuitSet) throws IOException {
		switch (status.state.pendingEffect.effectType) {
		case "Oracle" -> receivedOracle(client, orig, pendingCards, playAreaSuitSet);
		case "Hook" -> receivedHook(client, orig, bankCurrent, bankCurrentSuiteSet, bankOpponentSuiteSet, playAreaSuitList,
			playAreaSuitSet);
		case "Sword" -> receivedSword(client, orig, bankOpponent, bankCurrentSuiteSet, bankOpponentSuiteSet, playAreaSuitList,
			playAreaSuitSet);
		case "Cannon" -> {
			Card card = getMaxDamageCard(bankOpponent);
			respond(client, orig, card);
		}
		case "Kraken" -> draw(client);
		case "Map" -> receivedMap(client, orig, pendingCards, playAreaSuitSet);
		default -> {
			Card card = pendingCards[0];
			respond(client, orig, card);
		}
		}
	}

	private void receivedOracle(OkHttpClient client, Suit orig, Card[] pendingCards, Set<String> playAreaSuitSet) throws IOException {
		Card pendingCard = pendingCards[0];
		String pendingCardSuitName = pendingCard.suit.name();
		boolean playAreaContainsOracle = pendingCardSuitName.equals(Oracle.name());
		boolean playAreaContainsKraken = playAreaSuitSet.size() > 2 && pendingCardSuitName.equals(Kraken.name());
		boolean playAreaContainsDuplicate = playAreaSuitSet.contains(pendingCardSuitName);
		Card card = playAreaContainsOracle || playAreaContainsKraken || playAreaContainsDuplicate ? null : pendingCard;
		respond(client, orig, card);
	}

	private void receivedHook(OkHttpClient client, Suit orig, java.util.Map<String, Set<Integer>> bankCurrent,
			Set<String> bankCurrentSuiteSet, Set<String> bankOpponentSuiteSet, List<String> playAreaSuitList, Set<String> playAreaSuitSet)
			throws IOException {
		removeBustedCards(bankCurrentSuiteSet, playAreaSuitSet);

		Card card;
		if (bankCurrentSuiteSet.contains(Key.name()) && playAreaSuitList.contains(Chest.name())) {
			card = getChoosenPendigCard(bankCurrent, Key);
		} else if (bankCurrentSuiteSet.contains(Chest.name()) && playAreaSuitList.contains(Key.name())) {
			card = getChoosenPendigCard(bankCurrent, Chest);
		} else if (bankCurrentSuiteSet.contains(Cannon.name())) {
			card = getChoosenPendigCard(bankCurrent, Cannon);
		} else if (bankCurrentSuiteSet.contains(Anchor.name())) {
			card = getChoosenPendigCard(bankCurrent, Anchor);
		} else if (bankCurrentSuiteSet.contains(Oracle.name())) {
			card = getChoosenPendigCard(bankCurrent, Oracle);
		} else {
			if (bankCurrentSuiteSet.contains(Hook.name())) { // not available
				Set<String> diff = calculateDiffOfSets(bankCurrentSuiteSet, playAreaSuitSet);
				if (diff.size() == 0 && bankCurrentSuiteSet.size() > 1) {
					bankCurrent.remove(Hook.name());
				}
			}
			if (bankCurrentSuiteSet.contains(Sword.name())) {
				Set<String> diff = calculateDiffOfSets(bankOpponentSuiteSet, playAreaSuitSet);
				if (diff.size() == 0 && bankCurrentSuiteSet.size() > 1) {
					bankCurrent.remove(Sword.name());
				}
			}
			if (bankCurrentSuiteSet.contains(Kraken.name()) && playAreaSuitSet.size() > 2 && bankCurrentSuiteSet.size() > 1) {
				bankCurrent.remove(Kraken.name());
			}
			if (bankCurrentSuiteSet.contains(Suit.Map.name()) && playAreaSuitSet.size() > 4 && bankCurrentSuiteSet.size() > 1) {
				bankCurrent.remove(Suit.Map.name());
			}
			card = getMinValueCard(bankCurrent);
		}
		respond(client, orig, card);
	}

	private void receivedSword(OkHttpClient client, Suit orig, java.util.Map<String, Set<Integer>> bankOpponent,
			Set<String> bankCurrentSuiteSet, Set<String> bankOpponentSuiteSet, List<String> playAreaSuitList, Set<String> playAreaSuitSet)
			throws IOException {
		bankOpponentSuiteSet.removeAll(bankCurrentSuiteSet);
		removeBustedCards(bankOpponentSuiteSet, playAreaSuitSet);
		Card card;
		if (bankOpponentSuiteSet.contains(Key.name()) && playAreaSuitList.contains(Chest.name())) {
			card = getChoosenPendigCard(bankOpponent, Key);
		} else if (bankOpponentSuiteSet.contains(Chest.name()) && playAreaSuitList.contains(Key.name())) {
			card = getChoosenPendigCard(bankOpponent, Chest);
		} else if (bankOpponentSuiteSet.contains(Cannon.name())) {
			card = getChoosenPendigCard(bankOpponent, Cannon);
		} else if (bankOpponentSuiteSet.contains(Anchor.name())) {
			card = getChoosenPendigCard(bankOpponent, Anchor);
		} else if (bankOpponentSuiteSet.contains(Oracle.name())) {
			card = getChoosenPendigCard(bankOpponent, Oracle);
		} else {
			if (bankOpponentSuiteSet.contains(Hook.name())) {
				Set<String> diff = calculateDiffOfSets(bankCurrentSuiteSet, playAreaSuitSet);
				if (diff.size() == 0 && bankOpponentSuiteSet.size() > 1) {
					bankOpponent.remove(Hook.name());
				}
			}
			if (bankOpponentSuiteSet.contains(Sword.name())) { // not available
				Set<String> diff = calculateDiffOfSets(bankOpponentSuiteSet, playAreaSuitSet);
				if (diff.size() == 0 && bankOpponentSuiteSet.size() > 1) {
					bankOpponent.remove(Sword.name());
				}
			}
			if (bankOpponentSuiteSet.contains(Kraken.name()) && playAreaSuitSet.size() > 2 && bankOpponentSuiteSet.size() > 1) {
				bankOpponent.remove(Kraken.name());
			}
			if (bankOpponentSuiteSet.contains(Suit.Map.name()) && playAreaSuitSet.size() > 4 && bankOpponentSuiteSet.size() > 1) {
				bankOpponent.remove(Suit.Map.name());
			}
			card = getMaxDamageCard(bankOpponent);
		}
		respond(client, orig, card);
	}

	private Card getMaxDamageCard(Map<String, Set<Integer>> bank) {
		Map<String, Integer> filtered = new HashMap<>();
		Set<String> keySet = bank.keySet();
		for (String key : keySet) {
			Set<Integer> integerSet = bank.get(key);
			if (integerSet.size() == 1) {
				filtered.put(key, integerSet.iterator()
					.next());
				continue;
			}
			List<Integer> integerList = new ArrayList<>(integerSet).stream()
				.sorted(Comparator.reverseOrder())
				.toList();
			int gain = integerList.get(0) - integerList.get(1);
			filtered.put(key, gain);
		}

		String maxSuit = getMaxSuit(filtered);
		return Card.builder()
			.suit(Suit.valueOf(maxSuit))
			.value(Collections.max(bank.get(maxSuit)))
			.build();
	}

	private void receivedMap(OkHttpClient client, Suit orig, Card[] pendingCards, Set<String> playAreaSuitSet) throws IOException {
		List<Card> pendingCardList = Arrays.asList(pendingCards);
		Set<String> pendingCardSuitSet = getSuitSetFromCards(pendingCards);
		removeBustedCards(pendingCardSuitSet, playAreaSuitSet);

		List<String> desiredSuitList = new ArrayList<>(List.of(Cannon.name(), Sword.name(), Oracle.name(), Anchor.name(), Mermaid.name(),
			Key.name(), Chest.name(), Suit.Map.name(), Hook.name(), Kraken.name()));

		Card card = null;
		for (String desiredSuit : desiredSuitList) {
			if (pendingCardSuitSet.contains(desiredSuit)) {
				card = pendingCardList.stream()
					.filter(card1 -> card1.getSuit()
						.name()
						.equals(desiredSuit))
					.findFirst()
					.orElseThrow(RuntimeException::new);
				break;
			}
		}
		respond(client, orig, card);
	}

	private void removeBustedCards(Set<String> originSet, Set<String> playAreaSuitSet) {
		Set<String> setDiff = calculateDiffOfSets(originSet, playAreaSuitSet);
		if (setDiff.size() > 0) {
			playAreaSuitSet.forEach(originSet::remove);
		}
	}

	private List<String> getSuitListFromBankWithoutPlayArea(Map<String, Set<Integer>> bank, Card[] playArea) {
		Set<String> suitsInPlayArea = getSuitSetFromCards(playArea);
		return bank.keySet()
			.stream()
			.filter(suitsInPlayArea::contains)
			.toList();
	}

	private Set<String> getSuitSetFromCards(Card[] cards) {
		return Arrays.stream(cards)
			.map(card -> card.suit.name())
			.collect(Collectors.toSet());
	}

	private Card getChoosenPendigCard(Map<String, Set<Integer>> bank, Suit suit) {
		return Card.builder()
			.suit(Suit.valueOf(suit.name()))
			.value(Collections.max(bank.get(suit.name())))
			.build();
	}

	private Set<String> calculateDiffOfSets(Set<String> from, Set<String> what) {
		return from.stream()
			.filter(e -> !what.contains(e))
			.collect(Collectors.toSet());
	}

	private Card getMinValueCard(Map<String, Set<Integer>> bank) {
		Map<String, Integer> bankMaxCards = bankMaxCards(bank);
		String minSuit = getMinSuit(bankMaxCards);
		return Card.builder()
			.suit(Suit.valueOf(minSuit))
			.value(Collections.max(bank.get(minSuit)))
			.build();
	}

	private Map<String, Integer> bankMaxCards(Map<String, Set<Integer>> bank) {
		return bank.entrySet()
			.stream()
			.collect(Collectors.toMap(Map.Entry::getKey, e -> Collections.max(e.getValue())));
	}

	private <K, V extends Comparable<V>> K getMaxSuit(Map<K, V> map) {
		return map.entrySet()
			.stream()
			.max(Map.Entry.comparingByValue())
			.orElseThrow(RuntimeException::new)
			.getKey();
	}

	private <K, V extends Comparable<V>> K getMinSuit(Map<K, V> map) {
		return map.entrySet()
			.stream()
			.min(Map.Entry.comparingByValue())
			.orElseThrow(RuntimeException::new)
			.getKey();
	}
}
