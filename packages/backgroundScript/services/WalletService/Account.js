/* eslint-disable prefer-const */
/* eslint-disable camelcase */
/* eslint-disable array-callback-return */
import StorageService from '../StorageService';
import TronWeb from '@tronlink/tronweb';
import Logger from '@tronlink/lib/logger';
import Utils from '@tronlink/lib/utils';
import NodeService from '../NodeService';

import { BigNumber } from 'bignumber.js';

import {
  ACCOUNT_TYPE,
  CONTRACT_ADDRESS,
  FEE,
  WELSCAN_API,
  //TOP_TOKEN,
  //API_URL
} from '@tronlink/lib/constants';
import axios from 'axios';

BigNumber.config({ EXPONENTIAL_AT: [-20, 30] });
const logger = new Logger('WalletService/Account');

class Account {
  constructor(accountType, importData, accountIndex = 0) {
    this.type = accountType;
    this.accountIndex = accountIndex;
    this.address = false;
    this.name = false;
    this.updatingTransactions = false;
    this.selectedBankRecordId = 0;
    this.dealCurrencyPage = 0;
    this.energy = 0;
    this.energyUsed = 0;
    this.balance = 0;
    this.frozenBalance = 0;
    this.netUsed = 0;
    this.netLimit = 0;
    this.totalEnergyWeight = 0; //totalEnergyWeight
    this.TotalEnergyLimit = 0; //TotalEnergyLimit
    this.lastUpdated = 0;
    this.asset = 0;
    this.ignoredTransactions = [];
    this.transactions = {};
    this.airdropInfo = {};
    this.transactionDetail = {};
    this.tokens = {
      basic: {},
      smart: {},
    };
    this.trxAddress = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
    // this.tokens.smart[ CONTRACT_ADDRESS.USDT ] = {
    //     abbr: 'USDT',
    //     name: 'Tether USD',
    //     decimals: 6,
    //     tokenId: CONTRACT_ADDRESS.USDT,
    //     balance: 0,
    //     price: 0
    // };
    if (accountType == ACCOUNT_TYPE.MNEMONIC) this._importMnemonic(importData);
    else this._importPrivateKey(importData);

    this.loadCache();
  }

  static generateAccount() {
    const mnemonic = Utils.generateMnemonic();

    return new Account(ACCOUNT_TYPE.MNEMONIC, mnemonic);
  }

  _importMnemonic(mnemonic) {
    if (!Utils.validateMnemonic(mnemonic)) throw new Error('INVALID_MNEMONIC');

    this.mnemonic = mnemonic;

    const { privateKey, address } = this.getAccountAtIndex(this.accountIndex);

    this.privateKey = privateKey;
    this.address = address;
  }

  _importPrivateKey(privateKey) {
    try {
      if (privateKey.match(/^W/) && TronWeb.isAddress(privateKey)) {
        this.privateKey = null;
        this.address = privateKey;
      } else {
        this.privateKey = privateKey;
        this.address = TronWeb.address.fromPrivateKey(privateKey);
      }
    } catch (ex) {
      // eslint-disable-line
      throw new Error('INVALID_PRIVATE_KEY');
    }
  }

  getAccountAtIndex(index = 0) {
    if (this.type !== ACCOUNT_TYPE.MNEMONIC) {
      throw new Error(
        'Deriving account keys at a specific index requires a mnemonic account'
      );
    }

    return Utils.getAccountAtIndex(this.mnemonic, index);
  }

  loadCache() {
    if (!StorageService.hasAccount(this.address)) {
      return logger.warn(
        'Attempted to load cache for an account that does not exist'
      );
    }

    const {
      type,
      name,
      balance,
      frozenBalance,
      totalEnergyWeight,
      TotalEnergyLimit,
      transactions,
      tokens,
      netLimit,
      netUsed,
      energy,
      energyUsed,
      lastUpdated,
      asset,
    } = StorageService.getAccount(this.address);

    // Old TRC10 structure are no longer compatible
    //tokens.basic = {};

    // Remove old token transfers so they can be fetched again
    Object.keys(this.transactions).forEach((txID) => {
      const transaction = this.transactions[txID];

      if (transaction.type !== 'TransferAssetContract') return;

      if (transaction.tokenID) return;

      delete this.transactions[txID];
    });

    this.type = type;
    this.name = name;
    this.balance = balance;
    this.frozenBalance = frozenBalance;
    this.totalEnergyWeight = totalEnergyWeight;
    this.TotalEnergyLimit = TotalEnergyLimit;
    this.transactions = transactions;
    this.tokens = tokens;
    this.energy = energy;
    this.energyUsed = energyUsed;
    this.netLimit = netLimit;
    this.netUsed = netUsed;
    this.lastUpdated = lastUpdated;
    this.asset = asset;
    this.hash = '';
  }

