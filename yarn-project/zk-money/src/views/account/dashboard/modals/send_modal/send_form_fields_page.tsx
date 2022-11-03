import React from 'react';
import { InputTheme } from '../../../../../components/index.js';
import { SplitSection } from '../sections/split_section/index.js';
import { AmountSection } from '../../../../../views/account/dashboard/modals/sections/amount_section/index.js';
import { TxGasSection } from '../../../../../views/account/dashboard/modals/sections/gas_section/index.js';
import { Toggle } from '../../../../../components/index.js';
import { DescriptionSection, RecipientSection } from '../sections/index.js';
import { PrivacyInformationSection } from '../sections/privacy_information_section/index.js';
import { TransactionSettlementTimeInformationSection } from '../sections/settlement_time_information_section/index.js';
import { StrOrMax } from '../../../../../alt-model/forms/constants.js';
import { TxSettlementTime } from '@aztec/sdk';
import { SendFormDerivedData, SendMode, SendFormFeedback } from '../../../../../alt-model/send/index.js';
import style from './send_form_fields_page.module.scss';
import { FooterSection } from '../sections/footer_section/index.js';

export interface SendProps {
  state: SendFormDerivedData;
  feedback: SendFormFeedback;
  isValid: boolean;
  onChangeSendMode(sendMode: SendMode): void;
  onChangeAmount(value: StrOrMax): void;
  onChangeRecipient(recipient: string): void;
  onChangeSpeed(speed: TxSettlementTime): void;
  onNext(): void;
}

const MODES = [
  { label: 'Withdraw to L1', value: SendMode.WIDTHDRAW },
  { label: 'Send to L2', value: SendMode.SEND },
];

function getDescription(sendMode: SendMode) {
  switch (sendMode) {
    case SendMode.SEND:
      return `Send funds to another user on zk.money via their alias. Transactions are end-to-end encrypted and fully private.`;
    case SendMode.WIDTHDRAW:
      return `Withdraw funds from zk.money to an Ethereum address. Depending on your initial deposit, large withdrawals can carry privacy risks.`;
    default:
      return '';
  }
}

export const SendFormFieldsPage: React.FunctionComponent<SendProps> = ({
  state,
  feedback,
  isValid,
  onChangeSendMode,
  onChangeAmount,
  onChangeRecipient,
  onChangeSpeed,
  onNext,
}) => {
  const { sendMode } = state.fields;
  const { asset } = state;

  return (
    <div className={style.root}>
      <div className={style.header}>
        <Toggle className={style.toggle} value={sendMode} options={MODES} onChangeValue={onChangeSendMode} />
        <DescriptionSection className={style.description} text={getDescription(sendMode)} />
      </div>
      <SplitSection
        leftPanel={
          <>
            <RecipientSection
              theme={InputTheme.WHITE}
              recipientStr={state.fields.recipientStr}
              isLoading={state.isLoadingRecipient}
              isValid={!!state.recipient}
              hasWarning={!!feedback.recipient} // TODO: this is an ugly shortcut, we should review how issue severity is passed down
              recipientType={sendMode === SendMode.SEND ? 'L2' : 'L1'}
              message={feedback.recipient}
              onChangeValue={value => {
                onChangeRecipient(value.replace(/^@+/, ''));
              }}
            />
            <AmountSection
              maxAmount={state.maxOutput ?? 0n}
              asset={asset}
              amountStrOrMax={state.fields.amountStrOrMax}
              onChangeAmountStrOrMax={onChangeAmount}
              amountStrAnnotation={undefined}
              message={feedback.amount}
              balanceType="L2"
            />
          </>
        }
        rightPanel={
          <PrivacyInformationSection
            amount={state.targetAmount?.baseUnits ?? 0n}
            asset={asset}
            txToAlias={sendMode === SendMode.SEND}
          />
        }
      />
      <SplitSection
        leftPanel={
          <TxGasSection
            balanceType="L2"
            speed={state.fields.speed}
            onChangeSpeed={onChangeSpeed}
            feeAmounts={state.feeAmounts}
            targetAssetIsErc20={asset.id !== 0}
          />
        }
        rightPanel={<TransactionSettlementTimeInformationSection selectedSpeed={state.fields.speed} />}
      />
      <FooterSection onNext={onNext} nextDisabled={!isValid} feedback={feedback.footer} />
    </div>
  );
};