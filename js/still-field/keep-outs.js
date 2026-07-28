/**
 * Screen rectangles the info layer must not paint into.
 *
 * The canvas is painted *behind* the controls, so a label that lands under a
 * card is a `fillText` into a surface nobody can see — and on a phone, where
 * the control column spans the viewport, that was every single one of them.
 *
 * `app.js` measures the chrome and pushes the rectangles here on resize, on
 * scroll and whenever the interface is minimised or restored. Measuring them in
 * this module instead would mean a `getBoundingClientRect` per frame, which
 * forces layout exactly like the `getComputedStyle` call the renderer is
 * careful to make only once per theme change.
 *
 * They are kept as separate rectangles rather than one union: the header, the
 * control column and the stats readout sit in different corners, and a bounding
 * box around all three would swallow the whole viewport.
 */

/** @type {Array<{left: number, top: number, right: number, bottom: number}>} */
let keepOuts = [];

/**
 * Declare the rectangles, in CSS px. Pass an empty array (or nothing) to clear.
 *
 * Copied into plain objects rather than retained: the caller hands over live
 * `DOMRect`s, which keep their element alive and go stale the moment anything
 * reflows.
 *
 * @param {Array<{left: number, top: number, right: number, bottom: number}>} [rects]
 */
export function setLabelKeepOuts(rects) {
  if (!rects || rects.length === 0) {
    keepOuts = [];
    return;
  }
  keepOuts = rects.map(r => ({
    left: r.left,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
  }));
}

/** How many rectangles are currently declared, for the HUD. */
export function keepOutCount() {
  return keepOuts.length;
}

/**
 * Would a rectangle overlap any keep-out? Takes the *text's* own box, not the
 * node's — a callout is drawn beside its node, so those are not the same place.
 */
export function hitsKeepOut(left, top, right, bottom) {
  for (let i = 0; i < keepOuts.length; i++) {
    const r = keepOuts[i];
    if (right > r.left && left < r.right && bottom > r.top && top < r.bottom) return true;
  }
  return false;
}
