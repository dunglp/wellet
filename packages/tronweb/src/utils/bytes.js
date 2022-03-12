/* eslint-disable func-style */
import { Base64 } from './base64';

/* Convert a byte to string */
export function byte2hexStr(byte) {
  const hexByteMap = '0123456789ABCDEF';
  let str = '';
  str += hexByteMap.charAt(byte >> 4);
  str += hexByteMap.charAt(byte & 0x0f);
  return str;
}

/**
 * Converts a byte array to string
 *
 * @param {Uint8Array} arr byte array
 * @returns {string}
 */
export function bytesToString(arr) {
  if (typeof arr === 'string') return arr;

  let str = '';
  const _arr = arr;
  for (let i = 0; i < _arr.length; i++) {
    const one = _arr[i].toString(2);
    const v = one.match(/^1+?(?=0)/);
    if (v && one.length === 8) {
      const bytesLength = v[0].length;
      let store = _arr[i].toString(2).slice(7 - bytesLength);
      for (let st = 1; st < bytesLength; st++)
        store += _arr[st + i].toString(2).slice(2);

      str += String.fromCharCode(parseInt(store, 2));
      i += bytesLength - 1;
    } else str += String.fromCharCode(_arr[i]);
  }
  return str;
}

/**
 * Converts a hex string to a decoded string
 *
 * @param {string} hex
 * @returns {string}
 */
export function hextoString(hex) {
  const arr = hex.split('');
  let out = '';
  for (let i = 0; i < arr.length / 2; i++) {
    const tmp = `0x${arr[i * 2]}${arr[i * 2 + 1]}`;
    out += String.fromCharCode(tmp);
  }
  return out;
}

export function base64DecodeFromString(string64) {
  return new Base64().decodeToByteArray(string64);
}

export function byteArray2hexStr(byteArray) {
  let str = '';
  for (let i = 0; i < byteArray.length; i++) str += byte2hexStr(byteArray[i]);

  return str;
}

export function base64EncodeToString(bytes) {
  const b = new Base64();
  const string64 = b.encodeIgnoreUtf8(bytes);

  return string64;
}
