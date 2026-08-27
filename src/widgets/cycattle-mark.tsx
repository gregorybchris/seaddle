/**
 * The Space Needle as a bicycle.
 *
 * Recoloured from the supplied artwork to the site palette: the structure takes
 * the surrounding text colour so it works on any ground, and the saucer keeps
 * the one warm accent, like a light left on at the top.
 *
 * The viewBox is cropped to the drawing rather than left at the artboard's
 * 0 0 150 150, which carried about 8 units of empty margin on every side. At an
 * icon's size that margin became a couple of stray pixels, so the mark never
 * quite lined up with anything set beside or beneath it. Square, and centred on
 * the drawing, so a square element needs no letterboxing.
 */
export function CycattleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="7.8 7.7 134.4 134.4"
      className={className}
      role="img"
      aria-label="Cycattle"
      fill="currentColor"
    >
      <path d="m88 119-2.4-11.4-4 4.6 1.5 8.6h-5.9v-4.1l-3.8 4.1c-0.4 0.4-0.9 0.5-1.4 0.5l-9.9-0.1-3.3 20.4h4.8l2.4-15.8h6.6v15.8h4.7v-15.9h6.6l2.6 15.8h4.7l-3.2-22.5z" />
      <path d="m66 96.5 3.3 8.7 3.1-20.3h0.2v25.3l4.6-5.4v-19.8h0.2l2.7 16.6 3.8-4.5-2-12.6h-14l-1.9 12z" />
      <path d="m59 121.3h-5c-1.5 8.2-9.3 15.8-19.9 15.9-11.1 0-21.1-8.6-21.3-19.7-0.3-10.8 8.6-21.3 20.8-21.3 2.8 0 5.3 0.5 8.5 1.7l-10.6 18.3c-0.8 1.5 0.1 3.5 2.1 3.5h37.8c0.6 0 1-0.2 1.4-0.6l29.2-31.1 2.5 6c-6.7 3.5-13.7 11.3-13.7 23 0.1 13.2 10.6 25 25.5 25.1 13.9 0.2 25.5-10.1 25.5-25 0-13.5-11.1-25.7-25.3-25.7-2 0-4.4 0.2-7.5 1l-7.6-18.8 0.9-1c2.6-3 0.6-7.2-2.8-7.3l-7.5-0.4c-1.2-0.1-2.4 1-2.4 2.3s0.9 2.3 2 2.4l6.6 0.3-1.2 1.3c-0.7 1-1 2.2-0.4 3.3l1.5 3.6h-41.4l-2.2-5.4 6.4-0.4c2.6-0.4 2.4-4.4-0.3-4.4l-16.8-1.2c-4.7-0.2-3.8 7.1 0.4 6.9l5.2-0.5 3.2 7.7-8 13c-2.8-1.3-6.4-2.5-10.5-2.5-13.8-0.1-25.1 10.7-26 23.7-0.7 11.8 7.3 23.7 20.4 26.5 13.1 2.4 28.1-4.9 30.4-20.2h0.1zm57.6-25.2c10.5-0.1 20.5 8.5 20.5 20.8 0 10.1-7.5 20.3-20.7 20.5-11.4 0-20.8-8.9-20.8-20.2 0-8.4 5.4-14.8 10.7-18.4l7.9 19.4c1.1 2.4 5.2 1.6 4.4-1.6l-7.6-19.8c1.9-0.4 3.4-0.7 5.6-0.7zm-61.7-9.7 11.1 28.7h-28.1l8.2-14.5c3.8 2.8 7 7.1 8 12.9h4.9c-1-7.4-5.3-12.9-10.3-17.2l6.2-9.9zm3.7-3.4h41.5l-29.3 31.4-12.2-31.5z" />
      <path d="m59.1 32.7 0.7 1.5c-1.4 0.3-2.4 0.6-2.4 1.3 0 1 3.6 1.9 7.6 2.3l3.5 21.6c0.9 7.1 1 10.2 0.6 17.1h11.5c-0.5-7 0-13.5 1.3-20.9l2.9-17.9c4-0.3 7.8-1.1 7.8-2.2 0-0.6-1-1-2.2-1.3l0.4-1.6c2.7-0.3 6-0.7 6-1.7 0.2-1.9-11.8-2.3-21.8-2.4-8.6 0-21.6 0.6-21.7 2.2-0.2 1.2 3.7 1.6 5.8 2zm19.9 22.8-1 4.6h-0.8v-21.9l4.1-0.2-2.3 17.5zm-6.4-17.3v21.9h-0.8l-3.4-22.1 4.2 0.2z" />
      <path d="m69.3 21.5c0-1 0-2.1 4-2 0-0.5 0-1.1 0.4-1.2l0.7-8.4 0.1-1.8c-0.1-0.6 1-0.4 1 0 0 3.8 0.6 7.4 0.6 10.1 0.3 0 0.7 0.4 0.5 1.3 3.8-0.1 3.8 0.6 3.7 2l-0.7 0.8h-9.7l-0.6-0.8z" />
      <path
        className="text-blaze"
        fill="currentColor"
        d="m58 28.3c0.2-1.5 5.3-3 10.6-3.3 1.3-1-1.1-1.5-1.6-2.4-0.4-1.1 0.9-1.1 4.9-1.3 1.5 0 6.5 0 9.1 0.2 2 0 1.9 0.8 1.4 1.3s-2.5 0.9-1.7 2c0.3 0.4 8.2 0.4 11.3 3.3l-0.1 0.2c-4.9-0.7-12.9-1-18.2-0.9-4.4 0-12.2 0.2-15.7 0.9z"
      />
    </svg>
  );
}
