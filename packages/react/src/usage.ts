/**
 * How each primitive is used.
 *
 * The contract says the slots. This says when to reach for the primitive,
 * the smallest example, and what it does not do. The component page is this
 * record, rendered. A primitive with no record fails the test.
 */

export interface UsageRecord {
  /** The contract name. */
  name: string;
  /** When a person should reach for it. */
  when: string;
  /** The boundary: what this primitive leaves alone. */
  not: string;
  /** A complete snippet. The page prints it as tsx. */
  example: string;
  /**
   * How to place it on the canvas, when it is an input.
   * `null` when the frame cannot host it.
   */
  canvas: string | null;
}

export const usages: readonly UsageRecord[] = [
  {
    name: 'Button',
    when: 'Reach for Button for every action a person takes. Pass `type="submit"` inside a form; the default is `type="button"`, so a chat send does not fire twice.',
    not: 'Loading keeps the button focusable and the same size. It does not disable it. The glyph is an icon role (`icon`, `trailingIcon`), resolved through `IconProvider`, not an imported icon.',
    example: `<Button variant="outline" size="sm" icon="copy">Copy</Button>`,
    canvas: 'Ask for `button`.',
  },
  {
    name: 'Transcript',
    when: 'Reach for Transcript as the conversation. Pass the messages and the chat status. With no children it renders the scroller, the rows, and jump-to-latest.',
    not: 'The default row does not receive `onAction` or `branch`. Render `Transcript.Item` yourself when retry, edit, or the branch switcher must work. One live region serves the whole thread.',
    example: `<Transcript messages={messages} status={status} />`,
    canvas: null,
  },
  {
    name: 'Composer',
    when: 'Reach for Composer as the field a person types into. `onSubmit` receives the text. `status` distinguishes `submitted` from `streaming`; stop is available only while tokens arrive.',
    not: 'Attachments shown with `attachments` are display state. Send file parts yourself. Omit `value` for an uncontrolled field. Enter sends, Shift+Enter inserts a newline, and IME composition is not a send.',
    example: `<Composer placeholder="Ask the agent…" onSubmit={send}>
  <Composer.Body>
    <Composer.Input />
    <Composer.Submit />
  </Composer.Body>
</Composer>`,
    canvas: 'Ask for `composer` or `message field`.',
  },
  {
    name: 'PartRenderer',
    when: 'Reach for PartRenderer inside a message row when you render parts yourself. It dispatches one part to the registry.',
    not: 'A custom registry matches exact part type names. A `data-` wildcard is ignored, and an unknown part renders `UnknownPart`.',
    example: `<PartRenderer part={part} />`,
    canvas: null,
  },
  {
    name: 'MessageActions',
    when: 'Reach for MessageActions as the per-message row: copy, retry, edit. It stays hidden until the row is hovered or focused.',
    not: 'The buttons call `onAction`. Wiring them to `useChat` is the caller\'s job; the transcript does not do it for the default row.',
    example: `<MessageActions message={message} actions={['copy', 'retry']} onAction={onAction} />`,
    canvas: null,
  },
  {
    name: 'PlanChecklist',
    when: 'Reach for PlanChecklist to show an ordered plan and a done/total rollup. Each item is `pending`, `running`, `done`, or `error`.',
    not: 'It renders. It does not advance the items. The caller owns the list.',
    example: `<PlanChecklist
  title="Ship the frame"
  items={[
    { id: '1', label: 'Name the inputs', status: 'done' },
    { id: '2', label: 'Place them on the frame', status: 'running' },
  ]}
/>`,
    canvas: 'Ask for `plan` or `checklist`.',
  },
  {
    name: 'ComposerSurface',
    when: 'Reach for ComposerSurface as the pieces around the field: `SuggestionChips`, `AttachmentChip`, `AttachmentDropzone`, `SlashMenu`, and `MentionMenu`.',
    not: 'A slash or mention menu needs the same controlled `value`, change handler, and `inputRef` as the composer. Chips do not send a message on their own.',
    example: `<SuggestionChips
  suggestions={[{ id: '1', label: 'Make it shorter' }]}
  onSelect={(suggestion) => insert(suggestion.label)}
/>`,
    canvas: null,
  },
  {
    name: 'SessionList',
    when: 'Reach for SessionList as the list of past chats, grouped by recency. Each row is a `SessionListItem`.',
    not: 'It does not load or persist sessions. Pass the groups you already have. `relativeTime` formats a timestamp; it is not a clock.',
    example: `<SessionList
  groups={[{ id: 'today', label: 'Today', ids: ['s1'] }]}
  byId={{ s1: { id: 's1', title: 'Double submit' } }}
  onSelect={open}
/>`,
    canvas: null,
  },
  {
    name: 'SessionSearch',
    when: 'Reach for SessionSearch as one combobox over the session titles. It filters as the person types.',
    not: 'It searches the list you pass. It does not query a server.',
    example: `<SessionSearch
  value={query}
  onChange={setQuery}
  groups={[{ id: 'today', ids: ['s1'] }]}
  byId={{ s1: { id: 's1', title: 'Double submit' } }}
  onSelect={open}
/>`,
    canvas: null,
  },
  {
    name: 'SidebarNav',
    when: 'Reach for SidebarNav as the vertical nav. Pass the items, and `collapsed` when the rail is icon-only.',
    not: 'It does not own the route. `onSelect` is the navigation.',
    example: `<SidebarNav
  items={[{ id: 'chats', label: 'Chats', active: true }]}
  onNavigate={go}
/>`,
    canvas: null,
  },
  {
    name: 'Dialog',
    when: 'Reach for Dialog as a modal. It traps focus, returns focus, and dismisses on Escape and the scrim unless you say otherwise.',
    not: 'It is controlled: `open` and `onOpenChange`. A dirty dialog can veto dismissal through `onDismissRequest`. It portals to the document.',
    example: `<Dialog open={open} onOpenChange={setOpen}>
  <Dialog.Title>Rename session</Dialog.Title>
  <Dialog.Description>The name is what the sidebar shows.</Dialog.Description>
  <Dialog.Close>Cancel</Dialog.Close>
</Dialog>`,
    canvas: null,
  },
  {
    name: 'AlertDialog',
    when: 'Reach for AlertDialog when the person must confirm before something is destroyed. The scrim does not dismiss it.',
    not: 'Initial focus is the cancel control. A typed confirmation stays disabled until the text matches. It does not delete anything itself.',
    example: `<AlertDialog
  open={open}
  onOpenChange={setOpen}
  title="Delete session"
  variant="danger"
  consequence="This cannot be undone."
  confirmLabel="Delete"
  onConfirm={remove}
/>`,
    canvas: null,
  },
  {
    name: 'Drawer',
    when: 'Reach for Drawer as a sheet from an edge. It traps focus the way a dialog does and can be swiped away.',
    not: 'It is controlled, and it portals. It is not a second page.',
    example: `<Drawer open={open} onOpenChange={setOpen} side="right">
  <Dialog.Title>Details</Dialog.Title>
</Drawer>`,
    canvas: null,
  },
  {
    name: 'ToastRegion',
    when: 'Reach for ToastRegion once, near the root, and give it a toast queue from `@aicl/core`. Toasts stack in that region.',
    not: 'The region is the live region. Rendering `Toast` alone does not announce or time anything.',
    example: `<ToastRegion queue={queue} />`,
    canvas: null,
  },
  {
    name: 'Toast',
    when: 'Reach for Toast as one transient status, usually rendered by the region. Give it a title and, when there is a next step, an action.',
    not: 'It does not time itself out. The queue does.',
    example: `<Toast
  toast={{ id: 'copied', title: 'Copied', variant: 'success', paused: false }}
  onDismiss={dismiss}
/>`,
    canvas: null,
  },
  {
    name: 'Field',
    when: 'Reach for Field to pair a label, a description, and an error with one control. The child input receives the id and the aria attributes.',
    not: 'It expects exactly one React element as a child. It does not submit the form. `saveState` only announces the save.',
    example: `<Field label="API base URL" error="Must start with https://" required>
  <input value={url} onChange={(event) => setUrl(event.target.value)} />
</Field>`,
    canvas: 'Ask for `field` or `form`.',
  },
  {
    name: 'Switch',
    when: 'Reach for Switch as a boolean setting whose label is a real label.',
    not: 'It is controlled. Roll `checked` back yourself when a save fails; `status="error"` only marks the failure.',
    example: `<Switch checked={on} onCheckedChange={setOn} label="Stream reasoning" />`,
    canvas: 'Ask for `switch` or `toggle`.',
  },
  {
    name: 'Select',
    when: 'Reach for Select as a single-choice listbox with typeahead. Options are `{ value, label }`.',
    not: 'It is controlled. It is not a combobox: the person picks, they do not author a new value.',
    example: `<Select
  ariaLabel="Model"
  value={model}
  onValueChange={setModel}
  options={[{ value: 'sonnet', label: 'Sonnet 5.5' }]}
/>`,
    canvas: 'Ask for `select` or `model picker`.',
  },
  {
    name: 'SegmentedControl',
    when: 'Reach for SegmentedControl when a few options are always visible. Arrow keys move and select. It is one tab stop.',
    not: 'It is controlled. The travelling pill assumes equal columns, 2px of padding, and a 2px gap.',
    example: `<SegmentedControl
  ariaLabel="Layout"
  value={layout}
  onValueChange={setLayout}
  options={[
    { value: 'list', label: 'List' },
    { value: 'grid', label: 'Grid' },
  ]}
/>`,
    canvas: 'Ask for `segmented` or `choice`.',
  },
  {
    name: 'Badge',
    when: 'Reach for Badge as a short label beside a word: a count, a state, a version.',
    not: 'It is not a button. A status the person acts on is a Button or an Alert.',
    example: `<Badge variant="success">Live</Badge>`,
    canvas: 'Ask for `badge` or `badges`.',
  },
  {
    name: 'Separator',
    when: 'Reach for Separator as the rule between two regions. The default is decorative and is not announced.',
    not: 'Pass `decorative={false}` when the rule is a real separator. Orientation is `horizontal` or `vertical`.',
    example: `<Separator />`,
    canvas: 'Ask for `separator` or `divider`.',
  },
  {
    name: 'Kbd',
    when: 'Reach for Kbd as a keycap in a hint: the shortcut that does the thing.',
    not: 'It does not listen for the key. It is the label.',
    example: `<span>Open the palette <Kbd>⌘K</Kbd></span>`,
    canvas: 'Ask for `kbd`, `keycap`, or `shortcut`.',
  },
  {
    name: 'Progress',
    when: 'Reach for Progress as a bar. Pass `value` from 0 to 100 when you know it. Omit `value` for an indeterminate bar.',
    not: 'The label is announced. The bar does not estimate a duration.',
    example: `<Progress value={40} label="Tokens" />`,
    canvas: 'Ask for `progress`.',
  },
  {
    name: 'Skeleton',
    when: 'Reach for Skeleton as the placeholder while a region has no content yet.',
    not: 'It is hidden from assistive tech. It is not a spinner, and it is not the empty state that replaces a finished empty list.',
    example: `<Skeleton width={160} />`,
    canvas: 'Ask for `skeleton`.',
  },
  {
    name: 'Spinner',
    when: 'Reach for Spinner as the working mark beside a label. Pass `label` so the work is announced.',
    not: 'It does not reserve the space of the thing that will arrive. A region uses Skeleton for that.',
    example: `<Spinner label="Thinking" />`,
    canvas: 'Ask for `spinner`.',
  },
  {
    name: 'Alert',
    when: 'Reach for Alert for a status the person must see in place: information, success, a warning, or a destructive failure. Use `Alert.Title` and `Alert.Description`.',
    not: 'It does not ask for a decision. A confirm-or-cancel is an AlertDialog. It is not a toast.',
    example: `<Alert variant="warning">
  <Alert.Title>Needs you</Alert.Title>
  <Alert.Description>Approve the command before the agent continues.</Alert.Description>
</Alert>`,
    canvas: 'Ask for `alert` or `warning`.',
  },
  {
    name: 'Card',
    when: 'Reach for Card to group a title, a description, a body, and a footer. The slots are `Card.Header`, `Card.Title`, `Card.Description`, `Card.Body`, and `Card.Footer`.',
    not: 'It does not link anywhere. A card the person opens is a button or a link around the content you choose.',
    example: `<Card>
  <Card.Header>
    <Card.Title>Plan</Card.Title>
    <Card.Description>Three steps, one of them done.</Card.Description>
  </Card.Header>
  <Card.Body>Write the failing test, then the primitive, then the gallery.</Card.Body>
</Card>`,
    canvas: 'Ask for `card`.',
  },
  {
    name: 'Empty',
    when: 'Reach for Empty when a region has finished loading and has nothing to show. Give it a title, a description, and the action that fills it.',
    not: 'It is not a skeleton and not an error. Use it once the request has settled.',
    example: `<Empty>
  <Empty.Title>No sessions yet</Empty.Title>
  <Empty.Description>Start one from the composer.</Empty.Description>
  <Empty.Actions>
    <Button size="sm">New session</Button>
  </Empty.Actions>
</Empty>`,
    canvas: 'Ask for `empty` or `no sessions`.',
  },
  {
    name: 'Tooltip',
    when: 'Reach for Tooltip to name a control on hover and keyboard focus. The child is the anchor.',
    not: 'It is positioned on the anchor. It does not flip when it would leave the viewport. A collision-aware popup is still a candidate. Tooltip content is not the place for an action.',
    example: `<Tooltip content="Copies the message">
  <Button variant="outline" size="sm" icon="copy">Copy</Button>
</Tooltip>`,
    canvas: 'Ask for `tooltip`.',
  },
  {
    name: 'Tabs',
    when: 'Reach for Tabs when a few panels share one frame. Arrow keys move, Home and End jump, and a disabled tab is skipped. `defaultValue` is the uncontrolled form.',
    not: 'Inactive panels stay mounted and are hidden. The travelling pill assumes equal columns. A page-level navigation is SidebarNav, not tabs.',
    example: `<Tabs defaultValue="plan">
  <Tabs.List aria-label="Work">
    <Tabs.Tab value="plan">Plan</Tabs.Tab>
    <Tabs.Tab value="files">Files</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="plan">The plan lives here.</Tabs.Panel>
  <Tabs.Panel value="files">Two files changed.</Tabs.Panel>
</Tabs>`,
    canvas: 'Ask for `tabs`.',
  },
  {
    name: 'Collapsible',
    when: 'Reach for Collapsible for one region that folds. The trigger and the panel are the two parts. Closed content stays mounted and is hidden from reading and tabbing.',
    not: 'It does not close its neighbours. A list of exclusive rows is an Accordion.',
    example: `<Collapsible>
  <Collapsible.Trigger>Worked for 11s</Collapsible.Trigger>
  <Collapsible.Panel>Edited two files.</Collapsible.Panel>
</Collapsible>`,
    canvas: 'Ask for `collapsible` or `worked for`.',
  },
  {
    name: 'Accordion',
    when: 'Reach for Accordion for a list of folding rows. The default is one open row, and choosing another closes it. `type="multiple"` keeps the others open.',
    not: 'A single disclosure with no siblings is a Collapsible. The value is a string, or a string array when more than one row stays open.',
    example: `<Accordion defaultValue="read">
  <Accordion.Item value="read">
    <Accordion.Trigger>Read the diff</Accordion.Trigger>
    <Accordion.Panel>Opening the next row closes this one.</Accordion.Panel>
  </Accordion.Item>
</Accordion>`,
    canvas: 'Ask for `accordion`.',
  },
];
