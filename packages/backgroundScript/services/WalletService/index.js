import Logger from '@tronlink/lib/logger';
import EventEmitter from 'eventemitter3';
import StorageService from '../StorageService';
import NodeService from '../NodeService';
import Account from './Account';
import axios from 'axios';
import extensionizer from 'extensionizer';
import Utils from '@tronlink/lib/utils';
import TronWeb from '@tronlink/tronweb';

import {
    APP_STATE,
    ACCOUNT_TYPE,
    CONTRACT_ADDRESS,
    API_URL
} from '@tronlink/lib/constants';

const logger = new Logger('WalletService');
let basicPrice;
let smartPrice;
let usdtPrice;
class Wallet extends EventEmitter {
    constructor() {
        super();

        this.state = APP_STATE.UNINITIALISED;
        this.selectedAccount = false;
        this.isConfirming = false;
        this.popup = false;
        this.accounts = {};
        this.contractWhitelist = {}; // sign white list for trigger smart contract
        this.appWhitelist = {};      // sign white list for string limit some website
        this.phishingList = [];      // dapp phishing list (if it doesn't exit on the list the website will jump a phishing page for risk warning)
        this.confirmations = [];
        this.timer = {};
        this.vTokenList = []; //add v icon in the  token list
        // This should be moved into its own component
        this.shouldPoll = false;
        this._checkStorage(); //change store by judge
        // this.bankContractAddress = 'TMdSctThYMVEuGgPU8tumKc1TuyinkeEFK'; //test
        this.bankContractAddress = 'TPgbgZReSnPnJeXPakHcionXzsGk6kVqZB'; //online
        this.ledgerImportAddress = [];
        this.times = 0;
        setInterval(() => {
            this._updatePrice();
            this.setCache();
        }, 30 * 60 * 1000);

    }

    async _checkStorage() {
        if(await StorageService.dataExists() || StorageService.needsMigrating)
            this._setState(APP_STATE.PASSWORD_SET); // initstatus APP_STATE.PASSWORD_SET
    }

    migrate(password) {
        if(!StorageService.needsMigrating) {
            logger.info('No migration required');
            return false;
        }

        StorageService.authenticate(password);

        const {
            error = false,
            accounts,
            selectedAccount
        } = StorageService.migrate();

        if(error)
            return false;

        localStorage.setItem('TronLink_WALLET.bak', localStorage.getItem('TronLink_WALLET'));
        localStorage.removeItem('TronLink_WALLET');

        accounts.forEach(account => (
            this.importAccount(account)
        ));

        this.selectAccount(selectedAccount);

        // Force "Reboot" TronLink
        this.state = APP_STATE.PASSWORD_SET;
        StorageService.ready = false;

        this.unlockWallet(StorageService.password);

        return true;
    }

    _setState(appState) {
        if(this.state === appState)
            return;

        logger.info(`Setting app state to ${ appState }`);

        this.state = appState;
        this.emit('newState', appState);
        // if(appState === APP_STATE.DAPP_LIST) {
        //     ga('send', 'event', {
        //         eventCategory: 'Dapp List',
        //         eventAction: 'Recommend',
        //         eventLabel: 'Recommend',
        //         eventValue: TronWeb.address.fromHex(this.selectedAccount),
        //         userId: Utils.hash(TronWeb.address.toHex(this.selectedAccount))
        //     });
        // }

        return appState;
    }

    _loadAccounts() {
        const accounts = StorageService.getAccounts();
        const selected = StorageService.selectedAccount;
        Object.entries(accounts).forEach(([ address, account ]) => {
            const accountObj = new Account(
                account.type,
                account.mnemonic || account.privateKey || account.address,
                account.accountIndex
            );

            accountObj.loadCache();
            accountObj.update([], [], 0);

            this.accounts[ address ] = accountObj;
        });

        this.selectedAccount = selected;
    }

    async _pollAccounts() {
        clearTimeout(this.timer);
        if(!this.shouldPoll) {
            logger.info('Stopped polling');
            return;
        }

        const accounts = Object.values(this.accounts);
        if(accounts.length > 0) {
            // const { data: { data: basicTokenPriceList } } = await axios.get('https://bancor.trx.market/api/exchanges/list?sort=-balance').catch(e => {
            //     logger.error('get trc10 token price fail');
            //     return { data: { data: [] } };
            // });
            //const { data: { data: { rows: smartTokenPriceList } } } = await axios.get('https://api.trx.market/api/exchange/marketPair/list').catch(e => {
            const { data: { data: { result: smartTokenPriceList } } } = await axios.get('https://api-main.welscan.io/tokenrecords?page=1&limit=4000').catch(e => {
                logger.error('get wrc20 token price fail');
                return { data: { data: { rows: [] } } };
            });
            const prices = StorageService.prices;
            logger.info("Storage's prices: ", StorageService.prices)
            logger.info("original tokens list retrieved: ", smartTokenPriceList)
            //basicPrice = basicTokenPriceList;
            basicPrice = [];
            smartPrice = smartTokenPriceList.filter( ({token_record_type}) => token_record_type === "WRC20");
            logger.info("smartPrice retrieved: ", smartPrice)

            //usdtPrice = prices.usdtPriceList ? prices.usdtPriceList[ prices.selected ] : 0;
            for (const account of accounts) {
                if (account.address === this.selectedAccount) {
                    Promise.all([account.update(basicPrice, smartPrice/*, usdtPrice*/)]).then(() => {
                        if (account.address === this.selectedAccount) {
                            this.emit('setAccount', this.selectedAccount);
                        }
                    }).catch(e => {
                        logger.error(`update account ${account.address} fail`, e);
                    });
                } else {
                    await account.update(basicPrice, smartPrice/*, usdtPrice*/);
                }
            }
            this.emit('setAccounts', this.getAccounts());
        }
        this.timer = setTimeout(() => {
            this._pollAccounts(); // ??TODO repeatedly request
        }, 10000);
    }

