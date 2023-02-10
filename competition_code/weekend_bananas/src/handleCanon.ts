export function handleCannon( oponent_bank: Map<string, Array<number>> ) {
    let killCardName: string = "";
    let killCardValue = 0;
    let killCardPointLost: number = -1; 

    const map = new Map(Object.entries(oponent_bank));
    
    for (let key of map.keys()) {
        const valArr = map.get(key) as Array<number>;
        valArr.sort((n1 : number, n2 :number) => n1 - n2);
    
        let ptLost = 0;
        if (valArr.length == 1){ // only one card, take value from first element
            ptLost = valArr[0];
        }
        else if (valArr.length>1){ // mozem zostrelit len najvyssiu ak je kariet viac
            const l = valArr.length;
            ptLost = valArr[l-1]- valArr[l-2];
        }
        
        if(ptLost > killCardPointLost){ //remember the biggest point lost
            killCardName = key;
            killCardValue = valArr[valArr.length-1];
            killCardPointLost = ptLost; // remember max point losts
        }
    }
      
    console.log(`handleCannon: removing ${killCardName}, ${killCardValue} calculated point loss ${killCardPointLost} `);
    return {
        "suit": killCardName,
        "value": killCardValue
    }; 
}