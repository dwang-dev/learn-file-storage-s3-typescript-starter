import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo, type Video } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError } from "./errors";
import path from "node:path"
import { randomBytes } from "node:crypto";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const MAX_UPLOAD_SIZE = 10 << 20;

const videoThumbnails: Map<string, Thumbnail> = new Map();

function getVideoFileExtension(filetype: string) {
  const parts = filetype.split("/");
  if (parts.length !== 2) {
    return "bin";
  }
  return parts[1];
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }
  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  // TODO: implement the upload here

  const formData = await req.formData();
  const file = formData.get("thumbnail");
  const video = getVideo(cfg.db, videoId);
  if (!(file instanceof File)) {
    throw new BadRequestError("Thumbnail file missing");
  }
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    throw new BadRequestError("Invalid thumbnail type");
  }
  const buf = await file.arrayBuffer();
  if (!video) {
    throw new BadRequestError("Video id does not exist");
  }
  const thumbnailObj: Thumbnail = {
    data: buf,
    mediaType: file.type,
  }
  videoThumbnails.set(videoId, thumbnailObj);
  const videoFilename = randomBytes(32).toString("base64");
  const videoFileExt = getVideoFileExtension(file.type);
  video.thumbnailURL = `http://localhost:${cfg.port}/assets/${videoFilename}.${videoFileExt}`;
  Bun.write(path.join(cfg.assetsRoot, `${videoFilename}.${videoFileExt}`), buf);
  updateVideo(cfg.db, video);
  return respondWithJSON(200, video);
}
