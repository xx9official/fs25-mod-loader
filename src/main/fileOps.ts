import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

export async function computeSha256(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  return await new Promise((resolve, reject) => {
    stream.on('data', (d) => hash.update(d));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function filesAreDifferent(aPath: string, bPath: string): Promise<boolean> {
  if (!(await fs.pathExists(aPath))) return true;
  if (!(await fs.pathExists(bPath))) return true;
  const [aStat, bStat] = await Promise.all([fs.stat(aPath), fs.stat(bPath)]);
  if (aStat.size !== bStat.size) return true;
  // Size equal; compare hash for certainty
  const [aHash, bHash] = await Promise.all([computeSha256(aPath), computeSha256(bPath)]);
  return aHash !== bHash;
}

export async function atomicCopy(src: string, dest: string) {
  const dir = path.dirname(dest);
  await fs.ensureDir(dir);
  const temp = dest + '.tmp';
  await fs.copy(src, temp, { overwrite: true });
  await fs.move(temp, dest, { overwrite: true });
}


