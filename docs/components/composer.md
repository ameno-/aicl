# Composer

The field, the submit action, the toolbar slots and the above-band.

## Incorporation

The compound slots — body, field, submit, attachments, suggestions — are the shape both composers use, including a status that already matched AICL's. The send action, the IME-safe Enter and the submission guards stay ours.

| | |
| --- | --- |
| Shapes | **S2** compound, named subparts, **S4** controlled and uncontrolled, **S6** render-prop slots, **S7** slot DOM contract |
| Motion | **fast** — `hover` |
| LooseLeaf | [prompt-input](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [input-message](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `composer-compound` |
| Tour | stop `composer` |
| See it | The components gallery, section Composer, and the tour's Composer stop. |
| Source | `packages/react/src/Composer.tsx` |

## Usage

Reach for Composer as the field a person types into. `onSubmit` receives the text. `status` distinguishes `submitted` from `streaming`; stop is available only while tokens arrive.

Attachments shown with `attachments` are display state. Send file parts yourself. Omit `value` for an uncontrolled field. Enter sends, Shift+Enter inserts a newline, and IME composition is not a send.

```tsx
<Composer placeholder="Ask the agent…" onSubmit={send}>
  <Composer.Body>
    <Composer.Input />
    <Composer.Submit />
  </Composer.Body>
</Composer>
```

Ask for `composer` or `message field`.

## Slots

- `composer`
- `composer-body`
- `composer-input`
- `composer-submit`
- `composer-attach`
- `composer-disabled-reason`
- `composer-hint`
- `attachment-row`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `ready` `submitted` `streaming` `aborted` |
| `data-placement` | `docked` `hero` `rail` |
| `data-has-text` | `true` |
| `data-has-attachments` | `true` |
| `data-role` | `send` `stop` |
