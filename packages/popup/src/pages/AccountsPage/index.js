/* eslint-disable camelcase */
/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable no-unused-vars */
/* eslint-disable react/jsx-key */
import React from 'react';
import CopyToClipboard from 'react-copy-to-clipboard';
import swal from 'sweetalert2';
import { Toast } from 'antd-mobile';
import { BigNumber } from 'bignumber.js';
import { PopupAPI } from '@tronlink/lib/api';
import Utils from '@tronlink/lib/utils';
import Header from '@tronlink/popup/src/controllers/PageController/Header';
import ProcessBar from '@tronlink/popup/src/components/ProcessBar';
import Button from '@tronlink/popup/src/components/Button';
import { connect } from 'react-redux';
import {
  CONTRACT_ADDRESS,
  APP_STATE,
  BUTTON_TYPE,
  ACCOUNT_TYPE,
  TOP_TOKEN,
  WELSCAN,
} from '@tronlink/lib/constants';
import { FormattedMessage, injectIntl } from 'react-intl';
import { app } from '@tronlink/popup/src';
import Alert from '@tronlink/popup/src/components/Alert';
import Input from '@tronlink/popup/src/components/Input';
import Logger from '@tronlink/lib/logger';
import './AccountsPage.scss';
import '@tronlink/popup/src/controllers/PageController/Header/Header.scss';
const trxImg = require('@tronlink/popup/src/assets/images/new/trx.png');
const token10DefaultImg = require('@tronlink/popup/src/assets/images/new/token_10_default.png');
let tronscanUrl = '';

const logger = new Logger('AccountsPage');

class AccountsPage extends React.Component {
  constructor() {
    super();
    this.onClick = this.onClick.bind(this);
    this.onDelete = this.onDelete.bind(this);
    this.onExport = this.onExport.bind(this);
    this.onConfirm = this.onConfirm.bind(this);
    this.onPasswordChange = this.onPasswordChange.bind(this);
    this.state = {
      mnemonic: false,
      privateKey: false,
      showMenuList: false,
      showChainList: false,
      showBackUp: false,
      showConfirm: false,
      showDelete: false,
      news: [],
      ieos: [],
      allTokens: [],
      password: {
        value: '',
        isValid: false,
      },
      loading: false,
      error: false,
    };
  }

  async componentDidMount() {
    const timer = setInterval(async () => {
      const allTokens = await PopupAPI.getAllTokens();
      if (allTokens.length) {
        clearInterval(timer);
        this.setState({ allTokens });
      }
    }, 100);

    const { prices, accounts } = this.props;
    const t = {
      name: 'WELUPS',
      abbr: 'WELUPS',
      id: '_',
      amount: 0,
      decimals: 6,
      price: prices.priceList[prices.selected],
      imgUrl: trxImg,
    };
    PopupAPI.setSelectedToken(t);
    tronscanUrl = WELSCAN;
    //const news = await PopupAPI.getNews();
    //const ieos = await PopupAPI.getIeos();
    //if(news.length > 0) {
    //    this.setState({ news });
    //}
    //if(ieos.length > 0) {
    //    this.runTime(ieos);
    //}
    //await PopupAPI.setAirdropInfo(accounts.selected.address);
    //const dappList = await PopupAPI.getDappList(false);
    //PopupAPI.setDappList(dappList);
    app.getChains();
  }

  runTime(ieos) {
    //for(const o of ieos) {
    //    if(o.time >= 0) {
    //        o.timer = this.getTime(o.time);
    //        o.time--;
    //    }
    //}
    //this.setState({ ieos });
    //setTimeout(() => { this.runTime(this.state.ieos); }, 1000);
  }

