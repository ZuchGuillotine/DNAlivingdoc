declare module 'express-fileupload' {
  import { Request } from 'express';

  interface UploadedFile {
    name: string;
    data: Buffer;
    size: number;
    encoding: string;
    tempFilePath: string;
    truncated: boolean;
    mimetype: string;
    md5: string;
    mv(path: string): Promise<void>;
  }

  interface FileUploadOptions {
    limits?: {
      fileSize?: number;
    };
    useTempFiles?: boolean;
    tempFileDir?: string;
    safeFileNames?: boolean;
    preserveExtension?: boolean;
    debug?: boolean;
    createParentPath?: boolean;
    parseNested?: boolean;
    abortOnLimit?: boolean;
  }

  function fileUpload(options?: FileUploadOptions): any;

  // Extend Express Request type
  declare global {
    namespace Express {
      interface Request {
        files?: {
          [key: string]: UploadedFile | UploadedFile[];
        };
      }
    }
  }

  export = fileUpload;
} 