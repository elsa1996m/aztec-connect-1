import type { RemoteAsset } from 'alt-model/types';
import { useLegacyEthAccountState } from 'alt-model/assets/l1_balance_hooks';
import { WalletSelect } from 'views/account/wallet_select';
import { useApp, useProviderState } from 'alt-model';
import { MessageType } from 'app';
import style from './connected_legacy_wallet_select.module.css';

interface ConnectedLegacyWalletSelectProps {
  asset: RemoteAsset;
  className: string;
  errorFeedback?: string;
}

export function ConnectedLegacyWalletSelect({ asset, className, errorFeedback }: ConnectedLegacyWalletSelectProps) {
  const ethAccountState = useLegacyEthAccountState(asset);
  const providerState = useProviderState();
  const { userSession } = useApp();
  return (
    <div className={style.root}>
      <WalletSelect
        className={className}
        asset={asset}
        providerState={providerState}
        ethAccount={ethAccountState ?? { publicBalance: 0n, pendingBalance: 0n }}
        message={errorFeedback && ' '}
        messageType={errorFeedback ? MessageType.ERROR : undefined}
        onChangeWallet={id => userSession?.changeWallet(id)}
      />
      <div className={style.anchor}>{errorFeedback && <div className={style.feedback}>{errorFeedback}</div>}</div>
    </div>
  );
}