  getTime(time) {
    const day = Math.floor(time / (24 * 60 * 60));
    const hours = Math.floor(time / (60 * 60)) - 24 * day;
    const minutes = Math.floor((time % (60 * 60)) / 60);
    const seconds = Math.floor(time % 60);
    return [
      hours > 9 ? hours : `0${hours}`,
      minutes > 9 ? minutes : `0${minutes}`,
      seconds > 9 ? seconds : `0${seconds}`,
      day,
    ];
  }

  onClick(address) {
    const { selected } = this.props.accounts;

    if (selected.address === address) return;

    PopupAPI.selectAccount(address);
  }

  async onDelete() {
    const { formatMessage } = this.props.intl;
    if (Object.keys(this.props.accounts.accounts).length === 1) {
      swal(
        formatMessage({ id: 'At least one account is required' }),
        '',
        'warning'
      );
    } else {
      this.setState({
        showDelete: true,
      });
    }
  }

  onConfirm() {
    this.setState({
      showConfirm: true,
    });
  }

  async onExport() {
    const { password } = this.state;
    console.log(password);
    this.setState({
      loading: true,
    });

    PopupAPI.unlockExport(password.value.trim())
      .then(async () => {
        const { mnemonic, privateKey } = await PopupAPI.exportAccount();
        this.setState({
          mnemonic,
          privateKey,
          showConfirm: false,
          showBackUp: true,
          error: false,
          password: {
            value: '',
            isValid: false,
          },
        });
      })
      .catch((error) =>
        this.setState({
          error,
        })
      )
      .then(() =>
        this.setState({
          loading: false,
        })
      );
  }

  handleShowChainList() {
    this.setState({
      showMenuList: false,
      showChainList: !this.state.showChainList,
    });
  }

  handleSelectChain(chainId) {
    PopupAPI.selectChain(chainId);
    app.getNodes();
    this.handleShowChainList();
    PopupAPI.refresh();
  }

