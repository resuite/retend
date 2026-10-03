import { Cell, If } from 'retend';

import type { CityModel, GraphNode, NodeKind } from './cityModel';
import type { ClassValue } from './constants';

interface DependencyChainProps {
  model: CityModel;
  focus: Cell<NodeKind>;
  class?: ClassValue;
}

interface ChainNodeProps {
  node: GraphNode;
  focus: Cell<NodeKind>;
}

const KIND_LABEL: Record<NodeKind, string> = {
  source: 'Source',
  derived: 'Derived',
  output: 'Renders',
};

const DOWN = 'mx-auto h-7 w-px border-l border-dashed border-white/80';

/**
 * Every Cell in the filter demo as a card on the painting, joined by dashed
 * lines in the direction updates travel. A card flashes when its Cell
 * notifies, so you can see how far a change reached.
 */
export function DependencyChain(props: DependencyChainProps) {
  const { model, focus, class: className } = props;
  const { nodes } = model;

  return (
    <figure
      class={['grid grid-cols-[1fr_2rem_1fr] items-center', className]}
      aria-label="How the Cells in the demo depend on each other"
    >
      <ChainNode node={nodes.query} focus={focus} />
      <span />
      <ChainNode node={nodes.order} focus={focus} />

      <span class={DOWN} />
      <span />
      <span class={DOWN} />

      <ChainNode node={nodes.matches} focus={focus} />
      <span
        aria-hidden="true"
        class="h-px w-full border-t border-dashed border-white/80"
      />
      <ChainNode node={nodes.sorted} focus={focus} />

      <span class={DOWN} />
      <span />
      <span class={DOWN} />

      <ChainNode node={nodes.count} focus={focus} />
      <span />
      <ChainNode node={nodes.list} focus={focus} />
    </figure>
  );
}

function ChainNode(props: ChainNodeProps) {
  const { node, focus } = props;
  const dimmed = Cell.derived(() => focus.get() !== node.kind);

  return (
    <div
      class={[
        'home-node home-card bg-raised flex items-center justify-between gap-2 rounded-xl px-3 py-2.5',
        { 'home-node-active': node.active, 'opacity-55': dimmed },
      ]}
    >
      <span class="flex min-w-0 flex-col">
        <span class="text-ink-faint text-[0.6875rem]">
          {KIND_LABEL[node.kind]}
        </span>
        <span class="text-small text-ink truncate font-mono">{node.name}</span>
      </span>
      <span class="bg-sunken text-ink-soft shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.6875rem] tabular-nums">
        {If(node.active, {
          true: () => <span class="text-accent-ink">updating</span>,
          false: () => <span>{node.hits}×</span>,
        })}
      </span>
    </div>
  );
}
