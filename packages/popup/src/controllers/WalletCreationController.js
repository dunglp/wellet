import React from 'react';
import WalletOption from '@tronlink/popup/src/components/WalletOption';

// import { FormattedMessage } from 'react-intl';
import { APP_STATE } from '@tronlink/lib/constants';
import { PopupAPI } from '@tronlink/lib/api';
import { FormattedMessage } from 'react-intl';

const onCreationSelect = () => PopupAPI.changeState(APP_STATE.CREATING);
const onRestoreSelect = () => PopupAPI.changeState(APP_STATE.RESTORING);
//const onLedgerSelect = () => PopupAPI.changeState(APP_STATE.LEDGER);

const WalletCreationController = () => (
	<div className='insetContainer createOrImportWallet'>
		<div className='pageHeader'>
			<div className='logo1'>&nbsp;</div>
		</div>
		<div className='pageTitle'>
			<div className='title'>
				<FormattedMessage
					className='title'
					id='PAGETITLE.TITLE'
				></FormattedMessage>
			</div>
			<div className='description'>
				<FormattedMessage
					className='description'
					id='PAGETITLE.DESCRIPTION'
				></FormattedMessage>
			</div>
		</div>
		<div className='greyModal'>
			<div className='walletOptions'>
				<WalletOption
					tabIndex={1}
					name='CREATION.CREATE'
					onClick={onCreationSelect}
				/>
				<WalletOption
					tabIndex={2}
					name='CREATION.RESTORE'
					onClick={onRestoreSelect}
				/>
			</div>
		</div>
	</div>
);

export default WalletCreationController;
