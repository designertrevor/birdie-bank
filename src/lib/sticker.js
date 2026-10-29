// How wide the die-cut sticker border is round an illustration (ArtFile.jsx draws it).

/**
 * The border's width in screen px for a drawing shown `px` wide: about 3 to 4px at card sizes,
 * thinning to 1.5px on the smallest art, so a 28px critter isn't all border.
 */
export const stickerPx = px => Math.min(4, Math.max(1.5, 1 + px * 0.022));

/** The border in a box's own units, for a box `units` wide shown `px` wide. */
export const stickerUnits = (units, px) => stickerPx(px) * units / px;
