import { createHash } from 'crypto';
import { getNumViewKeys } from '../client_proofs';
import { numToUInt32BE } from '../serialize';
import { ViewingKey } from '../viewing_key';
import { decodeInnerProof } from './decode_inner_proof';
import { encodeInnerProof, getEncodedLength } from './encode_inner_proof';
import { InnerProofData } from './inner_proof';

export enum RollupProofDataFields {
  ROLLUP_ID,
  ROLLUP_SIZE,
  DATA_START_INDEX,
  OLD_DATA_ROOT,
  NEW_DATA_ROOT,
  OLD_NULL_ROOT,
  NEW_NULL_ROOT,
  OLD_ROOT_ROOT,
  NEW_ROOT_ROOT,
  OLD_DEFI_ROOT,
  NEW_DEFI_ROOT,
}

export enum RollupProofDataOffsets {
  ROLLUP_ID = RollupProofDataFields.ROLLUP_ID * 32 + 28,
  ROLLUP_SIZE = RollupProofDataFields.ROLLUP_SIZE * 32 + 28,
  DATA_START_INDEX = RollupProofDataFields.DATA_START_INDEX * 32 + 28,
  OLD_DATA_ROOT = RollupProofDataFields.OLD_DATA_ROOT * 32,
  NEW_DATA_ROOT = RollupProofDataFields.NEW_DATA_ROOT * 32,
  OLD_NULL_ROOT = RollupProofDataFields.OLD_NULL_ROOT * 32,
  NEW_NULL_ROOT = RollupProofDataFields.NEW_NULL_ROOT * 32,
  OLD_ROOT_ROOT = RollupProofDataFields.OLD_ROOT_ROOT * 32,
  NEW_ROOT_ROOT = RollupProofDataFields.NEW_ROOT_ROOT * 32,
  OLD_DEFI_ROOT = RollupProofDataFields.OLD_DEFI_ROOT * 32,
  NEW_DEFI_ROOT = RollupProofDataFields.NEW_DEFI_ROOT * 32,
}

const parseHeaderInputs = (proofData: Buffer) => {
  const rollupId = RollupProofData.getRollupIdFromBuffer(proofData);
  const rollupSize = proofData.readUInt32BE(RollupProofDataOffsets.ROLLUP_SIZE);
  const dataStartIndex = proofData.readUInt32BE(RollupProofDataOffsets.DATA_START_INDEX);
  const oldDataRoot = proofData.slice(RollupProofDataOffsets.OLD_DATA_ROOT, RollupProofDataOffsets.OLD_DATA_ROOT + 32);
  const newDataRoot = proofData.slice(RollupProofDataOffsets.NEW_DATA_ROOT, RollupProofDataOffsets.NEW_DATA_ROOT + 32);
  const oldNullRoot = proofData.slice(RollupProofDataOffsets.OLD_NULL_ROOT, RollupProofDataOffsets.OLD_NULL_ROOT + 32);
  const newNullRoot = proofData.slice(RollupProofDataOffsets.NEW_NULL_ROOT, RollupProofDataOffsets.NEW_NULL_ROOT + 32);
  const oldDataRootsRoot = proofData.slice(
    RollupProofDataOffsets.OLD_ROOT_ROOT,
    RollupProofDataOffsets.OLD_ROOT_ROOT + 32,
  );
  const newDataRootsRoot = proofData.slice(
    RollupProofDataOffsets.NEW_ROOT_ROOT,
    RollupProofDataOffsets.NEW_ROOT_ROOT + 32,
  );
  const oldDefiRoot = proofData.slice(RollupProofDataOffsets.OLD_DEFI_ROOT, RollupProofDataOffsets.OLD_DEFI_ROOT + 32);
  const newDefiRoot = proofData.slice(RollupProofDataOffsets.NEW_DEFI_ROOT, RollupProofDataOffsets.NEW_DEFI_ROOT + 32);

  let startIndex = 11 * 32;
  const bridgeIds: Buffer[] = [];
  for (let i = 0; i < RollupProofData.NUM_BRIDGE_CALLS_PER_BLOCK; ++i) {
    bridgeIds.push(proofData.slice(startIndex, startIndex + 32));
    startIndex += 32;
  }

  const defiDepositSums: Buffer[] = [];
  for (let i = 0; i < RollupProofData.NUM_BRIDGE_CALLS_PER_BLOCK; ++i) {
    defiDepositSums.push(proofData.slice(startIndex, startIndex + 32));
    startIndex += 32;
  }

  const assetIds: Buffer[] = [];
  for (let i = 0; i < RollupProofData.NUMBER_OF_ASSETS; ++i) {
    assetIds.push(proofData.slice(startIndex, startIndex + 32));
    startIndex += 32;
  }

  const totalTxFees: Buffer[] = [];
  for (let i = 0; i < RollupProofData.NUMBER_OF_ASSETS; ++i) {
    totalTxFees.push(proofData.slice(startIndex, startIndex + 32));
    startIndex += 32;
  }

  return {
    rollupId,
    rollupSize,
    dataStartIndex,
    oldDataRoot,
    newDataRoot,
    oldNullRoot,
    newNullRoot,
    oldDataRootsRoot,
    newDataRootsRoot,
    oldDefiRoot,
    newDefiRoot,
    bridgeIds,
    defiDepositSums,
    assetIds,
    totalTxFees,
  };
};

