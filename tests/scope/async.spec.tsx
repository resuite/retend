import { describe } from "vitest";
import { vDomSetup, browserSetup } from "../setup.ts";

const runTests = () => {
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

describe("Async scoping", () => {
  describe("Browser", () => {
    browserSetup();
    runTests();
  });

  describe("VDom", () => {
    vDomSetup();
    runTests();
  });
});