    async _updatePrice() {
        if(!StorageService.ready)
            return;

        //const prices = axios('https://min-api.cryptocompare.com/data/price?fsym=TRX&tsyms=USD,CNY,GBP,EUR,BTC,ETH');
        //const usdtPrices = axios('https://min-api.cryptocompare.com/data/price?fsym=USDT&tsyms=USD,CNY,GBP,EUR,BTC,ETH');
        const prices = axios('https://price-api.crypto.com/price/v1/exchange/welups-blockchain')
        Promise.all([prices]).then(res => {
            //StorageService.setPrices(res[0].data, res[1].data);
            logger.info("Get price list: ", res[0].data)
            const fiat = res[0].data.fiat
            const cryp = res[0].data.crypto
            const savePrices = 
              { USD: fiat.usd,
                CNY: fiat.cny,
                GBP: fiat.gbp,
                EUR: fiat.eur,
                BTC: cryp.btc,
                ETH: cryp.eth, 
              }
            logger.info("Gonna setPrices: ", savePrices)
            StorageService.setPrices(savePrices, null);
            logger.info("Price list set to storage: ", StorageService.prices)

            //this.emit('setPriceList', [res[0].data, res[1].data]);
            this.emit('setPriceList', [savePrices,null])}
            ).catch(e => {
            logger.error('Failed to update prices',e);
        });

    }

    selectCurrency(currency) {
        StorageService.selectCurrency(currency);
        this.emit('setCurrency', currency);
    }

    async _updateWindow() {
        return new Promise(resolve => {
            if(typeof chrome !== 'undefined') {
                return extensionizer.windows.update(this.popup.id, { focused: true }, window => {
                    resolve(!!window);
                });
            }

            extensionizer.windows.update(this.popup.id, {
                focused: true
            }).then(resolve).catch(() => resolve(false));
        });
    }

    async _openPopup() {
        if(this.popup && this.popup.closed)
            this.popup = false;

        if(this.popup && await this._updateWindow())
            return;

        if(typeof chrome !== 'undefined') {
            return extensionizer.windows.create({
                url: 'packages/popup/build/index.html',
                type: 'popup',
                width: 360,
                height: 600,
                left: 25,
                top: 25
            }, window => this.popup = window);
        }

        this.popup = await extensionizer.windows.create({
            url: 'packages/popup/build/index.html',
            type: 'popup',
            width: 360,
            height: 600,
            left: 25,
            top: 25
        });
    }

    _closePopup() {
        if(this.confirmations.length)
            return;

        if(!this.popup)
            return;

        extensionizer.windows.remove(this.popup.id);
        this.popup = false;
    }

    startPolling() {

        logger.info('Started polling');

        this.shouldPoll = true;
        this._pollAccounts();
    }

    stopPolling() {
        this.shouldPoll = false;
    }

    async refresh() {
        this.setCache(false);
        let res;
        const accounts = Object.values(this.accounts);
        for(const account of accounts) {
            if(account.address === this.selectedAccount) {
                const r = await account.update(basicPrice, smartPrice, usdtPrice).catch(e => false);
                if(r) {
                    res = true;
                    this.emit('setAccount', this.selectedAccount);
                } else {
                    res = false;
                }
            }else{
                continue;
                //await account.update(basicPrice,smartPrice);
            }
        }
        this.emit('setAccounts', this.getAccounts());
        return res;
    }

    changeState(appState) {
        const stateAry = [
            APP_STATE.PASSWORD_SET,
            APP_STATE.RESTORING,
            APP_STATE.CREATING,
            APP_STATE.RECEIVE,
            APP_STATE.SEND,
            APP_STATE.TRANSACTIONS,
            APP_STATE.SETTING,
            APP_STATE.ADD_TRC20_TOKEN,
            APP_STATE.READY,
            //APP_STATE.TRONBANK,
            //APP_STATE.TRONBANK_RECORD,
            //APP_STATE.TRONBANK_DETAIL,
            //APP_STATE.TRONBANK_HELP,
            //APP_STATE.USDT_INCOME_RECORD,
            //APP_STATE.USDT_ACTIVITY_DETAIL,
            //APP_STATE.DAPP_LIST,
            APP_STATE.ASSET_MANAGE,
            APP_STATE.TRANSACTION_DETAIL,
            //APP_STATE.DAPP_WHITELIST,
            //APP_STATE.LEDGER,
            //APP_STATE.LEDGER_IMPORT_ACCOUNT,
            APP_STATE.NODE_MANAGE,
            APP_STATE.TRANSFER
        ];
        if(!stateAry.includes(appState))
            return logger.error(`Attempted to change app state to ${ appState }. Only 'restoring' and 'creating' is permitted`);

        this._setState(appState);
    }

