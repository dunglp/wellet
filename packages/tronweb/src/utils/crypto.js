/* eslint-disable camelcase */
/* eslint-disable new-cap */
/* eslint-disable func-style */
import { ADDRESS_PREFIX, ADDRESS_PREFIX_BYTE, ADDRESS_SIZE } from './address';
import {
  base64EncodeToString,
  base64DecodeFromString,
  hexStr2byteArray,
} from './code';
import { encode58, decode58 } from './base58';
import { byte2hexStr, byteArray2hexStr } from './bytes';
import { ec as EC } from 'elliptic';
import { keccak256 } from './ethersUtils';
const jsSHA = require('@tronscan/client/src/lib/sha256');

export function getBase58CheckAddress(addressBytes) {
  const hash0 = SHA256(addressBytes);
  const hash1 = SHA256(hash0);

  let checkSum = hash1.slice(0, 4);
  checkSum = addressBytes.concat(checkSum);

  return encode58(checkSum);
}

export function decodeBase58Address(addressStr) {
  if (typeof addressStr != 'string') return false;

  if (addressStr.length <= 4) return false;

  const decodeCheck = decode58(addressStr);
  if (decodeCheck.length <= 4) return false;

  // const len = address.length;
  // const offset = len - 4;
  // const checkSum = address.slice(offset);
  const decodeData = decodeCheck.slice(0, decodeCheck.length - 4);
  const hash0 = SHA256(decodeData);
  const hash1 = SHA256(hash0);

  if (
    hash1[0] === decodeCheck[decodeData.length] &&
    hash1[1] === decodeCheck[decodeData.length + 1] &&
    hash1[2] === decodeCheck[decodeData.length + 2] &&
    hash1[3] === decodeCheck[decodeData.length + 3]
  )
    return decodeData;

  return decodeData;
  // throw new Error('Invalid address provided');
}

export function signTransaction(priKeyBytes, transaction) {
  if (typeof priKeyBytes === 'string')
    priKeyBytes = hexStr2byteArray(priKeyBytes);

  const txID = transaction.txID;
  const signature = ECKeySign(hexStr2byteArray(txID), priKeyBytes);

  if (Array.isArray(transaction.signature)) {
    if (!transaction.signature.includes(signature))
      transaction.signature.push(signature);
  } else transaction.signature = [signature];
  return transaction;
}

export function arrayToBase64String(a) {
  return btoa(String.fromCharCode(...a));
}

export function signBytes(privateKey, contents) {
  if (typeof privateKey === 'string') privateKey = hexStr2byteArray(privateKey);

  const hashBytes = SHA256(contents);
  const signBytes = ECKeySign(hashBytes, privateKey);

  return signBytes;
}

export function getRowBytesFromTransactionBase64(base64Data) {
  const bytesDecode = base64DecodeFromString(base64Data);
  const transaction = proto.protocol.Transaction.deserializeBinary(bytesDecode);
  const raw = transaction.getRawData();

  return raw.serializeBinary();
}

export function genPriKey() {
  const ec = new EC('secp256k1');
  const key = ec.genKeyPair();
  const priKey = key.getPrivate();

  let priKeyHex = priKey.toString('hex');

  while (priKeyHex.length < 64) priKeyHex = `0${priKeyHex}`;

  return hexStr2byteArray(priKeyHex);
}

export function computeAddress(pubBytes) {
  if (pubBytes.length === 65) pubBytes = pubBytes.slice(1);

  const hash = keccak256(pubBytes)
    .toString()
    .substring(2);
  const addressHex = ADDRESS_PREFIX + hash.substring(24);

  return hexStr2byteArray(addressHex);
}

export function getAddressFromPriKey(priKeyBytes) {
  const pubBytes = getPubKeyFromPriKey(priKeyBytes);
  return computeAddress(pubBytes);
}

const charConv = (char) => {
  switch (char) {
    case 't':
      return 'w';
    case 'T':
      return 'W';
    case 'w':
      return 't';
    case 'W':
      return 'T';
    default:
      return char;
  }
};

export function tronBase58toWel(tronb58) {
  if (typeof tronb58 !== 'string') return false;

  if (tronb58[0] === 'W') return tronb58;

  const ret = [...tronb58].map(charConv);
  return ret.join('');
}