const parseTailInputs = (proofData: Buffer, startIndex: number) => {
  const recursiveProofOutput = proofData.slice(startIndex, startIndex + RollupProofData.LENGTH_RECURSIVE_PROOF_OUTPUT);
  startIndex += RollupProofData.LENGTH_RECURSIVE_PROOF_OUTPUT;

  const defiInteractionNotes: Buffer[] = [];
  for (let i = 0; i < RollupProofData.NUM_BRIDGE_CALLS_PER_BLOCK; ++i) {
    defiInteractionNotes.push(proofData.slice(startIndex, startIndex + 64));
    startIndex += 64;
  }

  const prevDefiInteractionHash = proofData.slice(startIndex, startIndex + 32);

  return {
    recursiveProofOutput,
    defiInteractionNotes,
    prevDefiInteractionHash,
  };
};

const parseViewingKeys = (innerProofData: InnerProofData[], viewingKeyData: Buffer) => {
  let offset = 0;
  return innerProofData.map(p => {
    const numViewKeys = !p.isPadding() ? getNumViewKeys(p.proofId) : 0;
    const viewingKeys = Array(2).fill(ViewingKey.EMPTY);
    for (let j = 0; j < numViewKeys; ++j) {
      const buf = viewingKeyData.slice(offset, offset + ViewingKey.SIZE);
      if (!buf.length) {
        throw new Error('Empty viewing key data.');
      }
      viewingKeys[j] = new ViewingKey(buf);
      offset += ViewingKey.SIZE;
    }
    return viewingKeys;
  });
};

const validateNumViewKeys = (innerProofData: InnerProofData[], viewingKeys: ViewingKey[][]) =>
  innerProofData.forEach((p, i) => {
    const keys = (viewingKeys[i] || []).filter(vk => vk && !vk.isEmpty());
    const numViewKeys = !p.isPadding() ? getNumViewKeys(p.proofId) : 0;
    if (keys.length !== numViewKeys) {
      throw new Error('Invalid number of viewing keys.');
    }
  });

export class RollupProofData {
  static NUMBER_OF_ASSETS = 16;
  static NUM_BRIDGE_CALLS_PER_BLOCK = 4;
  static NUM_ROLLUP_HEADER_INPUTS =
    11 + RollupProofData.NUMBER_OF_ASSETS * 2 + RollupProofData.NUM_BRIDGE_CALLS_PER_BLOCK * 2;
  static LENGTH_ROLLUP_HEADER_INPUTS = RollupProofData.NUM_ROLLUP_HEADER_INPUTS * 32;
  static LENGTH_RECURSIVE_PROOF_OUTPUT = 16 * 32;
  public rollupHash: Buffer;