    async resetState() {
        logger.info('Resetting app state');

        if(!await StorageService.dataExists())
            return this._setState(APP_STATE.UNINITIALISED);

        if(!StorageService.hasAccounts && !StorageService.ready)
            return this._setState(APP_STATE.PASSWORD_SET);

        if(!StorageService.hasAccounts && StorageService.ready)
            return this._setState(APP_STATE.UNLOCKED);

        if(StorageService.needsMigrating)
            return this._setState(APP_STATE.MIGRATING);

        if(this.state === APP_STATE.REQUESTING_CONFIRMATION && this.confirmations.length)
            return;

        this._setState(APP_STATE.READY);
    }

    // We shouldn't handle requests directly in WalletService.
    setPassword(password) {
        if(this.state !== APP_STATE.UNINITIALISED)
            return Promise.reject('ERRORS.ALREADY_INITIALISED');

        StorageService.authenticate(password);
        StorageService.save();
        NodeService.save();

        this._updatePrice();

        logger.info('User has set a password');
        this._setState(APP_STATE.UNLOCKED);

        const node = NodeService.getCurrentNode();

        this.emit('setNode', {
            fullNode: node.fullNode,
            solidityNode: node.solidityNode,
            eventServer: node.eventServer
        });
    }

    async unlockWallet(password) {
        if(this.state !== APP_STATE.PASSWORD_SET) {
            logger.error('Attempted to unlock wallet whilst not in PASSWORD_SET state');
            return Promise.reject('ERRORS.NOT_LOCKED');
        }

        if(StorageService.needsMigrating) {
            const success = this.migrate(password);

            if(!success)
                return Promise.reject('ERRORS.INVALID_PASSWORD');

            return;
        }

        const unlockFailed = await StorageService.unlock(password);
        if(unlockFailed) {
            logger.error(`Failed to unlock wallet: ${ unlockFailed }`);
            return Promise.reject(unlockFailed);
        }

        if(!StorageService.hasAccounts) {
            logger.info('Wallet does not have any accounts');
            return this._setState(APP_STATE.UNLOCKED);
        }

        NodeService.init();

        this._loadAccounts();
        this._updatePrice();

        // Bandage fix to change old ANTE to new ANTE
        Object.keys(this.accounts).forEach(address => {
            const account = this.accounts[ address ];
            const tokens = account.tokens;

            const oldAddress = 'TBHN6guS6ztVVXbFivajdG3PxFUZ5UXGxY';
            const newAddress = 'TCN77KWWyUyi2A4Cu7vrh5dnmRyvUuME1E';

            if(!tokens.hasOwnProperty(oldAddress))
                return;

            tokens[ newAddress ] = tokens[ oldAddress ];
            delete tokens[ oldAddress ];
        });
        const node = NodeService.getCurrentNode();
        this.emit('setNode', {
            fullNode: node.fullNode,
            solidityNode: node.solidityNode,
            eventServer: node.eventServer
        });
        this.emit('setAccount', this.selectedAccount);
        const setting = this.getSetting();
        setting.lock.lockTime = new Date().getTime();
        this.setSetting(setting);
        if (this.confirmations.length === 0) {
            await this.setCache();
            this._setState(APP_STATE.READY);
        } else {
            this._setState(APP_STATE.REQUESTING_CONFIRMATION);
        }
    }

    async lockWallet() {
        StorageService.lock();
        this.accounts = {};
        this.selectedAccount = false;
        this.appWhitelist = {};
        this.emit('setAccount', this.selectedAccount);
        this._setState(APP_STATE.PASSWORD_SET);
    }

    queueConfirmation(confirmation, uuid, callback) {
        this.confirmations.push({
            confirmation,
            callback,
            uuid
        });

        // if(this.state === APP_STATE.PASSWORD_SET) {
        //     this.emit('setConfirmations', this.confirmations);
        //     this._openPopup();
        //     return;
        // }

        if(this.state !== APP_STATE.REQUESTING_CONFIRMATION)
            this._setState(APP_STATE.REQUESTING_CONFIRMATION);

        logger.info('Added confirmation to queue', confirmation);

        this.emit('setConfirmations', this.confirmations);
        this._openPopup();
    }

    whitelistContract(confirmation, duration) {
        const {
            input: {
                contract_address: address
            },
            contractType,
            hostname
        } = confirmation;
        //if(!address)
        //    return Promise.reject('INVALID_CONFIRMATION');

        if(contractType !== 'TriggerSmartContract'){
            //return Promise.reject('INVALID_CONFIRMATION');
            //this.contractWhitelist[ hostname ] = {};
            if(!this.appWhitelist[ hostname ])
                this.appWhitelist[ hostname ] = {};

            this.appWhitelist[ hostname ].duration = duration === -1 ? -1 : Date.now() + duration;
            logger.info(`Added auto sign on host ${ hostname } with duration ${ duration } to whitelist`);

            ga('send', 'event', {
                eventCategory: 'Transaction',
                eventAction: 'Whitelisted Transaction',
                eventLabel: confirmation.contractType || 'SignMessage',
                eventValue: duration,
                referrer: hostname,
                userId: Utils.hash(TronWeb.address.toHex(this.selectedAccount))
            });

        } else {
            if(!this.contractWhitelist[ address ])
                this.contractWhitelist[ address ] = {};

            this.contractWhitelist[ address ][ hostname ] = (
                duration === -1 ?
                    -1 :
                    Date.now() + duration
            );

            logger.info(`Added contact ${ address } on host ${ hostname } with duration ${ duration } to whitelist`);

            ga('send', 'event', {
                eventCategory: 'Smart Contract',
                eventAction: 'Whitelisted Smart Contract',
                eventLabel: TronWeb.address.fromHex(confirmation.input.contract_address),
                eventValue: duration,
                referrer: confirmation.hostname,
                userId: Utils.hash(confirmation.input.owner_address)
            });
        }




        this.acceptConfirmation();
    }