  matches(accountType, importData) {
    if (this.type !== accountType) return false;

    if (accountType == ACCOUNT_TYPE.MNEMONIC && this.mnemonic === importData)
      return true;

    if (
      accountType == ACCOUNT_TYPE.PRIVATE_KEY &&
      this.privateKey === importData
    )
      return true;

    return false;
  }

  reset() {
    this.balance = 0;
    this.frozenBalance = 0;
    this.energy = 0;
    this.energyUsed = 0;
    this.netUsed = 0;
    this.transactions = {};
    this.ignoredTransactions = [];
    this.netLimit = 0;
    this.asset = 0;

    /*
        Object.keys(this.tokens.smart).forEach(address => (
             this.tokens.smart[ address ].balance = 0
         ));
         */
    this.tokens.smart = {};
    this.tokens.basic = {};
  }

  /** update data of an account
   * basicTokenPriceList  trc10token price list(source from trxmarket)
   * smartTokenPriceList  trc20token price list(source from trxmarket)
   * usdtPrice            price of usdt
   **/
  async update(
    basicTokenPriceList = [],
    smartTokenPriceList = [] /*, usdtPrice = 0*/
  ) {
    if (
      !StorageService.allTokens[
        NodeService._selectedChain === '_' ? 'mainchain' : 'sidechain'
      ].length
    )
      return;
    const selectedChain = NodeService._selectedChain;
    const { address } = this;
    logger.info(`Requested update for ${address}`);
    //const { data: { data: smartTokens } } = await axios.get(`${API_URL}/api/wallet/trc20_info`, {
    //    headers: { chain: selectedChain === '_' ? 'MainChain' : 'DAppChain' },
    //    params: { address }
    //   return { data: { data: [] } };
    const {
      data: {
        data: { result: smartTokens },
      },
    } = await axios
      .get(`${WELSCAN_API}/address/token/${address}`, {
        params: { page: 1, limit: 4000 },
      })
      .catch((e) => {
        logger.info(`Error when getting smartTokens for ${address}:`, e);
        return { data: { data: { result: [] } } };
      });
    logger.debug(`[account update] smart tokens for ${address}: `, smartTokens);
    try {
      const node = NodeService.getNodes().selected;
      //if (node === 'f0b1e38e-7bee-485e-9d3f-69410bf30681') {
      const account = await NodeService.tronWeb.trx.getUnconfirmedAccount(
        address
      );

      if (!account.address) {
        logger.info(`Account ${address} does not exist on the network`);
        this.reset();
        return true;
        //account = { // default value for account for debugging purpose
        //  "address": address,
        //  "balance": 0,
        //  "account_resource": {},
        //  "owner_permission": {
        //    "permission_name": "owner",
        //    "threshold": 1,
        //    "keys": [
        //      {
        //        "address": address,
        //        "weight": 1
        //      }
        //    ]
        //  },
        //  "active_permission": [
        //    {
        //      "type": "Active",
        //      "id": 2,
        //      "permission_name": "active",
        //      "threshold": 1,
        //      "operations": "7fff1fc0033e0300000000000000000000000000000000000000000000000000",
        //      "keys": [
        //        {
        //          "address": address,
        //          "weight": 1
        //        }
        //      ]
        //    }
        //  ]
        //}
      }
      logger.debug('Fetched account from network: ', account);

      const addSmartTokens = Object.entries(this.tokens.smart).filter(
        ([tokenId, token]) => !token.hasOwnProperty('abbr')
      );
      logger.debug('[update account] this.tokens: ', this.tokens);
      logger.debug('[update account] addSmartTokens: ', addSmartTokens);
      for (const [tokenId, token] of addSmartTokens) {
        logger.debug(
          '[update account] get smart contract at token ID',
          tokenId
        );
        const contract = await NodeService.tronWeb
          .contract()
          .at(tokenId)
          .catch((e) => false);
        if (contract) {
          logger.debug('[update account] smart contract', contract);
          let balance;
          const number = await contract.balanceOf(address).call();
          logger.debug(
            `[update account] ${address} balanceOf ${tokenId}: `.number
          );
          if (number.balance)
            balance = new BigNumber(number.balance).toString();
          else balance = new BigNumber(number).toString();

          if (typeof token.name === 'object' || !token.decimals) {
            const token2 = await NodeService.getSmartToken(tokenId).catch(
              (err) => {
                throw new Error(`get token ${tokenId} info fail`);
              }
            );
            this.tokens.smart[tokenId] = token2;
            logger.debug(`[update account] token at ${tokenId}: `, token2);
          }
          this.tokens.smart[tokenId].balance = balance;
          this.tokens.smart[tokenId].price = 0;
        } else {
          this.tokens.smart[tokenId].balance = 0;
          this.tokens.smart[tokenId].price = 0;
        }
        this.tokens.smart[tokenId].isLocked = token.hasOwnProperty('isLocked')
          ? token.isLocked
          : false;
      }
      logger.info('[update account] frozen balance calculation...');

      this.frozenBalance =
        ((account.frozen && account.frozen[0].frozen_balance) || 0) +
        ((account.account_resource.frozen_balance_for_energy &&
          account.account_resource.frozen_balance_for_energy.frozen_balance) ||
          0) +
        (account.delegated_frozen_balance_for_bandwidth || 0) +
        (account.account_resource.delegated_frozen_balance_for_energy || 0);
      this.balance = account.balance || 0;
      logger.debug('[update account] frozenBalance: ', this.frozenBalance);
      const filteredTokens = !account.assetV2
        ? []
        : account.assetV2.filter(({ value }) => value >= 0);

      logger.debug('[update account] balance: ', this.balance);
      logger.debug('[update account] filteredTokens: ', filteredTokens);

      for (const { key, value } of filteredTokens) {
        let token = this.tokens.basic[key] || false;

        logger.debug('[update account] token: ', token);

        const filter = basicTokenPriceList.length
          ? basicTokenPriceList.filter(
              ({ _id: first_token_id }) => first_token_id === key
            )
          : [];
        logger.debug('[update account] filter: ', filter);
        const trc20Filter = smartTokenPriceList.length
          ? smartTokenPriceList.filter(
              ({ _id: fTokenAddr }) => key === fTokenAddr
            )
          : [];
        logger.debug('[update account] trc20Filter: ', trc20Filter);
        let { precision = 0, price } = filter.length
          ? filter[0]
          : trc20Filter.length
          ? {
              price: trc20Filter[0].price_wel,
              precision: trc20Filter[0].precision,
            }
          : { price: 0, precision: 0 };
        price = price / Math.pow(10, precision);
        if (
          node === 'f0b1e38e-7bee-485e-9d3f-69410bf30681' ||
          node === 'a981e232-a995-4c81-9653-c85e4d05f599'
        ) {
          if (
            StorageService.allTokens[
              NodeService._selectedChain === '_' ? 'mainchain' : 'sidechain'
            ].filter(({ tokenId }) => tokenId === key).length === 0
          )
            return;
          const {
            name = 'WELUPS',
            abbr = 'WELUPS',
            decimals = 6,
            imgUrl = false,
          } = StorageService.allTokens[
            NodeService._selectedChain === '_' ? 'mainchain' : 'sidechain'
          ].filter(({ tokenId }) => tokenId === key)[0];
          token = {
            balance: 0,
            name,
            abbr,
            decimals,
            imgUrl,
            isLocked: token.hasOwnProperty('isLocked') ? token.isLocked : false,
          };
          this.tokens.basic[key] = {
            ...token,
            balance: value,
            price,
          };
        } else {
          if (!token && !StorageService.tokenCache.hasOwnProperty(key))
            await StorageService.cacheToken(key);

          if (StorageService.tokenCache.hasOwnProperty(key)) {
            const {
              name,
              abbr,
              decimals,
              imgUrl = false,
            } = StorageService.tokenCache[key];

            token = {
              balance: 0,
              name,
              abbr,
              decimals,
              imgUrl,
            };
          }
          this.tokens.basic[key] = {
            ...token,
            balance: value,
            price,
          };
        }
      }
      //const smartTokens = account.trc20token_balances.filter(v => v.balance >= 0);
      const sTokens = smartTokens.map(
        ({ contract_address: tokenAddress }) => tokenAddress
      );
      Object.entries(this.tokens.smart).forEach(([tokenId, token]) => {
        if (!sTokens.includes(tokenId) && token.hasOwnProperty('abbr'))
          delete this.tokens.smart[tokenId];
      });
      const allWRC20s = smartTokenPriceList;
      logger.debug(
        '[update account] smartTokens got from network: ',
        smartTokens
      );
      const smartTokensMap = {};
      smartTokens.map((tok) => (smartTokensMap[tok.contract_address] = tok));
      logger.debug('[update account] smartTokensMap: ', smartTokensMap);
      logger.debug('[update account] this.tokens before update: ', this.tokens);
      for (const {
        _id: tokenAddress,
        token_icon: logoUrl = false,
        precision: decimals = 6,
        isMapping = false,
        token_name: name,
        token_abbreviation: shortName,
        /*balance,*/ price_wel,
      } of allWRC20s) {
        let token = this.tokens.smart[tokenAddress] || false;
        //if (!smartTokensMap[tokenAddress]) {
        //  continue
        //}

        //const filter = smartTokenPriceList.filter(({ _id: fTokenAddr }) => fTokenAddr === tokenAddress);
        //const price = filter.length ? new BigNumber(filter[0].price_wel).shiftedBy(-decimals).toString() : 0;
        const price = new BigNumber(price_wel).shiftedBy(-decimals).toString();

        token = {
          price: 0,
          balance: 0,
          name,
          abbr: shortName,
          decimals,
          imgUrl: logoUrl,
          isLocked: token.hasOwnProperty('isLocked') ? token.isLocked : false,
          isMapping,
        };

        //logger.debug("[update account] updated token: ", token)

        //logger.debug("[update account] this.tokens.smart[tokenAddress]: ", this.tokens.smart[tokenAddress])
        this.tokens.smart[tokenAddress] = {
          ...token,
          //price: tokenAddress === CONTRACT_ADDRESS.USDT ? usdtPrice : price,
          price,
          balance: !smartTokensMap[tokenAddress]
            ? 0
            : smartTokensMap[tokenAddress].balanceOf,
          chain: selectedChain,
        };
        logger.debug(
          '[update account] this.tokens.smart[tokenAddress] token: ',
          this.tokens.smart[tokenAddress]
        );
      }
      logger.debug('[update account] this.tokens after update: ', this.tokens);

      logger.info('[update account] finishing up... ');

      let totalOwnTrxCount = new BigNumber(
        this.balance + this.frozenBalance
      ).shiftedBy(-6);
      Object.entries({ ...this.tokens.basic, ...this.tokens.smart }).map(
        ([tokenId, token]) => {
          if (token.price !== 0 && !token.isLocked) {
            const prices = StorageService.prices;
            const price =
              tokenId === CONTRACT_ADDRESS.USDT
                ? token.price / prices.priceList[prices.selected]
                : token.price;
            totalOwnTrxCount = totalOwnTrxCount.plus(
              new BigNumber(token.balance)
                .shiftedBy(-token.decimals)
                .multipliedBy(price)
            );
          }
        }
      );
      this.asset = totalOwnTrxCount.toNumber();
      this.lastUpdated = Date.now();
      logger.info('[update account] beginning updateBalance()');
      await Promise.all([this.updateBalance()]);
      logger.info(`Account ${address} successfully updated`);
      Object.keys(StorageService.getAccounts()).includes(this.address) &&
        this.save();
    } catch (error) {
      logger.error(`update account ${this.address} fail`, error);
    }
    return true;
  }

