import { AppletHost, useApplets } from '../applets/index.tsx';

export function ViewPage({ id }: { id: string }) {
  const known = useApplets().some((a) => a.id === id && a.kind === 'view');
  if (!known) {
    return (
      <div className="shell-empty">
        <p className="shell-empty-title">No view called “{id}”</p>
        <p className="shell-empty-hint">Views are full-page apps the agent builds. Ask it for one in the Agent tab.</p>
      </div>
    );
  }
  return (
    <div className="view-page">
      <AppletHost id={id} />
    </div>
  );
}