    acceptConfirmation(whitelistDuration) {
        if(!this.confirmations.length)
            return Promise.reject('NO_CONFIRMATIONS');

        if(this.isConfirming)
            return Promise.reject('ALREADY_CONFIRMING');

        this.isConfirming = true;

        const {
            confirmation,
            callback,
            uuid
        } = this.confirmations.pop();

        if(whitelistDuration !== false)
            this.whitelistContract(confirmation, whitelistDuration);

        ga('send', 'event', {
            eventCategory: 'Transaction',
            eventAction: 'Confirmed Transaction',
            eventLabel: confirmation.contractType || 'SignMessage',
            eventValue: confirmation.input.amount || 0,
            referrer: confirmation.hostname,
            userId: Utils.hash(TronWeb.address.toHex(this.selectedAccount))
        });

        callback({
            success: true,
            data: confirmation.signedTransaction,
            uuid
        });

        this.isConfirming = false;
        if(this.confirmations.length) {
            this.emit('setConfirmations', this.confirmations);
        }
        this._closePopup();
        this.resetState();
    }

    rejectConfirmation() {
        if(this.isConfirming)
            return Promise.reject('ALREADY_CONFIRMING');

        this.isConfirming = true;

        const {
            confirmation,
            callback,
            uuid
        } = this.confirmations.pop();

        ga('send', 'event', {
            eventCategory: 'Transaction',
            eventAction: 'Rejected Transaction',
            eventLabel: confirmation.contractType || 'SignMessage',
            eventValue: confirmation.input.amount || 0,
            referrer: confirmation.hostname,
            userId: Utils.hash(
                TronWeb.address.toHex(this.selectedAccount)
            )
        });

        callback({
            success: false,
            data: 'Confirmation declined by user',
            uuid
        });

        this.isConfirming = false;
        if(this.confirmations.length) {
            this.emit('setConfirmations', this.confirmations);
        }
        this._closePopup();
        this.resetState();
    }

    /**
     *
     * @param mnemonic
     * @param name
     * @returns {Promise.<boolean>} create an account with mnemonic after confirming by generated mnemonic
     */

    async addAccount({ mnemonic, name }) {
        logger.info(`Adding account '${ name }' from popup`);
        if(Object.keys(this.accounts).length === 0) {
            this.setCache();
        }

        const account = new Account(
            ACCOUNT_TYPE.MNEMONIC,
            mnemonic
        );

        const {
            address
        } = account;

        account.name = name;

        this.accounts[ address ] = account;
        StorageService.saveAccount(account);

        this.emit('setAccounts', this.getAccounts());
        this.selectAccount(address);
        return true;
    }


    // This and the above func should be merged into one
    /**
     *
     * @param privateKey
     * @param name
     * @returns {Promise.<boolean>}
     */

    async importAccount({ privateKey, name }) {
        logger.info(`Importing account '${ name }' from popup`);

        const account = new Account(
            privateKey.match(/^W/) && TronWeb.isAddress(privateKey) ? ACCOUNT_TYPE.LEDGER : ACCOUNT_TYPE.PRIVATE_KEY,
            privateKey
        );

        const {
            address
        } = account;

        account.name = name;
        if(Object.keys(this.accounts).length === 0) {
            this.setCache();
        }
        this.accounts[ address ] = account;
        StorageService.saveAccount(account);

        this.emit('setAccounts', this.getAccounts());
        this.selectAccount(address);
        return true;
    }

