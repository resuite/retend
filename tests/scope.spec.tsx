import { describe, it, expect } from "vitest";
import { Cell, type Scope } from "retend";
import { For, If, Switch } from "retend";
import {
  createScope,
  useScopeContext,
  createScopeSnapshot,
  withScopeSnapshot,
  combineScopes,
} from "retend";
import { browserSetup, getTextContent, vDomSetup } from "./setup.ts";

const runTests = () => {
  describe("createScope and useScopeContext", () => {
    it("should create and consume a basic scope", () => {
      const userData = { name: "Alice", age: 30 };

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
        <UserScope value={userData} content={ChildComponent} />
      ) as HTMLElement;

      expect(getTextContent(result)).toBe("User: Alice, Age: 30");
    });

    it("should throw error when scope is not provided", () => {
      const MissingScope = createScope();

      expect(() => {
        useScopeContext(MissingScope);
      }).toThrow("No parent scope found for the provided scope.");
    });

    it("should handle nested scopes with same key", () => {
      const ThemeScope = createScope<string>();

      const Component = () => {
        const theme = useScopeContext(ThemeScope);
        return <div>Theme: {theme}</div>;
      };

      const result = (
        <ThemeScope
          value={"light"}
          content={() => (
            <div>
              <Component />
              <ThemeScope value={"dark"} content={Component} />
              <Component />
            </div>
          )}
        />
      ) as HTMLElement;

      expect(getTextContent(result)).toBe(
        "Theme: lightTheme: darkTheme: light",
      );
    });

    it("should handle different scope keys simultaneously", () => {
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
        <UserScope
          value={{ name: "Bob" }}
          content={() => <ThemeScope value={"dark"} content={Component} />}
        />
      ) as HTMLElement;

      expect(getTextContent(result)).toBe("User: Bob, Theme: dark");
    });
  });

  describe("scope with reactive components", () => {
    it("should work with If statements", () => {
      const showDetails = Cell.source(false);
      const config = {
        appName: "MyApp",
        version: "1.0.0",
        moreDetails: "This is a sample app",
      };
      const ConfigScope = createScope<typeof config>();
      const App = () => {
        return <ConfigScope value={config} content={Component} />;
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
      expect(getTextContent(result)).toBe("MyApp");
      showDetails.set(true);
      expect(getTextContent(result)).toBe(
        "App Name: MyApp, Version: 1.0.0, More Details: This is a sample app",
      );
    });

    it("should work with If statements and nested providers", () => {
      const UserScope = createScope<Cell<{ name: string; age: number }>>();
      const ChildComponent = () => {
        const user = useScopeContext(UserScope);
        const name = Cell.derived(() => user.get().name);
        const age = Cell.derived(() => user.get().age);
        const isJohn = Cell.derived(() => user.get().name === "John Doe");
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
        const nestedUser = Cell.source({ name: "John Doe", age: 30 });
        const isAlex = Cell.derived(() => user.get().name === "Alexander");
        return If(isAlex, () => (
          <UserScope value={nestedUser} content={ChildComponent} />
        ));
      };
      const user = Cell.source({ name: "Alice", age: 25 });
      const App = () => {
        const isNotAlex = Cell.derived(() => user.get().name !== "Alexander");
        return (
          <div>
            <UserScope
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
        "The user's name is Alice and their age is 25",
      );
      user.set({ name: "Bob", age: 30 });
      expect(getTextContent(result)).toBe(
        "The user's name is Bob and their age is 30",
      );
      user.set({ name: "Alexander", age: 35 });
      expect(getTextContent(result)).toBe(
        "Scope overriden: John Doe is a special user!",
      );
    });

    it("should work with For loops", () => {
      const ItemsScope = createScope<{ id: number; name: string }[]>();
      const UserScope = createScope<{ name: string }>();
      const itemsData = [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
      ];
      const userData = { name: "Alice" };
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
        <UserScope
          value={userData}
          content={() => (
            <ItemsScope value={itemsData} content={() => <ListComponent />} />
          )}
        />
      ) as HTMLElement;
      expect(getTextContent(result)).toBe(
        "Item 1 - owned by AliceItem 2 - owned by Alice",
      );
    });

    it("should work with Switch statements", () => {
      const currentState = Cell.source(
        "loading" as "loading" | "error" | "success",
      );
      const StateScope = createScope<{ isLoading: boolean }>();
      const stateData = { isLoading: true };
      const ConfigScope = createScope<{ appName: string }>();
      const configData = { appName: "TestApp" };
      const Component = () => {
        const config = useScopeContext(ConfigScope);
        return (
          <div>
            <h1>{config.appName}</h1>
            {Switch(currentState, {
              loading: () => {
                const state = useScopeContext(StateScope);
                return <div>Loading: {state.isLoading ? "Yes" : "No"}</div>;
              },
              error: () => <div>Error occurred</div>,
              success: () => <div>Success!</div>,
            })}
          </div>
        );
      };
      const result = (
        <ConfigScope
          value={configData}
          content={() => (
            <StateScope value={stateData} content={() => <Component />} />
          )}
        />
      ) as HTMLElement;
      expect(getTextContent(result)).toBe("TestAppLoading: Yes");
      currentState.set("error");
      expect(getTextContent(result)).toBe("TestAppError occurred");
      currentState.set("success");
      expect(getTextContent(result)).toBe("TestAppSuccess!");
    });
  });

  describe("createScopeSnapshot and withScopeSnapshot", () => {
    it("should restore scope values from snapshot", () => {
      const CounterScope = createScope<number>();
      let snapshot: ReturnType<typeof createScopeSnapshot>;
      let testResults: number[] = [];
      const result = (
        <CounterScope
          value={1}
          content={() => {
            snapshot = createScopeSnapshot();
            return (
              <CounterScope
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
      expect(getTextContent(result)).toBe("Test completed");
      expect(testResults).toEqual([2, 1]); // Current value: 2, Restored value: 1
    });

    it("should handle empty snapshots", () => {
      const emptySnapshot = createScopeSnapshot();
      expect(emptySnapshot.size).toBe(0);
      const result = withScopeSnapshot(emptySnapshot, () => {
        return "test-result";
      });
      expect(result).toBe("test-result");
    });
  });

  describe("combineScopes", () => {
    it("should combine multiple scopes", () => {
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
            User: {user.name}, Theme: {theme}, Debug:{" "}
            {config.debug ? "On" : "Off"}
          </div>
        );
      };
      const ScopeData = new Map<Scope, unknown>([
        [UserScope, { name: "Alice" }],
        [ThemeScope, "dark"],
        [ConfigScope, { debug: true }],
      ]);
      const result = (
        <CombinedScope value={ScopeData} content={Component} />
      ) as HTMLElement;
      expect(getTextContent(result)).toBe(
        "User: Alice, Theme: dark, Debug: On",
      );
    });

    it("should handle Scope order correctly", () => {
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
      const ScopeData = new Map([
        [Scope1, "first"],
        [Scope2, "second"],
      ]);
      const result = (
        <CombinedScope value={ScopeData} content={() => <Component />} />
      ) as HTMLElement;
      expect(getTextContent(result)).toBe("first-second");
    });

    it("should work with a single Scope", () => {
      const UserScope = createScope<{ name: string }>();
      const CombinedScope = combineScopes(UserScope);
      const Component = () => {
        const user = useScopeContext(UserScope);
        return <div>{user.name}</div>;
      };
      const ScopeData = new Map([[UserScope, { name: "Solo" }]]);
      const result = (
        <CombinedScope value={ScopeData} content={() => <Component />} />
      ) as HTMLElement;
      expect(getTextContent(result)).toBe("Solo");
    });
  });

  describe("scope cleanup and lifecycle", () => {
    it("should clean up scope when Scope unmounts", () => {
      const TestScope = createScope<string>();
      const TestComponent = () => {
        const value = useScopeContext(TestScope);
        return <div>{value}</div>;
      };
      // First render
      const result1 = (
        <TestScope value={"test-value"} content={TestComponent} />
      ) as HTMLElement;
      expect(getTextContent(result1)).toBe("test-value");
      // After unmount, scope should be cleaned up
      // Try to use scope outside of Scope context
      expect(() => {
        useScopeContext(TestScope);
      }).toThrow("No parent scope found for the provided scope.");
    });

    it("should handle multiple mount/unmount cycles", () => {
      const TestScope = createScope<number>();
      const TestComponent = () => {
        const value = useScopeContext(TestScope);
        return <div>{value}</div>;
      };
      // First mount
      const result1 = (
        <TestScope value={1} content={TestComponent} />
      ) as HTMLElement;
      expect(getTextContent(result1)).toBe("1");
      // Second mount with different data
      const result2 = (
        <TestScope value={2} content={TestComponent} />
      ) as HTMLElement;
      expect(getTextContent(result2)).toBe("2");
      // Third mount
      const result3 = (
        <TestScope value={3} content={TestComponent} />
      ) as HTMLElement;
      expect(getTextContent(result3)).toBe("3");
    });
  });

  describe("error handling", () => {
    it("should provide meaningful error messages", () => {
      const TestScope = createScope();
      expect(() => {
        useScopeContext(TestScope);
      }).toThrow("No parent scope found for the provided scope.");
    });

    it("should handle concurrent access patterns", () => {
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
        <SharedScope
          value={"shared-value"}
          content={() => (
            <div>
              <Component1 />
              <Component2 />
            </div>
          )}
        />
      ) as HTMLElement;
      expect(getTextContent(result)).toBe(
        "Component1: shared-valueComponent2: shared-value",
      );
    });
  });

  describe("scope with complex data types", () => {
    it("should handle complex objects", () => {
      const complexData = {
        user: { name: "Alice", preferences: { theme: "dark" } },
        items: [{ id: 1, name: "Item 1" }],
        metadata: { timestamp: Date.now() },
      };
      const ComplexScope = createScope<typeof complexData>();
      const Component = () => {
        const data = useScopeContext(ComplexScope);
        return (
          <div>
            User: {data.user.name}, Theme: {data.user.preferences.theme}, Items:{" "}
            {data.items.length}, Has Metadata: {data.metadata ? "Yes" : "No"}
          </div>
        );
      };
      const result = (
        <ComplexScope value={complexData} content={Component} />
      ) as HTMLElement;
      expect(getTextContent(result)).toBe(
        "User: Alice, Theme: dark, Items: 1, Has Metadata: Yes",
      );
    });

    it("should handle functions in scope", () => {
      const functionsData = {
        greet: (name: string) => `Hello, ${name}!`,
        calculate: (a: number, b: number) => a + b,
      };
      const FunctionsScope = createScope<typeof functionsData>();
      const Component = () => {
        const { greet, calculate } = useScopeContext(FunctionsScope);
        return (
          <div>
            {greet("World")} Result: {calculate(2, 3)}
          </div>
        );
      };
      const result = (
        <FunctionsScope value={functionsData} content={Component} />
      ) as HTMLElement;
      expect(getTextContent(result)).toBe("Hello, World! Result: 5");
    });

    it("should handle Cell objects in scope", () => {
      const cellData = {
        counter: Cell.source(0),
        message: Cell.source("Hello"),
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
        <CellScope value={cellData} content={Component} />
      ) as HTMLElement;
      expect(getTextContent(result)).toBe("Counter: 0, Message: Hello");
      // Test reactivity
      cellData.counter.set(5);
      cellData.message.set("Updated");
      expect(getTextContent(result)).toBe("Counter: 5, Message: Updated");
    });
  });

  // describe("scope with async components", () => {
  //   const config = { environment: "production" };
  //   const userData = { name: "John" };
  //   const ConfigScope = createScope<typeof config>();
  //   const UserScope = createScope<typeof userData>();

  //   it("should work with async operations", async () => {
  //     const AsyncComponent = async () => {
  //       // Simulate async operation
  //       const user = useScopeContext(UserScope);
  //       const config = useScopeContext(ConfigScope);
  //       await new Promise((resolve) => setTimeout(resolve, 10));
  //       return (
  //         <div>
  //           User {user.name} in {config.environment}
  //         </div>
  //       );
  //     };
  //     const result = (
  //       <div>
  //         <ConfigScope
  //           value= {config}
  //           content={() => (
  //             <UserScope value= {userData} content={AsyncComponent} />
  //           )}
  //         />
  //       </div>
  //     ) as HTMLElement;
  //     // Wait for nested async components to resolve
  //     await new Promise((resolve) => setTimeout(resolve, 50));
  //     expect(getTextContent(result)).toBe("User John in production");
  //   });

  //   it("should work with parallel async components with same scope", async () => {
  //     const Component1 = async () => {
  //       await new Promise<void>((r) => setTimeout(r, 50));
  //       const user = useScopeContext(UserScope);
  //       return <div>Component 1 returned user {user.name}</div>;
  //     };
  //     const Component2 = async () => {
  //       const user = useScopeContext(UserScope);
  //       await new Promise((r) => setTimeout(r, 10));
  //       return <div>Component 2 returned user {user.name}</div>;
  //     };
  //     const App = () => {
  //       return (
  //         <div>
  //           <Component1 />
  //           {"\n"}
  //           <Component2 />
  //         </div>
  //       );
  //     };
  //     const result = (
  //       <UserScope value= {{ name: "Ade" }} content={App} />
  //     ) as HTMLElement;
  //     await new Promise((resolve) => setTimeout(resolve, 200));
  //     expect(getTextContent(result)).toBe(
  //       "Component 1 returned user Ade\nComponent 2 returned user Ade",
  //     );
  //   });

  //   it("should persist scope across async context switches", async () => {
  //     const ThemeScope = createScope<string>();
  //     const Component1 = async () => {
  //       const snapshot = createScopeSnapshot();
  //       const scope1 = useScopeContext(ThemeScope);
  //       const handlers = createScopeSnapshotHandlers(snapshot);
  //       await new Promise((r) => setTimeout(r, 10));
  //       handlers.setSnapshot();
  //       const scope2 = useScopeContext(ThemeScope);
  //       await new Promise((r) => setTimeout(r, 10));
  //       handlers.setSnapshot();
  //       const scope3 = useScopeContext(ThemeScope);
  //       expect(scope3).toBe(scope1);
  //       expect(scope3).toBe(scope2);
  //       handlers.unsetSnapshot();
  //       return <div>Component 1 returned theme {scope1}</div>;
  //     };
  //     const App = () => {
  //       return (
  //         <div>
  //           <ThemeScope value= "dark" content={Component1} />
  //         </div>
  //       );
  //     };
  //     const result = (<App />) as HTMLElement;
  //     await new Promise((resolve) => setTimeout(resolve, 50));
  //     expect(getTextContent(result)).toBe("Component 1 returned theme dark");
  //   });

  //   it("should work with parallel async components with different scopes", async () => {
  //     const ThemeScope = createScope<string>();
  //     const FirstAsync = async () => {
  //       const scope = useScopeContext(ThemeScope);
  //       console.log("1: Running Component 1 in sync", scope);
  //       await new Promise((r) => setTimeout(r, 0));
  //       console.log("1: Returned from first yield in FirstAsync");
  //       const scope2 = useScopeContext(ThemeScope);
  //       await new Promise((r) => setTimeout(r, 0));
  //       console.log("1: Returned from second yield in FirstAsync");
  //       expect(scope).toBe(scope2);
  //       return <div>Component 1 returned theme {scope}</div>;
  //     };
  //     const SecondAsync = async () => {
  //       const scope = useScopeContext(ThemeScope);
  //       console.log("2: Running Component 2 in sync", scope);
  //       await new Promise((r) => setTimeout(r, 0));
  //       console.log("2: Returned from first yield in SecondAsync");
  //       const scope2 = useScopeContext(ThemeScope);
  //       await new Promise((r) => setTimeout(r, 0));
  //       console.log("2: Returned from second yield in SecondAsync");
  //       expect(scope).toBe(scope2);
  //       return <div>Component 2 returned theme {scope}</div>;
  //     };
  //     const App = () => {
  //       return (
  //         <div>
  //           <ThemeScope value= "light" content={FirstAsync} />
  //           <ThemeScope value= "dark" content={SecondAsync} />
  //         </div>
  //       );
  //     };
  //     const result = (<App />) as HTMLElement;
  //     await new Promise((resolve) => setTimeout(resolve, 50));
  //     expect(getTextContent(result)).toBe(
  //       "Component 1 returned theme light\nComponent 2 returned theme dark",
  //     );
  //   });
  // });
};

describe("Scope Utilities", () => {
  describe("Browser", () => {
    browserSetup();
    runTests();
  });

  describe("VDom", () => {
    vDomSetup();
    runTests();
  });
});
