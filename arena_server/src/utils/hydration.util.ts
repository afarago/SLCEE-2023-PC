import { ObjectId } from 'mongodb';
import * as util from 'util';
export class Hydrate {
  /**
   * Parses an ISO-8601 string representation or epoch representation of a date value.
   * @param {String} str The date value as a string.
   * @returns {Date} The parsed date object.
   */
  static parseDate(str: any) {
    if (isNaN(str)) {
      return new Date(str.replace(/(\d)(T)(\d)/i, '$1 $3'));
    }
    return new Date(+str);
  }

  /**
   * Converts a value to the specified type.
   * @param {(String|Object)} data The data to convert, as a string or object.
   * @param {(String|Array.<String>|Object.<String, Object>|Function)} type The type to return. Pass a string for simple types
   * or the constructor function for a complex type. Pass an array containing the type name to return an array of that type. To
   * return an object, pass an object with one property whose name is the key type and whose value is the corresponding value type:
   * all properties on <code>data<code> will be converted to this type.
   * @returns An instance of the specified type or null or undefined if data is null or undefined.
   */
  static convertToType(data: any, type: any) {
    if (data === null || data === undefined) return data;
    // LATER: missing Map<>, Set<> deserialization
    switch (type) {
      case 'Boolean':
        return Boolean(data);
      case 'Integer':
        return parseInt(data, 10);
      case 'Number':
        return parseFloat(data);
      case 'String':
        return String(data);
      case 'Date':
        return Hydrate.parseDate(String(data));
      case 'Blob':
        return data;
      default:
        if (type === Object) {
          // generic object, return directly
          return data;
        } else if (typeof type.constructFromObject === 'function') {
          // for model type like User and enum class
          return type.constructFromObject(data);
        } else if (Array.isArray(type)) {
          // object was nullish ({}) so we need to return an empty array //TODO: decide whether it should be empty array ([]) or undefined later on
          if (!Array.isArray(data) && !Object.getOwnPropertyNames(data).length) {
            return [];
          }

          // for array type like: ['String']
          const itemType = type[0];

          return data.map((item: any, key: any) => {
            return Hydrate.convertPropToType(data, key, itemType);
          });
        } else if (typeof type === 'object') {
          // for plain object type like: {'String': 'Integer'}
          let keyType;
          let valueType;
          for (const k in type) {
            if (type.hasOwnProperty(k)) {
              keyType = k;
              valueType = type[k];
              break;
            }
          }

          const result: any = {};
          for (const k in data) {
            if (data.hasOwnProperty(k)) {
              const key = Hydrate.convertToType(k, keyType);
              const value = Hydrate.convertPropToType(data, k, valueType);
              result[key] = value;
            }
          }

          return result;
        } else if (type?.name === 'ObjectId' && data instanceof ObjectId) {
          // !! Object.getOwnPropertySymbols(data._id)[0] -- Symbol(id), when is ObjectId
          return data;
        } else {
          // for unknown type, return the data directly
          return data;
        }
    }
  }

  /**
   * Converts a value to the specified type.
   * @param {(String|Object)} data The data to convert, as a string or object.
   * @param {(String|Array.<String>|Object.<String, Object>|Function)} type The type to return. Pass a string for simple types
   * or the constructor function for a complex type. Pass an array containing the type name to return an array of that type. To
   * return an object, pass an object with one property whose name is the key type and whose value is the corresponding value type:
   * all properties on <code>data<code> will be converted to this type.
   * @returns An instance of the specified type or null or undefined if data is null or undefined.
   */
  static convertPropToType(source: any, prop: string, type: any) {
    try {
      return Hydrate.convertToType(source[prop], type);
    } catch (e) {
      throw Error(`Type conversion failed at field '${prop}' with value '${util.inspect(source?.[prop])}'.`);
    }
  }

  static convertFrom(source: any, prop: string, type: any, target: any, propTarget?: string) {
    if (source.hasOwnProperty(prop)) {
      try {
        target[propTarget || prop] = Hydrate.convertToType(source[prop], type);
      } catch (e) {
        throw Error(`Type conversion failed at field '${prop}' with value '${util.inspect(source?.[prop])}'.`);
      }
    }
  }
}