  renderAccountInfo(accounts, prices, totalMoney) {
    const { formatMessage } = this.props.intl;
    const { showMenuList } = this.state;
    const { chains } = this.props;
    return (
      <div className='accountInfo'>
        <div className='row1'>
          <div
            className='accountWrap'
            onClick={async (e) => {
              const setting = await PopupAPI.getSetting();
              const openAccountsMenu = true;
              PopupAPI.setSetting({
                ...setting,
                openAccountsMenu,
              });
            }}
          >
            <span>
              {accounts.selected.name.length > 30
                ? `${accounts.selected.name.substr(0, 30)}...`
                : accounts.selected.name}
            </span>
          </div>
          <div
            className='menu'
            onClick={(e) => {
              e.stopPropagation();
              this.setState({
                showMenuList: !showMenuList,
                showNodeList: false,
              });
            }}
          >
            <div
              className='dropList menuList'
              style={
                showMenuList
                  ? {
                      width: '160px',
                      height:
                        30 *
                        (accounts.selected.type !== ACCOUNT_TYPE.LEDGER &&
                        chains.selected === '_'
                          ? 4
                          : 2),
                      opacity: 1,
                    }
                  : {}
              }
            >
              <div
                onClick={() => {
                  PopupAPI.changeState(APP_STATE.ASSET_MANAGE);
                }}
                className='item'
              >
                <span className='icon asset'>&nbsp;</span>
                <FormattedMessage id='ASSET.ASSET_MANAGE' />
              </div>
              {accounts.selected.type !== ACCOUNT_TYPE.LEDGER &&
              chains.selected === '_' ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`${tronscanUrl}/user/freeze-balance`);
                  }}
                  className='item'
                >
                  <span className='icon frozen'>&nbsp;</span>
                  <FormattedMessage id='MENU.FROZEN_UNFROZEN' />
                </div>
              ) : null}
              {accounts.selected.type !== ACCOUNT_TYPE.LEDGER &&
              chains.selected === '_' ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`${tronscanUrl}/votes`);
                  }}
                  className='item'
                >
                  <span className='icon vote'>&nbsp;</span>
                  <FormattedMessage id='MENU.VOTE' />
                </div>
              ) : null}
              {accounts.selected.type !== ACCOUNT_TYPE.LEDGER &&
              chains.selected === '_' ? (
                <div onClick={this.onConfirm} className='item'>
                  <span className='icon backup'>&nbsp;</span>
                  <FormattedMessage id='ACCOUNTS.EXPORT' />
                </div>
              ) : null}
              {accounts.selected.type !== ACCOUNT_TYPE.LEDGER &&
              chains.selected === '_' ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(
                      `${tronscanUrl}/accounts/${accounts.selected.address}`
                    );
                  }}
                  className='item'
                >
                  <span className='icon link'>&nbsp;</span>
                  <FormattedMessage id='MENU.ACCOUNT_DETAIL' />
                </div>
              ) : null}
              {/* <div
								className='item'
								onClick={() => {
									this.onDelete();
								}}
							>
								<span className='icon delete'>&nbsp;</span>
								<FormattedMessage id='MENU.DELETE_WALLET' />
							</div> */}
            </div>
          </div>
        </div>
        <div className='row2'>
          <span>{`${accounts.selected.address.substr(
            0,
            10
          )}...${accounts.selected.address.substr(-10)}`}</span>
          <CopyToClipboard
            text={accounts.selected.address}
            onCopy={(e) => {
              Toast.info(formatMessage({ id: 'TOAST.COPY' }), 2);
            }}
          >
            <span
              className='copy'
              onClick={() => {
                Toast.info(formatMessage({ id: 'TOAST.COPY' }), 2);
              }}
            ></span>
          </CopyToClipboard>
        </div>
        <div className='row3'>
          ≈ {totalMoney} {prices.selected}
        </div>
        <div className='row4'>
          <div onClick={() => PopupAPI.changeState(APP_STATE.RECEIVE)}>
            <span></span>
            <FormattedMessage id='ACCOUNT.RECEIVE' />
          </div>
          <div onClick={() => PopupAPI.changeState(APP_STATE.SEND)}>
            <span></span>
            <FormattedMessage id='ACCOUNT.SEND' />
          </div>
        </div>
      </div>
    );
  }

  renderResource(account) {
    console.log('account : ', account);
    return (
      <>
        <div className='resource'>
          <div className='cell'>
            <div className='title'>
              <FormattedMessage id='CONFIRMATIONS.RESOURCE.BANDWIDTH' />
              <div className='num'>
                {account.netLimit - account.netUsed}
                <span>/{account.netLimit}</span>
              </div>
            </div>
            <ProcessBar
              percentage={
                (account.netLimit - account.netUsed) / account.netLimit
              }
            />
          </div>
        </div>
        <div className='resource'>
          <div className='cell'>
            <div className='title'>
              <FormattedMessage id='CONFIRMATIONS.RESOURCE.ENERGY' />
              <div className='num'>
                {account.energy - account.energyUsed}
                <span>/{account.energy}</span>
              </div>
            </div>
            <ProcessBar
              percentage={
                (account.energy - account.energyUsed) / account.energy
              }
            />
          </div>
        </div>
      </>
    );
  }

  renderIeos(ieos) {}

  renderTokens(tokens) {
    const { prices, accounts, chains } = this.props;
    console.log('===========tokens : ', tokens);
    return (
      <div className='tokens'>
        {tokens
          .filter(
            ({ tokenId, ...token }) =>
              !token.hasOwnProperty('chain') || token.chain === chains.selected
          )
          .map(({ tokenId, ...token }) => {
            //logger.debug("[tokens list] Original token to render:", token)

            const amount = new BigNumber(token.balance)
              .shiftedBy(-token.decimals)
              .toString();
            const price = token.price === undefined ? 0 : token.price;
            const money =
              tokenId === '_' || tokenId === CONTRACT_ADDRESS.USDT
                ? (price * amount).toFixed(2)
                : (price * amount * prices.priceList[prices.selected]).toFixed(
                    2
                  );
            return (
              <div
                className='tokenItem'
                onClick={() => {
                  // FIX HERE
                  const o = {
                    id: tokenId,
                    name: token.name,
                    abbr: token.abbr || token.symbol,
                    decimals: token.decimals,
                    amount,
                    price: token.price,
                    imgUrl: token.imgUrl ? token.imgUrl : token10DefaultImg,
                    isMapping: token.isMapping,
                  };
                  if (tokenId === '_') {
                    o.frozenBalance = new BigNumber(
                      accounts.selected.frozenBalance
                    )
                      .shiftedBy(-token.decimals)
                      .toString();
                    o.balance = new BigNumber(accounts.selected.balance)
                      .shiftedBy(-token.decimals)
                      .toString();
                  }
                  PopupAPI.setSelectedToken(o);
                  logger.debug(
                    '[Tokens list] set token o and change state to TRANSACTIONS: ',
                    o
                  );
                  PopupAPI.changeState(APP_STATE.TRANSACTIONS);
                }}
              >
                <img
                  src={token.imgUrl || token10DefaultImg}
                  onError={(e) => {
                    e.target.src = token10DefaultImg;
                  }}
                  alt=''
                />
                <div className='name'>
                  <span>{token.name || token.abbr || token.symbol}</span>
                  {token.isShow ? (
                    <div className='income'>
                      <FormattedMessage
                        id='USDT.MAIN.INCOME_YESTERDAY'
                        values={{
                          earning:
                            (token.income > 0 ? '+' : '') +
                            new BigNumber(token.income).toFixed(2).toString(),
                        }}
                      />
                    </div>
                  ) : null}
                  {token.isVerify ? (
                    <img
                      src={require('@tronlink/popup/src/assets/images/new/icon-verify.svg')}
                    />
                  ) : null}
                </div>
                <div className='worth'>
                  <span>{amount}</span>
                  {money > 0 && (
                    <span>
                      ≈ {money} {prices.selected}
                    </span>
                  )}
                  {money == 0 && <span></span>}
                </div>
              </div>
            );
          })}
      </div>
    );
  }

  renderDeleteAccount() {
    const { showDelete } = this.state;
    const dom = showDelete ? (
      <div className='popUp'>
        <div className='deleteAccount'>
          <div className='title'>
            <FormattedMessage id='ACCOUNTS.CONFIRM_DELETE' />
          </div>
          <div className='img'></div>
          <div className='txt'>
            <FormattedMessage id='ACCOUNTS.CONFIRM_DELETE.BODY' />
          </div>
          <div className='buttonRow'>
            <Button
              id='BUTTON.CANCEL'
              type={BUTTON_TYPE.DANGER}
              onClick={() => {
                this.setState({ showDelete: false });
              }}
              tabIndex={1}
            />
            <Button
              id='BUTTON.CONFIRM'
              onClick={() => {
                PopupAPI.deleteAccount();
                this.setState({ showDelete: false });
              }}
              tabIndex={1}
            />
          </div>
        </div>
      </div>
    ) : null;
    return dom;
  }

  onPasswordChange(value) {
    this.setState({
      password: {
        isValid: value.trim().length,
        value,
      },
    });
  }

  renderConfirmBackup() {
    const { showConfirm, password, loading, error } = this.state;

    return (
      showConfirm && (
        <div className='popUp'>
          <div className='backUp'>
            <div className='title'>
              <FormattedMessage id='ACCOUNTS.EXPORT.CONFIRM_PASSWORD' />
            </div>

            <div className='greyModal confirmPassword'>
              <div className='option'>
                {error ? (
                  <Input
                    type='password'
                    className='error'
                    placeholder='INPUT.PASSWORD'
                    value={password.value}
                    isDisabled={loading}
                    onChange={this.onPasswordChange}
                    onEnter={this.onExport}
                    tabIndex={1}
                  />
                ) : (
                  <Input
                    type='password'
                    className=''
                    placeholder='INPUT.PASSWORD'
                    value={password.value}
                    isDisabled={loading}
                    onChange={this.onPasswordChange}
                    onEnter={this.onExport}
                    tabIndex={1}
                  />
                )}

                {error ? (
                  <div className='errTip'>
                    <FormattedMessage className='modalBody' id={error} />
                  </div>
                ) : (
                  ''
                )}
              </div>
            </div>

            <div className='buttonRow'>
              <Button
                id='BUTTON.CANCEL'
                onClick={() => {
                  this.setState({ showConfirm: false });
                }}
                tabIndex={1}
              />

              <Button
                id='BUTTON.CONTINUE'
                isValid={password.isValid}
                isLoading={loading}
                onClick={this.onExport}
                tabIndex={2}
              />
            </div>
          </div>
        </div>

        // <div className='authPasswordWrap'>
        //   <div className='confirmPassword'>
        //     <div className='title'>
        //       <span>Please Enter Your Password</span>
        //     </div>
        //     <div className='option'>
        //       <div className='customInput '>
        //         <input
        //           id='input'
        //           className=''
        //           placeholder='Password'
        //           type='password'
        //           value=''
        //         />
        //       </div>
        //     </div>
        //     <div className='buttonRow'>
        //       <button className='customButton gray  is-valid'>
        //         <span>Cancel</span>
        //       </button>
        //       <button
        //         className='customButton primary  is-invalid'
        //         onClick={this.onExport}
        //       >
        //         <span>Confirm</span>
        //       </button>
        //     </div>
        //   </div>
        // </div>
      )
    );
  }

  renderBackup(mnemonic, privateKey) {
    const { showBackUp } = this.state;
    const dom = showBackUp ? (
      <div className='popUp'>
        <div className='backUp'>
          <div className='title'>
            <FormattedMessage id='ACCOUNTS.EXPORT' />
          </div>
          {mnemonic ? (
            <div className='option'>
              <FormattedMessage id='ACCOUNTS.EXPORT.MNEMONIC' />
              <div className='block'>
                {mnemonic.split(' ').map((v) => (
                  <div className='cell'>{v}</div>
                ))}
              </div>
            </div>
          ) : null}
          {privateKey ? (
            <div className='option' style={{ marginBottom: 20 }}>
              <FormattedMessage id='ACCOUNTS.EXPORT.PRIVATE_KEY' />
              <div className='block'>{privateKey}</div>
            </div>
          ) : null}
          <div className='buttonRow'>
            <Button
              id='BUTTON.CLOSE'
              onClick={() => {
                this.setState({ showBackUp: false });
              }}
              tabIndex={1}
            />
          </div>
        </div>
      </div>
    ) : null;
    return dom;
  }

  render() {
    BigNumber.config({ EXPONENTIAL_AT: [-20, 30] });
    let totalAsset = new BigNumber(0);
    let totalTrx = new BigNumber(0);
    const {
      showChainList,
      mnemonic,
      privateKey,
      news,
      ieos,
      allTokens,
    } = this.state;
    const id = news.length > 0 ? news[0].id : 0;
    const {
      accounts,
      prices,
      nodes,
      setting,
      /*language:lng,*/ vTokenList,
      chains,
    } = this.props;

    const {
      selected: { airdropInfo },
    } = accounts;
    const mode = 'productionMode';
    const { formatMessage } = this.props.intl;
    const trx_price = prices.priceList[prices.selected];
    const trx = {
      tokenId: '_',
      name: 'WELUPS',
      balance:
        accounts.selected.balance +
        (accounts.selected.frozenBalance ? accounts.selected.frozenBalance : 0),
      abbr: 'WELUPS',
      decimals: 6,
      imgUrl: trxImg,
      price: trx_price,
      isMapping: true,
    };
    let tokens = {
      ...accounts.selected.tokens.basic,
      ...accounts.selected.tokens.smart,
    };
    logger.debug('[Render] all tokens in selected account: ', tokens);
    const topArray = [];
    TOP_TOKEN[chains.selected === '_' ? 'mainchain' : 'sidechain'].forEach(
      (v) => {
        if (tokens.hasOwnProperty(v)) {
          if (v === CONTRACT_ADDRESS.USDT) {
            const f = allTokens.filter(({ tokenId }) => tokenId === v);
            tokens[v].imgUrl = f.length
              ? allTokens.filter(({ tokenId }) => tokenId === v)[0].imgUrl
              : false;
          }
          topArray.push({ ...tokens[v], tokenId: v });
        } else {
          topArray.push({
            ...allTokens.filter(({ tokenId }) => tokenId === v)[0],
            tokenId: v,
            price: '0',
            balance: '0',
            isLocked: false,
          });
        }
      }
    );
    logger.debug('presort tokens: ', tokens);
    tokens = Utils.dataLetterSort(
      Object.entries(tokens)
        .filter(([tokenId, token]) => typeof token === 'object')
        .map((v) => {
          v[1].isMapping = v[1].hasOwnProperty('isMapping')
            ? v[1].isMapping
            : true;
          v[1].tokenId = v[0];
          return v[1];
        })
        .filter((v) => !v.isLocked),
      'abbr',
      'symbol',
      topArray
    );
    logger.debug('postsort tokens: ', tokens);
    tokens = tokens.sort((x, y) => x.balance < y.balance);
    tokens = [trx, ...tokens];
    tokens = tokens.map(({ tokenId, ...token }) => {
      token.decimals = token.decimals || 0;
      if (vTokenList.includes(tokenId)) token.isVerify = true;

      return { tokenId, ...token };
    });

    Object.entries(accounts.accounts).map(([address, account]) => {
      totalAsset = totalAsset.plus(new BigNumber(account.asset));
      totalTrx = totalTrx.plus(new BigNumber(account.balance).shiftedBy(-6));
    });
    const asset =
      accounts.accounts[accounts.selected.address] &&
      accounts.accounts[accounts.selected.address].asset
        ? accounts.accounts[accounts.selected.address].asset
        : 0;
    const totalMoney = new BigNumber(asset)
      .multipliedBy(prices.priceList[prices.selected])
      .toFixed(2);
    return (
      <div
        className='accountsPage'
        onClick={() => {
          this.setState({
            showMenuList: false,
          });
        }}
      >
        {this.renderConfirmBackup()}
        {this.renderBackup(mnemonic, privateKey)}
        {this.renderDeleteAccount()}
        <Header
          showChainList={showChainList}
          developmentMode={setting.developmentMode}
          chains={chains}
          handleSelectChain={this.handleSelectChain.bind(this)}
          handleShowChainList={this.handleShowChainList.bind(this)}
        />
        <div className='space-controller'>
          <div
            className={`accountsWrap${setting.openAccountsMenu ? ' show' : ''}`}
          >
            <div className='accounts'>
              <div className='row1'>
                <div
                  className='cell'
                  onClick={() => PopupAPI.changeState(APP_STATE.CREATING)}
                >
                  <FormattedMessage id='CREATION.CREATE.TITLE' />
                </div>
                <div
                  className='cell'
                  onClick={() => PopupAPI.changeState(APP_STATE.RESTORING)}
                >
                  <FormattedMessage id='CREATION.RESTORE.TITLE' />
                </div>
              </div>
              <div className='row2'>
                <div className='cell'>
                  <span>WELUPS:</span>
                  <span>{new BigNumber(totalTrx.toFixed(2)).toFormat()}</span>
                </div>
                <div className='cell'>
                  <FormattedMessage
                    id='MENU.ACCOUNTS.TOTAL_ASSET'
                    values={{ sign: ':' }}
                  />
                  <span>
                    {new BigNumber(
                      totalAsset.multipliedBy(trx_price).toFixed(2)
                    ).toFormat()}
                    {prices.selected}
                  </span>
                </div>
              </div>
              <div className='row3'>
                {Object.entries(accounts.accounts).map(
                  ([address, account], i) => {
                    return (
                      <div
                        className={`cell cell${(i % 5) + 1}${
                          accounts.selected.address === address
                            ? ' selected'
                            : ''
                        }`}
                        onClick={async () => {
                          const setting = await PopupAPI.getSetting();
                          const openAccountsMenu = false;
                          PopupAPI.setSetting({
                            ...setting,
                            openAccountsMenu,
                          });
                          if (accounts.selected.address === address) return;
                          PopupAPI.selectAccount(address);
                        }}
                      >
                        <div className='top'>
                          <div className='name'>
                            <div className='nameWrap'>
                              {account.name.length > 30
                                ? `${account.name.substr(0, 30)}...`
                                : account.name}
                              {account.type === ACCOUNT_TYPE.LEDGER ? (
                                <div className='ledger'>&nbsp;</div>
                              ) : null}
                            </div>
                          </div>
                          <div className='asset'>
                            <span>
                              {`WELUPS: ${new BigNumber(
                                new BigNumber(account.balance)
                                  .shiftedBy(-6)
                                  .toFixed(2)
                              ).toFormat()}`}
                            </span>
                            <span>
                              <FormattedMessage
                                id='MENU.ACCOUNTS.TOTAL_ASSET'
                                values={{
                                  sign: ':',
                                }}
                              />{' '}
                              {new BigNumber(
                                new BigNumber(account.asset)
                                  .multipliedBy(trx_price)
                                  .toFixed(2)
                              ).toFormat()}
                              {prices.selected}
                            </span>
                          </div>
                        </div>
                        <div className='bottom'>
                          <span>{`${address.substr(0, 10)}...${address.substr(
                            -10
                          )}`}</span>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <CopyToClipboard
                              text={address}
                              onCopy={(e) => {
                                Toast.info(
                                  formatMessage({
                                    id: 'TOAST.COPY',
                                  })
                                );
                              }}
                            >
                              <span className='copy'></span>
                            </CopyToClipboard>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
            <div
              className='closed'
              onClick={async () => {
                const setting = await PopupAPI.getSetting();
                const openAccountsMenu = false;
                PopupAPI.setSetting({
                  ...setting,
                  openAccountsMenu,
                });
              }}
            ></div>
          </div>
          {accounts.selected.address
            ? this.renderAccountInfo(accounts, prices, totalMoney)
            : null}
          <div className='listWrap'>
            <div className='resourceList'>
              {this.renderResource(
                accounts.accounts[accounts.selected.address]
              )}
            </div>
            {this.renderIeos(ieos)}
            <div className='scroll'>{this.renderTokens(tokens)}</div>
          </div>
        </div>
        {setting.showUpdateDescription ? (
          <div className='alertWrap'>
            <Alert
              show={setting.showUpdateDescription}
              buttonText='BUTTON.GOT_IT'
              title={formatMessage({
                id: 'ALERT.UPDATE_DESCRIPTION.TITLE',
              })}
              body={formatMessage({
                id: 'ALERT.UPDATE_DESCRIPTION.BODY',
              })}
              onClose={async () => {
                const setting = await PopupAPI.getSetting();
                PopupAPI.setSetting({
                  ...setting,
                  showUpdateDescription: false,
                });
              }}
            />
          </div>
        ) : null}
      </div>
    );
  }
}

export default injectIntl(
  connect((state) => ({
    chains: state.app.chains,
    vTokenList: state.app.vTokenList,
    //language: state.app.language,
    accounts: state.accounts,
    prices: state.app.prices,
    nodes: state.app.nodes,
    setting: state.app.setting,
  }))(AccountsPage)
);
