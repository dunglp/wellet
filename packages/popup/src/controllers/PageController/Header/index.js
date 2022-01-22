import React from 'react';
import { injectIntl } from 'react-intl';
import { Toast } from 'antd-mobile';
import ReactTooltip from 'react-tooltip';
import { APP_STATE } from '@tronlink/lib/constants';
import { PopupAPI } from '@tronlink/lib/api';


const logo = require('@tronlink/popup/src/assets/images/new/logo2.svg');


class Header extends React.Component {
    constructor(props) {
        super(props);
        this.state={
            nodeIndex:0,
            //showNodeList:false,
            refresh:false
        }
    }

    componentDidMount() {
    }


    render() {
        const { refresh } = this.state;
        const { formatMessage } = this.props.intl;
        const {
            handleSelectChain,
            showChainList,
            developmentMode,
            chains,
            handleShowChainList
        } = this.props;
        //const trxMarketUrl = developmentMode ? 'https://trx.market?from=tronlink' : 'https://trx.market?from=tronlink';
        return (
            <div className='header'>
                <div className='titleContainer'>
                    <div className={'selectedChain '+(chains.selected === '_'?'selected1':'selected2')+(showChainList?' showList':'')} onClick={handleShowChainList}>
                        {/*<img src={logo} alt=""/>*/}
                        <span>{chains.chains[chains.selected].name}</span>
                        <div className='chainWrap' style={showChainList?{height:130,padding:'10px 0'}:{height:0}}>
                            {
                                Object.entries(chains.chains).map(([chainId,{name}])=>{
                                   return <div className='item' onClick={(e)=>{
                                       e.stopPropagation();
                                       handleSelectChain(chainId);
                                   }}>{name}</div>
                                })
                            }
                        </div>
                    </div>
                    <div>
                        
                        
                        <div>
                            <div className="fun" data-tip={formatMessage({id:'INDEX_ICON_TITLE.LOCK'})} data-for='lock' onClick={ () => { PopupAPI.lockWallet(); } }>&nbsp;</div>
                            <ReactTooltip id='lock' effect='solid' />
                            <div className="fun" data-tip={formatMessage({id:'INDEX_ICON_TITLE.REFRESH'})} data-for='refresh' onClick={() => {
                                if(!refresh) {
                                    this.setState({ refresh: true }, async() => {
                                        Toast.loading();
                                        const r = await PopupAPI.refresh();
                                        if(r) {
                                            this.setState({ refresh: false });
                                            Toast.hide();
                                        }
                                    });
                                }

                            }}
                            >&nbsp;</div>
                            <ReactTooltip id='refresh' effect='solid' />
                            <div className="fun" data-tip={formatMessage({id:'INDEX_ICON_TITLE.SETTING'})} data-for='set' onClick={ ()=>{ PopupAPI.changeState(APP_STATE.SETTING) } }>&nbsp;</div>
                            <ReactTooltip id='set' effect='solid' />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default injectIntl(Header);
