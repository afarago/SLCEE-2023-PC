using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Net.Http.Headers;
using System.Text.RegularExpressions;

namespace ConsoleApp1
{
    internal class Program
    {
        //-- guide: How to generate code from OpenAPI definition with Visual Studio
        //-- https://devblogs.microsoft.com/dotnet/generating-http-api-clients-using-visual-studio-connected-services/
        //-- https://www.code4it.dev/blog/openapi-code-generation-vs2019

        static HttpClient? httpclient;
        //static swaggerClient? client;
        static SLCEE2023PCArenaClient? client;
        static async Task Main(string[] args)
        //static void Main(string[] args)
        {

            ////var input1 = @"[{""eventType"":""ResponseToEffect"",""responseToEffectType"":""Oracle"",""responseToEffectCard"":null},{""eventType"":""Draw"",""drawCard"":{""suit"":""Cannon"",""value"":7}},{""eventType"":""CardPlacedToPlayArea"",""cardPlacedToPlayAreaCard"":{""suit"":""Cannon"",""value"":7}},{""eventType"":""CardPlayedEffect"",""cardPlayedEffect"":{""effectType"":""Cannon""}}]";
            Console.WriteLine("Hello, World!");

            httpclient = new HttpClient();
            //client = new swaggerClient(httpclient);
            client = new SLCEE2023PCArenaClient(httpclient)
            //httpclient.BaseAddress = new Uri("http://localhost:8080");
            httpclient.BaseAddress = new Uri("https://slhpc2023.appspot.com");

            ////-- call Hello Service - no auth is needed
            ////await SimpleHello(client);

            //-- set auth headers for the user John
            var playerId = "636438380ef778617e0e5be5";
            var clientSecret = "testpass42";
            var authenticationString = $"{playerId}:{clientSecret}";
            var base64EncodedAuthenticationString = Convert.ToBase64String(System.Text.ASCIIEncoding.UTF8.GetBytes(authenticationString));
            httpclient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", base64EncodedAuthenticationString);

            //////-- Get Players list - will return a one length array with my data
            ////await GetAllPlayers(client);

            //////-- get all matches for today
            ////await GetAllMatches(client, playerId);

            //////-- Start a practice match
            ////Card[] drawpile = {
            ////new Card() { Suit = CardSuit.Oracle, Value = 3 },
            ////new Card() { Suit = CardSuit.Oracle, Value = 4 } };
            ////Console.WriteLine("Creating a practice match");
            ////MatchCreationParams mcp = new MatchCreationParams()
            ////{
            ////    DrawPile = drawpile
            ////};
            ////var mcr = await client.CreateMatchAsync(mcp);
            ////var matchId = mcr.Id;
            ////Console.WriteLine($"Created match {matchId}");

            ////var matchId = "63951f348f108c985c404a7e";

            while (true)
            {
                var match = await WaitForActiveMatch();
                if (match != null)
                {
                    Console.WriteLine($"Using match {match._id}");
                    await PlayAMatch(match);
                }
            }
        }

        async static Task<MatchDTO?> WaitForActiveMatch()
        {
            if (client is null) return null;
            //ICollection<MatchDTO>? matches = null;
            ICollection<Anonymous>? matches = null;
            while (!(matches?.Count > 0))
            {
                var matches2 = await client.GetMatchesAsync("today", BoolLikeString.True, null, BoolLikeString.True, BoolLikeString.False, null, null, null, null);
                if (matches2?.Count == 0) Console.WriteLine("... I am still not the current player in any matchs - retrying query");
            }

            var picked_match = matches?.First();
            return picked_match as MatchDTO;
        }