  async updateBalance() {
    const { address } = this;
    const res = await NodeService.tronWeb.trx.getAccountResources(address);
    logger.debug(
      `[updateBalance] getAccountResources for address ${address}: `,
      res
    );
    const {
      EnergyLimit = 0,
      EnergyUsed = 0,
      freeNetLimit,
      NetLimit = 0,
      freeNetUsed = 0,
      NetUsed = 0,
      TotalEnergyWeight,
      TotalEnergyLimit,
    } = res;
    this.energy = EnergyLimit;
    this.energyUsed = EnergyUsed;
    this.netLimit = freeNetLimit + NetLimit;
    this.netUsed = NetUsed + freeNetUsed;
    this.totalEnergyWeight = TotalEnergyWeight;
    this.TotalEnergyLimit = TotalEnergyLimit;
  }

  async addSmartToken({ address, name, decimals, symbol }) {
    logger.info(
      `Adding WRC20 token '${address}' ${name} (${symbol}) to account '${this.address}'`
    );

    let balance = 0;

    try {
      const contract = await NodeService.tronWeb.contract().at(address);
      const balanceObj = await contract.balanceOf(this.address).call();

      const bn = new BigNumber(balanceObj.balance || balanceObj);

      if (bn.isNaN()) balance = '0';
      else balance = bn.toString();
    } catch (e) {
      logger.error(`add smart token ${address} ${name} fail`, e);
    }

    const { imgUrl = false, isMapping = false } = StorageService.allTokens[
      NodeService._selectedChain === '_' ? 'mainchain' : 'sidechain'
    ].filter(({ tokenId }) => tokenId === address)[0];

    this.tokens.smart[address] = {
      balance,
      decimals,
      symbol,
      imgUrl,
      isMapping,
      name,
    };

    return this.save();
  }

