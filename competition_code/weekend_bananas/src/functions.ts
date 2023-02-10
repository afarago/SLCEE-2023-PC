import { isNullOrUndefined } from "util";
import { first_card_from_bank, logEffectNoResponse, logEffectResponse } from "./common";
import { handleCannon } from "./handleCanon";
import { handleHook } from "./handleHook";
import { handleMap } from "./handleMap";

var Spc22Arena = require("spc22_arena");

export function get_best_move(gameStatus) {

    // first move in turn is always Draw Card
    if ( gameStatus.moveCountInTurn == null )  {
        return get_draw_move(" - first card in turn");
    }

    // identify players
    var player_id = gameStatus.state.currentPlayerIndex;
    var oponent_id = 1 - player_id;

    var player_bank = gameStatus.state.banks[player_id];
    var oponent_bank = gameStatus.state.banks[oponent_id];
    var play_area = gameStatus.state.playArea;
    // TODO var draw_pile = get_draw_pile_content(gameStatus);
    // TODO var discard_pile = get_discard_pile_content(player_bank, oponent_bank, play_area, draw_pile);    
    var score = get_score(player_bank,oponent_bank);


    // respond to effect
    if ( gameStatus.state.pendingEffect != null ) {

        switch ( gameStatus.state.pendingEffect.effectType ) {

            case "Anchor": // no response needed
            case "Key":     // no response needed
            case "Chest":   // no response needed
            case "Mermaid": // no response needed
                logEffectNoResponse(gameStatus.state.pendingEffect.effectType);
                break;                     

            case "Kraken":  // kraken must draw a card                
                return get_draw_move( "- must draw a card for kraken" );
                break;      
    
            case "Hook":
                // !!! z tych co nas nebustnu vyber 
                // 1, ak mame Chest v play area vyber Key (ak je v banku)
                // 2, ak mame Key vyber Chest (ak je v banku)
                // 3, Sword - nam pomoze,  superovi uskodi
                // 4, Cannon 
                // 4.5, Oracle
                // 5, Map  
                // 6, Anchor
                // 7, hocico ine - okrem krakena /Key, Chest, Mermaid/
                // 8, Kraken
                // -- ak nas vsetko bvustne tak take co ma najmensiu hodnotu
                
                var card = handleHook (play_area, player_bank, oponent_bank);
                logEffectResponse(gameStatus.state.pendingEffect.effectType, card);
                return get_effect_response( card, gameStatus.state.pendingEffect.effectType, "Hook" );

                break;

            case "Cannon":
                var card = handleCannon(oponent_bank);
                logEffectResponse(gameStatus.state.pendingEffect.effectType, card);
                return get_effect_response( card, gameStatus.state.pendingEffect.effectType, "Cannon" );
                break;            

            case "Map":
                var card = handleMap(play_area, gameStatus.state.pendingEffect.cards, player_bank, oponent_bank);
                logEffectResponse(gameStatus.state.pendingEffect.effectType, card);
                return get_effect_response( card, gameStatus.state.pendingEffect.effectType, "Map" );
                
                // z troch ponuknutych kariet vyber (vyparsuj zo vzstupu) vyber co sa nam paci
                // zober taku co este nemas aby to nebustlo, ak tak nie je zober hociaku
                // ak si mozes vyberat zober podla priority oko, kanon, mapu, sword
                // ak ich je viac zober najvysiu hodnotu
                break;

            case "Oracle":
                // oko 
                // - vyber si dalsiu kartu ak ju este nemas v play arey, ak ju mas vrat null
                // - krakena ber iba ak mas max 1 kartu
                // - ak je kraken aktivny musis zobrat kartu tak ci tak

                var next_suit = gameStatus.state.pendingEffect.cards[0].suit;
                var is_bust_safe = is_suit_bust_safe( next_suit, play_area, player_bank, oponent_bank );

                if ( is_suit_in_play_area (play_area, next_suit) == false &&  // will not lead to bust
                     ( next_suit != "Kraken" || play_area.length <= 1 ) ||    // take kraken only if we have 1 cards max 
                     gameStatus.state.pendingEffect.krakenCount >= 1  ) {     // if there is kraken effect we have to take the card anyhow
                    return get_effect_response( gameStatus.state.pendingEffect.cards[0], gameStatus.state.pendingEffect.effectType, "- not present, taking card" );
                } else {
                    return get_effect_response( null, gameStatus.state.pendingEffect.effectType, "- present or kraken - taking null" ); 
                    // Ending Turn is forced after this action
                }
               
                break;

            case "Sword":
                // odfilruj z oponent_bank tie ktore mame v player_bank 
                // z nich si vyber najvyzssiu hodnotu okrem krakena
                var sword_card = handleSword(player_bank, oponent_bank, gameStatus.state.playArea);
                logEffectResponse(gameStatus.state.pendingEffect.effectType, sword_card);
                return get_effect_response( sword_card, gameStatus.state.pendingEffect.effectType, "Sword" );
                break;
        }
    }

    // inintial defaul moves - take 3 cards
    var move_response = get_draw_move();
    var last_move = get_last_move ( gameStatus.moves );
    var was_last_move_oracle_with_null = is_move_null_respone_to_oracle( last_move ) ; 
    var play_area_value = get_play_area_value(play_area, player_bank);
    var is_chest_key_present =  ( is_suit_in_play_area( play_area, "Chest" ) == true && is_suit_in_play_area( play_area, "Key" ) == true) ;
    console.log(`Play area value -> ` + play_area_value + '            Chest/key pair:' + is_chest_key_present ); 
    
    
    if ( (gameStatus.state.playArea.length >= 3  && play_area_value > 0 ) ||  // ak ja aktualna kopa bezcenna kludne zober dalsiu kartu                     
          is_chest_key_present == true ||  // always take bonus from key and chest
         (was_last_move_oracle_with_null == true)                                                                      // last move was oracle returned card back
    )
    {
        move_response = get_end_turn_move();
    }

    return move_response;
}

