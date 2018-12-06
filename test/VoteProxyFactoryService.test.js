import {
  takeSnapshot,
  restoreSnapshot,
  setupTestMakerInstance,
  linkAccounts
} from './helpers';
import VoteProxyFactoryService from '../src/VoteProxyFactoryService';

let snapshotId, maker, addresses, voteProxyFactory, voteProxyService;

beforeAll(async () => {
  snapshotId = await takeSnapshot();

  maker = await setupTestMakerInstance();

  addresses = maker
    .listAccounts()
    .reduce((acc, cur) => ({ ...acc, [cur.name]: cur.address }), {});

  voteProxyFactory = maker.service('voteProxyFactory');
  voteProxyService = maker.service('voteProxy');
});

afterAll(async () => {
  await restoreSnapshot(snapshotId);
});

test('can create VPFS Service', async () => {
  const vpfs = maker.service('voteProxyFactory');
  expect(vpfs).toBeInstanceOf(VoteProxyFactoryService);
});

test('can create a vote proxy linking two addressses', async () => {
  await linkAccounts(maker, addresses.ali, addresses.ava);

  const { hasProxy } = await voteProxyService.getVoteProxy(addresses.ali);
  expect(hasProxy).toBeTruthy();
});

test('can break a link between linked accounts', async () => {
  maker.useAccount('ali');
  await voteProxyFactory.breakLink();

  const { hasProxy } = await voteProxyService.getVoteProxy(addresses.ali);
  expect(hasProxy).toBe(false);
});

test('approveLink txObject gets correct proxyAddress', async () => {
  const initiator = addresses.ali;
  const approver = addresses.ava;
  const lad = maker.currentAccount().name;

  // initiator wants to create a link with approver
  maker.useAccountWithAddress(initiator);
  await maker.service('voteProxyFactory').initiateLink(approver);

  // approver confirms it
  maker.useAccountWithAddress(approver);
  const approveTx = await maker
    .service('voteProxyFactory')
    .approveLink(initiator);

  // no other side effects
  maker.useAccount(lad);

  const { voteProxy } = await voteProxyService.getVoteProxy(addresses.ali);
  expect(voteProxy.getProxyAddress()).toEqual(approveTx.proxyAddress);
  expect(approveTx.fees.toNumber()).toBeGreaterThan(0);
  expect(approveTx.timeStampSubmitted).toBeTruthy();
  expect(approveTx.timeStamp).toBeTruthy();
});
