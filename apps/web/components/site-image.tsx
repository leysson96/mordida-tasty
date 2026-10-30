"use client";

import Image, { type ImageProps } from "next/image";
import {
  cloudinaryImageLoader,
  isPublicCloudinaryImage,
} from "../lib/cloudinary-image";

export default function SiteImage(props: ImageProps) {
  return (
    <Image
      {...props}
      loader={
        props.loader ??
        (!props.unoptimized && isPublicCloudinaryImage(props.src)
          ? cloudinaryImageLoader
          : undefined)
      }
    />
  );
}
