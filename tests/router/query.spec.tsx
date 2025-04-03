import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTextContent, routerSetup } from '../setup.ts';
import { For, If, Cell } from 'retend';
import { getGlobalContext } from 'retend/context';
import {
  createWebRouter,
  useRouteQuery,
  type AsyncRouteQuery,
} from 'retend/router';

describe('useRouteQuery', () => {
  beforeEach(routerSetup);

  it('should show the current route query params', async () => {
    const { window } = getGlobalContext();

    const Home = () => {
      const query = useRouteQuery();
      const name = query.get('name');
      return <div>Hello, {name}</div>;
    };

    const router = createWebRouter({
      routes: [{ name: 'home', path: '/', component: Home }],
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/?name=Cody');
    expect(getTextContent(window.document.body)).toBe('Hello, Cody');

    await router.navigate('/?name=John');
    expect(getTextContent(window.document.body)).toBe('Hello, John');

    await router.back();
    expect(getTextContent(window.document.body)).toBe('Hello, Cody');
  });

  it('should trigger route change on query change', async () => {
    const { window } = getGlobalContext();
    const cardPageWasRun = vi.fn();

    let changeStage = (stage: string): void | Promise<void> => {
      stage;
    };

    const CardPage = () => {
      const query = useRouteQuery();
      const stage = query.get('stage');

      cardPageWasRun();

      changeStage = async (stage: string) => {
        await query.set('stage', stage);
      };

      return <div>This is the {stage} stage</div>;
    };

    const router = createWebRouter({
      routes: [{ name: 'card page', path: '/card', component: CardPage }],
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/card?stage=design');
    expect(window.location.href).toBe('/card?stage=design');
    expect(getTextContent(window.document.body)).toBe(
      'This is the design stage'
    );

    expect(cardPageWasRun).toHaveBeenCalledTimes(1);

    await changeStage('development');
    expect(window.location.href).toBe('/card?stage=development');
    expect(getTextContent(window.document.body)).toBe(
      'This is the development stage'
    );
  });

  it('should trigger route change on query delete', async () => {
    const { window } = getGlobalContext();
    const cardPageWasRun = vi.fn();

    //@ts-expect-error: Typescript cannot infer that the variable would have been assigned.
    let query: AsyncRouteQuery = null;

    const CardPage = () => {
      query = useRouteQuery();
      const stage = query.get('stage');

      cardPageWasRun();

      return (
        <div>
          {If(stage, () => (
            <>This is the {stage} stage</>
          ))}
        </div>
      );
    };

    const router = createWebRouter({
      routes: [{ name: 'card page', path: '/card', component: CardPage }],
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/card?stage=design');
    expect(window.location.href).toBe('/card?stage=design');
    expect(getTextContent(window.document.body)).toBe(
      'This is the design stage'
    );

    expect(cardPageWasRun).toHaveBeenCalledTimes(1);
    await query.delete('stage');

    expect(window.location.href).toBe('/card');
    expect(getTextContent(window.document.body)).toBe('');

    await router.back();

    expect(window.location.href).toBe('/card?stage=design');
    expect(getTextContent(window.document.body)).toBe(
      'This is the design stage'
    );
    expect(cardPageWasRun).toHaveBeenCalledTimes(1);
  });

  it('should trigger route change on query clear', async () => {
    const { window } = getGlobalContext();
    const cardPageWasRun = vi.fn();

    //@ts-expect-error: Typescript cannot infer that the variable would have been assigned.
    let query: AsyncRouteQuery = null;

    const CardPage = () => {
      query = useRouteQuery();
      const stage = query.get('stage');

      cardPageWasRun();

      return (
        <div>
          {If(stage, () => (
            <>This is the {stage} stage</>
          ))}
        </div>
      );
    };

    const router = createWebRouter({
      routes: [{ name: 'card page', path: '/card', component: CardPage }],
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/card?stage=design');
    expect(window.location.href).toBe('/card?stage=design');
    expect(getTextContent(window.document.body)).toBe(
      'This is the design stage'
    );

    expect(cardPageWasRun).toHaveBeenCalledTimes(1);
    await query.clear();

    expect(window.location.href).toBe('/card');
    expect(getTextContent(window.document.body)).toBe('');

    await router.back();

    expect(window.location.href).toBe('/card?stage=design');
    expect(getTextContent(window.document.body)).toBe(
      'This is the design stage'
    );
    expect(cardPageWasRun).toHaveBeenCalledTimes(1);
  });

  it('should read multiple queries reactively', async () => {
    const { window } = getGlobalContext();
    const routePageCalled = vi.fn();

    const List = () => {
      const query = useRouteQuery();
      const listIsOpen = query.has('list-is-open');
      const listIsExpanded = query.has('list-is-expanded');
      routePageCalled();

      return (
        <div>
          {If(listIsExpanded, {
            true: () => 'List is Expanded',
            false: () => 'List Page',
          })}
          {If(listIsOpen, () => (
            <ul>{For(Array(3).fill(0), Item)}</ul>
          ))}
        </div>
      );
    };

    const Item = () => {
      const query = useRouteQuery();
      const listIsExpanded = query.has('list-is-expanded');
      return (
        <li>
          <h2>List Item</h2>
          {If(listIsExpanded, () => (
            <p>Item details</p>
          ))}
        </li>
      );
    };

    const routes = [
      {
        name: 'list page',
        path: '/list',
        component: List,
      },
    ];
    const router = createWebRouter({ routes });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/list');

    expect(getTextContent(window.document.body)).toBe('List Page');
    expect(routePageCalled).toHaveBeenCalledTimes(1);

    await router.navigate('/list?list-is-open');
    expect(routePageCalled).toHaveBeenCalledTimes(1);
    expect(getTextContent(window.document.body)).toBe(
      'List PageList ItemList ItemList Item'
    );
    await router.navigate('/list?list-is-open&list-is-expanded');
    expect(routePageCalled).toHaveBeenCalledTimes(1);
    expect(getTextContent(window.document.body)).toBe(
      'List is ExpandedList ItemItem detailsList ItemItem detailsList ItemItem details'
    );
  });

  it('should append multiple values to the same query parameter', async () => {
    const { window } = getGlobalContext();

    //@ts-expect-error: Typescript cannot infer that the variable would have been assigned.
    let query: AsyncRouteQuery = null;

    const FilterPage = () => {
      query = useRouteQuery();
      const filters = query.getAll('filter');
      const filtersAreEmpty = Cell.derived(() => filters.value.length === 0);

      return (
        <div>
          <h1>Filters</h1>
          {If(filtersAreEmpty, {
            true: () => <p>No filters applied</p>,
            false: () => (
              <ul>
                {For(filters, (filter) => (
                  <li>Filter: {filter}</li>
                ))}
              </ul>
            ),
          })}
        </div>
      );
    };

    const router = createWebRouter({
      routes: [{ name: 'filters', path: '/filters', component: FilterPage }],
    });

    router.setWindow(window);
    router.attachWindowListeners();

    // Initial navigation
    await router.navigate('/filters');
    expect(getTextContent(window.document.body)).toContain(
      'No filters applied'
    );

    // Add first filter
    await query.append('filter', 'category1');
    expect(window.location.href).toBe('/filters?filter=category1');
    expect(getTextContent(window.document.body)).toContain('Filter: category1');

    // Add second filter
    await query.append('filter', 'category2');
    expect(window.location.href).toBe(
      '/filters?filter=category1&filter=category2'
    );
    expect(getTextContent(window.document.body)).toContain('Filter: category1');
    expect(getTextContent(window.document.body)).toContain('Filter: category2');

    // Add third filter
    await query.append('filter', 'category3');
    expect(window.location.href).toBe(
      '/filters?filter=category1&filter=category2&filter=category3'
    );
    expect(getTextContent(window.document.body)).toContain('Filter: category1');
    expect(getTextContent(window.document.body)).toContain('Filter: category2');
    expect(getTextContent(window.document.body)).toContain('Filter: category3');

    // Navigate back should remove the last filter
    await router.back();
    expect(window.location.href).toBe(
      '/filters?filter=category1&filter=category2'
    );
    expect(getTextContent(window.document.body)).toContain('Filter: category1');
    expect(getTextContent(window.document.body)).toContain('Filter: category2');
    expect(getTextContent(window.document.body)).not.toContain(
      'Filter: category3'
    );
  });
});
