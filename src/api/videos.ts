import { respondWithJSON } from "./json";

import { type ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { BadRequestError, UserForbiddenError } from "./errors";
import path from "node:path"

const VIDEO_UPLOAD_LIMIT = 1 << 30;

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as {videoId?: string};
  if (!videoId) {
    throw new BadRequestError("No video id provided.")
  }
  const token = getBearerToken(req.headers);
  const userId = validateJWT(token, cfg.jwtSecret);
  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new BadRequestError("No video with provided ID");
  } else if (video.userID !== userId) {
    throw new UserForbiddenError("User is not video owner.");
  }
  const formData = await req.formData();
  const blob = formData.get("video");
  if (!blob || typeof blob === "string") {
    throw new BadRequestError("Video header not provided");
  } else if (blob.size > VIDEO_UPLOAD_LIMIT) {
    throw new BadRequestError("Video size exceeds upload limit.");
  } else if (blob.type !== "video/mp4") {
    throw new BadRequestError("Video mime type needs to be 'video/mp4'");
  }
  const key = `${videoId}.mp4`
  const filePath = path.join(`/tmp`, `${key}`);
  await Bun.write(filePath, blob);
  await cfg.s3Client.write(key, blob, {type: blob.type});
  video.videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${key}`
  updateVideo(cfg.db, video)
  return respondWithJSON(200, null);
}
