import EventChannel from '@tronlink/lib/EventChannel';
import Logger from '@tronlink/lib/logger';
import TronWeb from '@tronlink/tronweb';
//import SunWeb from 'sunweb';

import Utils from '@tronlink/lib/utils';
import RequestHandler from './handlers/RequestHandler';
import ProxiedProvider from './handlers/ProxiedProvider';
//import SunWeb from './SunWeb';
// import SunWeb from './SunWeb/js-sdk/src/index';

const logger = new Logger('pageHook');

const pageHook = {
    proxiedMethods: {
        setAddress: false,
        sign: false
    },

    init() {
        this._bindTronWeb();
        this._bindEventChannel();
        this._bindEvents();

        this.request('init').then(({ address, node, name, type, phishingList }) => {
            if(address)
                this.setAddress({ address, name, type });

            if(node.fullNode)
                this.setNode(node);
            logger.info('Fullnode: ', node.fullNode);
            logger.info('Wellet initiated');
            const href = window.location.origin;
            const c = phishingList.filter(({ url }) => {
                const reg = new RegExp(url);
                return href.match(reg);
            });
           // if(c.length && !c[0].isVisit){
           //     window.location = 'https://www.tronlink.org/phishing.html?href='+href;
           // }
        }).catch(err => {
            logger.error('Failed to initialise welWeb', err);
        });
    },

    _bindTronWeb() {
        if(window.welWeb !== undefined)
            logger.warn('welWeb is already initiated. Wellet will overwrite the current instance');

        const welWeb = new TronWeb(
            new ProxiedProvider(),
            new ProxiedProvider(),
            new ProxiedProvider()
        );

       // const sunWeb = new SunWeb(
       //     tronWeb1,
       //     tronWeb2,
       //     //{fullNode:'https://api.trongrid.io',solidityNode:'https://api.trongrid.io',eventServer:'https://api.trongrid.io'},
       //     //{fullNode:'https://sun.tronex.io',solidityNode:'https://sun.tronex.io',eventServer:'https://sun.tronex.io'},
       //     //{fullNode:'http://47.252.84.158:8070',solidityNode:'http://47.252.84.158:8071',eventServer:'http://47.252.81.14:8070'},
       //     //{fullNode:'http://47.252.85.90:8070',solidityNode:'http://47.252.85.90:8071',eventServer:'http://47.252.87.129:8070'},
       //     CONTRACT_ADDRESS.MAIN,
       //     CONTRACT_ADDRESS.SIDE,
       //     SIDE_CHAIN_ID
       // );

        welWeb.extension = {}; //add a extension object for black list
        welWeb.extension.setVisited = (href) => {
            this.setVisited(href);
        };
        this.proxiedMethods = {
            setAddress: welWeb.setAddress.bind(welWeb),
            //setMainAddress: sunWeb.mainchain.setAddress.bind(sunWeb.mainchain),
            //setSideAddress: sunWeb.sidechain.setAddress.bind(sunWeb.sidechain),
            sign: welWeb.trx.sign.bind(welWeb)
        };

        [ 'setPrivateKey', 'setAddress', 'setFullNode', 'setSolidityNode', 'setEventServer' ].forEach(method => {
            welWeb[ method ] = () => new Error('Wellet has disabled this method');
            //sunWeb.mainchain[ method ] = () => new Error('TronLink has disabled this method');
            //sunWeb.sidechain[ method ] = () => new Error('TronLink has disabled this method');
        });

        welWeb.trx.sign = (...args) => (
            this.sign(...args)
        );

        //sunWeb.mainchain.trx.sign = (...args) => (
        //    this.sign(...args)
        //);
        //sunWeb.sidechain.trx.sign = (...args) => (
        //    this.sign(...args)
        //);

        //window.sunWeb = sunWeb;
        window.welWeb = welWeb;
    },

    _bindEventChannel() {
        this.eventChannel = new EventChannel('pageHook');
        this.request = RequestHandler.init(this.eventChannel);
    },

    _bindEvents() {
        this.eventChannel.on('setAccount', address => (
            this.setAddress(address)
        ));

        this.eventChannel.on('setNode', node => (
            this.setNode(node)
        ));
    },

    setAddress({ address, name, type }) {
        // logger.info('TronLink: New address configured');
        if(!welWeb.isAddress(address)) {
            welWeb.defaultAddress = {
                hex: false,
                base58: false
            };
            welWeb.ready = false;
        } else {
            this.proxiedMethods.setAddress(address);
            //this.proxiedMethods.setMainAddress(address);
            //this.proxiedMethods.setSideAddress(address);
            welWeb.defaultAddress.name = name;
            welWeb.defaultAddress.type = type;
            //sunWeb.mainchain.defaultAddress.name = name;
            //sunWeb.mainchain.defaultAddress.type = type;
            //sunWeb.sidechain.defaultAddress.name = name;
            //sunWeb.sidechain.defaultAddress.type = type;
            welWeb.ready = true;
        }
    },

    setNode(node) {
        // logger.info('TronLink: New node configured');
        welWeb.fullNode.configure(node.fullNode);
        welWeb.solidityNode.configure(node.solidityNode);
        welWeb.eventServer.configure(node.eventServer);

        //sunWeb.mainchain.fullNode.configure(NODE.MAIN.fullNode);
        //sunWeb.mainchain.solidityNode.configure(NODE.MAIN.solidityNode);
        //sunWeb.mainchain.eventServer.configure(NODE.MAIN.eventServer);

        //sunWeb.sidechain.fullNode.configure(NODE.SIDE.fullNode);
        //sunWeb.sidechain.solidityNode.configure(NODE.SIDE.solidityNode);
        //sunWeb.sidechain.eventServer.configure(NODE.SIDE.eventServer);
    },

    setVisited(href) {
        this.request('setVisited', {
            href
        }).then(res => res).catch(err => {
            logger.error('Failed to set visit:', err);
        });
    },

    sign(transaction, privateKey = false, useTronHeader = true, callback = false) {
        if(Utils.isFunction(privateKey)) {
            callback = privateKey;
            privateKey = false;
        }

        if(Utils.isFunction(useTronHeader)) {
            callback = useTronHeader;
            useTronHeader = true;
        }

        if(!callback)
            return Utils.injectPromise(this.sign.bind(this), transaction, privateKey, useTronHeader);

        if(privateKey)
            return this.proxiedMethods.sign(transaction, privateKey, useTronHeader, callback);

        if(!transaction)
            return callback('Invalid transaction provided');

        if(!welWeb.ready)
            return callback('User has not unlocked wallet');
        this.request('sign', {
            transaction,
            useTronHeader,
            input: (
                typeof transaction === 'string' ?
                    transaction :
                    transaction.__payload__ ||
                    transaction.raw_data.contract[ 0 ].parameter.value
            )
        }).then(transaction => (
            callback(null, transaction)
        )).catch(err => {
            logger.error('Failed to sign transaction:', err);
            callback(err);
        });
    }
};

pageHook.init();
