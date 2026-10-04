import { Cell } from 'retend';

export interface City {
  name: string;
  country: string;
}

export type SortOrder = 'asc' | 'desc';
export type NodeKind = 'source' | 'derived' | 'output';

export const CITIES: City[] = [
  { name: 'Accra', country: 'Ghana' },
  { name: 'Buenos Aires', country: 'Argentina' },
  { name: 'Cape Town', country: 'South Africa' },
  { name: 'Istanbul', country: 'Türkiye' },
  { name: 'Kyoto', country: 'Japan' },
  { name: 'Lagos', country: 'Nigeria' },
  { name: 'Lisbon', country: 'Portugal' },
  { name: 'Marrakesh', country: 'Morocco' },
  { name: 'Mexico City', country: 'Mexico' },
  { name: 'Nairobi', country: 'Kenya' },
  { name: 'Oslo', country: 'Norway' },
  { name: 'Vancouver', country: 'Canada' },
];

export interface GraphNode {
  name: string;
  kind: NodeKind;
  hits: Cell<number>;
  active: Cell<boolean>;
}

/** A node that counts, and briefly lights up, every time its Cell notifies. */
function createNode<T>(
  name: string,
  kind: NodeKind,
  watched: Cell<T>
): GraphNode {
  const hits = Cell.source(0);
  const active = Cell.source(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  watched.listen(() => {
    Cell.batch(() => {
      hits.set(hits.get() + 1);
      active.set(true);
    });
    clearTimeout(timer);
    timer = setTimeout(() => active.set(false), 900);
  });

  return { name, kind, hits, active };
}

/**
 * The state behind the city filter, plus a node for every Cell in it.
 * Sorting only touches `order` and `sorted`, which is the point of the demo.
 */
export function createCityModel() {
  const query = Cell.source('');
  const order = Cell.source<SortOrder>('asc');

  const matches = Cell.derived(() => {
    const needle = query.get();
    return CITIES.filter((city) =>
      `${city.name} ${city.country}`.toLowerCase().includes(needle)
    );
  });
  const sorted = Cell.derived(() => {
    const list = matches.get().toSorted((a, b) => a.name.localeCompare(b.name));
    return order.get() === 'asc' ? list : list.toReversed();
  });
  const count = Cell.derived(() => matches.get().length);

  return {
    query,
    order,
    sorted,
    count,
    nodes: {
      query: createNode('query', 'source', query),
      order: createNode('order', 'source', order),
      matches: createNode('matches', 'derived', matches),
      sorted: createNode('sorted', 'derived', sorted),
      count: createNode('count', 'output', count),
      list: createNode('list', 'output', sorted),
    },
  };
}

export type CityModel = ReturnType<typeof createCityModel>;
