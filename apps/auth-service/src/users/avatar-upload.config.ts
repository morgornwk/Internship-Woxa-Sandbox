import { BadRequestException } from '@nestjs/common';
import { memoryStorage, Options as MulterOptions } from 'multer';

export const avatarUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png'];

    if (!allowed.includes(file.mimetype)) {
      return cb(
        new BadRequestException('Only JPG and PNG are allowed') as any,
        false,
      );
    }

    cb(null, true);
  },
};
