import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export const crypto = {
  hash: async (password: string): Promise<string> => {
    const salt = randomBytes(16).toString('hex');
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString('hex')}.${salt}`;
  },
  
  compare: async (suppliedPassword: string, storedPassword: string): Promise<boolean> => {
    if (storedPassword === 'google_oauth') return false;
    
    const [hashedPassword, salt] = storedPassword.split('.');
    if (!hashedPassword || !salt) return false;
    
    const hashedPasswordBuf = Buffer.from(hashedPassword, 'hex');
    const suppliedPasswordBuf = (await scryptAsync(suppliedPassword, salt, 64)) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
  
  randomBytes: randomBytes
}; 