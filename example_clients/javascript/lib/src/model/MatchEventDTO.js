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
import Card from './Card';
import CardEffect from './CardEffect';
import CardEffectType from './CardEffectType';
import CardOrNull from './CardOrNull';
import IStateDelta from './IStateDelta';
import MatchEventType from './MatchEventType';

/**
 * The MatchEventDTO model module.
 * @module model/MatchEventDTO
 * @version 1.0.0
 */
class MatchEventDTO {
    /**
     * Constructs a new <code>MatchEventDTO</code>.
     * Match Response Event DTO
     * @alias module:model/MatchEventDTO
     */
    constructor() { 
        
        MatchEventDTO.initialize(this);
    }

    /**
     * Initializes the fields of this object.
     * This method is used by the constructors of any subclasses, in order to implement multiple inheritance (mix-ins).
     * Only for internal use.
     */
    static initialize(obj) { 
    }

    /**
     * Constructs a <code>MatchEventDTO</code> from a plain JavaScript object, optionally creating a new instance.
     * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @param {module:model/MatchEventDTO} obj Optional instance to populate.
     * @return {module:model/MatchEventDTO} The populated <code>MatchEventDTO</code> instance.
     */
    static constructFromObject(data, obj) {
        if (data) {
            obj = obj || new MatchEventDTO();

            if (data.hasOwnProperty('eventType')) {
                obj['eventType'] = MatchEventType.constructFromObject(data['eventType']);
            }
            if (data.hasOwnProperty('matchStartedSeed')) {
                obj['matchStartedSeed'] = ApiClient.convertToType(data['matchStartedSeed'], 'String');
            }
            if (data.hasOwnProperty('drawCard')) {
                obj['drawCard'] = Card.constructFromObject(data['drawCard']);
            }
            if (data.hasOwnProperty('cardPlayedEffect')) {
                obj['cardPlayedEffect'] = CardEffect.constructFromObject(data['cardPlayedEffect']);
            }
            if (data.hasOwnProperty('cardPlacedToPlayAreaCard')) {
                obj['cardPlacedToPlayAreaCard'] = Card.constructFromObject(data['cardPlacedToPlayAreaCard']);
            }
            if (data.hasOwnProperty('cardRemovedFromBankCard')) {
                obj['cardRemovedFromBankCard'] = Card.constructFromObject(data['cardRemovedFromBankCard']);
            }
            if (data.hasOwnProperty('cardRemovedFromBankIndex')) {
                obj['cardRemovedFromBankIndex'] = ApiClient.convertToType(data['cardRemovedFromBankIndex'], 'Number');
            }
            if (data.hasOwnProperty('turnEndedIsSuccessful')) {
                obj['turnEndedIsSuccessful'] = ApiClient.convertToType(data['turnEndedIsSuccessful'], 'Boolean');
            }
            if (data.hasOwnProperty('turnEndedBonusCards')) {
                obj['turnEndedBonusCards'] = ApiClient.convertToType(data['turnEndedBonusCards'], [Card]);
            }
            if (data.hasOwnProperty('turnEndedDelta')) {
                obj['turnEndedDelta'] = IStateDelta.constructFromObject(data['turnEndedDelta']);
            }
            if (data.hasOwnProperty('matchEndedScores')) {
                obj['matchEndedScores'] = ApiClient.convertToType(data['matchEndedScores'], ['Number']);
            }
            if (data.hasOwnProperty('matchEndedWinnerIdx')) {
                obj['matchEndedWinnerIdx'] = ApiClient.convertToType(data['matchEndedWinnerIdx'], 'Number');
            }
            if (data.hasOwnProperty('matchEndedTerminated')) {
                obj['matchEndedTerminated'] = ApiClient.convertToType(data['matchEndedTerminated'], 'Boolean');
            }
            if (data.hasOwnProperty('responseToEffectType')) {
                obj['responseToEffectType'] = CardEffectType.constructFromObject(data['responseToEffectType']);
            }
            if (data.hasOwnProperty('responseToEffectCard')) {
                obj['responseToEffectCard'] = CardOrNull.constructFromObject(data['responseToEffectCard']);
            }
            if (data.hasOwnProperty('turnStartedDelta')) {
                obj['turnStartedDelta'] = IStateDelta.constructFromObject(data['turnStartedDelta']);
            }
            if (data.hasOwnProperty('comment')) {
                obj['comment'] = ApiClient.convertToType(data['comment'], 'String');
            }
            if (data.hasOwnProperty('playerIndex')) {
                obj['playerIndex'] = ApiClient.convertToType(data['playerIndex'], 'Number');
            }
        }
        return obj;
    }

