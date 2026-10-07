/** Workflow templates for the command menu: each starts the main agent with a prompt that delegates via spawn_agent. */
export interface Workflow {
  id: string;
  label: string;
  prompt: string;
}

const TOPIC = 'If I have not named a topic or task in this conversation, first ask me for it with ask_user (allowText). Then';

export const WORKFLOWS: Workflow[] = [
  {
    id: 'research-write-review',
    label: 'Workflow: Research → write → review',
    prompt: `${TOPIC} run a research → write → review pipeline with sub-agents. Use spawn_agent (wait true) for each stage in order: "Researcher" gathers the key facts and sources; "Writer" drafts from the research (pass it the findings in the task); "Reviewer" critiques the draft for errors and gaps. Then give me the final draft with the review's fixes applied. Tell me briefly as each stage finishes.`,
  },
  {
    id: 'parallel-reviewers',
    label: 'Workflow: Parallel reviewers (3)',
    prompt: `${TOPIC} have three reviewers examine it in parallel. Spawn "Correctness", "Clarity" and "Risks" reviewers with spawn_agent and wait:false (each with a crisp role and a self-contained task including what to review), then agent_wait for all three and merge their findings into one ranked list.`,
  },
  {
    id: 'plan-implement-test',
    label: 'Workflow: Plan → implement → test',
    prompt: `${TOPIC} run a plan → implement → test workflow with sub-agents. Use spawn_agent (wait true) in order: "Planner" produces a short step-by-step plan; "Implementer" carries out the plan (pass it the plan); "Tester" verifies the result and reports what passed and failed. If the tester finds problems, send them back to the implementer with agent_message or a new spawn. Summarise the outcome for me.`,
  },
];
