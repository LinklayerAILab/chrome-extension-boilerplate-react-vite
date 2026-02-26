import biana from '../../../../public/platform/bian-a.svg';
import bianb from '../../../../public/platform/bian-d.svg';
import okxa from '../../../../public/platform/okx-a.svg';
import okxb from '../../../../public/platform/okx-d.svg';
import bybita from '../../../../public/platform/bybit-a.svg';
import bybitb from '../../../../public/platform/bybit-d.svg';
import bitgeta from '../../../../public/platform/bitget-a.svg';
import bitgetb from '../../../../public/platform/bitget-d.svg';
import coinbasea from '../../../../public/platform/coinbase-a.svg';
import coinbaseb from '../../../../public/platform/coinbase-d.svg';
import gatea from '../../../../public/platform/gate-a.svg';
import gateb from '../../../../public/platform/gate-d.svg';
import coola from '../../../../public/platform/cool-a.svg';
import coolb from '../../../../public/platform/cool-d.svg';
import ma from '../../../../public/platform/m-a.svg';
import mb from '../../../../public/platform/m-d.svg';
export interface PlatformItem {
  name: CEX_NAME;
  imgA: string;
  imgB: string;
  selected: boolean;
  disabled: boolean;
  doc_pc?: string;
  doc_mobile?: string;
}

export type CEX_NAME = 'Binance' | 'OKX' | 'Bybit' | 'Bitget' | 'Coinbase' | 'Gate.io' | 'KuCoin' | 'MEXC';

export const platformListData: PlatformItem[] = [
  {
    name: 'Binance',
    imgA: biana,
    imgB: bianb,
    selected: false,
    disabled: false,
    doc_pc: 'https://doc.linklayer.ai/guide/bnpc',
    doc_mobile: 'https://doc.linklayer.ai/guide/bnapp',
  },
  {
    name: 'OKX',
    imgA: okxa,
    imgB: okxb,
    selected: false,
    disabled: true,
    doc_pc: 'https://doc.linklayer.ai/guide/okxpc',
    doc_mobile: 'https://doc.linklayer.ai/guide/okxapp',
  },
  {
    name: 'Bybit',
    imgA: bybita,
    imgB: bybitb,
    selected: false,
    disabled: true,
    doc_pc: 'https://doc.linklayer.ai/guide/bybitpc',
  },
  {
    name: 'Bitget',
    imgA: bitgeta,
    imgB: bitgetb,
    selected: false,
    disabled: true,
    doc_pc: 'https://doc.linklayer.ai/guide/bitgetpc',
    doc_mobile: 'https://doc.linklayer.ai/guide/bitgetapp',
  },
  {
    name: 'Coinbase',
    imgA: coinbasea,
    imgB: coinbaseb,
    selected: false,
    disabled: true,
  },
  // { name: "Upbit", imgA: upa, imgB: upb, selected: false, disabled: true },
  {
    name: 'Gate.io',
    imgA: gatea,
    imgB: gateb,
    selected: false,
    disabled: true,
  },
  {
    name: 'KuCoin',
    imgA: coola,
    imgB: coolb,
    selected: false,
    disabled: true,
  },
  { name: 'MEXC', imgA: ma, imgB: mb, selected: false, disabled: true },
];