    /**
     * Validates the JSON data with respect to <code>MatchEventDTO</code>.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @return {boolean} to indicate whether the JSON data is valid with respect to <code>MatchEventDTO</code>.
     */
    static validateJSON(data) {
        // ensure the json data is a string
        if (data['matchStartedSeed'] && !(typeof data['matchStartedSeed'] === 'string' || data['matchStartedSeed'] instanceof String)) {
            throw new Error("Expected the field `matchStartedSeed` to be a primitive type in the JSON string but got " + data['matchStartedSeed']);
        }
        // validate the optional field `drawCard`
        if (data['drawCard']) { // data not null
          Card.validateJSON(data['drawCard']);
        }
        // validate the optional field `cardPlayedEffect`
        if (data['cardPlayedEffect']) { // data not null
          CardEffect.validateJSON(data['cardPlayedEffect']);
        }
        // validate the optional field `cardPlacedToPlayAreaCard`
        if (data['cardPlacedToPlayAreaCard']) { // data not null
          Card.validateJSON(data['cardPlacedToPlayAreaCard']);
        }
        // validate the optional field `cardRemovedFromBankCard`
        if (data['cardRemovedFromBankCard']) { // data not null
          Card.validateJSON(data['cardRemovedFromBankCard']);
        }
        if (data['turnEndedBonusCards']) { // data not null
            // ensure the json data is an array
            if (!Array.isArray(data['turnEndedBonusCards'])) {
                throw new Error("Expected the field `turnEndedBonusCards` to be an array in the JSON data but got " + data['turnEndedBonusCards']);
            }
            // validate the optional field `turnEndedBonusCards` (array)
            for (const item of data['turnEndedBonusCards']) {
                Card.validateJsonObject(item);
            };
        }
        // validate the optional field `turnEndedDelta`
        if (data['turnEndedDelta']) { // data not null
          IStateDelta.validateJSON(data['turnEndedDelta']);
        }
        // ensure the json data is an array
        if (!Array.isArray(data['matchEndedScores'])) {
            throw new Error("Expected the field `matchEndedScores` to be an array in the JSON data but got " + data['matchEndedScores']);
        }
        // validate the optional field `matchEndedWinnerIdx`
        if (data['matchEndedWinnerIdx']) { // data not null
          Number.validateJSON(data['matchEndedWinnerIdx']);
        }
        // validate the optional field `responseToEffectCard`
        if (data['responseToEffectCard']) { // data not null
          CardOrNull.validateJSON(data['responseToEffectCard']);
        }
        // validate the optional field `turnStartedDelta`
        if (data['turnStartedDelta']) { // data not null
          IStateDelta.validateJSON(data['turnStartedDelta']);
        }
        // ensure the json data is a string
        if (data['comment'] && !(typeof data['comment'] === 'string' || data['comment'] instanceof String)) {
            throw new Error("Expected the field `comment` to be a primitive type in the JSON string but got " + data['comment']);
        }
        // validate the optional field `playerIndex`
        if (data['playerIndex']) { // data not null
          Number.validateJSON(data['playerIndex']);
        }

        return true;
    }


}



/**
 * @member {module:model/MatchEventType} eventType
 */
MatchEventDTO.prototype['eventType'] = undefined;

/**
 * @member {String} matchStartedSeed
 */
MatchEventDTO.prototype['matchStartedSeed'] = undefined;

/**
 * @member {module:model/Card} drawCard
 */
MatchEventDTO.prototype['drawCard'] = undefined;

/**
 * @member {module:model/CardEffect} cardPlayedEffect
 */
MatchEventDTO.prototype['cardPlayedEffect'] = undefined;

/**
 * @member {module:model/Card} cardPlacedToPlayAreaCard
 */
MatchEventDTO.prototype['cardPlacedToPlayAreaCard'] = undefined;

/**
 * @member {module:model/Card} cardRemovedFromBankCard
 */
MatchEventDTO.prototype['cardRemovedFromBankCard'] = undefined;

/**
 * @member {Number} cardRemovedFromBankIndex
 */
MatchEventDTO.prototype['cardRemovedFromBankIndex'] = undefined;

/**
 * @member {Boolean} turnEndedIsSuccessful
 */
MatchEventDTO.prototype['turnEndedIsSuccessful'] = undefined;

/**
 * @member {Array.<module:model/Card>} turnEndedBonusCards
 */
MatchEventDTO.prototype['turnEndedBonusCards'] = undefined;

/**
 * @member {module:model/IStateDelta} turnEndedDelta
 */
MatchEventDTO.prototype['turnEndedDelta'] = undefined;

/**
 * @member {Array.<Number>} matchEndedScores
 */
MatchEventDTO.prototype['matchEndedScores'] = undefined;

/**
 * @member {Number} matchEndedWinnerIdx
 */
MatchEventDTO.prototype['matchEndedWinnerIdx'] = undefined;

/**
 * @member {Boolean} matchEndedTerminated
 */
MatchEventDTO.prototype['matchEndedTerminated'] = undefined;

/**
 * @member {module:model/CardEffectType} responseToEffectType
 */
MatchEventDTO.prototype['responseToEffectType'] = undefined;

/**
 * @member {module:model/CardOrNull} responseToEffectCard
 */
MatchEventDTO.prototype['responseToEffectCard'] = undefined;

/**
 * @member {module:model/IStateDelta} turnStartedDelta
 */
MatchEventDTO.prototype['turnStartedDelta'] = undefined;

/**
 * @member {String} comment
 */
MatchEventDTO.prototype['comment'] = undefined;

/**
 * @member {Number} playerIndex
 */
MatchEventDTO.prototype['playerIndex'] = undefined;






export default MatchEventDTO;