  constructor(
    public rollupId: number,
    public rollupSize: number,
    public dataStartIndex: number,
    public oldDataRoot: Buffer,
    public newDataRoot: Buffer,
    public oldNullRoot: Buffer,
    public newNullRoot: Buffer,
    public oldDataRootsRoot: Buffer,
    public newDataRootsRoot: Buffer,
    public oldDefiRoot: Buffer,
    public newDefiRoot: Buffer,
    public bridgeIds: Buffer[],
    public defiDepositSums: Buffer[],
    public assetIds: Buffer[],
    public totalTxFees: Buffer[],
    public innerProofData: InnerProofData[],
    public recursiveProofOutput: Buffer,
    public defiInteractionNotes: Buffer[],
    public prevDefiInteractionHash: Buffer,
    public viewingKeys: ViewingKey[][],
  ) {
    if (totalTxFees.length !== RollupProofData.NUMBER_OF_ASSETS) {
      throw new Error(`Expect totalTxFees to be an array of size ${RollupProofData.NUMBER_OF_ASSETS}.`);
    }
    if (bridgeIds.length !== RollupProofData.NUM_BRIDGE_CALLS_PER_BLOCK) {
      throw new Error(`Expect bridgeIds to be an array of size ${RollupProofData.NUM_BRIDGE_CALLS_PER_BLOCK}.`);
    }
    if (defiDepositSums.length !== RollupProofData.NUM_BRIDGE_CALLS_PER_BLOCK) {
      throw new Error(`Expect defiDepositSums to be an array of size ${RollupProofData.NUM_BRIDGE_CALLS_PER_BLOCK}.`);
    }
    if (defiInteractionNotes.length !== RollupProofData.NUM_BRIDGE_CALLS_PER_BLOCK) {
      throw new Error(
        `Expect defiInteractionNotes to be an array of size ${RollupProofData.NUM_BRIDGE_CALLS_PER_BLOCK}.`,
      );
    }
    if (viewingKeys.length) {
      validateNumViewKeys(innerProofData, viewingKeys);
    }

    const allTxIds = this.innerProofData.map(innerProof => innerProof.txId);
    this.rollupHash = createHash('sha256').update(Buffer.concat(allTxIds)).digest();
  }

  toBuffer() {
    return Buffer.concat([
      numToUInt32BE(this.rollupId, 32),
      numToUInt32BE(this.rollupSize, 32),
      numToUInt32BE(this.dataStartIndex, 32),
      this.oldDataRoot,
      this.newDataRoot,
      this.oldNullRoot,
      this.newNullRoot,
      this.oldDataRootsRoot,
      this.newDataRootsRoot,
      this.oldDefiRoot,
      this.newDefiRoot,
      ...this.bridgeIds,
      ...this.defiDepositSums.map(s => s),
      ...this.assetIds,
      ...this.totalTxFees,
      ...this.innerProofData.map(p => p.toBuffer()),
      this.recursiveProofOutput,
      ...this.defiInteractionNotes,
      this.prevDefiInteractionHash,
    ]);
  }

  getViewingKeyData() {
    return Buffer.concat(this.viewingKeys.flat().map(vk => vk.toBuffer()));
  }

  encode() {
    const realInnerProofs = this.innerProofData.filter(p => !p.isPadding());
    const encodedInnerProof = realInnerProofs.map(p => encodeInnerProof(p));
    return Buffer.concat([
      numToUInt32BE(this.rollupId, 32),
      numToUInt32BE(this.rollupSize, 32),
      numToUInt32BE(this.dataStartIndex, 32),
      this.oldDataRoot,
      this.newDataRoot,
      this.oldNullRoot,
      this.newNullRoot,
      this.oldDataRootsRoot,
      this.newDataRootsRoot,
      this.oldDefiRoot,
      this.newDefiRoot,
      ...this.bridgeIds,
      ...this.defiDepositSums.map(s => s),
      ...this.assetIds,
      ...this.totalTxFees,
      numToUInt32BE(Buffer.concat(encodedInnerProof).length),
      ...encodedInnerProof,
      this.recursiveProofOutput,
      ...this.defiInteractionNotes,
      this.prevDefiInteractionHash,
    ]);
  }

  static getRollupIdFromBuffer(proofData: Buffer) {
    return proofData.readUInt32BE(RollupProofDataOffsets.ROLLUP_ID);
  }