    async setCache(isResetPhishingList = true ){
        const selectedChain = NodeService._selectedChain;
        // No dapps and dapps list in Welups yet
        //const dapps   = axios.get('https://dappradar.com/api/xchain/dapps/theRest');
        //const dapps2  = axios.get('https://dappradar.com/api/xchain/dapps/list/0');
        //Promise.all([dapps, dapps2]).then(res => {
        //    const tronDapps =  res[ 0 ].data.data.list.concat(res[ 1 ].data.data.list).filter(({ protocols: [ type ] }) => type === 'tron').map(({ logo: icon, url: href, title: name }) => ({ icon, href, name }));
        //    StorageService.saveAllDapps(tronDapps);
        //});
        StorageService.saveAllDapps([]); // placeholder

        //const wrc10tokens = axios.get('https://apilist.tronscan.org/api/token?showAll=1&limit=4000&fields=tokenID,name,precision,abbr,imgUrl,isBlack');
        //const wrc20tokens = axios.get('https://apilist.tronscan.org/api/tokens/overview?start=0&limit=1000&filter=trc20');
        // const trc20tokens_s = axios.get('https://dappchainapi.tronscan.org/api/tokens/overview?start=0&limit=1000&filter=trc20');
        const allTokens = axios.get('https://api-main.welscan.io/tokenrecords?page=1&limit=4000');
        logger.info("allTokens: ", allTokens)
        Promise.all([allTokens/*, trc20tokens_s*/]).then(res => {
            let t = [];
            let t2 = [];
            res[ 0 ].data.data.result.forEach(({ token_abbreviation, token_name, token_icon = false, _id = false, precision = false, reputation = "" }) => {
                t.push({ tokenId: _id.toString(), contractAddress: _id.toString(), abbr: token_abbreviation, name: token_name, imgUrl: token_icon, decimals: precision, isBlack: reputation === "OK" || reputation === "Neutral" ? false:true });
            });
            //res[ 0 ].data.data.concat( res[ 2 ].data.tokens).forEach(({ abbr, name, imgUrl = false, tokenID = false, contractAddress = false, decimal = false, precision = false, isBlack = false }) => {
            //    t2.push({ tokenId: tokenID ? tokenID.toString() : contractAddress, abbr, name, imgUrl, decimals: precision || decimal || 0, isBlack });
            //});
            StorageService.saveAllTokens(t,t2);
            logger.info("Saved tokens: ", StorageService.allTokens)
        });

        if(isResetPhishingList) {
            // No actual endorsed official tokens list in Wel, commented out for now
            //axios.get(`${API_URL}/api/wallet/official_token`,{headers:{chain:selectedChain==='_'?'MainChain':'DAppChain'}}).then(res=>{
            //    StorageService.saveVTokenList(res.data.data);
            //    this.emit('setVTokenList',res.data.data);
            //}).catch(e => {
            //    this.emit('setVTokenList',StorageService.vTokenList);
            //});
            // Place holder:
            let defaultVTokens = [ "_",
                                   "WX3TqrQhKQwsr9JmffDCpvnHPQEjTSsLo2",
                                   "WGhwAci8yc9iUG49EYHHG4dYRWUmtJ6HX4",
                                   "WSBn3fEJ4T2jgN4zNANowqCDu5Amrvcq4Z",
                                   "WNv26nED9uEiq2QUg8jKLraANGsvePVKNh",
                                   "WUbqyEmnqw9VnGX9HgNNwjCTCWDc4NvY2T",
                                   "WWhP6WRpzHfbgayxziwNLs6eaSEXx1himy",
                                   "WC7NG6yqFgTYdhVfbepcmi77Mt8ZH25LZx",
                                   "WBwjpWTNgcH6Kq6jSUiwbCb1gYYGfrohQi",
                                   "WHaLiDn6vmeJxcM88ZQCMzdPtMP2eTsVfQ",
                                   "WWLyrhGw9zunBunHGe6cLwmGXu41vE9Ehd",
                                   "WWMFBAcLuAFFznkyPT1VFNnLr7tL7tKuQp",
                                   "WQVvxcytJ4vn13XTe66SGbDaEpNiHaZV2q",
                                   "WLmBJ4ztZDK97oo7vSyyHA8pN5xUbAaQ5p",
                                   "WQYwqb6LUZxb7A9umiYUYiefWbwBfTyvtz",
                                   "WEgmFQce5Z3WqBpS58WPPf3Xz5XmRujrNn",
                                   "WTxDfG6U1Dwkj5xmyiyLmQBg4xfxoNoXHw",
                                   "WSn5Vyh6jYP9y26HMudpjPvPMPNT62zBiM",
                                   "WHK1FePxNfPDqdxoCyfbAwAXWKr4yafrWZ",
                                   "WQUALWY4swk6LeEMJHcXy7QXdeZkRZwq7f",
                                   "WFXZZVTAC4HTKCAHG66Sxnc4j5DTz8tjRi",
                                   "WRem49meRB1EzUERjReCACWWQarVx4uejp",
                                   "WTzcrz483AXNppkoBcJZGRB2gayJnMNhra",
                                   "WEweutcYrn3SJ9phHysQkumvp5s8dYgtAm",
                                   "WDfC3g7SHUfETRVwLp3gP9vVeuCuT7PXoE",
                                   "WT4ffbanqK67PBQqF9axbQmRQjY99sptrV",
                                   "WUyHdVQyzqExF6GF52p6ba341jCvRPWwGr",
                                   "WFynPHV2JMz18BsB4HREcuNGoRuh9SBUJ8" ]
            StorageService.saveVTokenList(defaultVTokens);
            this.emit('setVTokenList',defaultVTokens);


            // No phising list in Welscan yet
            //const {data: {data: phishingList}} = await axios.get(`${API_URL}/api/activity/website/blacklist`).catch(e => ({data: {data: []}}));
            this.phishingList = [] //phishingList.map(v => ({url: v, isVisit: false}));
        }
    }

    selectAccount(address) {
        StorageService.selectAccount(address);
        NodeService.setAddress();
        this.selectedAccount = address;
        this.emit('setAccount', address);
    }

    async selectNode(nodeID) {
        NodeService.selectNode(nodeID);

        Object.values(this.accounts).forEach(account => (
            account.reset()
        ));

        const node = NodeService.getCurrentNode();
        NodeService.selectChain(node.chain);
        this.emit('setNode', {
            fullNode: node.fullNode,
            solidityNode: node.solidityNode,
            eventServer: node.eventServer
        });
        this.emit('setAccounts', this.getAccounts());
        this.emit('setAccount', this.selectedAccount);

    }

