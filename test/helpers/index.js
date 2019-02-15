import fetch from 'node-fetch';
import Maker, { MKR } from '@makerdao/dai';
import GovService from '../../src/index';
import {
  MCD_ADM,
  GOV_POLL_GEN,
  VOTE_PROXY_FACTORY
} from '../../src/utils/constants';
import { map, prop } from 'ramda';

function ganacheAddress() {
  const port = process.env.GOV_TESTNET_PORT || 2000;
  return `http://localhost:${port}`;
}

let requestCount = 0;

export async function takeSnapshot() {
  const id = requestCount;
  requestCount += 1;

  const res = await fetch(ganacheAddress(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'evm_snapshot',
      params: [],
      id: id
    })
  });

  const json = await res.json();
  return parseInt(json['result'], 16);
}

export async function restoreSnapshot(snapId) {
  const id = requestCount;
  requestCount += 1;

  const res = await fetch(ganacheAddress(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'evm_revert',
      params: [snapId],
      id: id
    })
  });

  const json = await res.json();
  return json['result'];
}

export const fakeAddresses = ['0xbeefed1bedded2dabbed3defaced4decade5dead'];

// some of the accounts that're generated from the mnemonic we give ganache
export const ganacheAccounts = [
  {
    address: '0xda1495ebd7573d8e7f860862baa3abecebfa02e0',
    privateKey:
      '0xbc838ab7af00cda00cb02efbbe4dbb1ce51f5d2613acfe11bd970ce659ad8704',
    type: 'GANACHE'
  },
  {
    address: '0x81431b69b1e0e334d4161a13c2955e0f3599381e',
    privateKey:
      '0xb3ae65f191aac33f3e3f662b8411cabf14f91f2b48cf338151d6021ea1c08541',
    type: 'GANACHE'
  },
  {
    address: '0xb76a5a26ba0041eca3edc28a992e4eb65a3b3d05',
    privateKey:
      '0xa052332a502d9a91636931be4ffd6e1468684544a1a7bc4a64c21c6f5daa759a',
    type: 'GANACHE'
  }
];
export const ganacheCoinbase = {
  address: '0x16fb96a5fa0427af0c8f7cf1eb4870231c8154b6',
  privateKey:
    '0x474beb999fed1b3af2ea048f963833c686a0fba05f5724cb6417cf3b8ee9697e',
  type: 'GANACHE'
};
// ^ our default coinbase BUT we should probably avoid using it for
// tests (besides sending mkr) since it's the address the contracts are deployed
// from on ganache, so it has special privledges that could affect test results

/**TODO: use testchain-client for testing */
const contractAddresses = {};

const testnetAddresses = require('../../contracts/addresses/testnet.json');
contractAddresses.testnet = testnetAddresses;
const addContracts = {
  [MCD_ADM]: {
    address: map(prop('chief'), contractAddresses),
    abi: require('../../contracts/abis/DSChief.json')
  },
  [VOTE_PROXY_FACTORY]: {
    address: map(prop('proxy_factory'), contractAddresses),
    abi: require('../../contracts/abis/VoteProxyFactory.json')
  },
  [GOV_POLL_GEN]: {
    address: map(prop('polling'), contractAddresses),
    abi: require('../../contracts/abis/Polling.json')
  }
};

export const setupTestMakerInstance = async () => {
  const maker = await Maker.create('http', {
    accounts: {
      owner: { type: 'privateKey', key: ganacheCoinbase.privateKey },
      ali: { type: 'privateKey', key: ganacheAccounts[0].privateKey },
      sam: { type: 'privateKey', key: ganacheAccounts[1].privateKey },
      ava: { type: 'privateKey', key: ganacheAccounts[2].privateKey }
    },
    provider: { type: 'HTTP', url: 'http://localhost:2000' },
    plugins: [[GovService, { bypassContracts: true }]],
    smartContract: {
      addContracts
    }
  });

  await maker.authenticate();
  return maker;
};

export const linkAccounts = async (maker, initiator, approver) => {
  const lad = maker.currentAccount().name;

  // initiator wants to create a link with approver
  maker.useAccountWithAddress(initiator);
  await maker.service('voteProxyFactory').initiateLink(approver);

  // approver confirms it
  maker.useAccountWithAddress(approver);
  await maker.service('voteProxyFactory').approveLink(initiator);

  // no other side effects
  maker.useAccount(lad);
};

export const sendMkrToAddress = async (
  maker,
  accountToUse,
  receiver,
  amount
) => {
  const lad = maker.currentAccount().name;
  const mkr = await maker.getToken(MKR);

  await maker.useAccountWithAddress(accountToUse);
  await mkr.transfer(receiver, amount);

  maker.useAccount(lad);
};

export const setUpAllowance = async (maker, address) => {
  const lad = maker.currentAccount().name;
  const mkr = await maker.getToken(MKR);

  await mkr.approveUnlimited(address);

  maker.useAccount(lad);
};