  static getRollupSizeFromBuffer(proofData: Buffer) {
    return proofData.readUInt32BE(RollupProofDataOffsets.ROLLUP_SIZE);
  }

  static fromBuffer(proofData: Buffer, viewingKeyData?: Buffer) {
    const {
      rollupId,
      rollupSize,
      dataStartIndex,
      oldDataRoot,
      newDataRoot,
      oldNullRoot,
      newNullRoot,
      oldDataRootsRoot,
      newDataRootsRoot,
      oldDefiRoot,
      newDefiRoot,
      bridgeIds,
      defiDepositSums,
      assetIds,
      totalTxFees,
    } = parseHeaderInputs(proofData);

    if (!rollupSize) {
      throw new Error('Empty rollup.');
    }

    let startIndex = RollupProofData.LENGTH_ROLLUP_HEADER_INPUTS;
    const innerProofSize = rollupSize;
    const innerProofData: InnerProofData[] = [];
    for (let i = 0; i < innerProofSize; ++i) {
      const innerData = proofData.slice(startIndex, startIndex + InnerProofData.LENGTH);
      innerProofData[i] = InnerProofData.fromBuffer(innerData);
      startIndex += InnerProofData.LENGTH;
    }

    const { recursiveProofOutput, defiInteractionNotes, prevDefiInteractionHash } = parseTailInputs(
      proofData,
      startIndex,
    );

    const viewingKeys = viewingKeyData ? parseViewingKeys(innerProofData, viewingKeyData) : [];

    return new RollupProofData(
      rollupId,
      rollupSize,
      dataStartIndex,
      oldDataRoot,
      newDataRoot,
      oldNullRoot,
      newNullRoot,
      oldDataRootsRoot,
      newDataRootsRoot,
      oldDefiRoot,
      newDefiRoot,
      bridgeIds,
      defiDepositSums,
      assetIds,
      totalTxFees,
      innerProofData,
      recursiveProofOutput,
      defiInteractionNotes,
      prevDefiInteractionHash,
      viewingKeys,
    );
  }

  static decode(encoded: Buffer, viewingKeyData?: Buffer) {
    const {
      rollupId,
      rollupSize,
      dataStartIndex,
      oldDataRoot,
      newDataRoot,
      oldNullRoot,
      newNullRoot,
      oldDataRootsRoot,
      newDataRootsRoot,
      oldDefiRoot,
      newDefiRoot,
      bridgeIds,
      defiDepositSums,
      assetIds,
      totalTxFees,
    } = parseHeaderInputs(encoded);

    if (!rollupSize) {
      throw new Error('Empty rollup.');
    }

    let startIndex = RollupProofData.LENGTH_ROLLUP_HEADER_INPUTS;
    let innerProofDataLength = encoded.readUInt32BE(startIndex);
    startIndex += 4;
    const innerProofData: InnerProofData[] = [];
    while (innerProofDataLength > 0) {
      const innerData = encoded.slice(startIndex, startIndex + InnerProofData.LENGTH);
      innerProofData.push(decodeInnerProof(innerData));
      const encodedLength = getEncodedLength(innerData.readUInt8(0));
      startIndex += encodedLength;
      innerProofDataLength -= encodedLength;
    }
    for (let i = innerProofData.length; i < rollupSize; ++i) {
      innerProofData.push(InnerProofData.PADDING);
    }

    const { recursiveProofOutput, defiInteractionNotes, prevDefiInteractionHash } = parseTailInputs(
      encoded,
      startIndex,
    );

    const viewingKeys = viewingKeyData ? parseViewingKeys(innerProofData, viewingKeyData) : [];

    return new RollupProofData(
      rollupId,
      rollupSize,
      dataStartIndex,
      oldDataRoot,
      newDataRoot,
      oldNullRoot,
      newNullRoot,
      oldDataRootsRoot,
      newDataRootsRoot,
      oldDefiRoot,
      newDefiRoot,
      bridgeIds,
      defiDepositSums,
      assetIds,
      totalTxFees,
      innerProofData,
      recursiveProofOutput,
      defiInteractionNotes,
      prevDefiInteractionHash,
      viewingKeys,
    );
  }
}