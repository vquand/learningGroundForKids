import { useState } from 'react';
import type { ItemDetail, MediaOut } from '../../types/item';
import {
  createItemIllustrationDataUri,
  generatedCategoryIllustrationPath,
} from './itemIllustrations';

interface PhotoGalleryProps {
  item: ItemDetail;
  media: MediaOut[];
}

function GalleryImage({ item, img }: { item: ItemDetail; img: MediaOut }) {
  const [failed, setFailed] = useState(false);
  const isSeedPlaceholder = img.filename.startsWith('placeholder-');
  const categoryFallback = generatedCategoryIllustrationPath(item.category);
  const fallbackSrc = categoryFallback ?? createItemIllustrationDataUri(item);
  const fallbackDimensions = categoryFallback
    ? { width: 768, height: 768 }
    : { width: 1200, height: 640 };

  if (failed || isSeedPlaceholder) {
    return (
      <img
        src={fallbackSrc}
        alt=""
        {...fallbackDimensions}
        loading="lazy"
        style={{
          scrollSnapAlign: 'center',
          borderRadius: '1rem',
          objectFit: 'cover',
          width: '100%',
          maxHeight: '16rem',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <img
      src={img.url}
      alt={img.label ?? ''}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{
        scrollSnapAlign: 'center',
        borderRadius: '1rem',
        objectFit: 'cover',
        width: '100%',
        maxHeight: '16rem',
        flexShrink: 0,
      }}
    />
  );
}

export default function PhotoGallery({ item, media }: PhotoGalleryProps) {
  const images = media.filter((m) => m.media_type === 'image');
  const categoryFallback = generatedCategoryIllustrationPath(item.category);
  const fallbackSrc = categoryFallback ?? createItemIllustrationDataUri(item);
  const fallbackDimensions = categoryFallback
    ? { width: 768, height: 768 }
    : { width: 1200, height: 640 };

  if (images.length === 0) {
    return (
      <div
        style={{
          overflowX: 'auto',
          display: 'flex',
          gap: '0.75rem',
          paddingBottom: '0.75rem',
          scrollSnapType: 'x mandatory',
        }}
      >
        <img
          src={fallbackSrc}
          alt=""
          {...fallbackDimensions}
          loading="lazy"
          style={{
            scrollSnapAlign: 'center',
            borderRadius: '1rem',
            objectFit: 'cover',
            width: '100%',
            maxHeight: '16rem',
            flexShrink: 0,
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        overflowX: 'auto',
        display: 'flex',
        gap: '0.75rem',
        paddingBottom: '0.75rem',
        scrollSnapType: 'x mandatory',
      }}
    >
      {images.map((img) => (
        <GalleryImage key={img.id} item={item} img={img} />
      ))}
    </div>
  );
}
