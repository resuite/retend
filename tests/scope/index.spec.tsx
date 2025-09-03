import { describe, it, expect } from 'vitest';
import { Cell } from 'retend';
import { For, If, Switch } from 'retend';
import {
  createScope,
  useScopeContext,
  createScopeSnapshot,
  withScopeSnapshot,
  combineScopes,
} from 'retend';
import { browserSetup, getTextContent, vDomSetup } from '../setup.ts';

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

      const result = (
        <UserScope.Provider value={userData} content={ChildComponent} />
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

      const result = (
        <ThemeScope.Provider
          value={'light'}
          content={() => (
            <div>
              <Component />
              <ThemeScope.Provider value={'dark'} content={Component} />
              <Component />
            </div>
          )}
        />
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

      const result = (
        <UserScope.Provider
          value={{ name: 'Bob' }}
          content={() => (
            <ThemeScope.Provider value={'dark'} content={Component} />
          )}
        />
      ) as HTMLElement;

      expect(getTextContent(result)).toBe('User: Bob, Theme: dark');
    });
  });

  describe('Scope.Provider children function syntax', () => {
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

      const result = (
        <UserScope.Provider value={userData}>
          {() => <ChildComponent />}
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

      const result = (
        <ThemeScope.Provider value={'light'}>
          {() => (
            <div>
              <Component />
              <ThemeScope.Provider value={'dark'}>
                {() => <Component />}
              </ThemeScope.Provider>
              <Component />
            </div>
          )}
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

      const result = (
        <UserScope.Provider value={{ name: 'Bob' }}>
          {() => (
            <ThemeScope.Provider value={'dark'}>
              {() => <Component />}
            </ThemeScope.Provider>
          )}
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
        return <ConfigScope.Provider value={config} content={Component} />;
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

      const result = App() as HTMLElement;
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
          <UserScope.Provider value={nestedUser} content={ChildComponent} />
        ));
      };
      const user = Cell.source({ name: 'Alice', age: 25 });
      const App = () => {
        const isNotAlex = Cell.derived(() => user.get().name !== 'Alexander');
        return (
          <div>
            <UserScope.Provider
              value={user}
              content={() => (
                <>
                  {If(isNotAlex, ChildComponent)}
                  <ParentComponent />
                </>
              )}
            />
          </div>
        );
      };
      const result = App() as HTMLElement;
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
      const result = (
        <UserScope.Provider
          value={userData}
          content={() => (
            <ItemsScope.Provider
              value={itemsData}
              content={() => <ListComponent />}
            />
          )}
        />
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
      const result = (
        <ConfigScope.Provider
          value={configData}
          content={() => (
            <StateScope.Provider
              value={stateData}
              content={() => <Component />}
            />
          )}
        />
      ) as HTMLElement;
      expect(getTextContent(result)).toBe('TestAppLoading: Yes');
      currentState.set('error');
      expect(getTextContent(result)).toBe('TestAppError occurred');
      currentState.set('success');
      expect(getTextContent(result)).toBe('TestAppSuccess!');
    });
  });

  describe('createScopeSnapshot and withScopeSnapshot', () => {
    it('should restore scope values from snapshot', () => {
      const CounterScope = createScope<number>();
      let snapshot: ReturnType<typeof createScopeSnapshot>;
      let testResults: number[] = [];
      const result = (
        <CounterScope.Provider
          value={1}
          content={() => {
            snapshot = createScopeSnapshot();
            return (
              <CounterScope.Provider
                value={2}
                content={() => {
                  // Record the current value
                  const currentValue = useScopeContext(CounterScope);
                  testResults.push(currentValue);
                  // Test withScopeSnapshot
                  const restoredValue = withScopeSnapshot(snapshot, () => {
                    return useScopeContext(CounterScope);
                  });
                  testResults.push(restoredValue);
                  return <div>Test completed</div>;
                }}
              />
            );
          }}
        />
      ) as HTMLElement;
      expect(getTextContent(result)).toBe('Test completed');
      expect(testResults).toEqual([2, 1]); // Current value: 2, Restored value: 1
    });

    it('should handle empty snapshots', () => {
      const emptySnapshot = createScopeSnapshot();
      expect(emptySnapshot.scopes.size).toBe(0);
      const result = withScopeSnapshot(emptySnapshot, () => {
        return 'test-result';
      });
      expect(result).toBe('test-result');
    });
  });

  describe('combineScopes', () => {
    it('should combine multiple scopes', () => {
      const UserScope = createScope<{ name: string }>();
      const ThemeScope = createScope<string>();
      const ConfigScope = createScope<{ debug: boolean }>();
      const CombinedScope = combineScopes(UserScope, ThemeScope, ConfigScope);
      const Component = () => {
        const user = useScopeContext(UserScope);
        const theme = useScopeContext(ThemeScope);
        const config = useScopeContext(ConfigScope);
        return (
          <div>
            User: {user.name}, Theme: {theme}, Debug:{' '}
            {config.debug ? 'On' : 'Off'}
          </div>
        );
      };
      const ScopeData = {
        [UserScope.key]: { name: 'Alice' },
        [ThemeScope.key]: 'dark',
        [ConfigScope.key]: { debug: true },
      };
      const result = (
        <CombinedScope.Provider value={ScopeData} content={Component} />
      ) as HTMLElement;
      expect(getTextContent(result)).toBe(
        'User: Alice, Theme: dark, Debug: On'
      );
    });

    it('should handle Scope order correctly', () => {
      const Scope1 = createScope<string>();
      const Scope2 = createScope<string>();
      const CombinedScope = combineScopes(Scope1, Scope2);
      const Component = () => {
        const value1 = useScopeContext(Scope1);
        const value2 = useScopeContext(Scope2);
        return (
          <div>
            {value1}-{value2}
          </div>
        );
      };
      const ScopeData = {
        [Scope1.key]: 'first',
        [Scope2.key]: 'second',
      };
      const result = (
        <CombinedScope.Provider
          value={ScopeData}
          content={() => <Component />}
        />
      ) as HTMLElement;
      expect(getTextContent(result)).toBe('first-second');
    });

    it('should work with a single Scope', () => {
      const UserScope = createScope<{ name: string }>();
      const CombinedScope = combineScopes(UserScope);
      const Component = () => {
        const user = useScopeContext(UserScope);
        return <div>{user.name}</div>;
      };
      const ScopeData = { [UserScope.key]: { name: 'Solo' } };
      const result = (
        <CombinedScope.Provider
          value={ScopeData}
          content={() => <Component />}
        />
      ) as HTMLElement;
      expect(getTextContent(result)).toBe('Solo');
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
      const result1 = (
        <TestScope.Provider value={'test-value'} content={TestComponent} />
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
      const result1 = (
        <TestScope.Provider value={1} content={TestComponent} />
      ) as HTMLElement;
      expect(getTextContent(result1)).toBe('1');
      // Second mount with different data
      const result2 = (
        <TestScope.Provider value={2} content={TestComponent} />
      ) as HTMLElement;
      expect(getTextContent(result2)).toBe('2');
      // Third mount
      const result3 = (
        <TestScope.Provider value={3} content={TestComponent} />
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
      const result = (
        <SharedScope.Provider
          value={'shared-value'}
          content={() => (
            <div>
              <Component1 />
              <Component2 />
            </div>
          )}
        />
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
      const result = (
        <ComplexScope.Provider value={complexData} content={Component} />
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
      const result = (
        <FunctionsScope.Provider value={functionsData} content={Component} />
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
      const result = (
        <CellScope.Provider value={cellData} content={Component} />
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
