import { CardEntry, checkCardinDeck, first_card_from_bank } from "./common";
import { is_suit_bust_safe } from "./functions";


// odfiltruj karty ktore su v play area aby nas nebustlo - ak ni nic neostane tak si nahodne vyber a zmier sa s tym ze si sa bustol
// zober podla priority oko, kanon, mapu, sword
// 

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

function isSuitInCardArray(suit: string, arr: any) : { suit: string; value: number; } | null {
    for(let i=0; i < arr.length; i++){   
        if ( suit == arr[i].suit ) {
            return arr[i];
        }
    }
    return null;
}


export function handleHook(play_area: any, player_bank: any, oponent_bank: any ) : { suit: string; value: number; } {
    // odfiltruj karty ktore su v play area aby nas nebustlo 
    let wanted = Array(); 
    for (const [bank_suit, bank_values] of Object.entries(player_bank)) { 
        let card = isSuitInCardArray(bank_suit, play_area);
        var is_safe = is_suit_bust_safe( bank_suit, play_area, player_bank, oponent_bank );
        if (card == null && is_safe == true ) 
                        wanted.push({  "suit": bank_suit, 
                                         "value": Math.max.apply(Math,bank_values) as number } );                             
    }
    // ak ni nic neostane tak si  nahodne vyber a zmier sa s tym ze si sa bustol
    // todo potential optimization took card with lowest value
    if (wanted.length == 0) return first_card_from_bank (player_bank); 
    
    // 1, ak mame Chest v play area vyber Key (ak je v banku)
    let card = isSuitInCardArray("Key", wanted);
    if (checkCardinDeck("Chest", play_area) && card != null) {
        return card;
    }
    // 2, ak mame Key vyber Chest (ak je v banku)
    card = isSuitInCardArray("Chest", wanted);
    if (checkCardinDeck("Key", play_area) && card != null) {
        return card;
    }
    // 3, Sword - nam pomoze,  superovi uskodi
    card = isSuitInCardArray("Sword", wanted);
    if (card != null) return card;
    // 4, Cannon 
    card = isSuitInCardArray("Cannon", wanted);
    if (card != null) return card;
    // 4.5, Oracle
    card = isSuitInCardArray("Oracle", wanted);
    if (card != null) return card;
    // 5, Map   
    card = isSuitInCardArray("Map", wanted);
    if (card != null) return card;
    // 6, Anchor
    card = isSuitInCardArray("Anchor", wanted);
    if (card != null) return card;
    // 7, hocico ine - okrem krakena /Key, Chest, Mermaid/
    card = isSuitInCardArray("Key", wanted);
    if (card != null) return card;
    card = isSuitInCardArray("Chest", wanted);
    if (card != null) return card;
    card = isSuitInCardArray("Mermaid", wanted);
    if (card != null) return card;
    // 8, Kraken
    card = isSuitInCardArray("Kraken", wanted);
    if (card != null) return card;
    // -- ak nas vsetko bustne tak take co ma najmensiu hodnotu

    return first_card_from_bank (player_bank);

}