export function welBase58toTron(welb58) {
  if (typeof welb58 !== 'string') return false;

  if (welb58[0] === 'T') return welb58;

  const ret = [...welb58].map(charConv);
  return ret.join('');
}

export function isAddressValid(base58Str) {
  if (typeof base58Str !== 'string') return false;

  if (base58Str.length !== ADDRESS_SIZE) return false;

  let address = decode58(base58Str);
  if (address.length !== 25) return false;

  if (address[0] !== ADDRESS_PREFIX_BYTE) return false;

  const checkSum = address.slice(21);
  address = address.slice(0, 21);

  const hash0 = SHA256(address);
  const hash1 = SHA256(hash0);
  const checkSum1 = hash1.slice(0, 4);

  if (
    checkSum[0] == checkSum1[0] &&
    checkSum[1] == checkSum1[1] &&
    checkSum[2] == checkSum1[2] &&
    checkSum[3] == checkSum1[3]
  )
    return true;

  return false;
}

export function getBase58CheckAddressFromPriKeyBase64String(
  priKeyBase64String
) {
  const priKeyBytes = base64DecodeFromString(priKeyBase64String);
  const pubBytes = getPubKeyFromPriKey(priKeyBytes);
  const addressBytes = computeAddress(pubBytes);

  return getBase58CheckAddress(addressBytes);
}

export function getHexStrAddressFromPriKeyBase64String(priKeyBase64String) {
  const priKeyBytes = base64DecodeFromString(priKeyBase64String);
  const pubBytes = getPubKeyFromPriKey(priKeyBytes);
  const addressBytes = computeAddress(pubBytes);
  const addressHex = byteArray2hexStr(addressBytes);

  return addressHex;
}

export function getAddressFromPriKeyBase64String(priKeyBase64String) {
  const priKeyBytes = base64DecodeFromString(priKeyBase64String);
  const pubBytes = getPubKeyFromPriKey(priKeyBytes);
  const addressBytes = computeAddress(pubBytes);
  const addressBase64 = base64EncodeToString(addressBytes);

  return addressBase64;
}

export function getPubKeyFromPriKey(priKeyBytes) {
  const ec = new EC('secp256k1');
  const key = ec.keyFromPrivate(priKeyBytes, 'bytes');
  const pubkey = key.getPublic();
  const x = pubkey.x;
  const y = pubkey.y;

  let xHex = x.toString('hex');

  while (xHex.length < 64) xHex = `0${xHex}`;

  let yHex = y.toString('hex');

  while (yHex.length < 64) yHex = `0${yHex}`;

  const pubkeyHex = `04${xHex}${yHex}`;
  const pubkeyBytes = hexStr2byteArray(pubkeyHex);

  return pubkeyBytes;
}

export function ECKeySign(hashBytes, priKeyBytes) {
  const ec = new EC('secp256k1');
  const key = ec.keyFromPrivate(priKeyBytes, 'bytes');
  const signature = key.sign(hashBytes);
  const r = signature.r;
  const s = signature.s;
  const id = signature.recoveryParam;

  let rHex = r.toString('hex');

  while (rHex.length < 64) rHex = `0${rHex}`;

  let sHex = s.toString('hex');

  while (sHex.length < 64) sHex = `0${sHex}`;

  const idHex = byte2hexStr(id);
  const signHex = rHex + sHex + idHex;

  return signHex;
}

export function SHA256(msgBytes) {
  const shaObj = new jsSHA('SHA-256', 'HEX');
  const msgHex = byteArray2hexStr(msgBytes);
  shaObj.update(msgHex);
  const hashHex = shaObj.getHash('HEX');
  return hexStr2byteArray(hashHex);
}

export function passwordToAddress(password) {
  const com_priKeyBytes = base64DecodeFromString(password);
  const com_addressBytes = getAddressFromPriKey(com_priKeyBytes);

  return getBase58CheckAddress(com_addressBytes);
}

export function pkToAddress(privateKey, strict = false) {
  const com_priKeyBytes = hexStr2byteArray(privateKey, strict);
  const com_addressBytes = getAddressFromPriKey(com_priKeyBytes);

  return getBase58CheckAddress(com_addressBytes);
}
