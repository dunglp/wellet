/* eslint-disable no-unused-vars */
import StorageService from '../StorageService';
import randomUUID from 'uuid/v4';
import TronWeb from '@tronlink/tronweb';
import SunWeb from 'sunweb';
import Logger from '@tronlink/lib/logger';
import {
  CONTRACT_ADDRESS,
  SIDE_CHAIN_ID,
  NODE,
  devMode,
} from '@tronlink/lib/constants';
import { BigNumber } from 'bignumber.js';

const logger = new Logger('NodeService');

const NodeService = {
  _chains: {
    _: {
      name: 'WELUPS',
      default: true,
    },
    //[ SIDE_CHAIN_ID ]:{
    //    name:'DAppChain',
    //    default:false
    //}
  },
  _nodes: {
    // 'f0b1e38e-7bee-485e-9d3f-69410bf30682': {
    //     name: 'Mainnet Testnet',
    //     fullNode: 'http://47.252.84.158:8070',
    //     solidityNode: 'http://47.252.84.158:8071',
    //     eventServer: 'http://47.252.81.14:8070',
    //     default: true, // false
    //     chain:'_',
    //     connect: SIDE_CHAIN_ID
    // },
    'f0b1e38e-7bee-485e-9d3f-69410bf30681': {
      name: 'Mainnet',
      //fullNode: 'http://172.104.32.164:16667',
      //solidityNode: 'http://172.104.32.164:16668',
      //eventServer: 'http://172.104.32.164:16667',
      fullNode: devMode
        ? 'http://172.104.51.182:16667'
        : 'http://13.213.231.230:16667',
      solidityNode: devMode
        ? 'http://172.104.51.182:16'
        : 'http://13.213.231.230:16667',
      eventServer: devMode
        ? 'http://172.104.51.182:166'
        : 'http://13.213.231.230:16667',
      //fullNode: 'http://13.213.231.230:16667',
      //solidityNode: 'http://13.213.231.230:16668',
      //eventServer: 'http://13.213.231.230:16667',
      default: true, // false
      chain: '_',
      //connect: SIDE_CHAIN_ID
    },
    //'6739be94-ee43-46af-9a62-690cf0947269': {
    //    name: 'Shasta Testnet',
    //    fullNode: 'http://172.104.51.182:16667',
    //    solidityNode: 'http://172.104.51.182:16668',
    //    eventServer: 'http://172.104.51.182:16667',
    //    default: false,
    //    chain:'_'
    //},
    // 'a981e232-a995-4c81-9653-c85e4d05f598':{
    //     name: 'SideChain Testnet',
    //     fullNode: 'http://47.252.85.90:8070',
    //     solidityNode: 'http://47.252.85.90:8071',
    //     eventServer: 'http://47.252.87.129:8070',
    //     default: true,
    //     chain:SIDE_CHAIN_ID
    // },
    // 'a981e232-a995-4c81-9653-c85e4d05f599':{
    //     name: 'DappChain',
    //     fullNode: 'https://sun.tronex.io',
    //     solidityNode: 'https://sun.tronex.io',
    //     eventServer: 'https://sun.tronex.io',
    //     default: true,
    //     chain: SIDE_CHAIN_ID
    // },
  },
  _selectedChain: '_',
  _selectedNode: 'f0b1e38e-7bee-485e-9d3f-69410bf30681',
  _read() {
    logger.info('Reading nodes and chains from storage');

    const { chainList = {}, selectedChain = false } = StorageService.chains;
    this._chains = { ...this._chains, ...chainList };

    const { nodeList = {}, selectedNode = false } = StorageService.nodes;

    this._nodes = {
      ...this._nodes,
      ...nodeList,
    };

    this._nodes = Object.entries(this._nodes)
      .map(([nodeId, node]) => {
        if (!node.hasOwnProperty('chain')) node.chain = '_';

        return [nodeId, node];
      })
      .reduce((accumulator, currentValue) => {
        accumulator[currentValue[0]] = currentValue[1];
        return accumulator;
      }, {});

    if (selectedChain) this._selectedChain = selectedChain;

    if (selectedNode) this._selectedNode = selectedNode;
  },

  init() {
    this._read();
    this._updateTronWeb();
  },

  _updateTronWeb(skipAddress = false) {
    const { fullNode, solidityNode, eventServer } = this.getCurrentNode();

    // this.sunWeb = new SunWeb(
    //     //{fullNode:'https://api.trongrid.io',solidityNode:'https://api.trongrid.io',eventServer:'https://api.trongrid.io'},
    //     //{fullNode:'https://sun.tronex.io',solidityNode:'https://sun.tronex.io',eventServer:'https://sun.tronex.io'},
    //     NODE.MAIN,
    //     NODE.SIDE,
    //     CONTRACT_ADDRESS.MAIN,
    //     CONTRACT_ADDRESS.SIDE,
    //     SIDE_CHAIN_ID
    // );

    this.tronWeb = new TronWeb(fullNode, solidityNode, eventServer);
    if (!skipAddress) this.setAddress();
  },

  setAddress() {
    if (!this.tronWeb) this._updateTronWeb();

    if (!StorageService.selectedAccount) return this._updateTronWeb(true);

    this.tronWeb.setAddress(StorageService.selectedAccount);
  },

  save() {
    Object.entries(this._nodes).forEach(([nodeID, node]) =>
      StorageService.saveNode(nodeID, node)
    );

    Object.entries(this._chains).forEach(([chainId, chain]) => {
      StorageService.saveChain(chainId, chain);
    });

    StorageService.selectChain(this._selectedChain);
    StorageService.selectNode(this._selectedNode);
    this._updateTronWeb();
  },

  getNodes() {
    return {
      nodes: this._nodes,
      selected: this._selectedNode,
    };
  },

  getChains() {
    return {
      chains: this._chains,
      selected: this._selectedChain,
    };
  },

  getCurrentNode() {
    return this._nodes[this._selectedNode];
  },

  selectNode(nodeID) {
    StorageService.selectNode(nodeID);

    this._selectedNode = nodeID;
    this._updateTronWeb();
  },

  deleteNode(nodeID) {
    StorageService.deleteNode(nodeID);
    delete this._nodes[nodeID];
    if (nodeID === this._selectedNode) {
      const nodeId = Object.entries(this._nodes).filter(
        ([nodeId, node]) => node.default && node.chain === this._selectedChain
      )[0][0];
      this.selectNode(nodeId);
      return nodeId;
    }
    return false;
  },

  selectChain(chainId) {
    StorageService.selectChain(chainId);
    this._selectedChain = chainId;
    this._updateTronWeb();
  },

  addNode(node) {
    const nodeID = randomUUID();

    this._nodes[nodeID] = {
      ...node,
      default: false,
    };
    this.save();
    return nodeID;
  },

  async getSmartToken(address) {
    try {
      let balance;
      const contract = await this.tronWeb.contract().at(address);
      if (!contract.name && !contract.symbol && !contract.decimals)
        return false;
      const d = await contract.decimals().call();
      const name = await contract.name().call();
      const symbol = await contract.symbol().call();
      const decimals =
        typeof d === 'object' && d._decimals ? d : new BigNumber(d).toNumber();
      const number = await contract.balanceOf(address).call();
      if (number.balance) balance = new BigNumber(number.balance).toString();
      else balance = new BigNumber(number).toString();

      const { imgUrl = false, isMapping = false } = StorageService.allTokens[
        NodeService._selectedChain === '_' ? 'mainchain' : 'sidechain'
      ].filter(({ tokenId }) => tokenId === address)[0];

      return {
        name: typeof name === 'object' ? name._name : name,
        symbol: typeof symbol === 'object' ? symbol._symbol : symbol,
        decimals: typeof decimals === 'object' ? decimals._decimals : decimals,
        balance,
        imgUrl,
        isMapping,
      };
    } catch (ex) {
      logger.error(`Failed to fetch token ${address}:`, ex);
      return false;
    }
  },
};

export default NodeService;