  getDetails() {
    return {
      tokens: this.tokens,
      type: this.type,
      name: this.name,
      address: this.address,
      balance: this.balance,
      frozenBalance: this.frozenBalance,
      totalEnergyWeight: this.totalEnergyWeight,
      TotalEnergyLimit: this.TotalEnergyLimit,
      energy: this.energy,
      energyUsed: this.energyUsed,
      netLimit: this.netLimit,
      netUsed: this.netUsed,
      transactions: this.transactions,
      lastUpdated: this.lastUpdated,
      selectedBankRecordId: this.selectedBankRecordId,
      dealCurrencyPage: this.dealCurrencyPage,
      airdropInfo: this.airdropInfo,
      transactionDetail: this.transactionDetail,
    };
  }

  export() {
    return JSON.stringify(this);
  }

  save() {
    StorageService.saveAccount(this);
  }

  async sign(transaction, tronWeb = NodeService.tronWeb) {
    if (!this.privateKey) return 'CREATION.LEDGER.ALERT.BODY';

    const signedTransaction = tronWeb.trx.sign(transaction, this.privateKey);

    return await signedTransaction;
  }

  async sendTrx(recipient, amount) {
    const selectedChain = NodeService._selectedChain;
    try {
      if (selectedChain === '_') {
        const transaction = await NodeService.tronWeb.transactionBuilder.sendTrx(
          recipient,
          amount
        );

        await NodeService.tronWeb.trx
          .sendRawTransaction(await this.sign(transaction))
          .then(() => true)
          .catch((err) => Promise.reject('Failed to broadcast transaction'));
        return Promise.resolve(transaction.txID);
      }
      const {
        transaction,
      } = await NodeService.sunWeb.sidechain.trx.sendTransaction(
        recipient,
        amount,
        { privateKey: this.privateKey }
      );
      return Promise.resolve(transaction.txID);
    } catch (ex) {
      logger.error('Failed to send WELUPS:', ex);
      return Promise.reject(ex);
    }
  }