function is_move_null_respone_to_oracle( move ) {

    if ( 'events' in move == true ) {
        if (move.events[0].eventType == "ResponseToEffect" &&
            move.events[0].responseToEffectType == "Oracle" &&
            move.events[0].responseToEffectCard == null ) 
            {
                return true;
            }
    }

    return false;
}

function get_last_move( moves ) {
    return moves[moves.length - 1];
}

function is_suit_in_play_area ( play_area, suit: string) {    

    for ( var i = 0; i < play_area.length; i++ ) {
        if ( play_area[i].suit == suit ) return true;
    }

    return false;
}


function get_dummy_first( card_list , effect_type:string , additional_info: string = "" ) {
    
    return get_effect_response( card_list[0], effect_type, " - dummy - " + additional_info );
}

function get_dummy_autopick_effect_response( response_card , effect_type:string , additional_info: string = "" ) {

    var move_response = { info: "[Response To Effect - " + effect_type + " ] " + additional_info ,
                          userAction: { etype: "ResponseToEffect",                                         
                                        autopick: true 
                                    },
                          opts: { wait: "1" }
                         }

    return move_response;
}


function get_effect_response( response_card , effect_type:string , additional_info: string = "" ) {

    var move_response = { info: "[Response To Effect - " + effect_type + " ] " + additional_info ,
                          userAction: { etype: "ResponseToEffect", 
                                        effect: { effectType: effect_type,
                                                  card: response_card
                                                },
                                        autopick: false 
                                    },
                          opts: { wait: "1" }
                         }

    return move_response;
}

function get_draw_move( additional_info: string = "" ) {

    var move_response = { info: "[Drawing a new card] " + additional_info ,
                          userAction: { etype: "Draw", autopick: false },
                          opts: { wait: "1" }
                         }

    return move_response;
}

function get_end_turn_move( additional_info: string = "" ) {

    var move_response = { info: "[Ending turn] " + additional_info,
                          userAction: { etype: "EndTurn", autopick: false },
                          opts: { wait: "1" }
                         }

    return move_response;
}

function isSuitInCardArray(suit: string, arr: any) : { suit: string; value: number; } | null {
    for(let i=0; i < arr.length; i++){   
        if ( suit == arr[i].suit ) {
            return arr[i];
        }
    }
    return null;
}

