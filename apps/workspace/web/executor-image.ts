/**
 * Image shapes and focused views for the agent (work package D).
 *
 * addImage is synchronous (the executor calls it inside editor.run), so it
 * creates the asset + shape with a provisional aspect ratio and fixes the real
 * size once the image has loaded. viewShapes waits for those loads first.
 *
 * Mobbin banner: corpus screenshots carry a banner on the bottom ~8%. Sources
 * with `crop=mobbin` get a tldraw image crop (the file is served untouched).
 */
import { AssetRecordType, type Editor, type TLShapeId } from 'tldraw';
import { fullId, type AddShape } from '../shared/scratch.ts';

const MOBBIN_KEEP = 0.92;
const PROVISIONAL_ASPECT = 0.625; // 16:10, replaced after load
const pending = new Set<Promise<void>>();

/** URL, `/api/file…` path, or a bare corpus ref → a loadable URL. */
export function resolveImageSrc(src: string): string {
  if (/^(https?:|data:|blob:)/i.test(src) || src.startsWith('/')) return src;
  return `/api/file?path=${encodeURIComponent(src)}&crop=mobbin`;
}

const mimeOf = (src: string): string => {
  const ext = /\.(png|jpe?g|webp|gif)(?:[?#&]|$)/i.exec(decodeURIComponent(src))?.[1]?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return ext ? `image/${ext}` : 'image/png';
};

const loadImage = (src: string): Promise<{ w: number; h: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error(`Could not load image ${src}`));
    img.src = src;
  });

/** Create an image asset + image shape at `at` from shape.src (URL, /api/file path, or corpus ref). */
export function addImage(editor: Editor, id: TLShapeId, shape: AddShape, at: { x: number; y: number }): void {
  if (!shape.src) throw new Error('kind "image" needs `src`.');
  const src = resolveImageSrc(shape.src);
  const crop = /[?&]crop=mobbin\b/.test(src);
  const keep = crop ? MOBBIN_KEEP : 1;
  const w = shape.w ?? 640;
  const h = shape.h ?? Math.round(w * PROVISIONAL_ASPECT);
  const assetId = AssetRecordType.createId();
  const name = shape.alt ?? shape.src.split('/').pop() ?? 'image';

  editor.createAssets([
    {
      id: assetId,
      type: 'image',
      typeName: 'asset',
      meta: {},
      props: { name, src, w: Math.round(w), h: Math.round(h / keep), mimeType: mimeOf(src), isAnimated: false },
    },
  ]);
  editor.createShape({
    id,
    type: 'image',
    x: at.x,
    y: at.y,
    meta: shape.alt ? { alt: shape.alt, src: shape.src } : { src: shape.src },
    props: {
      w,
      h,
      assetId,
      altText: shape.alt ?? '',
      crop: crop ? { topLeft: { x: 0, y: 0 }, bottomRight: { x: 1, y: keep } } : null,
    },
  } as never);

  const task = loadImage(src)
    .then(({ w: nw, h: nh }) => {
      if (!editor.getShape(id)) return;
      const asset = editor.getAsset(assetId);
      if (asset) editor.updateAssets([{ ...asset, props: { ...asset.props, w: nw, h: nh } } as never]);
      if (shape.h === undefined) editor.updateShape({ id, type: 'image', props: { h: Math.round((w * nh * keep) / nw) } } as never);
    })
    .catch((cause) => console.warn(cause))
    .finally(() => pending.delete(task));
  pending.add(task);
}

/** PNG (base64) of only the given shapes (short or full ids), or null if none exist. */
export async function viewShapes(editor: Editor, ids: string[]): Promise<string | null> {
  await Promise.all([...pending]);
  const shapeIds = ids.map((id) => (id.startsWith('shape:') ? id : fullId(id)) as TLShapeId).filter((id) => editor.getShape(id));
  if (!shapeIds.length) return null;
  const boxes = shapeIds.map((id) => editor.getShapePageBounds(id)).filter((b): b is NonNullable<typeof b> => !!b);
  if (!boxes.length) return null;
  const minX = Math.min(...boxes.map((b) => b.minX));
  const minY = Math.min(...boxes.map((b) => b.minY));
  const maxX = Math.max(...boxes.map((b) => b.maxX));
  const maxY = Math.max(...boxes.map((b) => b.maxY));
  // Same rule as view(): long side near 1600px.
  const scale = Math.min(2, 1600 / Math.max(maxX - minX, maxY - minY, 1));
  const { blob } = await editor.toImage(shapeIds, { format: 'png', background: true, scale });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