  async sendBasicToken(recipient, amount, token) {
    const selectedChain = NodeService._selectedChain;
    try {
      if (selectedChain === '_') {
        const transaction = await NodeService.tronWeb.transactionBuilder.sendToken(
          recipient,
          amount,
          token
        );

        await NodeService.tronWeb.trx
          .sendRawTransaction(await this.sign(transaction))
          .then(() => true)
          .catch((err) => Promise.reject('Failed to broadcast transaction'));
        return Promise.resolve(transaction.txID);
      }
      const {
        transaction,
      } = await NodeService.sunWeb.sidechain.trx.sendToken(
        recipient,
        amount,
        token,
        { privateKey: this.privateKey }
      );
      return Promise.resolve(transaction.txID);
    } catch (ex) {
      logger.error('Failed to send basic token:', ex);
      return Promise.reject(ex);
    }
  }

  async sendSmartToken(recipient, amount, token) {
    const selectedChain = NodeService._selectedChain;
    try {
      if (selectedChain === '_') {
        const contract = await NodeService.tronWeb.contract().at(token);
        const transactionId = await contract
          .transfer(recipient, amount)
          .send({ feeLimit: 10 * Math.pow(10, 6) }, this.privateKey);
        return Promise.resolve(transactionId);
      }
      const sidechain = NodeService.sunWeb.sidechain;
      const {
        transaction,
      } = await NodeService.tronWeb.transactionBuilder.triggerSmartContract(
        TronWeb.address.toHex(token),
        'transfer(address,uint256)',
        { feeLimit: 1000000 },
        [
          {
            type: 'address',
            value: recipient,
          },
          { type: 'uint256', value: amount },
        ]
      );
      const signTransaction = await sidechain.trx.sign(
        transaction,
        this.privateKey
      );
      await sidechain.trx.sendRawTransaction(signTransaction);
      return Promise.resolve(transaction.txID);
    } catch (ex) {
      logger.error('Failed to send smart token:', ex);
      return Promise.reject(ex);
    }
  }