function handleSword(player_bank: Map<string, Array<number>>, oponent_bank: Map<string, Array<number>>, playArea: any) : { suit: string; value: number; } | null {
    // find those cards that we doesn't have
    let wanted = Array(); 
    var first_valid;
    
    // filter suits we do not have
    for (const [oponent_suit, oponent_values] of Object.entries(oponent_bank)) {    

        var is_safe = is_suit_bust_safe (oponent_suit, playArea, player_bank, oponent_bank);  
        
        if ( false == oponent_suit in player_bank ) {
            first_valid = {  "suit": oponent_suit, 
                             "value": Math.max.apply(Math,oponent_values) as number };
        }


        if ( false == oponent_suit in player_bank && is_safe == true) {
            wanted.push(  {  "suit": oponent_suit, 
                             "value": Math.max.apply(Math,oponent_values) as number } );                             
        }
    } 

    // check if there is something to be wanted
    let found = false;    
    if (wanted.length > 0) {

        // wanted to Map        
        var oponent_cards = new Map(wanted.map((item) => [item.suit, item.value])); 
        var play_area_map = new Map(playArea.map((item) => [item.suit, item.value]));               

        // complete key/chest        
        // 1, ak mame Chest v play area vyber Key (ak je v banku)        
        if (play_area_map.has("Chest") && oponent_cards.has("Key") ) {
            return get_suit_from_bank("Key", oponent_bank);
        }
        // 2, ak mame Key vyber Chest (ak je v banku)
        if (play_area_map.has("Key") && oponent_cards.has("Chest")) {
            return get_suit_from_bank("Chest", oponent_bank);
        }

        // get by priority
        const priority_list = ['Hook', 'Oracle', 'Cannon', 'Map', 'Anchor'];
        for (const priority_suit of priority_list) {
            if ( oponent_cards.has(priority_suit)) {
                return get_suit_from_bank(priority_suit, oponent_bank);
            }            
        }

        // find the card with highest value
        let maxValue = 0;
        let maxSuit = "";
        for (let i = 0; i < wanted.length; i++) {
            // filter out values that are in play area
            found = false;
            if (playArea != null) {
                for (let j = 0; j < playArea.length; j++) {
                    if (playArea[j].suit == wanted[i].suit) {
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                if (wanted[i].value > maxValue) {
                    maxValue = wanted[i].value;
                    maxSuit = wanted[i].suit;
                }
            }
        }

        if (maxValue != 0) {
            return {
                "suit": maxSuit,
                "value": maxValue
            };
        } else {
            return wanted[0]; // return something that is allowed
        }
    }
    
    return first_valid;
}

function get_suit_from_bank( suit:string, oponent_bank ) {
    return  {
        "suit": suit,
        "value": Math.max.apply(Math, oponent_bank[suit]) as number
      };
}


/// --------------- valuation functions

// evaluate the given bank - sum the higest values for each suit
function get_bank_value( bank: Map<string, Array<number>> ) {

    var value = 0;

    for (const [key, values] of Object.entries(bank)) {
        value += Math.max.apply(Math, values) as number
    }

    return value;
}

// calculate score - how much we have compared to oponen (+ means we have more, 0 banks are equal, - oponent has more)
function get_score( my_bank:Map<string, Array<number>>, opeonent_bank:Map<string, Array<number>>) {
    var my_val = get_bank_value ( my_bank );
    var oponen_val = get_bank_value (opeonent_bank);

    return my_val - oponen_val;
}

// how valuable is taking curren play area (can it improve our score ?)
function get_play_area_value (play_area , my_bank:Map<string, Array<number>>) {
    var play_area_val = 0;

    for ( var i = 0; i < play_area.length; i++ ) {

        var max_suit_valu_in_bank = 0;
        if ( true == play_area[i].suit in my_bank  ) {            
            max_suit_valu_in_bank = Math.max.apply(Math,my_bank[play_area[i].suit]) as number;
        } 

        play_area_val += Math.max(play_area[i].value - max_suit_valu_in_bank, 0);
    }

    return  play_area_val;
}

/// ------------------------------------------

export function is_suit_bust_safe( next_suit, play_area, player_bank, oponent_bank ) {

    // check if in play area
    if ( true == is_suit_in_play_area( play_area, next_suit) ) return false;

    // place it to play area and chek side effect
    var new_play_area = [ ...play_area ];
    new_play_area.push( { suit: next_suit, value: 0} );

    switch ( next_suit ) {

        case "Anchor": 
        case "Key":     
        case "Chest": 
        case "Mermaid":
        case "Kraken":
        case "Cannon":
        case "Map":
        case "Oracle":
            return true;    // safe or unpredictable suits
            break;

        case "Hook":
            // if bank is epty we are safe
            if (player_bank.length == 0) return true;

            // we need check if in our bank is suit not in play area
            for ( const [bank_suit, bank_values] of Object.entries(player_bank) ) {
                var is_safe = is_suit_bust_safe( bank_suit, new_play_area, player_bank, oponent_bank );  
                if (is_safe == true) return true;
            }

            // no safe card
            return false;

            break;
        
        case "Sword":
            // chak what cards are tehre to pick
            // filter suits we do not have
            var card_list = Array();
            for (const [oponent_suit, oponent_values] of Object.entries(oponent_bank)) {    

                if ( false == oponent_suit in player_bank ) {
                    card_list.push(  {  "suit": oponent_suit, 
                                        "value": Math.max.apply(Math,oponent_values) as number } );                             
                }
            } 

            if (card_list.length == 0) return true; // no cards to pick, we are safe

            var oponent_cards = new Map(card_list.map((item) => [item.suit, item.value]));                  

            // we need check if in oponent bank is suit not in play area
            for ( const [bank_suit, bank_values] of oponent_cards ) {
                var is_safe = is_suit_bust_safe( bank_suit, new_play_area, player_bank, oponent_bank );  
                if (is_safe == true) return true;
            }

            // no safe card
            return false;

            break;

    }

    return true; // no problem found
}

// TODO - oko zobralo sword a ten ako jedinu moznost bustol
// TOTO - hook nepotiahni mec ak potom ta bustne