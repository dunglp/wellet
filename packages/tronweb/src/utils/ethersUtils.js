/* eslint-disable func-style */
import { utils } from 'ethers';
// const keccak256 = require('keccak256');
const keccak256 = utils.keccak256;
// import keccak256 from 'keccak256';
const sha256 = utils.sha256;
const toUtf8Bytes = utils.toUtf8Bytes;
const toUtf8String = utils.toUtf8String;
const recoverAddress = utils.recoverAddress;
const SigningKey = utils.SigningKey;
const AbiCoder = utils.AbiCoder;

function stripHexPrefix(value) {
  return value.slice(0, 2) === '0x' ? value.slice(2) : value;
}

function toChecksumAddress(address, chainId = null) {
  if (typeof address !== 'string') return '';

  if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
    throw new Error(
      `Given address "${address}" is not a valid Ethereum address.`
    );
  }

  const stripAddress = stripHexPrefix(address).toLowerCase();
  const prefix = chainId != null ? `${chainId.toString()}0x` : '';

  const c256 = utils.id(prefix + stripAddress);
  const hex = c256.toString('hex');

  const keccakHash = hex.replace(/^0x/i, '');
  let checksumAddress = '0x';

  for (let i = 0; i < stripAddress.length; i++) {
    checksumAddress +=
      parseInt(keccakHash[i], 16) >= 8
        ? stripAddress[i].toUpperCase()
        : stripAddress[i];
  }

  return checksumAddress;
}

export {
  keccak256,
  sha256,
  toUtf8Bytes,
  toUtf8String,
  recoverAddress,
  SigningKey,
  AbiCoder,
  toChecksumAddress,
};
