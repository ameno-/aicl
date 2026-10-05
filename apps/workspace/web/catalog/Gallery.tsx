import { COMPONENTS } from '../../shared/components.ts';
import { renderers } from './index.ts';

/** Dev-only: every catalog renderer with its sample props, in a fixed-size box. */
export function CatalogGallery({ bad = false }: { bad?: boolean }) {
  return (
    <div className="aicl-cmp-gallery">
      {COMPONENTS.map((spec) => {
        const Renderer = renderers[spec.name];
        const { w, h } = spec.defaultSize;
        return (
          <section key={spec.name}>
            <h3>{spec.title}</h3>
            <div className="aicl-cmp-gallery-box" style={{ width: w, height: h }}>
              {Renderer ? <Renderer props={bad ? {} : spec.sample} width={w} height={h} /> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