  async depositTrx(amount) {
    try {
      const txId = await NodeService.sunWeb.depositTrx(
        amount,
        FEE.DEPOSIT_FEE,
        FEE.FEE_LIMIT,
        {},
        this.privateKey
      );
      return Promise.resolve(txId);
    } catch (ex) {
      logger.error('Failed to send TRX:', ex);
      return Promise.reject(ex);
    }
  }

  async withdrawTrx(amount) {
    try {
      const txId = await NodeService.sunWeb.withdrawTrx(
        amount,
        FEE.WITHDRAW_FEE,
        FEE.FEE_LIMIT,
        {},
        this.privateKey
      );
      return Promise.resolve(txId);
    } catch (ex) {
      logger.error('Failed to send TRX:', ex);
      return Promise.reject(ex);
    }
  }

  async depositTrc10(id, amount) {
    try {
      const txId = await NodeService.sunWeb.depositTrc10(
        id,
        amount,
        FEE.DEPOSIT_FEE,
        FEE.FEE_LIMIT,
        {},
        this.privateKey
      );
      return Promise.resolve(txId);
    } catch (ex) {
      logger.error('Failed to send TRX:', ex);
      return Promise.reject(ex);
    }
  }

  async withdrawTrc10(id, amount) {
    try {
      const txId = await NodeService.sunWeb.withdrawTrc10(
        id,
        amount,
        FEE.WITHDRAW_FEE,
        FEE.FEE_LIMIT,
        {},
        this.privateKey
      );
      return Promise.resolve(txId);
    } catch (ex) {
      logger.error('Failed to send TRX:', ex);
      return Promise.reject(ex);
    }
  }

  async depositTrc20(id, amount) {
    try {
      const approve = await NodeService.sunWeb.approveTrc20(
        amount,
        FEE.FEE_LIMIT,
        id,
        {},
        this.privateKey
      );
      if (approve) {
        const txId = await NodeService.sunWeb.depositTrc20(
          amount,
          FEE.DEPOSIT_FEE,
          FEE.FEE_LIMIT,
          id,
          {},
          this.privateKey
        );
        return Promise.resolve(txId);
      }
      return Promise.resolve('failed');
    } catch (ex) {
      logger.error('Failed to send TRX:', ex);
      return Promise.reject(ex);
    }
  }

  async withdrawTrc20(id, amount) {
    try {
      const txId = await NodeService.sunWeb.withdrawTrc20(
        amount,
        FEE.WITHDRAW_FEE,
        FEE.FEE_LIMIT,
        id,
        {},
        this.privateKey
      );
      return Promise.resolve(txId);
    } catch (ex) {
      logger.error('Failed to send TRX:', ex);
      return Promise.reject(ex);
    }
  }
}

export default Account;