    async selectChain(chainId) {
        if(StorageService.chains.selectedChain !== chainId) {
            const chains = NodeService.getChains();
            const nodes = NodeService.getNodes();
            const node = Object.entries(nodes.nodes).filter(([nodeId, node]) => node.chain === chainId && node.default)[0];
            await this.selectNode(node[0]);
            NodeService.selectChain(chainId);
            chains.selected = chainId;
            this.emit('setChain', chains);
        }
    }

    addNode(node) {
        NodeService.addNode(node)
        // this.selectNode(
        //
        // );
    }

    deleteNode(nodeId){
        const id = NodeService.deleteNode(nodeId);
        id  ? this.selectNode(id) : null;
    }

    getAccounts(sideChain = false) {
        const accounts = Object.entries(this.accounts).reduce((accounts, [ address, account ]) => {
            if(sideChain && account.type === ACCOUNT_TYPE.LEDGER)
                return;

            accounts[ address ] = {
                name: account.name,
                balance: account.balance + account.frozenBalance,
                energyUsed: account.energyUsed,
                totalEnergyWeight: account.totalEnergyWeight,
                TotalEnergyLimit: account.TotalEnergyLimit,
                energy: account.energy,
                netUsed: account.netUsed,
                netLimit: account.netLimit,
                tokenCount: Object.keys(account.tokens.basic).length + Object.keys(account.tokens.smart).length,
                asset: account.asset,
                type: account.type,
                frozenBalance: account.frozenBalance
            };

            return accounts;
        }, {});

        return accounts;
    }

    setSelectedToken(token) {
        StorageService.setSelectedToken(token);
        this.emit('setSelectedToken', token);
    }

    getSelectedToken() {
        return JSON.stringify(StorageService.selectedToken) === '{}' ? { id: '_', name: 'WEL', abbr:'wel', amount: 0, decimals: 6 } : StorageService.selectedToken;
    }

    setLanguage(language) {
        StorageService.setLanguage(language);
        this.emit('setLanguage', language);
    }

    setSetting(setting) {
        StorageService.setSetting(setting);
        this.emit('setSetting', setting);
    }

    getLanguage() {
        return StorageService.language;
    }

    getSetting() {
        return StorageService.getSetting();
    }

    getAccountDetails(address) {
        if(!address) {
            return {
                tokens: {
                    basic: {},
                    smart: {}
                },
                type: false,
                name: false,
                address: false,
                balance: 0,
                transactions: {
                    cached: [],
                    uncached: 0
                }
            };
        }

        return this.accounts[ address ].getDetails();
    }

    getSelectedAccount() {
        if(!this.selectedAccount)
            return false;

        return this.getAccountDetails(this.selectedAccount);
    }

    getAccount(address) {
        return this.accounts[ address ];
    }

    deleteAccount() {
        delete this.accounts[ this.selectedAccount ];
        StorageService.deleteAccount(this.selectedAccount);

        this.emit('setAccounts', this.getAccounts());

        if(!Object.keys(this.accounts).length) {
            this.selectAccount(false);
            return this._setState(APP_STATE.UNLOCKED);
        }

        this.selectAccount(Object.keys(this.accounts)[ 0 ]);
    }

    async addSmartToken(token) {
        const {
            selectedAccount: address
        } = this;

        await this.accounts[ address ].addSmartToken(token);
        this.emit('setAccount', address);
    }

    getPrices() {
        return StorageService.prices;
    }

    getConfirmations() {
        return this.confirmations;
    }

    async sendTrx({ recipient, amount }) {
        return await this.accounts[ this.selectedAccount ].sendTrx(
            recipient,
            amount
        );
    }

    async sendBasicToken({ recipient, amount, token }) {
        return await this.accounts[ this.selectedAccount ].sendBasicToken(
            recipient,
            amount,
            token
        );
    }

    async sendSmartToken({ recipient, amount, token }) {
        return await this.accounts[ this.selectedAccount ].sendSmartToken(
            recipient,
            amount,
            token
        );
    }

    async rentEnergy({ _freezeAmount, _payAmount, _days, _energyAddress }) {
        const {
            privateKey
        } = this.accounts[ this.selectedAccount ];
        try {
            const bankContractAddress = this.bankContractAddress;
            const contractInstance = await NodeService.tronWeb.contract().at(bankContractAddress);
            const result = await contractInstance.entrustOrder(_freezeAmount, _days, _energyAddress).send(
                {
                    callValue: _payAmount,
                    shouldPollResponse: false
                },
                privateKey
            );
            return result;
        } catch(ex) {
            logger.error('Failed to rent energy:', ex);
            return Promise.reject(ex);
        }
    }

    async bankOrderNotice({ energyAddress, trxHash, requestUrl }) {
        const { data: isValid } = await axios.post(requestUrl, { receiver_address: energyAddress, trxHash } )
            .then(res => res.data)
            .catch(err => { logger.error(err); });
        if(!isValid)
            return logger.warn('Failed to get bank order data');
        return isValid;
    }

    async getBankDefaultData({ requestUrl }) {
        const { data: defaultData } = await axios(requestUrl)
            .then(res => res.data)
            .catch(err => { logger.error(err); });
        if(!defaultData)
            return logger.warn('Failed to get default data');
        return defaultData;
    }

