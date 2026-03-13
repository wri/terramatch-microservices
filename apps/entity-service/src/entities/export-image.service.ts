import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Media } from "@terramatch-microservices/database/entities";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import sharp from "sharp";

export type ExportImageResult = {
  buffer: Buffer;
  contentType: string;
  filename: string;
};

const EXPORTABLE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/heif", "image/heic"];

@Injectable()
export class ExportImageService {
  constructor(private readonly mediaService: MediaService) {}

  async exportImage(media: Media): Promise<ExportImageResult> {
    const contentType = media.mimeType ?? "image/jpeg";

    if (!EXPORTABLE_MIME_TYPES.includes(contentType)) {
      throw new InternalServerErrorException(`Unsupported media type for export: ${contentType}`);
    }

    const rawBuffer = await this.mediaService.getMediaBuffer(media);

    const uploaderName = media.createdByUserName ?? "Unknown";

    const xmpString = this.buildXmpString(media, uploaderName);

    const exifData = this.buildExifData(media);

    const buffer = await sharp(rawBuffer).rotate().withExifMerge(exifData).withXmp(xmpString).toBuffer();

    return {
      buffer,
      contentType,
      filename: media.fileName
    };
  }

  private buildXmpString(media: Media, uploaderName: string): string {
    const safeXml = (value: string | null | undefined) =>
      (value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const geotagged = media.lat != null && media.lng != null;

    const userCommentPayload = {
      IsCover: media.isCover,
      IsPublic: media.isPublic,
      UploadedBy: uploaderName,
      Filename: media.fileName,
      Geotagged: geotagged,
      Name: media.name,
      Photographer: media.photographer ?? "",
      Description: media.description ?? "",
      "Date Captured": media.createdAt?.toISOString() ?? "",
      Coordinates: {
        Latitude: media.lat ?? null,
        Longitude: media.lng ?? null
      }
    };

    const coordinatesBlock = geotagged
      ? `
        <Iptc4xmpExt:LocationCreated>
          <rdf:Description>
            <exif:GPSLatitude>${safeXml(this.decimalToDms(media.lat ?? 0))}</exif:GPSLatitude>
            <exif:GPSLongitude>${safeXml(this.decimalToDms(media.lng ?? 0))}</exif:GPSLongitude>
          </rdf:Description>
        </Iptc4xmpExt:LocationCreated>`
      : "";

    return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"
           xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
           xmlns:dc="http://purl.org/dc/elements/1.1/"
           xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
           xmlns:xmp="http://ns.adobe.com/xap/1.0/"
           xmlns:exif="http://ns.adobe.com/exif/1.0/"
           xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/">
  <rdf:RDF>
    <rdf:Description rdf:about="">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${safeXml(media.name)}</rdf:li></rdf:Alt></dc:title>
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${safeXml(
        media.description
      )}</rdf:li></rdf:Alt></dc:description>
      <dc:creator><rdf:Seq><rdf:li>${safeXml(uploaderName)}</rdf:li></rdf:Seq></dc:creator>
      <photoshop:Credit>${safeXml(media.photographer)}</photoshop:Credit>
      <xmp:CreateDate>${safeXml(media.createdAt?.toISOString())}</xmp:CreateDate>
      <xmp:UserComment>${safeXml(JSON.stringify(userCommentPayload))}</xmp:UserComment>
      ${coordinatesBlock}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;
  }

  private buildExifData(media: Media): Record<string, Record<string, string>> {
    const exif: Record<string, Record<string, string>> = {};
    const ifd0: Record<string, string> = {};
    const exifSection: Record<string, string> = {};

    if (media.photographer != null && media.photographer !== "") {
      ifd0.Artist = media.photographer;
    }

    if (media.description != null && media.description !== "") {
      ifd0.ImageDescription = media.description;
      exifSection.UserComment = media.description;
    }

    const dateTimeOriginal = this.toExifDate(media.createdAt);
    if (dateTimeOriginal !== "") {
      exifSection.DateTimeOriginal = dateTimeOriginal;
    }

    if (Object.keys(ifd0).length > 0) {
      exif.IFD0 = ifd0;
    }

    if (Object.keys(exifSection).length > 0) {
      exif.Exif = exifSection;
    }

    if (media.lat != null && media.lng != null) {
      exif.GPS = {
        GPSLatitudeRef: media.lat >= 0 ? "N" : "S",
        GPSLatitude: this.decimalToDms(Math.abs(media.lat)),
        GPSLongitudeRef: media.lng >= 0 ? "E" : "W",
        GPSLongitude: this.decimalToDms(Math.abs(media.lng))
      };
    }

    return exif;
  }

  private toExifDate(date: Date | null | undefined): string {
    if (date == null) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = new Date(date);
    return `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}:${pad(d.getSeconds())}`;
  }

  private decimalToDms(decimal: number): string {
    const abs = Math.abs(decimal);
    const degrees = Math.floor(abs);
    const minutesFull = (abs - degrees) * 60;
    const minutes = Math.floor(minutesFull);
    const secondsFull = (minutesFull - minutes) * 60;
    const seconds = Math.round(secondsFull * 100);
    return `${degrees}/1 ${minutes}/1 ${seconds}/100`;
  }
}
