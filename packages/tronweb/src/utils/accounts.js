import {byteArray2hexStr} from './bytes';
import {
    getBase58CheckAddress,
    genPriKey,
    getAddressFromPriKey,
    getPubKeyFromPriKey,
    tronBase58toWel
} from './crypto';

export function generateAccount() {
    const priKeyBytes = genPriKey();
    const pubKeyBytes = getPubKeyFromPriKey(priKeyBytes);
    const addressBytes = getAddressFromPriKey(priKeyBytes);

    const privateKey = byteArray2hexStr(priKeyBytes);
    const publicKey = byteArray2hexStr(pubKeyBytes);

    return {
        privateKey,
        publicKey,
        address: {
            base58: tronBase58toWel(getBase58CheckAddress(addressBytes)),
            hex: byteArray2hexStr(addressBytes)
        }
    }
}