    async isValidOverTotal ({ receiverAddress, freezeAmount, requestUrl }) {
        const { data: isValid } = await axios.get(requestUrl, { params: { receiver_address: receiverAddress, freezeAmount } })
            .then(res => res.data)
            .catch(err => { logger.error(err); });
        let isValidVal = 0;
        if(isValid) isValidVal = 0;else isValidVal = 1;
        return isValidVal;
    }

    async calculateRentCost ({ receiverAddress, freezeAmount, days, requestUrl }) {
        const { data: calculateData } = await axios.get(requestUrl, { params: { receiver_address: receiverAddress, freezeAmount, days } })
            .then(res => res.data)
            .catch(err => { logger.error(err); });
        if(!calculateData)
            return logger.warn('Failed to get payMount data');
        return calculateData;
    }

    async isValidOrderAddress({ address, requestUrl }) {
        const { data: isRentData } = await axios.get(requestUrl, { params: { receiver_address: address } })
            .then(res => res.data)
            .catch(err => { logger.error(err); });
        if(!isRentData)
            return logger.warn('Failed to get valid order address data');
        return isRentData;
    }

    async isValidOnlineAddress({ address }) {
        // const account = await NodeService.tronWeb.trx.getUnconfirmedAccount(address);
        const account = await NodeService.tronWeb.trx.getAccountResources(address);
        if(!account.TotalEnergyLimit)
            return logger.warn('Failed to get online address data');
        return account;
    }

    async getBankRecordList({ address, limit, start, type, requestUrl }) {
        const { data: { data: recordData } } = await axios.get(requestUrl, { params: { receiver_address: address, limit, start, type } })
        if(!recordData)
            return logger.warn('Failed to get bank record data');
        return recordData;
    }

    //setting bank record id
    setSelectedBankRecordId(id) {
        this.accounts[ this.selectedAccount ].selectedBankRecordId = id;
        this.emit('setAccount', this.selectedAccount);
    }

    async getBankRecordDetail({ id, requestUrl }) {
        const { data: bankRecordDetail } = await axios.get(requestUrl, { params: { id } })
            .then(res => res.data)
            .catch(err => { logger.error(err); });
        if(!bankRecordDetail)
            return logger.warn('Failed to get bank record detail data');
        return bankRecordDetail;
    }

    changeDealCurrencyPage(status) { // change deal currency page status
        console.log(`STATUS改成了${status}`);
        this.accounts[ this.selectedAccount ].dealCurrencyPage = status;
        this.emit('setAccount', this.selectedAccount);
    }

    exportAccount() {
        const {
            mnemonic,
            privateKey
        } = this.accounts[ this.selectedAccount ];

        return {
            mnemonic: mnemonic || false,
            privateKey
        };
    }

  async getTransactionsByTokenId({ tokenId, fingerprint = '', direction = "all" ,limit = 30 }) {
    const selectedChain = NodeService._selectedChain;
    const { fullNode } = NodeService.getCurrentNode();
    const address = this.selectedAccount;
    let params = {limit};
    let requestUrl =  'https://api-main.welscan.io';

    let newRecord = [];
    const finger = fingerprint || 0;
    params.start = 0;
    params.end = 0;
    params.num = 1;
    params.sort = 'desc'
    params.limit = limit * finger;
    if(!tokenId.match(/^W/) && tokenId === '_' ) {
        requestUrl += '/address/transactions/'+address;
      } else {
        requestUrl += '/contract/transactions/'+tokenId;
      }
      const transFilter = ({from_address, to_address}) => {
        switch (direction) {
          case 'to':
            return to_address === address
          case 'from':
            return from_address === address
          case 'all':
          default:
            return (to_address === address) || (from_address === address)
        }
      }
    const { data: { data: { result: records } } } = 
        await axios.get(requestUrl, { params }).
        catch(err => ({ data: { result: [], total: 0 }}));
      logger.info(`Token ${ tokenId } transactions record: `, records)
      newRecord = records.
        filter(transFilter).
        map(
          ( {hash, timestamp, to_address, from_address, amount} ) => {
            return {
              hash : hash,
              timestamp: timestamp,
              toAddress : to_address,
              fromAddress: from_address,
              amount: amount
            }});

      return { records: newRecord, finger };
  }
      

    async getNews() {
        const apiUrl = API_URL;
        const res = await axios.get(apiUrl+'/api/activity/announcement/reveal_v2').catch(e=>false);
        if(res) {
            return res.data.data;
        } else {
            return [];
        }
    }

    async getIeos() {
        const apiUrl = API_URL;
        const res = await axios.get(apiUrl+'/api/wallet/ieo').catch(e=>false);
        if(res) {
            return res.data.data;
        } else {
            return [];
        }
    }

    async addCount(id) {
        const apiUrl = API_URL;
        const res = await axios.post(apiUrl+'/api/activity/announcement/pv',{id}).catch(e=>false);
        if(res && res.data.code === 0) {
            return true;
        } else {
            return false;
        }
    }

    async setAirdropInfo(address) {
        const apiUrl = API_URL;
        const hexAddress = TronWeb.address.toHex(address);
        const res = await axios.get(apiUrl + '/api/wallet/airdrop_transaction',{ params: { address: hexAddress } }).catch(e=>false);
        if(res && res.data.code === 0) {
            this.accounts[ this.selectedAccount ].airdropInfo = res.data.data;
            this.emit('setAirdropInfo', res.data.data);
        }
    }