        async static Task PlayAMatch(MatchDTO match)
        {
            if (client is null) return;
            var matchid = match._id;
            var turnId = match.TurnCount;
            var moveCountInTurn = match.MoveCountInTurn;
            var isMatchRunning = true;
            var rand = new Random();
            var doAllowAutoDraw = false;
            ICollection<MatchEventDTO>? lastmove = null;

            //-- MATCH
            while (isMatchRunning)
            {
                //-- WAITTURN: wait to be active
                while (isMatchRunning)
                {
                    Console.WriteLine("Waiting to be active player");
                    try
                    {
                        var match2 = await client.GetMatchAsync(matchid, BoolLikeString.True, null, null);
                        //-- I am active as this is successful --> break the while loop
                        turnId = match2.TurnCount;
                        moveCountInTurn = match2.MoveCountInTurn;
                        break;
                    }
                    catch (ApiException ex)
                    {
                        if (ex.StatusCode == 409)
                            Console.WriteLine("... I am still not the current player - retrying the move");
                        else
                            throw ex; //TODO: handle others / e.g. match end
                    }
                }

                if (lastmove != null && lastmove.Any(ev => ev.EventType == MatchEventType.MatchEnded))
                {
                    Console.WriteLine("Match has ended");
                    isMatchRunning = false;
                    break;
                }

                //-- TURN: repeat drawing cards until busted
                bool doEndThisTurn = false;
                bool doAllowAutoDrawForThisTurn = false;
                while (isMatchRunning)
                {
                    Console.WriteLine($"=== TURN {turnId}.{moveCountInTurn} ==================");

                    //-- Draw next card
                    Console.WriteLine($"doAllowAutoDraw={doAllowAutoDraw}");
                    if (!doAllowAutoDraw && !doAllowAutoDrawForThisTurn)
                    {
                        Console.WriteLine("Press any key (d=draw card, e=end turn, a=automate, t=automate_for_this_turn)");
                        var cki = Console.ReadKey(true);
                        if (cki.KeyChar == 'a') doAllowAutoDraw = true;
                        if (cki.KeyChar == 't') doAllowAutoDrawForThisTurn = true;
                        if (cki.KeyChar == 'e') doEndThisTurn = true;
                    }

                    if (!doEndThisTurn)
                    {
                        IUserAction drawMove = new IUserAction()
                        {
                            Etype = MatchActionType.Draw,
                            Autopick = true
                        };
                        lastmove = await client.ExecuteActionForMatchAsync(matchid, null, drawMove);
                        //Console.WriteLine(JArray.FromObject(lastmove).ToString(Formatting.Indented));
                        //response.ToList().ForEach(ev => Console.WriteLine($"  {ev.EventType}, {ev}"));
                        var cards = lastmove.SelectMany(ev =>
                            ev.DrawCard != null ? new[] { ev.DrawCard } :
                            ev.ResponseToEffectCard != null && ev?.ResponseToEffectType != CardEffectType.Cannon ? new[] { ev.ResponseToEffectCard } :
                            new Card[0]).ToArray();
                        Console.WriteLine("Collected Cards " + string.Join(", ", cards.Select(card => $"{card.Suit}-{card.Value}").ToArray()));
                    }

                    if (lastmove != null && lastmove.Any(ev => ev.EventType == MatchEventType.TurnEnded)) break;
                    if (lastmove != null && lastmove.Any(ev => ev.EventType == MatchEventType.MatchEnded))
                    {
                        isMatchRunning = false; break;
                    }

                    //-- consider ending the turn
                    if (doEndThisTurn || rand.Next(10) < 3)
                    {
                        if (!doEndThisTurn && !doAllowAutoDraw && !doAllowAutoDrawForThisTurn)
                        {
                            Console.WriteLine("Ready to end turn - Press any key (e=end turn, a=automate)");
                            var cki = Console.ReadKey(true);
                            if (cki.KeyChar == 'a') doAllowAutoDraw = true;
                        }

                        Console.WriteLine("Ending turn...");
                        var enduseraction = new IUserAction() { Etype = MatchActionType.EndTurn, Autopick = true };
                        lastmove = await client.ExecuteActionForMatchAsync(matchid, null, enduseraction);
                        Console.WriteLine(JArray.FromObject(lastmove).ToString(Formatting.Indented));
                        break;
                    }
                    moveCountInTurn++;
                }


            }

            Console.WriteLine("Match ended");
        }

        private static async Task SimpleHello(swaggerClient client)
        {
            var hello = await client.GetMessageAsync();
            Console.WriteLine(hello);
        }

        private static async Task GetAllPlayers(swaggerClient client)
        {
            var players = await client.GetPlayersAsync();
            Console.WriteLine(string.Join(", ", players.Select(p => p.Name).ToArray()));
        }

        private static async Task GetAllMatches(swaggerClient client, string playerId)
        {
            var matches = await client.GetMatchesAsync("today", null, null, BoolLikeString.True);
            foreach (var match in matches)
            {
                Console.WriteLine($"{match._id} {match.TurnCount}.{match.MoveCountInTurn}/{match.MoveCount} " +
                    $"{Math.Round((DateTime.Now - match.LastMoveAt).TotalHours, 1)} hours ago" + " " +
                $"{(match.ActivePlayerIndex != null && match.Playerids.ToArray()[match.ActivePlayerIndex.Value] == playerId ? "active" : "not_active")}");

            }
        }

        private static async Task<ICollection<MatchEventDTO>?> ExecuteMatchAction(swaggerClient client, string matchId, IUserAction drawMove)
        {
            try
            {
                Console.WriteLine($"Executing a '{drawMove.Etype}' Action {matchId}");
                var response = await client.ExecuteActionForMatchAsync(matchId, null, drawMove);
                return response;
            }
            catch (ApiException ex)
            {
                JObject x = JObject.Parse(ex.Response);
                Console.WriteLine(x["Error"]);
            }
            return null;
        }
    }
}