import { appendFile } from "fs";
import { arrayBuffer } from "stream/consumers";
import { CardEntry } from "./common";
import { is_suit_bust_safe } from "./functions";

const eyeSuite = "Oracle";

function duplicateCard(card:CardEntry) : CardEntry{
    return {
        "suit": card.suit,
        "value": card.value
    }; 
}

// priority sword, hook, kanon, oracle, map, 
const cardSuitValues = ['Map', 'Oracle', 'Cannon', 'Hook', 'Sword'];

function getBiggerCardBySuiteAndValue(cardA:CardEntry, cardB:CardEntry) : CardEntry{
    const idxa = cardSuitValues.indexOf(cardA.suit);
    const idxb = cardSuitValues.indexOf(cardB.suit);
    if (idxa > idxb){
        return cardA;
    }
    else if (idxa < idxb){
        return cardB;
    }
    else{
        if(cardA.value>cardB.value){
            return cardA;
        }
        return cardB;

    }

}

function getBiggerCard(cardA:CardEntry | undefined, cardB:CardEntry|undefined) : CardEntry{
    
    var returnCard:CardEntry|undefined = undefined;

    if (cardA === undefined){
        returnCard = cardB;
    }
    else if (cardB === undefined){
        returnCard = cardA;
    }
    else{
        returnCard = getBiggerCardBySuiteAndValue(cardA, cardB);
    }   

    if (returnCard === undefined){
        return {
            "suit": "",
            "value": 0
        };         
    }

    return {
        "suit": returnCard.suit,
        "value": returnCard.value
    };         
    
}

export function handleMap( playAreaDeck: any, pickDeck:any, player_bank, oponent_bank ) {

   let selectedPickCard: CardEntry | undefined = undefined;
   let anycardToPick: CardEntry | undefined = undefined;
   let no_other_option: CardEntry | undefined = undefined;
    
   const playArea = new Map(Object.entries(playAreaDeck));
   const pick = new Map(Object.entries(pickDeck));

   for (let key of pick.keys()) {
        const pickCard = pick.get(key) as CardEntry;
        anycardToPick = getBiggerCard(anycardToPick, pickCard);

        if (pickCard.suit == "Kraken" && playAreaDeck.length > 1 ){
            no_other_option = pickCard;
            continue;            
        }

        var is_safe = is_suit_bust_safe(pickCard.suit, playAreaDeck, player_bank, oponent_bank);
        if (is_safe == false) {
            continue;
        }

        let skip = false;
        for (let pckey of playArea.keys()) {   // do not draw what it already at play area
            const playCard = playArea.get(pckey) as CardEntry;
            if(pickCard.suit == playCard.suit){
                skip = true;
                break;
            }
        }
        if(skip) {
            continue;
        }

        selectedPickCard = getBiggerCard(selectedPickCard, pickCard);
   }

   if (selectedPickCard === undefined) {
        if (no_other_option === undefined) {
            selectedPickCard = getBiggerCard(selectedPickCard, anycardToPick);   
        } else {
            selectedPickCard = no_other_option; // select kraken only if there is no other nonbust option
        }
       
   }

   console.log(`handleMap: choosing ${selectedPickCard.suit} , ${selectedPickCard.value} from the deck`);

   return {
       "suit": selectedPickCard.suit,
       "value": selectedPickCard.value
   }; 

  }