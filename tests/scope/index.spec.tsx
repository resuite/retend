import { Cell } from 'retend';
import { For, If, Switch } from 'retend';
import {
  branchState,
  createScope,
  getActiveRenderer,
  setActiveRenderer,
  useScopeContext,
  withStateSnapshot,
} from 'retend';
import { describe, expect, it } from 'vitest';
import { browserSetup, getTextContent, vDomSetup } from '../setup.tsx';

const runTests = () => {
  describe('createScope and useScopeContext', () => {
    it('should create and consume a basic scope', () => {
      const userData = { name: 'Alice', age: 30 };

      const UserScope = createScope<typeof userData>();

      const ChildComponent = () => {
        const user = useScopeContext(UserScope);
        return (
          <div>
            User: {user.name}, Age: {user.age}
          </div>
        );
      };

      const renderer = getActiveRenderer();
      const result = renderer.render(
        <UserScope.Provider value={userData}>
          <ChildComponent />
        </UserScope.Provider>
      ) as HTMLElement;

      expect(getTextContent(result)).toBe('User: Alice, Age: 30');
    });

    it('should throw error when scope is not provided', () => {
      const MissingScope = createScope();

      expect(() => {
        useScopeContext(MissingScope);
      }).toThrow(
        'No parent scope found for the provided scope (Scope).\nThis usually means you are calling useScopeContext outside of a <Scope.Provider> for this scope.'
      );
    });

    it('should handle nested scopes with same key', () => {
      const ThemeScope = createScope<string>();

      const Component = () => {
        const theme = useScopeContext(ThemeScope);
        return <div>Theme: {theme}</div>;
      };

      const renderer = getActiveRenderer();

      const result = renderer.render(
        <ThemeScope.Provider value="light">
          <div>
            <Component />
            <ThemeScope.Provider value="dark">
              <Component />
            </ThemeScope.Provider>
            <Component />
          </div>
        </ThemeScope.Provider>
      ) as HTMLElement;

      expect(getTextContent(result)).toBe(
        'Theme: lightTheme: darkTheme: light'
      );
    });

    it('should handle different scope keys simultaneously', () => {
      const UserScope = createScope<{ name: string }>();
      const ThemeScope = createScope<string>();

      const Component = () => {
        const user = useScopeContext(UserScope);
        const theme = useScopeContext(ThemeScope);
        return (
          <div>
            User: {user.name}, Theme: {theme}
          </div>
        );
      };

      const renderer = getActiveRenderer();
      const result = renderer.render(
        <UserScope.Provider value={{ name: 'Bob' }}>
          <ThemeScope.Provider value={'dark'}>
            <Component />
          </ThemeScope.Provider>
        </UserScope.Provider>
      ) as HTMLElement;

      expect(getTextContent(result)).toBe('User: Bob, Theme: dark');
    });
  });

  describe('Scope.Provider children component syntax', () => {
    it('should create and consume a basic scope using children', () => {
      const userData = { name: 'Alice', age: 30 };
      const UserScope = createScope<typeof userData>();

      const ChildComponent = () => {
        const user = useScopeContext(UserScope);
        return (
          <div>
            User: {user.name}, Age: {user.age}
          </div>
        );
      };

      const renderer = getActiveRenderer();
      const result = renderer.render(
        <UserScope.Provider value={userData}>
          <ChildComponent />
        </UserScope.Provider>
      ) as HTMLElement;

      expect(getTextContent(result)).toBe('User: Alice, Age: 30');
    });

    it('should handle nested scopes with children', () => {
      const ThemeScope = createScope<string>();

      const Component = () => {
        const theme = useScopeContext(ThemeScope);
        return <div>Theme: {theme}</div>;
      };

      const renderer = getActiveRenderer();
      const result = renderer.render(
        <ThemeScope.Provider value={'light'}>
          <div>
            <Component />
            <ThemeScope.Provider value={'dark'}>
              <Component />
            </ThemeScope.Provider>
            <Component />
          </div>
        </ThemeScope.Provider>
      ) as HTMLElement;

      expect(getTextContent(result)).toBe(
        'Theme: lightTheme: darkTheme: light'
      );
    });

    it('should handle different scope keys simultaneously with children', () => {
      const UserScope = createScope<{ name: string }>();
      const ThemeScope = createScope<string>();

      const Component = () => {
        const user = useScopeContext(UserScope);
        const theme = useScopeContext(ThemeScope);
        return (
          <div>
            User: {user.name}, Theme: {theme}
          </div>
        );
      };

      const renderer = getActiveRenderer();
      const result = renderer.render(
        <UserScope.Provider value={{ name: 'Bob' }}>
          <ThemeScope.Provider value={'dark'}>
            <Component />
          </ThemeScope.Provider>
        </UserScope.Provider>
      ) as HTMLElement;

      expect(getTextContent(result)).toBe('User: Bob, Theme: dark');
    });
  });

  describe('scope with reactive components', () => {
    it('should work with If statements', () => {
      const showDetails = Cell.source(false);
      const config = {
        appName: 'MyApp',
        version: '1.0.0',
        moreDetails: 'This is a sample app',
      };
      const ConfigScope = createScope<typeof config>();
      const App = () => {
        return (
          <ConfigScope.Provider value={config}>
            <Component />
          </ConfigScope.Provider>
        );
      };

      const OverviewComponent = () => {
        const data = useScopeContext(ConfigScope);
        const { appName } = data;
        return <div>{appName}</div>;
      };

      const DetailsComponent = () => {
        const scope = useScopeContext(ConfigScope);
        const { appName, version, moreDetails } = scope;
        return (
          <div>
            App Name: {appName}, Version: {version}, More Details: {moreDetails}
          </div>
        );
      };

      const Component = () => {
        return (
          <div>
            {If(showDetails, {
              true: DetailsComponent,
              false: OverviewComponent,
            })}
          </div>
        );
      };

      const renderer = getActiveRenderer();
      const result = renderer.render(App) as HTMLElement;
      expect(getTextContent(result)).toBe('MyApp');
      showDetails.set(true);
      expect(getTextContent(result)).toBe(
        'App Name: MyApp, Version: 1.0.0, More Details: This is a sample app'
      );
    });

    it('should work with If statements and nested providers', () => {
      const UserScope = createScope<Cell<{ name: string; age: number }>>();
      const ChildComponent = () => {
        const user = useScopeContext(UserScope);
        const name = Cell.derived(() => user.get().name);
        const age = Cell.derived(() => user.get().age);
        const isJohn = Cell.derived(() => user.get().name === 'John Doe');
        return (
          <>
            {If(isJohn, {
              true: () => (
                <div>Scope overriden: John Doe is a special user!</div>
              ),
              false: () => (
                <div>
                  The user's name is {name} and their age is {age}
                </div>
              ),
            })}
          </>
        );
      };
      const ParentComponent = () => {
        const user = useScopeContext(UserScope);
        const nestedUser = Cell.source({ name: 'John Doe', age: 30 });
        const isAlex = Cell.derived(() => user.get().name === 'Alexander');
        return If(isAlex, () => (
          <UserScope.Provider value={nestedUser}>
            <ChildComponent />
          </UserScope.Provider>
        ));
      };
      const user = Cell.source({ name: 'Alice', age: 25 });
      const ProviderContent = () => {
        const isNotAlex = Cell.derived(() => user.get().name !== 'Alexander');
        return (
          <>
            {If(isNotAlex, ChildComponent)}
            <ParentComponent />
          </>
        );
      };
      const App = () => {
        return (
          <div>
            <UserScope.Provider value={user}>
              <ProviderContent />
            </UserScope.Provider>
          </div>
        );
      };
      const renderer = getActiveRenderer();
      const result = renderer.render(App) as HTMLElement;
      expect(getTextContent(result)).toBe(
        "The user's name is Alice and their age is 25"
      );
      user.set({ name: 'Bob', age: 30 });
      expect(getTextContent(result)).toBe(
        "The user's name is Bob and their age is 30"
      );
      user.set({ name: 'Alexander', age: 35 });
      expect(getTextContent(result)).toBe(
        'Scope overriden: John Doe is a special user!'
      );
    });

    it('should work with For loops', () => {
      const ItemsScope = createScope<{ id: number; name: string }[]>();
      const UserScope = createScope<{ name: string }>();
      const itemsData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];
      const userData = { name: 'Alice' };
      const ItemComponent = (props: { item: { id: number; name: string } }) => {
        const user = useScopeContext(UserScope);
        return (
          <div>
            {props.item.name} - owned by {user.name}
          </div>
        );
      };
      const ListComponent = () => {
        const items = useScopeContext(ItemsScope);
        return (
          <div>
            {For(items, (item) => (
              <ItemComponent item={item} />
            ))}
          </div>
        );
      };
      const ItemsProvider = () => (
        <ItemsScope.Provider value={itemsData}>
          <ListComponent />
        </ItemsScope.Provider>
      );
      const renderer = getActiveRenderer();
      const result = renderer.render(
        <UserScope.Provider value={userData}>
          <ItemsProvider />
        </UserScope.Provider>
      ) as HTMLElement;
      expect(getTextContent(result)).toBe(
        'Item 1 - owned by AliceItem 2 - owned by Alice'
      );
    });

    it('should work with Switch statements', () => {
      const currentState = Cell.source(
        'loading' as 'loading' | 'error' | 'success'
      );
      const StateScope = createScope<{ isLoading: boolean }>();
      const stateData = { isLoading: true };
      const ConfigScope = createScope<{ appName: string }>();
      const configData = { appName: 'TestApp' };
      const Component = () => {
        const config = useScopeContext(ConfigScope);
        return (
          <div>
            <h1>{config.appName}</h1>
            {Switch(currentState, {
              loading: () => {
                const state = useScopeContext(StateScope);
                return <div>Loading: {state.isLoading ? 'Yes' : 'No'}</div>;
              },
              error: () => <div>Error occurred</div>,
              success: () => <div>Success!</div>,
            })}
          </div>
        );
      };
      const StateProvider = () => (
        <StateScope.Provider value={stateData}>
          <Component />
        </StateScope.Provider>
      );
      const renderer = getActiveRenderer();
      const result = renderer.render(
        <ConfigScope.Provider value={configData}>
          <StateProvider />
        </ConfigScope.Provider>
      ) as HTMLElement;
      expect(getTextContent(result)).toBe('TestAppLoading: Yes');
      currentState.set('error');
      expect(getTextContent(result)).toBe('TestAppError occurred');
      currentState.set('success');
      expect(getTextContent(result)).toBe('TestAppSuccess!');
    });
  });

  describe('branchState and withStateSnapshot', () => {
    it('should restore scope values from snapshot', () => {
      const CounterScope = createScope<number>();
      let snapshot: ReturnType<typeof branchState>;
      const testResults: number[] = [];

      const Recorder = () => {
        // Record the current value
        const currentValue = useScopeContext(CounterScope);
        testResults.push(currentValue);
        // Test withStateSnapshot
        const restoredValue = withStateSnapshot(snapshot, () => {
          return useScopeContext(CounterScope);
        });
        testResults.push(restoredValue);
        return <div>Test completed</div>;
      };

      const InnerProvider = () => (
        <CounterScope.Provider value={2}>
          <Recorder />
        </CounterScope.Provider>
      );

      const OuterProvider = () => {
        snapshot = branchState();
        return <InnerProvider />;
      };
      const renderer = getActiveRenderer();
      const result = renderer.render(
        <CounterScope.Provider value={1}>
          <OuterProvider />
        </CounterScope.Provider>
      ) as HTMLElement;
      expect(getTextContent(result)).toBe('Test completed');
      expect(testResults).toEqual([2, 1]); // Current value: 2, Restored value: 1
    });

    it('should restore active renderer from snapshot', () => {
      const initialRenderer = getActiveRenderer();
      const mockRenderer = { name: 'mock' } as any;

      setActiveRenderer(mockRenderer);
      const snapshot = branchState();
      expect(snapshot.renderer).toBe(mockRenderer);

      setActiveRenderer(initialRenderer);
      expect(getActiveRenderer()).toBe(initialRenderer);

      withStateSnapshot(snapshot, () => {
        expect(getActiveRenderer()).toBe(mockRenderer);
      });

      expect(getActiveRenderer()).toBe(initialRenderer);
    });

    it('should handle empty snapshots', () => {
      const emptySnapshot = branchState();
      expect(emptySnapshot.scopes).toBeNull();
      const result = withStateSnapshot(emptySnapshot, () => {
        return 'test-result';
      });
      expect(result).toBe('test-result');
    });
  });

  describe('EffectNode ID', () => {
    it('should assign hierarchical IDs to branched nodes', () => {
      const snapshot1 = branchState();
      const snapshot2 = branchState();
      const snapshot3 = branchState();

      expect(snapshot1.node.id).toBe('0.0');
      expect(snapshot2.node.id).toBe('0.1');
      expect(snapshot3.node.id).toBe('0.2');
    });

    it('should create nested hierarchical IDs', () => {
      const parent = branchState();

      const child1 = withStateSnapshot(parent, () => branchState());
      const child2 = withStateSnapshot(parent, () => branchState());

      expect(parent.node.id).toBe('0.0');
      expect(child1.node.id).toBe('0.0.0');
      expect(child2.node.id).toBe('0.0.1');
    });

    it('should support deeply nested branches', () => {
      const level1 = branchState();
      const level2 = withStateSnapshot(level1, () => branchState());
      const level3 = withStateSnapshot(level2, () => branchState());

      expect(level1.node.id).toBe('0.0');
      expect(level2.node.id).toBe('0.0.0');
      expect(level3.node.id).toBe('0.0.0.0');
    });
  });

  describe('scope cleanup and lifecycle', () => {
    it('should clean up scope when Scope unmounts', () => {
      const TestScope = createScope<string>();
      const TestComponent = () => {
        const value = useScopeContext(TestScope);
        return <div>{value}</div>;
      };
      // First render
      const renderer = getActiveRenderer();
      const result1 = renderer.render(
        <TestScope.Provider value={'test-value'}>
          <TestComponent />
        </TestScope.Provider>
      ) as HTMLElement;
      expect(getTextContent(result1)).toBe('test-value');
      // After unmount, scope should be cleaned up
      // Try to use scope outside of Scope context
      expect(() => {
        useScopeContext(TestScope);
      }).toThrow(
        'No parent scope found for the provided scope (Scope).\nThis usually means you are calling useScopeContext outside of a <Scope.Provider> for this scope.'
      );
    });

    it('should handle multiple mount/unmount cycles', () => {
      const TestScope = createScope<number>();
      const TestComponent = () => {
        const value = useScopeContext(TestScope);
        return <div>{value}</div>;
      };
      // First mount
      const renderer = getActiveRenderer();
      const result1 = renderer.render(
        <TestScope.Provider value={1}>
          <TestComponent />
        </TestScope.Provider>
      ) as HTMLElement;
      expect(getTextContent(result1)).toBe('1');
      // Second mount with different data
      const result2 = renderer.render(
        <TestScope.Provider value={2}>
          <TestComponent />
        </TestScope.Provider>
      ) as HTMLElement;
      expect(getTextContent(result2)).toBe('2');
      // Third mount
      const result3 = renderer.render(
        <TestScope.Provider value={3}>
          <TestComponent />
        </TestScope.Provider>
      ) as HTMLElement;
      expect(getTextContent(result3)).toBe('3');
    });
  });

  describe('error handling', () => {
    it('should provide meaningful error messages', () => {
      const TestScope = createScope();
      expect(() => {
        useScopeContext(TestScope);
      }).toThrow(
        'No parent scope found for the provided scope (Scope).\nThis usually means you are calling useScopeContext outside of a <Scope.Provider> for this scope.'
      );
    });

    it('should handle concurrent access patterns', () => {
      const SharedScope = createScope<string>();
      const Component1 = () => {
        const value = useScopeContext(SharedScope);
        return <div>Component1: {value}</div>;
      };
      const Component2 = () => {
        const value = useScopeContext(SharedScope);
        return <div>Component2: {value}</div>;
      };
      const renderer = getActiveRenderer();
      const result = renderer.render(
        <SharedScope.Provider value={'shared-value'}>
          <div>
            <Component1 />
            <Component2 />
          </div>
        </SharedScope.Provider>
      ) as HTMLElement;
      expect(getTextContent(result)).toBe(
        'Component1: shared-valueComponent2: shared-value'
      );
    });
  });

  describe('scope with complex data types', () => {
    it('should handle complex objects', () => {
      const complexData = {
        user: { name: 'Alice', preferences: { theme: 'dark' } },
        items: [{ id: 1, name: 'Item 1' }],
        metadata: { timestamp: Date.now() },
      };
      const ComplexScope = createScope<typeof complexData>();
      const Component = () => {
        const data = useScopeContext(ComplexScope);
        return (
          <div>
            User: {data.user.name}, Theme: {data.user.preferences.theme}, Items:{' '}
            {data.items.length}, Has Metadata: {data.metadata ? 'Yes' : 'No'}
          </div>
        );
      };
      const renderer = getActiveRenderer();
      const result = renderer.render(
        <ComplexScope.Provider value={complexData}>
          <Component />
        </ComplexScope.Provider>
      ) as HTMLElement;
      expect(getTextContent(result)).toBe(
        'User: Alice, Theme: dark, Items: 1, Has Metadata: Yes'
      );
    });

    it('should handle functions in scope', () => {
      const functionsData = {
        greet: (name: string) => `Hello, ${name}!`,
        calculate: (a: number, b: number) => a + b,
      };
      const FunctionsScope = createScope<typeof functionsData>();
      const Component = () => {
        const { greet, calculate } = useScopeContext(FunctionsScope);
        return (
          <div>
            {greet('World')} Result: {calculate(2, 3)}
          </div>
        );
      };
      const renderer = getActiveRenderer();
      const result = renderer.render(
        <FunctionsScope.Provider value={functionsData}>
          <Component />
        </FunctionsScope.Provider>
      ) as HTMLElement;
      expect(getTextContent(result)).toBe('Hello, World! Result: 5');
    });

    it('should handle Cell objects in scope', () => {
      const cellData = {
        counter: Cell.source(0),
        message: Cell.source('Hello'),
      };
      const CellScope = createScope<typeof cellData>();
      const Component = () => {
        const { counter, message } = useScopeContext(CellScope);
        return (
          <div>
            Counter: {counter}, Message: {message}
          </div>
        );
      };
      const renderer = getActiveRenderer();
      const result = renderer.render(
        <CellScope.Provider value={cellData}>
          <Component />
        </CellScope.Provider>
      ) as HTMLElement;
      expect(getTextContent(result)).toBe('Counter: 0, Message: Hello');
      // Test reactivity
      cellData.counter.set(5);
      cellData.message.set('Updated');
      expect(getTextContent(result)).toBe('Counter: 5, Message: Updated');
    });
  });
};

describe('Scope Utilities', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
