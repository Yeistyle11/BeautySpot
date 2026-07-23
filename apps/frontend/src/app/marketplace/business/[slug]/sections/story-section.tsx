"use client";
import Image from "next/image";
import { Clock, Quote } from "lucide-react";
import { imageUnoptimized } from "@/lib/image";

export function StorySection({
  title,
  storyTitle,
  storyText,
  storyImage,
  foundedYear,
  founders,
}: {
  title: string;
  storyTitle: string | null;
  storyText: string;
  storyImage: string | null;
  foundedYear: number | null;
  founders: string | null;
}) {
  return (
    <section className="mb-12">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <Quote className="text-primary h-5 w-5" />
        {title}
      </h2>
      <div className="flex flex-col gap-6 sm:flex-row">
        {storyImage && (
          <div className="shrink-0 sm:w-1/3">
            <Image
              src={storyImage}
              alt={storyTitle || "Historia"}
              width={400}
              height={300}
              unoptimized={imageUnoptimized(storyImage)}
              className="h-48 w-full rounded-xl object-cover sm:h-full"
            />
          </div>
        )}
        <div className="flex-1">
          {storyTitle && (
            <h3 className="text-primary mb-3 text-xl font-semibold">
              {storyTitle}
            </h3>
          )}
          <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
            {storyText}
          </p>
          {(foundedYear || founders) && (
            <div className="text-muted-foreground mt-4 flex flex-wrap gap-4 text-sm">
              {foundedYear && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Fundado en {foundedYear}
                </span>
              )}
              {founders && <span>Fundadores: {founders}</span>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
