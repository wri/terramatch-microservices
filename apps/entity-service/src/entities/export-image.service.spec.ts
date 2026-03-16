import { Test, TestingModule } from "@nestjs/testing";
import { InternalServerErrorException } from "@nestjs/common";
import sharp from "sharp";
import { ExportImageService } from "./export-image.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { Media } from "@terramatch-microservices/database/entities";
import { createMock, DeepMocked } from "@golevelup/ts-jest";

jest.mock("sharp", () => {
  const instance = {
    rotate: jest.fn().mockReturnThis(),
    withExifMerge: jest.fn().mockReturnThis(),
    withXmp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from("processed-image"))
  };
  return { __esModule: true, default: jest.fn(() => instance) };
});

const makeMedia = (overrides: Partial<Media> = {}): Media =>
  ({
    id: 1,
    uuid: "test-uuid",
    name: "Test Image",
    fileName: "test.jpg",
    mimeType: "image/jpeg",
    description: "A test description",
    photographer: "Jane Doe",
    lat: 51.5,
    lng: -0.1,
    isPublic: true,
    isCover: false,
    createdAt: new Date("2024-01-15T10:00:00Z"),
    createdByUserName: "John Smith",
    ...overrides
  } as unknown as Media);

type SharpPipelineMock = {
  rotate: jest.Mock;
  withExifMerge: jest.Mock;
  withXmp: jest.Mock;
  toBuffer: jest.Mock;
};

const getSharpInstance = (): SharpPipelineMock => {
  const sharpMock = sharp as unknown as jest.Mock;
  const instance = sharpMock.mock.results.at(-1)?.value as SharpPipelineMock | undefined;

  if (instance == null) {
    throw new Error("Expected sharp to have been called");
  }

  return instance;
};

describe("ExportImageService", () => {
  let service: ExportImageService;
  let mediaService: DeepMocked<MediaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExportImageService, { provide: MediaService, useValue: (mediaService = createMock<MediaService>()) }]
    }).compile();

    service = module.get(ExportImageService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("exportImage", () => {
    it("returns a buffer, content type, and filename", async () => {
      const media = makeMedia();
      const rawBuffer = Buffer.from("raw-image");
      mediaService.getMediaBuffer.mockResolvedValue(rawBuffer);

      const result = await service.exportImage(media);

      expect(mediaService.getMediaBuffer).toHaveBeenCalledWith(media);
      expect(sharp as unknown as jest.Mock).toHaveBeenCalledWith(rawBuffer);
      expect(result.contentType).toBe("image/jpeg");
      expect(result.filename).toBe("test.jpg");
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it("calls sharp with rotate, withExifMerge, and withXmp", async () => {
      mediaService.getMediaBuffer.mockResolvedValue(Buffer.from("raw-image"));

      await service.exportImage(makeMedia());
      const instance = getSharpInstance();

      expect(instance.rotate).toHaveBeenCalled();
      expect(instance.withExifMerge).toHaveBeenCalled();
      expect(instance.withXmp).toHaveBeenCalled();
      expect(instance.toBuffer).toHaveBeenCalled();
    });

    it("includes GPS EXIF fields when lat/lng are present", async () => {
      mediaService.getMediaBuffer.mockResolvedValue(Buffer.from("raw-image"));

      await service.exportImage(makeMedia({ lat: 51.5, lng: -0.1 }));
      const instance = getSharpInstance();

      const exifArg = instance.withExifMerge.mock.calls[0][0];
      expect(exifArg).toHaveProperty("GPS");
      expect(exifArg.GPS).toMatchObject({
        GPSLatitudeRef: "N",
        GPSLongitudeRef: "W"
      });
    });

    it("omits GPS EXIF fields when lat or lng is null", async () => {
      mediaService.getMediaBuffer.mockResolvedValue(Buffer.from("raw-image"));

      await service.exportImage(makeMedia({ lat: null, lng: null }));
      const instance = getSharpInstance();

      const exifArg = instance.withExifMerge.mock.calls[0][0];
      expect(exifArg).not.toHaveProperty("GPS");
    });

    it("omits empty EXIF text fields instead of sending blank strings", async () => {
      mediaService.getMediaBuffer.mockResolvedValue(Buffer.from("raw-image"));

      await service.exportImage(
        makeMedia({
          description: null,
          photographer: null,
          createdAt: null,
          lat: null,
          lng: null
        })
      );
      const instance = getSharpInstance();

      const exifArg = instance.withExifMerge.mock.calls[0][0];
      expect(exifArg).toEqual({});
    });

    it("includes GPS coordinates in XMP when lat/lng present", async () => {
      mediaService.getMediaBuffer.mockResolvedValue(Buffer.from("raw-image"));

      await service.exportImage(makeMedia({ lat: 51.5, lng: -0.1 }));
      const instance = getSharpInstance();

      const xmpArg: string = instance.withXmp.mock.calls[0][0];
      expect(xmpArg).toContain("GPSLatitude");
      expect(xmpArg).toContain("GPSLongitude");
    });

    it("uses 'Unknown' as uploader name when createdByUserName is null", async () => {
      mediaService.getMediaBuffer.mockResolvedValue(Buffer.from("raw-image"));

      await service.exportImage(makeMedia({ createdByUserName: null }));
      const instance = getSharpInstance();

      const xmpArg: string = instance.withXmp.mock.calls[0][0];
      expect(xmpArg).toContain("Unknown");
    });

    it("throws InternalServerErrorException for unsupported mime types", async () => {
      const media = makeMedia({ mimeType: "application/pdf" });

      await expect(service.exportImage(media)).rejects.toThrow(InternalServerErrorException);
      expect(mediaService.getMediaBuffer).not.toHaveBeenCalled();
    });

    it("defaults to image/jpeg when mimeType is null", async () => {
      mediaService.getMediaBuffer.mockResolvedValue(Buffer.from("raw-image"));

      const result = await service.exportImage(makeMedia({ mimeType: null }));

      expect(result.contentType).toBe("image/jpeg");
    });
  });
});
