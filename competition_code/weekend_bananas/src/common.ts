export interface CardEntry {
    suit: string;
    value: number;
}


export function first_card_from_bank( bank ) {

    var key = Object.keys(bank)[0];
    var card_vals = Object.values(bank)[0];

    return {
        "suit": key,
        "value": Math.max.apply(Math, card_vals) as number
      };
}

export function checkCardinDeck(card: string, deck: any) : Boolean{
    const deckMap = new Map(Object.entries(deck));
    for (let key of deckMap.keys()) {
        const pickCard = deckMap.get(key) as CardEntry;
        if(pickCard.suit == card)
            return true;
    }
    return false;
}

export function logEffectResponse(effectType: any, card:any){
    if(card === null){
        console.log(`[-> ${effectType} handler: NULL response ]`); 
    }
    else{
        console.log(`[-> ${effectType} handler: selected card response >> ${card.suit} , ${card.value} << ]`); 
    }

}

export function logEffectNoResponse(effectType: any){
    console.log(`[-> Ignoring ${effectType}: no handler triggered ]`); 
}