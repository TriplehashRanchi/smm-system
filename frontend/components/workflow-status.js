import { workflowInfo, workflowSteps, turnChip } from '../lib/posts';

function Turn({ info, agency }) {
  const chip = turnChip(info, agency);
  return chip ? <span className={`wf-chip ${chip.mine ? 'mine' : ''}`}>{chip.text}</span> : null;
}
function Bar({ info }) {
  return <ol className={`wf-bar ${info.warn ? 'warn' : ''}`} aria-label={`Progress: ${info.cancelled ? 'cancelled' : `step ${Math.min(info.done + 1, 5)} of 5`}`}>{workflowSteps.map((name, index) => <li key={name} title={name} className={`${index < info.done ? 'done' : ''} ${index === info.active ? 'active' : ''}`} />)}</ol>;
}

// One compact cell for the Posts table: what it is, whose turn it is, how far along.
export default function StatusCell({ item, agency }) {
  const info = workflowInfo(item, agency);
  return <div className="wf-cell">
    <div className="wf-line"><i className={`stage-dot ${info.stage.toLowerCase()}`} /><span className={`wf-label ${info.warn ? 'warn' : ''}`}>{info.label}</span></div>
    <div className="wf-line wf-sub"><Turn info={info} agency={agency} />{!info.cancelled && <Bar info={info} />}</div>
  </div>;
}

// The larger version for the top of the post panel: named steps and one sentence about what happens next.
export function WorkflowStrip({ item, state, agency }) {
  const info = workflowInfo(item, agency, state);
  return <section className="wf-strip" aria-label="Where this post is">
    {!info.cancelled && <ol className="wf-track">{workflowSteps.map((name, index) => <li key={name} className={`${index < info.done ? 'done' : ''} ${index === info.active ? 'active' : ''} ${info.warn && index === info.active ? 'warn' : ''}`}><span className="wf-node">{index < info.done ? '\u2713' : index + 1}</span><span className="wf-step">{name}</span></li>)}</ol>}
    <p className="wf-hint"><Turn info={info} agency={agency} /><span><strong>{info.label}.</strong> {info.hint}</span></p>
  </section>;
}
