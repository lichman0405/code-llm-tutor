import crypto from 'crypto';

/**
 * Encryption/Decryption Utilities
 * Used for securely storing sensitive information such as API keys
 */

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-this-in-production-32chars';
const IV_LENGTH = 16;

/**
 * Encrypt text
 * @param text Plain text
 * @returns Encrypted text (format: iv:encryptedData)
 */
export function encrypt(text: string): string {
  if (!text) return '';
  
  try {
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Ensure key length is 32 bytes
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt data
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return format: iv:encryptedData
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt text
 * @param encryptedText Encrypted text (format: iv:encryptedData)
 * @returns Plain text
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  
  try {
    // Split IV and encrypted data
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted text format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    
    // Ensure key length is 32 bytes
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    // Decrypt data
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Decryption failed');
  }
}

/**
 * Masked display of API Key
 * @param apiKey Complete API Key
 * @returns Partially masked API Key (e.g., sk-***abc123)
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return '***';
  
  const start = apiKey.substring(0, 3);
  const end = apiKey.substring(apiKey.length - 6);
  
  return `${start}***${end}`;
}
