/**
 * SLCEE-2023-PC Arena
 * **SAP Labs CEE Hub Programming Competition 2023 Arena server**.  You can find more information about the game and the competititon rules at [github/SLCEE-2023-PC-public](https://github.com/afarago/SLCEE-2023-PC-public).   For a test run, you can use the crash test dummy user `000000000000000000000000/dummypass`.   *Note: All the APIs expect and return application/json*.
 *
 * The version of the OpenAPI document: 1.0.0
 * Contact: DL SLCEE 2023 PC <DL_637A3F6466D808029A65636A@global.corp.sap>
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 *
 */

import ApiClient from '../ApiClient';
import CardEffectType from './CardEffectType';
import CardOrNull from './CardOrNull';

/**
 * The CardEffect model module.
 * @module model/CardEffect
 * @version 1.0.0
 */
class CardEffect {
    /**
     * Constructs a new <code>CardEffect</code>.
     * Card effect associated with a special card
     * @alias module:model/CardEffect
     * @param effectType {module:model/CardEffectType} 
     */
    constructor(effectType) { 
        
        CardEffect.initialize(this, effectType);
    }

    /**
     * Initializes the fields of this object.
     * This method is used by the constructors of any subclasses, in order to implement multiple inheritance (mix-ins).
     * Only for internal use.
     */
    static initialize(obj, effectType) { 
        obj['effectType'] = effectType;
    }

    /**
     * Constructs a <code>CardEffect</code> from a plain JavaScript object, optionally creating a new instance.
     * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @param {module:model/CardEffect} obj Optional instance to populate.
     * @return {module:model/CardEffect} The populated <code>CardEffect</code> instance.
     */
    static constructFromObject(data, obj) {
        if (data) {
            obj = obj || new CardEffect();

            if (data.hasOwnProperty('effectType')) {
                obj['effectType'] = CardEffectType.constructFromObject(data['effectType']);
            }
            if (data.hasOwnProperty('cards')) {
                obj['cards'] = ApiClient.convertToType(data['cards'], [CardOrNull]);
            }
            if (data.hasOwnProperty('krakenCount')) {
                obj['krakenCount'] = ApiClient.convertToType(data['krakenCount'], 'Number');
            }
        }
        return obj;
    }

    /**
     * Validates the JSON data with respect to <code>CardEffect</code>.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @return {boolean} to indicate whether the JSON data is valid with respect to <code>CardEffect</code>.
     */
    static validateJSON(data) {
        // check to make sure all required properties are present in the JSON string
        for (const property of CardEffect.RequiredProperties) {
            if (!data[property]) {
                throw new Error("The required field `" + property + "` is not found in the JSON data: " + JSON.stringify(data));
            }
        }
        if (data['cards']) { // data not null
            // ensure the json data is an array
            if (!Array.isArray(data['cards'])) {
                throw new Error("Expected the field `cards` to be an array in the JSON data but got " + data['cards']);
            }
            // validate the optional field `cards` (array)
            for (const item of data['cards']) {
                CardOrNull.validateJsonObject(item);
            };
        }

        return true;
    }


}

CardEffect.RequiredProperties = ["effectType"];

/**
 * @member {module:model/CardEffectType} effectType
 */
CardEffect.prototype['effectType'] = undefined;

/**
 * @member {Array.<module:model/CardOrNull>} cards
 */
CardEffect.prototype['cards'] = undefined;

/**
 * @member {Number} krakenCount
 */
CardEffect.prototype['krakenCount'] = undefined;






export default CardEffect;
