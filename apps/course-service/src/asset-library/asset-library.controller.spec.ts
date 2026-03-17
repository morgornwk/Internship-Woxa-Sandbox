import { Test, TestingModule } from '@nestjs/testing';

import { AssetLibraryController } from './asset-library.controller';
import { AssetLibraryService } from './asset-library.service';

describe('AssetLibraryController', () => {
  let controller: AssetLibraryController;
  let svc: { [k: string]: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetLibraryController],
      providers: [
        {
          provide: AssetLibraryService,
          useValue: {
            uploadAssetImage: jest.fn(),
            createAssetVideoPresign: jest.fn(),
            confirmAssetVideo: jest.fn(),
            getAssetLibraryAll: jest.fn(),
            getAssetById: jest.fn(),
            updateAssetImage: jest.fn(),
            updateAssetVideo: jest.fn(),
            deleteAssetById: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AssetLibraryController);
    svc = module.get(AssetLibraryService);
    jest.clearAllMocks();
  });

  it('uploadAssetImage delegates to AssetLibraryService.uploadAssetImage', async () => {
    svc.uploadAssetImage.mockResolvedValue({ assetMediaId: 1 } as any);
    const file = { originalname: 'x.png' } as any;

    await expect(controller.uploadAssetImage('a1', file)).resolves.toEqual({
      assetMediaId: 1,
    });
    expect(svc.uploadAssetImage).toHaveBeenCalledWith('a1', file);
  });

  it('presignAssetVideo delegates to AssetLibraryService.createAssetVideoPresign', async () => {
    svc.createAssetVideoPresign.mockResolvedValue({ assetMediaId: 2 } as any);

    await expect(
      controller.presignAssetVideo('a1', { mime_type: 'video/mp4' } as any),
    ).resolves.toEqual({
      assetMediaId: 2,
    });
    expect(svc.createAssetVideoPresign).toHaveBeenCalledWith('a1', {
      mime_type: 'video/mp4',
    });
  });

  it('confirmAssetVideo casts id to number and delegates', async () => {
    svc.confirmAssetVideo.mockResolvedValue({ success: true } as any);

    await expect(controller.confirmAssetVideo('123')).resolves.toEqual({
      success: true,
    });
    expect(svc.confirmAssetVideo).toHaveBeenCalledWith(123);
  });

  it('getAssetLibraryAll delegates', async () => {
    svc.getAssetLibraryAll.mockResolvedValue([{ assetMediaId: 1 } as any]);

    await expect(controller.getAssetLibraryAll()).resolves.toEqual([
      { assetMediaId: 1 },
    ]);
    expect(svc.getAssetLibraryAll).toHaveBeenCalledWith();
  });

  it('getAssetById casts id to number and delegates', async () => {
    svc.getAssetById.mockResolvedValue({ assetMediaId: 9 } as any);

    await expect(controller.getAssetById('9')).resolves.toEqual({
      assetMediaId: 9,
    });
    expect(svc.getAssetById).toHaveBeenCalledWith(9);
  });

  it('updateAssetImage casts id to number and delegates', async () => {
    svc.updateAssetImage.mockResolvedValue({ assetMediaId: 1 } as any);

    await expect(
      controller.updateAssetImage('1', { original_filename: 'x' } as any),
    ).resolves.toEqual({
      assetMediaId: 1,
    });
    expect(svc.updateAssetImage).toHaveBeenCalledWith(1, {
      original_filename: 'x',
    });
  });

  it('updateAssetVideo casts id to number and delegates', async () => {
    svc.updateAssetVideo.mockResolvedValue({ assetMediaId: 1 } as any);

    await expect(
      controller.updateAssetVideo('1', { original_filename: 'x' } as any),
    ).resolves.toEqual({
      assetMediaId: 1,
    });
    expect(svc.updateAssetVideo).toHaveBeenCalledWith(1, {
      original_filename: 'x',
    });
  });

  it('deleteAssetById casts id to number and delegates', async () => {
    svc.deleteAssetById.mockResolvedValue({ message: 'ok' });

    await expect(controller.deleteAssetById('5')).resolves.toEqual({
      message: 'ok',
    });
    expect(svc.deleteAssetById).toHaveBeenCalledWith(5);
  });

  it('propagates errors from service', async () => {
    svc.getAssetById.mockRejectedValue(new Error('boom'));
    await expect(controller.getAssetById('1')).rejects.toThrow('boom');
  });
});