    async getDappList(isFromStorage = false) {
        return await StorageService.getDappList(isFromStorage);
    }

    async setDappList(dappList) {
        await StorageService.saveDappList(dappList);
        this.emit('setDappList', dappList);
    }

    async getAccountInfo(address) {
        return {
            mainchain: await NodeService.sunWeb.mainchain.trx.getUnconfirmedAccount(address),
            sidechain: await NodeService.sunWeb.sidechain.trx.getUnconfirmedAccount(address),
        };
    }

    setGaEvent({ eventCategory, eventAction, eventLabel, referrer }) {
        ga('send', 'event', {
            eventCategory,
            eventAction,
            eventLabel,
            referrer,
            userId: Utils.hash(TronWeb.address.toHex(this.selectedAccount))
        });
    }

    getAllDapps() {
        return StorageService.hasOwnProperty('allDapps') ? StorageService.allDapps : [];
    }

    updateTokens(tokens) {
        this.accounts[ this.selectedAccount ].tokens = tokens;
        this.emit('setAccount', this.selectedAccount);
    }

    getAllTokens(selectedChain = '_') {
        return StorageService.hasOwnProperty('allTokens') ? (selectedChain === '_' ? StorageService.allTokens.mainchain : StorageService.allTokens.sidechain) : {};
    }

    async setTransactionDetail(hash) {
        //const selectedChain = NodeService._selectedChain;
        const requestUrl = 'https://api-main.welscan.io';
        //const reauestUrl = 'https://apilist.tronscan.org';
        const res = await axios.get(`${requestUrl}/transaction-info/${hash}`).catch(e=>false);
        if(res) {

            let { confirmed, 
                  contract: 
                    { parameter: 
                        { raw : 
                          { owner_address: ownerAddress, 
                            to_address: toAddress } 
                        },
                      type
                    },
                  hash,
                  block_number: block,
                  timestamp = 0,
                  //consume_energy,
                  energy_fee,
                  bandwidth_fee,
                  //energy_usage
                  } = res.data.data;

            this.accounts[ this.selectedAccount ].transactionDetail = { confirmed, timestamp, ownerAddress, toAddress, hash, block, cost: { energy_fee, net_fee: bandwidth_fee }, tokenTransferInfo: parameter, contractType: type, contractData: { amount } };
            this.emit('setAccount', this.selectedAccount);
        }
        return res;
    }

    getAuthorizeDapps(){
        return StorageService.hasOwnProperty('authorizeDapps') ? StorageService.authorizeDapps : {};
    }

    setAuthorizeDapps(authorizeDapps) {
        StorageService.setAuthorizeDapps(authorizeDapps);
        this.emit('setAuthorizeDapps',authorizeDapps);
    }

    setLedgerImportAddress(address){
        this.ledgerImportAddress = address;
        this.emit('setLedgerImportAddress',address);
    }

    getLedgerImportAddress(){
        return this.hasOwnProperty('ledgerImportAddress')?this.ledgerImportAddress:[];
    }

    async getAbiCode(contract_address){
        const contract = await NodeService.tronWeb.contract().at(contract_address);
        return contract.abi;
    }

    getVTokenList(){
        return StorageService.hasOwnProperty('vTokenList') ? StorageService.vTokenList : [];
    }

    setPushMessage({iconUrl='packages/popup/static/icon.png', title, message, hash}){
        const timer = setInterval(async()=>{
            this.times++;
            if(this.times === 16){
                clearInterval(timer);
                this.times = 0;
                return;
            }
            const transaction = await NodeService.tronWeb.trx.getConfirmedTransaction(hash);
            if(transaction && transaction.txID === hash){
                clearInterval(timer);
                extensionizer.notifications.getPermissionLevel((level)=>{
                    if(level === 'granted'){
                        extensionizer.notifications.create(
                            hash,
                            {type: "basic", iconUrl, title, message, isClickable: true},
                            notifyId=>{}
                        );
                        extensionizer.notifications.onClicked.addListener(notifyId=>{
                            window.open('https://welscan.io/transaction/'+notifyId)
                        });
                    } else {}
                })
            }
        },10000);
    }

    // sidechain stuff
    async depositTrx(amount){
        return await this.accounts[ this.selectedAccount ].depositTrx(amount);
    }

    // sidechain stuff
    async withdrawTrx(amount){
        return await this.accounts[ this.selectedAccount ].withdrawTrx(amount);

    }

    // sidechain stuff
    async depositTrc10({id,amount}){
        return await this.accounts[ this.selectedAccount ].depositTrc10(id,amount);
    }

    // sidechain stuff
    async withdrawTrc10({id,amount}){
        return await this.accounts[ this.selectedAccount ].withdrawTrc10(id,amount);

    }

    // sidechain stuff
    async depositTrc20({contract_address,amount}){
        return await this.accounts[ this.selectedAccount ].depositTrc20(contract_address,amount);

    }

    // sidechain stuff
    async withdrawTrc20({contract_address,amount}){
        return await this.accounts[ this.selectedAccount ].withdrawTrc20(contract_address,amount);

    }
}
export default Wallet;
